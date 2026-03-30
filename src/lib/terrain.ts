import type { ExportProfile, GenerateTerrainInput, PreviewTerrain, TerrainClassId, TerrainSettings } from './types'
import { TerrainClass } from './types'

const FULL_HEIGHT_RANGE = 65535

type Region = {
  id: number
  terrainClass: TerrainClassId
  targetHeight: number
  cells: Uint32Array
  adjacency: number[]
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t)
}

function sampleBilinear(source: Float32Array, width: number, height: number, x: number, y: number): number {
  const x0 = Math.floor(clamp(x, 0, width - 1))
  const y0 = Math.floor(clamp(y, 0, height - 1))
  const x1 = Math.min(width - 1, x0 + 1)
  const y1 = Math.min(height - 1, y0 + 1)
  const tx = clamp(x - x0, 0, 1)
  const ty = clamp(y - y0, 0, 1)
  const top = lerp(source[y0 * width + x0], source[y0 * width + x1], tx)
  const bottom = lerp(source[y1 * width + x0], source[y1 * width + x1], tx)
  return lerp(top, bottom, ty)
}

function sampleNearest(source: Uint8Array, width: number, height: number, x: number, y: number): number {
  const sampleX = Math.round(clamp(x, 0, width - 1))
  const sampleY = Math.round(clamp(y, 0, height - 1))
  return source[sampleY * width + sampleX]
}

function hash2d(x: number, y: number, seed: number): number {
  const value = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123
  return value - Math.floor(value)
}

function valueNoise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = x0 + 1
  const y1 = y0 + 1
  const tx = smoothstep(x - x0)
  const ty = smoothstep(y - y0)
  const top = lerp(hash2d(x0, y0, seed), hash2d(x1, y0, seed), tx)
  const bottom = lerp(hash2d(x0, y1, seed), hash2d(x1, y1, seed), tx)
  return lerp(top, bottom, ty) * 2 - 1
}

function blurPass(source: Float32Array, width: number, height: number): Float32Array {
  const target = new Float32Array(source.length)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let total = 0
      let weightTotal = 0
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        const sampleY = clamp(y + offsetY, 0, height - 1)
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          const sampleX = clamp(x + offsetX, 0, width - 1)
          const weight = offsetX === 0 && offsetY === 0 ? 4 : offsetX === 0 || offsetY === 0 ? 2 : 1
          total += source[sampleY * width + sampleX] * weight
          weightTotal += weight
        }
      }
      target[y * width + x] = total / weightTotal
    }
  }
  return target
}

function buildNoiseField(width: number, height: number, settings: TerrainSettings): Float32Array {
  const noise = new Float32Array(width * height)
  if (!settings.noiseEnabled || settings.noiseAmplitude <= 0) {
    return noise
  }

  const scale = Math.max(3, settings.noiseScale)
  const octaves = clamp(settings.noiseOctaves, 1, 6)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let amplitude = 1
      let frequency = 1 / scale
      let total = 0
      let amplitudeSum = 0
      for (let octave = 0; octave < octaves; octave += 1) {
        total += valueNoise(x * frequency, y * frequency, settings.noiseSeed + octave * 101) * amplitude
        amplitudeSum += amplitude
        amplitude *= 0.5
        frequency *= 2
      }
      noise[y * width + x] = total / amplitudeSum
    }
  }

  return blurPass(blurPass(noise, width, height), width, height)
}

function getTargetHeight(terrainClass: TerrainClassId, settings: TerrainSettings): number {
  switch (terrainClass) {
    case TerrainClass.Water:
      return 0
    case TerrainClass.Low:
      return settings.lowPercent
    case TerrainClass.Medium:
      return settings.mediumPercent
    default:
      return settings.highPercent
  }
}

function getNoiseAmplitudePercent(settings: TerrainSettings): number {
  return settings.noiseAmplitude
}

function buildDirectHeightField(sketch: Uint8Array, width: number, height: number, settings: TerrainSettings): Float32Array {
  const field = new Float32Array(width * height)
  for (let index = 0; index < sketch.length; index += 1) {
    field[index] = getTargetHeight(sketch[index] as TerrainClassId, settings)
  }
  return field
}

function buildRegions(sketch: Uint8Array, width: number, height: number, settings: TerrainSettings) {
  const regionIds = new Int32Array(width * height)
  regionIds.fill(-1)
  const queue = new Uint32Array(width * height)
  const regions: Region[] = []
  let nextRegionId = 0

  for (let start = 0; start < sketch.length; start += 1) {
    if (regionIds[start] !== -1) {
      continue
    }

    const terrainClass = sketch[start] as TerrainClassId
    let head = 0
    let tail = 0
    queue[tail] = start
    tail += 1
    regionIds[start] = nextRegionId
    const cells: number[] = []

    while (head < tail) {
      const index = queue[head]
      head += 1
      cells.push(index)

      const x = index % width
      const y = Math.floor(index / width)
      const neighbors = [
        x > 0 ? index - 1 : -1,
        x < width - 1 ? index + 1 : -1,
        y > 0 ? index - width : -1,
        y < height - 1 ? index + width : -1,
      ]

      for (const neighbor of neighbors) {
        if (neighbor === -1 || regionIds[neighbor] !== -1 || sketch[neighbor] !== terrainClass) {
          continue
        }
        regionIds[neighbor] = nextRegionId
        queue[tail] = neighbor
        tail += 1
      }
    }

    regions.push({
      id: nextRegionId,
      terrainClass,
      targetHeight: getTargetHeight(terrainClass, settings),
      cells: Uint32Array.from(cells),
      adjacency: [],
    })
    nextRegionId += 1
  }

  const adjacencySets = Array.from({ length: regions.length }, () => new Set<number>())
  for (let index = 0; index < regionIds.length; index += 1) {
    const regionId = regionIds[index]
    const x = index % width
    const y = Math.floor(index / width)
    const neighbors = [
      x > 0 ? index - 1 : -1,
      x < width - 1 ? index + 1 : -1,
      y > 0 ? index - width : -1,
      y < height - 1 ? index + width : -1,
    ]
    for (const neighbor of neighbors) {
      if (neighbor === -1) {
        continue
      }
      const neighborRegionId = regionIds[neighbor]
      if (neighborRegionId !== regionId) {
        adjacencySets[regionId].add(neighborRegionId)
      }
    }
  }

  regions.forEach((region) => {
    region.adjacency = Array.from(adjacencySets[region.id])
  })

  return { regions, regionIds }
}

function buildBoundaryDistanceField(
  regionId: number,
  neighborId: number,
  regionIds: Int32Array,
  width: number,
  height: number,
  regionCells: Uint32Array,
): Float32Array {
  const field = new Float32Array(width * height)
  field.fill(-1)
  const queue = new Uint32Array(regionCells.length)
  let head = 0
  let tail = 0

  for (const cell of regionCells) {
    const x = cell % width
    const y = Math.floor(cell / width)
    const neighbors = [
      x > 0 ? cell - 1 : -1,
      x < width - 1 ? cell + 1 : -1,
      y > 0 ? cell - width : -1,
      y < height - 1 ? cell + width : -1,
    ]

    let touchesNeighbor = false
    for (const neighbor of neighbors) {
      if (neighbor !== -1 && regionIds[neighbor] === neighborId) {
        touchesNeighbor = true
        break
      }
    }

    if (touchesNeighbor) {
      field[cell] = 0
      queue[tail] = cell
      tail += 1
    }
  }

  while (head < tail) {
    const index = queue[head]
    head += 1
    const nextDistance = field[index] + 1
    const x = index % width
    const y = Math.floor(index / width)
    const neighbors = [
      x > 0 ? index - 1 : -1,
      x < width - 1 ? index + 1 : -1,
      y > 0 ? index - width : -1,
      y < height - 1 ? index + width : -1,
    ]

    for (const neighbor of neighbors) {
      if (neighbor === -1 || regionIds[neighbor] !== regionId || field[neighbor] !== -1) {
        continue
      }
      field[neighbor] = nextDistance
      queue[tail] = neighbor
      tail += 1
    }
  }

  return field
}

function buildInteriorDistanceField(
  regionId: number,
  regionIds: Int32Array,
  width: number,
  height: number,
  regionCells: Uint32Array,
): Float32Array {
  const field = new Float32Array(width * height)
  const queue = new Uint32Array(regionCells.length)
  let head = 0
  let tail = 0

  for (const cell of regionCells) {
    const x = cell % width
    const y = Math.floor(cell / width)
    const neighbors = [
      x > 0 ? cell - 1 : -1,
      x < width - 1 ? cell + 1 : -1,
      y > 0 ? cell - width : -1,
      y < height - 1 ? cell + width : -1,
    ]

    let isBoundary = false
    for (const neighbor of neighbors) {
      if (neighbor === -1 || regionIds[neighbor] !== regionId) {
        isBoundary = true
        break
      }
    }

    if (isBoundary) {
      field[cell] = 0
      queue[tail] = cell
      tail += 1
    } else {
      field[cell] = -1
    }
  }

  while (head < tail) {
    const index = queue[head]
    head += 1
    const nextDistance = field[index] + 1
    const x = index % width
    const y = Math.floor(index / width)
    const neighbors = [
      x > 0 ? index - 1 : -1,
      x < width - 1 ? index + 1 : -1,
      y > 0 ? index - width : -1,
      y < height - 1 ? index + width : -1,
    ]

    for (const neighbor of neighbors) {
      if (neighbor === -1 || regionIds[neighbor] !== regionId || field[neighbor] !== -1) {
        continue
      }
      field[neighbor] = nextDistance
      queue[tail] = neighbor
      tail += 1
    }
  }

  return field
}

function interpolatePinnedShoreline(targetHeight: number, waterDistance: number, corridorWidth: number): number {
  if (waterDistance < 0) {
    return targetHeight
  }

  const t = clamp((waterDistance + 1) / Math.max(1, corridorWidth + 1), 0, 1)
  return clamp(lerp(1, targetHeight, t), 1, targetHeight)
}

function buildInterpolatedHeightField(sketch: Uint8Array, width: number, height: number, settings: TerrainSettings): Float32Array {
  if (settings.smoothing <= 0) {
    return buildDirectHeightField(sketch, width, height, settings)
  }

  const { regions, regionIds } = buildRegions(sketch, width, height, settings)
  const corridorWidth = Math.max(1, settings.smoothing * 2)
  const heightField = new Float32Array(width * height)

  for (const region of regions) {
    for (const cell of region.cells) {
      heightField[cell] = region.targetHeight
    }

    if (region.terrainClass === TerrainClass.Water || region.adjacency.length === 0) {
      continue
    }

    const landBoundaryFields = region.adjacency
      .filter((neighborId) => {
        const neighbor = regions[neighborId]
        return neighbor.terrainClass !== TerrainClass.Water && neighbor.targetHeight > region.targetHeight
      })
      .map((neighborId) => ({
        neighborId,
        field: buildBoundaryDistanceField(region.id, neighborId, regionIds, width, height, region.cells),
      }))
    const waterBoundaryFields = region.adjacency
      .filter((neighborId) => regions[neighborId].terrainClass === TerrainClass.Water)
      .map((neighborId) => ({
      neighborId,
      field: buildBoundaryDistanceField(region.id, neighborId, regionIds, width, height, region.cells),
    }))
    const interiorField = buildInteriorDistanceField(region.id, regionIds, width, height, region.cells)

    for (const cell of region.cells) {
      const interiorDistance = interiorField[cell]
      if (interiorDistance > corridorWidth) {
        heightField[cell] = region.targetHeight
      } else {
        let localHeight = region.targetHeight

        for (const boundary of landBoundaryFields) {
          const distance = boundary.field[cell]
          if (distance < 0 || distance > corridorWidth) {
            continue
          }

          const t = 1 - distance / (corridorWidth + 1)
          const eased = smoothstep(t)
          const neighborHeight = regions[boundary.neighborId].targetHeight
          const rampHeight = lerp(region.targetHeight, neighborHeight, eased)
          localHeight = Math.max(localHeight, rampHeight)
        }

        heightField[cell] = localHeight
      }

      for (const boundary of waterBoundaryFields) {
        const distance = boundary.field[cell]
        if (distance < 0 || distance > corridorWidth) {
          continue
        }
        heightField[cell] = interpolatePinnedShoreline(heightField[cell], distance, corridorWidth)
      }
    }
  }

  return heightField
}

export function createInitialSketch(width: number, height: number): Uint8Array {
  const sketch = new Uint8Array(width * height)
  sketch.fill(TerrainClass.Low)
  return sketch
}

export function computePreviewResolution(width: number, height: number, maxEdge: number): [number, number] {
  const aspect = width / height
  if (aspect >= 1) {
    return [maxEdge, Math.max(96, Math.round(maxEdge / aspect))]
  }
  return [Math.max(96, Math.round(maxEdge * aspect)), maxEdge]
}

export function buildExportProfile(width: number, height: number, importMaxElevation: number): ExportProfile {
  return {
    width,
    height,
    bitDepth: 16,
    rangeMin: 0,
    rangeMax: Math.max(1, Math.ceil(importMaxElevation)),
    waterLevel: 0,
  }
}

export function generateTerrain(input: GenerateTerrainInput): PreviewTerrain {
  const {
    sketch,
    sketchWidth,
    sketchHeight,
    outputWidth,
    outputHeight,
    settings,
  } = input

  const baseHeight = buildInterpolatedHeightField(sketch, sketchWidth, sketchHeight, settings)
  const noise = buildNoiseField(sketchWidth, sketchHeight, settings)
  const heights = new Uint16Array(outputWidth * outputHeight)
  const noiseAmplitudePercent = getNoiseAmplitudePercent(settings)

  let minHeight = Number.POSITIVE_INFINITY
  let maxHeight = Number.NEGATIVE_INFINITY
  const topTarget = Math.min(100, settings.highPercent + (settings.noiseEnabled ? noiseAmplitudePercent * 1.25 : 0))

  for (let y = 0; y < outputHeight; y += 1) {
    const sampleY = ((y + 0.5) / outputHeight) * sketchHeight - 0.5
    for (let x = 0; x < outputWidth; x += 1) {
      const sampleX = ((x + 0.5) / outputWidth) * sketchWidth - 0.5
      const terrainClass = sampleNearest(sketch, sketchWidth, sketchHeight, sampleX, sampleY)
      const index = y * outputWidth + x

      if (terrainClass === TerrainClass.Water) {
        heights[index] = 0
        minHeight = Math.min(minHeight, 0)
        maxHeight = Math.max(maxHeight, 0)
        continue
      }

      const base = sampleBilinear(baseHeight, sketchWidth, sketchHeight, sampleX, sampleY)
      const noiseValue = settings.noiseEnabled
        ? sampleBilinear(noise, sketchWidth, sketchHeight, sampleX, sampleY) * noiseAmplitudePercent
        : 0
      const heightValue = clamp(base + noiseValue, 1, topTarget)
      const scaled = Math.round((heightValue / 100) * FULL_HEIGHT_RANGE)
      heights[index] = scaled
      minHeight = Math.min(minHeight, scaled)
      maxHeight = Math.max(maxHeight, scaled)
    }
  }

  const profile = buildExportProfile(outputWidth, outputHeight, FULL_HEIGHT_RANGE)

  return {
    width: outputWidth,
    height: outputHeight,
    heights,
    rgba: heightsToRgba(heights, outputWidth, outputHeight, FULL_HEIGHT_RANGE),
    minHeight: Number.isFinite(minHeight) ? minHeight : 0,
    maxHeight: Number.isFinite(maxHeight) ? maxHeight : 0,
    rangeMin: profile.rangeMin,
    rangeMax: profile.rangeMax,
  }
}

export function heightsToRgba(
  heights: Uint16Array,
  width: number,
  height: number,
  rangeMax: number,
): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(width * height * 4)
  for (let index = 0; index < heights.length; index += 1) {
    const luminance = Math.round((heights[index] / Math.max(1, rangeMax)) * 255)
    const pixelOffset = index * 4
    rgba[pixelOffset] = luminance
    rgba[pixelOffset + 1] = luminance
    rgba[pixelOffset + 2] = luminance
    rgba[pixelOffset + 3] = 255
  }
  return rgba
}

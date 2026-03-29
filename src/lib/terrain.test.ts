import { describe, expect, it } from 'vitest'

import { DEFAULT_TERRAIN_SETTINGS } from './defaults'
import { encodeGrayscale16Png } from './png16'
import { createInitialSketch, generateTerrain } from './terrain'
import { SKETCH_WIDTH, SKETCH_HEIGHT, TerrainClass } from './types'

describe('terrain generation', () => {
  it('keeps water at 0m and land at or above 5m', () => {
    const sketch = createInitialSketch(SKETCH_WIDTH, SKETCH_HEIGHT)
    for (let y = 80; y < 176; y += 1) {
      for (let x = 40; x < 120; x += 1) {
        sketch[y * SKETCH_WIDTH + x] = TerrainClass.Water
      }
    }

    const generated = generateTerrain({
      sketch,
      sketchWidth: SKETCH_WIDTH,
      sketchHeight: SKETCH_HEIGHT,
      outputWidth: 320,
      outputHeight: 240,
      settings: DEFAULT_TERRAIN_SETTINGS,
    })

    expect(generated.minHeight).toBe(0)
    const nonWater = Array.from(generated.heights).filter((height) => height > 0)
    expect(Math.min(...nonWater)).toBeGreaterThanOrEqual(5)
  })

  it('creates a valid 16-bit grayscale PNG header', () => {
    const sketch = createInitialSketch(SKETCH_WIDTH, SKETCH_HEIGHT)
    sketch.fill(TerrainClass.High)
    const generated = generateTerrain({
      sketch,
      sketchWidth: SKETCH_WIDTH,
      sketchHeight: SKETCH_HEIGHT,
      outputWidth: 64,
      outputHeight: 64,
      settings: DEFAULT_TERRAIN_SETTINGS,
    })
    const png = encodeGrayscale16Png(generated.heights, 64, 64, generated.rangeMax)

    expect(Array.from(png.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    expect(png[16]).toBe(0)
    expect(png[17]).toBe(0)
    expect(png[18]).toBe(0)
    expect(png[19]).toBe(64)
    expect(png[24]).toBe(16)
    expect(png[25]).toBe(0)
  })
})



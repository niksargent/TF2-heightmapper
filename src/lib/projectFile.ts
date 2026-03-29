import type { ProjectFileV1, TerrainSettings } from './types'
import { SKETCH_HEIGHT, SKETCH_WIDTH } from './types'

function encodeUint8ToBase64(data: Uint8Array): string {
  let binary = ''
  for (let index = 0; index < data.length; index += 1) {
    binary += String.fromCharCode(data[index])
  }
  return btoa(binary)
}

function decodeBase64ToUint8(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

export function serializeProject(presetId: string, sketch: Uint8Array, settings: TerrainSettings): string {
  const payload: ProjectFileV1 = {
    version: 1,
    createdAt: new Date().toISOString(),
    presetId,
    sketchWidth: SKETCH_WIDTH,
    sketchHeight: SKETCH_HEIGHT,
    sketch: encodeUint8ToBase64(sketch),
    settings,
  }
  return JSON.stringify(payload, null, 2)
}

export function parseProjectFile(raw: string): ProjectFileV1 {
  const parsed = JSON.parse(raw) as Partial<ProjectFileV1>

  if (
    parsed.version !== 1 ||
    typeof parsed.presetId !== 'string' ||
    typeof parsed.sketch !== 'string' ||
    parsed.sketchWidth !== SKETCH_WIDTH ||
    parsed.sketchHeight !== SKETCH_HEIGHT ||
    typeof parsed.createdAt !== 'string' ||
    !parsed.settings
  ) {
    throw new Error('Invalid TF2 Heightmapper project file.')
  }

  return parsed as ProjectFileV1
}

export function inflateProjectSketch(project: ProjectFileV1): Uint8Array {
  const sketch = decodeBase64ToUint8(project.sketch)
  if (sketch.length !== project.sketchWidth * project.sketchHeight) {
    throw new Error('Project sketch data does not match the saved dimensions.')
  }
  return sketch
}

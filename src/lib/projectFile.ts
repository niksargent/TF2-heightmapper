import { DEFAULT_TERRAIN_SETTINGS } from './defaults'
import type { ProjectFile, ProjectFileV1, ProjectFileV2, TerrainSettings } from './types'
import { SKETCH_HEIGHT, SKETCH_WIDTH } from './types'

type LegacySettings = ProjectFileV1['settings']

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
  const payload: ProjectFileV2 = {
    version: 2,
    createdAt: new Date().toISOString(),
    presetId,
    sketchWidth: SKETCH_WIDTH,
    sketchHeight: SKETCH_HEIGHT,
    sketch: encodeUint8ToBase64(sketch),
    settings,
  }
  return JSON.stringify(payload, null, 2)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function migrateSettings(settings: LegacySettings | TerrainSettings): TerrainSettings {
  const legacySettings = settings as LegacySettings
  const importMaxElevation = asNumber(legacySettings.importMaxElevation) ?? 400
  const lowPercent = asNumber((settings as TerrainSettings).lowPercent)
  const mediumPercent = asNumber((settings as TerrainSettings).mediumPercent)
  const highPercent = asNumber((settings as TerrainSettings).highPercent)

  const migratedLowPercent = lowPercent ?? clamp(((asNumber(legacySettings.lowElevation) ?? 20) / Math.max(1, importMaxElevation)) * 100, 1, 40)
  const migratedMediumPercent = mediumPercent ?? clamp(((asNumber(legacySettings.mediumElevation) ?? 80) / Math.max(1, importMaxElevation)) * 100, 5, 80)
  const migratedHighPercent = highPercent ?? clamp(((asNumber(legacySettings.highElevation) ?? 200) / Math.max(1, importMaxElevation)) * 100, 10, 100)

  return {
    lowPercent: migratedLowPercent,
    mediumPercent: Math.max(migratedLowPercent + 1, migratedMediumPercent),
    highPercent: Math.max(migratedMediumPercent + 1, migratedHighPercent),
    smoothing: asNumber(settings.smoothing) ?? DEFAULT_TERRAIN_SETTINGS.smoothing,
    noiseEnabled: typeof settings.noiseEnabled === 'boolean' ? settings.noiseEnabled : DEFAULT_TERRAIN_SETTINGS.noiseEnabled,
    noiseAmplitude: clamp(
      lowPercent !== null || mediumPercent !== null || highPercent !== null
        ? asNumber(settings.noiseAmplitude) ?? DEFAULT_TERRAIN_SETTINGS.noiseAmplitude
        : (((asNumber(settings.noiseAmplitude) ?? 14) / Math.max(1, importMaxElevation)) * 100),
      0,
      20,
    ),
    noiseScale: asNumber(settings.noiseScale) ?? DEFAULT_TERRAIN_SETTINGS.noiseScale,
    noiseOctaves: clamp(asNumber(settings.noiseOctaves) ?? DEFAULT_TERRAIN_SETTINGS.noiseOctaves, 1, 5),
    noiseSeed: asNumber(settings.noiseSeed) ?? DEFAULT_TERRAIN_SETTINGS.noiseSeed,
    minecraftMode: typeof (settings as TerrainSettings).minecraftMode === 'boolean'
      ? (settings as TerrainSettings).minecraftMode
      : DEFAULT_TERRAIN_SETTINGS.minecraftMode,
    terraceStepPercent: clamp(
      asNumber((settings as TerrainSettings).terraceStepPercent) ?? DEFAULT_TERRAIN_SETTINGS.terraceStepPercent,
      1,
      20,
    ),
  }
}

export function parseProjectFile(raw: string): ProjectFileV2 {
  const parsed = JSON.parse(raw) as Partial<ProjectFile>

  if (
    (parsed.version !== 1 && parsed.version !== 2) ||
    typeof parsed.presetId !== 'string' ||
    typeof parsed.sketch !== 'string' ||
    parsed.sketchWidth !== SKETCH_WIDTH ||
    parsed.sketchHeight !== SKETCH_HEIGHT ||
    typeof parsed.createdAt !== 'string' ||
    !parsed.settings
  ) {
    throw new Error('Invalid TF2 Heightmapper project file.')
  }

  const normalized: ProjectFileV2 = {
    version: 2,
    createdAt: parsed.createdAt,
    presetId: parsed.presetId,
    sketchWidth: parsed.sketchWidth,
    sketchHeight: parsed.sketchHeight,
    sketch: parsed.sketch,
    settings: migrateSettings(parsed.settings),
  }
  return normalized
}

export function inflateProjectSketch(project: ProjectFile): Uint8Array {
  const sketch = decodeBase64ToUint8(project.sketch)
  if (sketch.length !== project.sketchWidth * project.sketchHeight) {
    throw new Error('Project sketch data does not match the saved dimensions.')
  }
  return sketch
}

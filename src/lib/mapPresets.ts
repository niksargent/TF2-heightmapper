import type { MapPreset } from './types'

type PresetSeed = Omit<MapPreset, 'id' | 'label'>

const PRESET_SEEDS: PresetSeed[] = [
  { family: 'tiny', ratioLabel: '1:1', width: 1025, height: 1025, approxKm: [4, 4], experimental: true },
  { family: 'tiny', ratioLabel: '1:2', width: 641, height: 1281, approxKm: [2.5, 5], experimental: true },
  { family: 'tiny', ratioLabel: '1:3', width: 513, height: 1537, approxKm: [2, 6], experimental: true },
  { family: 'tiny', ratioLabel: '1:4', width: 513, height: 2049, approxKm: [2, 8], experimental: true },
  { family: 'tiny', ratioLabel: '1:5', width: 385, height: 1921, approxKm: [1.5, 7.5], experimental: true },
  { family: 'small', ratioLabel: '1:1', width: 2049, height: 2049, approxKm: [8, 8], experimental: false },
  { family: 'small', ratioLabel: '1:2', width: 1409, height: 2817, approxKm: [5.5, 11], experimental: false },
  { family: 'small', ratioLabel: '1:3', width: 1153, height: 3457, approxKm: [4.5, 13.5], experimental: false },
  { family: 'small', ratioLabel: '1:4', width: 1025, height: 4097, approxKm: [4, 16], experimental: false },
  { family: 'small', ratioLabel: '1:5', width: 897, height: 4481, approxKm: [3.5, 17.5], experimental: false },
  { family: 'medium', ratioLabel: '1:1', width: 3073, height: 3073, approxKm: [12, 12], experimental: false },
  { family: 'medium', ratioLabel: '1:2', width: 2049, height: 4097, approxKm: [8, 16], experimental: false },
  { family: 'medium', ratioLabel: '1:3', width: 1665, height: 4993, approxKm: [6.5, 19.5], experimental: false },
  { family: 'medium', ratioLabel: '1:4', width: 1537, height: 6145, approxKm: [6, 24], experimental: false },
  { family: 'medium', ratioLabel: '1:5', width: 1281, height: 6401, approxKm: [5, 25], experimental: false },
  { family: 'large', ratioLabel: '1:1', width: 3585, height: 3585, approxKm: [14, 14], experimental: false },
  { family: 'large', ratioLabel: '1:2', width: 2561, height: 5121, approxKm: [10, 20], experimental: false },
  { family: 'large', ratioLabel: '1:3', width: 2049, height: 6145, approxKm: [8, 24], experimental: false },
  { family: 'large', ratioLabel: '1:4', width: 1793, height: 7169, approxKm: [7, 28], experimental: false },
  { family: 'large', ratioLabel: '1:5', width: 1537, height: 8065, approxKm: [6, 31.5], experimental: false },
  { family: 'very-large', ratioLabel: '1:1', width: 4097, height: 4097, approxKm: [16, 16], experimental: false },
  { family: 'very-large', ratioLabel: '1:2', width: 2817, height: 5633, approxKm: [11, 22], experimental: false },
  { family: 'very-large', ratioLabel: '1:3', width: 2305, height: 6913, approxKm: [9, 27], experimental: false },
  { family: 'very-large', ratioLabel: '1:4', width: 2049, height: 8193, approxKm: [8, 32], experimental: false },
  { family: 'very-large', ratioLabel: '1:5', width: 1793, height: 8961, approxKm: [7, 35], experimental: false },
  { family: 'huge', ratioLabel: '1:1', width: 5121, height: 5121, approxKm: [20, 20], experimental: true },
  { family: 'huge', ratioLabel: '1:2', width: 3585, height: 7169, approxKm: [14, 28], experimental: true },
  { family: 'huge', ratioLabel: '1:3', width: 2945, height: 8833, approxKm: [11.5, 34.5], experimental: true },
  { family: 'huge', ratioLabel: '1:4', width: 2561, height: 10241, approxKm: [10, 40], experimental: true },
  { family: 'huge', ratioLabel: '1:5', width: 2177, height: 10881, approxKm: [8.5, 42.5], experimental: true },
  { family: 'megalomaniac', ratioLabel: '1:1', width: 6145, height: 6145, approxKm: [24, 24], experimental: true },
  { family: 'megalomaniac', ratioLabel: '1:2', width: 4225, height: 8449, approxKm: [16.5, 33], experimental: true },
  { family: 'megalomaniac', ratioLabel: '1:3', width: 3457, height: 10369, approxKm: [13.5, 40.5], experimental: true },
  { family: 'megalomaniac', ratioLabel: '1:4', width: 3073, height: 12289, approxKm: [12, 48], experimental: true },
  { family: 'megalomaniac', ratioLabel: '1:5', width: 2689, height: 13441, approxKm: [10.5, 52.5], experimental: true },
]

const FAMILY_LABELS: Record<MapPreset['family'], string> = {
  tiny: 'Tiny',
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  'very-large': 'Very Large',
  huge: 'Huge',
  megalomaniac: 'Megalomaniac',
}

export const MAP_PRESETS: MapPreset[] = PRESET_SEEDS.map((preset) => ({
  ...preset,
  id: `${preset.family}-${preset.ratioLabel.replace(':', 'x')}`,
  label: `${FAMILY_LABELS[preset.family]} ${preset.ratioLabel}`,
}))

export const DEFAULT_PRESET_ID = 'medium-1x1'

export function getPresetById(presetId: string): MapPreset {
  return MAP_PRESETS.find((preset) => preset.id === presetId) ?? MAP_PRESETS[0]
}

export function describePreset(preset: MapPreset): string {
  return `${preset.width} × ${preset.height} px`
}

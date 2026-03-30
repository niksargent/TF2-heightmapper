import { TerrainClass, type TerrainClassId, type TerrainSettings, type TerrainVisual } from './types'

export const DEFAULT_TERRAIN_SETTINGS: TerrainSettings = {
  lowPercent: 5,
  mediumPercent: 20,
  highPercent: 50,
  importMaxElevation: 400,
  smoothing: 42,
  noiseEnabled: true,
  noiseAmplitude: 14,
  noiseScale: 18,
  noiseOctaves: 3,
  noiseSeed: 3712,
  debugEdges: false,
}

export const TERRAIN_VISUALS: Record<TerrainClassId, TerrainVisual> = {
  [TerrainClass.Water]: {
    label: 'Water',
    swatch: '#2f7ca8',
    sketchRgb: [47, 124, 168],
  },
  [TerrainClass.Low]: {
    label: 'Low',
    swatch: '#9ab06e',
    sketchRgb: [154, 176, 110],
  },
  [TerrainClass.Medium]: {
    label: 'Medium',
    swatch: '#c38f5a',
    sketchRgb: [195, 143, 90],
  },
  [TerrainClass.High]: {
    label: 'High',
    swatch: '#ddd7c8',
    sketchRgb: [221, 215, 200],
  },
}

export const TERRAIN_CLASS_ORDER: TerrainClassId[] = [
  TerrainClass.Water,
  TerrainClass.Low,
  TerrainClass.Medium,
  TerrainClass.High,
]

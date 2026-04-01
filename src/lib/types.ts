export const SKETCH_WIDTH = 256
export const SKETCH_HEIGHT = 256

export const TerrainClass = {
  Water: 0,
  Low: 1,
  Medium: 2,
  High: 3,
} as const

export type TerrainClassId = (typeof TerrainClass)[keyof typeof TerrainClass]

export type MapPreset = {
  id: string
  family: 'tiny' | 'small' | 'medium' | 'large' | 'very-large' | 'huge' | 'megalomaniac'
  label: string
  ratioLabel: '1:1' | '1:2' | '1:3' | '1:4' | '1:5'
  width: number
  height: number
  approxKm: [number, number]
  experimental: boolean
}

export type TerrainSettings = {
  lowPercent: number
  mediumPercent: number
  highPercent: number
  smoothing: number
  noiseEnabled: boolean
  noiseAmplitude: number
  noiseScale: number
  noiseOctaves: number
  noiseSeed: number
  minecraftMode: boolean
  terraceStepPercent: number
}

export type PreviewTerrain = {
  width: number
  height: number
  heights: Uint16Array
  rgba: Uint8ClampedArray
  minHeight: number
  maxHeight: number
  rangeMin: number
  rangeMax: number
}

export type ExportProfile = {
  width: number
  height: number
  bitDepth: 16
  rangeMin: number
  rangeMax: number
  waterLevel: number
}

export type ProjectFileV1 = {
  version: 1
  createdAt: string
  presetId: string
  sketchWidth: number
  sketchHeight: number
  sketch: string
  settings: {
    lowElevation?: number
    mediumElevation?: number
    highElevation?: number
    lowPercent?: number
    mediumPercent?: number
    highPercent?: number
    importMaxElevation?: number
    smoothing?: number
    noiseEnabled?: boolean
    noiseAmplitude?: number
    noiseScale?: number
    noiseOctaves?: number
    noiseSeed?: number
    minecraftMode?: boolean
    terraceStepPercent?: number
  }
}

export type ProjectFileV2 = {
  version: 2
  createdAt: string
  presetId: string
  sketchWidth: number
  sketchHeight: number
  sketch: string
  settings: TerrainSettings
}

export type ProjectFile = ProjectFileV1 | ProjectFileV2

export type GenerateTerrainInput = {
  sketch: Uint8Array
  sketchWidth: number
  sketchHeight: number
  outputWidth: number
  outputHeight: number
  settings: TerrainSettings
}

export type WorkerPreviewRequest = {
  type: 'preview'
  requestId: number
  input: GenerateTerrainInput
}

export type WorkerExportRequest = {
  type: 'export'
  requestId: number
  input: GenerateTerrainInput
}

export type WorkerRequest = WorkerPreviewRequest | WorkerExportRequest

export type WorkerPreviewResponse = {
  type: 'preview'
  requestId: number
  preview: PreviewTerrain
}

export type WorkerExportResponse = {
  type: 'export'
  requestId: number
  png: ArrayBuffer
  profile: ExportProfile
}

export type WorkerErrorResponse = {
  type: 'error'
  requestId: number
  message: string
}

export type WorkerResponse = WorkerPreviewResponse | WorkerExportResponse | WorkerErrorResponse

export type TerrainVisual = {
  label: string
  swatch: string
  sketchRgb: [number, number, number]
}


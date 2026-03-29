/// <reference lib="webworker" />

import { encodeGrayscale16Png } from '../lib/png16'
import { buildExportProfile, generateTerrain } from '../lib/terrain'
import type { WorkerRequest, WorkerResponse } from '../lib/types'

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data

  try {
    const generated = generateTerrain(request.input)

    if (request.type === 'preview') {
      const response: WorkerResponse = {
        type: 'preview',
        requestId: request.requestId,
        preview: generated,
      }
      self.postMessage(response)
      return
    }

    const profile = buildExportProfile(
      request.input.outputWidth,
      request.input.outputHeight,
      generated.maxHeight,
    )
    const png = encodeGrayscale16Png(
      generated.heights,
      request.input.outputWidth,
      request.input.outputHeight,
      profile.rangeMax,
    )
    const response: WorkerResponse = {
      type: 'export',
      requestId: request.requestId,
      png: png.buffer as ArrayBuffer,
      profile,
    }
    self.postMessage(response, [png.buffer as ArrayBuffer])
  } catch (error) {
    const response: WorkerResponse = {
      type: 'error',
      requestId: request.requestId,
      message: error instanceof Error ? error.message : 'Unknown worker error.',
    }
    self.postMessage(response)
  }
}


import type { WorkerRequest, WorkerResponse } from './types'

type PendingRequest = {
  resolve: (value: WorkerResponse) => void
  reject: (error: Error) => void
}

export function createWorkerClient() {
  const worker = new Worker(new URL('../workers/terrainWorker.ts', import.meta.url), {
    type: 'module',
  })
  const pending = new Map<number, PendingRequest>()

  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const response = event.data
    const activeRequest = pending.get(response.requestId)
    if (!activeRequest) {
      return
    }
    pending.delete(response.requestId)
    if (response.type === 'error') {
      activeRequest.reject(new Error(response.message))
      return
    }
    activeRequest.resolve(response)
  }

  worker.onerror = (event) => {
    pending.forEach((request) => request.reject(new Error(event.message)))
    pending.clear()
  }

  return {
    request<T extends WorkerResponse>(message: WorkerRequest) {
      return new Promise<T>((resolve, reject) => {
        pending.set(message.requestId, {
          resolve: (value) => resolve(value as T),
          reject,
        })
        worker.postMessage(message)
      })
    },
    terminate() {
      worker.terminate()
      pending.clear()
    },
  }
}

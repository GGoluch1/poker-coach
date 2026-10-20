import type { JobType, WorkerApi } from './handlers'
import { runJob } from './handlers'

export interface JobMessage {
  id: number
  type: JobType
  req: WorkerApi[JobType]['req']
}

export type ResultMessage = { id: number; result: unknown } | { id: number; error: string }

const scope = self as unknown as {
  onmessage: (e: MessageEvent<JobMessage>) => void
  postMessage: (msg: ResultMessage) => void
}

scope.onmessage = (e) => {
  const { id, type, req } = e.data
  try {
    scope.postMessage({ id, result: runJob(type, req) })
  } catch (err) {
    scope.postMessage({ id, error: err instanceof Error ? err.message : String(err) })
  }
}

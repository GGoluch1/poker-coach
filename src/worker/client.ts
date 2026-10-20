import type { JobMessage, ResultMessage } from './analysis.worker'
import type { HandReviewResult, JobType, WorkerApi } from './handlers'
import { runJob } from './handlers'

let worker: Worker | null | undefined
let nextId = 1
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()

function getWorker(): Worker | null {
  if (worker !== undefined) return worker
  try {
    worker = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<ResultMessage>) => {
      const job = pending.get(e.data.id)
      if (!job) return
      pending.delete(e.data.id)
      if ('error' in e.data) job.reject(new Error(e.data.error))
      else job.resolve(e.data.result)
    }
    worker.onerror = () => {
      // The worker failed to load; fail pending jobs and run future ones inline.
      for (const job of pending.values()) job.reject(new Error('analysis worker crashed'))
      pending.clear()
      worker?.terminate()
      worker = null
    }
  } catch {
    worker = null
  }
  return worker
}

/** Runs a job off the main thread, or inline where workers aren't available. */
export function runInWorker<K extends JobType>(
  type: K,
  req: WorkerApi[K]['req'],
): Promise<WorkerApi[K]['res']> {
  const w = getWorker()
  if (!w) return Promise.resolve().then(() => runJob(type, req))
  const id = nextId++
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
    const message: JobMessage = { id, type, req }
    w.postMessage(message)
  })
}

export const randomSeed = () => Math.floor(Math.random() * 2 ** 32)

const reviewCache = new Map<string, Promise<HandReviewResult>>()

/** Reviews a finished hand once; later calls for the same hand share the result. */
export function reviewHand(req: WorkerApi['reviewHand']['req']): Promise<HandReviewResult> {
  let job = reviewCache.get(req.id)
  if (!job) {
    job = runInWorker('reviewHand', req)
    reviewCache.set(req.id, job)
    job.catch(() => reviewCache.delete(req.id))
  }
  return job
}

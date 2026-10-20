import { useEffect, useState } from 'react'

/**
 * Runs `load` whenever `key` changes and returns its result, or undefined while
 * the result for the current key is pending. Stale results are discarded.
 */
export function useAsync<T>(load: (() => Promise<T>) | null, key: unknown): T | undefined {
  const [state, setState] = useState<{ key: unknown; value: T } | null>(null)
  useEffect(() => {
    if (!load) return
    let live = true
    load().then(
      (value) => live && setState({ key, value }),
      (err) => console.error(err),
    )
    return () => {
      live = false
    }
    // `load` is recreated each render; `key` decides when to rerun.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return state && state.key === key ? state.value : undefined
}

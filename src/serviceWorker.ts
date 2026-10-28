/**
 * Registers public/sw.js so the app works offline after the first visit. The page loads before the
 * worker exists, so once it's ready it's told which files the page already fetched, to cache them
 * too.
 */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('/sw.js')
      const ready = await navigator.serviceWorker.ready
      const urls = performance
        .getEntriesByType('resource')
        .map((e) => e.name)
        .filter((url) => new URL(url).origin === location.origin)
      ready.active?.postMessage({ type: 'cache', urls })
    } catch {
      // Offline support is a bonus; the app works without it.
    }
  })
}

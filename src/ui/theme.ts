import { useSyncExternalStore } from 'react'

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'poker-coach:theme'
const THEME_COLORS: Record<Theme, string> = { dark: '#0c0e12', light: '#f6f6f3' }
const listeners = new Set<() => void>()

/** index.html applies the saved theme before the first paint; this reads it back. */
function current(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

export function setTheme(theme: Theme) {
  const root = document.documentElement
  // Swap colors instantly; otherwise every button fades between themes on its own timer.
  root.classList.add('theme-switching')
  root.dataset.theme = theme
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-switching')))
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme])
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // The theme still applies for this visit.
  }
  for (const l of listeners) l()
}

export function useTheme(): Theme {
  return useSyncExternalStore((l) => {
    listeners.add(l)
    return () => listeners.delete(l)
  }, current)
}

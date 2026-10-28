import { useMemo, useSyncExternalStore } from 'react'
import type { DrillMode } from './siteMap'
import { drillInfo, isDrillMode } from './siteMap'

/**
 * Pages live in the URL path (/drills/outs). The host serves index.html for every path
 * (vercel.json, and Vite's dev server), and same-origin link clicks change the page without a
 * reload.
 */
export type Route =
  | { page: 'home' }
  | { page: 'play' }
  | { page: 'drills'; drill: DrillMode | null }
  | { page: 'hands' }
  | { page: 'charts' }
  | { page: 'solver' }
  | { page: 'progress' }
  | { page: 'notFound' }

export interface Crumb {
  label: string
  /** Omitted for groups with no page of their own. */
  href?: string
}

export const HOME_CRUMB: Crumb = { label: 'Home', href: '/' }

/** Top-level menu sections. */
export type Section = 'play' | 'drills' | 'study' | 'progress'

const SINGLE = ['play', 'hands', 'charts', 'solver', 'progress'] as const

export function parseRoute(path: string): Route {
  const parts = path.split('/').filter(Boolean)
  if (parts.length === 0) return { page: 'home' }
  const [first, second] = parts
  if (first === 'drills' && parts.length <= 2) {
    if (second === undefined) return { page: 'drills', drill: null }
    if (isDrillMode(second)) return { page: 'drills', drill: second }
  }
  if (parts.length === 1) {
    const page = SINGLE.find((p) => p === first)
    if (page) return { page }
  }
  return { page: 'notFound' }
}

export function href(route: Route): string {
  switch (route.page) {
    case 'home':
    case 'notFound':
      return '/'
    case 'drills':
      return route.drill ? `/drills/${route.drill}` : '/drills'
    default:
      return `/${route.page}`
  }
}

export function sameRoute(a: Route, b: Route): boolean {
  return href(a) === href(b) && a.page === b.page
}

export function sectionOf(route: Route): Section | null {
  switch (route.page) {
    case 'play':
    case 'drills':
    case 'progress':
      return route.page
    case 'hands':
    case 'charts':
    case 'solver':
      return 'study'
    default:
      return null
  }
}

const TITLES: Record<Exclude<Route['page'], 'drills'>, string> = {
  home: 'Poker Coach: learn no-limit hold’em',
  play: 'Play',
  hands: 'Hand histories',
  charts: 'Preflop charts',
  solver: 'River solver',
  progress: 'Progress',
  notFound: 'Page not found',
}

export function documentTitle(route: Route): string {
  if (route.page === 'home') return TITLES.home
  const name =
    route.page === 'drills'
      ? route.drill
        ? `${drillInfo(route.drill).title} drill`
        : 'Drills'
      : TITLES[route.page]
  return `${name} · Poker Coach`
}

const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

export function navigate(path: string) {
  if (path !== window.location.pathname) {
    history.pushState(null, '', path)
    notify()
  }
  window.scrollTo(0, 0)
}

/** Call once at startup: follows links in place and handles the back button. */
export function startRouter() {
  // Links from before paths were used look like /#/drills/outs.
  if (window.location.hash.startsWith('#/')) {
    history.replaceState(null, '', window.location.hash.slice(1))
  }
  window.addEventListener('popstate', notify)
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return
    }
    const a = (e.target as Element).closest?.('a')
    if (!a || a.target || a.hasAttribute('download')) return
    const url = new URL(a.href, window.location.href)
    if (url.origin !== window.location.origin) return
    // Let in-page anchors like #main jump as usual.
    if (url.pathname === window.location.pathname && url.hash) return
    e.preventDefault()
    navigate(url.pathname)
  })
}

export function useRoute(): Route {
  const path = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => window.location.pathname,
  )
  return useMemo(() => parseRoute(path), [path])
}

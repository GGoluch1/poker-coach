import { useMemo, useSyncExternalStore } from 'react'
import type { DrillMode } from './siteMap'
import { drillInfo, isDrillMode } from './siteMap'

/**
 * Pages live in the URL hash (#/drills/outs), so links, the back button and bookmarks work on any
 * static host without server rewrites.
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

export const HOME_CRUMB: Crumb = { label: 'Home', href: '#/' }

/** Top-level menu sections. */
export type Section = 'play' | 'drills' | 'study' | 'progress'

const SINGLE = ['play', 'hands', 'charts', 'solver', 'progress'] as const

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
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
      return '#/'
    case 'drills':
      return route.drill ? `#/drills/${route.drill}` : '#/drills'
    default:
      return `#/${route.page}`
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

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  return useMemo(() => parseRoute(hash), [hash])
}

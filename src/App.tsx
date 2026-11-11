import type { ComponentType } from 'react'
import { Suspense, lazy, useEffect, useRef } from 'react'
import { dueCards } from './engine/srs'
import { HomePage } from './ui/HomePage'
import { NotFoundPage } from './ui/NotFoundPage'
import { useProgress } from './ui/progress'
import type { Route } from './ui/routes'
import { documentTitle, useRoute } from './ui/routes'
import { SiteFooter } from './ui/SiteFooter'
import { SiteHeader } from './ui/SiteHeader'
import { useNow } from './ui/useNow'
import './App.css'

/** A page loaded on first use, with `preload` to fetch it ahead of time. */
function lazyPage<P extends object>(load: () => Promise<ComponentType<P>>) {
  let pending: Promise<{ default: ComponentType<P> }> | undefined
  const preload = () => (pending ??= load().then((c) => ({ default: c })))
  return Object.assign(lazy(preload), { preload })
}

// Home is where most visits start, so it ships with the app; the rest load on demand.
const PlayPage = lazyPage(() => import('./ui/PlayPage').then((m) => m.PlayPage))
const DrillsPage = lazyPage(() => import('./ui/DrillsPage').then((m) => m.DrillsPage))
const HandsPage = lazyPage(() => import('./ui/HandsPage').then((m) => m.HandsPage))
const ChartsPage = lazyPage(() => import('./ui/ChartsPage').then((m) => m.ChartsPage))
const SolverPage = lazyPage(() => import('./ui/SolverPage').then((m) => m.SolverPage))
const ProgressPage = lazyPage(() => import('./ui/ProgressPage').then((m) => m.ProgressPage))
const LAZY_PAGES = [PlayPage, DrillsPage, HandsPage, ChartsPage, SolverPage, ProgressPage]

/**
 * Fetches every page once the browser is idle, so later navigation is instant and the service
 * worker caches them all for offline use.
 */
function usePrefetchPages() {
  useEffect(() => {
    const prefetch = () => LAZY_PAGES.forEach((p) => p.preload().catch(() => {}))
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(prefetch, { timeout: 3000 })
      return () => cancelIdleCallback(id)
    }
    const id = setTimeout(prefetch, 1500)
    return () => clearTimeout(id)
  }, [])
}

/**
 * Rendered after the page inside the same Suspense boundary, so its effect runs once the page
 * (and its heading) is on screen. After moving to another page, focuses that heading so screen
 * readers announce it; the first page of the visit keeps the browser's default focus.
 */
function FocusHeading({ route }: { route: Route }) {
  const lastPath = useRef<string | null>(null)
  useEffect(() => {
    const path = window.location.pathname
    if (lastPath.current !== null && lastPath.current !== path) {
      document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true })
    }
    lastPath.current = path
  }, [route])
  return null
}

export default function App() {
  const route = useRoute()
  const progress = useProgress()
  const due = dueCards(progress.deck, useNow()).length
  usePrefetchPages()

  useEffect(() => {
    document.title = documentTitle(route)
  }, [route])

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader route={route} due={due} />

      <main id="main" className={`main main-${route.page}`} tabIndex={-1}>
        <Suspense fallback={<p className="page-loading muted">Loading…</p>}>
          {route.page === 'home' && <HomePage />}
          {route.page === 'play' && <PlayPage />}
          {route.page === 'drills' && <DrillsPage key={route.drill ?? 'all'} mode={route.drill} />}
          {route.page === 'hands' && <HandsPage />}
          {route.page === 'charts' && <ChartsPage />}
          {route.page === 'solver' && <SolverPage />}
          {route.page === 'progress' && <ProgressPage />}
          {route.page === 'notFound' && <NotFoundPage />}
          <FocusHeading route={route} />
        </Suspense>
      </main>

      <SiteFooter />
    </div>
  )
}

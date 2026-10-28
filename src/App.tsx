import { useEffect } from 'react'
import { dueCards } from './engine/srs'
import { ChartsPage } from './ui/ChartsPage'
import { DrillsPage } from './ui/DrillsPage'
import { HandsPage } from './ui/HandsPage'
import { HomePage } from './ui/HomePage'
import { NotFoundPage } from './ui/NotFoundPage'
import { PlayPage } from './ui/PlayPage'
import { ProgressPage } from './ui/ProgressPage'
import { useProgress } from './ui/progress'
import { documentTitle, useRoute } from './ui/routes'
import { SiteFooter } from './ui/SiteFooter'
import { SiteHeader } from './ui/SiteHeader'
import { SolverPage } from './ui/SolverPage'
import { useNow } from './ui/useNow'
import './App.css'

export default function App() {
  const route = useRoute()
  const progress = useProgress()
  const due = dueCards(progress.deck, useNow()).length

  // A new page starts at the top, like any website.
  useEffect(() => {
    document.title = documentTitle(route)
    window.scrollTo(0, 0)
  }, [route])

  return (
    <div className="app">
      {/* A button, not a #main link: the hash holds the route. */}
      <button className="skip-link" onClick={() => document.getElementById('main')?.focus()}>
        Skip to content
      </button>
      <SiteHeader route={route} due={due} />

      <main id="main" className={`main main-${route.page}`} tabIndex={-1}>
        {route.page === 'home' && <HomePage />}
        {route.page === 'play' && <PlayPage />}
        {route.page === 'drills' && <DrillsPage key={route.drill ?? 'all'} mode={route.drill} />}
        {route.page === 'hands' && <HandsPage />}
        {route.page === 'charts' && <ChartsPage />}
        {route.page === 'solver' && <SolverPage />}
        {route.page === 'progress' && <ProgressPage />}
        {route.page === 'notFound' && <NotFoundPage />}
      </main>

      <SiteFooter />
    </div>
  )
}

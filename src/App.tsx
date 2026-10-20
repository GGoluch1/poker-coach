import { useState } from 'react'
import { dueCards } from './engine/srs'
import { DrillsPage } from './ui/DrillsPage'
import type { DrillMode } from './ui/DrillsPage'
import { HandsPage } from './ui/HandsPage'
import { PlayPage } from './ui/PlayPage'
import { ProgressPage } from './ui/ProgressPage'
import { useProgress } from './ui/progress'
import { SolverPage } from './ui/SolverPage'
import { useNow } from './ui/useNow'
import './App.css'

type Page = 'play' | 'drills' | 'hands' | 'solver' | 'progress'
const PAGES: { id: Page; label: string }[] = [
  { id: 'play', label: 'Play' },
  { id: 'drills', label: 'Drills' },
  { id: 'hands', label: 'Hands' },
  { id: 'solver', label: 'Solver' },
  { id: 'progress', label: 'Progress' },
]
const PAGE_KEY = 'poker-coach:page'

function savedPage(): Page {
  try {
    const p = localStorage.getItem(PAGE_KEY)
    if (PAGES.some((x) => x.id === p)) return p as Page
  } catch {
    // Fall through to the default page.
  }
  return 'play'
}

export default function App() {
  const [page, setPage] = useState<Page>(savedPage)
  const [drillMode, setDrillMode] = useState<DrillMode | null>(null)
  const progress = useProgress()
  const due = dueCards(progress.deck, useNow()).length

  const go = (next: Page, mode: DrillMode | null = null) => {
    setPage(next)
    setDrillMode(mode)
    try {
      localStorage.setItem(PAGE_KEY, next)
    } catch {
      // Not remembering the page is fine.
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>
          <span className="logo" aria-hidden>
            ♠
          </span>{' '}
          Poker Coach
        </h1>
        <nav className="nav" aria-label="Sections">
          {PAGES.map((p) => (
            <button
              key={p.id}
              className={`nav-item${page === p.id ? ' nav-on' : ''}`}
              aria-current={page === p.id ? 'page' : undefined}
              onClick={() => go(p.id)}
            >
              {p.label}
              {p.id === 'drills' && due > 0 && (
                <span className="badge" title={`${due} missed spots due for review`}>
                  {due}
                </span>
              )}
            </button>
          ))}
        </nav>
      </header>

      <main>
        {page === 'play' && <PlayPage />}
        {page === 'drills' && <DrillsPage key={drillMode ?? 'menu'} initialMode={drillMode} />}
        {page === 'hands' && <HandsPage />}
        {page === 'solver' && <SolverPage />}
        {page === 'progress' && <ProgressPage onNavigate={go} />}
      </main>
    </div>
  )
}

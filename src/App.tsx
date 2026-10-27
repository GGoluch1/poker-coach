import { useState } from 'react'
import { dueCards } from './engine/srs'
import { DrillsPage } from './ui/DrillsPage'
import type { DrillMode } from './ui/DrillsPage'
import { HandsPage } from './ui/HandsPage'
import type { IconName } from './ui/Icon'
import { Icon } from './ui/Icon'
import { PlayPage } from './ui/PlayPage'
import { ProgressPage } from './ui/ProgressPage'
import { useProgress } from './ui/progress'
import { SolverPage } from './ui/SolverPage'
import { useNow } from './ui/useNow'
import './App.css'

type Page = 'play' | 'drills' | 'hands' | 'solver' | 'progress'
const PAGES: { id: Page; label: string; icon: IconName }[] = [
  { id: 'play', label: 'Play', icon: 'spade' },
  { id: 'drills', label: 'Drills', icon: 'bolt' },
  { id: 'hands', label: 'Hands', icon: 'layers' },
  { id: 'solver', label: 'Solver', icon: 'cpu' },
  { id: 'progress', label: 'Progress', icon: 'chart' },
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
        <h1 className="brand">
          <span className="brand-mark" aria-hidden>
            ♠
          </span>
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
              <Icon name={p.icon} />
              <span className="nav-label">{p.label}</span>
              {p.id === 'drills' && due > 0 && (
                <span className="badge" title={`${due} missed spots due for review`}>
                  {due}
                </span>
              )}
            </button>
          ))}
        </nav>
      </header>

      <main className="main">
        {page === 'play' && <PlayPage />}
        {page === 'drills' && <DrillsPage key={drillMode ?? 'menu'} initialMode={drillMode} />}
        {page === 'hands' && <HandsPage />}
        {page === 'solver' && <SolverPage />}
        {page === 'progress' && <ProgressPage onNavigate={go} />}
      </main>
    </div>
  )
}

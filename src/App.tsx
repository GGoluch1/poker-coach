import { useState } from 'react'
import { isGameOver } from './engine/game'
import { handClass, positions } from './engine/range'
import { ActionBar } from './ui/ActionBar'
import { CoachPanel } from './ui/CoachPanel'
import { HistoryPanel } from './ui/HistoryPanel'
import { RangeChart } from './ui/RangeChart'
import { Table } from './ui/Table'
import { HERO, useGame } from './ui/useGame'
import './App.css'

type Tab = 'coach' | 'charts' | 'history'
const TABS: { id: Tab; label: string }[] = [
  { id: 'coach', label: 'Coach' },
  { id: 'charts', label: 'Charts' },
  { id: 'history', label: 'History' },
]

export default function App() {
  const { game, history, heroAct, nextHand, newGame } = useGame()
  const [tab, setTab] = useState<Tab>('coach')
  const [hints, setHints] = useState(true)
  const [opponents, setOpponents] = useState(game.players.length - 1)

  const hero = game.players[HERO]
  const heroTurn = !game.handOver && game.toAct === HERO
  const gameOver = isGameOver(game)
  const heroPosition = hero.inHand
    ? positions(
        game.players.map((p) => p.inHand),
        game.button,
      )[HERO]
    : null
  const heroClass = hero.hole.length === 2 ? handClass(hero.hole[0], hero.hole[1]) : null

  const startNew = () => {
    if (gameOver || confirm('Start a new game? Your current stacks will be reset.'))
      newGame(opponents)
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
        <div className="controls">
          <label className="toggle">
            <input type="checkbox" checked={hints} onChange={(e) => setHints(e.target.checked)} />
            Live hints
          </label>
          <label>
            <span className="sr-only">Opponents</span>
            <select value={opponents} onChange={(e) => setOpponents(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} opponent{n === 1 ? '' : 's'}
                </option>
              ))}
            </select>
          </label>
          <button className="btn" onClick={startNew}>
            New game
          </button>
        </div>
      </header>

      <main className="layout">
        <section className="play">
          <Table game={game} onNextHand={nextHand} gameOver={gameOver} />
          {heroTurn ? (
            <ActionBar
              key={`${game.handNumber}-${game.events.length}`}
              game={game}
              onAct={heroAct}
            />
          ) : (
            <div className="action-bar action-wait muted">
              {gameOver
                ? 'Game over. Start a new game to play again.'
                : game.handOver
                  ? `Hand #${game.handNumber} is over.`
                  : `${game.players[game.toAct ?? HERO].name} is thinking…`}
            </div>
          )}
          <p className="blinds muted small">
            No-limit hold'em · blinds {game.smallBlind}/{game.bigBlind} · hand #{game.handNumber}
          </p>
        </section>

        <aside className="sidebar">
          <div className="tabs" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                className={`tab${tab === t.id ? ' tab-on' : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="panel">
            {tab === 'coach' && <CoachPanel game={game} hints={hints} lastHand={history[0]} />}
            {tab === 'charts' && <RangeChart position={heroPosition} current={heroClass} />}
            {tab === 'history' && <HistoryPanel history={history} />}
          </div>
        </aside>
      </main>
    </div>
  )
}

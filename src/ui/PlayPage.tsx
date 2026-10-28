import { useState } from 'react'
import { findPreflopChart } from '../engine/charts'
import { PERSONALITIES, PROFILES } from '../engine/profiles'
import { handClass, positions } from '../engine/range'
import { ActionBar } from './ActionBar'
import { CoachPanel } from './CoachPanel'
import { HistoryPanel } from './HistoryPanel'
import { PageHeader } from './PageHeader'
import { RangeChart } from './RangeChart'
import { Table } from './Table'
import type { Lineup } from './useGame'
import { HERO, sessionOver, useGame } from './useGame'

type Tab = 'coach' | 'charts' | 'history'
const TABS: { id: Tab; label: string }[] = [
  { id: 'coach', label: 'Coach' },
  { id: 'charts', label: 'Charts' },
  { id: 'history', label: 'History' },
]

export function PlayPage() {
  const { game, profiles, seatStats, history, heroAct, nextHand, rebuy, newGame } = useGame()
  const [tab, setTab] = useState<Tab>('coach')
  const [hints, setHints] = useState(true)
  const [opponents, setOpponents] = useState(game.players.length - 1)
  const [lineup, setLineup] = useState<Lineup>('mixed')

  const hero = game.players[HERO]
  const heroTurn = !game.handOver && game.toAct === HERO
  const gameOver = sessionOver(game)
  const heroPosition = hero.inHand
    ? positions(
        game.players.map((p) => p.inHand),
        game.button,
      )[HERO]
    : null
  const heroClass = hero.hole.length === 2 ? handClass(hero.hole[0], hero.hole[1]) : null
  // Show the chart for the hero's current preflop spot, if one applies.
  const heroChartId =
    !game.handOver && game.street === 'preflop' && hero.inHand && !hero.folded
      ? (findPreflopChart(
          game.events,
          HERO,
          positions(
            game.players.map((p) => p.inHand),
            game.button,
          ),
        )?.id ?? null)
      : null

  const startNew = () => {
    if (gameOver || confirm('Start a new game? Your current stacks will be reset.')) {
      newGame(opponents, lineup)
    }
  }

  return (
    <>
      <PageHeader
        title="Play"
        compact
        actions={
          <div className="toolbar">
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
            <label>
              <span className="sr-only">Opponent types</span>
              <select value={lineup} onChange={(e) => setLineup(e.target.value as Lineup)}>
                <option value="mixed">Mixed opponents</option>
                {PERSONALITIES.map((p) => (
                  <option key={p} value={p}>
                    All {PROFILES[p].plural}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn btn-small" onClick={startNew}>
              New game
            </button>
          </div>
        }
      >
        <span className="table-info">
          <span className="pill-stat">
            NLH {game.smallBlind}/{game.bigBlind}
          </span>
          <span className="muted small">Hand #{game.handNumber}</span>
        </span>
      </PageHeader>

      <div className="layout">
        <section className="play">
          <Table game={game} profiles={profiles} seatStats={seatStats} />
          {heroTurn ? (
            <ActionBar
              key={`${game.handNumber}-${game.events.length}`}
              game={game}
              onAct={heroAct}
            />
          ) : game.handOver ? (
            <div className="action-bar action-wait">
              {gameOver && (
                <span className="muted">
                  {hero.stack > 0
                    ? 'You won every chip. Start a new game to play again.'
                    : 'You are out of chips. Rebuy or start a new game.'}
                </span>
              )}
              {!gameOver ? (
                <button className="btn btn-primary btn-wide" onClick={nextHand} autoFocus>
                  Deal next hand <kbd>Enter</kbd>
                </button>
              ) : (
                hero.stack === 0 && (
                  <button className="btn btn-primary btn-wide" onClick={rebuy} autoFocus>
                    Rebuy for 100 bb
                  </button>
                )
              )}
            </div>
          ) : (
            <div className="action-bar action-wait muted">
              {game.players[game.toAct ?? HERO].name} is thinking…
            </div>
          )}
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
            {tab === 'coach' && (
              <CoachPanel game={game} hints={hints} lastHand={history[0]} profiles={profiles} />
            )}
            {tab === 'charts' && (
              <RangeChart chartId={heroChartId} position={heroPosition} current={heroClass} />
            )}
            {tab === 'history' && <HistoryPanel history={history} />}
          </div>
        </aside>
      </div>
    </>
  )
}

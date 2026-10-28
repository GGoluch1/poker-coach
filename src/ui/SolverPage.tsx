import { useMemo, useState } from 'react'
import { cardToString, parseCards } from '../engine/card'
import { createDeck, shuffle } from '../engine/deck'
import type { Range } from '../engine/range'
import { GRID_RANKS, gridClass, parseRange, rangeFraction } from '../engine/range'
import type { SolverResult } from '../engine/solver'
import { runInWorker } from '../worker/client'
import { CardText } from './CardView'
import { PageHeader } from './PageHeader'
import { HOME_CRUMB } from './routes'

const BET_SIZES = [
  { f: 0.33, label: '33%' },
  { f: 0.5, label: '50%' },
  { f: 0.75, label: '75%' },
  { f: 1, label: '100%' },
  { f: 1.5, label: '150%' },
]

// Example: big blind defended against a button open and the flop and turn checked through.
const DEFAULTS = {
  board: 'Ks 9d 5c 3h 2s',
  oop: '22-99, A2s-AJs, K2s+, Q8s+, J8s+, T8s+, 97s+, 86s+, 75s+, 65s, 54s, A9o-AJo, KTo+, QTo+, JTo',
  ip: '22-JJ, A2s+, K9s+, QTs+, JTs, T9s, 98s, ATo+, KJo+, QJo',
  pot: 20,
  stack: 90,
}

/** Action colors from passive to aggressive. */
const ACTION_COLORS = ['var(--act-1)', 'var(--act-2)', 'var(--act-3)', 'var(--act-4)']

function actionColor(action: string, index: number): string {
  if (action === 'Fold') return 'var(--act-fold)'
  if (action === 'Check' || action === 'Call') return 'var(--act-1)'
  return ACTION_COLORS[Math.min(index, ACTION_COLORS.length - 1)]
}

interface Parsed {
  error: string | null
  game: Parameters<typeof runInWorker<'solve'>>[1]['game'] | null
}

function parseInputs(
  board: string,
  oop: string,
  ip: string,
  pot: number,
  stack: number,
  sizes: number[],
): Parsed {
  try {
    const cards = parseCards(board)
    if (cards.length !== 5) return { error: 'The board needs exactly five cards.', game: null }
    if (new Set(cards.map(cardToString)).size !== 5) {
      return { error: 'The board has a duplicate card.', game: null }
    }
    const ranges: [Range, Range] = [parseRange(oop), parseRange(ip)]
    if (ranges[0].size === 0 || ranges[1].size === 0) {
      return { error: 'Both ranges need at least one hand.', game: null }
    }
    if (!(pot > 0) || !(stack > 0)) return { error: 'Pot and stack must be positive.', game: null }
    if (sizes.length === 0) return { error: 'Pick at least one bet size.', game: null }
    return { error: null, game: { board: cards, ranges, pot, stack, betSizes: sizes } }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e), game: null }
  }
}

export function SolverPage() {
  const [board, setBoard] = useState(DEFAULTS.board)
  const [oop, setOop] = useState(DEFAULTS.oop)
  const [ip, setIp] = useState(DEFAULTS.ip)
  const [pot, setPot] = useState(DEFAULTS.pot)
  const [stack, setStack] = useState(DEFAULTS.stack)
  const [sizes, setSizes] = useState<number[]>([0.5, 1])
  const [iterations, setIterations] = useState(500)
  const [result, setResult] = useState<SolverResult | null>(null)
  const [nodePath, setNodePath] = useState('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parsed = useMemo(
    () => parseInputs(board, oop, ip, pot, stack, sizes),
    [board, oop, ip, pot, stack, sizes],
  )

  const solve = async () => {
    if (!parsed.game) return
    setRunning(true)
    setError(null)
    try {
      const r = await runInWorker('solve', { game: parsed.game, iterations })
      setResult(r)
      setNodePath('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }

  const randomBoard = () => setBoard(shuffle(createDeck()).slice(0, 5).map(cardToString).join(' '))
  const toggleSize = (f: number) =>
    setSizes((s) => (s.includes(f) ? s.filter((x) => x !== f) : [...s, f].sort((a, b) => a - b)))

  const node = result?.nodes.find((n) => n.path === nodePath) ?? null

  return (
    <div className="page">
      <PageHeader title="River solver" crumbs={[HOME_CRUMB, { label: 'Study' }]}>
        Computes a game-theory-optimal strategy for one river decision with CFR+, an algorithm that
        improves both players' strategies until neither can gain by changing. It's a deliberately
        small game: OOP checks or bets, IP checks back or bets, and facing a bet you call or fold.
        There are no raises.
      </PageHeader>

      <div className="solver-layout">
        <form
          className="solver-form card-panel"
          onSubmit={(e) => {
            e.preventDefault()
            solve()
          }}
        >
          <label className="field">
            <span>Board</span>
            <span className="field-row">
              <input value={board} onChange={(e) => setBoard(e.target.value)} spellCheck={false} />
              <button type="button" className="btn btn-quiet" onClick={randomBoard}>
                Random
              </button>
            </span>
            {parsed.game && (
              <span className="small">
                {parsed.game.board.map((c) => (
                  <CardText key={`${c.rank}${c.suit}`} card={c} />
                ))}
              </span>
            )}
          </label>
          <label className="field">
            <span>
              OOP range{' '}
              {parsed.game && (
                <span className="muted small">
                  ({Math.round(rangeFraction(parsed.game.ranges[0]) * 100)}% of hands)
                </span>
              )}
            </span>
            <textarea
              rows={3}
              value={oop}
              onChange={(e) => setOop(e.target.value)}
              spellCheck={false}
            />
          </label>
          <label className="field">
            <span>
              IP range{' '}
              {parsed.game && (
                <span className="muted small">
                  ({Math.round(rangeFraction(parsed.game.ranges[1]) * 100)}% of hands)
                </span>
              )}
            </span>
            <textarea
              rows={3}
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              spellCheck={false}
            />
          </label>
          <div className="field-grid">
            <label className="field">
              <span>Pot</span>
              <input
                type="number"
                min={1}
                value={pot}
                onChange={(e) => setPot(Number(e.target.value))}
              />
            </label>
            <label className="field">
              <span>Stack behind</span>
              <input
                type="number"
                min={1}
                value={stack}
                onChange={(e) => setStack(Number(e.target.value))}
              />
            </label>
          </div>
          <div className="field">
            <span>Bet sizes (% of pot)</span>
            <div className="presets">
              {BET_SIZES.map((b) => (
                <button
                  type="button"
                  key={b.f}
                  className={`chip-btn${sizes.includes(b.f) ? ' chip-btn-on' : ''}`}
                  aria-pressed={sizes.includes(b.f)}
                  onClick={() => toggleSize(b.f)}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            <span>Iterations</span>
            <select value={iterations} onChange={(e) => setIterations(Number(e.target.value))}>
              {[100, 500, 1000, 2000].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          {(parsed.error || error) && <p className="form-error">{parsed.error ?? error}</p>}
          <button className="btn btn-primary" disabled={!parsed.game || running}>
            {running ? 'Solving…' : 'Solve'}
          </button>
          <p className="muted small">
            Ranges use standard notation: 22+, A2s+, KTo+, 77-99, AQ+ (suited and offsuit).
          </p>
        </form>

        <section className="solver-results card-panel">
          {!result ? (
            <p className="muted">
              Set up a spot and press Solve. Results show each player's strategy at every decision.
            </p>
          ) : (
            <>
              <div className="solver-summary">
                <div>
                  <span className="muted small">OOP EV</span>
                  <strong>{result.ev[0].toFixed(2)}</strong>
                </div>
                <div>
                  <span className="muted small">IP EV</span>
                  <strong>{result.ev[1].toFixed(2)}</strong>
                </div>
                <div title="How much a perfect counter-strategy could gain, as a share of the pot. Lower is closer to equilibrium.">
                  <span className="muted small">Exploitability</span>
                  <strong>{(result.exploitability * 100).toFixed(2)}% pot</strong>
                </div>
              </div>

              <div className="node-list" role="tablist" aria-label="Decision points">
                {result.nodes.map((n) => (
                  <button
                    key={n.path}
                    role="tab"
                    aria-selected={n.path === nodePath}
                    className={`chip-btn${n.path === nodePath ? ' chip-btn-on' : ''}`}
                    onClick={() => setNodePath(n.path)}
                  >
                    {n.history}
                  </button>
                ))}
              </div>

              {node && (
                <>
                  <p className="node-title">
                    <strong>{node.player === 0 ? 'OOP' : 'IP'}</strong> to act · {node.history}
                  </p>
                  <div className="action-summary">
                    {node.actions.map((a, i) => (
                      <span key={a} className="legend-item">
                        <span className="swatch" style={{ background: actionColor(a, i) }} />
                        {a} {Math.round(node.overall[i] * 100)}%
                      </span>
                    ))}
                  </div>
                  <StrategyGrid
                    actions={node.actions}
                    classes={new Map(node.classes.map((c) => [c.cls, c.freqs]))}
                  />
                  <p className="muted small">
                    Each cell splits left to right by how often that hand takes each action. Empty
                    cells aren't in the range at this point.
                  </p>
                </>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}

function StrategyGrid({ actions, classes }: { actions: string[]; classes: Map<string, number[]> }) {
  return (
    <div className="grid strategy-grid" role="grid">
      {GRID_RANKS.map((_, row) =>
        GRID_RANKS.map((_, col) => {
          const cls = gridClass(row, col)
          const freqs = classes.get(cls)
          const title = freqs
            ? `${cls}: ${actions.map((a, i) => `${a} ${Math.round(freqs[i] * 100)}%`).join(', ')}`
            : `${cls}: not in range`
          return (
            <div
              key={cls}
              className={`cell${freqs ? '' : ' cell-fold'}`}
              title={title}
              role="gridcell"
            >
              {freqs && (
                <span className="cell-bars" aria-hidden>
                  {freqs.map((f, i) => (
                    <span key={i} style={{ flexGrow: f, background: actionColor(actions[i], i) }} />
                  ))}
                </span>
              )}
              <span className="cell-label">{cls}</span>
            </div>
          )
        }),
      )}
    </div>
  )
}

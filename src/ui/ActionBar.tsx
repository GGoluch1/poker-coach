import { useEffect, useState } from 'react'
import type { Action, GameState } from '../engine/game'
import { legalActions, totalPot } from '../engine/game'
import { HERO } from './useGame'

interface Props {
  game: GameState
  onAct: (action: Action) => void
}

/** Bet-size shortcuts, as street totals within the legal range. */
function presets(game: GameState, min: number, max: number): { label: string; to: number }[] {
  const hero = game.players[HERO]
  const toCall = game.currentBet - hero.bet
  const pot = totalPot(game)
  const bb = game.bigBlind
  const unopened =
    game.street === 'preflop' &&
    !game.events.some((e) => e.type === 'action' && e.action === 'raise')
  const raw = unopened
    ? [2.5, 3, 4].map((x) => ({ label: `${x}x`, to: x * bb }))
    : [
        { label: '⅓ pot', f: 1 / 3 },
        { label: '½ pot', f: 0.5 },
        { label: '¾ pot', f: 0.75 },
        { label: 'Pot', f: 1 },
      ].map(({ label, f }) => ({ label, to: game.currentBet + f * (pot + toCall) }))
  const out = raw
    .map((p) => ({ ...p, to: Math.round(p.to) }))
    .filter((p) => p.to >= min && p.to < max)
  return [...out, { label: 'All in', to: max }]
}

export function ActionBar({ game, onAct }: Props) {
  const legal = legalActions(game)
  const { minRaiseTo: min, maxRaiseTo: max } = legal
  const [raiseTo, setRaiseTo] = useState(min ?? 0)
  const isBet = game.currentBet === 0

  const fold = () => onAct({ type: 'fold' })
  const passive = () => onAct(legal.canCheck ? { type: 'check' } : { type: 'call' })
  const raise = () => {
    if (min === null || max === null) return
    onAct({ type: 'raise', to: Math.min(max, Math.max(min, Math.round(raiseTo))) })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.ctrlKey || e.metaKey || e.altKey) return
      const key = e.key.toLowerCase()
      if (key === 'f' && !legal.canCheck) fold()
      else if (key === 'c') passive()
      else if (key === 'r' && min !== null) raise()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="action-bar">
      <div className="action-buttons">
        <button className="btn btn-fold" onClick={fold} title="F">
          Fold
        </button>
        <button className="btn btn-call" onClick={passive} title="C">
          {legal.canCheck ? 'Check' : `Call ${legal.toCall}`}
        </button>
        {min !== null && max !== null && (
          <button className="btn btn-raise" onClick={raise} title="R">
            {raiseTo >= max ? `All in ${max}` : `${isBet ? 'Bet' : 'Raise to'} ${raiseTo}`}
          </button>
        )}
      </div>
      {min !== null && max !== null && min < max && (
        <div className="raise-controls">
          <div className="presets">
            {presets(game, min, max).map((p) => (
              <button
                key={p.label}
                className={`chip-btn${raiseTo === p.to ? ' chip-btn-on' : ''}`}
                onClick={() => setRaiseTo(p.to)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="slider-row">
            <input
              type="range"
              min={min}
              max={max}
              value={raiseTo}
              onChange={(e) => setRaiseTo(Number(e.target.value))}
              aria-label="Raise amount"
            />
            <input
              type="number"
              className="amount"
              min={min}
              max={max}
              value={raiseTo}
              onChange={(e) => setRaiseTo(Number(e.target.value))}
              aria-label="Raise to"
            />
          </div>
        </div>
      )}
      <div className="hint-keys muted">Keys: F fold · C check/call · R raise</div>
    </div>
  )
}

import { useMemo } from 'react'
import type { Spot } from '../engine/analysis'
import { analyzeSpot } from '../engine/analysis'
import type { EquityResult } from '../engine/equity'
import { hitChance } from '../engine/equity'
import type { GameState } from '../engine/game'
import { describeHand } from '../engine/hand'
import { randomSeed, runInWorker } from '../worker/client'
import { CardText } from './CardView'
import { HandReview } from './HandReview'
import { useAsync } from './useAsync'
import type { HandRecord } from './useGame'
import { HERO } from './useGame'

const pct = (x: number) => `${Math.round(x * 100)}%`

interface Props {
  game: GameState
  hints: boolean
  lastHand: HandRecord | undefined
}

export function CoachPanel({ game, hints, lastHand }: Props) {
  const hero = game.players[HERO]
  const inHand = !game.handOver && hero.inHand && !hero.folded
  const active = inHand && hints
  // Pot odds, outs and chart advice are instant; equity comes from the worker.
  const spot = useMemo(
    () => (active ? analyzeSpot(game, HERO, { iterations: 0 }) : null),
    [game, active],
  )
  const equity = useAsync(
    active
      ? () =>
          runInWorker('analyze', { state: game, seat: HERO, iterations: 4000, seed: randomSeed() })
      : null,
    active ? game : null,
  )?.equity

  if (game.handOver) {
    return lastHand ? (
      <div className="panel-section">
        <h3>Last hand review</h3>
        <HandReview record={lastHand} />
      </div>
    ) : null
  }
  if (!inHand) {
    return <p className="muted">You folded. The bots are finishing the hand…</p>
  }
  if (!hints || !spot) {
    return (
      <p className="muted">
        Hints are off. Play on your own; each decision is reviewed after the hand.
      </p>
    )
  }
  return (
    <LiveCoach
      spot={spot}
      equity={equity ?? null}
      heroTurn={game.toAct === HERO}
      waitingOn={game.toAct === null ? null : game.players[game.toAct].name}
    />
  )
}

function LiveCoach({
  spot,
  equity: result,
  heroTurn,
  waitingOn,
}: {
  spot: Spot
  equity: EquityResult | null
  heroTurn: boolean
  waitingOn: string | null
}) {
  const equity = result?.equity ?? null
  const need = spot.requiredEquity
  const outs = spot.outs.reduce((n, g) => n + g.cards.length, 0)
  const unseen = 52 - 2 - spot.board.length

  return (
    <div className="coach">
      <div className="coach-head">
        <div>
          <span className="coach-hand">{spot.handClass}</span>
          {spot.position && <span className="seat-pos">{spot.position}</span>}
        </div>
        {spot.made && <div className="muted">{describeHand(spot.made)}</div>}
      </div>

      {!heroTurn && waitingOn && <p className="muted small">Waiting on {waitingOn}…</p>}

      {spot.openAdvice && (
        <div className={`advice advice-${spot.openAdvice === 'raise' ? 'good' : 'bad'}`}>
          Chart: <strong>{spot.openAdvice === 'raise' ? 'Raise' : 'Fold'}</strong>. {spot.handClass}{' '}
          is {spot.openAdvice === 'raise' ? 'in' : 'outside'} the {spot.position} opening range.
        </div>
      )}

      <div className="stat">
        <div className="stat-row">
          <span>Equity</span>
          <strong>{equity === null ? '…' : pct(equity)}</strong>
        </div>
        <div className="meter" aria-hidden>
          <div className="meter-fill" style={{ width: pct(equity ?? 0) }} />
          {need > 0 && <div className="meter-mark" style={{ left: pct(need) }} />}
        </div>
        <div className="muted small">{spot.equityNote}</div>
      </div>

      {spot.toCall > 0 && (
        <div className="stat">
          <div className="stat-row">
            <span>Pot odds</span>
            <strong>need {pct(need)}</strong>
          </div>
          <div className="muted small">
            Call {spot.toCall} to win {spot.pot}
          </div>
          {heroTurn && !spot.openAdvice && equity !== null && (
            <div className={`advice advice-${equity >= need ? 'good' : 'bad'}`}>
              <span
                className="tag"
                title="Equity against ranges guessed from preflop action, not a solver result"
              >
                Heuristic
              </span>
              {equity >= need
                ? `Calling is profitable: ${pct(equity)} equity beats the ${pct(need)} you need.`
                : `Calling loses money: ${pct(equity)} equity is below the ${pct(need)} you need${outs >= 8 ? ', unless you win a lot more when you hit' : ''}.`}
            </div>
          )}
        </div>
      )}

      {spot.outs.length > 0 && (
        <div className="stat">
          <div className="stat-row">
            <span>Outs</span>
            <strong>{outs}</strong>
          </div>
          <div className="muted small">
            {pct(hitChance(outs, unseen, 1))} on the next card
            {spot.board.length === 3 && <> · {pct(hitChance(outs, unseen, 2))} by the river</>}
          </div>
          <ul className="outs">
            {spot.outs.map((g) => (
              <li key={g.category}>
                <span>{g.category}</span>
                <span className="outs-cards">
                  {g.cards.map((c, i) => (
                    <CardText key={i} card={c} />
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {spot.opponents.length > 0 && (
        <details className="reads">
          <summary>Opponent reads</summary>
          <ul>
            {spot.opponents.map((o) => (
              <li key={o.seat}>
                <strong>{o.name}</strong> {o.read.label}
              </li>
            ))}
          </ul>
          <p className="muted small">
            Ranges are guessed from preflop action only, so treat equity as a guide, not gospel.
          </p>
        </details>
      )}
    </div>
  )
}

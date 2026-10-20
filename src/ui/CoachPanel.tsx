import { useMemo } from 'react'
import type { Spot } from '../engine/analysis'
import { analyzeSpot } from '../engine/analysis'
import type { EquityResult } from '../engine/equity'
import { hitChance } from '../engine/equity'
import type { GameState } from '../engine/game'
import { describeHand } from '../engine/hand'
import type { Personality } from '../engine/profiles'
import { PROFILES } from '../engine/profiles'
import { randomSeed, runInWorker } from '../worker/client'
import { CardText } from './CardView'
import { HandReview } from './HandReview'
import { useAsync } from './useAsync'
import type { HandRecord } from './useGame'
import { HERO } from './useGame'

const pct = (x: number) => `${Math.round(x * 100)}%`
const formatBb = (x: number) => `${x >= 0 ? '+' : ''}${x.toFixed(1)} bb`

interface Props {
  game: GameState
  hints: boolean
  lastHand: HandRecord | undefined
  profiles: (Personality | undefined)[]
}

export function CoachPanel({ game, hints, lastHand, profiles }: Props) {
  const hero = game.players[HERO]
  const inHand = !game.handOver && hero.inHand && !hero.folded
  const active = inHand && hints
  // Pot odds, outs and chart advice are instant; equity comes from the worker.
  const spot = useMemo(
    () => (active ? analyzeSpot(game, HERO, { iterations: 0, profiles }) : null),
    [game, active, profiles],
  )
  const equity = useAsync(
    active
      ? () =>
          runInWorker('analyze', {
            state: game,
            seat: HERO,
            iterations: 4000,
            seed: randomSeed(),
            profiles,
          })
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
      profiles={profiles}
      bigBlind={game.bigBlind}
      equity={equity ?? null}
      heroTurn={game.toAct === HERO}
      waitingOn={game.toAct === null ? null : game.players[game.toAct].name}
    />
  )
}

function LiveCoach({
  spot,
  profiles,
  bigBlind,
  equity: result,
  heroTurn,
  waitingOn,
}: {
  spot: Spot
  profiles: (Personality | undefined)[]
  bigBlind: number
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

      {spot.chart && (
        <div className={`advice advice-${spot.chart.action === 'fold' ? 'bad' : 'good'}`}>
          <span className="tag">Chart</span>
          {spot.chart.chart.title}:{' '}
          <strong>
            {spot.chart.action === 'raise'
              ? spot.chart.chart.raiseLabel
              : spot.chart.action === 'call'
                ? 'Call'
                : 'Fold'}
          </strong>{' '}
          {spot.handClass}.
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
            {equity !== null && (
              <>
                {' '}
                · call EV {formatBb((equity * (spot.pot + spot.toCall) - spot.toCall) / bigBlind)}
              </>
            )}
          </div>
          {heroTurn && !spot.chart && equity !== null && (
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
                {profiles[o.seat] && (
                  <div className="muted small">{PROFILES[profiles[o.seat]!].tip}</div>
                )}
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

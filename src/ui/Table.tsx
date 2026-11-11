import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import type { GameState } from '../engine/game'
import { blindSeats, totalPot } from '../engine/game'
import { describeHand, evaluateHand } from '../engine/hand'
import type { Personality } from '../engine/profiles'
import { PROFILES } from '../engine/profiles'
import type { PlayStats } from '../engine/stats'
import { positions } from '../engine/range'
import { CardView } from './CardView'
import { HERO } from './useGame'

/** Avatar hues, one per seat. */
const SEAT_HUES = [152, 210, 28, 280, 340, 190]
const ACTION_LABEL = { fold: 'Fold', check: 'Check', call: 'Call', bet: 'Bet', raise: 'Raise' }
/** How long chips take to slide into the pot and out to the winner, stagger included. */
const FLIGHT_MS = 1400

/** Where a seat sits on the felt, in percent, and the unit vector toward the middle. */
function seatGeometry(seat: number, seats: number) {
  // Hero at the bottom, then clockwise.
  const angle = Math.PI / 2 + (seat * 2 * Math.PI) / seats
  return {
    x: 50 + 44 * Math.cos(angle),
    y: 50 + 41 * Math.sin(angle),
    dx: -Math.cos(angle),
    dy: -Math.sin(angle),
  }
}

/** Index of the first board card in the latest deal, so a flop or run-out flips in order. */
function newCardsFrom(game: GameState): number {
  let dealt = 0
  for (let i = game.events.length - 1; i >= 0; i--) {
    const e = game.events[i]
    if (e.type === 'deal') dealt += e.cards.length
    else if (e.type !== 'win' && e.type !== 'refund') break
  }
  return game.board.length - dealt
}

interface Flight {
  id: string
  seat: number
  kind: 'collect' | 'payout'
}

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Chips that slide from each bet into the pot when a street ends, then from the pot to the
 * winners when the hand ends. Found by comparing each state with the one before it.
 */
function useChipFlights(game: GameState): Flight[] {
  const [prev, setPrev] = useState(game)
  const [flights, setFlights] = useState<Flight[]>([])
  if (prev !== game) {
    // Adjusting state during render, as React recommends for reacting to a changed prop.
    setPrev(game)
    const added = prefersReducedMotion() ? [] : flightsBetween(prev, game)
    if (added.length > 0) setFlights((f) => [...f, ...added])
  }
  useEffect(() => {
    if (flights.length === 0) return
    // Flights end transparent, so ones that land early can wait for the latest batch.
    const id = setTimeout(() => setFlights((f) => f.filter((x) => !flights.includes(x))), FLIGHT_MS)
    return () => clearTimeout(id)
  }, [flights])
  return flights
}

function flightsBetween(before: GameState, game: GameState): Flight[] {
  if (before.handNumber !== game.handNumber) return []
  const tag = `${game.handNumber}-${game.events.length}`
  const added: Flight[] = []
  game.players.forEach((p, seat) => {
    if ((before.players[seat]?.bet ?? 0) > 0 && p.bet === 0) {
      added.push({ id: `${tag}-c${seat}`, seat, kind: 'collect' })
    }
  })
  if (game.handOver && !before.handOver) {
    const winners = new Set<number>()
    for (const e of game.events) if (e.type === 'win') winners.add(e.seat)
    for (const seat of winners) added.push({ id: `${tag}-p${seat}`, seat, kind: 'payout' })
  }
  return added
}

interface Props {
  game: GameState
  profiles?: (Personality | undefined)[]
  /** Per-seat stats, shown as VPIP/PFR on each opponent. */
  seatStats?: PlayStats[]
  /** Replay mode: no result banner. */
  replay?: boolean
}

export function Table({ game, profiles = [], seatStats, replay = false }: Props) {
  const n = game.players.length
  const pos = positions(
    game.players.map((p) => p.inHand),
    game.button,
  )
  const winnings = new Map<number, number>()
  for (const e of game.events) {
    if (e.type === 'win') winnings.set(e.seat, (winnings.get(e.seat) ?? 0) + e.amount)
  }
  const lastAction = (seat: number) => {
    for (let i = game.events.length - 1; i >= 0; i--) {
      const e = game.events[i]
      if (e.type === 'deal' && !game.handOver) return null
      if (e.type === 'action' && e.seat === seat) {
        return (
          ACTION_LABEL[e.action] + (e.action === 'bet' || e.action === 'raise' ? ` ${e.to}` : '')
        )
      }
    }
    return null
  }
  const { bb } = game.handNumber > 0 ? blindSeats(game) : { bb: -1 }
  const pot = totalPot(game)
  const flights = useChipFlights(game)
  const firstNew = newCardsFrom(game)

  return (
    <div className="table-wrap">
      <div className="felt" style={{ '--seats': n } as CSSProperties}>
        <div className="felt-center">
          <div className="board">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="board-slot"
                style={{ '--deal-i': Math.max(0, i - firstNew) } as CSSProperties}
              >
                <CardView card={game.board[i]} size="lg" />
              </span>
            ))}
          </div>
          <div className="pot">
            Pot {/* Keyed by amount so it pops whenever chips go in. */}
            <strong key={pot} className="pot-amount">
              {pot}
            </strong>
          </div>
          {game.handOver && !replay && (
            <div className="result">
              <ResultLine game={game} />
            </div>
          )}
        </div>

        {game.players.map((p, seat) => {
          const { x, y, dx, dy } = seatGeometry(seat, n)
          const isHero = seat === HERO
          const live = p.inHand && !p.folded
          const reveal = isHero || (game.showdown && live)
          const won = winnings.get(seat)
          const action = lastAction(seat)
          const classes = [
            'seat',
            isHero && 'seat-hero',
            game.toAct === seat && 'seat-active',
            !live && 'seat-out',
            won && 'seat-won',
          ]
          const badge = won
            ? { text: `Wins ${won}`, className: ' badge-win' }
            : p.allIn
              ? { text: 'All in', className: ' badge-allin' }
              : p.folded && p.inHand
                ? { text: 'Folded', className: ' badge-fold' }
                : action
                  ? { text: action, className: '' }
                  : null
          // Cards go out one at a time, starting left of the button.
          const dealOrder = (seat - game.button - 1 + n) % n
          return (
            <div
              key={seat}
              className={classes.filter(Boolean).join(' ')}
              style={
                {
                  left: `${x}%`,
                  top: `${y}%`,
                  '--dx': dx,
                  '--dy': dy,
                  '--deal-order': dealOrder,
                } as CSSProperties
              }
            >
              {/* Keyed by hand so each new hand deals the cards in again. */}
              <div className="seat-cards" key={game.handNumber}>
                {p.inHand &&
                  p.hole.map((c, i) => (
                    <CardView key={i} card={c} size="md" hidden={!reveal} dim={p.folded} />
                  ))}
              </div>
              <div
                className="seat-avatar"
                style={{ '--hue': SEAT_HUES[seat % SEAT_HUES.length] } as CSSProperties}
              >
                {isHero ? 'You' : p.name[0]}
                {pos[seat] && <span className="seat-pos">{pos[seat]}</span>}
              </div>
              <div className="seat-plate">
                {!isHero && <div className="seat-name">{p.name}</div>}
                <div className="seat-stack">{p.inHand || p.stack > 0 ? p.stack : 'Out'}</div>
                {profiles[seat] && (
                  <div className="seat-profile" title={PROFILES[profiles[seat]].description}>
                    {PROFILES[profiles[seat]].short}
                    {seatStats && seatStats[seat].hands > 0 && (
                      <span
                        className="hud"
                        title={`VPIP / PFR over ${seatStats[seat].hands} hands`}
                      >
                        {' '}
                        {Math.round((seatStats[seat].vpip / seatStats[seat].hands) * 100)}/
                        {Math.round((seatStats[seat].pfr / seatStats[seat].hands) * 100)}
                      </span>
                    )}
                  </div>
                )}
              </div>
              {badge && (
                // Keyed by text so each new action pops in.
                <div key={badge.text} className={`seat-badge${badge.className}`}>
                  {badge.text}
                </div>
              )}
              {game.showdown && live && !isHero && game.board.length === 5 && (
                <div className="seat-hand">{describeShown(game, seat)}</div>
              )}
              {seat === game.button && (
                <span className="dealer" title="Dealer button">
                  D
                </span>
              )}
              {p.bet > 0 && (
                // Offset toward the middle of the table; keyed so a raise slides in fresh chips.
                <div key={p.bet} className="bet">
                  <span className="chip" aria-hidden />
                  {p.bet}
                  {seat === bb && game.street === 'preflop' && p.bet === game.bigBlind && (
                    <span className="muted"> BB</span>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {flights.map((f) => {
          const { x, y, dx, dy } = seatGeometry(f.seat, n)
          return [0, 1, 2].map((i) => (
            <span
              key={`${f.id}-${i}`}
              className={`chip chip-fly chip-${f.kind}`}
              style={{ '--x': x, '--y': y, '--dx': dx, '--dy': dy, '--i': i } as CSSProperties}
              aria-hidden
            />
          ))
        })}
      </div>
    </div>
  )
}

function describeShown(game: GameState, seat: number): string {
  return describeHand(evaluateHand([...game.players[seat].hole, ...game.board]))
}

function ResultLine({ game }: { game: GameState }) {
  const wins = game.events.filter((e) => e.type === 'win')
  const bySeat = new Map<number, { amount: number; hand: string | null }>()
  for (const e of wins) {
    if (e.type !== 'win') continue
    const prev = bySeat.get(e.seat)
    bySeat.set(e.seat, {
      amount: (prev?.amount ?? 0) + e.amount,
      hand: e.hand ? describeHand(e.hand) : (prev?.hand ?? null),
    })
  }
  return (
    <div className="result-line">
      {[...bySeat].map(([seat, w]) => (
        <div key={seat}>
          <strong>{seat === HERO ? 'You win' : `${game.players[seat].name} wins`}</strong>{' '}
          {w.amount}
          {w.hand && <> with {w.hand}</>}
        </div>
      ))}
    </div>
  )
}

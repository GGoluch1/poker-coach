import type { Card } from './card'
import type { ChartAction, PreflopChart } from './charts'
import { chartAction, findPreflopChart } from './charts'
import type { EquityResult, OutGroup } from './equity'
import { estimateEquity, findOuts } from './equity'
import type { GameState, HandEvent, Street } from './game'
import { liveSeats, totalPot } from './game'
import type { HandValue } from './hand'
import { evaluateHand } from './hand'
import type { HandClass, Position, Range } from './range'
import type { Personality } from './profiles'
import { PROFILES } from './profiles'
import {
  CALL_RANGE,
  LIMP_RANGE,
  OPEN_RANGES,
  RAISE_RANGE,
  THREE_BET_RANGE,
  handClass,
  positions,
  rangeFraction,
} from './range'
import type { Rng } from './rng'

export interface RangeRead {
  range: Range | null
  /** Short explanation, e.g. "raised preflop". */
  label: string
}

/**
 * Guesses a player's range from their preflop actions so far. A known personality changes
 * the read (a maniac's raise means much less than a nit's), and a balanced player's open is
 * read as the opening chart for their position.
 */
export function readPreflop(
  events: HandEvent[],
  seat: number,
  bigBlind: number,
  profile?: Personality,
  position?: Position | null,
): RangeRead {
  const reads = profile ? PROFILES[profile].reads : null
  const who = profile ? `${PROFILES[profile].label.toLowerCase()}, ` : ''
  const label = (what: string, range: Range) =>
    `${what} (${who}top ~${Math.round(rangeFraction(range) * 100)}%)`
  let raisesBefore = 0
  let read: RangeRead = { range: null, label: 'any two cards' }
  let strength = 0
  const consider = (what: string, range: Range, level: number) => {
    if (level > strength) {
      read = { range, label: label(what, range) }
      strength = level
    }
  }
  for (const e of events) {
    if (e.type !== 'action' || e.street !== 'preflop') continue
    if (e.seat === seat) {
      if (e.action === 'raise' && raisesBefore > 0) {
        consider('re-raised preflop', reads?.threeBet ?? THREE_BET_RANGE, 4)
      } else if (e.action === 'raise') {
        const chartOpen =
          profile === 'balanced' && position && position !== 'BB' ? OPEN_RANGES[position] : null
        consider('raised preflop', reads?.open ?? chartOpen ?? RAISE_RANGE, 3)
      } else if (e.action === 'call' && e.to > bigBlind) {
        consider('called a raise', reads?.call ?? CALL_RANGE, 2)
      } else if (e.action === 'call') {
        consider('limped', reads?.limp ?? LIMP_RANGE, 1)
      }
    }
    if (e.action === 'raise') raisesBefore++
  }
  return read
}

export interface Spot {
  seat: number
  street: Street
  position: Position | null
  hole: Card[]
  board: Card[]
  handClass: HandClass
  /** Everything in the middle, including current street bets. */
  pot: number
  toCall: number
  /** Equity needed for a call to break even: toCall / (pot + toCall). */
  requiredEquity: number
  /** Opponents the equity is measured against. */
  opponents: { seat: number; name: string; read: RangeRead }[]
  /** Null when equity wasn't requested. */
  equity: EquityResult | null
  /** What the equity is measured against, for display. */
  equityNote: string
  /** Preflop with no raise yet. */
  unopened: boolean
  /** The preflop chart for this decision and what it recommends, when one applies. */
  chart: { chart: PreflopChart; action: ChartAction } | null
  made: HandValue | null
  outs: OutGroup[]
}

export interface SpotOptions {
  /** Monte Carlo iterations for equity; 0 skips it. */
  iterations?: number
  rng?: Rng
  withOuts?: boolean
  /** Known personality per seat, used to read opponents' ranges. */
  profiles?: (Personality | undefined)[]
}

/** Everything a player can know about their decision: odds, equity, chart advice. */
export function analyzeSpot(s: GameState, seat: number, options: SpotOptions = {}): Spot {
  const { iterations = 2000, rng = Math.random, withOuts = true, profiles = [] } = options
  const p = s.players[seat]
  const seatPositions = positions(
    s.players.map((q) => q.inHand),
    s.button,
  )
  const position = seatPositions[seat]
  const pot = totalPot(s)
  const toCall = Math.min(Math.max(0, s.currentBet - p.bet), p.stack)
  // Preflop, only players who put money in voluntarily are likely to see a flop.
  const entered = (i: number) =>
    s.events.some(
      (e) => e.type === 'action' && e.seat === i && e.action !== 'fold' && e.action !== 'check',
    )
  const opponents = liveSeats(s)
    .filter((i) => i !== seat && (s.street !== 'preflop' || entered(i)))
    .map((i) => ({
      seat: i,
      name: s.players[i].name,
      read: readPreflop(s.events, i, s.bigBlind, profiles[i], seatPositions[i]),
    }))
  const equityNote =
    opponents.length === 0
      ? 'vs one random hand (no one has entered the pot)'
      : opponents.length === 1
        ? "vs your opponent's likely range"
        : `vs ${opponents.length} opponents' likely ranges`
  const unopened =
    s.street === 'preflop' && !s.events.some((e) => e.type === 'action' && e.action === 'raise')
  const cls = handClass(p.hole[0], p.hole[1])
  const preflopChart =
    s.street === 'preflop' ? findPreflopChart(s.events, seat, seatPositions) : null

  return {
    seat,
    street: s.street,
    position,
    hole: p.hole,
    board: s.board,
    handClass: cls,
    pot,
    toCall,
    requiredEquity: toCall > 0 ? toCall / (pot + toCall) : 0,
    opponents,
    equity:
      iterations > 0
        ? estimateEquity({
            hero: p.hole,
            board: s.board,
            opponents: opponents.length > 0 ? opponents.map((o) => o.read.range) : [null],
            iterations,
            rng,
          })
        : null,
    equityNote,
    unopened,
    chart: preflopChart ? { chart: preflopChart, action: chartAction(preflopChart, cls) } : null,
    made: s.board.length >= 3 ? evaluateHand([...p.hole, ...s.board]) : null,
    outs: withOuts ? findOuts(p.hole, s.board) : [],
  }
}

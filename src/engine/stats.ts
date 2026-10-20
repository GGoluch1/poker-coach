import type { GameState } from './game'
import { netResult } from './history'

/** Raw counters; percentages are derived in `statLines`. */
export interface PlayStats {
  hands: number
  vpip: number
  pfr: number
  threeBetChances: number
  threeBets: number
  foldToCbetChances: number
  foldsToCbet: number
  sawFlop: number
  wentToShowdown: number
  wonAtShowdown: number
  /** Net result in big blinds. */
  bigBlinds: number
}

export const EMPTY_STATS: PlayStats = {
  hands: 0,
  vpip: 0,
  pfr: 0,
  threeBetChances: 0,
  threeBets: 0,
  foldToCbetChances: 0,
  foldsToCbet: 0,
  sawFlop: 0,
  wentToShowdown: 0,
  wonAtShowdown: 0,
  bigBlinds: 0,
}

/** Counters for one finished hand from `seat`'s point of view. */
export function handStats(s: GameState, seat: number): PlayStats {
  const out = { ...EMPTY_STATS }
  if (!s.players[seat].inHand) return out
  out.hands = 1
  out.bigBlinds = netResult(s, seat) / s.bigBlind

  const actions = s.events.flatMap((e) => (e.type === 'action' ? [e] : []))
  const preflop = actions.filter((e) => e.street === 'preflop')
  const mine = preflop.filter((e) => e.seat === seat)
  if (mine.some((e) => e.action === 'call' || e.action === 'raise')) out.vpip = 1
  if (mine.some((e) => e.action === 'raise')) out.pfr = 1

  // A 3-bet chance is facing exactly one raise at our first preflop decision.
  const firstIndex = preflop.findIndex((e) => e.seat === seat)
  if (firstIndex >= 0) {
    const raisesBefore = preflop.slice(0, firstIndex).filter((e) => e.action === 'raise').length
    if (raisesBefore === 1) {
      out.threeBetChances = 1
      if (preflop[firstIndex].action === 'raise') out.threeBets = 1
    }
  }

  const flopIndex = s.events.findIndex((e) => e.type === 'deal' && e.street === 'flop')
  const foldedBeforeFlop = mine.some((e) => e.action === 'fold')
  if (flopIndex >= 0 && !foldedBeforeFlop) {
    out.sawFlop = 1
    // Facing a continuation bet: the last preflop raiser bets first on the flop.
    const aggressor = preflop.filter((e) => e.action === 'raise').at(-1)?.seat
    const flop = actions.filter((e) => e.street === 'flop')
    const firstBet = flop.findIndex((e) => e.action === 'bet')
    if (
      aggressor !== undefined &&
      aggressor !== seat &&
      firstBet >= 0 &&
      flop[firstBet].seat === aggressor
    ) {
      const response = flop.slice(firstBet + 1).find((e) => e.seat === seat)
      if (response) {
        out.foldToCbetChances = 1
        if (response.action === 'fold') out.foldsToCbet = 1
      }
    }
    const me = s.players[seat]
    if (s.showdown && !me.folded) {
      out.wentToShowdown = 1
      if (s.events.some((e) => e.type === 'win' && e.seat === seat)) out.wonAtShowdown = 1
    }
  }
  return out
}

export function addStats(a: PlayStats, b: PlayStats): PlayStats {
  const out = { ...a }
  for (const key of Object.keys(EMPTY_STATS) as (keyof PlayStats)[]) out[key] = a[key] + b[key]
  return out
}

export interface StatLine {
  label: string
  /** Fraction 0-1, or null with no sample yet. */
  value: number | null
  sample: number
  /** Typical winning range for 6-max cash games. */
  target: [number, number]
  help: string
}

const ratio = (n: number, d: number) => (d > 0 ? n / d : null)

export function statLines(s: PlayStats): StatLine[] {
  return [
    {
      label: 'VPIP',
      value: ratio(s.vpip, s.hands),
      sample: s.hands,
      target: [0.22, 0.3],
      help: 'How often you put money in preflop voluntarily.',
    },
    {
      label: 'PFR',
      value: ratio(s.pfr, s.hands),
      sample: s.hands,
      target: [0.17, 0.24],
      help: 'How often you raise preflop. Should be close to VPIP.',
    },
    {
      label: '3-bet',
      value: ratio(s.threeBets, s.threeBetChances),
      sample: s.threeBetChances,
      target: [0.06, 0.11],
      help: 'How often you re-raise when facing a single raise.',
    },
    {
      label: 'Fold to c-bet',
      value: ratio(s.foldsToCbet, s.foldToCbetChances),
      sample: s.foldToCbetChances,
      target: [0.35, 0.55],
      help: 'How often you fold to the preflop raiser’s flop bet.',
    },
    {
      label: 'Went to showdown',
      value: ratio(s.wentToShowdown, s.sawFlop),
      sample: s.sawFlop,
      target: [0.25, 0.33],
      help: 'Of the flops you see, how many you take to showdown.',
    },
    {
      label: 'Won at showdown',
      value: ratio(s.wonAtShowdown, s.wentToShowdown),
      sample: s.wentToShowdown,
      target: [0.48, 0.56],
      help: 'How often you win when you get to showdown.',
    },
  ]
}

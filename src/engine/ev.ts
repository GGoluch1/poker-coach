import type { Spot } from './analysis'
import type { Card } from './card'
import { createDeck } from './deck'
import type { Combo } from './equity'
import { estimateEquity } from './equity'
import { scoreIds, toId } from './fastEval'
import type { Action, GameState } from './game'
import { legalActions, totalPot } from './game'
import type { Personality } from './profiles'
import { PROFILES } from './profiles'
import type { Range } from './range'
import { STRENGTH_PERCENTILE, combos, handClass } from './range'
import type { Rng } from './rng'

export interface OptionEv {
  label: string
  action: Action
  /** Expected chips won or lost compared with folding now, or null when not estimated. */
  ev: number | null
  note: string
}

const pct = (x: number) => `${Math.round(x * 100)}%`

/** A standard size for "raise" when grading or replaying a decision. */
export function standardRaiseTo(s: GameState): number | null {
  const legal = legalActions(s)
  if (legal.minRaiseTo === null) return null
  const unopened =
    s.street === 'preflop' && !s.events.some((e) => e.type === 'action' && e.action === 'raise')
  const target =
    s.street === 'preflop'
      ? unopened
        ? 2.5 * s.bigBlind
        : 3 * s.currentBet
      : s.currentBet === 0
        ? (2 / 3) * totalPot(s)
        : 3 * s.currentBet
  return Math.min(legal.maxRaiseTo!, Math.max(legal.minRaiseTo, Math.round(target)))
}

/** Combos in a range (or any two cards) that don't clash with known cards. */
function rangeCombos(range: Range | null, dead: Set<number>): Combo[] {
  let list: Combo[] = []
  if (range) list = [...range].flatMap(combos)
  else {
    const deck = createDeck()
    for (let i = 0; i < deck.length; i++) {
      for (let j = i + 1; j < deck.length; j++) list.push([deck[i], deck[j]])
    }
  }
  return list.filter(([a, b]) => !dead.has(toId(a)) && !dead.has(toId(b)))
}

/** The strongest `fraction` of combos: by made hand on the board, or by preflop strength. */
export function topOfRange(list: Combo[], board: Card[], fraction: number): Combo[] {
  const boardIds = board.map(toId)
  const strength = (c: Combo) =>
    board.length >= 3
      ? scoreIds([toId(c[0]), toId(c[1]), ...boardIds])
      : -STRENGTH_PERCENTILE.get(handClass(c[0], c[1]))!
  const scored = list.map((c) => ({ c, s: strength(c) })).sort((x, y) => y.s - x.s)
  return scored.slice(0, Math.max(1, Math.round(scored.length * fraction))).map((x) => x.c)
}

/**
 * Rough EV of each option in chips, relative to folding now (fold = 0).
 *
 * - Check and call use showdown EV: equity times the final pot, assuming no more betting.
 * - Bet and raise are estimated heads-up only. The opponent folds at the rate that makes a
 *   pure bluff break even (minimum defense frequency), shifted by their personality, and
 *   defends with the top of their range.
 *
 * These are teaching estimates, not solver output.
 */
export function optionEvs(
  s: GameState,
  seat: number,
  spot: Spot,
  raiseTo: number | null,
  options: { iterations?: number; rng?: Rng; profiles?: (Personality | undefined)[] } = {},
): OptionEv[] {
  const { iterations = 1500, rng = Math.random, profiles = [] } = options
  const legal = legalActions(s)
  const hero = s.players[seat]
  const pot = spot.pot
  const equity = spot.equity?.equity ?? null
  const skip = spot.unopened ? 'Opening EV depends on players yet to act; use the chart.' : null
  const showdown = 'Showdown EV: assumes no more betting.'
  const out: OptionEv[] = []

  if (!legal.canCheck)
    out.push({
      label: 'Fold',
      action: { type: 'fold' },
      ev: 0,
      note: 'Folding risks nothing more.',
    })
  if (legal.canCheck) {
    out.push({
      label: 'Check',
      action: { type: 'check' },
      ev: skip || equity === null ? null : equity * pot,
      note: skip ?? showdown,
    })
  } else {
    out.push({
      label: `Call ${legal.toCall}`,
      action: { type: 'call' },
      ev: skip || equity === null ? null : equity * (pot + legal.toCall) - legal.toCall,
      note: skip ?? showdown,
    })
  }

  const to = raiseTo ?? standardRaiseTo(s)
  if (to !== null && legal.minRaiseTo !== null) {
    const label = `${s.currentBet === 0 ? 'Bet' : 'Raise to'} ${to}`
    const action: Action = { type: 'raise', to }
    if (skip || equity === null) {
      out.push({ label, action, ev: null, note: skip ?? 'No equity estimate.' })
    } else if (spot.opponents.length !== 1) {
      out.push({ label, action, ev: null, note: 'Not estimated in multiway pots.' })
    } else {
      const opp = spot.opponents[0]
      const villain = s.players[opp.seat]
      const added = to - hero.bet
      const theirCall = Math.min(to - villain.bet, villain.stack)
      // Chips of ours they can actually match; the rest would be returned.
      const matched = Math.min(added, theirCall + villain.bet - hero.bet)
      const profile = profiles[opp.seat]
      const shift = profile ? PROFILES[profile].defendShift : 0
      const defend = Math.min(1, Math.max(0.05, pot / (pot + added) + shift))
      const dead = new Set([...spot.hole, ...spot.board].map(toId))
      const continuing = topOfRange(rangeCombos(opp.read.range, dead), spot.board, defend)
      const eqCalled = estimateEquity({
        hero: spot.hole,
        board: spot.board,
        opponents: [continuing],
        iterations,
        rng,
      }).equity
      const ev = (1 - defend) * pot + defend * (eqCalled * (pot + matched + theirCall) - matched)
      out.push({
        label,
        action,
        ev,
        note: `Assumes they continue ${pct(defend)} of the time${profile && shift !== 0 ? ` (${PROFILES[profile].label.toLowerCase()})` : ''}, and you have ${pct(eqCalled)} equity when they do.`,
      })
    }
  }
  return out
}

/** Index of the option matching an action taken. */
export function chosenOption(evs: OptionEv[], action: Action): number {
  return evs.findIndex((o) => o.action.type === action.type)
}

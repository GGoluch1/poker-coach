import type { Card } from './card'
import { createDeck, shuffle } from './deck'
import type { HandValue } from './hand'
import { evaluateHand } from './hand'
import { awardPots, buildPots } from './pot'
import type { Rng } from './rng'

export type Street = 'preflop' | 'flop' | 'turn' | 'river'

export interface Player {
  name: string
  stack: number
  hole: Card[]
  /** Chips put in on the current street. */
  bet: number
  /** Chips put in over the whole hand. */
  committed: number
  folded: boolean
  allIn: boolean
  /** Has acted since the street began or the last full raise. */
  acted: boolean
  /** False when the player started the hand with no chips. */
  inHand: boolean
}

export type Action =
  | { type: 'fold' }
  | { type: 'check' }
  | { type: 'call' }
  /** Bet or raise; `to` is the player's total bet for the street. */
  | { type: 'raise'; to: number }

export type ActionKind = 'fold' | 'check' | 'call' | 'bet' | 'raise'

export type HandEvent =
  | { type: 'blind'; seat: number; amount: number }
  | { type: 'deal'; street: Street; cards: Card[] }
  | {
      type: 'action'
      seat: number
      street: Street
      action: ActionKind
      /** Chips added by this action. */
      amount: number
      /** Player's street total after the action. */
      to: number
      /** Total pot before the action. */
      pot: number
      toCall: number
      allIn: boolean
    }
  | { type: 'refund'; seat: number; amount: number }
  | { type: 'win'; seat: number; amount: number; potIndex: number; hand: HandValue | null }

export interface GameState {
  players: Player[]
  button: number
  smallBlind: number
  bigBlind: number
  handNumber: number
  deck: Card[]
  board: Card[]
  street: Street
  /** Seat to act, or null when no hand is in progress. */
  toAct: number | null
  /** Highest street bet a player must match. */
  currentBet: number
  /** Smallest legal raise increment. */
  minRaise: number
  events: HandEvent[]
  /** True once the hand has been settled. */
  handOver: boolean
  /** True if the hand went to showdown, so live hands are revealed. */
  showdown: boolean
}

export interface GameConfig {
  names: string[]
  stack: number
  smallBlind: number
  bigBlind: number
}

export interface LegalActions {
  canCheck: boolean
  /** Chips needed to call, capped at the stack; 0 when checking is possible. */
  toCall: number
  /** Raise bounds as street totals, or null when raising isn't allowed. */
  minRaiseTo: number | null
  maxRaiseTo: number | null
}

export function createGame(config: GameConfig): GameState {
  if (config.names.length < 2) throw new Error('need at least two players')
  return {
    players: config.names.map((name) => ({
      name,
      stack: config.stack,
      hole: [],
      bet: 0,
      committed: 0,
      folded: false,
      allIn: false,
      acted: false,
      inHand: false,
    })),
    // The first hand moves the button onto seat 0.
    button: config.names.length - 1,
    smallBlind: config.smallBlind,
    bigBlind: config.bigBlind,
    handNumber: 0,
    deck: [],
    board: [],
    street: 'preflop',
    toAct: null,
    currentBet: 0,
    minRaise: config.bigBlind,
    events: [],
    handOver: true,
    showdown: false,
  }
}

const canAct = (p: Player) => p.inHand && !p.folded && !p.allIn
const isLive = (p: Player) => p.inHand && !p.folded

export function totalPot(s: GameState): number {
  return s.players.reduce((sum, p) => sum + p.committed, 0)
}

export function liveSeats(s: GameState): number[] {
  return s.players.flatMap((p, i) => (isLive(p) ? [i] : []))
}

/** Next seat after `from` (exclusive) that satisfies `pred`, or null. */
export function nextSeat(
  players: Player[],
  from: number,
  pred: (p: Player, seat: number) => boolean,
): number | null {
  const n = players.length
  for (let k = 1; k <= n; k++) {
    const seat = (from + k) % n
    if (pred(players[seat], seat)) return seat
  }
  return null
}

/** Seats of the small and big blind for the current hand. */
export function blindSeats(s: GameState): { sb: number; bb: number } {
  const seated = s.players.filter((p) => p.inHand).length
  const sb = seated === 2 ? s.button : nextSeat(s.players, s.button, (p) => p.inHand)!
  const bb = nextSeat(s.players, sb, (p) => p.inHand)!
  return { sb, bb }
}

export function isGameOver(s: GameState): boolean {
  return s.handOver && s.players.filter((p) => p.stack > 0).length < 2
}

export function startHand(prev: GameState, rng: Rng = Math.random): GameState {
  if (!prev.handOver) throw new Error('hand already in progress')
  const players: Player[] = prev.players.map((p) => ({
    ...p,
    hole: [],
    bet: 0,
    committed: 0,
    folded: p.stack === 0,
    allIn: false,
    acted: false,
    inHand: p.stack > 0,
  }))
  if (players.filter((p) => p.inHand).length < 2) throw new Error('not enough players')

  const s: GameState = {
    ...prev,
    players,
    button: nextSeat(players, prev.button, (p) => p.inHand)!,
    handNumber: prev.handNumber + 1,
    deck: shuffle(createDeck(), rng),
    board: [],
    street: 'preflop',
    toAct: null,
    currentBet: prev.bigBlind,
    minRaise: prev.bigBlind,
    events: [],
    handOver: false,
    showdown: false,
  }

  for (let round = 0; round < 2; round++) {
    for (const p of players) if (p.inHand) p.hole.push(s.deck.pop()!)
  }

  const { sb, bb } = blindSeats(s)
  for (const [seat, blind] of [
    [sb, s.smallBlind],
    [bb, s.bigBlind],
  ]) {
    const amount = putIn(players[seat], blind)
    s.events.push({ type: 'blind', seat, amount })
  }

  s.toAct = nextToAct(s, bb)
  if (s.toAct === null) endStreet(s)
  return s
}

function putIn(p: Player, amount: number): number {
  const paid = Math.min(amount, p.stack)
  p.stack -= paid
  p.bet += paid
  p.committed += paid
  if (p.stack === 0) p.allIn = true
  return paid
}

function needsToAct(s: GameState, seat: number): boolean {
  const p = s.players[seat]
  if (!canAct(p)) return false
  if (p.bet < s.currentBet) return true
  if (p.acted) return false
  // A player who already matches the bet only acts if someone could still respond.
  return s.players.some((q, i) => i !== seat && canAct(q))
}

function nextToAct(s: GameState, from: number): number | null {
  return nextSeat(s.players, from, (_, seat) => needsToAct(s, seat))
}

export function legalActions(s: GameState): LegalActions {
  if (s.toAct === null) throw new Error('no one to act')
  const p = s.players[s.toAct]
  const toCall = Math.min(s.currentBet - p.bet, p.stack)
  const maxTo = p.bet + p.stack
  const othersCanAct = s.players.some((q, i) => i !== s.toAct && canAct(q))
  const canRaise = !p.acted && maxTo > s.currentBet && othersCanAct
  return {
    canCheck: toCall === 0,
    toCall,
    minRaiseTo: canRaise ? Math.min(s.currentBet + s.minRaise, maxTo) : null,
    maxRaiseTo: canRaise ? maxTo : null,
  }
}

export function applyAction(state: GameState, action: Action): GameState {
  if (state.toAct === null) throw new Error('no one to act')
  const s = structuredClone(state)
  const seat = s.toAct!
  const p = s.players[seat]
  const legal = legalActions(s)
  const pot = totalPot(s)
  let kind: ActionKind
  let amount = 0

  switch (action.type) {
    case 'fold':
      p.folded = true
      kind = 'fold'
      break
    case 'check':
      if (!legal.canCheck) throw new Error('cannot check facing a bet')
      kind = 'check'
      break
    case 'call':
      if (legal.toCall === 0) throw new Error('nothing to call')
      amount = putIn(p, legal.toCall)
      kind = 'call'
      break
    case 'raise': {
      const { minRaiseTo, maxRaiseTo } = legal
      if (minRaiseTo === null || maxRaiseTo === null) throw new Error('cannot raise')
      if (!Number.isInteger(action.to) || action.to < minRaiseTo || action.to > maxRaiseTo) {
        throw new Error(`raise must be between ${minRaiseTo} and ${maxRaiseTo}`)
      }
      kind = s.currentBet === 0 ? 'bet' : 'raise'
      amount = putIn(p, action.to - p.bet)
      const increment = action.to - s.currentBet
      if (increment >= s.minRaise) {
        // A full raise reopens the betting for everyone else.
        s.minRaise = increment
        for (const q of s.players) q.acted = false
      }
      s.currentBet = action.to
      break
    }
  }
  p.acted = true
  s.events.push({
    type: 'action',
    seat,
    street: s.street,
    action: kind,
    amount,
    to: p.bet,
    pot,
    toCall: legal.toCall,
    allIn: p.allIn,
  })

  if (liveSeats(s).length === 1) {
    awardUncontested(s)
    return s
  }
  s.toAct = nextToAct(s, seat)
  if (s.toAct === null) endStreet(s)
  return s
}

function refundUncalled(s: GameState) {
  const bets = s.players.map((p) => p.bet)
  const top = Math.max(...bets)
  const seat = bets.indexOf(top)
  const second = Math.max(0, ...bets.filter((_, i) => i !== seat))
  if (top > second) {
    const p = s.players[seat]
    const amount = top - second
    p.stack += amount
    p.bet -= amount
    p.committed -= amount
    p.allIn = false
    s.events.push({ type: 'refund', seat, amount })
  }
}

const NEXT_STREET: Record<Street, Street | null> = {
  preflop: 'flop',
  flop: 'turn',
  turn: 'river',
  river: null,
}

function dealStreet(s: GameState, street: Street) {
  s.deck.pop() // burn
  const count = street === 'flop' ? 3 : 1
  const cards = s.deck.splice(-count).reverse()
  s.board.push(...cards)
  s.street = street
  s.events.push({ type: 'deal', street, cards })
}

function endStreet(s: GameState) {
  refundUncalled(s)
  for (const p of s.players) {
    p.bet = 0
    p.acted = false
  }
  s.currentBet = 0
  s.minRaise = s.bigBlind

  const next = NEXT_STREET[s.street]
  if (next === null) return settleShowdown(s)

  dealStreet(s, next)
  // With at most one player able to bet, run the board out.
  if (s.players.filter(canAct).length < 2) {
    for (let st = NEXT_STREET[next]; st !== null; st = NEXT_STREET[st]) dealStreet(s, st)
    return settleShowdown(s)
  }
  s.toAct = nextToAct(s, s.button)
}

function finish(s: GameState) {
  for (const p of s.players) p.bet = 0
  s.toAct = null
  s.currentBet = 0
  s.handOver = true
}

function awardUncontested(s: GameState) {
  refundUncalled(s)
  const [seat] = liveSeats(s)
  const amount = totalPot(s)
  s.players[seat].stack += amount
  s.events.push({ type: 'win', seat, amount, potIndex: 0, hand: null })
  finish(s)
}

function settleShowdown(s: GameState) {
  const values = s.players.map((p) => (isLive(p) ? evaluateHand([...p.hole, ...s.board]) : null))
  const pots = buildPots(
    s.players.map((p) => p.committed),
    s.players.map((p) => !isLive(p)),
  )
  const shares = awardPots(
    pots,
    values.map((v) => v?.score ?? null),
    s.button,
  )
  for (const share of shares) {
    s.players[share.seat].stack += share.amount
    s.events.push({ type: 'win', ...share, hand: values[share.seat] })
  }
  s.showdown = true
  finish(s)
}

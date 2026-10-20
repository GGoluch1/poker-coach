import { describe, it, expect } from 'vitest'
import { cardToString, parseCards } from './card'
import type { Action, GameState } from './game'
import { applyAction, createGame, isGameOver, legalActions, startHand, totalPot } from './game'
import type { Rng } from './rng'
import { seededRng } from './rng'

const game = (names: string[], stack = 200) =>
  createGame({ names, stack, smallBlind: 1, bigBlind: 2 })

/** Chips on the table; once a hand is settled the pot has been paid into stacks. */
const chips = (s: GameState) =>
  s.players.reduce((sum, p) => sum + p.stack + (s.handOver ? 0 : p.committed), 0)

function play(s: GameState, ...actions: Action[]): GameState {
  for (const a of actions) s = applyAction(s, a)
  return s
}

/** Starts a hand, then stacks the deck so hole cards and board are known. */
function rigged(s: GameState, holes: string[], board: string): GameState {
  s = startHand(s, seededRng(1))
  s.players.forEach((p, i) => (p.hole = parseCards(holes[i])))
  // dealStreet burns one card and then takes cards from the end of the deck.
  const [f1, f2, f3, turn, river] = parseCards(board)
  s.deck = [
    river,
    { rank: 2, suit: 'c' },
    turn,
    { rank: 2, suit: 'c' },
    f3,
    f2,
    f1,
    { rank: 2, suit: 'c' },
  ]
  return s
}

describe('startHand', () => {
  it('posts blinds left of the button and starts action after the big blind', () => {
    const s = startHand(game(['A', 'B', 'C', 'D']), seededRng(1))
    expect(s.button).toBe(0)
    expect(s.players.map((p) => p.bet)).toEqual([0, 1, 2, 0])
    expect(s.toAct).toBe(3)
    expect(totalPot(s)).toBe(3)
    expect(s.players.every((p) => p.hole.length === 2)).toBe(true)
  })

  it('heads-up: the button posts the small blind and acts first preflop, last after', () => {
    let s = startHand(game(['A', 'B']), seededRng(1))
    expect(s.players.map((p) => p.bet)).toEqual([1, 2])
    expect(s.toAct).toBe(0)
    s = play(s, { type: 'call' }, { type: 'check' })
    expect(s.street).toBe('flop')
    expect(s.toAct).toBe(1)
  })

  it('moves the button and skips busted players', () => {
    let s = game(['A', 'B', 'C'])
    s.players[1].stack = 0
    s = startHand(s, seededRng(1))
    expect(s.button).toBe(0)
    expect(s.players[1].inHand).toBe(false)
    expect(s.players[1].hole).toEqual([])
    s = play(s, { type: 'fold' })
    s = startHand(s, seededRng(2))
    expect(s.button).toBe(2)
  })

  it('deals unique cards', () => {
    const s = startHand(game(['A', 'B', 'C', 'D', 'E', 'F']), seededRng(3))
    const cards = [...s.players.flatMap((p) => p.hole), ...s.deck].map(cardToString)
    expect(new Set(cards).size).toBe(52)
  })
})

describe('betting', () => {
  it('gives the big blind an option when everyone limps', () => {
    let s = startHand(game(['A', 'B', 'C']), seededRng(1))
    s = play(s, { type: 'call' }, { type: 'call' })
    expect(s.toAct).toBe(2)
    expect(legalActions(s)).toMatchObject({ canCheck: true, minRaiseTo: 4 })
    s = play(s, { type: 'check' })
    expect(s.street).toBe('flop')
    expect(s.board).toHaveLength(3)
    expect(s.toAct).toBe(1)
  })

  it('enforces the minimum raise', () => {
    let s = startHand(game(['A', 'B', 'C']), seededRng(1))
    expect(legalActions(s)).toMatchObject({ minRaiseTo: 4, maxRaiseTo: 200 })
    expect(() => applyAction(s, { type: 'raise', to: 3 })).toThrow()
    s = play(s, { type: 'raise', to: 7 })
    expect(legalActions(s).minRaiseTo).toBe(12)
  })

  it('a short all-in raise does not reopen betting', () => {
    let s = game(['A', 'B', 'C'])
    s.players[2].stack = 15
    s = startHand(s, seededRng(1))
    // A raises to 10, B calls, C (big blind) shoves 15: only 5 more, less than a full raise.
    s = play(s, { type: 'raise', to: 10 }, { type: 'call' }, { type: 'raise', to: 15 })
    expect(s.toAct).toBe(0)
    expect(legalActions(s)).toMatchObject({ toCall: 5, minRaiseTo: null })
    s = play(s, { type: 'call' })
    expect(legalActions(s).minRaiseTo).toBeNull()
  })

  it('a full raise reopens betting', () => {
    let s = startHand(game(['A', 'B', 'C']), seededRng(1))
    s = play(s, { type: 'raise', to: 6 }, { type: 'call' }, { type: 'raise', to: 20 })
    expect(s.toAct).toBe(0)
    expect(legalActions(s).minRaiseTo).toBe(34)
  })

  it('awards the pot when everyone folds and returns the uncalled bet', () => {
    let s = startHand(game(['A', 'B', 'C']), seededRng(1))
    s = play(s, { type: 'raise', to: 6 }, { type: 'fold' }, { type: 'fold' })
    expect(s.handOver).toBe(true)
    expect(s.showdown).toBe(false)
    expect(s.players.map((p) => p.stack)).toEqual([203, 199, 198])
  })

  it('rejects actions after the hand is over', () => {
    let s = startHand(game(['A', 'B']), seededRng(1))
    s = play(s, { type: 'fold' })
    expect(() => applyAction(s, { type: 'check' })).toThrow()
  })
})

describe('showdown', () => {
  it('pays the best hand', () => {
    let s = rigged(game(['A', 'B', 'C']), ['As Ad', 'Ks Kd', '7c 2h'], 'Ah 9c 4d 3s Jh')
    s = play(s, { type: 'call' }, { type: 'call' }, { type: 'check' })
    for (let i = 0; i < 9; i++) s = applyAction(s, { type: 'check' })
    expect(s.handOver).toBe(true)
    expect(s.showdown).toBe(true)
    expect(s.players.map((p) => p.stack)).toEqual([204, 198, 198])
    expect(s.events.at(-1)).toMatchObject({ type: 'win', seat: 0, amount: 6 })
  })

  it('runs out the board and builds side pots when players are all in', () => {
    let s = game(['A', 'B', 'C'])
    s.players[0].stack = 50
    s.players[1].stack = 100
    s = rigged(s, ['As Ad', 'Ks Kd', 'Qs Qd'], '2h 7c 9d Th 3s')
    s = play(s, { type: 'raise', to: 50 }, { type: 'raise', to: 100 }, { type: 'call' })
    expect(s.handOver).toBe(true)
    expect(s.board).toHaveLength(5)
    // A wins the 150 main pot, B wins the 100 side pot, C keeps the uncalled 100.
    expect(s.players.map((p) => p.stack)).toEqual([150, 100, 100])
  })

  it('splits a chopped pot', () => {
    let s = rigged(game(['A', 'B']), ['2c 3d', '2d 3c'], 'As Ks Qs Js Ts')
    s = play(s, { type: 'call' }, { type: 'check' })
    for (let i = 0; i < 6; i++) s = applyAction(s, { type: 'check' })
    expect(s.players.map((p) => p.stack)).toEqual([200, 200])
  })
})

describe('random play', () => {
  function randomAction(s: GameState, rng: Rng): Action {
    const legal = legalActions(s)
    const r = rng()
    if (legal.minRaiseTo !== null && r < 0.25) {
      const span = legal.maxRaiseTo! - legal.minRaiseTo
      return {
        type: 'raise',
        to: legal.minRaiseTo + Math.floor(rng() * (span + 1) * (rng() < 0.2 ? 1 : 0.2)),
      }
    }
    if (legal.canCheck) return { type: 'check' }
    return r < 0.75 ? { type: 'call' } : { type: 'fold' }
  }

  it('conserves chips and always finishes hands', () => {
    const rng = seededRng(42)
    for (let g = 0; g < 30; g++) {
      let s = game(['A', 'B', 'C', 'D', 'E', 'F'].slice(0, 2 + (g % 5)), 100)
      const total = chips(s)
      for (let h = 0; h < 200 && !isGameOver(s); h++) {
        s = startHand(s, rng)
        for (let steps = 0; !s.handOver; steps++) {
          expect(steps).toBeLessThan(200)
          s = applyAction(s, randomAction(s, rng))
          expect(chips(s)).toBe(total)
        }
        expect(s.players.every((p) => p.stack >= 0 && p.committed >= 0)).toBe(true)
      }
    }
  })
})

import { describe, it, expect } from 'vitest'
import type { Spot } from './analysis'
import { analyzeSpot, readPreflop } from './analysis'
import { parseCards } from './card'
import { applyAction, createGame, startHand } from './game'
import { describeEvents, netResult } from './history'
import { RAISE_RANGE } from './range'
import { reviewDecision } from './review'
import { seededRng } from './rng'

const names = ['You', 'Bot 1', 'Bot 2', 'Bot 3', 'Bot 4', 'Bot 5']
const sixMax = () => createGame({ names, stack: 200, smallBlind: 1, bigBlind: 2 })

function spot(overrides: Partial<Spot>): Spot {
  return {
    seat: 0,
    street: 'flop',
    position: 'BTN',
    hole: parseCards('As Kd'),
    board: parseCards('7c 8d 2h'),
    handClass: 'AKo',
    pot: 100,
    toCall: 50,
    requiredEquity: 50 / 150,
    opponents: [],
    equity: { win: 0.5, tie: 0, equity: 0.5 },
    equityNote: '',
    unopened: false,
    openAdvice: null,
    made: null,
    outs: [],
    ...overrides,
  }
}

describe('readPreflop', () => {
  it('reads raisers as a tighter range than callers', () => {
    let s = startHand(sixMax(), seededRng(1))
    // Seat 3 (UTG) raises, seat 4 calls.
    s = applyAction(s, { type: 'raise', to: 6 })
    s = applyAction(s, { type: 'call' })
    expect(readPreflop(s.events, 3, 2).range).toBe(RAISE_RANGE)
    expect(readPreflop(s.events, 4, 2).label).toMatch(/called a raise/)
    expect(readPreflop(s.events, 0, 2).range).toBeNull()
  })
})

describe('analyzeSpot', () => {
  it('reports pot odds, position and chart advice', () => {
    const s = startHand(sixMax(), seededRng(1))
    s.players[3].hole = parseCards('As Ah')
    const result = analyzeSpot(s, 3, { iterations: 300, rng: seededRng(2) })
    expect(result.position).toBe('UTG')
    expect(result.handClass).toBe('AA')
    expect(result.toCall).toBe(2)
    expect(result.requiredEquity).toBeCloseTo(2 / 5)
    expect(result.openAdvice).toBe('raise')
    // No one has entered the pot yet, so equity is against one random hand.
    expect(result.opponents).toHaveLength(0)
    expect(result.equity!.equity).toBeGreaterThan(0.75)
  })

  it('measures preflop equity only against players who entered the pot', () => {
    let s = startHand(sixMax(), seededRng(1))
    s = applyAction(s, { type: 'raise', to: 6 }) // UTG
    s = applyAction(s, { type: 'fold' }) // HJ
    s = applyAction(s, { type: 'fold' }) // CO
    const result = analyzeSpot(s, 0, { iterations: 100, rng: seededRng(2) })
    expect(result.opponents.map((o) => o.seat)).toEqual([3])
    expect(result.equityNote).toBe("vs your opponent's likely range")
  })
})

describe('reviewDecision', () => {
  it('flags folding a hand from the opening range', () => {
    const r = reviewDecision(
      spot({
        street: 'preflop',
        handClass: 'AQs',
        position: 'CO',
        unopened: true,
        openAdvice: 'raise',
      }),
      { type: 'fold' },
    )
    expect(r.verdict).toBe('blunder')
  })

  it('approves folding junk out of position', () => {
    const r = reviewDecision(
      spot({
        street: 'preflop',
        handClass: '72o',
        position: 'UTG',
        unopened: true,
        openAdvice: 'fold',
      }),
      { type: 'fold' },
    )
    expect(r.verdict).toBe('good')
  })

  it('flags folding with plenty of equity', () => {
    const r = reviewDecision(spot({ equity: { win: 0.6, tie: 0, equity: 0.6 } }), { type: 'fold' })
    expect(r.verdict).toBe('blunder')
    expect(r.message).toMatch(/60%.*33%/)
  })

  it('flags calling without the odds', () => {
    const r = reviewDecision(spot({ equity: { win: 0.15, tie: 0, equity: 0.15 } }), {
      type: 'call',
    })
    expect(r.verdict).toBe('mistake')
  })

  it('treats a thin call on a big draw as OK', () => {
    const r = reviewDecision(
      spot({
        equity: { win: 0.25, tie: 0, equity: 0.25 },
        outs: [{ category: 'Flush', cards: parseCards('2s 3s 4s 5s 6s 8s 9s Ts Js') }],
      }),
      { type: 'call' },
    )
    expect(r.verdict).toBe('ok')
  })

  it('flags folding when checking is free', () => {
    expect(reviewDecision(spot({ toCall: 0 }), { type: 'fold' }).verdict).toBe('blunder')
  })

  it('flags missed river value', () => {
    const r = reviewDecision(
      spot({ street: 'river', toCall: 0, equity: { win: 0.9, tie: 0, equity: 0.9 } }),
      { type: 'check' },
    )
    expect(r.verdict).toBe('mistake')
  })
})

describe('history', () => {
  it('describes a hand and nets the result', () => {
    let s = startHand(
      createGame({ names: ['Hero', 'Bot'], stack: 100, smallBlind: 1, bigBlind: 2 }),
      seededRng(1),
    )
    s = applyAction(s, { type: 'raise', to: 6 })
    s = applyAction(s, { type: 'fold' })
    expect(describeEvents(s)).toEqual([
      'Hero posts small blind 1',
      'Bot posts big blind 2',
      'Hero raises to 6',
      'Bot folds',
      'Uncalled 4 returned to Hero',
      'Hero wins 4',
    ])
    expect(netResult(s, 0)).toBe(2)
    expect(netResult(s, 1)).toBe(-2)
  })
})

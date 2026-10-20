import { describe, it, expect } from 'vitest'
import { parseCards } from './card'
import type { DrillItem } from './drills'
import { drillKey, generateDrill, gradeDrill, handItem } from './drills'
import { findOuts } from './equity'
import { applyAction, createGame, startHand } from './game'
import { generateSpot } from './generate'
import { seededRng } from './rng'
import { BOX_INTERVALS, addMiss, dueCards, recordAnswer } from './srs'
import { EMPTY_STATS, addStats, handStats, statLines } from './stats'

describe('drills', () => {
  it('generates every kind of drill', () => {
    const rng = seededRng(5)
    for (const kind of ['outs', 'preflop', 'texture', 'callfold'] as const) {
      const item = generateDrill(kind, rng)
      expect(item.kind).toBe(kind)
      expect(drillKey(item)).toMatch(new RegExp(`^${kind}:`))
    }
  })

  it('grades outs exactly and teaches the rule of 2 and 4', () => {
    const item: DrillItem = {
      kind: 'outs',
      hole: parseCards('Ah Kh'),
      board: parseCards('7h 2h 9c'),
    }
    const right = gradeDrill(item, { kind: 'outs', outs: 15 })
    expect(right.correct).toBe(true)
    expect(right.details.some((d) => d.startsWith('By the river: rule of 4 says ~60%'))).toBe(true)
    expect(gradeDrill(item, { kind: 'outs', outs: 9 }).correct).toBe(false)
  })

  it('grades preflop opens against the chart', () => {
    const item: DrillItem = { kind: 'preflop', chartId: 'open-UTG', handClass: 'AKo' }
    expect(gradeDrill(item, { kind: 'preflop', action: 'raise' }).correct).toBe(true)
    expect(gradeDrill(item, { kind: 'preflop', action: 'fold' }).correct).toBe(false)
  })

  it('grades all three texture parts', () => {
    const item: DrillItem = { kind: 'texture', board: parseCards('9h 8h 7h') }
    const right = {
      kind: 'texture',
      suits: 'monotone',
      connectedness: 'connected',
      wetness: 'wet',
    } as const
    expect(gradeDrill(item, right).correct).toBe(true)
    expect(gradeDrill(item, { ...right, wetness: 'dry' }).correct).toBe(false)
  })

  it('grades call-or-fold by pot odds, accepting either in close spots', () => {
    const base = {
      kind: 'callfold' as const,
      situation: [],
      hole: parseCards('Ah Kh'),
      board: parseCards('7h 2h 9c'),
      pot: 30,
      toCall: 10,
      need: 0.25,
      equityNote: '',
      reads: [],
    }
    expect(gradeDrill({ ...base, equity: 0.4 }, { kind: 'callfold', action: 'call' }).correct).toBe(
      true,
    )
    expect(gradeDrill({ ...base, equity: 0.1 }, { kind: 'callfold', action: 'call' }).correct).toBe(
      false,
    )
    expect(
      gradeDrill({ ...base, equity: 0.26 }, { kind: 'callfold', action: 'fold' }).correct,
    ).toBe(true)
  })

  it('turns a past decision into a graded replay', () => {
    const s = generateSpot({ street: 'turn', facingBet: true, rng: seededRng(2) })
    const item = handItem(s, 0, 'Hand #3', seededRng(1))
    if (item.kind !== 'hand') throw new Error('expected a hand item')
    expect(item.options.map((o) => o.label.split(' ')[0])).toEqual(
      expect.arrayContaining(['Fold', 'Call']),
    )
    expect(item.situation.length).toBeGreaterThan(2)
    const grade = gradeDrill(item, { kind: 'hand', option: 0 })
    expect(grade.details).toHaveLength(item.options.length)
  })
})

describe('srs', () => {
  it('moves cards up on a correct answer and back to box 0 on a miss', () => {
    let deck = addMiss([], 'q1', 'item', 0)
    expect(deck[0]).toMatchObject({ box: 0, due: BOX_INTERVALS[0] })
    expect(dueCards(deck, 0)).toHaveLength(0)
    expect(dueCards(deck, BOX_INTERVALS[0])).toHaveLength(1)

    deck = recordAnswer(deck, 'q1', true, 1000)
    expect(deck[0]).toMatchObject({ box: 1, due: 1000 + BOX_INTERVALS[1] })
    deck = recordAnswer(deck, 'q1', false, 2000)
    expect(deck[0]).toMatchObject({ box: 0, lapses: 1 })
  })

  it('retires a card after the last box and does not duplicate misses', () => {
    let deck = addMiss([], 'q', 1, 0)
    deck = addMiss(deck, 'q', 1, 10)
    expect(deck).toHaveLength(1)
    for (let i = 0; i < BOX_INTERVALS.length; i++) deck = recordAnswer(deck, 'q', true, i)
    expect(deck).toHaveLength(0)
  })
})

describe('stats', () => {
  const sixMax = () =>
    createGame({ names: ['Hero', 'A', 'B', 'C', 'D', 'E'], stack: 200, smallBlind: 1, bigBlind: 2 })

  it('counts VPIP, PFR and 3-bet chances', () => {
    let s = startHand(sixMax(), seededRng(1))
    // Hero is seat 0 on the button. UTG raises and it folds to the hero.
    s = applyAction(s, { type: 'raise', to: 6 })
    s = applyAction(s, { type: 'fold' })
    s = applyAction(s, { type: 'fold' })
    s = applyAction(s, { type: 'raise', to: 18 }) // hero 3-bets
    while (!s.handOver) s = applyAction(s, { type: 'fold' })
    const st = handStats(s, 0)
    expect(st).toMatchObject({
      hands: 1,
      vpip: 1,
      pfr: 1,
      threeBetChances: 1,
      threeBets: 1,
      sawFlop: 0,
    })
    expect(st.bigBlinds).toBeGreaterThan(0)
  })

  it('detects folding to a continuation bet', () => {
    let s = startHand(sixMax(), seededRng(1))
    s = applyAction(s, { type: 'raise', to: 6 }) // UTG
    s = applyAction(s, { type: 'fold' })
    s = applyAction(s, { type: 'fold' })
    s = applyAction(s, { type: 'call' }) // hero
    s = applyAction(s, { type: 'fold' })
    s = applyAction(s, { type: 'fold' })
    s = applyAction(s, { type: 'raise', to: 8 }) // UTG c-bets the flop
    s = applyAction(s, { type: 'fold' }) // hero folds
    const st = handStats(s, 0)
    expect(st).toMatchObject({ sawFlop: 1, foldToCbetChances: 1, foldsToCbet: 1, pfr: 0 })
  })

  it('adds up and reports percentages against targets', () => {
    const total = addStats(addStats(EMPTY_STATS, { ...EMPTY_STATS, hands: 1, vpip: 1 }), {
      ...EMPTY_STATS,
      hands: 1,
    })
    const vpip = statLines(total).find((l) => l.label === 'VPIP')!
    expect(vpip.value).toBe(0.5)
    expect(statLines(EMPTY_STATS)[0].value).toBeNull()
  })
})

describe('outs drill items', () => {
  it('always include a straight or flush draw', () => {
    const rng = seededRng(21)
    for (let i = 0; i < 40; i++) {
      const item = generateDrill('outs', rng)
      if (item.kind !== 'outs') throw new Error('expected outs')
      const cats = findOuts(item.hole, item.board).map((g) => g.category)
      expect(cats.some((c) => c === 'Straight' || c === 'Flush')).toBe(true)
    }
  })
})

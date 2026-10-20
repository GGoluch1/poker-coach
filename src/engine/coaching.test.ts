import { describe, it, expect } from 'vitest'
import { analyzeSpot, readPreflop } from './analysis'
import { chooseBotAction } from './bot'
import { parseCards } from './card'
import { PREFLOP_CHARTS, chartAction, findPreflopChart, getChart, vsOpenChartId } from './charts'
import type { DrillItem } from './drills'
import {
  SET_ON_FLOP,
  generateDrill,
  gradeDrill,
  mdfAnswer,
  remainingCombos,
  setMineEv,
} from './drills'
import { optionEvs, topOfRange } from './ev'
import type { GameState } from './game'
import { applyAction, createGame, isGameOver, legalActions, startHand } from './game'
import { generateSpot } from './generate'
import type { Personality } from './profiles'
import type { Position } from './range'
import { combos, positions, rangeFraction } from './range'
import { reviewDecision } from './review'
import { seededRng } from './rng'
import { EMPTY_STATS, addStats, handStats } from './stats'

const sixMax = () =>
  createGame({ names: ['Hero', 'A', 'B', 'C', 'D', 'E'], stack: 200, smallBlind: 1, bigBlind: 2 })

describe('preflop charts', () => {
  it('has a chart for every open a later position can face', () => {
    const order: Position[] = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']
    for (let v = 0; v < order.length - 1; v++) {
      for (let h = v + 1; h < order.length; h++) {
        expect(vsOpenChartId(order[h], order[v]), `${order[h]} vs ${order[v]}`).not.toBeNull()
      }
    }
  })

  it('keeps ranges sensible', () => {
    for (const c of PREFLOP_CHARTS) {
      expect(c.raise.size, c.id).toBeGreaterThan(0)
      expect(rangeFraction(c.raise) + rangeFraction(c.call), c.id).toBeLessThan(0.75)
      expect(chartAction(c, 'AA'), c.id).toBe('raise')
      expect(chartAction(c, '72o'), c.id).toBe('fold')
    }
  })

  it('finds the chart for opens, defending and facing a 3-bet', () => {
    let s = startHand(sixMax(), seededRng(1))
    const pos = positions(
      s.players.map((p) => p.inHand),
      s.button,
    )
    // Seat 3 is UTG and acts first.
    expect(findPreflopChart(s.events, 3, pos)?.id).toBe('open-UTG')
    s = applyAction(s, { type: 'raise', to: 5 })
    expect(findPreflopChart(s.events, 0, pos)?.id).toBe('vsopen-BTN-early')
    expect(findPreflopChart(s.events, 2, pos)?.id).toBe('vsopen-BB-early')
    s = applyAction(s, { type: 'fold' })
    s = applyAction(s, { type: 'fold' })
    s = applyAction(s, { type: 'raise', to: 15 }) // hero 3-bets from the button
    s = applyAction(s, { type: 'fold' })
    s = applyAction(s, { type: 'fold' })
    expect(s.toAct).toBe(3)
    expect(findPreflopChart(s.events, 3, pos)?.id).toBe('vs3bet-oop')
  })

  it('grades defending decisions against the chart', () => {
    let s = startHand(sixMax(), seededRng(1))
    s = applyAction(s, { type: 'raise', to: 5 })
    s = applyAction(s, { type: 'fold' })
    s = applyAction(s, { type: 'fold' })
    s.players[0].hole = parseCards('7c 2d')
    const junk = analyzeSpot(s, 0, { iterations: 200, rng: seededRng(1) })
    expect(junk.chart?.action).toBe('fold')
    expect(reviewDecision(junk, { type: 'call' })).toMatchObject({
      verdict: 'mistake',
      category: 'Defended too wide',
      basis: 'chart',
    })
    s.players[0].hole = parseCards('Ac Ad')
    const aces = analyzeSpot(s, 0, { iterations: 200, rng: seededRng(1) })
    expect(reviewDecision(aces, { type: 'fold' }).verdict).toBe('blunder')
    expect(reviewDecision(aces, { type: 'call' }).category).toBe('Missed a 3-bet')
  })
})

describe('bot personalities', () => {
  function playMany(lineup: Personality[], hands: number, seed: number) {
    const rng = seededRng(seed)
    let s: GameState = createGame({
      names: lineup.map((p) => p),
      stack: 400,
      smallBlind: 1,
      bigBlind: 2,
    })
    let stats = lineup.map(() => EMPTY_STATS)
    for (let h = 0; h < hands; h++) {
      if (isGameOver(s)) {
        // Rebuy everyone so the sample keeps all personalities.
        for (const p of s.players) p.stack = 400
      }
      for (const p of s.players) if (p.stack < 100) p.stack = 400
      s = startHand(s, rng)
      while (!s.handOver) s = applyAction(s, chooseBotAction(s, rng, lineup[s.toAct!], lineup))
      stats = stats.map((st, i) => addStats(st, handStats(s, i)))
    }
    return stats
  }

  it('play recognizably different styles', () => {
    const lineup: Personality[] = ['nit', 'balanced', 'maniac', 'station', 'balanced', 'nit']
    const stats = playMany(lineup, 250, 3)
    const vpip = stats.map((s) => s.vpip / s.hands)
    const pfr = stats.map((s) => s.pfr / s.hands)
    expect(vpip[0]).toBeLessThan(vpip[1])
    expect(vpip[1]).toBeLessThan(vpip[2])
    expect(vpip[3]).toBeGreaterThan(vpip[1])
    expect(pfr[3]).toBeLessThan(pfr[1])
    expect(pfr[2]).toBeGreaterThan(pfr[1])
  })

  it('reads a maniac raise as much wider than a nit raise', () => {
    let s = startHand(sixMax(), seededRng(1))
    s = applyAction(s, { type: 'raise', to: 5 })
    const nit = readPreflop(s.events, 3, 2, 'nit')
    const maniac = readPreflop(s.events, 3, 2, 'maniac')
    const balanced = readPreflop(s.events, 3, 2, 'balanced', 'UTG')
    expect(rangeFraction(nit.range!)).toBeLessThan(rangeFraction(balanced.range!))
    expect(rangeFraction(maniac.range!)).toBeGreaterThan(rangeFraction(balanced.range!))
    expect(maniac.label).toMatch(/maniac/)
  })
})

describe('option EVs', () => {
  it('values fold at zero and calls by showdown equity', () => {
    const s = generateSpot({ street: 'turn', facingBet: true, players: 2, rng: seededRng(9) })
    const spot = analyzeSpot(s, 0, { iterations: 500, rng: seededRng(1) })
    const evs = optionEvs(s, 0, spot, null, { iterations: 300, rng: seededRng(2) })
    expect(evs[0]).toMatchObject({ label: 'Fold', ev: 0 })
    const call = evs.find((o) => o.action.type === 'call')!
    const eq = spot.equity!.equity
    expect(call.ev).toBeCloseTo(eq * (spot.pot + spot.toCall) - spot.toCall, 6)
    if (legalActions(s).minRaiseTo !== null) {
      const raise = evs.find((o) => o.action.type === 'raise')!
      expect(raise.ev).not.toBeNull()
      expect(raise.note).toMatch(/continue \d+%/)
    }
  })

  it('assumes calling stations continue more often', () => {
    const s = generateSpot({ street: 'river', facingBet: false, players: 2, rng: seededRng(4) })
    const spot = analyzeSpot(s, 0, { iterations: 300, rng: seededRng(1) })
    const villain = spot.opponents[0].seat
    const profiles: (Personality | undefined)[] = []
    const note = (p: Personality) => {
      profiles[villain] = p
      return optionEvs(s, 0, spot, null, { iterations: 100, rng: seededRng(1), profiles }).find(
        (o) => o.action.type === 'raise',
      )!.note
    }
    const continues = (text: string) => Number(/continue (\d+)%/.exec(text)![1])
    expect(continues(note('station'))).toBeGreaterThan(continues(note('balanced')))
    expect(continues(note('nit'))).toBeLessThan(continues(note('balanced')))
  })

  it('keeps the strongest hands when narrowing a range', () => {
    const board = parseCards('Ks 7d 2c')
    const list = [...combos('KQs'), ...combos('77'), ...combos('54s')]
    const top = topOfRange(list, board, 0.3)
    expect(top.every(([a]) => a.rank === 7)).toBe(true)
  })

  it('skips EVs where the chart decides (unopened pots)', () => {
    const s = startHand(sixMax(), seededRng(1))
    const spot = analyzeSpot(s, 3, { iterations: 100, rng: seededRng(1) })
    const evs = optionEvs(s, 3, spot, null, { iterations: 100 })
    expect(evs.filter((o) => o.action.type !== 'fold').every((o) => o.ev === null)).toBe(true)
  })
})

describe('math drills', () => {
  it('computes MDF, bluff break-even and pot odds', () => {
    expect(mdfAnswer({ kind: 'mdf', pot: 100, bet: 50, question: 'mdf' })).toBeCloseTo(2 / 3)
    expect(mdfAnswer({ kind: 'mdf', pot: 100, bet: 100, question: 'bluff' })).toBeCloseTo(0.5)
    expect(mdfAnswer({ kind: 'mdf', pot: 100, bet: 100, question: 'potodds' })).toBeCloseTo(1 / 3)
    const item: DrillItem = { kind: 'mdf', pot: 100, bet: 50, question: 'mdf' }
    expect(gradeDrill(item, { kind: 'mdf', percent: 65 }).correct).toBe(true)
    expect(gradeDrill(item, { kind: 'mdf', percent: 50 }).correct).toBe(false)
  })

  it('counts combos with blockers', () => {
    const base = {
      kind: 'combos' as const,
      hole: parseCards('Ah Kd'),
      board: parseCards('Ks 7c 2d'),
    }
    expect(remainingCombos({ ...base, target: 'AK' })).toBe(6)
    expect(remainingCombos({ ...base, target: 'AKs' })).toBe(1)
    expect(remainingCombos({ ...base, target: 'AKo' })).toBe(5)
    expect(remainingCombos({ ...base, target: 'KK' })).toBe(1)
    expect(remainingCombos({ ...base, target: 'QQ' })).toBe(6)
    expect(gradeDrill({ ...base, target: 'AK' }, { kind: 'combos', count: 6 }).correct).toBe(true)
  })

  it('works out set-mining EV', () => {
    expect(SET_ON_FLOP).toBeCloseTo(0.1176, 3)
    const item = { kind: 'setmine' as const, pair: '55', raiseTo: 3, stack: 100, winShare: 0.25 }
    expect(setMineEv(item).ev).toBeCloseTo(0.732, 2)
    expect(gradeDrill(item, { kind: 'setmine', action: 'call' }).correct).toBe(true)
    const shallow = { ...item, stack: 15 }
    expect(setMineEv(shallow).ev).toBeLessThan(0)
    expect(gradeDrill(shallow, { kind: 'setmine', action: 'call' }).correct).toBe(false)
  })

  it('generates every new kind and grades chart-based preflop items', () => {
    const rng = seededRng(12)
    for (const kind of ['mdf', 'combos', 'setmine', 'preflop'] as const) {
      expect(generateDrill(kind, rng).kind).toBe(kind)
    }
    const item: DrillItem = { kind: 'preflop', chartId: 'vsopen-BB-late', handClass: 'KTo' }
    expect(getChart('vsopen-BB-late').call.has('KTo')).toBe(true)
    expect(gradeDrill(item, { kind: 'preflop', action: 'call' }).correct).toBe(true)
    expect(gradeDrill(item, { kind: 'preflop', action: 'fold' }).correct).toBe(false)
    // Items saved before charts had ids still grade.
    const legacy = { kind: 'preflop', handClass: 'AKo', position: 'UTG' } as unknown as DrillItem
    expect(gradeDrill(legacy, { kind: 'preflop', action: 'raise' }).correct).toBe(true)
  })
})

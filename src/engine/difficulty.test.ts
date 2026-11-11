import { describe, expect, it } from 'vitest'
import { getChart } from './charts'
import type { Difficulty, DrillItem, GeneratedKind } from './drills'
import { DIFFICULTIES, generateDrill, mdfItem, setMineEv } from './drills'
import { findOuts } from './equity'
import { seededRng } from './rng'
import { describeBoard } from './texture'

type Item<K extends DrillItem['kind']> = Extract<DrillItem, { kind: K }>

function deal<K extends GeneratedKind>(kind: K, difficulty: Difficulty, count: number, seed = 7) {
  const rng = seededRng(seed)
  return Array.from({ length: count }, () => generateDrill(kind, rng, difficulty) as Item<K>)
}

describe('drill difficulty', () => {
  it('leaves medium exactly as before, so saved seeds and tests still match', () => {
    const kinds: GeneratedKind[] = ['outs', 'preflop', 'texture', 'mdf', 'combos', 'setmine']
    for (const kind of kinds) {
      expect(generateDrill(kind, seededRng(3), 'medium')).toEqual(generateDrill(kind, seededRng(3)))
    }
  })

  it('outs: easy is one draw on the flop, hard has three or more ways to improve', () => {
    for (const item of deal('outs', 'easy', 30)) {
      const groups = findOuts(item.hole, item.board)
      expect(item.board).toHaveLength(3)
      expect(groups.length).toBeLessThanOrEqual(2)
      expect(groups.reduce((n, g) => n + g.cards.length, 0)).toBeLessThanOrEqual(15)
    }
    for (const item of deal('outs', 'hard', 30)) {
      expect(findOuts(item.hole, item.board).length).toBeGreaterThanOrEqual(3)
    }
  })

  it('preflop: easy is opening charts only, hard never is', () => {
    for (const item of deal('preflop', 'easy', 40)) {
      expect(getChart(item.chartId).situation).toBe('open')
    }
    for (const item of deal('preflop', 'hard', 40)) {
      expect(getChart(item.chartId).situation).not.toBe('open')
    }
  })

  it('texture: easy boards are mostly clear-cut, hard ones mostly borderline', () => {
    const borderline = (item: Item<'texture'>) => {
      const t = describeBoard(item.board)
      return [t.suits, t.connectedness, t.wetness].filter((x) =>
        ['two-tone', 'semi-connected', 'semi-wet'].includes(x),
      ).length
    }
    for (const item of deal('texture', 'easy', 40)) expect(borderline(item)).toBeLessThanOrEqual(1)
    for (const item of deal('texture', 'hard', 40)) {
      expect(borderline(item)).toBeGreaterThanOrEqual(2)
    }
  })

  it('call or fold: easy spots are clear, hard ones close but not a toss-up', () => {
    const gaps = (d: Difficulty) =>
      deal('callfold', d, 6).map((item) => Math.abs(item.equity - item.need))
    // Generation gives up after a few tries, so check most spots rather than every one.
    expect(gaps('easy').filter((g) => g >= 0.15).length).toBeGreaterThanOrEqual(5)
    expect(gaps('hard').filter((g) => g >= 0.03 && g <= 0.08).length).toBeGreaterThanOrEqual(5)
  })

  it('math: easy uses half-pot and pot bets, hard uses odd sizes', () => {
    for (const item of deal('mdf', 'easy', 30)) {
      expect([0.5, 1]).toContain(item.bet / item.pot)
      expect(item.pot % 10).toBe(0)
    }
    const rng = seededRng(9)
    for (let i = 0; i < 30; i++) {
      const item = mdfItem(rng, 'hard') as Item<'mdf'>
      expect([0.5, 1, 2]).not.toContain(item.bet / item.pot)
    }
  })

  it('combos: easy is a flop with no suit split, hard has more cards and blocked ranks', () => {
    for (const item of deal('combos', 'easy', 30)) {
      expect(item.board).toHaveLength(3)
      expect(item.target).toMatch(/^[2-9TJQKA]{2}$/)
    }
    for (const item of deal('combos', 'hard', 30)) {
      expect(item.board.length).toBeGreaterThanOrEqual(4)
      const seen = new Set([...item.hole, ...item.board].map((c) => '23456789TJQKA'[c.rank - 2]))
      expect(seen.has(item.target[0]) && seen.has(item.target[1])).toBe(true)
    }
  })

  it('set mining: easy is at least 2 bb either way, hard within a bb of break-even', () => {
    for (const item of deal('setmine', 'easy', 30)) {
      expect(Math.abs(setMineEv(item).ev)).toBeGreaterThanOrEqual(2)
    }
    for (const item of deal('setmine', 'hard', 30)) {
      const ev = Math.abs(setMineEv(item).ev)
      expect(ev).toBeGreaterThanOrEqual(0.2)
      expect(ev).toBeLessThanOrEqual(1)
    }
  })

  it('every level deals every drill', () => {
    const kinds: GeneratedKind[] = ['outs', 'preflop', 'texture', 'mdf', 'combos', 'setmine']
    for (const d of DIFFICULTIES)
      for (const kind of kinds) expect(deal(kind, d, 3)[2].kind).toBe(kind)
  })
})

import { describe, it, expect } from 'vitest'
import { parseCards } from './card'
import {
  ALL_CLASSES,
  CLASSES_BY_STRENGTH,
  OPEN_RANGES,
  chenScore,
  comboCount,
  combos,
  gridClass,
  handClass,
  parseRange,
  positions,
  rangeFraction,
  topRange,
} from './range'

describe('hand classes', () => {
  it('names pairs, suited and offsuit hands', () => {
    const [a, b, c, d] = parseCards('Ks Ah 9h 9d')
    expect(handClass(a, b)).toBe('AKo')
    expect(handClass(b, c)).toBe('A9s')
    expect(handClass(c, d)).toBe('99')
  })

  it('lays out a 13x13 grid covering all 1326 combos', () => {
    expect(ALL_CLASSES).toHaveLength(169)
    expect(new Set(ALL_CLASSES).size).toBe(169)
    expect(gridClass(0, 0)).toBe('AA')
    expect(gridClass(0, 1)).toBe('AKs')
    expect(gridClass(1, 0)).toBe('AKo')
    expect(ALL_CLASSES.reduce((n, c) => n + comboCount(c), 0)).toBe(1326)
  })

  it('expands classes to combos', () => {
    expect(combos('AA')).toHaveLength(6)
    expect(combos('AKs')).toHaveLength(4)
    expect(combos('AKo')).toHaveLength(12)
    for (const [x, y] of combos('T9o')) expect(handClass(x, y)).toBe('T9o')
  })
})

describe('parseRange', () => {
  it('parses plus, dash and single notation', () => {
    expect([...parseRange('TT+')]).toEqual(['TT', 'JJ', 'QQ', 'KK', 'AA'])
    expect([...parseRange('77-99')]).toEqual(['77', '88', '99'])
    expect([...parseRange('KTs+')]).toEqual(['KTs', 'KJs', 'KQs'])
    expect([...parseRange('A5s-A2s')]).toEqual(['A2s', 'A3s', 'A4s', 'A5s'])
    expect([...parseRange('QJo, t9s')]).toEqual(['QJo', 'T9s'])
    expect([...parseRange('AQ+')]).toEqual(['AQs', 'AQo', 'AKs', 'AKo'])
  })

  it('rejects bad notation', () => {
    expect(() => parseRange('KAs')).toThrow()
    expect(() => parseRange('X2s')).toThrow()
  })
})

describe('strength', () => {
  it('scores hands with the Chen formula', () => {
    expect(chenScore('AA')).toBe(20)
    expect(chenScore('AKs')).toBe(12)
    expect(chenScore('22')).toBe(5)
    expect(chenScore('T9s')).toBe(8)
    expect(chenScore('72o')).toBe(-1)
  })

  it('orders aces first and junk last', () => {
    expect(CLASSES_BY_STRENGTH[0]).toBe('AA')
    expect(CLASSES_BY_STRENGTH.indexOf('AKs')).toBeLessThan(CLASSES_BY_STRENGTH.indexOf('T9s'))
    expect(CLASSES_BY_STRENGTH.indexOf('72o')).toBeGreaterThan(160)
  })

  it('builds top-percent ranges of about the right size', () => {
    for (const f of [0.05, 0.2, 0.5]) expect(rangeFraction(topRange(f))).toBeCloseTo(f, 1)
    expect(topRange(1).size).toBe(169)
  })

  it('widens opening ranges toward the button', () => {
    const sizes = (['UTG', 'HJ', 'CO', 'BTN'] as const).map((p) => rangeFraction(OPEN_RANGES[p]))
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b))
    expect(sizes[0]).toBeGreaterThan(0.12)
    expect(sizes[3]).toBeLessThan(0.55)
  })
})

describe('positions', () => {
  it('names six-max seats from the button', () => {
    expect(positions([true, true, true, true, true, true], 2)).toEqual([
      'HJ',
      'CO',
      'BTN',
      'SB',
      'BB',
      'UTG',
    ])
  })

  it('handles heads-up and empty seats', () => {
    expect(positions([true, false, true], 0)).toEqual(['BTN', null, 'BB'])
    expect(positions([true, true, true, true], 3)).toEqual(['SB', 'BB', 'CO', 'BTN'])
  })
})

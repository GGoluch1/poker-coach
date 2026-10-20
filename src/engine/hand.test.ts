import { describe, it, expect } from 'vitest'
import { parseCards } from './card'
import { createDeck, shuffle } from './deck'
import { compareHands, evaluateHand, HAND_CATEGORIES } from './hand'

const evaluate = (s: string) => evaluateHand(parseCards(s))

/** Sign of the comparison: 1 if a wins, -1 if b wins, 0 for a split. */
const winner = (a: string, b: string) => Math.sign(compareHands(evaluate(a), evaluate(b)))

describe('evaluateHand categories', () => {
  it.each([
    ['As Ks Qs Js Ts 2d 3c', 'Straight Flush', [14]],
    ['5h 4h 3h 2h Ah Kd Kc', 'Straight Flush', [5]],
    ['9c 9d 9h 9s Ad Kc 2s', 'Four of a Kind', [9, 14]],
    ['Kc Kd Kh 7s 7d 2c 3h', 'Full House', [13, 7]],
    ['Kc Kd Kh 7s 7d 7c 3h', 'Full House', [13, 7]],
    ['Qc Qd Qh 7s 7d 2c 2h', 'Full House', [12, 7]],
    ['Ah Jh 9h 6h 3h 2h Kd', 'Flush', [14, 11, 9, 6, 3]],
    ['Td 9c 8h 7s 6d 5c 2h', 'Straight', [10]],
    ['Ac 2d 3h 4s 5d Kc Qh', 'Straight', [5]],
    ['Ac Kd Qh Js Td 2c 3h', 'Straight', [14]],
    ['8c 8d 8h As Kd 3c 2h', 'Three of a Kind', [8, 14, 13]],
    ['Jc Jd 4h 4s 9d 9c 2h', 'Two Pair', [11, 9, 4]],
    ['Jc Jd 4h 4s Ad 2c 3h', 'Two Pair', [11, 4, 14]],
    ['Tc Td Ah 8s 6d 3c 2h', 'Pair', [10, 14, 8, 6]],
    ['Ac Qd 9h 7s 5d 3c 2h', 'High Card', [14, 12, 9, 7, 5]],
  ])('%s is %s', (cards, category, tiebreak) => {
    const value = evaluate(cards)
    expect(value.category).toBe(category)
    expect(value.tiebreak).toEqual(tiebreak)
  })

  it('works with exactly five cards', () => {
    expect(evaluate('As Ks Qs Js Ts').category).toBe('Straight Flush')
    expect(evaluate('2c 3d 4h 5s 7d').category).toBe('High Card')
  })

  it('prefers a straight flush over a higher plain straight', () => {
    expect(evaluate('9h 8h 7h 6h 5h Td Jc').category).toBe('Straight Flush')
  })

  it('rejects fewer than 5 or more than 7 cards', () => {
    expect(() => evaluate('As Ks Qs Js')).toThrow()
    expect(() => evaluate('As Ks Qs Js Ts 9s 8s 7s')).toThrow()
  })
})

describe('compareHands', () => {
  it('ranks every category above the one below it', () => {
    const examples = [
      'Ac Qd 9h 7s 5d',
      'Tc Td Ah 8s 6d',
      'Jc Jd 4h 4s Ad',
      '8c 8d 8h As Kd',
      'Ac 2d 3h 4s 5d',
      '2h 3h 4h 5h 7h',
      '2c 2d 2h 3s 3d',
      '2c 2d 2h 2s 3d',
      '5h 4h 3h 2h Ah',
    ]
    expect(examples.map((e) => evaluate(e).category)).toEqual([...HAND_CATEGORIES])
    for (let i = 1; i < examples.length; i++) {
      expect(winner(examples[i], examples[i - 1])).toBe(1)
    }
  })

  it('uses kickers', () => {
    expect(winner('Ac Ad Kh 9s 2d', 'As Ah Qh Js Td')).toBe(1)
    expect(winner('Ac Ad Kh 9s 3d', 'As Ah Kd 9c 2d')).toBe(1)
    expect(winner('9c 9d 9h 9s Ad', '9c 9d 9h 9s Kd')).toBe(1)
  })

  it('ranks the wheel as the lowest straight', () => {
    expect(winner('2c 3d 4h 5s 6d', 'Ac 2d 3h 4s 5d')).toBe(1)
  })

  it('compares full houses by trips before the pair', () => {
    expect(winner('3c 3d 3h 2s 2d', '2c 2d 2h As Ad')).toBe(1)
  })

  it('splits when the board plays', () => {
    const board = 'As Ks Qs Js Ts'
    expect(winner(`${board} 2c 3d`, `${board} 4h 5h`)).toBe(0)
  })

  it('ignores a sixth and seventh kicker', () => {
    expect(winner('Ac Kd Qh Js 9d 3c 2h', 'Ah Kc Qd Jc 9s 4h 3d')).toBe(0)
  })

  it('matches brute-force best-of-21 on random seven-card hands', () => {
    const combos = (n: number, k: number): number[][] =>
      k === 0 ? [[]] : n < k ? [] : [
        ...combos(n - 1, k - 1).map((c) => [...c, n - 1]),
        ...combos(n - 1, k),
      ]
    const fives = combos(7, 5)
    for (let i = 0; i < 2000; i++) {
      const seven = shuffle(createDeck()).slice(0, 7)
      const best = Math.max(...fives.map((idx) => evaluateHand(idx.map((j) => seven[j])).score))
      expect(evaluateHand(seven).score).toBe(best)
    }
  })
})

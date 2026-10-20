import { describe, it, expect } from 'vitest'
import { cardToString, parseCards } from './card'
import { estimateEquity, findOuts, hitChance } from './equity'
import { describeHand, evaluateHand } from './hand'
import { parseRange } from './range'
import { seededRng } from './rng'

const equity = (hero: string, board: string, opponents: (string | null)[], iterations = 6000) =>
  estimateEquity({
    hero: parseCards(hero),
    board: board ? parseCards(board) : [],
    opponents: opponents.map((o) => (o ? parseRange(o) : null)),
    iterations,
    rng: seededRng(7),
  }).equity

describe('estimateEquity', () => {
  it('AA is about 85% against a random hand', () => {
    expect(equity('As Ah', '', [null])).toBeCloseTo(0.85, 1)
  })

  it('AA is about 82% against KK', () => {
    expect(equity('As Ah', '', ['KK'])).toBeCloseTo(0.82, 1)
  })

  it('a made hand on the river is either 0, 1 or a split', () => {
    expect(equity('As Ah', 'Ad Kc 7h 2s 3d', ['KK'], 200)).toBe(1)
    expect(equity('2c 3d', 'As Ks Qs Js Ts', [null], 200)).toBe(0.5)
  })

  it('loses equity against more opponents', () => {
    expect(equity('Jh Th', '', [null, null, null])).toBeLessThan(equity('Jh Th', '', [null]))
  })

  it('is 100% with no opponents', () => {
    expect(equity('7c 2d', '', [])).toBe(1)
  })
})

describe('findOuts', () => {
  it('counts a flush draw as nine outs', () => {
    const groups = findOuts(parseCards('Ah Kh'), parseCards('7h 2h 9c'))
    const flush = groups.find((g) => g.category === 'Flush')!
    expect(flush.cards).toHaveLength(9)
    expect(flush.cards.every((c) => c.suit === 'h')).toBe(true)
  })

  it('counts an open-ended straight draw as eight outs', () => {
    const groups = findOuts(parseCards('9c 8d'), parseCards('7h 6s 2c Kd'))
    expect(
      groups
        .find((g) => g.category === 'Straight')!
        .cards.map(cardToString)
        .sort(),
    ).toEqual(['5c', '5d', '5h', '5s', 'Tc', 'Td', 'Th', 'Ts'].sort())
  })

  it('ignores cards that only pair the board', () => {
    const groups = findOuts(parseCards('Ac Kd'), parseCards('7h 6s 2c 9d'))
    const pairs = groups.find((g) => g.category === 'Pair')!
    expect(pairs.cards.every((c) => c.rank === 14 || c.rank === 13)).toBe(true)
    expect(pairs.cards).toHaveLength(6)
  })

  it('does not count pairing the board as a two-pair out', () => {
    const groups = findOuts(parseCards('Kc 4d'), parseCards('Ks 6s 5d 9s'))
    const twoPair = groups.find((g) => g.category === 'Two Pair')!
    expect(twoPair.cards.map(cardToString).sort()).toEqual(['4c', '4h', '4s'])
    expect(groups.find((g) => g.category === 'Three of a Kind')!.cards).toHaveLength(2)
  })

  it('returns nothing preflop or on the river', () => {
    expect(findOuts(parseCards('Ah Kh'), [])).toEqual([])
    expect(findOuts(parseCards('Ah Kh'), parseCards('2c 3c 4c 5c 7d'))).toEqual([])
  })
})

describe('hitChance', () => {
  it('matches the usual flush draw odds', () => {
    expect(hitChance(9, 47, 2)).toBeCloseTo(0.35, 2)
    expect(hitChance(9, 46, 1)).toBeCloseTo(0.196, 2)
  })
})

describe('describeHand', () => {
  it.each([
    ['As Ks Qs Js Ts', 'Royal Flush'],
    ['9h 8h 7h 6h 5h', 'Straight Flush, Nine high'],
    ['Kc Kd Kh 7s 7d', 'Full House, Kings full of Sevens'],
    ['Jc Jd 4h 4s 9d', 'Two Pair, Jacks and Fours'],
    ['6c 6d Ah 8s 2d', 'Pair of Sixes'],
    ['Ac Qd 9h 7s 5d', 'Ace high'],
  ])('%s is "%s"', (cards, name) => {
    expect(describeHand(evaluateHand(parseCards(cards)))).toBe(name)
  })
})

import { describe, it, expect } from 'vitest'
import { parseCards } from './card'
import { createDeck, shuffle } from './deck'
import { idRank, idSuit, scoreIds, toId } from './fastEval'
import { evaluateHand } from './hand'
import { seededRng } from './rng'

describe('scoreIds', () => {
  it('round-trips card ids', () => {
    for (const c of createDeck()) {
      const id = toId(c)
      expect(id).toBeGreaterThanOrEqual(0)
      expect(id).toBeLessThan(52)
      expect(idRank(id)).toBe(c.rank)
      expect(['s', 'h', 'd', 'c'][idSuit(id)]).toBe(c.suit)
    }
  })

  it('agrees with evaluateHand on tricky hands', () => {
    for (const hand of [
      '5h 4h 3h 2h Ah Kd Kc',
      'Kc Kd Kh 7s 7d 7c 3h',
      '9c 9d 9h 9s Ad Kc Kh',
      'Jc Jd 4h 4s 9d 9c 2h',
      'Ac 2d 3h 4s 5d Kc Qh',
      'Ah Jh 9h 6h 3h 2h Kd',
    ]) {
      const cards = parseCards(hand)
      expect(scoreIds(cards.map(toId))).toBe(evaluateHand(cards).score)
    }
  })

  it('agrees with evaluateHand on random 5, 6 and 7 card hands', () => {
    const rng = seededRng(99)
    for (let i = 0; i < 30000; i++) {
      const cards = shuffle(createDeck(), rng).slice(0, 5 + (i % 3))
      expect(scoreIds(cards.map(toId))).toBe(evaluateHand(cards).score)
    }
  })
})

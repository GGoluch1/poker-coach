import { describe, it, expect } from 'vitest'
import { cardToString, parseCard, parseCards } from './card'
import { createDeck } from './deck'

describe('card', () => {
  it('round-trips every card through string form', () => {
    for (const c of createDeck()) {
      expect(parseCard(cardToString(c))).toEqual(c)
    }
  })

  it('parses ranks and suits case-insensitively', () => {
    expect(parseCard('tD')).toEqual({ rank: 10, suit: 'd' })
    expect(parseCards(' As  Kh ')).toEqual([
      { rank: 14, suit: 's' },
      { rank: 13, suit: 'h' },
    ])
  })

  it('rejects invalid cards', () => {
    for (const bad of ['', 'A', '1s', 'Ax', 'Asd', '10s']) {
      expect(() => parseCard(bad)).toThrow()
    }
  })
})

import { describe, it, expect } from 'vitest'
import { createDeck, shuffle } from './deck'

const key = (c: { rank: number; suit: string }) => `${c.rank}${c.suit}`

describe('deck', () => {
  it('has 52 unique cards', () => {
    const deck = createDeck()
    expect(deck).toHaveLength(52)
    expect(new Set(deck.map(key)).size).toBe(52)
  })

  it('shuffle keeps every card and does not mutate the input', () => {
    const deck = createDeck()
    const shuffled = shuffle(deck)
    expect(new Set(shuffled.map(key)).size).toBe(52)
    expect(deck).toEqual(createDeck())
  })
})

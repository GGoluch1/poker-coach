import type { Card } from './card'
import { RANKS, SUITS } from './card'

export function createDeck(): Card[] {
  return SUITS.flatMap((suit) => RANKS.map((rank) => ({ rank, suit })))
}

export function shuffle(deck: Card[], rng: () => number = Math.random): Card[] {
  const d = [...deck]
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[d[i], d[j]] = [d[j], d[i]]
  }
  return d
}

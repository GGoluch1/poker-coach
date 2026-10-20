export const SUITS = ['s', 'h', 'd', 'c'] as const
export const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as const

export type Suit = (typeof SUITS)[number]
export type Rank = (typeof RANKS)[number]
export interface Card {
  rank: Rank
  suit: Suit
}

const RANK_CHARS = '23456789TJQKA'

export function cardToString(c: Card): string {
  return RANK_CHARS[c.rank - 2] + c.suit
}

/** Parses a card like "As", "Td" or "7c". */
export function parseCard(s: string): Card {
  const rank = RANK_CHARS.indexOf(s.charAt(0).toUpperCase()) + 2
  const suit = s.charAt(1).toLowerCase() as Suit
  if (s.length !== 2 || rank < 2 || !SUITS.includes(suit)) {
    throw new Error(`invalid card: "${s}"`)
  }
  return { rank: rank as Rank, suit }
}

/** Parses space-separated cards, e.g. "As Kd 7c". */
export function parseCards(s: string): Card[] {
  return s.trim().split(/\s+/).map(parseCard)
}

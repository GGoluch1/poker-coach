import type { Card, Rank, Suit } from './card'

/** Indexed by strength, weakest first. */
export const HAND_CATEGORIES = [
  'High Card',
  'Pair',
  'Two Pair',
  'Three of a Kind',
  'Straight',
  'Flush',
  'Full House',
  'Four of a Kind',
  'Straight Flush',
] as const

export type HandCategory = (typeof HAND_CATEGORIES)[number]

export interface HandValue {
  category: HandCategory
  /** Ranks that break ties within the category, most significant first. */
  tiebreak: Rank[]
  /** Higher beats lower; equal scores split the pot. */
  score: number
}

function makeValue(category: number, tiebreak: Rank[]): HandValue {
  // Base-15 digits: category, then up to five tiebreak ranks.
  let score = category
  for (let i = 0; i < 5; i++) score = score * 15 + (tiebreak[i] ?? 0)
  return { category: HAND_CATEGORIES[category], tiebreak, score }
}

/** High card of the best straight in `ranks`, counting the ace as low for A-2-3-4-5. */
function straightHigh(ranks: Set<Rank>): Rank | null {
  for (let high = 14; high >= 5; high--) {
    let run = 0
    while (run < 5 && ranks.has((high - run === 1 ? 14 : high - run) as Rank)) run++
    if (run === 5) return high as Rank
  }
  return null
}

/** Evaluates the best five-card hand from 5 to 7 cards. */
export function evaluateHand(cards: Card[]): HandValue {
  if (cards.length < 5 || cards.length > 7) {
    throw new Error(`expected 5 to 7 cards, got ${cards.length}`)
  }

  const counts = new Map<Rank, number>()
  const bySuit = new Map<Suit, Rank[]>()
  for (const c of cards) {
    counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1)
    const suited = bySuit.get(c.suit) ?? []
    suited.push(c.rank)
    bySuit.set(c.suit, suited)
  }

  const flush = [...bySuit.values()].find((ranks) => ranks.length >= 5)
  if (flush) {
    const high = straightHigh(new Set(flush))
    if (high) return makeValue(8, [high])
  }

  // Largest groups first, ties broken by rank, so groups[0] is the best set.
  const groups = [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0])
  const [[topRank, topCount], [secondRank, secondCount] = [0 as Rank, 0]] = groups
  const ranksDesc = [...counts.keys()].sort((a, b) => b - a)
  const kickers = (used: Rank[], n: number) =>
    ranksDesc.filter((r) => !used.includes(r)).slice(0, n)

  if (topCount === 4) return makeValue(7, [topRank, ...kickers([topRank], 1)])
  if (topCount === 3 && secondCount >= 2) return makeValue(6, [topRank, secondRank])
  if (flush) return makeValue(5, flush.sort((a, b) => b - a).slice(0, 5))

  const high = straightHigh(new Set(ranksDesc))
  if (high) return makeValue(4, [high])

  if (topCount === 3) return makeValue(3, [topRank, ...kickers([topRank], 2)])
  if (topCount === 2 && secondCount === 2) {
    return makeValue(2, [topRank, secondRank, ...kickers([topRank, secondRank], 1)])
  }
  if (topCount === 2) return makeValue(1, [topRank, ...kickers([topRank], 3)])
  return makeValue(0, ranksDesc.slice(0, 5))
}

const RANK_NAMES: Record<number, [string, string]> = {
  2: ['Two', 'Twos'],
  3: ['Three', 'Threes'],
  4: ['Four', 'Fours'],
  5: ['Five', 'Fives'],
  6: ['Six', 'Sixes'],
  7: ['Seven', 'Sevens'],
  8: ['Eight', 'Eights'],
  9: ['Nine', 'Nines'],
  10: ['Ten', 'Tens'],
  11: ['Jack', 'Jacks'],
  12: ['Queen', 'Queens'],
  13: ['King', 'Kings'],
  14: ['Ace', 'Aces'],
}
const one = (r: Rank) => RANK_NAMES[r][0]
const many = (r: Rank) => RANK_NAMES[r][1]

/** Plain-English name such as "Two Pair, Kings and Sevens". */
export function describeHand(v: HandValue): string {
  const [a, b] = v.tiebreak
  switch (v.category) {
    case 'Straight Flush':
      return a === 14 ? 'Royal Flush' : `Straight Flush, ${one(a)} high`
    case 'Four of a Kind':
      return `Four ${many(a)}`
    case 'Full House':
      return `Full House, ${many(a)} full of ${many(b)}`
    case 'Flush':
      return `Flush, ${one(a)} high`
    case 'Straight':
      return `Straight, ${one(a)} high`
    case 'Three of a Kind':
      return `Three ${many(a)}`
    case 'Two Pair':
      return `Two Pair, ${many(a)} and ${many(b)}`
    case 'Pair':
      return `Pair of ${many(a)}`
    case 'High Card':
      return `${one(a)} high`
  }
}

/** Positive if `a` wins, negative if `b` wins, 0 for a split. */
export function compareHands(a: HandValue, b: HandValue): number {
  return a.score - b.score
}

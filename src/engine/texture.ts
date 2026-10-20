import type { Card, Rank } from './card'

export type SuitTexture = 'rainbow' | 'two-tone' | 'monotone'
export type Connectedness = 'connected' | 'semi-connected' | 'disconnected'
export type Wetness = 'dry' | 'semi-wet' | 'wet'

export interface BoardTexture {
  /** Monotone means three or more cards of one suit. */
  suits: SuitTexture
  paired: boolean
  connectedness: Connectedness
  /** Some two-card hand makes a straight on this board. */
  straightPossible: boolean
  /** Some two-card hand makes a flush on this board. */
  flushPossible: boolean
  highCard: Rank
  wetness: Wetness
  /** Short description, e.g. "K-high, rainbow, dry". */
  summary: string
}

const RANK_CHARS = '23456789TJQKA'

/** Distinct ranks with the ace also counted as 1 for wheel straights. */
function straightRanks(board: Card[]): Set<number> {
  const ranks = new Set<number>(board.map((c) => c.rank))
  if (ranks.has(14)) ranks.add(1)
  return ranks
}

/** Most board ranks inside any five-rank straight window. */
function maxInWindow(ranks: Set<number>): number {
  let best = 0
  for (let low = 1; low <= 10; low++) {
    let n = 0
    for (let r = low; r < low + 5; r++) if (ranks.has(r)) n++
    best = Math.max(best, n)
  }
  return best
}

export function describeBoard(board: Card[]): BoardTexture {
  if (board.length < 3) throw new Error('board needs at least three cards')
  const suitCounts = new Map<string, number>()
  for (const c of board) suitCounts.set(c.suit, (suitCounts.get(c.suit) ?? 0) + 1)
  const maxSuit = Math.max(...suitCounts.values())
  const suits: SuitTexture = maxSuit >= 3 ? 'monotone' : maxSuit === 2 ? 'two-tone' : 'rainbow'

  const paired = new Set(board.map((c) => c.rank)).size < board.length
  const inWindow = maxInWindow(straightRanks(board))
  const straightPossible = inWindow >= 3
  const connectedness: Connectedness = straightPossible
    ? 'connected'
    : inWindow === 2
      ? 'semi-connected'
      : 'disconnected'
  const highCard = Math.max(...board.map((c) => c.rank)) as Rank

  // Draws make a board wet; pairs make it drier because fewer hands connect.
  let wet = 0
  if (suits === 'two-tone' && board.length < 5) wet += 1
  if (suits === 'monotone') wet += 2
  if (connectedness === 'connected') wet += 2
  if (connectedness === 'semi-connected') wet += 1
  if (paired) wet -= 1
  const wetness: Wetness = wet <= 0 ? 'dry' : wet <= 2 ? 'semi-wet' : 'wet'

  const parts = [`${RANK_CHARS[highCard - 2]}-high`, suits]
  if (paired) parts.push('paired')
  if (connectedness !== 'disconnected') parts.push(connectedness)
  parts.push(wetness)

  return {
    suits,
    paired,
    connectedness,
    straightPossible,
    flushPossible: maxSuit >= 3,
    highCard,
    wetness,
    summary: parts.join(', '),
  }
}

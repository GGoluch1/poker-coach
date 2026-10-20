import type { Card } from './card'
import { SUITS } from './card'

/** Cards as integers 0-51: rank * 4 + suit, with ranks 2-14 mapped to 0-12. */
export type CardId = number

export const toId = (c: Card): CardId => (c.rank - 2) * 4 + SUITS.indexOf(c.suit)
export const idRank = (id: CardId) => (id >> 2) + 2
export const idSuit = (id: CardId) => id & 3

const counts = new Uint8Array(15)
const suitMasks = new Int32Array(4)
const suitCounts = new Uint8Array(4)

/** High card of the best straight in a rank bitmask (bit r set for rank r), or 0. */
function straightHigh(mask: number): number {
  if (mask & (1 << 14)) mask |= 1 << 1 // ace plays low too
  for (let high = 14; high >= 5; high--) {
    const run = 0b11111 << (high - 4)
    if ((mask & run) === run) return high
  }
  return 0
}

function score(category: number, a = 0, b = 0, c = 0, d = 0, e = 0): number {
  return ((((category * 15 + a) * 15 + b) * 15 + c) * 15 + d) * 15 + e
}

/** Top `n` ranks of a bitmask, highest first. */
function topRanks(mask: number, n: number): number[] {
  const out: number[] = []
  for (let r = 14; r >= 2 && out.length < n; r--) if (mask & (1 << r)) out.push(r)
  return out
}

/**
 * Same result as `evaluateHand(cards).score`, but works on card ids with no
 * allocation in the common path. Used in the hot loops of equity and the solver.
 */
export function scoreIds(ids: ArrayLike<CardId>, length = ids.length): number {
  counts.fill(0)
  suitMasks.fill(0)
  suitCounts.fill(0)
  let rankMask = 0
  for (let i = 0; i < length; i++) {
    const r = (ids[i] >> 2) + 2
    const s = ids[i] & 3
    counts[r]++
    suitMasks[s] |= 1 << r
    suitCounts[s]++
    rankMask |= 1 << r
  }

  let flushSuit = -1
  for (let s = 0; s < 4; s++) if (suitCounts[s] >= 5) flushSuit = s
  if (flushSuit >= 0) {
    const sf = straightHigh(suitMasks[flushSuit])
    if (sf) return score(8, sf)
  }

  let quad = 0
  let trip1 = 0
  let trip2 = 0
  let pair1 = 0
  let pair2 = 0
  let pair3 = 0
  for (let r = 14; r >= 2; r--) {
    const n = counts[r]
    if (n === 4) quad = r
    else if (n === 3) {
      if (!trip1) trip1 = r
      else if (!trip2) trip2 = r
    } else if (n === 2) {
      if (!pair1) pair1 = r
      else if (!pair2) pair2 = r
      else if (!pair3) pair3 = r
    }
  }

  if (quad) {
    const [k] = topRanks(rankMask & ~(1 << quad), 1)
    return score(7, quad, k)
  }
  if (trip1 && (trip2 || pair1)) return score(6, trip1, Math.max(trip2, pair1))
  if (flushSuit >= 0) {
    const [a, b, c, d, e] = topRanks(suitMasks[flushSuit], 5)
    return score(5, a, b, c, d, e)
  }
  const st = straightHigh(rankMask)
  if (st) return score(4, st)
  if (trip1) {
    const [a, b] = topRanks(rankMask & ~(1 << trip1), 2)
    return score(3, trip1, a, b)
  }
  if (pair1 && pair2) {
    const [k] = topRanks(rankMask & ~(1 << pair1) & ~(1 << pair2), 1)
    return score(2, pair1, pair2, k)
  }
  if (pair1) {
    const [a, b, c] = topRanks(rankMask & ~(1 << pair1), 3)
    return score(1, pair1, a, b, c)
  }
  const [a, b, c, d, e] = topRanks(rankMask, 5)
  return score(0, a, b, c, d, e)
}

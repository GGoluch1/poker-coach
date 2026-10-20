import type { Card, Rank } from './card'
import { SUITS } from './card'

/** A starting-hand class such as "AA", "AKs" or "T9o". */
export type HandClass = string

/** A set of hand classes. */
export type Range = Set<HandClass>

const CHARS = '23456789TJQKA'
const rankChar = (r: number) => CHARS[r - 2]
const charRank = (c: string) => (CHARS.indexOf(c) + 2) as Rank

export function handClass(a: Card, b: Card): HandClass {
  const [hi, lo] = a.rank >= b.rank ? [a, b] : [b, a]
  if (hi.rank === lo.rank) return rankChar(hi.rank) + rankChar(lo.rank)
  return rankChar(hi.rank) + rankChar(lo.rank) + (hi.suit === lo.suit ? 's' : 'o')
}

/** Rows and columns of the standard 13x13 grid, aces first. Suited hands sit above the diagonal. */
export const GRID_RANKS = [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2] as Rank[]

export function gridClass(row: number, col: number): HandClass {
  const r1 = GRID_RANKS[row]
  const r2 = GRID_RANKS[col]
  if (row === col) return rankChar(r1) + rankChar(r2)
  return row < col ? rankChar(r1) + rankChar(r2) + 's' : rankChar(r2) + rankChar(r1) + 'o'
}

export const ALL_CLASSES: HandClass[] = GRID_RANKS.flatMap((_, row) =>
  GRID_RANKS.map((_, col) => gridClass(row, col)),
)

export function comboCount(cls: HandClass): number {
  return cls.length === 2 ? 6 : cls[2] === 's' ? 4 : 12
}

/** Every concrete two-card combo of a hand class. */
export function combos(cls: HandClass): [Card, Card][] {
  const r1 = charRank(cls[0])
  const r2 = charRank(cls[1])
  const out: [Card, Card][] = []
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      if (r1 === r2 && j <= i) continue
      if (cls[2] === 's' && i !== j) continue
      if (cls[2] === 'o' && i === j) continue
      out.push([
        { rank: r1, suit: SUITS[i] },
        { rank: r2, suit: SUITS[j] },
      ])
    }
  }
  return out
}

/**
 * Parses range notation: "22+", "77-99", "A2s+", "KTs+", "AJo+", "K9s-K6s", "QJo", "T9s".
 * "XYs+" raises the second card up to one below the first. Without s or o ("AQ+", "KJ")
 * both suited and offsuit hands are included.
 */
export function parseRange(text: string): Range {
  const range: Range = new Set()
  for (const raw of text.split(',')) {
    const part = raw.trim().toUpperCase().replace(/S/g, 's').replace(/O/g, 'o')
    if (!part) continue
    const m = /^([2-9TJQKA])([2-9TJQKA])([so]?)(\+?)(?:-([2-9TJQKA])([2-9TJQKA])[so]?)?$/.exec(part)
    if (!m) throw new Error(`invalid range part: "${raw}"`)
    const [, c1, c2, suit, plus, e1, e2] = m
    const r1 = charRank(c1)
    const r2 = charRank(c2)
    if (r1 === r2) {
      const top = plus ? 14 : e1 ? charRank(e1) : r1
      for (let r = Math.min(r1, top); r <= Math.max(r1, top); r++)
        range.add(rankChar(r) + rankChar(r))
      continue
    }
    if (r2 > r1) throw new Error(`invalid range part: "${raw}"`)
    const top = plus ? r1 - 1 : e2 ? charRank(e2) : r2
    for (let r = Math.min(r2, top); r <= Math.max(r2, top); r++) {
      for (const sfx of suit ? [suit] : ['s', 'o']) range.add(rankChar(r1) + rankChar(r) + sfx)
    }
  }
  return range
}

/** Chen formula: a quick preflop strength score, higher is better. */
export function chenScore(cls: HandClass): number {
  const r1 = charRank(cls[0])
  const r2 = charRank(cls[1])
  const base = (r: number) => (r === 14 ? 10 : r === 13 ? 8 : r === 12 ? 7 : r === 11 ? 6 : r / 2)
  if (r1 === r2) return Math.max(5, base(r1) * 2)
  let score = base(r1)
  if (cls[2] === 's') score += 2
  const gap = r1 - r2 - 1
  score -= [0, 1, 2, 4][gap] ?? 5
  if (gap <= 1 && r1 < 12) score += 1
  return Math.ceil(score)
}

/** Hand classes from strongest to weakest by Chen score. */
export const CLASSES_BY_STRENGTH: HandClass[] = [...ALL_CLASSES].sort(
  (a, b) =>
    chenScore(b) - chenScore(a) ||
    charRank(b[0]) - charRank(a[0]) ||
    charRank(b[1]) - charRank(a[1]) ||
    comboCount(a) - comboCount(b),
)

/** Fraction of all combos at least as strong as `cls`, from ~0.005 (AA) to 1. */
export const STRENGTH_PERCENTILE: Map<HandClass, number> = (() => {
  const map = new Map<HandClass, number>()
  let seen = 0
  for (const cls of CLASSES_BY_STRENGTH) {
    seen += comboCount(cls)
    map.set(cls, seen / 1326)
  }
  return map
})()

/** The strongest hand classes covering roughly `fraction` of all combos. */
export function topRange(fraction: number): Range {
  return new Set(
    CLASSES_BY_STRENGTH.filter((cls) => STRENGTH_PERCENTILE.get(cls)! <= fraction + 0.005),
  )
}

export function rangeFraction(range: Range): number {
  let n = 0
  for (const cls of range) n += comboCount(cls)
  return n / 1326
}

export type Position = 'UTG' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB'

/** Position names starting from the button, by number of players dealt in. */
const POSITIONS_BY_COUNT: Record<number, Position[]> = {
  2: ['BTN', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  4: ['BTN', 'SB', 'BB', 'CO'],
  5: ['BTN', 'SB', 'BB', 'HJ', 'CO'],
  6: ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'],
}

/** Position of each seat, or null for seats not dealt in. */
export function positions(inHand: boolean[], button: number): (Position | null)[] {
  const n = inHand.length
  const order: number[] = []
  for (let k = 0; k < n; k++) {
    const seat = (button + k) % n
    if (inHand[seat]) order.push(seat)
  }
  const names = POSITIONS_BY_COUNT[order.length] ?? POSITIONS_BY_COUNT[6]
  const out: (Position | null)[] = inHand.map(() => null)
  order.forEach((seat, i) => (out[seat] = names[Math.min(i, names.length - 1)]))
  return out
}

/** Approximate 6-max raise-first-in ranges: what to open when everyone before you folded. */
export const OPEN_RANGES: Record<Exclude<Position, 'BB'>, Range> = {
  UTG: parseRange('55+, A2s+, K9s+, Q9s+, J9s+, T9s, 98s, 87s, 76s, AJo+, KQo'),
  HJ: parseRange('33+, A2s+, K8s+, Q9s+, J9s+, T8s+, 97s+, 87s, 76s, 65s, ATo+, KJo+, QJo'),
  CO: parseRange(
    '22+, A2s+, K5s+, Q8s+, J8s+, T8s+, 97s+, 86s+, 75s+, 65s, 54s, A9o+, KTo+, QTo+, JTo',
  ),
  BTN: parseRange(
    '22+, A2s+, K2s+, Q4s+, J6s+, T6s+, 96s+, 85s+, 74s+, 64s+, 53s+, 43s, A2o+, K8o+, Q9o+, J9o+, T9o, 98o',
  ),
  SB: parseRange(
    '22+, A2s+, K3s+, Q5s+, J7s+, T7s+, 97s+, 86s+, 75s+, 65s, 54s, A4o+, K9o+, Q9o+, J9o+, T9o',
  ),
}

/** Rough ranges for reading opponents from their preflop action. */
export const RAISE_RANGE = topRange(0.18)
export const THREE_BET_RANGE = topRange(0.06)
export const CALL_RANGE = topRange(0.4)
export const LIMP_RANGE = topRange(0.7)

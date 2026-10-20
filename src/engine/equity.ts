import type { Card } from './card'
import { createDeck } from './deck'
import type { CardId } from './fastEval'
import { scoreIds, toId } from './fastEval'
import type { HandCategory } from './hand'
import { HAND_CATEGORIES, evaluateHand } from './hand'
import type { Range } from './range'
import { combos } from './range'
import type { Rng } from './rng'

export interface EquityResult {
  /** Share of runouts hero wins outright. */
  win: number
  /** Share of runouts hero ties for the best hand. */
  tie: number
  /** Expected share of the pot: wins plus split shares of ties. */
  equity: number
}

export interface EquityOptions {
  hero: Card[]
  board: Card[]
  /** One entry per opponent: their likely range, or null for any two cards. */
  opponents: (Range | null)[]
  iterations?: number
  rng?: Rng
}

/** Monte Carlo estimate of hero's share of the pot at showdown. */
export function estimateEquity({
  hero,
  board,
  opponents,
  iterations = 2000,
  rng = Math.random,
}: EquityOptions): EquityResult {
  if (opponents.length === 0) return { win: 1, tie: 0, equity: 1 }

  const known = [...hero, ...board].map(toId)
  const dead = new Uint8Array(52)
  for (const id of known) dead[id] = 1
  const deck: CardId[] = []
  for (let id = 0; id < 52; id++) if (!dead[id]) deck.push(id)
  // Combos of each range that don't clash with known cards, as flat id pairs; null means random.
  const candidates = opponents.map((range) => {
    if (!range) return null
    const flat: CardId[] = []
    for (const cls of range) {
      for (const [a, b] of combos(cls)) {
        const ia = toId(a)
        const ib = toId(b)
        if (!dead[ia] && !dead[ib]) flat.push(ia, ib)
      }
    }
    return flat.length > 0 ? flat : null
  })

  // Scratch buffers: [hole1, hole2, board x5] for hero and each opponent.
  const heroHand = new Int32Array(7)
  heroHand[0] = known[0]
  heroHand[1] = known[1]
  const oppHands = opponents.map(() => new Int32Array(7))
  const used = new Uint8Array(52)
  const draw = (): CardId => {
    for (;;) {
      const id = deck[Math.floor(rng() * deck.length)]
      if (!used[id]) {
        used[id] = 1
        return id
      }
    }
  }

  let wins = 0
  let ties = 0
  let equity = 0
  for (let it = 0; it < iterations; it++) {
    used.fill(0)
    for (let o = 0; o < oppHands.length; o++) {
      const hand = oppHands[o]
      const flat = candidates[o]
      let placed = false
      if (flat) {
        const pairs = flat.length / 2
        for (let tries = 0; tries < 30 && !placed; tries++) {
          const k = Math.floor(rng() * pairs) * 2
          const a = flat[k]
          const b = flat[k + 1]
          if (!used[a] && !used[b]) {
            used[a] = used[b] = 1
            hand[0] = a
            hand[1] = b
            placed = true
          }
        }
      }
      if (!placed) {
        hand[0] = draw()
        hand[1] = draw()
      }
    }
    for (let i = 0; i < 5; i++) {
      const card = i < board.length ? known[2 + i] : draw()
      heroHand[2 + i] = card
      for (const hand of oppHands) hand[2 + i] = card
    }

    const heroScore = scoreIds(heroHand)
    let best = 0
    let tied = 0
    for (const hand of oppHands) {
      const score = scoreIds(hand)
      if (score > best) {
        best = score
        tied = 0
      }
      if (score === best) tied++
    }
    if (heroScore > best) {
      wins++
      equity += 1
    } else if (heroScore === best) {
      ties++
      equity += 1 / (tied + 1)
    }
  }
  return { win: wins / iterations, tie: ties / iterations, equity: equity / iterations }
}

export interface OutGroup {
  category: HandCategory
  cards: Card[]
}

/** Category index from rank counts alone, for boards too short to evaluate. */
function pairedCategory(cards: Card[]): number {
  const counts = new Map<number, number>()
  for (const c of cards) counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1)
  const sizes = [...counts.values()].sort((a, b) => b - a)
  if (sizes[0] >= 4) return 7
  if (sizes[0] === 3) return sizes[1] >= 2 ? 6 : 3
  if (sizes[0] === 2) return sizes[1] === 2 ? 2 : 1
  return 0
}

/**
 * Unseen cards that improve hero to a better hand category on the next street,
 * ignoring improvements the board gives everyone (like the board pairing).
 */
export function findOuts(hole: Card[], board: Card[]): OutGroup[] {
  if (board.length < 3 || board.length > 4) return []
  const known = new Set([...hole, ...board].map(toId))
  const current = HAND_CATEGORIES.indexOf(evaluateHand([...hole, ...board]).category)
  const groups = new Map<HandCategory, Card[]>()

  for (const c of createDeck()) {
    if (known.has(toId(c))) continue
    const next = evaluateHand([...hole, ...board, c])
    const nextIndex = HAND_CATEGORIES.indexOf(next.category)
    if (nextIndex <= current) continue
    const newBoard = [...board, c]
    const boardIndex =
      newBoard.length === 5
        ? HAND_CATEGORIES.indexOf(evaluateHand(newBoard).category)
        : pairedCategory(newBoard)
    if (nextIndex <= boardIndex) continue
    // Pairing the board for two pair helps every opponent as much as you.
    if (next.category === 'Two Pair' && board.some((b) => b.rank === c.rank)) continue
    const list = groups.get(next.category) ?? []
    list.push(c)
    groups.set(next.category, list)
  }
  return [...groups]
    .map(([category, cards]) => ({ category, cards }))
    .sort((a, b) => HAND_CATEGORIES.indexOf(b.category) - HAND_CATEGORIES.indexOf(a.category))
}

/** Chance that at least one of `outs` arrives within `cardsToCome` cards. */
export function hitChance(outs: number, unseen: number, cardsToCome: number): number {
  let miss = 1
  for (let k = 0; k < cardsToCome; k++) miss *= (unseen - outs - k) / (unseen - k)
  return 1 - miss
}

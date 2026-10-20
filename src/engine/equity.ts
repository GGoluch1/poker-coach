import type { Card } from './card'
import { SUITS } from './card'
import { createDeck } from './deck'
import type { HandCategory } from './hand'
import { HAND_CATEGORIES, evaluateHand } from './hand'
import type { Range } from './range'
import { combos } from './range'
import type { Rng } from './rng'

const cardId = (c: Card) => c.rank * 4 + SUITS.indexOf(c.suit)

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

  const dead = new Set([...hero, ...board].map(cardId))
  const deck = createDeck().filter((c) => !dead.has(cardId(c)))
  // Combos of each range that don't clash with known cards; null means random.
  const candidates = opponents.map((range) => {
    if (!range) return null
    const list = [...range]
      .flatMap(combos)
      .filter(([a, b]) => !dead.has(cardId(a)) && !dead.has(cardId(b)))
    return list.length > 0 ? list : null
  })

  let wins = 0
  let ties = 0
  let equity = 0
  const used = new Set<number>()
  const draw = (): Card => {
    for (;;) {
      const c = deck[Math.floor(rng() * deck.length)]
      const id = cardId(c)
      if (!used.has(id)) {
        used.add(id)
        return c
      }
    }
  }

  for (let it = 0; it < iterations; it++) {
    used.clear()
    const hands: Card[][] = candidates.map((list) => {
      if (list) {
        for (let tries = 0; tries < 30; tries++) {
          const [a, b] = list[Math.floor(rng() * list.length)]
          if (!used.has(cardId(a)) && !used.has(cardId(b))) {
            used.add(cardId(a))
            used.add(cardId(b))
            return [a, b]
          }
        }
      }
      return [draw(), draw()]
    })
    const runout = [...board]
    while (runout.length < 5) runout.push(draw())

    const heroScore = evaluateHand([...hero, ...runout]).score
    let best = 0
    let tied = 0
    for (const h of hands) {
      const score = evaluateHand([...h, ...runout]).score
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
  const known = new Set([...hole, ...board].map(cardId))
  const current = HAND_CATEGORIES.indexOf(evaluateHand([...hole, ...board]).category)
  const groups = new Map<HandCategory, Card[]>()

  for (const c of createDeck()) {
    if (known.has(cardId(c))) continue
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

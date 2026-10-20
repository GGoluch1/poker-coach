import { analyzeSpot } from './analysis'
import type { Card } from './card'
import { cardLabel, cardToString } from './card'
import { createDeck, shuffle } from './deck'
import { describeSituation } from './describe'
import { findOuts, hitChance } from './equity'
import type { Action, GameState, Street } from './game'
import { legalActions, totalPot } from './game'
import { generateSpot } from './generate'
import { HAND_CATEGORIES, evaluateHand } from './hand'
import type { HandClass, Position } from './range'
import { ALL_CLASSES, OPEN_RANGES, STRENGTH_PERCENTILE, rangeFraction } from './range'
import type { Verdict } from './review'
import { reviewDecision } from './review'
import type { Rng } from './rng'
import type { Connectedness, SuitTexture, Wetness } from './texture'
import { describeBoard } from './texture'

export type OpenPosition = Exclude<Position, 'BB'>
export const OPEN_POSITIONS: OpenPosition[] = ['UTG', 'HJ', 'CO', 'BTN', 'SB']

export interface HandOption {
  label: string
  verdict: Verdict
  message: string
}

export type DrillItem =
  | { kind: 'outs'; hole: Card[]; board: Card[] }
  | { kind: 'preflop'; position: OpenPosition; handClass: HandClass }
  | { kind: 'texture'; board: Card[] }
  | {
      kind: 'callfold'
      situation: string[]
      hole: Card[]
      board: Card[]
      pot: number
      toCall: number
      equity: number
      need: number
      equityNote: string
      reads: string[]
    }
  | {
      kind: 'hand'
      situation: string[]
      hole: Card[]
      board: Card[]
      options: HandOption[]
      /** Where the spot came from, e.g. "Hand #12". */
      source: string
    }

export type DrillKind = DrillItem['kind']

export type DrillAnswer =
  | { kind: 'outs'; outs: number }
  | { kind: 'preflop'; action: 'raise' | 'fold' }
  | { kind: 'texture'; suits: SuitTexture; connectedness: Connectedness; wetness: Wetness }
  | { kind: 'callfold'; action: 'call' | 'fold' }
  | { kind: 'hand'; option: number }

export interface Grade {
  correct: boolean
  headline: string
  details: string[]
}

const pct = (x: number) => `${Math.round(x * 100)}%`
const cards = (list: Card[]) => list.map(cardLabel).join(' ')

/** Identifies a question so repeated misses update one spaced-repetition card. */
export function drillKey(item: DrillItem): string {
  const c = (list: Card[]) => list.map(cardToString).join('')
  switch (item.kind) {
    case 'outs':
      return `outs:${c(item.hole)}:${c(item.board)}`
    case 'preflop':
      return `preflop:${item.position}:${item.handClass}`
    case 'texture':
      return `texture:${c(item.board)}`
    case 'callfold':
      return `callfold:${c(item.hole)}:${c(item.board)}:${item.pot}:${item.toCall}`
    case 'hand':
      return `hand:${item.source}:${c(item.hole)}:${c(item.board)}`
  }
}

export function outsItem(rng: Rng): DrillItem {
  for (;;) {
    const deck = shuffle(createDeck(), rng)
    const hole = deck.slice(0, 2)
    const board = deck.slice(2, rng() < 0.6 ? 5 : 6)
    const made = HAND_CATEGORIES.indexOf(evaluateHand([...hole, ...board]).category)
    const groups = findOuts(hole, board)
    const outs = groups.reduce((n, g) => n + g.cards.length, 0)
    const draw = groups.some((g) => g.category === 'Straight' || g.category === 'Flush')
    // Classic outs spots: at most a pair, with a straight or flush draw.
    if (made <= 1 && draw && outs <= 21) return { kind: 'outs', hole, board }
  }
}

export function preflopItem(rng: Rng): DrillItem {
  const position = OPEN_POSITIONS[Math.floor(rng() * OPEN_POSITIONS.length)]
  const edge = rangeFraction(OPEN_RANGES[position])
  // Favor hands near the edge of the range; AA and 72o teach nothing after the first time.
  const weights = ALL_CLASSES.map(
    (cls) => 1 / (1 + 12 * Math.abs(STRENGTH_PERCENTILE.get(cls)! - edge)),
  )
  let pick = rng() * weights.reduce((a, b) => a + b, 0)
  let i = 0
  while (pick > weights[i]) pick -= weights[i++]
  return { kind: 'preflop', position, handClass: ALL_CLASSES[i] }
}

export function textureItem(rng: Rng): DrillItem {
  return { kind: 'texture', board: shuffle(createDeck(), rng).slice(0, 3) }
}

export function callFoldItem(rng: Rng): DrillItem {
  const streets: Street[] = ['flop', 'turn', 'river']
  const s = generateSpot({ street: streets[Math.floor(rng() * 3)], facingBet: true, rng })
  const spot = analyzeSpot(s, 0, { iterations: 4000, rng, withOuts: false })
  return {
    kind: 'callfold',
    situation: describeSituation(s, 0),
    hole: spot.hole,
    board: spot.board,
    pot: spot.pot,
    toCall: spot.toCall,
    equity: spot.equity!.equity,
    need: spot.requiredEquity,
    equityNote: spot.equityNote,
    reads: spot.opponents.map((o) => `${o.read.label}`),
  }
}

/** Standard sizes for the "raise" option when replaying a spot. */
function standardRaise(s: GameState): number | null {
  const legal = legalActions(s)
  if (legal.minRaiseTo === null) return null
  const unopened =
    s.street === 'preflop' && !s.events.some((e) => e.type === 'action' && e.action === 'raise')
  const target =
    s.street === 'preflop'
      ? unopened
        ? 2.5 * s.bigBlind
        : 3 * s.currentBet
      : s.currentBet === 0
        ? (2 / 3) * totalPot(s)
        : 3 * s.currentBet
  return Math.min(legal.maxRaiseTo!, Math.max(legal.minRaiseTo, Math.round(target)))
}

/** Turns a past decision into a replayable spot with every option graded. */
export function handItem(s: GameState, seat: number, source: string, rng: Rng): DrillItem {
  const spot = analyzeSpot(s, seat, { iterations: 3000, rng })
  const legal = legalActions(s)
  const options: [string, Action][] = []
  if (!legal.canCheck) options.push(['Fold', { type: 'fold' }])
  options.push(
    legal.canCheck ? ['Check', { type: 'check' }] : [`Call ${legal.toCall}`, { type: 'call' }],
  )
  const raiseTo = standardRaise(s)
  if (raiseTo !== null) {
    options.push([
      `${s.currentBet === 0 ? 'Bet' : 'Raise to'} ${raiseTo}`,
      { type: 'raise', to: raiseTo },
    ])
  }
  return {
    kind: 'hand',
    situation: describeSituation(s, seat),
    hole: spot.hole,
    board: spot.board,
    source,
    options: options.map(([label, action]) => {
      const review = reviewDecision(spot, action)
      return { label, verdict: review.verdict, message: review.message }
    }),
  }
}

export function generateDrill(kind: Exclude<DrillKind, 'hand'>, rng: Rng): DrillItem {
  switch (kind) {
    case 'outs':
      return outsItem(rng)
    case 'preflop':
      return preflopItem(rng)
    case 'texture':
      return textureItem(rng)
    case 'callfold':
      return callFoldItem(rng)
  }
}

export function gradeDrill(item: DrillItem, answer: DrillAnswer): Grade {
  if (item.kind !== answer.kind) throw new Error('answer does not match the question')
  switch (item.kind) {
    case 'outs': {
      const { outs } = answer as Extract<DrillAnswer, { kind: 'outs' }>
      const groups = findOuts(item.hole, item.board)
      const total = groups.reduce((n, g) => n + g.cards.length, 0)
      const unseen = 52 - 2 - item.board.length
      const details = groups.map((g) => `${g.category}: ${g.cards.length} (${cards(g.cards)})`)
      details.push(
        `Next card: rule of 2 says ~${total * 2}%, exact is ${pct(hitChance(total, unseen, 1))}.`,
      )
      if (item.board.length === 3) {
        details.push(
          `By the river: rule of 4 says ~${total * 4}%, exact is ${pct(hitChance(total, unseen, 2))}.`,
        )
      }
      return {
        correct: outs === total,
        headline:
          outs === total ? `Right, ${total} outs.` : `You said ${outs}; it's ${total} outs.`,
        details,
      }
    }
    case 'preflop': {
      const { action } = answer as Extract<DrillAnswer, { kind: 'preflop' }>
      const range = OPEN_RANGES[item.position]
      const raise = range.has(item.handClass)
      const correct = raise === (action === 'raise')
      return {
        correct,
        headline: `${correct ? 'Right' : 'Not quite'}: ${raise ? 'raise' : 'fold'} ${item.handClass} from ${item.position}.`,
        details: [
          `${item.handClass} is ${raise ? 'in' : 'outside'} the ${item.position} opening range, which is ${pct(rangeFraction(range))} of hands.`,
        ],
      }
    }
    case 'texture': {
      const a = answer as Extract<DrillAnswer, { kind: 'texture' }>
      const t = describeBoard(item.board)
      const parts: [string, string, string][] = [
        ['Suits', a.suits, t.suits],
        ['Connectedness', a.connectedness, t.connectedness],
        ['Wetness', a.wetness, t.wetness],
      ]
      const wrong = parts.filter(([, given, actual]) => given !== actual)
      return {
        correct: wrong.length === 0,
        headline: wrong.length === 0 ? `Right: ${t.summary}.` : `This board is ${t.summary}.`,
        details: [
          ...parts.map(
            ([label, given, actual]) =>
              `${label}: ${actual}${given === actual ? ' ✓' : ` (you said ${given})`}`,
          ),
          'Wet boards have flush or straight draws; dry boards have few. Pairs make a board drier.',
        ],
      }
    }
    case 'callfold': {
      const { action } = answer as Extract<DrillAnswer, { kind: 'callfold' }>
      const close = Math.abs(item.equity - item.need) < 0.03
      const best = item.equity >= item.need ? 'call' : 'fold'
      const correct = close || action === best
      return {
        correct,
        headline: close
          ? `Close spot: either is fine (${pct(item.equity)} vs ${pct(item.need)} needed).`
          : `${correct ? 'Right' : 'Not quite'}: ${best} (${pct(item.equity)} equity, ${pct(item.need)} needed).`,
        details: [
          `Call ${item.toCall} into a pot of ${item.pot}: you need ${item.toCall} / ${item.pot + item.toCall} = ${pct(item.need)}.`,
          `Your equity is about ${pct(item.equity)} ${item.equityNote}.`,
          ...item.reads.map((r) => `Opponent ${r}.`),
          'Heuristic: ranges are guessed from preflop action, and implied odds are ignored.',
        ],
      }
    }
    case 'hand': {
      const { option } = answer as Extract<DrillAnswer, { kind: 'hand' }>
      const chosen = item.options[option]
      const correct = chosen.verdict === 'good' || chosen.verdict === 'ok'
      return {
        correct,
        headline: `${chosen.label}: ${chosen.verdict === 'ok' ? 'OK' : chosen.verdict[0].toUpperCase() + chosen.verdict.slice(1)}.`,
        details: item.options.map((o) => `${o.label}: ${o.message}`),
      }
    }
  }
}

import { analyzeSpot } from './analysis'
import type { Card } from './card'
import { cardLabel, cardToString } from './card'
import type { ChartAction } from './charts'
import { PREFLOP_CHARTS, chartAction, getChart } from './charts'
import { createDeck, shuffle } from './deck'
import { describeSituation } from './describe'
import { findOuts, hitChance } from './equity'
import { optionEvs } from './ev'
import type { GameState, Street } from './game'
import { generateSpot } from './generate'
import { HAND_CATEGORIES, evaluateHand } from './hand'
import type { Personality } from './profiles'
import type { HandClass, Position } from './range'
import { ALL_CLASSES, STRENGTH_PERCENTILE, combos, parseRange, rangeFraction } from './range'
import type { Verdict } from './review'
import { reviewDecision } from './review'
import type { Rng } from './rng'
import type { Connectedness, SuitTexture, Wetness } from './texture'
import { describeBoard } from './texture'

export type OpenPosition = Exclude<Position, 'BB'>

export interface HandOption {
  label: string
  verdict: Verdict
  message: string
  /** Rough EV in big blinds relative to folding, when estimated. */
  ev?: number | null
}

export type MdfQuestion = 'mdf' | 'bluff' | 'potodds'

export type DrillItem =
  | { kind: 'outs'; hole: Card[]; board: Card[] }
  | {
      kind: 'preflop'
      chartId: string
      handClass: HandClass
      /** Older saved items only had an opening position. */
      position?: OpenPosition
    }
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
      /** Showdown EV of calling, in big blinds. */
      evCall?: number
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
  | { kind: 'mdf'; pot: number; bet: number; question: MdfQuestion }
  | { kind: 'combos'; hole: Card[]; board: Card[]; target: string }
  | {
      kind: 'setmine'
      pair: HandClass
      /** All amounts in big blinds. */
      raiseTo: number
      stack: number
      /** Share of the remaining effective stack won after flopping a set. */
      winShare: number
    }

export type DrillKind = DrillItem['kind']
export type GeneratedKind = Exclude<DrillKind, 'hand'>

export type DrillAnswer =
  | { kind: 'outs'; outs: number }
  | { kind: 'preflop'; action: ChartAction }
  | { kind: 'texture'; suits: SuitTexture; connectedness: Connectedness; wetness: Wetness }
  | { kind: 'callfold'; action: 'call' | 'fold' }
  | { kind: 'hand'; option: number }
  | { kind: 'mdf'; percent: number }
  | { kind: 'combos'; count: number }
  | { kind: 'setmine'; action: 'call' | 'fold' }

export interface Grade {
  correct: boolean
  headline: string
  details: string[]
}

const pct = (x: number) => `${Math.round(x * 100)}%`
const bb = (x: number) => `${x >= 0 ? '+' : ''}${x.toFixed(1)} bb`
const cards = (list: Card[]) => list.map(cardLabel).join(' ')
const pick = <T>(list: readonly T[], rng: Rng): T => list[Math.floor(rng() * list.length)]

/** Chance of flopping a set or better with a pocket pair. */
export const SET_ON_FLOP = 1 - (48 * 47 * 46) / (50 * 49 * 48)

/** The chart a preflop item refers to, including older items saved before charts had ids. */
export function preflopChartOf(item: Extract<DrillItem, { kind: 'preflop' }>) {
  return getChart(item.chartId ?? `open-${item.position}`)
}

/** Identifies a question so repeated misses update one spaced-repetition card. */
export function drillKey(item: DrillItem): string {
  const c = (list: Card[]) => list.map(cardToString).join('')
  switch (item.kind) {
    case 'outs':
      return `outs:${c(item.hole)}:${c(item.board)}`
    case 'preflop':
      return `preflop:${preflopChartOf(item).id}:${item.handClass}`
    case 'texture':
      return `texture:${c(item.board)}`
    case 'callfold':
      return `callfold:${c(item.hole)}:${c(item.board)}:${item.pot}:${item.toCall}`
    case 'hand':
      return `hand:${item.source}:${c(item.hole)}:${c(item.board)}`
    case 'mdf':
      return `mdf:${item.question}:${item.pot}:${item.bet}`
    case 'combos':
      return `combos:${c(item.hole)}:${c(item.board)}:${item.target}`
    case 'setmine':
      return `setmine:${item.pair}:${item.raiseTo}:${item.stack}:${item.winShare}`
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
  const chart = pick(PREFLOP_CHARTS, rng)
  const edge = rangeFraction(chart.raise) + rangeFraction(chart.call)
  // Favor hands in the chart and near its edge; AA and 72o teach nothing after the first time.
  const weights = ALL_CLASSES.map(
    (cls) =>
      (chart.raise.has(cls) || chart.call.has(cls) ? 0.6 : 0) +
      1 / (1 + 12 * Math.abs(STRENGTH_PERCENTILE.get(cls)! - edge)),
  )
  let roll = rng() * weights.reduce((a, b) => a + b, 0)
  let i = 0
  while (roll > weights[i]) roll -= weights[i++]
  return { kind: 'preflop', chartId: chart.id, handClass: ALL_CLASSES[i] }
}

export function textureItem(rng: Rng): DrillItem {
  return { kind: 'texture', board: shuffle(createDeck(), rng).slice(0, 3) }
}

export function callFoldItem(rng: Rng): DrillItem {
  const streets: Street[] = ['flop', 'turn', 'river']
  const s = generateSpot({ street: pick(streets, rng), facingBet: true, rng })
  const spot = analyzeSpot(s, 0, { iterations: 4000, rng, withOuts: false })
  const equity = spot.equity!.equity
  return {
    kind: 'callfold',
    situation: describeSituation(s, 0),
    hole: spot.hole,
    board: spot.board,
    pot: spot.pot,
    toCall: spot.toCall,
    equity,
    need: spot.requiredEquity,
    equityNote: spot.equityNote,
    reads: spot.opponents.map((o) => `${o.read.label}`),
    evCall: (equity * (spot.pot + spot.toCall) - spot.toCall) / s.bigBlind,
  }
}

export function mdfItem(rng: Rng): DrillItem {
  const pot = 10 * (1 + Math.floor(rng() * 10))
  const fraction = pick([0.25, 0.33, 0.5, 0.66, 0.75, 1, 1.25, 1.5, 2], rng)
  return {
    kind: 'mdf',
    pot,
    bet: Math.round(pot * fraction),
    question: pick(['mdf', 'bluff', 'potodds'] as const, rng),
  }
}

/** The right percentage for an MDF drill item, 0-1. */
export function mdfAnswer(item: Extract<DrillItem, { kind: 'mdf' }>): number {
  const { pot, bet } = item
  if (item.question === 'mdf') return pot / (pot + bet)
  if (item.question === 'bluff') return bet / (pot + bet)
  return bet / (pot + 2 * bet)
}

const RANK_CHARS = '23456789TJQKA'
const RANK_PLURALS = [
  'Twos',
  'Threes',
  'Fours',
  'Fives',
  'Sixes',
  'Sevens',
  'Eights',
  'Nines',
  'Tens',
  'Jacks',
  'Queens',
  'Kings',
  'Aces',
]

export function combosItem(rng: Rng): DrillItem {
  const deck = shuffle(createDeck(), rng)
  const hole = deck.slice(0, 2)
  const board = deck.slice(2, 2 + pick([3, 3, 4, 5], rng))
  // Ask about ranks you can see, so blockers matter.
  const seen = [...hole, ...board].map((c) => RANK_CHARS[c.rank - 2])
  const rank = () => (rng() < 0.75 ? pick(seen, rng) : pick([...RANK_CHARS], rng))
  let target: string
  if (rng() < 0.35) {
    const r = rank()
    target = r + r
  } else {
    let a = rank()
    let b = rank()
    while (b === a) b = pick([...RANK_CHARS], rng)
    if (RANK_CHARS.indexOf(a) < RANK_CHARS.indexOf(b)) [a, b] = [b, a]
    target = a + b + pick(['', '', 's', 'o'], rng)
  }
  return { kind: 'combos', hole, board, target }
}

/** Combos of a target hand left after removing the visible cards. */
export function remainingCombos(item: Extract<DrillItem, { kind: 'combos' }>): number {
  const dead = new Set([...item.hole, ...item.board].map(cardToString))
  return [...parseRange(item.target)]
    .flatMap(combos)
    .filter(([a, b]) => !dead.has(cardToString(a)) && !dead.has(cardToString(b))).length
}

export function setMineItem(rng: Rng): DrillItem {
  return {
    kind: 'setmine',
    pair: pick(['22', '33', '44', '55', '66', '77', '88', '99'], rng),
    raiseTo: pick([2.5, 3, 3.5, 4, 5], rng),
    stack: pick([15, 20, 30, 40, 60, 80, 100, 150, 200], rng),
    winShare: pick([0.15, 0.25, 0.35, 0.5], rng),
  }
}

/** EV in big blinds of calling to set-mine, folding whenever the flop misses. */
export function setMineEv(item: Extract<DrillItem, { kind: 'setmine' }>): {
  ev: number
  pot: number
  win: number
} {
  const call = item.raiseTo
  // The raise plus both blinds are already in the middle.
  const pot = item.raiseTo + 1.5
  const win = item.winShare * (item.stack - call)
  return { ev: SET_ON_FLOP * (pot + win) - (1 - SET_ON_FLOP) * call, pot, win }
}

/** Turns a past decision into a replayable spot with every option graded. */
export function handItem(
  s: GameState,
  seat: number,
  source: string,
  rng: Rng,
  profiles: (Personality | undefined)[] = [],
): DrillItem {
  const spot = analyzeSpot(s, seat, { iterations: 3000, rng, profiles })
  const evs = optionEvs(s, seat, spot, null, { iterations: 1500, rng, profiles })
  return {
    kind: 'hand',
    situation: describeSituation(s, seat),
    hole: spot.hole,
    board: spot.board,
    source,
    options: evs.map((o) => {
      const review = reviewDecision(spot, o.action)
      return {
        label: o.label,
        verdict: review.verdict,
        message: review.message,
        ev: o.ev === null ? null : o.ev / s.bigBlind,
      }
    }),
  }
}

export function generateDrill(kind: GeneratedKind, rng: Rng): DrillItem {
  switch (kind) {
    case 'outs':
      return outsItem(rng)
    case 'preflop':
      return preflopItem(rng)
    case 'texture':
      return textureItem(rng)
    case 'callfold':
      return callFoldItem(rng)
    case 'mdf':
      return mdfItem(rng)
    case 'combos':
      return combosItem(rng)
    case 'setmine':
      return setMineItem(rng)
  }
}

const ACTION_WORD: Record<ChartAction, string> = { raise: 'raise', call: 'call', fold: 'fold' }

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
      const chart = preflopChartOf(item)
      const rec = chartAction(chart, item.handClass)
      const word = rec === 'raise' ? chart.raiseLabel.toLowerCase() : ACTION_WORD[rec]
      const correct = action === rec
      const details = [
        `${chart.title}: the chart ${chart.raiseLabel.toLowerCase()}s ${pct(rangeFraction(chart.raise))} of hands${chart.call.size ? ` and calls ${pct(rangeFraction(chart.call))}` : ''}.`,
      ]
      if (!correct && rec === 'raise' && action === 'call') {
        details.push(`Calling isn't a disaster, but ${chart.raiseLabel} is the standard play.`)
      }
      return {
        correct,
        headline: `${correct ? 'Right' : 'Not quite'}: ${word} ${item.handClass} here.`,
        details,
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
      const details = [
        `Call ${item.toCall} into a pot of ${item.pot}: you need ${item.toCall} / ${item.pot + item.toCall} = ${pct(item.need)}.`,
        `Your equity is about ${pct(item.equity)} ${item.equityNote}.`,
      ]
      if (item.evCall !== undefined) {
        details.push(`Showdown EV of calling: ${bb(item.evCall)}. Folding is 0 bb.`)
      }
      details.push(
        ...item.reads.map((r) => `Opponent ${r}.`),
        'Heuristic: ranges are guessed from preflop action, and implied odds are ignored.',
      )
      return {
        correct,
        headline: close
          ? `Close spot: either is fine (${pct(item.equity)} vs ${pct(item.need)} needed).`
          : `${correct ? 'Right' : 'Not quite'}: ${best} (${pct(item.equity)} equity, ${pct(item.need)} needed).`,
        details,
      }
    }
    case 'hand': {
      const { option } = answer as Extract<DrillAnswer, { kind: 'hand' }>
      const chosen = item.options[option]
      const correct = chosen.verdict === 'good' || chosen.verdict === 'ok'
      return {
        correct,
        headline: `${chosen.label}: ${chosen.verdict === 'ok' ? 'OK' : chosen.verdict[0].toUpperCase() + chosen.verdict.slice(1)}.`,
        details: item.options.map(
          (o) =>
            `${o.label}${o.ev !== undefined && o.ev !== null ? ` (${bb(o.ev)})` : ''}: ${o.message}`,
        ),
      }
    }
    case 'mdf': {
      const { percent } = answer as Extract<DrillAnswer, { kind: 'mdf' }>
      const right = mdfAnswer(item)
      const correct = Math.abs(percent / 100 - right) <= 0.03
      const { pot, bet } = item
      const formula =
        item.question === 'mdf'
          ? `Minimum defense = pot / (pot + bet) = ${pot} / ${pot + bet} = ${pct(right)}. Defend less and any two cards bluff profitably.`
          : item.question === 'bluff'
            ? `Break-even = bet / (pot + bet) = ${bet} / ${pot + bet} = ${pct(right)}. The bluff profits if they fold more often than this.`
            : `Call ${bet} to win ${pot + bet}: you need ${bet} / ${pot + 2 * bet} = ${pct(right)} equity.`
      return {
        correct,
        headline: correct ? `Right: ${pct(right)}.` : `You said ${percent}%; it's ${pct(right)}.`,
        details: [
          formula,
          `Bet size: ${pct(bet / pot)} of the pot. Bigger bets let the defender fold more often, and a bluff needs more folds to work.`,
          'Within 3 points counts as correct.',
        ],
      }
    }
    case 'combos': {
      const { count } = answer as Extract<DrillAnswer, { kind: 'combos' }>
      const right = remainingCombos(item)
      const [a, b, suit] = item.target
      const known = [...item.hole, ...item.board]
      const left = (ch: string) => 4 - known.filter((c) => RANK_CHARS[c.rank - 2] === ch).length
      const unblocked = item.target.length === 2 && a === b ? 6 : !suit ? 16 : suit === 's' ? 4 : 12
      const named = (ch: string) => `${left(ch)} ${RANK_PLURALS[RANK_CHARS.indexOf(ch)]}`
      const how =
        a === b
          ? `${named(a)} left: ${left(a)} × ${left(a) - 1} / 2 = ${right}.`
          : !suit
            ? `${named(a)} × ${named(b)} = ${right}.`
            : suit === 's'
              ? `one combo for each suit where both the ${a} and the ${b} are unseen: ${right}.`
              : `all ${a}${b} combos minus the suited ones: ${right}.`
      return {
        correct: count === right,
        headline:
          count === right ? `Right, ${right} combos.` : `You said ${count}; it's ${right} combos.`,
        details: [
          `Unblocked, ${item.target} has ${unblocked} combos.`,
          `Visible cards remove some: ${how}`,
          'Holding or seeing a card of a rank "blocks" combos that need it.',
        ],
      }
    }
    case 'setmine': {
      const { action } = answer as Extract<DrillAnswer, { kind: 'setmine' }>
      const { ev, pot, win } = setMineEv(item)
      const close = Math.abs(ev) < 0.2
      const best = ev > 0 ? 'call' : 'fold'
      const correct = close || action === best
      const spr = (item.stack - item.raiseTo) / (pot + item.raiseTo)
      return {
        correct,
        headline: close
          ? `Close spot: about break-even (${bb(ev)}).`
          : `${correct ? 'Right' : 'Not quite'}: ${best} (${bb(ev)}).`,
        details: [
          `You flop a set ${pct(SET_ON_FLOP)} of the time, about 1 in 8.5.`,
          `When you hit you win the ${pot} bb pot plus ${pct(item.winShare)} of the remaining ${item.stack - item.raiseTo} bb, so ${(pot + win).toFixed(1)} bb.`,
          `EV = ${SET_ON_FLOP.toFixed(3)} × ${(pot + win).toFixed(1)} − ${(1 - SET_ON_FLOP).toFixed(3)} × ${item.raiseTo} = ${bb(ev)}.`,
          `Stack-to-pot ratio after calling: ${spr.toFixed(1)}. Deep stacks (high SPR) are what make set mining work; a common rule of thumb is 15-20× the call.`,
        ],
      }
    }
  }
}

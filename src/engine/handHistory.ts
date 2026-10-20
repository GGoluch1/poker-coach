import type { Card } from './card'
import { cardToString, parseCard } from './card'
import { createDeck, shuffle } from './deck'
import type { Action, GameState } from './game'
import { applyAction, createGame, legalActions, startHand } from './game'
import { seededRng } from './rng'

export interface ImportedHand {
  /** Stable id, e.g. "ps-245678901234". */
  id: string
  site: 'PokerStars' | 'GGPoker'
  handNumber: string
  date: string | null
  /** Blinds as written, e.g. "$0.01/$0.02". */
  stakes: string
  /** Chips per unit of the original currency (100 when amounts were in dollars). */
  scale: number
  heroName: string
  /** State right after the blinds are posted; the hero is always seat 0. */
  initial: GameState
  /** Every action in order, for step-by-step replay. */
  actions: { seat: number; action: Action }[]
  final: GameState
  /** States just before each hero decision. */
  decisions: { state: GameState; action: Action }[]
}

const HEADER = /^(?:PokerStars (?:Hand|Game) #|Poker Hand #)/m

/** Splits pasted text into one chunk per hand. */
export function splitHandHistories(text: string): string[] {
  return text
    .replace(/^﻿/, '')
    .split(new RegExp(`(?=${HEADER.source})`, 'm'))
    .map((h) => h.trim())
    .filter((h) => HEADER.test(h))
}

function hashSeed(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

interface ParsedAction {
  name: string
  type: 'fold' | 'check' | 'call' | 'bet' | 'raise'
  /** Street total for bets and raises. */
  to: number
}

/**
 * Parses one PokerStars or GGPoker no-limit hold'em hand and replays it through the
 * engine, so every decision can be reviewed like a hand played here. Throws an Error
 * with a readable message for anything unsupported.
 */
export function parseHandHistory(text: string): ImportedHand {
  const lines = text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  const header = lines[0] ?? ''
  const ps = /^PokerStars (?:Hand|Game) #(\d+)/.exec(header)
  const gg = /^Poker Hand #(\w+)/.exec(header)
  if (!ps && !gg)
    throw new Error('Unrecognized format. Paste PokerStars or GGPoker hand histories.')
  if (!/Hold'em No Limit/i.test(header)) {
    throw new Error("Only no-limit hold'em hands are supported.")
  }
  const site = ps ? 'PokerStars' : 'GGPoker'
  const handNumber = (ps ?? gg)![1]

  const stakesMatch = /\(([^()]*?([$€£]?)([\d.,]+)\/[$€£]?([\d.,]+)[^()]*)\)/.exec(header)
  if (!stakesMatch) throw new Error('Could not find the blinds in the hand header.')
  const money =
    stakesMatch[2] !== '' || stakesMatch[3].includes('.') || stakesMatch[4].includes('.')
  const scale = money ? 100 : 1
  const amount = (raw: string) => Math.round(parseFloat(raw.replace(/[^\d.]/g, '')) * scale)
  const smallBlind = amount(stakesMatch[3])
  const bigBlind = amount(stakesMatch[4])
  const stakes = `${stakesMatch[2]}${stakesMatch[3]}/${stakesMatch[2]}${stakesMatch[4]}`
  const date = /(\d{4}\/\d{2}\/\d{2} \d{1,2}:\d{2}:\d{2})/.exec(header)?.[1] ?? null

  const buttonSeat = Number(/Seat #(\d+) is the button/.exec(lines[1] ?? '')?.[1])
  if (!buttonSeat) throw new Error('Could not find the button.')

  const holeIndex = lines.findIndex((l) => l === '*** HOLE CARDS ***')
  if (holeIndex < 0) throw new Error('Missing the *** HOLE CARDS *** section.')
  const setup = lines.slice(0, holeIndex)
  if (setup.some((l) => /posts (the )?ante/.test(l)))
    throw new Error('Antes are not supported yet.')
  if (setup.some((l) => /posts (small & big blinds|straddle|a dead)/.test(l))) {
    throw new Error('Straddles and dead blinds are not supported.')
  }

  const seats: { seat: number; name: string; stack: number }[] = []
  for (const l of setup) {
    const m = /^Seat (\d+): (.+?) \([$€£]?([\d.,]+) in chips\)(.*)$/.exec(l)
    if (!m || /sitting out|out of hand/.test(m[4])) continue
    seats.push({ seat: Number(m[1]), name: m[2], stack: amount(m[3]) })
  }
  if (seats.length < 2) throw new Error('Need at least two players dealt in.')
  const blindPosts = setup.flatMap((l) => {
    const m = /^(.+): posts (small|big) blind [$€£]?([\d.,]+)/.exec(l)
    return m ? [{ name: m[1], kind: m[2], amount: amount(m[3]) }] : []
  })

  // Longest names first, so "Bob" doesn't match a line from "Bob2".
  const names = seats.map((s) => s.name).sort((a, b) => b.length - a.length)
  const speaker = (line: string) => names.find((n) => line.startsWith(`${n}: `)) ?? null

  let heroName: string | null = null
  let heroCards: Card[] = []
  const shown = new Map<string, Card[]>()
  const board: Card[] = []
  const actions: ParsedAction[] = []
  for (const l of lines.slice(holeIndex + 1)) {
    if (l.startsWith('*** SUMMARY')) break
    const dealt = /^Dealt to (.+?) \[(\S\S) (\S\S)\]$/.exec(l)
    if (dealt) {
      heroName = dealt[1]
      heroCards = [parseCard(dealt[2]), parseCard(dealt[3])]
      continue
    }
    if (l.startsWith('***')) {
      if (/FIRST|SECOND/.test(l)) throw new Error('Run-it-twice hands are not supported.')
      const cards = [...l.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1].split(' ')).at(-1) ?? []
      if (/^\*\*\* (FLOP|TURN|RIVER) \*\*\*/.test(l)) board.push(...cards.map(parseCard))
      continue
    }
    const name = speaker(l)
    if (!name) continue
    const rest = l.slice(name.length + 2)
    const show = /^shows \[(\S\S) (\S\S)\]/.exec(rest)
    if (show) {
      shown.set(name, [parseCard(show[1]), parseCard(show[2])])
      continue
    }
    if (rest.startsWith('folds')) actions.push({ name, type: 'fold', to: 0 })
    else if (rest.startsWith('checks')) actions.push({ name, type: 'check', to: 0 })
    else if (rest.startsWith('calls')) actions.push({ name, type: 'call', to: 0 })
    else {
      const bet = /^bets [$€£]?([\d.,]+)/.exec(rest)
      const raise = /^raises [$€£]?[\d.,]+ to [$€£]?([\d.,]+)/.exec(rest)
      if (bet) actions.push({ name, type: 'bet', to: amount(bet[1]) })
      else if (raise) actions.push({ name, type: 'raise', to: amount(raise[1]) })
    }
  }
  if (!heroName) throw new Error('Could not find your hole cards ("Dealt to ...").')
  const heroIndex = seats.findIndex((s) => s.name === heroName)
  if (heroIndex < 0) throw new Error(`${heroName} is not seated in this hand.`)

  // Rotate so the hero is seat 0, keeping the clockwise order.
  const order = seats.map((_, i) => seats[(heroIndex + i) % seats.length])
  const buttonIndex = order.findIndex((s) => s.seat === buttonSeat)
  if (buttonIndex < 0) throw new Error('Dead-button hands are not supported.')

  const seed = hashSeed(`${site}-${handNumber}`)
  let s = createGame({ names: order.map((p) => p.name), stack: 1, smallBlind, bigBlind })
  order.forEach((p, i) => (s.players[i].stack = p.stack))
  s.button = (buttonIndex - 1 + order.length) % order.length
  s = startHand(s, seededRng(seed))

  const engineBlinds = s.events.flatMap((e) =>
    e.type === 'blind' ? [{ name: order[e.seat].name, amount: e.amount }] : [],
  )
  const matches =
    engineBlinds.length === blindPosts.length &&
    engineBlinds.every((b, i) => b.name === blindPosts[i].name && b.amount === blindPosts[i].amount)
  if (!matches) throw new Error('The blinds are not a standard deal (missing or extra blinds).')

  // Known cards first, then fill unknown hole cards and board cards from the rest.
  const known = new Set([...heroCards, ...board, ...[...shown.values()].flat()].map(cardToString))
  const unknown = shuffle(
    createDeck().filter((c) => !known.has(cardToString(c))),
    seededRng(seed + 1),
  )
  s.players.forEach((p, i) => {
    const name = order[i].name
    p.hole = i === 0 ? heroCards : (shown.get(name) ?? [unknown.pop()!, unknown.pop()!])
  })
  const runout = [...board]
  while (runout.length < 5) runout.push(unknown.pop()!)
  // dealStreet burns one card from the end of the deck, then takes the next cards.
  const popOrder = [
    unknown.pop()!,
    runout[0],
    runout[1],
    runout[2],
    unknown.pop()!,
    runout[3],
    unknown.pop()!,
    runout[4],
  ]
  s.deck = [...unknown, ...popOrder.reverse()]
  const initial = s

  const replay: ImportedHand['actions'] = []
  const decisions: ImportedHand['decisions'] = []
  for (const a of actions) {
    const seat = order.findIndex((p) => p.name === a.name)
    if (s.handOver) throw new Error(`The hand ended before ${a.name}'s ${a.type}.`)
    if (s.toAct !== seat) {
      throw new Error(`Expected ${order[s.toAct!].name} to act, but the history shows ${a.name}.`)
    }
    let action: Action
    if (a.type === 'bet' || a.type === 'raise') {
      const legal = legalActions(s)
      if (legal.maxRaiseTo === null) throw new Error(`${a.name} could not raise here.`)
      action = { type: 'raise', to: Math.min(legal.maxRaiseTo, Math.max(legal.minRaiseTo!, a.to)) }
    } else {
      action = { type: a.type }
    }
    try {
      if (seat === 0) decisions.push({ state: s, action })
      s = applyAction(s, action)
    } catch (e) {
      throw new Error(`Could not replay ${a.name}'s ${a.type}: ${(e as Error).message}`)
    }
    replay.push({ seat, action })
  }
  if (!s.handOver) throw new Error('The history ends before the hand is finished.')

  return {
    id: `${site === 'PokerStars' ? 'ps' : 'gg'}-${handNumber}`,
    site,
    handNumber,
    date,
    stakes,
    scale,
    heroName,
    initial,
    actions: replay,
    final: s,
    decisions,
  }
}

/** Every state of an imported hand, from the deal to the end, for a step-through replay. */
export function replayStates(hand: ImportedHand): GameState[] {
  const states = [hand.initial]
  for (const { action } of hand.actions) states.push(applyAction(states.at(-1)!, action))
  return states
}

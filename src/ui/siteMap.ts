import type { Difficulty, GeneratedKind } from '../engine/drills'
import type { IconName } from './Icon'
import type { Route } from './routes'

export type DrillMode = GeneratedKind | 'review'

/** Tile colors, from the `--hue-*` tokens. */
export type Hue = 'red' | 'amber' | 'green' | 'teal' | 'blue' | 'violet' | 'pink'

export interface DrillInfo {
  id: DrillMode
  title: string
  /** One line for menus. */
  short: string
  blurb: string
  icon: IconName
  hue: Hue
}

export const DRILLS: DrillInfo[] = [
  {
    id: 'outs',
    icon: 'target',
    hue: 'blue',
    title: 'Outs',
    short: 'Count the cards that improve you',
    blurb: 'Count the cards that improve your hand, and see how the rule of 2 and 4 compares.',
  },
  {
    id: 'callfold',
    icon: 'timer',
    hue: 'amber',
    title: 'Call or fold',
    short: 'Equity against pot odds, on the clock',
    blurb: 'Real spots facing a bet. Weigh equity against pot odds before the timer runs out.',
  },
  {
    id: 'preflop',
    icon: 'grid',
    hue: 'red',
    title: 'Preflop charts',
    short: 'Open, defend or face a 3-bet',
    blurb: 'Open, defend against an open, or face a 3-bet: raise, call or fold by the charts.',
  },
  {
    id: 'texture',
    icon: 'waves',
    hue: 'teal',
    title: 'Board texture',
    short: 'Suits, connectedness and wetness',
    blurb: 'Classify flops by suits, connectedness and how wet they are.',
  },
  {
    id: 'mdf',
    icon: 'percent',
    hue: 'violet',
    title: 'Defense and bluff math',
    short: 'MDF, bluff break-even and pot odds',
    blurb: 'Minimum defense frequency, bluff break-even and pot odds for any bet size.',
  },
  {
    id: 'combos',
    icon: 'cards',
    hue: 'green',
    title: 'Combos and blockers',
    short: 'Count combos left after blockers',
    blurb: 'Count how many combos of a hand remain once you see the board and your cards.',
  },
  {
    id: 'setmine',
    icon: 'gem',
    hue: 'pink',
    title: 'Set mining',
    short: 'Implied odds and SPR with small pairs',
    blurb: 'Is calling with a small pair profitable at this stack depth? Implied odds and SPR.',
  },
  {
    id: 'review',
    icon: 'repeat',
    hue: 'amber',
    title: 'Review missed spots',
    short: 'Spaced repetition of your misses',
    blurb: 'Spaced repetition: drills you missed and mistakes from your own hands come back here.',
  },
]

/** What each difficulty level deals, per drill. Medium is the original mix. */
export const DIFFICULTY_NOTES: Record<GeneratedKind, Record<Difficulty, string>> = {
  outs: {
    easy: 'Flops with a single draw.',
    medium: 'Flops and turns with a draw, sometimes with a pair.',
    hard: 'Combo draws and pairs plus draws, where outs overlap.',
  },
  callfold: {
    easy: 'Clear calls and folds, with 30 seconds on the clock.',
    medium: 'A mix of clear and close spots, with 20 seconds.',
    hard: 'Close spots, 3 to 8 points from the price, with 12 seconds.',
  },
  preflop: {
    easy: 'Opening ranges only, mostly clear-cut hands.',
    medium: 'Opens, defends and 3-bets, favoring hands near the edge.',
    hard: 'Defending and facing 3-bets, with hands at the edge of the range.',
  },
  texture: {
    easy: 'Boards that are mostly clear-cut.',
    medium: 'Any flop.',
    hard: 'Boards with two or more in-between labels.',
  },
  mdf: {
    easy: 'Half-pot and pot-sized bets into round pots.',
    medium: 'Common bet sizes from a quarter pot to twice the pot.',
    hard: 'Odd bet sizes up to 3× pot, into odd pots.',
  },
  combos: {
    easy: 'Flops only, and pairs or hands counted suited and offsuit together.',
    medium: 'Flops to rivers, with suited and offsuit targets.',
    hard: 'Turns and rivers, every rank blocked, mostly suited or offsuit.',
  },
  setmine: {
    easy: 'Clear calls and folds, at least 2 bb either way.',
    medium: 'Any stack depth and price.',
    hard: 'Close spots, within 1 bb of break-even.',
  },
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
}

/** Seconds on the call-or-fold timer at each difficulty. */
export const CALL_FOLD_SECONDS: Record<Difficulty, number> = { easy: 30, medium: 20, hard: 12 }

/** The drills that deal fresh questions, without the review deck. */
export const PRACTICE_DRILLS = DRILLS.filter((d) => d.id !== 'review')

export function isDrillMode(s: string): s is DrillMode {
  return DRILLS.some((d) => d.id === s)
}

export function drillInfo(mode: DrillMode): DrillInfo {
  return DRILLS.find((d) => d.id === mode)!
}

export interface ToolInfo {
  route: Route
  title: string
  short: string
  icon: IconName
  hue: Hue
}

export const STUDY_TOOLS: ToolInfo[] = [
  {
    route: { page: 'hands' },
    icon: 'layers',
    hue: 'blue',
    title: 'Hand histories',
    short: 'Replay and review hands from PokerStars or GGPoker',
  },
  {
    route: { page: 'charts' },
    icon: 'grid',
    hue: 'red',
    title: 'Preflop charts',
    short: 'Opening, defending and 3-bet ranges by position',
  },
  {
    route: { page: 'solver' },
    icon: 'cpu',
    hue: 'violet',
    title: 'River solver',
    short: 'Game-theory strategy for a single river spot',
  },
]

/** What to practice for each leak, and why it matters. */
export const LEAK_ADVICE: Record<string, { tip: string; drill?: DrillMode }> = {
  'Folded an opening hand': {
    tip: 'Folding hands from the chart gives up easy profit. Learn the opening ranges.',
    drill: 'preflop',
  },
  'Opened outside range': {
    tip: 'Opening too wide out of position costs chips over time.',
    drill: 'preflop',
  },
  Limped: {
    tip: 'Raise or fold when you are first in; limping invites trouble.',
    drill: 'preflop',
  },
  'Called without odds': {
    tip: 'Compare your equity with the price before calling.',
    drill: 'callfold',
  },
  'Folded with enough equity': {
    tip: 'When the pot lays you a good price, calling with a decent hand is profitable.',
    drill: 'callfold',
  },
  'Folded when check was free': { tip: 'Never fold when you can check for free.' },
  'Overfolded vs an open': {
    tip: 'You fold too many hands the charts defend against a raise.',
    drill: 'preflop',
  },
  'Defended too wide': {
    tip: 'Calling raises with weak hands bleeds chips, especially out of position.',
    drill: 'preflop',
  },
  'Overfolded vs a 3-bet': {
    tip: 'Folding too much to 3-bets lets opponents re-raise you with anything.',
    drill: 'preflop',
  },
  'Called a 3-bet too wide': {
    tip: 'Calling 3-bets with marginal hands puts you in big pots with a weak range.',
    drill: 'preflop',
  },
  'Light 3-bet': {
    tip: 'Re-raising outside the chart works only as a rare bluff.',
    drill: 'preflop',
  },
  'Light 4-bet': { tip: 'Four-bet bluffs are expensive; keep them rare.', drill: 'preflop' },
  'Missed river value': {
    tip: 'With a strong hand on the river, bet so worse hands can pay you off.',
  },
}

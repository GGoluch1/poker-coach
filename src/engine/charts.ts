import type { HandEvent } from './game'
import type { HandClass, Position, Range } from './range'
import { OPEN_RANGES, parseRange } from './range'

export type ChartSituation = 'open' | 'vsOpen' | 'vs3bet'
export type ChartAction = 'raise' | 'call' | 'fold'

/** A preflop chart for one situation: which hands raise, which call, the rest fold. */
export interface PreflopChart {
  id: string
  situation: ChartSituation
  /** Short name, e.g. "BTN vs CO open". */
  title: string
  /** The situation in words, e.g. "CO opens to 2.5 bb. You're on the BTN." */
  prompt: string
  /** What "raise" means here. */
  raiseLabel: 'Open' | '3-bet' | '4-bet'
  raise: Range
  call: Range
}

const chart = (
  id: string,
  situation: ChartSituation,
  title: string,
  prompt: string,
  raise: Range | string,
  call = '',
): PreflopChart => ({
  id,
  situation,
  title,
  prompt,
  raiseLabel: situation === 'open' ? 'Open' : situation === 'vsOpen' ? '3-bet' : '4-bet',
  raise: typeof raise === 'string' ? parseRange(raise) : raise,
  call: parseRange(call),
})

const OPEN_PROMPT = 'Everyone folds to you.'

/**
 * Approximate 6-max, 100 bb charts. Outside the big blind and the button, facing an open is
 * played 3-bet or fold, as most modern charts do.
 */
export const PREFLOP_CHARTS: PreflopChart[] = [
  ...(['UTG', 'HJ', 'CO', 'BTN', 'SB'] as const).map((pos) =>
    chart(
      `open-${pos}`,
      'open',
      `${pos} open`,
      `${OPEN_PROMPT} You're in the ${pos}.`,
      OPEN_RANGES[pos],
    ),
  ),
  chart(
    'vsopen-HJ-early',
    'vsOpen',
    'HJ vs UTG open',
    'UTG opens to 2.5 bb. You are in the HJ.',
    'TT+, AJs+, KQs, AQo+, A5s-A4s',
  ),
  chart(
    'vsopen-CO-early',
    'vsOpen',
    'CO vs UTG/HJ open',
    'UTG or HJ opens to 2.5 bb. You are in the CO.',
    'TT+, ATs+, KJs+, QJs, AQo+, A5s-A3s',
  ),
  chart(
    'vsopen-BTN-early',
    'vsOpen',
    'BTN vs UTG/HJ open',
    'UTG or HJ opens to 2.5 bb. You are on the BTN.',
    'QQ+, AKs, AKo, A5s-A4s',
    'JJ-22, AQs-ATs, KQs-KTs, QJs, QTs, JTs, T9s, 98s, 87s, 76s, AQo, KQo',
  ),
  chart(
    'vsopen-BTN-CO',
    'vsOpen',
    'BTN vs CO open',
    'CO opens to 2.5 bb. You are on the BTN.',
    'TT+, AJs+, KQs, AQo+, A5s-A2s, K9s, 76s, 65s',
    '99-22, ATs-A6s, KJs-KTs, QTs+, J9s+, T8s+, 97s+, 86s+, 75s+, 54s, AJo, ATo, KQo, KJo, QJo',
  ),
  chart(
    'vsopen-SB-early',
    'vsOpen',
    'SB vs UTG/HJ open',
    'UTG or HJ opens to 2.5 bb. You are in the SB.',
    'TT+, AJs+, KQs, AQo+, A5s-A4s',
  ),
  chart(
    'vsopen-SB-late',
    'vsOpen',
    'SB vs CO/BTN open',
    'CO or BTN opens to 2.5 bb. You are in the SB.',
    '88+, A9s+, KTs+, QTs+, JTs, T9s, 98s, 87s, 76s, ATo+, KJo+, A5s-A2s',
  ),
  chart(
    'vsopen-BB-early',
    'vsOpen',
    'BB vs UTG/HJ open',
    'UTG or HJ opens to 2.5 bb. You are in the BB.',
    'QQ+, AKs, AKo, A5s',
    'JJ-22, AQs-A6s, A4s-A2s, K9s+, Q9s+, J9s+, T8s+, 97s+, 86s+, 75s+, 64s+, 54s, AQo-ATo, KJo+, QJo',
  ),
  chart(
    'vsopen-BB-late',
    'vsOpen',
    'BB vs CO/BTN open',
    'CO or BTN opens to 2.5 bb. You are in the BB.',
    'TT+, AJs+, KQs, AQo+, A5s-A3s, 76s, 65s',
    '99-22, ATs-A6s, A2s, KJs-K5s, Q6s+, J7s+, T7s+, 96s+, 85s+, 74s+, 63s+, 53s+, 43s, AJo-A8o, KTo+, QTo+, JTo, T9o, 98o',
  ),
  chart(
    'vsopen-BB-SB',
    'vsOpen',
    'BB vs SB open',
    'SB opens to 3 bb. You are in the BB.',
    '99+, ATs+, KTs+, QJs, AJo+, KQo, A5s-A2s, 76s, 65s, 54s',
    '88-22, A9s-A6s, K9s-K2s, Q2s+, J5s+, T6s+, 96s+, 85s+, 74s+, 63s+, 53s+, 43s, ATo-A2o, KJo-K8o, QTo+, JTo, T9o, 98o, 87o',
  ),
  chart(
    'vs3bet-ip',
    'vs3bet',
    'Facing a 3-bet in position',
    'You open, and a player in the blinds 3-bets to about 10 bb. You will have position after the flop.',
    'QQ+, AKs, AKo, A5s-A4s',
    'JJ-66, AQs-ATs, KQs-KTs, QJs, QTs, JTs, T9s, 98s, AQo, KQo',
  ),
  chart(
    'vs3bet-oop',
    'vs3bet',
    'Facing a 3-bet out of position',
    'You open, and a player behind you 3-bets to about 8 bb. You will be out of position after the flop.',
    'QQ+, AKs, AKo, A5s',
    'JJ-99, AQs, AJs, KQs, JTs, AQo',
  ),
]

const BY_ID = new Map(PREFLOP_CHARTS.map((c) => [c.id, c]))

export function getChart(id: string): PreflopChart {
  const c = BY_ID.get(id)
  if (!c) throw new Error(`unknown chart: ${id}`)
  return c
}

export function chartAction(c: PreflopChart, cls: HandClass): ChartAction {
  return c.raise.has(cls) ? 'raise' : c.call.has(cls) ? 'call' : 'fold'
}

const EARLY: Position[] = ['UTG', 'HJ']
const LATE: Position[] = ['CO', 'BTN']

/** The chart for facing an open from `villain` while in `hero`, if one exists. */
export function vsOpenChartId(hero: Position, villain: Position): string | null {
  let key: string | null = null
  if (EARLY.includes(villain)) key = `${hero}-early`
  else if (hero === 'BTN' && villain === 'CO') key = 'BTN-CO'
  else if ((hero === 'SB' || hero === 'BB') && LATE.includes(villain)) key = `${hero}-late`
  else if (hero === 'BB' && villain === 'SB') key = 'BB-SB'
  return key && BY_ID.has(`vsopen-${key}`) ? `vsopen-${key}` : null
}

/**
 * Which chart applies to `seat`'s preflop decision given the action so far, or null when
 * none does (limped pots, 4-bet pots, the big blind's option).
 */
export function findPreflopChart(
  events: HandEvent[],
  seat: number,
  positions: (Position | null)[],
): PreflopChart | null {
  const hero = positions[seat]
  if (!hero) return null
  const raises = events.filter(
    (e): e is Extract<HandEvent, { type: 'action' }> =>
      e.type === 'action' && e.street === 'preflop' && e.action === 'raise',
  )
  if (raises.length === 0) return hero === 'BB' ? null : getChart(`open-${hero}`)
  if (raises.length === 1 && raises[0].seat !== seat) {
    const villain = positions[raises[0].seat]
    const id = villain ? vsOpenChartId(hero, villain) : null
    return id ? getChart(id) : null
  }
  if (raises.length === 2 && raises[0].seat === seat) {
    const threeBettor = positions[raises[1].seat]
    const blinds: (Position | null)[] = ['SB', 'BB']
    const inPosition = blinds.includes(threeBettor) && !blinds.includes(hero)
    return getChart(inPosition ? 'vs3bet-ip' : 'vs3bet-oop')
  }
  return null
}

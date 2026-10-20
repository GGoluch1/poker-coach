import type { Range } from './range'
import { CALL_RANGE, LIMP_RANGE, THREE_BET_RANGE, topRange } from './range'

export type Personality = 'balanced' | 'nit' | 'maniac' | 'station'

export interface BotProfile {
  id: Personality
  label: string
  /** For "All ..." in menus, e.g. "calling stations". */
  plural: string
  /** Short tag for a seat, e.g. "Station". */
  short: string
  description: string
  /** How to exploit this player. */
  tip: string
  /** How their preflop actions should be read. Null `open` means "use the opening charts". */
  reads: { open: Range | null; threeBet: Range; call: Range; limp: Range }
  /** Added to the minimum defense frequency when facing a bet (positive = calls more). */
  defendShift: number
}

export const PROFILES: Record<Personality, BotProfile> = {
  balanced: {
    id: 'balanced',
    label: 'Balanced',
    plural: 'balanced players',
    short: 'Balanced',
    description: 'Plays the charts preflop and bets for value and as a bluff after the flop.',
    tip: 'A solid player. Stick to fundamentals and avoid fancy plays.',
    reads: { open: null, threeBet: THREE_BET_RANGE, call: CALL_RANGE, limp: LIMP_RANGE },
    defendShift: 0,
  },
  nit: {
    id: 'nit',
    label: 'Nit',
    plural: 'nits',
    short: 'Nit',
    description: 'Plays very few hands and rarely bluffs.',
    tip: 'Steal their blinds and fold to their raises unless you are strong.',
    reads: {
      open: topRange(0.1),
      threeBet: topRange(0.03),
      call: topRange(0.12),
      limp: topRange(0.3),
    },
    defendShift: -0.15,
  },
  maniac: {
    id: 'maniac',
    label: 'Maniac',
    plural: 'maniacs',
    short: 'Maniac',
    description: 'Raises and bluffs constantly with a wide range.',
    tip: 'Call down lighter, let them bluff, and avoid bluffing back.',
    reads: {
      open: topRange(0.5),
      threeBet: topRange(0.2),
      call: topRange(0.5),
      limp: topRange(0.6),
    },
    defendShift: 0.1,
  },
  station: {
    id: 'station',
    label: 'Calling station',
    plural: 'calling stations',
    short: 'Station',
    description: 'Calls far too often and rarely raises.',
    tip: 'Value bet thinner and bigger, and almost never bluff.',
    reads: {
      open: topRange(0.04),
      threeBet: topRange(0.02),
      call: topRange(0.55),
      limp: topRange(0.5),
    },
    defendShift: 0.25,
  },
}

export const PERSONALITIES = Object.keys(PROFILES) as Personality[]

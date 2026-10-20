import type { Spot } from '../engine/analysis'
import { analyzeSpot } from '../engine/analysis'
import { chooseBotAction } from '../engine/bot'
import type { DrillItem, GeneratedKind } from '../engine/drills'
import { drillKey, generateDrill, handItem } from '../engine/drills'
import { chosenOption, optionEvs } from '../engine/ev'
import type { Action, GameState, Street } from '../engine/game'
import type { ImportedHand } from '../engine/handHistory'
import { parseHandHistory, splitHandHistories } from '../engine/handHistory'
import type { Personality } from '../engine/profiles'
import type { DecisionReview } from '../engine/review'
import { reviewDecision } from '../engine/review'
import { seededRng } from '../engine/rng'
import type { RiverGame, SolverResult } from '../engine/solver'
import { solveRiver } from '../engine/solver'
import type { PlayStats } from '../engine/stats'
import { handStats } from '../engine/stats'

export interface OptionEvBb {
  label: string
  /** Rough EV in big blinds relative to folding, or null when not estimated. */
  ev: number | null
  note: string
}

export interface ReviewedDecision {
  street: Street
  toCall: number
  currentBet: number
  action: Action
  review: DecisionReview
  options: OptionEvBb[]
  /** Index of the option taken in `options`, or -1. */
  chosen: number
  /** Big blinds given up versus the best estimated option, when both are known. */
  lostBb: number | null
}

export interface HandReviewResult {
  decisions: ReviewedDecision[]
  stats: PlayStats
  /** Mistakes turned into replayable spots for spaced repetition. */
  misses: { key: string; item: DrillItem }[]
}

export interface ImportResult {
  hands: ImportedHand[]
  errors: { header: string; message: string }[]
}

type Profiles = (Personality | undefined)[]

/** Every job the worker runs: request payload and result. */
export interface WorkerApi {
  analyze: {
    req: { state: GameState; seat: number; iterations: number; seed: number; profiles?: Profiles }
    res: Spot
  }
  bot: {
    req: { state: GameState; seed: number; personality?: Personality; profiles?: Profiles }
    res: Action
  }
  reviewHand: {
    req: {
      id: string
      final: GameState
      decisions: { state: GameState; action: Action }[]
      seat: number
      profiles?: Profiles
      /** Label for replayed spots, e.g. "Hand #12". */
      source?: string
    }
    res: HandReviewResult
  }
  drill: { req: { kind: GeneratedKind; seed: number }; res: DrillItem }
  solve: { req: { game: RiverGame; iterations: number }; res: SolverResult }
  importHands: { req: { text: string }; res: ImportResult }
}

export type JobType = keyof WorkerApi

/** Seed derived from a string, so a hand's review is the same every time. */
function hashSeed(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

export function runJob<K extends JobType>(type: K, req: WorkerApi[K]['req']): WorkerApi[K]['res'] {
  const run = jobs[type] as (req: WorkerApi[K]['req']) => WorkerApi[K]['res']
  return run(req)
}

const jobs: { [K in JobType]: (req: WorkerApi[K]['req']) => WorkerApi[K]['res'] } = {
  analyze: ({ state, seat, iterations, seed, profiles }) =>
    analyzeSpot(state, seat, { iterations, rng: seededRng(seed), profiles }),

  bot: ({ state, seed, personality, profiles }) =>
    chooseBotAction(state, seededRng(seed), personality, profiles),

  reviewHand: ({ id, final, decisions, seat, profiles = [], source }) => {
    const rng = seededRng(hashSeed(id))
    const reviewed = decisions.map(({ state, action }) => {
      const spot = analyzeSpot(state, seat, { iterations: 2500, rng, profiles })
      const evs = optionEvs(state, seat, spot, action.type === 'raise' ? action.to : null, {
        iterations: 1200,
        rng,
        profiles,
      })
      const chosen = chosenOption(evs, action)
      const known = evs.filter((o) => o.ev !== null).map((o) => o.ev!)
      const mine = chosen >= 0 ? evs[chosen].ev : null
      return {
        state,
        street: state.street,
        toCall: spot.toCall,
        currentBet: state.currentBet,
        action,
        review: reviewDecision(spot, action),
        options: evs.map((o) => ({
          label: o.label,
          ev: o.ev === null ? null : o.ev / state.bigBlind,
          note: o.note,
        })),
        chosen,
        lostBb:
          mine === null || known.length < 2
            ? null
            : Math.max(0, Math.max(...known) - mine) / state.bigBlind,
      }
    })
    const misses = reviewed
      .filter((d) => d.review.verdict === 'mistake' || d.review.verdict === 'blunder')
      .map((d) => {
        const item = handItem(d.state, seat, source ?? `Hand #${final.handNumber}`, rng, profiles)
        return { key: `${drillKey(item)}:${id}`, item }
      })
    return {
      decisions: reviewed.map(({ state: _state, ...rest }) => rest),
      stats: handStats(final, seat),
      misses,
    }
  },

  drill: ({ kind, seed }) => generateDrill(kind, seededRng(seed)),

  solve: ({ game, iterations }) => solveRiver(game, iterations),

  importHands: ({ text }) => {
    const result: ImportResult = { hands: [], errors: [] }
    for (const chunk of splitHandHistories(text)) {
      try {
        result.hands.push(parseHandHistory(chunk))
      } catch (e) {
        result.errors.push({
          header: chunk.split(/\r?\n/)[0].slice(0, 80),
          message: e instanceof Error ? e.message : String(e),
        })
      }
    }
    return result
  },
}

import type { Spot } from '../engine/analysis'
import { analyzeSpot } from '../engine/analysis'
import { chooseBotAction } from '../engine/bot'
import type { DrillItem, DrillKind } from '../engine/drills'
import { drillKey, generateDrill, handItem } from '../engine/drills'
import type { Action, GameState, Street } from '../engine/game'
import type { DecisionReview } from '../engine/review'
import { reviewDecision } from '../engine/review'
import { seededRng } from '../engine/rng'
import type { RiverGame, SolverResult } from '../engine/solver'
import { solveRiver } from '../engine/solver'
import type { PlayStats } from '../engine/stats'
import { handStats } from '../engine/stats'

export interface ReviewedDecision {
  street: Street
  toCall: number
  currentBet: number
  action: Action
  review: DecisionReview
}

export interface HandReviewResult {
  decisions: ReviewedDecision[]
  stats: PlayStats
  /** Mistakes turned into replayable spots for spaced repetition. */
  misses: { key: string; item: DrillItem }[]
}

/** Every job the worker runs: request payload and result. */
export interface WorkerApi {
  analyze: { req: { state: GameState; seat: number; iterations: number; seed: number }; res: Spot }
  bot: { req: { state: GameState; seed: number }; res: Action }
  reviewHand: {
    req: {
      id: string
      final: GameState
      decisions: { state: GameState; action: Action }[]
      seat: number
    }
    res: HandReviewResult
  }
  drill: { req: { kind: Exclude<DrillKind, 'hand'>; seed: number }; res: DrillItem }
  solve: { req: { game: RiverGame; iterations: number }; res: SolverResult }
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
  analyze: ({ state, seat, iterations, seed }) =>
    analyzeSpot(state, seat, { iterations, rng: seededRng(seed) }),

  bot: ({ state, seed }) => chooseBotAction(state, seededRng(seed)),

  reviewHand: ({ id, final, decisions, seat }) => {
    const rng = seededRng(hashSeed(id))
    const reviewed = decisions.map(({ state, action }) => {
      const spot = analyzeSpot(state, seat, { iterations: 2500, rng })
      return {
        state,
        street: state.street,
        toCall: spot.toCall,
        currentBet: state.currentBet,
        action,
        review: reviewDecision(spot, action),
      }
    })
    const misses = reviewed
      .filter((d) => d.review.verdict === 'mistake' || d.review.verdict === 'blunder')
      .map((d) => {
        const item = handItem(d.state, seat, `Hand #${final.handNumber}`, rng)
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
}

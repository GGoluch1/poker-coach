import { useSyncExternalStore } from 'react'
import type { DayLog } from '../engine/activity'
import { logDay } from '../engine/activity'
import type { DrillItem, DrillKind } from '../engine/drills'
import type { Street } from '../engine/game'
import type { SrsCard } from '../engine/srs'
import { addMiss, recordAnswer } from '../engine/srs'
import type { PlayStats } from '../engine/stats'
import { EMPTY_STATS, addStats } from '../engine/stats'
import type { HandReviewResult } from '../worker/handlers'

const STORAGE_KEY = 'poker-coach:progress:v1'

export interface Leak {
  count: number
  /** Estimated big blinds given up, where the EV of the options could be estimated. */
  bbLost?: number
  streets: Partial<Record<Street, number>>
  lastSeen: number
}

export interface DrillScore {
  attempts: number
  correct: number
  streak: number
  bestStreak: number
}

export interface Progress {
  stats: PlayStats
  /** Mistakes from played hands, grouped by review category. */
  leaks: Record<string, Leak>
  drills: Partial<Record<DrillKind, DrillScore>>
  deck: SrsCard<DrillItem>[]
  /** Practice per day, oldest first. */
  days: DayLog[]
  /** Ids of hands already counted, newest last. */
  processed: string[]
}

const empty = (): Progress => ({
  stats: EMPTY_STATS,
  leaks: {},
  drills: {},
  deck: [],
  days: [],
  processed: [],
})

function load(): Progress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...empty(), ...(JSON.parse(raw) as Progress) }
  } catch {
    // Unreadable or blocked storage: start fresh.
  }
  return empty()
}

let state: Progress = load()
const listeners = new Set<() => void>()

export function updateProgress(fn: (p: Progress) => Progress) {
  state = fn(state)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Progress still works for this session.
  }
  for (const l of listeners) l()
}

export function useProgress(): Progress {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

export function resetProgress() {
  updateProgress(() => empty())
}

/** Adds a reviewed hand's stats, leaks and missed spots, once per hand. */
export function recordHand(id: string, result: HandReviewResult, now = Date.now()) {
  updateProgress((p) => {
    if (p.processed.includes(id)) return p
    const leaks = { ...p.leaks }
    for (const d of result.decisions) {
      if (d.review.verdict !== 'mistake' && d.review.verdict !== 'blunder') continue
      const prev = leaks[d.review.category] ?? { count: 0, streets: {}, lastSeen: 0 }
      leaks[d.review.category] = {
        count: prev.count + 1,
        bbLost: (prev.bbLost ?? 0) + (d.lostBb ?? 0),
        streets: { ...prev.streets, [d.street]: (prev.streets[d.street] ?? 0) + 1 },
        lastSeen: now,
      }
    }
    let deck = p.deck
    for (const miss of result.misses) deck = addMiss(deck, miss.key, miss.item, now)
    return {
      ...p,
      stats: addStats(p.stats, result.stats),
      leaks,
      deck,
      days: logDay(p.days, now, { hands: result.stats.hands, bigBlinds: result.stats.bigBlinds }),
      processed: [...p.processed, id].slice(-200),
    }
  })
}

export function recordDrill(kind: DrillKind, correct: boolean) {
  updateProgress((p) => {
    const prev = p.drills[kind] ?? { attempts: 0, correct: 0, streak: 0, bestStreak: 0 }
    const streak = correct ? prev.streak + 1 : 0
    return {
      ...p,
      drills: {
        ...p.drills,
        [kind]: {
          attempts: prev.attempts + 1,
          correct: prev.correct + (correct ? 1 : 0),
          streak,
          bestStreak: Math.max(prev.bestStreak, streak),
        },
      },
      days: logDay(p.days, Date.now(), { answers: 1, correct: correct ? 1 : 0 }),
    }
  })
}

/** Updates the spaced-repetition deck after a drill answer. */
export function recordDeckAnswer(
  item: DrillItem,
  key: string,
  fromDeck: boolean,
  correct: boolean,
) {
  const now = Date.now()
  updateProgress((p) => ({
    ...p,
    deck: fromDeck
      ? recordAnswer(p.deck, key, correct, now)
      : correct
        ? p.deck
        : addMiss(p.deck, key, item, now),
  }))
}

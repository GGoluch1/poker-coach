import { useCallback, useEffect, useState } from 'react'
import type { Action, GameState } from '../engine/game'
import { applyAction, createGame, isGameOver, startHand } from '../engine/game'
import type { Personality } from '../engine/profiles'
import { PERSONALITIES } from '../engine/profiles'
import type { PlayStats } from '../engine/stats'
import { EMPTY_STATS, addStats, handStats } from '../engine/stats'
import { randomSeed, reviewHand, runInWorker } from '../worker/client'
import { recordHand } from './progress'

export const HERO = 0
const BOT_NAMES = ['Ava', 'Ben', 'Cleo', 'Dev', 'Eli']
const STORAGE_KEY = 'poker-coach:session:v3'
const STARTING_STACK = 200

/** Who sits at the table: everyone the same personality, or a random mix. */
export type Lineup = Personality | 'mixed'
const HISTORY_LIMIT = 30

export interface Decision {
  /** State just before the hero acted. */
  state: GameState
  action: Action
}

export interface HandRecord {
  /** Unique across games, e.g. "k3x9-12". */
  id: string
  final: GameState
  decisions: Decision[]
  /** Personality per seat; undefined for the hero. */
  profiles: (Personality | undefined)[]
  /** Label for replayed spots; defaults to "Hand #N". */
  source?: string
}

interface Session {
  gameId: string
  game: GameState
  profiles: (Personality | undefined)[]
  /** Running stats for every seat this game, shown on the bots' seats. */
  seatStats: PlayStats[]
  /** Hero decisions in the hand being played. */
  decisions: Decision[]
  /** Finished hands, newest first. */
  history: HandRecord[]
}

function freshSession(opponents: number, lineup: Lineup): Session {
  const game = createGame({
    names: ['Hero', ...BOT_NAMES.slice(0, opponents)],
    stack: STARTING_STACK,
    smallBlind: 1,
    bigBlind: 2,
  })
  const gameId = Math.random().toString(36).slice(2, 8)
  const profiles = game.players.map((_, seat) =>
    seat === HERO
      ? undefined
      : lineup === 'mixed'
        ? PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)]
        : lineup,
  )
  return deal({
    gameId,
    game,
    profiles,
    seatStats: game.players.map(() => EMPTY_STATS),
    decisions: [],
    history: [],
  })
}

/** Records the hand if it just ended. */
function settle(s: Session): Session {
  if (!s.game.handOver) return s
  const record: HandRecord = {
    id: `${s.gameId}-${s.game.handNumber}`,
    final: s.game,
    decisions: s.decisions,
    profiles: s.profiles,
  }
  return {
    ...s,
    seatStats: s.seatStats.map((st, seat) => addStats(st, handStats(s.game, seat))),
    decisions: [],
    history: [record, ...s.history].slice(0, HISTORY_LIMIT),
  }
}

/** The hero is out of chips (and hasn't rebought) or has won every chip. */
export function sessionOver(game: GameState): boolean {
  return isGameOver(game) || (game.handOver && game.players[HERO].stack === 0)
}

function deal(s: Session): Session {
  if (sessionOver(s.game)) return s
  return settle({ ...s, game: startHand(s.game), decisions: [] })
}

function act(s: Session, action: Action): Session {
  if (s.game.handOver || s.game.toAct === null) return s
  const decisions =
    s.game.toAct === HERO ? [...s.decisions, { state: s.game, action }] : s.decisions
  return settle({ ...s, game: applyAction(s.game, action), decisions })
}

function load(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Session
    return s.gameId && s.game?.players?.length >= 2 && Array.isArray(s.history) && s.seatStats
      ? s
      : null
  } catch {
    return null
  }
}

export function reviewRecord(record: HandRecord) {
  return reviewHand({
    id: record.id,
    final: record.final,
    decisions: record.decisions,
    seat: HERO,
    profiles: record.profiles,
    source: record.source,
  })
}

export function useGame() {
  const [session, setSession] = useState<Session>(() => load() ?? freshSession(5, 'mixed'))
  const { game } = session
  const latest = session.history[0]

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    } catch {
      // Storage full or blocked: the game still works, it just won't survive a reload.
    }
  }, [session])

  // Bots decide in the worker after a short pause so the hero can follow along.
  useEffect(() => {
    if (game.handOver || game.toAct === null || game.toAct === HERO) return
    const heroWatching = game.players[HERO].inHand && !game.players[HERO].folded
    let live = true
    const timer = setTimeout(
      () => {
        const personality = session.profiles[game.toAct!] ?? 'balanced'
        runInWorker('bot', {
          state: game,
          seed: randomSeed(),
          personality,
          profiles: session.profiles,
        }).then((action) => {
          if (live) setSession((s) => (s.game === game ? act(s, action) : s))
        })
      },
      heroWatching ? 700 : 250,
    )
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [game, session.profiles])

  // Review each finished hand once for stats, leaks and spaced repetition.
  useEffect(() => {
    if (!latest) return
    reviewRecord(latest).then((result) => recordHand(latest.id, result))
  }, [latest])

  return {
    game,
    profiles: session.profiles,
    seatStats: session.seatStats,
    history: session.history,
    heroAct: useCallback((action: Action) => setSession((s) => act(s, action)), []),
    nextHand: useCallback(() => setSession((s) => deal(s)), []),
    rebuy: useCallback(
      () =>
        setSession((s) => {
          if (!s.game.handOver || s.game.players[HERO].stack > 0) return s
          const game = structuredClone(s.game)
          game.players[HERO].stack = STARTING_STACK
          return deal({ ...s, game })
        }),
      [],
    ),
    newGame: useCallback(
      (opponents: number, lineup: Lineup) => setSession(freshSession(opponents, lineup)),
      [],
    ),
  }
}

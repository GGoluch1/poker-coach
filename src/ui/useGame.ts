import { useCallback, useEffect, useState } from 'react'
import { chooseBotAction } from '../engine/bot'
import type { Action, GameState } from '../engine/game'
import { applyAction, createGame, isGameOver, startHand } from '../engine/game'

export const HERO = 0
const BOT_NAMES = ['Ava', 'Ben', 'Cleo', 'Dev', 'Eli']
const STORAGE_KEY = 'poker-coach:session:v1'
const HISTORY_LIMIT = 30

export interface Decision {
  /** State just before the hero acted. */
  state: GameState
  action: Action
}

export interface HandRecord {
  final: GameState
  decisions: Decision[]
}

interface Session {
  game: GameState
  /** Hero decisions in the hand being played. */
  decisions: Decision[]
  /** Finished hands, newest first. */
  history: HandRecord[]
}

function freshSession(opponents: number): Session {
  const game = createGame({
    names: ['Hero', ...BOT_NAMES.slice(0, opponents)],
    stack: 200,
    smallBlind: 1,
    bigBlind: 2,
  })
  return deal({ game, decisions: [], history: [] })
}

/** Records the hand if it just ended. */
function settle(s: Session): Session {
  if (!s.game.handOver) return s
  const record = { final: s.game, decisions: s.decisions }
  return { game: s.game, decisions: [], history: [record, ...s.history].slice(0, HISTORY_LIMIT) }
}

function deal(s: Session): Session {
  if (isGameOver(s.game)) return s
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
    return s.game?.players?.length >= 2 && Array.isArray(s.history) ? s : null
  } catch {
    return null
  }
}

export function useGame() {
  const [session, setSession] = useState<Session>(() => load() ?? freshSession(5))
  const { game } = session

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    } catch {
      // Storage full or blocked: the game still works, it just won't survive a reload.
    }
  }, [session])

  // Bots act on their own after a short pause so the hero can follow along.
  useEffect(() => {
    if (game.handOver || game.toAct === null || game.toAct === HERO) return
    const heroWatching = game.players[HERO].inHand && !game.players[HERO].folded
    const timer = setTimeout(
      () => setSession((s) => act(s, chooseBotAction(s.game))),
      heroWatching ? 700 : 300,
    )
    return () => clearTimeout(timer)
  }, [game])

  return {
    game,
    history: session.history,
    heroAct: useCallback((action: Action) => setSession((s) => act(s, action)), []),
    nextHand: useCallback(() => setSession((s) => deal(s)), []),
    newGame: useCallback((opponents: number) => setSession(freshSession(opponents)), []),
  }
}

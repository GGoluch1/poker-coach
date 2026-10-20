import { describe, it, expect } from 'vitest'
import { chooseBotAction } from './bot'
import { parseCards } from './card'
import type { GameState } from './game'
import { applyAction, createGame, isGameOver, startHand } from './game'
import { seededRng } from './rng'

const table = (n: number) =>
  createGame({
    names: Array.from({ length: n }, (_, i) => `Bot ${i + 1}`),
    stack: 200,
    smallBlind: 1,
    bigBlind: 2,
  })

describe('chooseBotAction', () => {
  it('plays whole games with only legal actions', () => {
    const rng = seededRng(11)
    for (const n of [2, 3, 6]) {
      let s = table(n)
      for (let h = 0; h < 60 && !isGameOver(s); h++) {
        s = startHand(s, rng)
        // applyAction throws on anything illegal.
        while (!s.handOver) s = applyAction(s, chooseBotAction(s, rng))
      }
      expect(s.players.reduce((sum, p) => sum + p.stack, 0)).toBe(200 * n)
    }
  })

  it('opens aces and folds junk under the gun', () => {
    const rigged = (hole: string): GameState => {
      const s = startHand(table(6), seededRng(1))
      s.players[s.toAct!].hole = parseCards(hole)
      return s
    }
    const rng = seededRng(5)
    expect(chooseBotAction(rigged('As Ah'), rng).type).toBe('raise')
    expect(chooseBotAction(rigged('7c 2d'), () => 0.5).type).toBe('fold')
  })

  it('does not fold the nuts on the river', () => {
    let s = startHand(table(2), seededRng(1))
    s = applyAction(s, { type: 'call' })
    s = applyAction(s, { type: 'check' })
    s.board = parseCards('As Ks Qs 2d 3c')
    s.street = 'river'
    s.players[s.toAct!].hole = parseCards('Js Ts')
    for (const p of s.players) if (p !== s.players[s.toAct!]) p.hole = parseCards('7h 7d')
    s.currentBet = 0
    const action = chooseBotAction(s, seededRng(2))
    expect(['raise', 'check']).toContain(action.type)
  })
})

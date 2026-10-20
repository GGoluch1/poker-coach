import { chooseBotAction } from './bot'
import type { GameState, Street } from './game'
import { applyAction, createGame, legalActions, startHand } from './game'
import type { Rng } from './rng'

export interface SpotRequest {
  street?: Street
  /** Require the hero to be facing a bet (true) or checked to (false). */
  facingBet?: boolean
  /** Players dealt in, 2-6; random when omitted. */
  players?: number
  rng?: Rng
}

const STREETS: Street[] = ['preflop', 'flop', 'turn', 'river']

/**
 * Plays bot-vs-bot hands from a random deal until seat 0 has a decision that
 * matches the request, and returns that state. Positions, stacks, action history
 * and pot are all consistent because they come from a real hand.
 */
export function generateSpot({
  street = 'flop',
  facingBet,
  players,
  rng = Math.random,
}: SpotRequest = {}): GameState {
  const target = STREETS.indexOf(street)
  for (let attempt = 0; attempt < 500; attempt++) {
    const n = players ?? 2 + Math.floor(rng() * 5)
    let s = createGame({
      names: Array.from({ length: n }, (_, i) => (i === 0 ? 'Hero' : `Player ${i}`)),
      stack: 200,
      smallBlind: 1,
      bigBlind: 2,
    })
    // Vary stack depth from 50 to 150 big blinds and the hero's position.
    for (const p of s.players) p.stack = 100 + 2 * Math.floor(rng() * 100)
    s.button = Math.floor(rng() * n)
    s = startHand(s, rng)

    while (!s.handOver && STREETS.indexOf(s.street) <= target) {
      if (s.toAct === 0 && s.street === street) {
        const toCall = legalActions(s).toCall
        if (facingBet === undefined || toCall > 0 === facingBet) return s
      }
      s = applyAction(s, chooseBotAction(s, rng))
      if (s.players[0].folded) break
    }
  }
  throw new Error(`could not generate a ${street} spot`)
}

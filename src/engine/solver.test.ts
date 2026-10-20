import { describe, it, expect } from 'vitest'
import { parseCards } from './card'
import { parseRange } from './range'
import { solveRiver } from './solver'

// OOP holds top set (KK) or air (65s); IP holds a bluff catcher (QJs) on a dry river.
// Theory for a pot-sized bet: value bets always, bluffs 1 for every 2 value combos,
// and IP calls half the time (minimum defense frequency).
const polarized = {
  board: parseCards('Kh Qh 7c 4d 2s'),
  ranges: [parseRange('KK, 65s'), parseRange('QJs')] as [Set<string>, Set<string>],
  pot: 10,
  stack: 100,
  betSizes: [1],
}

describe('solveRiver', () => {
  it('finds the textbook polarized equilibrium', () => {
    const result = solveRiver(polarized, 2000)
    const root = result.nodes.find((n) => n.path === '')!
    expect(root.actions).toEqual(['Check', 'Bet 10'])
    const kk = root.classes.find((c) => c.cls === 'KK')!
    const air = root.classes.find((c) => c.cls === '65s')!
    expect(kk.combos).toBe(3)
    expect(kk.freqs[1]).toBeGreaterThan(0.97)
    // 3 value combos support 1.5 bluff combos out of 4.
    expect(air.freqs[1]).toBeCloseTo(0.375, 1)

    const ipFacingBet = result.nodes.find((n) => n.path === 'b0')!
    expect(ipFacingBet.actions).toEqual(['Fold', 'Call'])
    expect(ipFacingBet.overall[1]).toBeCloseTo(0.5, 1)
    expect(result.exploitability).toBeLessThan(0.01)
  })

  it('reports EVs that add up to the pot', () => {
    const { ev } = solveRiver(polarized, 300)
    expect(ev[0] + ev[1]).toBeCloseTo(10, 5)
  })

  it('becomes less exploitable with more iterations', () => {
    const game = {
      board: parseCards('As 9d 6c 3h 2s'),
      ranges: [
        parseRange('AJs+, 99, 66, 87s, T8s, 54s, KQs'),
        parseRange('AQ+, ATs, 98s, TT-77'),
      ] as [Set<string>, Set<string>],
      pot: 20,
      stack: 80,
      betSizes: [0.5, 1],
    }
    const few = solveRiver(game, 20)
    const many = solveRiver(game, 600)
    expect(many.exploitability).toBeLessThan(few.exploitability)
    expect(many.exploitability).toBeLessThan(0.02)
  })

  it('caps bets at the stack and labels all-ins', () => {
    const result = solveRiver({ ...polarized, stack: 6, betSizes: [0.5, 1] }, 50)
    expect(result.nodes.find((n) => n.path === '')!.actions).toEqual(['Check', 'Bet 5', 'All in 6'])
  })
})

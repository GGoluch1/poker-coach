import { describe, it, expect } from 'vitest'
import { awardPots, buildPots } from './pot'

describe('buildPots', () => {
  it('makes a single pot when everyone commits the same', () => {
    expect(buildPots([50, 50, 50], [false, false, false])).toEqual([
      { amount: 150, eligible: [0, 1, 2] },
    ])
  })

  it('makes side pots for all-ins at different levels', () => {
    expect(buildPots([20, 50, 100, 100], [false, false, false, false])).toEqual([
      { amount: 80, eligible: [0, 1, 2, 3] },
      { amount: 90, eligible: [1, 2, 3] },
      { amount: 100, eligible: [2, 3] },
    ])
  })

  it('keeps folded chips in the pot without making the folder eligible', () => {
    expect(buildPots([30, 100, 60], [true, false, false])).toEqual([
      { amount: 150, eligible: [1, 2] },
      { amount: 40, eligible: [1] },
    ])
  })

  it('puts folded chips above every live level into the last pot', () => {
    expect(buildPots([80, 50, 50], [true, false, false])).toEqual([
      { amount: 180, eligible: [1, 2] },
    ])
  })

  it('conserves chips', () => {
    const committed = [7, 130, 45, 45, 0, 200]
    const folded = [true, false, false, true, true, false]
    const total = buildPots(committed, folded).reduce((s, p) => s + p.amount, 0)
    expect(total).toBe(committed.reduce((a, b) => a + b))
  })
})

describe('awardPots', () => {
  it('gives each pot to the best eligible hand', () => {
    const pots = buildPots([20, 50, 50], [false, false, false])
    // Seat 0 has the best hand but is only eligible for the main pot.
    const shares = awardPots(pots, [300, 100, 200], 0)
    expect(shares).toEqual([
      { seat: 0, amount: 60, potIndex: 0 },
      { seat: 2, amount: 60, potIndex: 1 },
    ])
  })

  it('splits ties and gives the odd chip left of the button', () => {
    const shares = awardPots([{ amount: 25, eligible: [0, 1, 2] }], [100, 100, 50], 0)
    expect(shares).toEqual([
      { seat: 1, amount: 13, potIndex: 0 },
      { seat: 0, amount: 12, potIndex: 0 },
    ])
  })

  it('skips seats without a hand', () => {
    const shares = awardPots([{ amount: 40, eligible: [0, 1] }], [null, 10], 0)
    expect(shares).toEqual([{ seat: 1, amount: 40, potIndex: 0 }])
  })
})

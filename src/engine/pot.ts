export interface Pot {
  amount: number
  /** Seats that can win this pot. */
  eligible: number[]
}

export interface PotShare {
  seat: number
  amount: number
  potIndex: number
}

/**
 * Splits each seat's total commitment into a main pot and side pots.
 * Folded seats' chips stay in the pots but they can't win them.
 */
export function buildPots(committed: number[], folded: boolean[]): Pot[] {
  const levels = [...new Set(committed.filter((c, i) => c > 0 && !folded[i]))].sort((a, b) => a - b)
  const pots: Pot[] = []
  let prev = 0
  for (const level of levels) {
    let amount = 0
    for (const c of committed) amount += Math.min(c, level) - Math.min(c, prev)
    const eligible = committed.flatMap((c, i) => (c >= level && !folded[i] ? [i] : []))
    pots.push({ amount, eligible })
    prev = level
  }
  // Chips a folded seat put in above every live seat's commitment go to the last pot.
  const leftover = committed.reduce((sum, c) => sum + Math.max(0, c - prev), 0)
  if (leftover > 0 && pots.length > 0) pots[pots.length - 1].amount += leftover
  return pots
}

/**
 * Awards each pot to its best eligible hands. `scores[seat]` is the hand score, or null
 * for seats without a hand. Odd chips go to winners closest to the left of `button`.
 */
export function awardPots(pots: Pot[], scores: (number | null)[], button: number): PotShare[] {
  const n = scores.length
  const distance = (seat: number) => (seat - button - 1 + n) % n
  const shares: PotShare[] = []
  pots.forEach((pot, potIndex) => {
    const contenders = pot.eligible.filter((s) => scores[s] !== null)
    if (contenders.length === 0) return
    const best = Math.max(...contenders.map((s) => scores[s]!))
    const winners = contenders
      .filter((s) => scores[s] === best)
      .sort((a, b) => distance(a) - distance(b))
    const each = Math.floor(pot.amount / winners.length)
    let odd = pot.amount - each * winners.length
    for (const seat of winners) {
      shares.push({ seat, amount: each + (odd > 0 ? 1 : 0), potIndex })
      if (odd > 0) odd--
    }
  })
  return shares
}

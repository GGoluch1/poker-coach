import type { Spot } from './analysis'
import type { Action } from './game'
import { STRENGTH_PERCENTILE } from './range'

export type Verdict = 'good' | 'ok' | 'mistake' | 'blunder'

export interface DecisionReview {
  verdict: Verdict
  message: string
}

const pct = (x: number) => `${Math.round(x * 100)}%`

/** Grades one decision against the charts and the equity-versus-pot-odds math. */
export function reviewDecision(spot: Spot, action: Action): DecisionReview {
  const { handClass: cls, position: pos } = spot
  const strength = STRENGTH_PERCENTILE.get(cls)!

  if (spot.openAdvice) {
    const inRange = spot.openAdvice === 'raise'
    if (action.type === 'raise') {
      return inRange
        ? { verdict: 'good', message: `Standard open: ${cls} is in the ${pos} opening range.` }
        : {
            verdict: strength > 0.6 ? 'mistake' : 'ok',
            message: `${cls} is outside a standard ${pos} opening range. Folding loses less over time.`,
          }
    }
    if (action.type === 'call') {
      return {
        verdict: 'mistake',
        message: inRange
          ? `Limping gives up the initiative. ${cls} is a raise from ${pos}.`
          : `Limping ${cls} from ${pos} loses chips. It's outside the opening range, so fold.`,
      }
    }
    if (action.type === 'fold') {
      return inRange
        ? {
            verdict: strength <= 0.1 ? 'blunder' : 'mistake',
            message: `Folded ${cls}, which is in the standard ${pos} opening range. Raise it.`,
          }
        : { verdict: 'good', message: `Correct fold: ${cls} is outside the ${pos} opening range.` }
    }
  }

  const equity = spot.equity?.equity
  if (equity === undefined) return { verdict: 'ok', message: 'No equity estimate for this spot.' }
  const eq = pct(equity)

  if (spot.toCall === 0) {
    if (action.type === 'fold') {
      return { verdict: 'blunder', message: 'Folded when checking was free. Always check instead.' }
    }
    if (action.type === 'check') {
      if (spot.street === 'river' && equity > 0.75) {
        return {
          verdict: 'mistake',
          message: `Missed value: checked the river with ${eq} equity. Bet so worse hands can pay you.`,
        }
      }
      if (spot.street !== 'preflop' && equity > 0.8) {
        return {
          verdict: 'ok',
          message: `Checked a very strong hand (${eq}). Betting builds the pot.`,
        }
      }
      return { verdict: 'good', message: `Check is fine with ${eq} equity.` }
    }
    if (equity >= 0.55) return { verdict: 'good', message: `Value bet with ${eq} equity.` }
    if (equity < 0.35) {
      return {
        verdict: 'ok',
        message: `Bluff with ${eq} equity. It only works if they fold often.`,
      }
    }
    return { verdict: 'ok', message: `Thin bet with ${eq} equity. Checking is also reasonable.` }
  }

  const need = spot.requiredEquity
  const margin = spot.street === 'preflop' ? 0.08 : 0.05
  const odds = `you had ${eq} equity and needed ${pct(need)} to call`
  const drawing = spot.street !== 'river' && spot.outs.reduce((n, g) => n + g.cards.length, 0) >= 8

  switch (action.type) {
    case 'fold':
      if (equity > need + 0.15)
        return { verdict: 'blunder', message: `Folded too much equity: ${odds}.` }
      if (equity > need + margin)
        return { verdict: 'mistake', message: `Profitable call folded: ${odds}.` }
      return { verdict: 'good', message: `Good fold: ${odds}.` }
    case 'call':
    case 'check':
      if (equity < need - margin) {
        return drawing
          ? {
              verdict: 'ok',
              message: `Thin call on a draw: ${odds}. It's only OK if you win a big pot when you hit.`,
            }
          : { verdict: 'mistake', message: `Called without the odds: ${odds}.` }
      }
      return { verdict: 'good', message: `Good call: ${odds}.` }
    case 'raise':
      if (equity >= 0.6) return { verdict: 'good', message: `Raise for value with ${eq} equity.` }
      if (equity < need) {
        return {
          verdict: 'ok',
          message: `Bluff-raise with ${eq} equity. It needs them to fold a lot.`,
        }
      }
      return { verdict: 'ok', message: `Raise with ${eq} equity. Calling is also reasonable.` }
  }
}

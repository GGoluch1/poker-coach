import type { Spot } from './analysis'
import type { Action } from './game'
import { STRENGTH_PERCENTILE } from './range'

export type Verdict = 'good' | 'ok' | 'mistake' | 'blunder'

export interface DecisionReview {
  verdict: Verdict
  message: string
  /** Short label used to group decisions into leaks, e.g. "Called without odds". */
  category: string
  /**
   * "chart" when graded against the preflop opening charts; "heuristic" when graded
   * by equity against guessed ranges, which is not a solver result.
   */
  basis: 'chart' | 'heuristic'
}

const pct = (x: number) => `${Math.round(x * 100)}%`

/** Grades one decision against the charts and the equity-versus-pot-odds math. */
export function reviewDecision(spot: Spot, action: Action): DecisionReview {
  const { handClass: cls, position: pos } = spot
  const strength = STRENGTH_PERCENTILE.get(cls)!
  const chart = (verdict: Verdict, category: string, message: string): DecisionReview => ({
    verdict,
    category,
    message,
    basis: 'chart',
  })
  const heuristic = (verdict: Verdict, category: string, message: string): DecisionReview => ({
    verdict,
    category,
    message,
    basis: 'heuristic',
  })

  if (spot.openAdvice) {
    const inRange = spot.openAdvice === 'raise'
    if (action.type === 'raise') {
      return inRange
        ? chart('good', 'Standard open', `Standard open: ${cls} is in the ${pos} opening range.`)
        : chart(
            strength > 0.6 ? 'mistake' : 'ok',
            'Opened outside range',
            `${cls} is outside a standard ${pos} opening range. Folding loses less over time.`,
          )
    }
    if (action.type === 'call') {
      return chart(
        'mistake',
        'Limped',
        inRange
          ? `Limping gives up the initiative. ${cls} is a raise from ${pos}.`
          : `Limping ${cls} from ${pos} loses chips. It's outside the opening range, so fold.`,
      )
    }
    if (action.type === 'fold') {
      return inRange
        ? chart(
            strength <= 0.1 ? 'blunder' : 'mistake',
            'Folded an opening hand',
            `Folded ${cls}, which is in the standard ${pos} opening range. Raise it.`,
          )
        : chart('good', 'Correct fold', `Correct fold: ${cls} is outside the ${pos} opening range.`)
    }
  }

  const equity = spot.equity?.equity
  if (equity === undefined) {
    return heuristic('ok', 'No estimate', 'No equity estimate for this spot.')
  }
  const eq = pct(equity)

  if (spot.toCall === 0) {
    if (action.type === 'fold') {
      return heuristic(
        'blunder',
        'Folded when check was free',
        'Folded when checking was free. Always check instead.',
      )
    }
    if (action.type === 'check') {
      if (spot.street === 'river' && equity > 0.75) {
        return heuristic(
          'mistake',
          'Missed river value',
          `Missed value: checked the river with ${eq} equity. Bet so worse hands can pay you.`,
        )
      }
      if (spot.street !== 'preflop' && equity > 0.8) {
        return heuristic(
          'ok',
          'Slowplayed a strong hand',
          `Checked a very strong hand (${eq}). Betting builds the pot.`,
        )
      }
      return heuristic('good', 'Good check', `Check is fine with ${eq} equity.`)
    }
    if (equity >= 0.55) return heuristic('good', 'Value bet', `Value bet with ${eq} equity.`)
    if (equity < 0.35) {
      return heuristic(
        'ok',
        'Bluffed',
        `Bluff with ${eq} equity. It only works if they fold often.`,
      )
    }
    return heuristic('ok', 'Thin bet', `Thin bet with ${eq} equity. Checking is also reasonable.`)
  }

  const need = spot.requiredEquity
  const margin = spot.street === 'preflop' ? 0.08 : 0.05
  const odds = `you had ${eq} equity and needed ${pct(need)} to call`
  const drawing = spot.street !== 'river' && spot.outs.reduce((n, g) => n + g.cards.length, 0) >= 8

  switch (action.type) {
    case 'fold':
      if (equity > need + 0.15) {
        return heuristic('blunder', 'Folded with enough equity', `Folded too much equity: ${odds}.`)
      }
      if (equity > need + margin) {
        return heuristic('mistake', 'Folded with enough equity', `Profitable call folded: ${odds}.`)
      }
      return heuristic('good', 'Good fold', `Good fold: ${odds}.`)
    case 'call':
    case 'check':
      if (equity < need - margin) {
        return drawing
          ? heuristic(
              'ok',
              'Thin draw call',
              `Thin call on a draw: ${odds}. It's only OK if you win a big pot when you hit.`,
            )
          : heuristic('mistake', 'Called without odds', `Called without the odds: ${odds}.`)
      }
      return heuristic('good', 'Good call', `Good call: ${odds}.`)
    case 'raise':
      if (equity >= 0.6) {
        return heuristic('good', 'Value raise', `Raise for value with ${eq} equity.`)
      }
      if (equity < need) {
        return heuristic(
          'ok',
          'Bluff-raised',
          `Bluff-raise with ${eq} equity. It needs them to fold a lot.`,
        )
      }
      return heuristic('ok', 'Thin raise', `Raise with ${eq} equity. Calling is also reasonable.`)
  }
}

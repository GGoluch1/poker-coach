import { analyzeSpot } from './analysis'
import type { Action, GameState } from './game'
import { legalActions } from './game'
import { STRENGTH_PERCENTILE } from './range'
import type { Rng } from './rng'

/**
 * A simple, readable strategy: opening charts and hand strength preflop,
 * equity against estimated ranges versus pot odds after the flop.
 */
export function chooseBotAction(s: GameState, rng: Rng = Math.random): Action {
  const seat = s.toAct
  if (seat === null) throw new Error('no one to act')
  const legal = legalActions(s)
  const p = s.players[seat]

  const passive = (): Action => (legal.canCheck ? { type: 'check' } : { type: 'fold' })
  const raiseTo = (to: number): Action => {
    if (legal.minRaiseTo === null) return legal.canCheck ? { type: 'check' } : { type: 'call' }
    const clamped = Math.min(legal.maxRaiseTo!, Math.max(legal.minRaiseTo, Math.round(to)))
    // Raising most of the stack: just move all in.
    return { type: 'raise', to: clamped > 0.7 * legal.maxRaiseTo! ? legal.maxRaiseTo! : clamped }
  }
  const call = (): Action => (legal.canCheck ? { type: 'check' } : { type: 'call' })

  const spot = analyzeSpot(s, seat, {
    iterations: s.street === 'preflop' ? 0 : 400,
    rng,
    withOuts: false,
  })

  if (s.street === 'preflop') {
    const strength = STRENGTH_PERCENTILE.get(spot.handClass)!
    const raises = s.events.filter((e) => e.type === 'action' && e.action === 'raise').length
    const bb = s.bigBlind

    if (raises === 0) {
      if (spot.position === 'BB') return strength <= 0.08 ? raiseTo(4 * bb) : call()
      if (spot.openAdvice === 'raise' || rng() < 0.03) {
        const limpers = s.events.filter((e) => e.type === 'action' && e.action === 'call').length
        return raiseTo((spot.position === 'SB' ? 3 : 2.5) * bb + limpers * bb)
      }
      return passive()
    }

    const priceOfStack = legal.toCall / (p.stack + p.bet)
    if (strength <= 0.03 || (raises === 1 && strength <= 0.06 && rng() < 0.7)) {
      return raises >= 2 ? raiseTo(legal.maxRaiseTo ?? 0) : raiseTo(s.currentBet * 3)
    }
    const callUpTo = raises >= 2 ? 0.05 : spot.position === 'BB' ? 0.35 : 0.2
    if (strength <= callUpTo && (priceOfStack < 0.3 || strength <= 0.05)) return call()
    return passive()
  }

  const equity = spot.equity!.equity
  const potAfterCall = spot.pot + legal.toCall
  if (legal.canCheck) {
    if (equity > 0.7 && rng() < 0.85) return raiseTo(p.bet + 0.66 * spot.pot)
    if (equity > 0.5 && rng() < 0.5) return raiseTo(p.bet + 0.5 * spot.pot)
    if (rng() < 0.1) return raiseTo(p.bet + 0.5 * spot.pot)
    return { type: 'check' }
  }
  if (equity > 0.75 && legal.minRaiseTo !== null) return raiseTo(s.currentBet + 0.8 * potAfterCall)
  if (equity >= spot.requiredEquity + 0.03) return { type: 'call' }
  if (rng() < 0.05 && legal.toCall <= 0.5 * spot.pot) return { type: 'call' }
  return { type: 'fold' }
}

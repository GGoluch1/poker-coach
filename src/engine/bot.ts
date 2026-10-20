import { analyzeSpot } from './analysis'
import type { Action, GameState } from './game'
import { legalActions } from './game'
import type { Personality } from './profiles'
import { STRENGTH_PERCENTILE } from './range'
import type { Rng } from './rng'

/** Postflop tendencies per personality. */
const POSTFLOP: Record<
  Personality,
  {
    valueEquity: number
    betSize: number
    bluffRate: number
    /** Added to the equity needed to call; negative calls lighter. */
    callMargin: number
    raiseEquity: number
    bluffRaiseRate: number
  }
> = {
  balanced: {
    valueEquity: 0.7,
    betSize: 0.66,
    bluffRate: 0.1,
    callMargin: 0.03,
    raiseEquity: 0.75,
    bluffRaiseRate: 0,
  },
  nit: {
    valueEquity: 0.78,
    betSize: 0.6,
    bluffRate: 0.02,
    callMargin: 0.1,
    raiseEquity: 0.85,
    bluffRaiseRate: 0,
  },
  maniac: {
    valueEquity: 0.45,
    betSize: 1,
    bluffRate: 0.4,
    callMargin: -0.05,
    raiseEquity: 0.6,
    bluffRaiseRate: 0.15,
  },
  station: {
    valueEquity: 0.8,
    betSize: 0.5,
    bluffRate: 0.02,
    callMargin: -0.15,
    raiseEquity: 0.9,
    bluffRaiseRate: 0,
  },
}

/**
 * A simple, readable strategy. Balanced and nit bots follow the preflop charts (the nit
 * only with its strongest hands); maniacs and calling stations play by hand strength.
 * After the flop every bot compares equity against estimated ranges with the pot odds,
 * with tendencies that depend on its personality.
 */
export function chooseBotAction(
  s: GameState,
  rng: Rng = Math.random,
  personality: Personality = 'balanced',
  profiles: (Personality | undefined)[] = [],
): Action {
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
    profiles,
  })

  if (s.street === 'preflop') {
    const strength = STRENGTH_PERCENTILE.get(spot.handClass)!
    const raises = s.events.filter((e) => e.type === 'action' && e.action === 'raise').length
    const bb = s.bigBlind
    const limpers = s.events.filter(
      (e) => e.type === 'action' && e.street === 'preflop' && e.action === 'call',
    ).length
    const sizing = personality === 'maniac' ? 1.4 : 1
    const openTo = ((spot.position === 'SB' ? 3 : 2.5) * bb + limpers * bb) * sizing
    const reraiseTo = s.currentBet * (raises >= 2 ? 2.3 : 3) * sizing
    const priceOfStack = legal.toCall / (p.stack + p.bet)

    if (personality === 'maniac' || personality === 'station') {
      const wide = personality === 'maniac'
      if (raises === 0) {
        if (wide && strength <= 0.5) return raiseTo(openTo)
        if (!wide && strength <= 0.04) return raiseTo(openTo)
        if (!wide && strength <= 0.5) return call()
        return passive()
      }
      const raiseUpTo = wide ? (raises === 1 ? 0.2 : 0.08) : 0.02
      const callUpTo = wide ? (raises === 1 ? 0.45 : 0.25) : raises === 1 ? 0.55 : 0.2
      if (strength <= raiseUpTo || (wide && rng() < 0.08)) return raiseTo(reraiseTo)
      if (strength <= callUpTo) return call()
      return passive()
    }

    // Balanced and nit: the charts, with the nit keeping only its best hands.
    const nit = personality === 'nit'
    if (spot.chart) {
      const rec = spot.chart.action
      const situation = spot.chart.chart.situation
      const cap = !nit ? 1 : situation === 'open' ? 0.12 : situation === 'vsOpen' ? 0.08 : 0.04
      if (rec === 'fold' || strength > cap) return passive()
      if (rec === 'call') return call()
      // Mix in some calls with 3-bet hands so the strategy isn't fully predictable.
      if (situation !== 'open' && rng() < 0.15) return call()
      return raiseTo(situation === 'open' ? openTo : reraiseTo)
    }

    // No chart: the big blind's option, limped pots, and 4-bet pots.
    if (raises === 0) return strength <= (nit ? 0.04 : 0.08) ? raiseTo(4 * bb) : call()
    if (strength <= (nit ? 0.015 : 0.03)) {
      return raises >= 3 ? raiseTo(legal.maxRaiseTo ?? 0) : raiseTo(reraiseTo)
    }
    if (strength <= (nit ? 0.03 : 0.05) && priceOfStack < 0.4) return call()
    return passive()
  }

  const t = POSTFLOP[personality]
  const equity = spot.equity!.equity
  const potAfterCall = spot.pot + legal.toCall
  if (legal.canCheck) {
    if (equity > t.valueEquity && rng() < 0.85) return raiseTo(p.bet + t.betSize * spot.pot)
    if (equity > (t.valueEquity + 0.5) / 2 && rng() < 0.5) {
      return raiseTo(p.bet + 0.5 * spot.pot)
    }
    if (rng() < t.bluffRate) return raiseTo(p.bet + t.betSize * spot.pot)
    return { type: 'check' }
  }
  if (legal.minRaiseTo !== null && (equity > t.raiseEquity || rng() < t.bluffRaiseRate)) {
    return raiseTo(s.currentBet + 0.8 * potAfterCall)
  }
  if (equity >= spot.requiredEquity + t.callMargin) return { type: 'call' }
  if (rng() < 0.05 && legal.toCall <= 0.5 * spot.pot) return { type: 'call' }
  return { type: 'fold' }
}

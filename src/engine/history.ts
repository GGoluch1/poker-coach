import { cardLabel } from './card'
import type { GameState, HandEvent } from './game'
import { describeHand } from './hand'

const STREET_LABEL = { preflop: 'Preflop', flop: 'Flop', turn: 'Turn', river: 'River' } as const

/** One line of hand history text per event. */
export function describeEvents(s: GameState): string[] {
  const name = (seat: number) => s.players[seat].name
  let blinds = 0
  return s.events.map((e: HandEvent) => {
    switch (e.type) {
      case 'blind':
        return `${name(e.seat)} posts ${blinds++ === 0 ? 'small' : 'big'} blind ${e.amount}`
      case 'deal':
        return `${STREET_LABEL[e.street]}: ${e.cards.map(cardLabel).join(' ')}`
      case 'action': {
        const allIn = e.allIn ? ' (all in)' : ''
        switch (e.action) {
          case 'fold':
            return `${name(e.seat)} folds`
          case 'check':
            return `${name(e.seat)} checks`
          case 'call':
            return `${name(e.seat)} calls ${e.amount}${allIn}`
          case 'bet':
            return `${name(e.seat)} bets ${e.to}${allIn}`
          case 'raise':
            return `${name(e.seat)} raises to ${e.to}${allIn}`
        }
        break
      }
      case 'refund':
        return `Uncalled ${e.amount} returned to ${name(e.seat)}`
      case 'win': {
        const pot = e.potIndex > 0 ? ` from side pot ${e.potIndex}` : ''
        const hand = e.hand ? ` with ${describeHand(e.hand)}` : ''
        return `${name(e.seat)} wins ${e.amount}${pot}${hand}`
      }
    }
  })
}

/** Chips a seat won minus chips it put in over the hand. */
export function netResult(s: GameState, seat: number): number {
  const won = s.events.reduce(
    (sum, e) => sum + (e.type === 'win' && e.seat === seat ? e.amount : 0),
    0,
  )
  return won - s.players[seat].committed
}

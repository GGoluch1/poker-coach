import { cardLabel } from './card'
import type { GameState, HandEvent, Street } from './game'
import { liveSeats, totalPot } from './game'
import { positions } from './range'
import { describeBoard } from './texture'

const STREET_NAME: Record<Street, string> = {
  preflop: 'Preflop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
}

/**
 * A plain-English summary of the situation from one player's point of view:
 * table, position, stacks, the action so far and what they're facing.
 */
export function describeSituation(s: GameState, seat: number): string[] {
  const pos = positions(
    s.players.map((p) => p.inHand),
    s.button,
  )
  const who = (i: number) => (i === seat ? 'you' : `${pos[i]}`)
  const bb = s.bigBlind
  const me = s.players[seat]
  const dealt = s.players.filter((p) => p.inHand).length
  const others = liveSeats(s).filter((i) => i !== seat)
  const effective = Math.min(
    me.stack + me.bet,
    Math.max(0, ...others.map((i) => s.players[i].stack + s.players[i].bet)),
  )

  const lines = [
    `${dealt === 2 ? 'Heads-up' : `${dealt}-handed`}, blinds ${s.smallBlind}/${bb}. You're ${pos[seat] === 'BB' || pos[seat] === 'SB' ? 'in' : 'on'} the ${pos[seat]} with ${me.hole.map(cardLabel).join(' ')}.`,
    `Effective stack: ${effective} (${Math.round(effective / bb)} bb).`,
  ]

  const byStreet = new Map<Street, string[]>()
  for (const e of s.events) {
    if (e.type !== 'action') continue
    const list = byStreet.get(e.street) ?? []
    list.push(actionPhrase(e, who))
    byStreet.set(e.street, list)
  }
  for (const street of ['preflop', 'flop', 'turn', 'river'] as Street[]) {
    if (street !== 'preflop') {
      const deal = s.events.find((e) => e.type === 'deal' && e.street === street)
      if (!deal) break
      const board = s.board.slice(0, street === 'flop' ? 3 : street === 'turn' ? 4 : 5)
      lines.push(
        `${STREET_NAME[street]}: ${board.map(cardLabel).join(' ')} (${describeBoard(board).summary}).`,
      )
    }
    const actions = byStreet.get(street)
    if (actions?.length) {
      const text = actions.join(', ')
      lines.push(`${STREET_NAME[street]} action: ${text[0].toUpperCase()}${text.slice(1)}.`)
    }
  }

  if (s.toAct === seat) {
    const pot = totalPot(s)
    const toCall = Math.min(s.currentBet - me.bet, me.stack)
    lines.push(
      toCall > 0
        ? `Pot is ${pot}. You have ${toCall} to call.`
        : `Pot is ${pot}. It's checked to you.`,
    )
  }
  return lines
}

function actionPhrase(
  e: Extract<HandEvent, { type: 'action' }>,
  who: (i: number) => string,
): string {
  const you = who(e.seat) === 'you'
  const allIn = e.allIn ? ' all in' : ''
  switch (e.action) {
    case 'fold':
      return `${who(e.seat)} fold${you ? '' : 's'}`
    case 'check':
      return `${who(e.seat)} check${you ? '' : 's'}`
    case 'call':
      return `${who(e.seat)} call${you ? '' : 's'}${allIn}`
    case 'bet':
      return `${who(e.seat)} bet${you ? '' : 's'} ${e.to}${allIn}`
    case 'raise':
      return `${who(e.seat)} raise${you ? '' : 's'} to ${e.to}${allIn}`
  }
}

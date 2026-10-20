import type { Card } from '../engine/card'
import { cardToString } from '../engine/card'

const SUIT_SYMBOL = { s: '♠', h: '♥', d: '♦', c: '♣' } as const
const SUIT_NAME = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' } as const

interface Props {
  card?: Card
  size?: 'sm' | 'md' | 'lg'
  /** Shows the back of the card. */
  hidden?: boolean
  dim?: boolean
}

export function CardView({ card, size = 'md', hidden, dim }: Props) {
  if (!card || hidden) {
    return (
      <span className={`card card-${size} card-back${card ? '' : ' card-empty'}`} aria-hidden />
    )
  }
  const rank = cardToString(card)[0]
  return (
    <span
      className={`card card-${size} suit-${card.suit}${dim ? ' card-dim' : ''}`}
      aria-label={`${rank === 'T' ? '10' : rank} of ${SUIT_NAME[card.suit]}`}
      role="img"
    >
      <span className="card-rank">{rank === 'T' ? '10' : rank}</span>
      <span className="card-suit">{SUIT_SYMBOL[card.suit]}</span>
    </span>
  )
}

export function CardText({ card }: { card: Card }) {
  const s = cardToString(card)
  return (
    <span className={`card-text suit-${card.suit}`}>
      {s[0]}
      {SUIT_SYMBOL[card.suit]}
    </span>
  )
}

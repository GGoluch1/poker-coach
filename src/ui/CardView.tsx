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

const SUIT_OF_SYMBOL: Record<string, Card['suit']> = { '♠': 's', '♥': 'h', '♦': 'd', '♣': 'c' }

/** Text with cards written like "K♠" shown as colored card chips. */
export function SuitText({ text }: { text: string }) {
  // Splitting on a capture group puts the cards at the odd indexes.
  const parts = text.split(/([2-9TJQKA][♠♥♦♣])/)
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <span key={i} className={`card-text suit-${SUIT_OF_SYMBOL[p[1]]}`}>
            {p}
          </span>
        ) : (
          p
        ),
      )}
    </>
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

import { useState } from 'react'
import { netResult } from '../engine/history'
import { handClass } from '../engine/range'
import { HandReview } from './HandReview'
import type { HandRecord } from './useGame'
import { HERO } from './useGame'

export function HistoryPanel({ history }: { history: HandRecord[] }) {
  const [open, setOpen] = useState<number | null>(history[0]?.final.handNumber ?? null)

  if (history.length === 0)
    return <p className="muted">Finished hands show up here with a review.</p>
  const total = history.reduce((sum, r) => sum + netResult(r.final, HERO), 0)

  return (
    <div className="history">
      <p className="muted small">
        Last {history.length} hands: {total >= 0 ? '+' : ''}
        {total} chips
      </p>
      <ul className="history-list">
        {history.map((record) => {
          const { final } = record
          const hero = final.players[HERO]
          const net = netResult(final, HERO)
          const isOpen = open === final.handNumber
          return (
            <li key={final.handNumber} className={isOpen ? 'open' : ''}>
              <button
                className="history-row"
                onClick={() => setOpen(isOpen ? null : final.handNumber)}
                aria-expanded={isOpen}
              >
                <span>#{final.handNumber}</span>
                <span>{hero.hole.length === 2 ? handClass(hero.hole[0], hero.hole[1]) : '—'}</span>
                <span className={net > 0 ? 'pos' : net < 0 ? 'neg' : 'muted'}>
                  {net > 0 ? '+' : ''}
                  {net}
                </span>
              </button>
              {isOpen && <HandReview record={record} showLog />}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

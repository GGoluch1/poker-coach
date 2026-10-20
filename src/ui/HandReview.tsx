import { useMemo } from 'react'
import { analyzeSpot } from '../engine/analysis'
import type { Action } from '../engine/game'
import { describeEvents, netResult } from '../engine/history'
import { reviewDecision } from '../engine/review'
import { seededRng } from '../engine/rng'
import { CardText } from './CardView'
import type { HandRecord } from './useGame'
import { HERO } from './useGame'

const VERDICT_LABEL = { good: 'Good', ok: 'OK', mistake: 'Mistake', blunder: 'Blunder' }
const STREET_LABEL = { preflop: 'Preflop', flop: 'Flop', turn: 'Turn', river: 'River' }

function actionText(action: Action, toCall: number, currentBet: number): string {
  switch (action.type) {
    case 'fold':
      return 'Fold'
    case 'check':
      return 'Check'
    case 'call':
      return `Call ${toCall}`
    case 'raise':
      return currentBet === 0 ? `Bet ${action.to}` : `Raise to ${action.to}`
  }
}

function useReviews(record: HandRecord) {
  return useMemo(
    () =>
      record.decisions.map((d, i) => {
        const spot = analyzeSpot(d.state, HERO, {
          iterations: 2000,
          rng: seededRng(d.state.handNumber * 101 + i),
        })
        return { spot, decision: d, review: reviewDecision(spot, d.action) }
      }),
    [record],
  )
}

export function HandReview({ record, showLog }: { record: HandRecord; showLog?: boolean }) {
  const reviews = useReviews(record)
  const { final } = record
  const net = netResult(final, HERO)

  return (
    <div className="review">
      <div className="review-summary">
        <span className={net > 0 ? 'pos' : net < 0 ? 'neg' : ''}>
          {net > 0 ? '+' : ''}
          {net} chips
        </span>
        <span className="muted">
          {final.players[HERO].hole.map((c, i) => (
            <CardText key={i} card={c} />
          ))}
          {final.board.length > 0 && <> on </>}
          {final.board.map((c, i) => (
            <CardText key={i} card={c} />
          ))}
        </span>
      </div>

      {reviews.length === 0 ? (
        <p className="muted small">You weren't dealt in or had no decisions this hand.</p>
      ) : (
        <ol className="decisions">
          {reviews.map(({ spot, decision, review }, i) => (
            <li key={i} className={`decision verdict-${review.verdict}`}>
              <div className="decision-head">
                <span className="verdict">{VERDICT_LABEL[review.verdict]}</span>
                <span>
                  {STREET_LABEL[spot.street]}:{' '}
                  {actionText(decision.action, spot.toCall, decision.state.currentBet)}
                </span>
              </div>
              <div className="small">{review.message}</div>
            </li>
          ))}
        </ol>
      )}

      {showLog && (
        <details className="log">
          <summary>Hand log</summary>
          <ul>
            {describeEvents(final).map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
          {final.showdown && (
            <ul>
              {final.players.map((p, seat) =>
                p.inHand && !p.folded && seat !== HERO ? (
                  <li key={seat}>
                    {p.name} showed{' '}
                    {p.hole.map((c, i) => (
                      <CardText key={i} card={c} />
                    ))}
                  </li>
                ) : null,
              )}
            </ul>
          )}
        </details>
      )}
    </div>
  )
}

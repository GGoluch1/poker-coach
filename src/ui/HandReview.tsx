import type { Action } from '../engine/game'
import { describeEvents, netResult } from '../engine/history'
import { CardText } from './CardView'
import { useAsync } from './useAsync'
import type { HandRecord } from './useGame'
import { HERO, reviewRecord } from './useGame'

const formatBb = (x: number) => `${x >= 0 ? '+' : ''}${x.toFixed(1)} bb`
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

export function HandReview({ record, showLog }: { record: HandRecord; showLog?: boolean }) {
  const reviews = useAsync(() => reviewRecord(record), record.id)?.decisions
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

      {!reviews ? (
        <p className="muted small">Reviewing…</p>
      ) : reviews.length === 0 ? (
        <p className="muted small">You weren't dealt in or had no decisions this hand.</p>
      ) : (
        <ol className="decisions">
          {reviews.map(
            ({ street, toCall, currentBet, action, review, options, chosen, lostBb }, i) => (
              <li key={i} className={`decision verdict-${review.verdict}`}>
                <div className="decision-head">
                  <span className="verdict">{VERDICT_LABEL[review.verdict]}</span>
                  <span>
                    {STREET_LABEL[street]}: {actionText(action, toCall, currentBet)}
                  </span>
                  <span
                    className="tag tag-right"
                    title={
                      review.basis === 'chart'
                        ? 'Graded against the preflop charts'
                        : 'Graded by equity against guessed ranges, not a solver'
                    }
                  >
                    {review.basis === 'chart' ? 'Chart' : 'Heuristic'}
                  </span>
                </div>
                <div className="small">{review.message}</div>
                {options.filter((o) => o.ev !== null).length >= 2 && (
                  <div className="ev-row small" aria-label="Estimated EV of each option">
                    {options.map((o, j) => (
                      <span key={j} className={j === chosen ? 'ev-chosen' : ''} title={o.note}>
                        {o.label}: {o.ev === null ? '—' : formatBb(o.ev)}
                      </span>
                    ))}
                    {lostBb !== null && lostBb >= 0.1 && (
                      <span className="neg">−{lostBb.toFixed(1)} bb vs best</span>
                    )}
                  </div>
                )}
              </li>
            ),
          )}
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

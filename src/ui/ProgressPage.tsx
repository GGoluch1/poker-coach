import type { DrillKind } from '../engine/drills'
import { BOX_INTERVALS, dueCards } from '../engine/srs'
import { statLines } from '../engine/stats'
import { PageHeader } from './PageHeader'
import { resetProgress, useProgress } from './progress'
import { HOME_CRUMB, href } from './routes'
import { LEAK_ADVICE } from './siteMap'
import { useNow } from './useNow'

const DRILL_NAMES: Record<DrillKind, string> = {
  outs: 'Outs',
  callfold: 'Call or fold',
  preflop: 'Preflop charts',
  texture: 'Board texture',
  hand: 'Your hands',
  mdf: 'Defense and bluff math',
  combos: 'Combos and blockers',
  setmine: 'Set mining',
}

const pct = (x: number) => `${Math.round(x * 100)}%`

function boxLabel(i: number) {
  const ms = BOX_INTERVALS[i]
  return ms < 3_600_000 ? `${ms / 60_000} min` : `${ms / 86_400_000} d`
}

export function ProgressPage() {
  const progress = useProgress()
  const { stats } = progress
  const lines = statLines(stats)
  const leaks = Object.entries(progress.leaks).sort((a, b) => b[1].count - a[1].count)
  const due = dueCards(progress.deck, useNow())
  const boxes = BOX_INTERVALS.map((_, i) => progress.deck.filter((c) => c.box === i).length)

  return (
    <div className="page">
      <PageHeader
        title="Progress"
        crumbs={[HOME_CRUMB]}
        actions={
          <button
            className="btn btn-quiet"
            onClick={() => confirm('Reset all stats, leaks and review cards?') && resetProgress()}
          >
            Reset
          </button>
        }
      >
        Your stats against winning ranges, the leaks that cost you the most, and how your drills are
        going.
      </PageHeader>

      <div className="progress-grid">
        <section className="card-panel">
          <h3>Your play</h3>
          {stats.hands === 0 ? (
            <p className="muted">Play some hands to see your stats.</p>
          ) : (
            <>
              <p className="muted small">
                {stats.hands} hands ·{' '}
                <span className={stats.bigBlinds >= 0 ? 'pos' : 'neg'}>
                  {stats.bigBlinds >= 0 ? '+' : ''}
                  {stats.bigBlinds.toFixed(1)} bb
                </span>{' '}
                ({((stats.bigBlinds / stats.hands) * 100).toFixed(1)} bb/100)
              </p>
              <ul className="stat-list">
                {lines.map((l) => {
                  const [lo, hi] = l.target
                  const status =
                    l.value === null ? 'none' : l.value < lo ? 'low' : l.value > hi ? 'high' : 'ok'
                  return (
                    <li key={l.label} title={l.help}>
                      <div className="stat-row">
                        <span>{l.label}</span>
                        <strong className={`status-${status}`}>
                          {l.value === null ? '—' : pct(l.value)}
                          {status === 'low' && ' ↓'}
                          {status === 'high' && ' ↑'}
                        </strong>
                      </div>
                      <div className="range-bar" aria-hidden>
                        <span
                          className="range-target"
                          style={{ left: pct(lo), width: pct(hi - lo) }}
                        />
                        {l.value !== null && (
                          <span
                            className="range-marker"
                            style={{ left: pct(Math.min(1, l.value)) }}
                          />
                        )}
                      </div>
                      <div className="muted small">
                        Target {pct(lo)}–{pct(hi)} · {l.sample} sample{l.sample === 1 ? '' : 's'}
                      </div>
                    </li>
                  )
                })}
              </ul>
              <p className="muted small">
                Targets are typical for winning 6-max players. Small samples swing a lot.
              </p>
            </>
          )}
        </section>

        <section className="card-panel">
          <h3>Leaks</h3>
          {leaks.length === 0 ? (
            <p className="muted">
              Mistakes from your hands are grouped here, so you can see patterns.
            </p>
          ) : (
            <ul className="leak-list">
              {leaks.map(([category, leak]) => {
                const advice = LEAK_ADVICE[category]
                const streets = Object.entries(leak.streets)
                  .map(([s, n]) => `${s} ${n}`)
                  .join(' · ')
                return (
                  <li key={category}>
                    <div className="stat-row">
                      <strong>{category}</strong>
                      <span>
                        {leak.count}×
                        {leak.bbLost !== undefined && leak.bbLost >= 0.1 && (
                          <span className="neg"> · −{leak.bbLost.toFixed(1)} bb</span>
                        )}
                      </span>
                    </div>
                    <div className="muted small">{streets}</div>
                    {advice && <div className="small">{advice.tip}</div>}
                    {advice?.drill && (
                      <a
                        className="btn btn-quiet btn-small"
                        href={href({ page: 'drills', drill: advice.drill })}
                      >
                        Practice this
                      </a>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="card-panel">
          <h3>Spaced repetition</h3>
          <p>
            <strong>{due.length}</strong> due now · {progress.deck.length} in the deck
          </p>
          <div className="boxes">
            {boxes.map((n, i) => (
              <div key={i} className="box" title={`Box ${i + 1}: comes back after ${boxLabel(i)}`}>
                <span className="box-count">{n}</span>
                <span className="muted small">{boxLabel(i)}</span>
              </div>
            ))}
          </div>
          <p className="muted small">
            A correct answer moves a card one box right with a longer wait. A miss sends it back to
            the start. Cards that clear the last box are retired.
          </p>
          {due.length > 0 ? (
            <a className="btn btn-primary" href={href({ page: 'drills', drill: 'review' })}>
              Review {due.length} due
            </a>
          ) : (
            <button className="btn btn-primary" disabled>
              Nothing due
            </button>
          )}
        </section>

        <section className="card-panel">
          <h3>Drills</h3>
          {Object.keys(progress.drills).length === 0 ? (
            <p className="muted">No drills yet.</p>
          ) : (
            <ul className="stat-list">
              {(
                Object.entries(progress.drills) as [
                  DrillKind,
                  NonNullable<(typeof progress.drills)[DrillKind]>,
                ][]
              ).map(([kind, s]) => (
                <li key={kind}>
                  <div className="stat-row">
                    <span>{DRILL_NAMES[kind]}</span>
                    <strong>{pct(s.correct / s.attempts)}</strong>
                  </div>
                  <div className="meter" aria-hidden>
                    <div className="meter-fill" style={{ width: pct(s.correct / s.attempts) }} />
                  </div>
                  <div className="muted small">
                    {s.correct}/{s.attempts} · best streak {s.bestStreak}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

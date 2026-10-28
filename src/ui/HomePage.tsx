import { dayKey, streak } from '../engine/activity'
import { parseCards } from '../engine/card'
import { dueCards } from '../engine/srs'
import { CardView } from './CardView'
import { Icon } from './Icon'
import { useProgress } from './progress'
import { href } from './routes'
import { LEAK_ADVICE, PRACTICE_DRILLS, STUDY_TOOLS } from './siteMap'
import { useNow } from './useNow'

/** One card of each suit, to show off the four-color deck. */
const HERO_CARDS = parseCards('As Kh Qd Jc')

const pct = (x: number) => `${Math.round(x * 100)}%`

export function HomePage() {
  const progress = useProgress()
  const { stats } = progress
  const now = useNow()
  const due = dueCards(progress.deck, now).length
  const dayStreak = streak(progress.days, now)
  const practicedToday = progress.days.at(-1)?.day === dayKey(now)
  const scores = Object.values(progress.drills)
  const attempts = scores.reduce((n, s) => n + s.attempts, 0)
  const correct = scores.reduce((n, s) => n + s.correct, 0)
  const isNew = stats.hands === 0 && attempts === 0
  // The leak that cost the most, or failing that the most frequent.
  const [leakName, leak] =
    Object.entries(progress.leaks).sort(
      (a, b) => (b[1].bbLost ?? 0) - (a[1].bbLost ?? 0) || b[1].count - a[1].count,
    )[0] ?? []
  const leakAdvice = leakName ? LEAK_ADVICE[leakName] : undefined

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-text">
          <p className="eyebrow">No-limit hold’em trainer</p>
          <h1 className="hero-title" tabIndex={-1}>
            {isNew ? (
              <>
                Learn poker by playing, <span className="accent">with a coach at your side</span>
              </>
            ) : (
              <>
                Welcome back, <span className="accent">ready for a session?</span>
              </>
            )}
          </h1>
          <p className="hero-lede">
            Play against bots with real personalities while a live coach shows your equity, pot odds
            and outs. Every decision gets a review, and your mistakes come back as drills.
          </p>
          <div className="button-row">
            <a className="btn btn-primary btn-large" href={href({ page: 'play' })}>
              <Icon name="play" size={18} /> Play a hand
            </a>
            {due > 0 ? (
              <a className="btn btn-large" href={href({ page: 'drills', drill: 'review' })}>
                Review {due} missed spot{due === 1 ? '' : 's'}
              </a>
            ) : (
              <a className="btn btn-large" href={href({ page: 'drills', drill: null })}>
                Browse drills
              </a>
            )}
          </div>
        </div>
        <div className="hero-cards" aria-hidden>
          {HERO_CARDS.map((c) => (
            <CardView key={`${c.rank}${c.suit}`} card={c} size="lg" />
          ))}
        </div>
      </section>

      {isNew ? (
        <section className="home-section">
          <h2 className="section-title">How it works</h2>
          <ol className="steps">
            <li>
              <span className="step-num">1</span>
              <h3>Play hands</h3>
              <p>
                Sit at a table of 2 to 6 with nits, maniacs and calling stations. The coach shows
                the numbers behind each decision as you go.
              </p>
            </li>
            <li>
              <span className="step-num">2</span>
              <h3>Get every decision reviewed</h3>
              <p>
                After each hand you see which choices were good, which were mistakes, and roughly
                what each option was worth in big blinds.
              </p>
            </li>
            <li>
              <span className="step-num">3</span>
              <h3>Drill your weak spots</h3>
              <p>
                Short drills build the fundamentals. Anything you miss comes back on a
                spaced-repetition schedule until it sticks.
              </p>
            </li>
          </ol>
        </section>
      ) : (
        <section className="home-section">
          <div className="section-head">
            <h2 className="section-title">Your snapshot</h2>
            <a className="section-link" href={href({ page: 'progress' })}>
              Full progress <Icon name="arrowRight" size={16} />
            </a>
          </div>
          <div className="stat-tiles">
            <div className="stat-tile">
              <span className="stat-label">Day streak</span>
              <strong>{dayStreak}</strong>
              <span className="muted small">
                {practicedToday
                  ? 'You practiced today'
                  : dayStreak > 0
                    ? 'Practice today to keep it going'
                    : 'Practice today to start one'}
              </span>
            </div>
            <div className="stat-tile">
              <span className="stat-label">Hands played</span>
              <strong>{stats.hands}</strong>
            </div>
            <div className="stat-tile">
              <span className="stat-label">Net result</span>
              <strong className={stats.bigBlinds >= 0 ? 'pos' : 'neg'}>
                {stats.bigBlinds >= 0 ? '+' : ''}
                {stats.bigBlinds.toFixed(1)} bb
              </strong>
              {stats.hands > 0 && (
                <span className="muted small">
                  {((stats.bigBlinds / stats.hands) * 100).toFixed(1)} bb/100
                </span>
              )}
            </div>
            <div className="stat-tile">
              <span className="stat-label">Drill accuracy</span>
              <strong>{attempts > 0 ? pct(correct / attempts) : '—'}</strong>
              <span className="muted small">
                {attempts} answer{attempts === 1 ? '' : 's'}
              </span>
            </div>
            <div className="stat-tile">
              <span className="stat-label">Reviews due</span>
              <strong>{due}</strong>
              <span className="muted small">{progress.deck.length} in the deck</span>
            </div>
          </div>
          {leakName && leak && (
            <div className="callout">
              <div>
                <span className="stat-label">Biggest leak</span>
                <p className="callout-title">
                  {leakName}{' '}
                  <span className="muted">
                    · {leak.count}×
                    {leak.bbLost !== undefined && leak.bbLost >= 0.1 && (
                      <> · −{leak.bbLost.toFixed(1)} bb</>
                    )}
                  </span>
                </p>
                {leakAdvice && <p className="muted small">{leakAdvice.tip}</p>}
              </div>
              {leakAdvice?.drill && (
                <a className="btn" href={href({ page: 'drills', drill: leakAdvice.drill })}>
                  Practice this
                </a>
              )}
            </div>
          )}
        </section>
      )}

      <section className="home-section">
        <div className="section-head">
          <h2 className="section-title">Drills</h2>
          <a className="section-link" href={href({ page: 'drills', drill: null })}>
            All drills <Icon name="arrowRight" size={16} />
          </a>
        </div>
        <div className="link-grid">
          {PRACTICE_DRILLS.map((d) => {
            const score = d.id === 'review' ? undefined : progress.drills[d.id]
            return (
              <a key={d.id} className="link-card" href={href({ page: 'drills', drill: d.id })}>
                <span className={`tile hue-${d.hue}`}>
                  <Icon name={d.icon} size={20} />
                </span>
                <span className="link-card-text">
                  <strong>{d.title}</strong>
                  <span className="muted small">{d.short}</span>
                </span>
                {score && score.attempts > 0 && (
                  <span className="link-card-score" title="Accuracy">
                    {pct(score.correct / score.attempts)}
                  </span>
                )}
              </a>
            )
          })}
        </div>
      </section>

      <section className="home-section">
        <h2 className="section-title">Study tools</h2>
        <div className="link-grid link-grid-3">
          {STUDY_TOOLS.map((t) => (
            <a key={t.title} className="link-card" href={href(t.route)}>
              <span className={`tile hue-${t.hue}`}>
                <Icon name={t.icon} size={20} />
              </span>
              <span className="link-card-text">
                <strong>{t.title}</strong>
                <span className="muted small">{t.short}</span>
              </span>
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}

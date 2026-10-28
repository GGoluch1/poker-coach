import { useEffect, useState } from 'react'
import type { DrillAnswer, DrillItem, Grade } from '../engine/drills'
import { drillKey, gradeDrill, preflopChartOf } from '../engine/drills'
import { dueCards } from '../engine/srs'
import { randomSeed, runInWorker } from '../worker/client'
import { DrillQuestion } from './DrillQuestion'
import { Icon } from './Icon'
import { PageHeader } from './PageHeader'
import { recordDeckAnswer, recordDrill, useProgress } from './progress'
import { RangeChart } from './RangeChart'
import { HOME_CRUMB, href } from './routes'
import type { DrillMode } from './siteMap'
import { DRILLS, drillInfo } from './siteMap'
import { useNow } from './useNow'

const DRILLS_CRUMB = { label: 'Drills', href: href({ page: 'drills', drill: null }) }

interface Current {
  item: DrillItem
  key: string
  /** True when the item came from the spaced-repetition deck. */
  fromDeck: boolean
}

/** The list of drills, or one drill when `mode` is set. The URL picks it, so it never changes. */
export function DrillsPage({ mode }: { mode: DrillMode | null }) {
  const progress = useProgress()
  const [current, setCurrent] = useState<Current | null>(null)
  const [grade, setGrade] = useState<Grade | null>(null)
  const [loading, setLoading] = useState(mode !== null)
  const [empty, setEmpty] = useState(false)
  const [timed, setTimed] = useState(true)
  const [session, setSession] = useState({ answered: 0, correct: 0 })
  const [loadError, setLoadError] = useState<string | null>(null)
  // Increments per question so answering doesn't remount (and clear) the inputs.
  const [dealId, setDealId] = useState(0)
  const dueTotal = dueCards(progress.deck, useNow()).length

  /** Picks the next question: a due review card or a fresh one from the worker. */
  async function pickItem(forMode: DrillMode): Promise<Current | null> {
    const due = dueCards(progress.deck, Date.now(), (item) =>
      forMode === 'review' ? true : item.kind === forMode,
    )
    // Mix due reviews into regular drills about half the time.
    if (due.length > 0 && (forMode === 'review' || Math.random() < 0.5)) {
      return { item: due[0].item, key: due[0].key, fromDeck: true }
    }
    if (forMode === 'review') return null
    const item = await runInWorker('drill', { kind: forMode, seed: randomSeed() })
    return { item, key: drillKey(item), fromDeck: false }
  }

  function show(picked: Current | null) {
    setDealId((n) => n + 1)
    setCurrent(picked)
    setEmpty(picked === null)
    setLoading(false)
  }

  function next(forMode: DrillMode | null = mode) {
    if (!forMode) return
    setGrade(null)
    setEmpty(false)
    setLoadError(null)
    setLoading(true)
    pickItem(forMode).then(show, (e: Error) => {
      setLoading(false)
      setLoadError(e.message)
    })
  }

  // Deal the first question.
  useEffect(() => {
    if (mode) next(mode)
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const finish = (g: Grade) => {
    if (!current) return
    setGrade(g)
    setSession((s) => ({ answered: s.answered + 1, correct: s.correct + (g.correct ? 1 : 0) }))
    recordDrill(current.item.kind, g.correct)
    recordDeckAnswer(current.item, current.key, current.fromDeck, g.correct)
  }

  const answer = (a: DrillAnswer) => current && !grade && finish(gradeDrill(current.item, a))

  const timeout = () => {
    if (!current || grade || current.item.kind !== 'callfold') return
    const g = gradeDrill(current.item, { kind: 'callfold', action: 'call' })
    finish({ ...g, correct: false, headline: `Time's up. ${g.headline}` })
  }

  useEffect(() => {
    if (!grade) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key.toLowerCase() === 'n') {
        e.preventDefault()
        next()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!mode) {
    return (
      <div className="page">
        <PageHeader title="Drills" crumbs={[HOME_CRUMB]}>
          Short, focused practice. Every miss goes into a spaced-repetition deck and comes back
          later, a few minutes at first and then days apart.
        </PageHeader>
        <div className="drill-grid">
          {DRILLS.map((d) => {
            const score = d.id === 'review' ? null : progress.drills[d.id]
            return (
              <a
                key={d.id}
                className={`drill-card${d.id === 'review' ? ' drill-card-review' : ''}`}
                href={href({ page: 'drills', drill: d.id })}
              >
                <span className={`tile hue-${d.hue}`}>
                  <Icon name={d.icon} size={22} />
                </span>
                <span className="drill-title">
                  {d.title}
                  {d.id === 'review' && dueTotal > 0 && <span className="badge">{dueTotal}</span>}
                </span>
                <span className="muted small">{d.blurb}</span>
                {score && score.attempts > 0 && (
                  <span className="drill-score small">
                    <span className="meter" aria-hidden>
                      <span
                        className="meter-fill"
                        style={{ width: `${(score.correct / score.attempts) * 100}%` }}
                      />
                    </span>
                    <span>
                      {Math.round((score.correct / score.attempts) * 100)}% of {score.attempts} ·
                      best streak {score.bestStreak}
                    </span>
                  </span>
                )}
              </a>
            )
          })}
        </div>
      </div>
    )
  }

  const info = drillInfo(mode)
  const score = mode === 'review' ? null : progress.drills[mode]

  return (
    <div className="page drill-page">
      <PageHeader
        title={info.title}
        crumbs={[HOME_CRUMB, DRILLS_CRUMB]}
        actions={
          <>
            <span className="pill-stat">
              {session.correct}/{session.answered}
              <span className="muted"> this session</span>
            </span>
            {score && score.streak > 0 && (
              <span className="pill-stat">
                {score.streak}
                <span className="muted"> streak</span>
              </span>
            )}
            {mode === 'callfold' && (
              <label className="toggle small">
                <input
                  type="checkbox"
                  checked={timed}
                  onChange={(e) => setTimed(e.target.checked)}
                />
                Timer
              </label>
            )}
          </>
        }
      >
        {info.blurb}
      </PageHeader>

      <div className="drill-body">
        {loadError ? (
          <div className="drill-empty">
            <p>Couldn't deal a question: {loadError}</p>
            <button className="btn" onClick={() => next()}>
              Try again
            </button>
          </div>
        ) : empty ? (
          <div className="drill-empty">
            <p>Nothing is due right now.</p>
            <p className="muted small">
              Missed drills and mistakes from your hands land here and come back on a schedule.
            </p>
            <a className="btn" href={DRILLS_CRUMB.href}>
              Pick a drill
            </a>
          </div>
        ) : loading || !current ? (
          <p className="muted">Dealing…</p>
        ) : (
          <div className="drill-main">
            {current.fromDeck && <span className="tag">Review</span>}
            <DrillQuestion
              key={dealId}
              item={current.item}
              answered={grade !== null}
              timed={timed}
              onAnswer={answer}
              onTimeout={timeout}
            />
            {grade && (
              <div className={`feedback ${grade.correct ? 'feedback-good' : 'feedback-bad'}`}>
                <p className="feedback-head">{grade.headline}</p>
                <ul>
                  {grade.details.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
                {current.item.kind === 'preflop' && (
                  <RangeChart
                    key={current.key}
                    chartId={preflopChartOf(current.item).id}
                    current={current.item.handClass}
                  />
                )}
                {!grade.correct && (
                  <p className="muted small">Added to your review deck; it will come back soon.</p>
                )}
                <button className="btn btn-primary" onClick={() => next()} autoFocus>
                  Next <kbd>Enter</kbd>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

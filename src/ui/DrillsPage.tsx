import { useEffect, useState } from 'react'
import type { DrillAnswer, DrillItem, GeneratedKind, Grade } from '../engine/drills'
import { drillKey, gradeDrill, preflopChartOf } from '../engine/drills'
import { dueCards } from '../engine/srs'
import { randomSeed, runInWorker } from '../worker/client'
import { DrillQuestion } from './DrillQuestion'
import type { IconName } from './Icon'
import { Icon } from './Icon'
import { recordDeckAnswer, recordDrill, useProgress } from './progress'
import { RangeChart } from './RangeChart'
import { useNow } from './useNow'

export type DrillMode = GeneratedKind | 'review'

const DRILLS: { id: DrillMode; title: string; blurb: string; icon: IconName }[] = [
  {
    id: 'outs',
    icon: 'target',
    title: 'Outs',
    blurb: 'Count the cards that improve your hand, and see how the rule of 2 and 4 compares.',
  },
  {
    id: 'callfold',
    icon: 'timer',
    title: 'Call or fold',
    blurb: 'Real spots facing a bet. Weigh equity against pot odds before the timer runs out.',
  },
  {
    id: 'preflop',
    icon: 'grid',
    title: 'Preflop charts',
    blurb: 'Open, defend against an open, or face a 3-bet: raise, call or fold by the charts.',
  },
  {
    id: 'texture',
    icon: 'waves',
    title: 'Board texture',
    blurb: 'Classify flops by suits, connectedness and how wet they are.',
  },
  {
    id: 'mdf',
    icon: 'percent',
    title: 'Defense and bluff math',
    blurb: 'Minimum defense frequency, bluff break-even and pot odds for any bet size.',
  },
  {
    id: 'combos',
    icon: 'cards',
    title: 'Combos and blockers',
    blurb: 'Count how many combos of a hand remain once you see the board and your cards.',
  },
  {
    id: 'setmine',
    icon: 'gem',
    title: 'Set mining',
    blurb: 'Is calling with a small pair profitable at this stack depth? Implied odds and SPR.',
  },
  {
    id: 'review',
    icon: 'repeat',
    title: 'Review missed spots',
    blurb: 'Spaced repetition: drills you missed and mistakes from your own hands come back here.',
  },
]

interface Current {
  item: DrillItem
  key: string
  /** True when the item came from the spaced-repetition deck. */
  fromDeck: boolean
}

export function DrillsPage({ initialMode }: { initialMode: DrillMode | null }) {
  const progress = useProgress()
  const [mode, setMode] = useState<DrillMode | null>(initialMode)
  const [current, setCurrent] = useState<Current | null>(null)
  const [grade, setGrade] = useState<Grade | null>(null)
  const [loading, setLoading] = useState(initialMode !== null)
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

  // Opened from another page with a drill already chosen.
  useEffect(() => {
    if (initialMode) pickItem(initialMode).then(show)
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const start = (m: DrillMode) => {
    setMode(m)
    setSession({ answered: 0, correct: 0 })
    next(m)
  }

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
        <h2 className="page-title">Drills</h2>
        <p className="muted">
          Short, focused practice. Every miss goes into a spaced-repetition deck and comes back
          later, a few minutes at first and then days apart.
        </p>
        <div className="drill-grid">
          {DRILLS.map((d) => {
            const score = d.id === 'review' ? null : progress.drills[d.id]
            return (
              <button
                key={d.id}
                className={`drill-card${d.id === 'review' ? ' drill-card-review' : ''}`}
                onClick={() => start(d.id)}
              >
                <span className="drill-icon">
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
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const info = DRILLS.find((d) => d.id === mode)!
  const score = mode === 'review' ? null : progress.drills[mode]

  return (
    <div className="page drill-page">
      <div className="drill-header">
        <button
          className="btn btn-quiet btn-icon"
          onClick={() => setMode(null)}
          aria-label="All drills"
          title="All drills"
        >
          <Icon name="chevronLeft" />
        </button>
        <h2 className="page-title">{info.title}</h2>
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
            <input type="checkbox" checked={timed} onChange={(e) => setTimed(e.target.checked)} />
            Timer
          </label>
        )}
      </div>

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

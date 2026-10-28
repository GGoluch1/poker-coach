import { useEffect, useMemo, useState } from 'react'
import type { ImportedHand } from '../engine/handHistory'
import { replayStates, splitHandHistories } from '../engine/handHistory'
import { describeEvents, netResult } from '../engine/history'
import { handClass } from '../engine/range'
import type { ImportResult } from '../worker/handlers'
import { runInWorker } from '../worker/client'
import { HandReview } from './HandReview'
import { PageHeader } from './PageHeader'
import { recordHand } from './progress'
import { HOME_CRUMB } from './routes'
import { Table } from './Table'
import type { HandRecord } from './useGame'
import { HERO, reviewRecord } from './useGame'

const STORAGE_KEY = 'poker-coach:imports:v1'
const LIMIT = 500

/** Raw hand history text is stored, not parsed hands, to keep storage small. */
function loadTexts(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : []
  } catch {
    return []
  }
}

function saveTexts(texts: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(texts.slice(-LIMIT)))
  } catch {
    // Too much to store: imports still work for this session.
  }
}

function toRecord(hand: ImportedHand): HandRecord {
  return {
    id: hand.id,
    final: hand.final,
    decisions: hand.decisions,
    profiles: [],
    source: `${hand.site} hand #${hand.handNumber}`,
  }
}

interface Stored {
  hand: ImportedHand
  text: string
}

export function HandsPage() {
  const [hands, setHands] = useState<Stored[]>([])
  const [saved] = useState(loadTexts)
  const [loading, setLoading] = useState(saved.length > 0)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState<ImportResult['errors'] | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  // Parse saved histories on load.
  useEffect(() => {
    const texts = saved
    if (texts.length === 0) return
    runInWorker('importHands', { text: texts.join('\n\n') }).then((result) => {
      const textById = new Map(texts.map((t) => [idFromHeader(t), t]))
      setHands(result.hands.map((hand) => ({ hand, text: textById.get(hand.id) ?? '' })))
      setLoading(false)
    })
  }, [saved])

  const importText = async () => {
    setBusy(true)
    setReport(null)
    setMessage(null)
    try {
      const chunks = splitHandHistories(input)
      if (chunks.length === 0) {
        setMessage('No hands found. Paste PokerStars or GGPoker hand histories.')
        return
      }
      const result = await runInWorker('importHands', { text: input })
      const known = new Set(hands.map((h) => h.hand.id))
      // Pair each parsed hand with its own text so it can be stored.
      const byId = new Map(result.hands.map((h) => [h.id, h]))
      const fresh: Stored[] = []
      for (const chunk of chunks) {
        const id = idFromHeader(chunk)
        const hand = id ? byId.get(id) : undefined
        if (hand && !known.has(hand.id)) {
          fresh.push({ hand, text: chunk })
          known.add(hand.id)
        }
      }
      const next = [...hands, ...fresh]
      setHands(next)
      saveTexts(next.map((h) => h.text))
      setReport(result.errors)
      const dupes = result.hands.length - fresh.length
      setMessage(
        `Imported ${fresh.length} hand${fresh.length === 1 ? '' : 's'}${dupes > 0 ? ` (${dupes} already imported)` : ''}.`,
      )
      setInput('')
      if (fresh.length > 0) setOpenId(fresh.at(-1)!.hand.id)
      // Count new hands toward stats, leaks and spaced repetition.
      for (const { hand } of fresh) {
        const record = toRecord(hand)
        reviewRecord(record).then((r) => recordHand(record.id, r))
      }
    } finally {
      setBusy(false)
    }
  }

  const remove = (id: string) => {
    const next = hands.filter((h) => h.hand.id !== id)
    setHands(next)
    saveTexts(next.map((h) => h.text))
    if (openId === id) setOpenId(null)
  }

  const open = hands.find((h) => h.hand.id === openId)?.hand ?? null

  return (
    <div className="page">
      <PageHeader title="Hand histories" crumbs={[HOME_CRUMB, { label: 'Study' }]}>
        Paste hand histories from PokerStars or GGPoker to replay them and get the same review as
        hands played here. Mistakes go into your review deck, and the hands count toward your stats
        and leaks.
      </PageHeader>

      <div className="hands-layout">
        <section className="card-panel import-panel">
          <label className="field">
            <span>Hand histories</span>
            <textarea
              rows={8}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={"PokerStars Hand #...: Hold'em No Limit ($0.01/$0.02 USD) ..."}
              spellCheck={false}
            />
          </label>
          <button className="btn btn-primary" disabled={busy || !input.trim()} onClick={importText}>
            {busy ? 'Importing…' : 'Import'}
          </button>
          {message && <p className="small">{message}</p>}
          {report && report.length > 0 && (
            <details className="log" open>
              <summary>
                {report.length} hand{report.length === 1 ? '' : 's'} couldn't be imported
              </summary>
              <ul>
                {report.map((e, i) => (
                  <li key={i}>
                    <span className="muted">{e.header}</span>
                    <br />
                    {e.message}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <p className="muted small">
            Supported: no-limit hold'em cash games without antes or straddles. Hands are kept in
            this browser only.
          </p>

          {loading ? (
            <p className="muted">Loading…</p>
          ) : hands.length === 0 ? (
            <p className="muted">No imported hands yet.</p>
          ) : (
            <ul className="history-list">
              {[...hands].reverse().map(({ hand }) => {
                const hero = hand.final.players[HERO]
                const net = netResult(hand.final, HERO) / hand.final.bigBlind
                return (
                  <li key={hand.id} className={hand.id === openId ? 'open' : ''}>
                    <button
                      className="history-row import-row"
                      onClick={() => setOpenId(hand.id === openId ? null : hand.id)}
                      aria-expanded={hand.id === openId}
                    >
                      <span className="small">
                        {hand.site} #{hand.handNumber.slice(-6)}
                      </span>
                      <span>{handClass(hero.hole[0], hero.hole[1])}</span>
                      <span className={net > 0 ? 'pos' : net < 0 ? 'neg' : 'muted'}>
                        {net > 0 ? '+' : ''}
                        {net.toFixed(1)} bb
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="card-panel replay-panel">
          {open ? (
            <ImportedHandView key={open.id} hand={open} onRemove={() => remove(open.id)} />
          ) : (
            <p className="muted">Pick a hand to replay it.</p>
          )}
        </section>
      </div>
    </div>
  )
}

function idFromHeader(chunk: string): string | null {
  const ps = /^PokerStars (?:Hand|Game) #(\d+)/.exec(chunk)
  if (ps) return `ps-${ps[1]}`
  const gg = /^Poker Hand #(\w+)/.exec(chunk)
  return gg ? `gg-${gg[1]}` : null
}

function ImportedHandView({ hand, onRemove }: { hand: ImportedHand; onRemove: () => void }) {
  const states = useMemo(() => replayStates(hand), [hand])
  const [step, setStep] = useState(states.length - 1)
  const state = states[step]
  const lines = describeEvents(state)
  const record = useMemo(() => toRecord(hand), [hand])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowLeft') setStep((x) => Math.max(0, x - 1))
      if (e.key === 'ArrowRight') setStep((x) => Math.min(states.length - 1, x + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [states.length])

  return (
    <div className="replay">
      <div className="page-head">
        <div>
          <strong>
            {hand.site} hand #{hand.handNumber}
          </strong>
          <div className="muted small">
            {hand.stakes}
            {hand.date && ` · ${hand.date}`}
            {hand.scale === 100 && ' · amounts shown in cents'}
          </div>
        </div>
        <button className="btn btn-quiet btn-small" onClick={onRemove}>
          Remove
        </button>
      </div>
      <Table game={state} replay />
      <div className="replay-controls">
        <button
          className="btn btn-icon"
          onClick={() => setStep(0)}
          aria-label="First action"
          disabled={step === 0}
        >
          ⏮
        </button>
        <button
          className="btn btn-icon"
          onClick={() => setStep((x) => Math.max(0, x - 1))}
          disabled={step === 0}
          aria-label="Previous action"
        >
          ◀
        </button>
        <span className="replay-caption small">
          {step === 0 ? 'Cards dealt, blinds posted' : lines.at(-1)}
        </span>
        <button
          className="btn btn-icon"
          onClick={() => setStep((x) => Math.min(states.length - 1, x + 1))}
          disabled={step === states.length - 1}
          aria-label="Next action"
        >
          ▶
        </button>
        <button
          className="btn btn-icon"
          onClick={() => setStep(states.length - 1)}
          aria-label="Last action"
          disabled={step === states.length - 1}
        >
          ⏭
        </button>
      </div>
      <h3 className="replay-heading">Review</h3>
      <HandReview record={record} showLog />
    </div>
  )
}

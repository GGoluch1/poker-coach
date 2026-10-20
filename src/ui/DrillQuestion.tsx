import { useEffect, useRef, useState } from 'react'
import type { Card } from '../engine/card'
import { parseCard } from '../engine/card'
import type { DrillAnswer, DrillItem } from '../engine/drills'
import type { HandClass } from '../engine/range'
import type { Connectedness, SuitTexture, Wetness } from '../engine/texture'
import { CardView } from './CardView'

const CALL_FOLD_SECONDS = 20

interface Props {
  item: DrillItem
  /** True once answered; inputs lock. */
  answered: boolean
  timed: boolean
  onAnswer: (answer: DrillAnswer) => void
  onTimeout: () => void
}

/** Two example cards for a hand class: spades and hearts, or both spades if suited. */
function classCards(cls: HandClass): Card[] {
  return [parseCard(`${cls[0]}s`), parseCard(`${cls[1]}${cls[2] === 's' ? 's' : 'h'}`)]
}

function Cards({ hole, board }: { hole: Card[]; board?: Card[] }) {
  return (
    <div className="drill-cards">
      <div>
        <div className="drill-label">Your hand</div>
        <div className="card-row">
          {hole.map((c, i) => (
            <CardView key={i} card={c} size="lg" />
          ))}
        </div>
      </div>
      {board && board.length > 0 && (
        <div>
          <div className="drill-label">Board</div>
          <div className="card-row">
            {board.map((c, i) => (
              <CardView key={i} card={c} size="lg" />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Situation({ lines }: { lines: string[] }) {
  return (
    <ul className="situation">
      {lines.map((l, i) => (
        <li key={i}>{l}</li>
      ))}
    </ul>
  )
}

/** Fires `onKey(key)` for single-letter shortcuts while mounted. */
function useKeys(onKey: (key: string) => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.ctrlKey || e.metaKey || e.altKey) return
      onKey(e.key.toLowerCase())
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })
}

export function DrillQuestion({ item, answered, timed, onAnswer, onTimeout }: Props) {
  switch (item.kind) {
    case 'outs':
      return <OutsQuestion item={item} answered={answered} onAnswer={onAnswer} />
    case 'preflop':
      return <PreflopQuestion item={item} answered={answered} onAnswer={onAnswer} />
    case 'texture':
      return <TextureQuestion item={item} answered={answered} onAnswer={onAnswer} />
    case 'callfold':
      return (
        <CallFoldQuestion
          item={item}
          answered={answered}
          timed={timed}
          onAnswer={onAnswer}
          onTimeout={onTimeout}
        />
      )
    case 'hand':
      return <HandQuestion item={item} answered={answered} onAnswer={onAnswer} />
  }
}

type Q<K extends DrillItem['kind']> = {
  item: Extract<DrillItem, { kind: K }>
  answered: boolean
  onAnswer: (answer: DrillAnswer) => void
}

function OutsQuestion({ item, answered, onAnswer }: Q<'outs'>) {
  const [value, setValue] = useState('')
  const submit = () => {
    const outs = Number(value)
    if (value.trim() !== '' && Number.isInteger(outs) && outs >= 0) onAnswer({ kind: 'outs', outs })
  }
  return (
    <div className="question">
      <Cards hole={item.hole} board={item.board} />
      <p className="prompt">How many outs improve your hand on the next card?</p>
      <p className="muted small">
        Count unseen cards that move you up a hand category, like pair to two pair or a draw to a
        flush. Cards that only pair the board don't count.
      </p>
      <form
        className="answer-row"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <input
          type="number"
          className="amount"
          min={0}
          max={47}
          value={value}
          disabled={answered}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Number of outs"
          autoFocus
        />
        <button className="btn btn-primary" disabled={answered || value === ''}>
          Check answer
        </button>
      </form>
    </div>
  )
}

function PreflopQuestion({ item, answered, onAnswer }: Q<'preflop'>) {
  const answer = (action: 'raise' | 'fold') => !answered && onAnswer({ kind: 'preflop', action })
  useKeys((k) => (k === 'r' ? answer('raise') : k === 'f' ? answer('fold') : undefined), !answered)
  return (
    <div className="question">
      <p className="prompt">
        Folded to you in the <strong>{item.position}</strong> (6-max, 100 bb). Open or fold?
      </p>
      <div className="drill-cards">
        <div>
          <div className="drill-label">{item.handClass}</div>
          <div className="card-row">
            {classCards(item.handClass).map((c, i) => (
              <CardView key={i} card={c} size="lg" />
            ))}
          </div>
        </div>
      </div>
      <div className="choice-row">
        <button className="btn btn-fold" disabled={answered} onClick={() => answer('fold')}>
          Fold <kbd>F</kbd>
        </button>
        <button className="btn btn-raise" disabled={answered} onClick={() => answer('raise')}>
          Raise <kbd>R</kbd>
        </button>
      </div>
    </div>
  )
}

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string
  options: T[]
  value: T | null
  onChange: (v: T) => void
  disabled: boolean
}) {
  return (
    <div className="segmented-group">
      <div className="drill-label">{label}</div>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o}
            role="radio"
            aria-checked={value === o}
            className={`seg${value === o ? ' seg-on' : ''}`}
            disabled={disabled}
            onClick={() => onChange(o)}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  )
}

function TextureQuestion({ item, answered, onAnswer }: Q<'texture'>) {
  const [suits, setSuits] = useState<SuitTexture | null>(null)
  const [connectedness, setConnectedness] = useState<Connectedness | null>(null)
  const [wetness, setWetness] = useState<Wetness | null>(null)
  const ready = suits && connectedness && wetness
  return (
    <div className="question">
      <div className="drill-cards">
        <div>
          <div className="drill-label">Flop</div>
          <div className="card-row">
            {item.board.map((c, i) => (
              <CardView key={i} card={c} size="lg" />
            ))}
          </div>
        </div>
      </div>
      <p className="prompt">Describe this flop.</p>
      <Segmented
        label="Suits"
        options={['rainbow', 'two-tone', 'monotone']}
        value={suits}
        onChange={setSuits}
        disabled={answered}
      />
      <Segmented
        label="Connectedness"
        options={['disconnected', 'semi-connected', 'connected']}
        value={connectedness}
        onChange={setConnectedness}
        disabled={answered}
      />
      <Segmented
        label="Wetness"
        options={['dry', 'semi-wet', 'wet']}
        value={wetness}
        onChange={setWetness}
        disabled={answered}
      />
      <p className="muted small">
        Connected means some hand already makes a straight; semi-connected means straight draws are
        possible.
      </p>
      <button
        className="btn btn-primary"
        disabled={answered || !ready}
        onClick={() => ready && onAnswer({ kind: 'texture', suits, connectedness, wetness })}
      >
        Check answer
      </button>
    </div>
  )
}

function CallFoldQuestion({
  item,
  answered,
  timed,
  onAnswer,
  onTimeout,
}: Q<'callfold'> & { timed: boolean; onTimeout: () => void }) {
  const [left, setLeft] = useState(CALL_FOLD_SECONDS)
  // Read the latest callback without restarting the countdown when it changes.
  const onTimeoutRef = useRef(onTimeout)
  useEffect(() => {
    onTimeoutRef.current = onTimeout
  })
  const answer = (action: 'call' | 'fold') => !answered && onAnswer({ kind: 'callfold', action })
  useKeys((k) => (k === 'c' ? answer('call') : k === 'f' ? answer('fold') : undefined), !answered)

  useEffect(() => {
    if (!timed || answered) return
    if (left <= 0) {
      onTimeoutRef.current()
      return
    }
    const t = setTimeout(() => setLeft((x) => x - 1), 1000)
    return () => clearTimeout(t)
  }, [left, timed, answered])

  return (
    <div className="question">
      <Situation lines={item.situation} />
      <Cards hole={item.hole} board={item.board} />
      {timed && !answered && (
        <div className="timer" aria-label={`${left} seconds left`}>
          <div className="timer-fill" style={{ width: `${(left / CALL_FOLD_SECONDS) * 100}%` }} />
          <span>{left}s</span>
        </div>
      )}
      <div className="choice-row">
        <button className="btn btn-fold" disabled={answered} onClick={() => answer('fold')}>
          Fold <kbd>F</kbd>
        </button>
        <button className="btn btn-call" disabled={answered} onClick={() => answer('call')}>
          Call {item.toCall} <kbd>C</kbd>
        </button>
      </div>
    </div>
  )
}

function HandQuestion({ item, answered, onAnswer }: Q<'hand'>) {
  return (
    <div className="question">
      <p className="muted small">From your {item.source}. What's the best play?</p>
      <Situation lines={item.situation} />
      <Cards hole={item.hole} board={item.board} />
      <div className="choice-row">
        {item.options.map((o, i) => (
          <button
            key={o.label}
            className="btn"
            disabled={answered}
            onClick={() => onAnswer({ kind: 'hand', option: i })}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

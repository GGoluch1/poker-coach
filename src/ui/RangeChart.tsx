import { useState } from 'react'
import type { HandClass, Position } from '../engine/range'
import { GRID_RANKS, OPEN_RANGES, gridClass, rangeFraction } from '../engine/range'

type OpenPosition = Exclude<Position, 'BB'>
const OPEN_POSITIONS: OpenPosition[] = ['UTG', 'HJ', 'CO', 'BTN', 'SB']

interface Props {
  /** Hero's position and hand, to highlight. */
  position: Position | null
  current: HandClass | null
}

export function RangeChart({ position, current }: Props) {
  const initial = position && position !== 'BB' ? position : 'CO'
  const [selected, setSelected] = useState<OpenPosition>(initial)
  const range = OPEN_RANGES[selected]

  return (
    <div className="charts">
      <p className="muted small">
        Opening ranges for 6-max when everyone before you has folded. Raise the highlighted hands to
        about 2.5 big blinds and fold the rest.
      </p>
      <div className="tabs tabs-small" role="tablist">
        {OPEN_POSITIONS.map((p) => (
          <button
            key={p}
            role="tab"
            aria-selected={selected === p}
            className={`tab${selected === p ? ' tab-on' : ''}`}
            onClick={() => setSelected(p)}
          >
            {p}
          </button>
        ))}
      </div>
      <div className="grid" role="grid" aria-label={`${selected} opening range`}>
        {GRID_RANKS.map((_, row) =>
          GRID_RANKS.map((_, col) => {
            const cls = gridClass(row, col)
            const classes = [
              'cell',
              range.has(cls) ? 'cell-raise' : 'cell-fold',
              cls === current && 'cell-current',
            ]
            return (
              <div key={cls} className={classes.filter(Boolean).join(' ')} role="gridcell">
                {cls}
              </div>
            )
          }),
        )}
      </div>
      <p className="muted small">
        {selected}: open {Math.round(rangeFraction(range) * 100)}% of hands. Suited hands are above
        the diagonal, offsuit below.
        {current && ` Your hand (${current}) is outlined.`}
      </p>
    </div>
  )
}

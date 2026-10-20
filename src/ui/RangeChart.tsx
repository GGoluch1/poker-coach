import { useState } from 'react'
import type { ChartSituation } from '../engine/charts'
import { PREFLOP_CHARTS, chartAction, getChart } from '../engine/charts'
import type { HandClass, Position } from '../engine/range'
import { GRID_RANKS, gridClass, rangeFraction } from '../engine/range'

const SITUATIONS: { id: ChartSituation; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'vsOpen', label: 'vs open' },
  { id: 'vs3bet', label: 'vs 3-bet' },
]

interface Props {
  /** Chart to show first; falls back to the hero's opening chart. */
  chartId?: string | null
  position?: Position | null
  /** Hand to outline. */
  current: HandClass | null
}

function initialChart(chartId: string | null | undefined, position: Position | null | undefined) {
  if (chartId) return chartId
  if (position && position !== 'BB') return `open-${position}`
  return 'open-CO'
}

export function RangeChart({ chartId, position, current }: Props) {
  const [selected, setSelected] = useState(() => initialChart(chartId, position))
  const chart = getChart(selected)
  const inSituation = PREFLOP_CHARTS.filter((c) => c.situation === chart.situation)
  const pct = (x: number) => `${Math.round(x * 100)}%`

  return (
    <div className="charts">
      <div className="tabs tabs-small" role="tablist" aria-label="Situation">
        {SITUATIONS.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={chart.situation === s.id}
            className={`tab${chart.situation === s.id ? ' tab-on' : ''}`}
            onClick={() => setSelected(PREFLOP_CHARTS.find((c) => c.situation === s.id)!.id)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <select
        className="chart-select"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        aria-label="Chart"
      >
        {inSituation.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>
      <p className="muted small">{chart.prompt}</p>
      <div className="grid" role="grid" aria-label={chart.title}>
        {GRID_RANKS.map((_, row) =>
          GRID_RANKS.map((_, col) => {
            const cls = gridClass(row, col)
            const action = chartAction(chart, cls)
            const classes = ['cell', `cell-${action}`, cls === current && 'cell-current']
            return (
              <div key={cls} className={classes.filter(Boolean).join(' ')} role="gridcell">
                {cls}
              </div>
            )
          }),
        )}
      </div>
      <div className="chart-legend small">
        <span>
          <span className="swatch cell-raise" /> {chart.raiseLabel}{' '}
          {pct(rangeFraction(chart.raise))}
        </span>
        {chart.call.size > 0 && (
          <span>
            <span className="swatch cell-call" /> Call {pct(rangeFraction(chart.call))}
          </span>
        )}
        <span>
          <span className="swatch cell-fold" /> Fold
        </span>
      </div>
      <p className="muted small">
        Suited hands are above the diagonal, offsuit below.
        {current && ` Your hand (${current}) is outlined.`} Charts are approximate 6-max, 100 bb
        ranges.
      </p>
    </div>
  )
}

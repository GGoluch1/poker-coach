import type { PointerEvent, ReactNode } from 'react'
import { useState } from 'react'
import type { DayLog } from '../engine/activity'

const W = 600
const H = 160
const PAD = { top: 8, right: 8, bottom: 22, left: 34 }
const PLOT_W = W - PAD.left - PAD.right
const PLOT_H = H - PAD.top - PAD.bottom

function shortDate(day: string) {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** A rounded top for a bar or the top segment of a stack, square at the bottom. */
function barPath(x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h)
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
}

function Tooltip({ x, children }: { x: number; children: ReactNode }) {
  // Keep the tooltip inside the chart near the edges.
  const left = `clamp(0px, calc(${(x / W) * 100}% - 70px), calc(100% - 140px))`
  return (
    <div className="chart-tooltip" style={{ left }} role="status">
      {children}
    </div>
  )
}

/** Hands and drill answers per day, stacked. */
export function DailyActivityChart({ days }: { days: DayLog[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...days.map((d) => d.hands + d.answers))
  const slot = PLOT_W / days.length
  const barW = Math.max(3, slot - 4)
  const y = (v: number) => (v / max) * PLOT_H
  const hovered = hover === null ? null : days[hover]

  return (
    <figure className="chart">
      <div className="chart-legend small">
        <span>
          <span className="swatch chart-swatch-1" /> Hands played
        </span>
        <span>
          <span className="swatch chart-swatch-2" /> Drill answers
        </span>
      </div>
      <div className="chart-plot">
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden onPointerLeave={() => setHover(null)}>
          <line className="chart-grid" x1={PAD.left} x2={W - PAD.right} y1={PAD.top} y2={PAD.top} />
          <text className="chart-axis" x={PAD.left - 6} y={PAD.top + 4} textAnchor="end">
            {max}
          </text>
          <text className="chart-axis" x={PAD.left - 6} y={PAD.top + PLOT_H} textAnchor="end">
            0
          </text>
          {days.map((d, i) => {
            const x = PAD.left + i * slot + (slot - barW) / 2
            const base = PAD.top + PLOT_H
            const hH = y(d.hands)
            const aH = y(d.answers)
            // A 2px surface gap separates the two segments when both are present.
            const gap = hH > 0 && aH > 0 ? 2 : 0
            return (
              <g key={d.day} className={hover !== null && hover !== i ? 'chart-dim' : undefined}>
                {hH > 0 && (
                  <path
                    className="chart-fill-1"
                    d={
                      aH > 0
                        ? `M${x},${base}h${barW}v${-hH}h${-barW}Z`
                        : barPath(x, base - hH, barW, hH, 4)
                    }
                  />
                )}
                {aH > 0 && (
                  <path
                    className="chart-fill-2"
                    d={barPath(x, base - hH - gap - aH, barW, aH, 4)}
                  />
                )}
                {/* Hit target: the whole column, wider than the bar. */}
                <rect
                  x={PAD.left + i * slot}
                  y={PAD.top}
                  width={slot}
                  height={PLOT_H}
                  fill="transparent"
                  onPointerEnter={() => setHover(i)}
                />
              </g>
            )
          })}
          <line
            className="chart-baseline"
            x1={PAD.left}
            x2={W - PAD.right}
            y1={PAD.top + PLOT_H}
            y2={PAD.top + PLOT_H}
          />
          {[0, Math.floor(days.length / 2), days.length - 1].map((i) => (
            <text
              key={i}
              className="chart-axis"
              x={PAD.left + i * slot + slot / 2}
              y={H - 6}
              textAnchor={i === 0 ? 'start' : i === days.length - 1 ? 'end' : 'middle'}
            >
              {shortDate(days[i].day)}
            </text>
          ))}
        </svg>
        {hovered && (
          <Tooltip x={PAD.left + hover! * slot + slot / 2}>
            <strong>{shortDate(hovered.day)}</strong>
            <span>
              <span className="swatch chart-swatch-1" /> {hovered.hands} hands
            </span>
            <span>
              <span className="swatch chart-swatch-2" /> {hovered.answers} answers
              {hovered.answers > 0 &&
                ` · ${Math.round((hovered.correct / hovered.answers) * 100)}%`}
            </span>
          </Tooltip>
        )}
      </div>
      <table className="sr-only">
        <caption>Practice per day</caption>
        <thead>
          <tr>
            <th>Day</th>
            <th>Hands</th>
            <th>Drill answers</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.day}>
              <td>{d.day}</td>
              <td>{d.hands}</td>
              <td>{d.answers}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

/** Running total of big blinds won, one point per day with hands. */
export function ResultsChart({ days }: { days: DayLog[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const points = days
    .filter((d) => d.hands > 0)
    .reduce<{ day: string; hands: number; net: number; total: number }[]>(
      (out, d) => [
        ...out,
        {
          day: d.day,
          hands: d.hands,
          net: d.bigBlinds,
          total: (out.at(-1)?.total ?? 0) + d.bigBlinds,
        },
      ],
      [],
    )
  const lo = Math.min(0, ...points.map((p) => p.total))
  const hi = Math.max(0, ...points.map((p) => p.total))
  const span = hi - lo || 1
  const x = (i: number) =>
    PAD.left + (points.length === 1 ? PLOT_W / 2 : (i / (points.length - 1)) * PLOT_W)
  const y = (v: number) => PAD.top + ((hi - v) / span) * PLOT_H
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.total)}`).join('')
  const hovered = hover === null ? null : points[hover]
  const fmt = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}`

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - box.left) / box.width) * W
    const i = points.length === 1 ? 0 : Math.round(((px - PAD.left) / PLOT_W) * (points.length - 1))
    setHover(Math.max(0, Math.min(points.length - 1, i)))
  }

  return (
    <figure className="chart">
      <div className="chart-plot">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          aria-hidden
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          <line className="chart-baseline" x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} />
          <text className="chart-axis" x={PAD.left - 6} y={y(0) + 4} textAnchor="end">
            0
          </text>
          {hi > 0 && (
            <text className="chart-axis" x={PAD.left - 6} y={y(hi) + 4} textAnchor="end">
              {fmt(hi)}
            </text>
          )}
          {lo < 0 && (
            <text className="chart-axis" x={PAD.left - 6} y={y(lo) + 4} textAnchor="end">
              {fmt(lo)}
            </text>
          )}
          <path className="chart-line" d={line} />
          {hovered && (
            <>
              <line
                className="chart-crosshair"
                x1={x(hover!)}
                x2={x(hover!)}
                y1={PAD.top}
                y2={PAD.top + PLOT_H}
              />
              <circle className="chart-dot" cx={x(hover!)} cy={y(hovered.total)} r={5} />
            </>
          )}
          <text className="chart-axis" x={x(0)} y={H - 6} textAnchor="start">
            {shortDate(points[0].day)}
          </text>
          {points.length > 1 && (
            <text className="chart-axis" x={x(points.length - 1)} y={H - 6} textAnchor="end">
              {shortDate(points.at(-1)!.day)}
            </text>
          )}
        </svg>
        {hovered && (
          <Tooltip x={x(hover!)}>
            <strong>{shortDate(hovered.day)}</strong>
            <span>Total {fmt(hovered.total)} bb</span>
            <span className="muted">
              That day {fmt(hovered.net)} bb in {hovered.hands} hand{hovered.hands === 1 ? '' : 's'}
            </span>
          </Tooltip>
        )}
      </div>
      <table className="sr-only">
        <caption>Running total of big blinds by day</caption>
        <thead>
          <tr>
            <th>Day</th>
            <th>Hands</th>
            <th>Net bb</th>
            <th>Total bb</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.day}>
              <td>{p.day}</td>
              <td>{p.hands}</td>
              <td>{p.net.toFixed(1)}</td>
              <td>{p.total.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

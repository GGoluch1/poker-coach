/** Practice on one local calendar day. */
export interface DayLog {
  /** YYYY-MM-DD in local time. */
  day: string
  hands: number
  bigBlinds: number
  answers: number
  correct: number
}

const KEEP_DAYS = 365

export function dayKey(t: number): string {
  const d = new Date(t)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Adds to today's log, keeping the list in date order and about a year long. */
export function logDay(days: DayLog[], now: number, add: Partial<Omit<DayLog, 'day'>>): DayLog[] {
  const day = dayKey(now)
  const last = days.at(-1)
  const today = last?.day === day ? last : { day, hands: 0, bigBlinds: 0, answers: 0, correct: 0 }
  const next: DayLog = {
    day,
    hands: today.hands + (add.hands ?? 0),
    bigBlinds: today.bigBlinds + (add.bigBlinds ?? 0),
    answers: today.answers + (add.answers ?? 0),
    correct: today.correct + (add.correct ?? 0),
  }
  return [...(today === last ? days.slice(0, -1) : days), next].slice(-KEEP_DAYS)
}

/** Days in a row with any practice, ending today, or yesterday if today has none yet. */
export function streak(days: DayLog[], now: number): number {
  const active = new Set(days.filter((d) => d.hands + d.answers > 0).map((d) => d.day))
  // Step back by calendar day, not 24 hours, so daylight saving changes can't skip one.
  const d = new Date(now)
  if (!active.has(dayKey(d.getTime()))) d.setDate(d.getDate() - 1)
  let n = 0
  while (active.has(dayKey(d.getTime()))) {
    n++
    d.setDate(d.getDate() - 1)
  }
  return n
}

/** The last `count` days ending today, oldest first, with empty days filled in. */
export function recentDays(days: DayLog[], now: number, count: number): DayLog[] {
  const byDay = new Map(days.map((d) => [d.day, d]))
  const d = new Date(now)
  d.setDate(d.getDate() - (count - 1))
  const out: DayLog[] = []
  for (let i = 0; i < count; i++) {
    const day = dayKey(d.getTime())
    out.push(byDay.get(day) ?? { day, hands: 0, bigBlinds: 0, answers: 0, correct: 0 })
    d.setDate(d.getDate() + 1)
  }
  return out
}

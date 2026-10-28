import { describe, expect, it } from 'vitest'
import { dayKey, logDay, recentDays, streak } from './activity'

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime()

describe('activity', () => {
  it('formats local days', () => {
    expect(dayKey(at(2026, 3, 7, 0))).toBe('2026-03-07')
    expect(dayKey(at(2026, 12, 31, 23))).toBe('2026-12-31')
  })

  it('adds to today and starts a new entry on a new day', () => {
    let days = logDay([], at(2026, 5, 1), { hands: 1, bigBlinds: 2.5 })
    days = logDay(days, at(2026, 5, 1, 18), { answers: 1, correct: 1 })
    days = logDay(days, at(2026, 5, 2), { hands: 1, bigBlinds: -1 })
    expect(days).toEqual([
      { day: '2026-05-01', hands: 1, bigBlinds: 2.5, answers: 1, correct: 1 },
      { day: '2026-05-02', hands: 1, bigBlinds: -1, answers: 0, correct: 0 },
    ])
  })

  it('counts a streak ending today or yesterday', () => {
    let days = logDay([], at(2026, 5, 1), { answers: 1 })
    days = logDay(days, at(2026, 5, 2), { hands: 1 })
    days = logDay(days, at(2026, 5, 3), { answers: 2 })
    expect(streak(days, at(2026, 5, 3))).toBe(3)
    // Nothing yet today: yesterday's streak still counts.
    expect(streak(days, at(2026, 5, 4))).toBe(3)
    // A missed day ends it.
    expect(streak(days, at(2026, 5, 5))).toBe(0)
    expect(streak([], at(2026, 5, 5))).toBe(0)
  })

  it('steps over daylight saving changes', () => {
    // Clocks change in late March or early April in most places that use DST.
    let days: ReturnType<typeof logDay> = []
    for (let d = 20; d <= 31; d++) days = logDay(days, at(2026, 3, d, 0), { hands: 1 })
    expect(streak(days, at(2026, 3, 31, 0))).toBe(12)
  })

  it('fills in empty days for charts', () => {
    const days = logDay([], at(2026, 5, 2), { hands: 3 })
    const recent = recentDays(days, at(2026, 5, 3), 3)
    expect(recent.map((d) => [d.day, d.hands])).toEqual([
      ['2026-05-01', 0],
      ['2026-05-02', 3],
      ['2026-05-03', 0],
    ])
  })
})

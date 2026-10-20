/**
 * Leitner-style spaced repetition. A missed item starts in box 0 and comes back
 * within minutes; each correct answer moves it up a box with a longer wait, and an
 * item that clears the last box is retired. A miss sends it back to box 0.
 */

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

/** Wait before an item in each box is due again. */
export const BOX_INTERVALS = [2 * MINUTE, 10 * MINUTE, DAY, 3 * DAY, 7 * DAY, 21 * DAY]

export interface SrsCard<T> {
  /** Identifies the question, so the same miss isn't added twice. */
  key: string
  item: T
  box: number
  due: number
  lapses: number
  added: number
}

/** Adds a missed item, or resets it to box 0 if it is already in the deck. */
export function addMiss<T>(deck: SrsCard<T>[], key: string, item: T, now: number): SrsCard<T>[] {
  const existing = deck.find((c) => c.key === key)
  if (existing) return recordAnswer(deck, key, false, now)
  return [...deck, { key, item, box: 0, due: now + BOX_INTERVALS[0], lapses: 0, added: now }]
}

export function recordAnswer<T>(
  deck: SrsCard<T>[],
  key: string,
  correct: boolean,
  now: number,
): SrsCard<T>[] {
  return deck.flatMap((c) => {
    if (c.key !== key) return [c]
    if (!correct) return [{ ...c, box: 0, due: now + BOX_INTERVALS[0], lapses: c.lapses + 1 }]
    const box = c.box + 1
    if (box >= BOX_INTERVALS.length) return []
    return [{ ...c, box, due: now + BOX_INTERVALS[box] }]
  })
}

/** Cards due now, most overdue first. */
export function dueCards<T>(
  deck: SrsCard<T>[],
  now: number,
  filter: (item: T) => boolean = () => true,
): SrsCard<T>[] {
  return deck.filter((c) => c.due <= now && filter(c.item)).sort((a, b) => a.due - b.due)
}

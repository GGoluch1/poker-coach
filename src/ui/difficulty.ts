import type { Difficulty, GeneratedKind } from '../engine/drills'
import { DIFFICULTIES } from '../engine/drills'

/** Chosen difficulty per drill. Uses the shared prefix, so backups include it. */
const STORAGE_KEY = 'poker-coach:difficulty:v1'

function loadAll(): Partial<Record<GeneratedKind, Difficulty>> {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function loadDifficulty(kind: GeneratedKind): Difficulty {
  const saved = loadAll()[kind]
  return saved && DIFFICULTIES.includes(saved) ? saved : 'medium'
}

export function saveDifficulty(kind: GeneratedKind, difficulty: Difficulty) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loadAll(), [kind]: difficulty }))
  } catch {
    // The choice still applies for this visit.
  }
}

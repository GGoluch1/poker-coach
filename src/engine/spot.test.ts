import { describe, it, expect } from 'vitest'
import { parseCards } from './card'
import { describeSituation } from './describe'
import { legalActions } from './game'
import { generateSpot } from './generate'
import { seededRng } from './rng'
import { describeBoard } from './texture'

describe('describeBoard', () => {
  it.each([
    ['Ks 7d 2c', 'rainbow', 'disconnected', 'dry', 'K-high, rainbow, dry'],
    ['Ks 7s 2c', 'two-tone', 'disconnected', 'semi-wet', 'K-high, two-tone, semi-wet'],
    ['9h 8h 7h', 'monotone', 'connected', 'wet', '9-high, monotone, connected, wet'],
    ['Jc 9d 7s', 'rainbow', 'connected', 'semi-wet', 'J-high, rainbow, connected, semi-wet'],
    [
      'Kc Qd 2s',
      'rainbow',
      'semi-connected',
      'semi-wet',
      'K-high, rainbow, semi-connected, semi-wet',
    ],
    ['7c 7d 2s', 'rainbow', 'disconnected', 'dry', '7-high, rainbow, paired, dry'],
    ['Ac 2d 3s', 'rainbow', 'connected', 'semi-wet', 'A-high, rainbow, connected, semi-wet'],
  ])('%s', (board, suits, connectedness, wetness, summary) => {
    const t = describeBoard(parseCards(board))
    expect(t).toMatchObject({ suits, connectedness, wetness, summary })
  })

  it('knows when straights and flushes are possible', () => {
    expect(describeBoard(parseCards('9h 8h 7h')).flushPossible).toBe(true)
    expect(describeBoard(parseCards('Ks 7d 2c')).straightPossible).toBe(false)
    expect(describeBoard(parseCards('Ks 7d 2c 6h 5s')).straightPossible).toBe(true)
  })
})

describe('generateSpot', () => {
  it('returns a hero decision on the requested street', () => {
    for (const street of ['preflop', 'flop', 'turn', 'river'] as const) {
      const s = generateSpot({ street, rng: seededRng(3) })
      expect(s.toAct).toBe(0)
      expect(s.street).toBe(street)
      expect(s.board).toHaveLength({ preflop: 0, flop: 3, turn: 4, river: 5 }[street])
    }
  })

  it('can require facing a bet', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const s = generateSpot({ street: 'turn', facingBet: true, rng: seededRng(seed) })
      expect(legalActions(s).toCall).toBeGreaterThan(0)
    }
  })

  it('is reproducible with a seed', () => {
    const a = generateSpot({ street: 'flop', rng: seededRng(8) })
    const b = generateSpot({ street: 'flop', rng: seededRng(8) })
    expect(a).toEqual(b)
  })
})

describe('describeSituation', () => {
  it('summarizes position, action and what hero faces', () => {
    const s = generateSpot({ street: 'flop', facingBet: true, players: 3, rng: seededRng(4) })
    const heads = generateSpot({ street: 'turn', facingBet: true, players: 2, rng: seededRng(4) })
    expect(describeSituation(heads, 0)[0]).toMatch(/^Heads-up/)
    for (const line of describeSituation(heads, 0)) expect(line).not.toMatch(/, You /)
    const lines = describeSituation(s, 0)
    expect(lines[0]).toMatch(
      /^3-handed, blinds 1\/2\. You're (on|in) the (BTN|SB|BB) with \S+ \S+\.$/,
    )
    expect(lines[1]).toMatch(/^Effective stack: \d+ \(\d+ bb\)\.$/)
    expect(lines.some((l) => l.startsWith('Flop: '))).toBe(true)
    expect(lines.at(-1)).toMatch(/^Pot is \d+\. You have \d+ to call\.$/)
  })
})

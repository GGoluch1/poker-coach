import { describe, it, expect } from 'vitest'
import { cardToString } from './card'
import { parseHandHistory, replayStates, splitHandHistories } from './handHistory'
import { netResult } from './history'
import { positions } from './range'

const STARS = `PokerStars Hand #245678901234:  Hold'em No Limit ($0.01/$0.02 USD) - 2024/03/05 21:14:09 ET
Table 'Alcyone II' 6-max Seat #4 is the button
Seat 1: villainA ($2.13 in chips)
Seat 2: Hero ($2.00 in chips)
Seat 3: villainB ($1.87 in chips)
Seat 4: villainC ($2.40 in chips)
Seat 5: villainD ($0.95 in chips)
Seat 6: villainE ($2.00 in chips)
villainD: posts small blind $0.01
villainE: posts big blind $0.02
*** HOLE CARDS ***
Dealt to Hero [Ah Qh]
villainA: folds
Hero: raises $0.04 to $0.06
villainB: folds
villainC: calls $0.06
villainD: folds
villainE: folds
*** FLOP *** [Qd 7s 2h]
Hero: bets $0.08
villainC: calls $0.08
*** TURN *** [Qd 7s 2h] [9c]
Hero: checks
villainC: bets $0.15
Hero: calls $0.15
*** RIVER *** [Qd 7s 2h 9c] [3d]
Hero: bets $0.30
villainC: folds
Uncalled bet ($0.30) returned to Hero
Hero collected $0.61 from pot
Hero: doesn't show hand
*** SUMMARY ***
Total pot $0.61 | Rake $0.02
Board [Qd 7s 2h 9c 3d]
Seat 1: villainA folded before Flop (didn't bet)
Seat 2: Hero collected ($0.61)`

const GG = `Poker Hand #RC1234567890: Hold'em No Limit ($0.05/$0.1) - 2024/04/01 10:00:00
Table 'RushAndCash12345' 6-max Seat #1 is the button
Seat 1: 5a1b2c ($10 in chips)
Seat 2: Hero ($10.5 in chips)
Seat 3: 9f8e7d ($12.3 in chips)
Hero: posts small blind $0.05
9f8e7d: posts big blind $0.1
*** HOLE CARDS ***
Dealt to 5a1b2c
Dealt to Hero [Ks Kd]
Dealt to 9f8e7d
5a1b2c: raises $0.15 to $0.25
Hero: raises $0.75 to $1
9f8e7d: folds
5a1b2c: calls $0.75
*** FLOP *** [8h 4c 2s]
Hero: bets $1.2
5a1b2c: raises $3.2 to $4.4
Hero: raises $5.1 to $9.5 and is all-in
5a1b2c: calls $4.6 and is all-in
Uncalled bet ($0.5) returned to Hero
*** TURN *** [8h 4c 2s] [Jd]
*** RIVER *** [8h 4c 2s Jd] [3h]
*** SHOWDOWN ***
5a1b2c: shows [Ah Ad]
Hero: shows [Ks Kd]
5a1b2c collected $20.1 from pot
*** SUMMARY ***`

describe('parseHandHistory', () => {
  it('replays a PokerStars hand with the hero in seat 0', () => {
    const hand = parseHandHistory(STARS)
    expect(hand).toMatchObject({
      id: 'ps-245678901234',
      site: 'PokerStars',
      stakes: '$0.01/$0.02',
      scale: 100,
      heroName: 'Hero',
      date: '2024/03/05 21:14:09',
    })
    const s = hand.final
    expect(s.players.map((p) => p.name)).toEqual([
      'Hero',
      'villainB',
      'villainC',
      'villainD',
      'villainE',
      'villainA',
    ])
    expect(s.players.map((p) => p.hole.map(cardToString).join(''))[0]).toBe('AhQh')
    expect(s.board.map(cardToString)).toEqual(['Qd', '7s', '2h', '9c', '3d'])
    expect(
      positions(
        s.players.map((p) => p.inHand),
        s.button,
      )[0],
    ).toBe('HJ')
    expect(hand.decisions.map((d) => d.action.type)).toEqual([
      'raise',
      'raise',
      'check',
      'call',
      'raise',
    ])
    expect(netResult(s, 0)).toBe(32)
    expect(s.players[0].stack).toBe(232)
  })

  it('replays a GGPoker all-in with a showdown', () => {
    const hand = parseHandHistory(GG)
    expect(hand.id).toBe('gg-RC1234567890')
    const s = hand.final
    expect(s.showdown).toBe(true)
    expect(s.players[0].stack).toBe(50)
    expect(netResult(s, 0)).toBe(-1000)
    expect(s.players.find((p) => p.name === '5a1b2c')!.hole.map(cardToString)).toEqual(['Ah', 'Ad'])
    expect(hand.decisions).toHaveLength(3)
  })

  it('steps through every state', () => {
    const hand = parseHandHistory(STARS)
    const states = replayStates(hand)
    expect(states).toHaveLength(hand.actions.length + 1)
    expect(states.at(-1)).toEqual(hand.final)
  })

  it('explains what it cannot import', () => {
    expect(() => parseHandHistory('hello')).toThrow(/Unrecognized format/)
    expect(() => parseHandHistory(STARS.replace("Hold'em No Limit", 'Omaha Pot Limit'))).toThrow(
      /no-limit hold'em/,
    )
    const ante = STARS.replace(
      'villainD: posts small blind',
      'villainA: posts the ante $0.01\nvillainD: posts small blind',
    )
    expect(() => parseHandHistory(ante)).toThrow(/Antes/)
    const wrongOrder = STARS.replace('villainA: folds\nHero: raises', 'Hero: raises')
    expect(() => parseHandHistory(wrongOrder)).toThrow(/Expected villainA to act/)
  })

  it('splits pasted text into hands', () => {
    const chunks = splitHandHistories(`﻿${STARS}\n\n\n${GG}\n`)
    expect(chunks).toHaveLength(2)
    expect(chunks[1].startsWith('Poker Hand #RC')).toBe(true)
  })
})

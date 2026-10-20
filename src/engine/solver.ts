import type { Card } from './card'
import type { CardId } from './fastEval'
import { scoreIds, toId } from './fastEval'
import type { HandClass, Range } from './range'
import { combos, handClass } from './range'

/**
 * A river spot for the toy solver. OOP acts first and may check or bet; IP may
 * check back or bet after a check; a player facing a bet may call or fold.
 * There are no raises, which keeps the tree small enough to solve instantly.
 */
export interface RiverGame {
  board: Card[]
  /** [OOP range, IP range]. */
  ranges: [Range, Range]
  pot: number
  /** Effective stack behind; caps bet sizes. */
  stack: number
  /** Bet sizes as fractions of the pot. */
  betSizes: number[]
}

export interface SolverNodeResult {
  /** Action codes from the root joined by "-", e.g. "x-b0". */
  path: string
  player: 0 | 1
  /** Human-readable history, e.g. "OOP checks, IP bets 10", or "Start of the river". */
  history: string
  actions: string[]
  /** Share of the player's range (weighted by reach) taking each action. */
  overall: number[]
  /** Average strategy by hand class, for classes that reach this node. */
  classes: { cls: HandClass; combos: number; freqs: number[] }[]
}

export interface SolverResult {
  nodes: SolverNodeResult[]
  /** Expected chips won from the pot by [OOP, IP]; they sum to the pot. */
  ev: [number, number]
  /** Average gain a perfect counter-strategy would find, as a fraction of the pot. */
  exploitability: number
  iterations: number
}

type Player = 0 | 1

interface ActionNode {
  kind: 'action'
  player: Player
  path: string
  history: string
  actions: string[]
  children: Node[]
  regrets: Float64Array[]
  strategySum: Float64Array[]
}
interface FoldNode {
  kind: 'fold'
  winner: Player
}
interface ShowdownNode {
  kind: 'showdown'
  /** Chips each player put in on the river. */
  invested: number
}
type Node = ActionNode | FoldNode | ShowdownNode

const NAMES = ['OOP', 'IP'] as const

interface Hands {
  cards: [CardId, CardId][]
  classes: HandClass[]
  scores: Float64Array
  /** Indices sorted by score, weakest first, and the same reversed. */
  order: number[]
  reversed: number[]
}

function buildHands(range: Range, board: Card[]): Hands {
  const boardIds = board.map(toId)
  const dead = new Set(boardIds)
  const cards: [CardId, CardId][] = []
  const classes: HandClass[] = []
  for (const cls of range) {
    for (const [a, b] of combos(cls)) {
      const ia = toId(a)
      const ib = toId(b)
      if (dead.has(ia) || dead.has(ib)) continue
      cards.push([ia, ib])
      classes.push(handClass(a, b))
    }
  }
  const scores = new Float64Array(cards.length)
  const seven = new Int32Array(7)
  boardIds.forEach((id, i) => (seven[2 + i] = id))
  cards.forEach(([a, b], i) => {
    seven[0] = a
    seven[1] = b
    scores[i] = scoreIds(seven)
  })
  const order = cards.map((_, i) => i).sort((x, y) => scores[x] - scores[y])
  return { cards, classes, scores, order, reversed: [...order].reverse() }
}

function betAmounts(game: RiverGame): number[] {
  const sizes = game.betSizes.map((f) => Math.min(game.stack, Math.round(f * game.pot)))
  return [...new Set(sizes.filter((x) => x > 0))].sort((a, b) => a - b)
}

function buildTree(game: RiverGame, counts: [number, number]): ActionNode {
  const bets = betAmounts(game)
  const label = (x: number) => (x >= game.stack ? `All in ${x}` : `Bet ${x}`)
  const node = (
    player: Player,
    path: string,
    history: string,
    entries: [string, string, Node][],
  ) => {
    const n: ActionNode = {
      kind: 'action',
      player,
      path,
      history,
      actions: entries.map(([, name]) => name),
      children: entries.map(([, , child]) => child),
      regrets: entries.map(() => new Float64Array(counts[player])),
      strategySum: entries.map(() => new Float64Array(counts[player])),
    }
    return n
  }
  const join = (path: string, code: string) => (path ? `${path}-${code}` : code)
  const facing = (player: Player, path: string, history: string, amount: number) =>
    node(player, path, history, [
      ['f', 'Fold', { kind: 'fold', winner: (1 - player) as Player }],
      ['c', 'Call', { kind: 'showdown', invested: amount }],
    ])

  const ipAfterCheck = node(1, 'x', 'OOP checks', [
    ['x', 'Check', { kind: 'showdown', invested: 0 }],
    ...bets.map((b, i): [string, string, Node] => [
      `b${i}`,
      label(b),
      facing(0, join('x', `b${i}`), `OOP checks, IP bets ${b}`, b),
    ]),
  ])
  return node(0, '', 'Start of the river', [
    ['x', 'Check', ipAfterCheck],
    ...bets.map((b, i): [string, string, Node] => [
      `b${i}`,
      label(b),
      facing(1, `b${i}`, `OOP bets ${b}`, b),
    ]),
  ])
}

/** Regret matching: current strategy for one hand at a node. */
function currentStrategy(node: ActionNode, h: number, out: Float64Array) {
  let sum = 0
  for (let a = 0; a < node.actions.length; a++) {
    out[a] = Math.max(0, node.regrets[a][h])
    sum += out[a]
  }
  for (let a = 0; a < node.actions.length; a++) {
    out[a] = sum > 0 ? out[a] / sum : 1 / node.actions.length
  }
}

function averageStrategy(node: ActionNode, h: number, out: Float64Array) {
  let sum = 0
  for (let a = 0; a < node.actions.length; a++) sum += node.strategySum[a][h]
  for (let a = 0; a < node.actions.length; a++) {
    out[a] = sum > 0 ? node.strategySum[a][h] / sum : 1 / node.actions.length
  }
}

export function solveRiver(game: RiverGame, iterations = 1000): SolverResult {
  if (game.board.length !== 5) throw new Error('the river solver needs a five-card board')
  const hands: [Hands, Hands] = [
    buildHands(game.ranges[0], game.board),
    buildHands(game.ranges[1], game.board),
  ]
  if (hands[0].cards.length === 0 || hands[1].cards.length === 0) {
    throw new Error('each range needs at least one combo that does not clash with the board')
  }
  const counts: [number, number] = [hands[0].cards.length, hands[1].cards.length]
  const root = buildTree(game, counts)
  const pot = game.pot

  // For each player's hand, the index of the identical combo in the opponent's list, or -1.
  const same: [Int32Array, Int32Array] = [new Int32Array(counts[0]), new Int32Array(counts[1])]
  for (const p of [0, 1] as Player[]) {
    const key = new Map(hands[1 - p].cards.map(([a, b], j) => [a * 52 + b, j]))
    hands[p].cards.forEach(
      ([a, b], i) => (same[p][i] = key.get(a * 52 + b) ?? key.get(b * 52 + a) ?? -1),
    )
  }

  const cardMass = new Float64Array(52)
  /** Opponent reach that doesn't clash with each of p's hands. */
  function oppMass(p: Player, rOpp: Float64Array): Float64Array {
    const opp = hands[1 - p]
    cardMass.fill(0)
    let total = 0
    opp.cards.forEach(([a, b], j) => {
      total += rOpp[j]
      cardMass[a] += rOpp[j]
      cardMass[b] += rOpp[j]
    })
    const out = new Float64Array(counts[p])
    hands[p].cards.forEach(([a, b], i) => {
      const s = same[p][i]
      out[i] = total - cardMass[a] - cardMass[b] + (s >= 0 ? rOpp[s] : 0)
    })
    return out
  }

  /** Opponent reach that p's hands beat (dir 1) or lose to (dir -1), net of card removal. */
  function sweep(p: Player, rOpp: Float64Array, dir: 1 | -1): Float64Array {
    const mine = hands[p]
    const opp = hands[1 - p]
    const myOrder = dir === 1 ? mine.order : mine.reversed
    const oppOrder = dir === 1 ? opp.order : opp.reversed
    cardMass.fill(0)
    const out = new Float64Array(counts[p])
    let total = 0
    let k = 0
    for (const i of myOrder) {
      const score = mine.scores[i]
      while (k < oppOrder.length && (opp.scores[oppOrder[k]] - score) * dir < 0) {
        const j = oppOrder[k++]
        const [a, b] = opp.cards[j]
        total += rOpp[j]
        cardMass[a] += rOpp[j]
        cardMass[b] += rOpp[j]
      }
      // An identical combo has an equal score, so it is never in the strictly-beaten set.
      const [a, b] = mine.cards[i]
      out[i] = total - cardMass[a] - cardMass[b]
    }
    return out
  }

  function terminalValue(
    node: FoldNode | ShowdownNode,
    p: Player,
    rOpp: Float64Array,
  ): Float64Array {
    const mass = oppMass(p, rOpp)
    if (node.kind === 'fold') {
      if (node.winner !== p) return new Float64Array(counts[p])
      return mass.map((m) => m * pot)
    }
    const x = node.invested
    const win = sweep(p, rOpp, 1)
    const lose = sweep(p, rOpp, -1)
    return mass.map((m, i) => (pot + x) * win[i] - x * lose[i] + (pot / 2) * (m - win[i] - lose[i]))
  }

  type Mode = 'train' | 'average' | 'best'
  const strat = new Float64Array(8)

  /** Counterfactual values for p's hands. `t` weights the strategy average when training. */
  function walk(
    node: Node,
    p: Player,
    rSelf: Float64Array,
    rOpp: Float64Array,
    mode: Mode,
    t: number,
  ): Float64Array {
    if (node.kind !== 'action') return terminalValue(node, p, rOpp)
    const n = node.actions.length
    if (node.player === p) {
      const values = new Float64Array(counts[p])
      const childValues: Float64Array[] = []
      const strategies = node.actions.map(() => new Float64Array(counts[p]))
      for (let h = 0; h < counts[p]; h++) {
        if (mode === 'average') averageStrategy(node, h, strat)
        else currentStrategy(node, h, strat)
        for (let a = 0; a < n; a++) strategies[a][h] = strat[a]
      }
      for (let a = 0; a < n; a++) {
        const childReach = rSelf.map((r, h) => r * strategies[a][h])
        childValues.push(walk(node.children[a], p, childReach, rOpp, mode, t))
      }
      for (let h = 0; h < counts[p]; h++) {
        if (mode === 'best') {
          let best = -Infinity
          for (let a = 0; a < n; a++) best = Math.max(best, childValues[a][h])
          values[h] = best
        } else {
          for (let a = 0; a < n; a++) values[h] += strategies[a][h] * childValues[a][h]
        }
      }
      if (mode === 'train') {
        for (let a = 0; a < n; a++) {
          const regrets = node.regrets[a]
          const sums = node.strategySum[a]
          for (let h = 0; h < counts[p]; h++) {
            // CFR+: regrets floored at zero, strategy averaged with linear weights.
            regrets[h] = Math.max(0, regrets[h] + childValues[a][h] - values[h])
            sums[h] += t * rSelf[h] * strategies[a][h]
          }
        }
      }
      return values
    }
    const q = node.player
    const values = new Float64Array(counts[p])
    const oppStrategies = node.actions.map(() => new Float64Array(counts[q]))
    for (let h = 0; h < counts[q]; h++) {
      if (mode === 'train') currentStrategy(node, h, strat)
      else averageStrategy(node, h, strat)
      for (let a = 0; a < n; a++) oppStrategies[a][h] = strat[a]
    }
    for (let a = 0; a < n; a++) {
      const childOpp = rOpp.map((r, h) => r * oppStrategies[a][h])
      const v = walk(node.children[a], p, rSelf, childOpp, mode, t)
      for (let h = 0; h < counts[p]; h++) values[h] += v[h]
    }
    return values
  }

  const ones = (p: Player) => new Float64Array(counts[p]).fill(1)
  for (let t = 1; t <= iterations; t++) {
    for (const p of [0, 1] as Player[]) walk(root, p, ones(p), ones((1 - p) as Player), 'train', t)
  }

  // Values are summed over matchups; divide by the number of valid matchups for an average.
  const pairs = oppMass(0, ones(1)).reduce((a, b) => a + b, 0)
  const value = (p: Player, mode: Mode) =>
    walk(root, p, ones(p), ones((1 - p) as Player), mode, 0).reduce((a, b) => a + b, 0) / pairs
  const ev: [number, number] = [value(0, 'average'), value(1, 'average')]
  const exploitability = Math.max(0, (value(0, 'best') + value(1, 'best') - pot) / 2 / pot)

  const nodes: SolverNodeResult[] = []
  function collect(node: Node, reach: [Float64Array, Float64Array]) {
    if (node.kind !== 'action') return
    const p = node.player
    const n = node.actions.length
    const strategies = node.actions.map(() => new Float64Array(counts[p]))
    for (let h = 0; h < counts[p]; h++) {
      averageStrategy(node, h, strat)
      for (let a = 0; a < n; a++) strategies[a][h] = strat[a]
    }
    const byClass = new Map<HandClass, { weight: number; combos: number; freqs: number[] }>()
    const overall = new Array(n).fill(0)
    let totalReach = 0
    hands[p].classes.forEach((cls, h) => {
      const r = reach[p][h]
      if (r <= 1e-9) return
      const entry = byClass.get(cls) ?? { weight: 0, combos: 0, freqs: new Array(n).fill(0) }
      entry.weight += r
      entry.combos++
      for (let a = 0; a < n; a++) {
        entry.freqs[a] += r * strategies[a][h]
        overall[a] += r * strategies[a][h]
      }
      totalReach += r
      byClass.set(cls, entry)
    })
    nodes.push({
      path: node.path,
      player: p,
      history: node.history,
      actions: node.actions,
      overall: overall.map((x) => (totalReach > 0 ? x / totalReach : 0)),
      classes: [...byClass].map(([cls, e]) => ({
        cls,
        combos: e.combos,
        freqs: e.freqs.map((x) => x / e.weight),
      })),
    })
    node.children.forEach((child, a) => {
      const next: [Float64Array, Float64Array] = [reach[0], reach[1]]
      next[p] = reach[p].map((r, h) => r * strategies[a][h])
      collect(child, next)
    })
  }
  collect(root, [ones(0), ones(1)])

  return { nodes, ev, exploitability, iterations }
}

export const PLAYER_NAMES = NAMES

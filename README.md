# Poker Coach

Play no-limit hold'em against bots in the browser, drill the fundamentals, and study river spots
with a small game-theory solver. There's no backend: everything runs in the browser, and the heavy
math runs in a Web Worker.

## Features

- **Play**: 2 to 6 players, 1/2 blinds, side pots, and bots. A live coach shows equity against
  opponents' likely ranges, pot odds, outs and chart advice, and every decision is reviewed after
  the hand.
- **Drills**:
  - **Outs**: count your outs and compare the rule of 2 and 4 with the exact odds.
  - **Call or fold**: real generated spots facing a bet, with a timer.
  - **Preflop opens**: raise or fold by position against 6-max charts.
  - **Board texture**: suits, connectedness and wetness.
- **Spaced repetition**: missed drills and mistakes from your own hands come back on a Leitner
  schedule, a few minutes at first and then days apart.
- **Progress**: VPIP, PFR, 3-bet, fold to c-bet and showdown stats against target ranges; a leak
  tracker that groups your mistakes by type; and drill accuracy.
- **River solver**: CFR+ on a river spot with two ranges and chosen bet sizes. It shows each
  player's strategy by hand and how exploitable the result is. The game is deliberately small:
  check or bet, then call or fold, with no raises.

Postflop advice in the coach and reviews is labeled **heuristic**: it compares equity against
ranges guessed from preflop action with the pot odds, and is not a solver result. Preflop advice
comes from the opening charts.

Progress and the current game are saved in your browser.

## Development

```
npm install
npm run dev      # local dev server
npm test         # unit tests (Vitest)
npm run build    # type-check and production build
npm run lint
```

## Layout

- `src/engine/`: the poker engine in plain TypeScript, with no UI imports.
  - `card`, `deck`, `hand`, `fastEval`: cards, shuffling, and hand evaluation (`fastEval` is the
    allocation-free version used in hot loops)
  - `pot`, `game`: side pots and the betting state machine
  - `range`, `equity`: preflop ranges and charts, Monte Carlo equity, outs
  - `texture`, `describe`, `generate`: board texture, plain-English situation summaries, and a random
    spot generator that plays real hands up to a decision
  - `analysis`, `bot`, `review`, `history`: spot analysis, bot strategy, decision grading, and
    hand history text
  - `drills`, `srs`, `stats`: drill generation and grading, spaced repetition, and player stats
  - `solver`: the CFR+ river solver
- `src/worker/`: the Web Worker and a promise-based client. Jobs run inline where workers aren't
  available.
- `src/ui/`: React pages and components.

## Deploying

Vercel builds the site from the `master` branch on every push (`npm run build`, output folder
`dist`).

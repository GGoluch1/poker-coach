# Poker Coach

Play no-limit hold'em against bots in the browser, drill the fundamentals, and study river spots
with a small game-theory solver. There's no backend: everything runs in the browser, and the heavy
math runs in a Web Worker.

## Features

- **Play**: 2 to 6 players, 1/2 blinds, side pots, and bots with personalities: balanced, nit,
  maniac and calling station. Each bot shows its VPIP/PFR, and reads of its range adjust to its
  style. A live coach shows equity, pot odds, call EV, outs, chart advice and an exploit tip for
  each opponent. Every decision is reviewed after the hand, with a rough EV for each option in big
  blinds.
- **Hands**: paste PokerStars or GGPoker hand histories to replay them step by step and review
  them like hands played here.
- **Drills**:
  - **Outs**: count your outs and compare the rule of 2 and 4 with the exact odds.
  - **Call or fold**: real generated spots facing a bet, with a timer.
  - **Preflop charts**: open, defend against an open, or face a 3-bet.
  - **Board texture**: suits, connectedness and wetness.
  - **Defense and bluff math**: minimum defense frequency, bluff break-even and pot odds.
  - **Combos and blockers**: count combos left after the cards you can see.
  - **Set mining**: implied odds and stack-to-pot ratio with small pairs.
- **Spaced repetition**: missed drills and mistakes from your own hands come back on a Leitner
  schedule, a few minutes at first and then days apart.
- **Progress**: VPIP, PFR, 3-bet, fold to c-bet and showdown stats against target ranges; a leak
  tracker that groups your mistakes by type and estimates the big blinds each leak cost; and drill
  accuracy.
- **River solver**: CFR+ on a river spot with two ranges and chosen bet sizes. It shows each
  player's strategy by hand and how exploitable the result is. The game is deliberately small:
  check or bet, then call or fold, with no raises.

Postflop advice in the coach and reviews is labeled **heuristic**: it compares equity against
ranges guessed from preflop action with the pot odds, and is not a solver result. EVs are rough
too. Checks and calls assume no more betting, and bets and raises assume the opponent defends at
the minimum defense frequency, adjusted for their personality. Preflop advice comes from
approximate 6-max charts.

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
  - `range`, `charts`, `equity`, `ev`: ranges, preflop charts for every situation, Monte Carlo
    equity, outs, and option EVs
  - `texture`, `describe`, `generate`: board texture, plain-English situation summaries, and a random
    spot generator that plays real hands up to a decision
  - `analysis`, `bot`, `profiles`, `review`, `history`: spot analysis, bot strategy and
    personalities, decision grading, and hand history text
  - `handHistory`: PokerStars and GGPoker import, replayed through the engine
  - `drills`, `srs`, `stats`: drill generation and grading, spaced repetition, and player stats
  - `solver`: the CFR+ river solver
- `src/worker/`: the Web Worker and a promise-based client. Jobs run inline where workers aren't
  available.
- `src/ui/`: React pages and components.

## Deploying

Vercel builds the site from the `master` branch on every push (`npm run build`, output folder
`dist`).

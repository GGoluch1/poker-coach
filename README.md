# Poker Coach

Play no-limit hold'em against bots in the browser, with a coach that explains the math as you play
and reviews every decision after the hand.

## Features

- **Table**: 2 to 6 players, 1/2 blinds, 100 big blind stacks, side pots, and bots that act on
  their own.
- **Live coach**: equity against opponents' likely ranges, pot odds, outs with hit chances, and
  preflop chart advice. It can be turned off if you want to play without hints.
- **Preflop charts**: 6-max opening ranges for every position, with your current hand highlighted.
- **Hand history and review**: the last 30 hands with a full log. Each of your decisions is graded
  from Good to Blunder, with the reason.

The game saves to your browser, so a reload picks up where you left off.

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
  - `card`, `deck`, `hand`: cards, shuffling, and the 5 to 7 card hand evaluator
  - `pot`, `game`: side pots and the betting state machine (blinds, min-raises, all-ins, showdown)
  - `range`, `equity`: preflop ranges and charts, Monte Carlo equity, outs
  - `analysis`, `bot`, `review`, `history`: spot analysis, bot strategy, decision grading, and
    hand history text
- `src/ui/`: React components and the `useGame` hook that runs the table.

## Deploying

Vercel builds the site from the `master` branch on every push (`npm run build`, output folder
`dist`).

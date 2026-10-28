# Poker Coach

Play no-limit hold'em against bots in the browser, drill the fundamentals, and study river spots
with a small game-theory solver. There's no backend: everything runs in the browser, and the heavy
math runs in a Web Worker.

## Features

- **Home**: a dashboard with your stats, reviews due, your biggest leak, and links to every drill
  and tool.
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
  tracker that groups your mistakes by type and estimates the big blinds each leak cost; drill
  accuracy; a daily streak with charts of practice per day and results over time; and a backup
  you can export and import.
- **Preflop charts**: every opening, defending and 3-bet chart the coach uses, with notes on how
  to read them.
- **River solver**: CFR+ on a river spot with two ranges and chosen bet sizes. It shows each
  player's strategy by hand and how exploitable the result is. The game is deliberately small:
  check or bet, then call or fold, with no raises.

Postflop advice in the coach and reviews is labeled **heuristic**: it compares equity against
ranges guessed from preflop action with the pot odds, and is not a solver result. EVs are rough
too. Checks and calls assume no more betting, and bets and raises assume the opponent defends at
the minimum defense frequency, adjusted for their personality. Preflop advice comes from
approximate 6-max charts.

Progress, the current game and the light or dark theme are saved in your browser. Every page has
its own URL (for example `/drills/outs`), so the back button, bookmarks and links work. The first
visit to Play starts a short tour of the table. After one visit the app also works offline and can
be installed as an app.

## Development

```
npm install
npm run dev      # local dev server
npm test         # unit tests (Vitest)
npm run test:e2e # browser tests (Playwright) against the production build, desktop and phone
npm run build    # type-check and production build
npm run lint
```

The browser tests need Playwright's Chromium once: `npx playwright install chromium`.

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
  - `activity`: practice per day and streaks
- `src/worker/`: the Web Worker and a promise-based client. Jobs run inline where workers aren't
  available.
- `src/ui/`: React pages and components.
  - `routes`, `siteMap`: URL routes and the drills and study tools shown in menus and on the home
    page
  - `SiteHeader`, `SiteFooter`, `PageHeader`, `theme`: the site shell, dropdown and mobile menus,
    breadcrumbs, and the theme switch
  - `Tour`, `tourSteps`, `backup`, `ActivityCharts`: the Play tour, progress backups, and the
    progress charts
- `src/styles/`: the stylesheets by area, imported in order from `App.css`.
- `src/serviceWorker.ts`, `public/sw.js`, `public/manifest.webmanifest`: offline support and app
  install.
- `e2e/`: Playwright browser tests.

## Deploying

Vercel builds the site from the `master` branch on every push (`npm run build`, output folder
`dist`). `vercel.json` serves `index.html` for every path, so links like `/drills/outs` load
directly.

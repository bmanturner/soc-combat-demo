# Sons of Cain — Combat Demo

A browser sandbox for the Sons of Cain AP-timeline combat. It's built for Aaron to play, break and tune the combat rules before any engine work.

- **Four encounters:**
  - The Granary (tutorial)
  - Road Wolves
  - The Ruined Shrine (cultists)
  - The Trapped Nephilim (boss)
- **Every open rule is a setting.** Open them with *Rules* in the top bar. Each one is badged as one of:
  - *Aaron's rule*
  - *Tentative math*
  - *Demo default*
- **Settings travel in the URL.** Change rules, copy the link and send it back, and the other person gets the same encounter, loadout, seed and rules.
- **Hover-to-preview.** Hovering a move or attack shows where your next turn lands on the timeline, and warns when a telegraphed hit lands before you act.
- **Copy report** on the result screen produces a markdown summary with a replay link for feedback.

## Run

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # static site in dist/ (any static host works)
```

## Checks

```bash
npm run check        # typecheck + lint + unit tests (rules, golden doc examples, sim invariants)
npm run test:e2e     # Playwright: builds, serves on :4173, plays through the UI
npm run sim -- 40 nephilim bossBreakFreeAt=1300   # balance sim; any setting=value overrides
npx tsx tools/trace.ts nephilim daggers light 1000  # one fight, event by event
```

## Layout

| Path | What it is |
|---|---|
| `src/rules/` | Pure, deterministic rules core. No UI imports, no `Math.random`, no DOM (ESLint enforces it). `applyAction(state, action) → {state, events}`. |
| `src/content/` | Gear, units, encounters (data). |
| `src/game/` | App state (Zustand vanilla store), controller (turn loop, AI pacing), share links, preview helpers. |
| `src/board/` | Phaser 4 scene: board, tokens, overlays, animations driven by rule events. |
| `src/hud/` | React 19 HUD: timeline, action panel, incoming threats, log, settings, menus. |
| `tools/` | Balance sim, fight tracer, screenshot scripts. |
| `e2e/` | Playwright specs. |

## Why this stack

| Choice | Why |
|---|---|
| **Phaser 4** (board) | A full 2D game framework (tweens, input, cameras, scaling, WebGL) that is actively maintained, with v4 now stable. PixiJS is only a renderer, so you'd rebuild those pieces yourself. Godot's web export is heavy and slow to load for a link you send someone. boardgame.io is lightly maintained and solves multiplayer, which isn't needed here. |
| **React 19 + Zustand** (HUD) | The HUD is dense, form-like UI (timeline, settings with 40+ controls, tables), which the DOM handles better than a canvas. A vanilla Zustand store is shared by Phaser and React without either owning it. |
| **Pure TypeScript rules core** | Deterministic (seeded mulberry32), serializable, and testable without a browser. A future engine port can use the golden tests as an executable spec. |
| **Vite 8, Vitest 5, fast-check, Playwright** | Fast dev/build, unit and property tests on the rules, real-browser e2e. TypeScript 6 (not 7) because typescript-eslint doesn't support 7 yet. |

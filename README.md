# Sons of Cain — Combat Demo

A browser sandbox for Aaron to play and tune AP-timeline tactics before a full engine implementation. AP spent delays the next turn; it is not a combat-action budget. Movement has its own budget.

## What is playable

- **Four encounters:** The Granary (tutorial), Road Wolves, The Ruined Shrine (cultists), and The Trapped Nephilim (boss).
- **Nine weapon families:** daggers, sword & shield, polearm, two-handed, bow, crossbow, dual wield, javelin & shield, colossal. Modes include javelin thrust/throw and colossal line/sweep; dual wield resolves a primary then a random eligible secondary.
- **Two carried slots**, paid swapping, per-instance reload/cooldown state, and basic + proficiency skills. The proficiency and special-family unlock switches are sandbox conveniences, not a skill tree. Granary keeps four starter melee families and clothing; later encounters admit the wider catalog subject to unlocks.
- **Crossbow reload policies:** flexible permits other actions before paying the reload; strict enforces the next combat action as reload. Firing and reloading remain separate paid actions.
- **Shared previews:** movement/path engagement risks, attack/skill damage and reactions, reload/swap costs, next-turn ghosts and delayed-effect escape outlook use the same rules as execution. They are current-board estimates, not promises about future AI moves or random outcomes. Delayed skills default to no reactions but can explicitly author exceptions.
- **Rules tuning:** grouped controls cover timeline, movement, engagement, flanking, reactions, damage, boss behavior, Weapons, **Weapon tuning** and **Enemy tuning**. Badges distinguish *Aaron's rule*, *Tentative math* and *Demo default*, with rationale. Weapon/skill/unit/armor data separates sourced concepts from tentative/demo numbers. Not every design question is an exposed control; changing fight rules restarts the fight.
- **Feedback:** result reports include telemetry, config changes and a setup link. Share links reproduce **encounter, two-slot loadout, seed and rules — not an action replay**. The same seed only reproduces a fight when the action sequence also matches. Human play and expert/novice bot policies are distinct balance samples.

## Run and verify

```bash
npm install
npm run dev                       # http://localhost:5173
npm run build                     # static site in dist/
npm run check                     # typecheck + lint + unit/property tests
npm run test:e2e                   # Playwright builds and serves on :4173
E2E_PORT=4187 npx playwright test  # use another port for parallel worktrees
```

## Simulations and diagnostics

```bash
# Syntax: <trials> <enc|all> policy=expert|novice combos=1 weapons=... setting=value
npx tsx tools/sim.ts 40 all policy=expert
npx tsx tools/sim.ts 40 all policy=novice
npx tsx tools/sim.ts 40 nephilim policy=expert combos=1 weapons=crossbow,shield bossBreakFreeAt=1300
npx tsx tools/trace.ts nephilim daggers light 1000
npx tsx tools/balance-math.ts
npx tsx tools/check-balance-source.ts
```

Encounter IDs are `granary`, `wolves`, `cultists`, `nephilim`. `trials` is seeds per legal loadout/armor cell; `weapons` is a comma-separated ID filter (`hunting_bow`, `two_handed`, `dual_wield`, `javelin_shield` use these IDs). `combos=1` adds supported two-slot pairs, not every permutation. Sim output includes `ROW` JSON, win/HP, stalls and illegal fallbacks; diagnostic failures set a nonzero exit code. The trace prints a real seeded fight. Balance math reports analytic budgets; the source checker compares protected values/status against retained revision `83cd5df` (include it in a shallow checkout). None alone proves balance or turns demo numbers into canon.

## Layout and phase evidence

| Path | Purpose |
|---|---|
| `src/rules/` | Pure deterministic TypeScript core: `applyAction(state, action) → {state, events}`. No UI, DOM or `Math.random`; golden and fast-check tests. |
| `src/content/` | Typed gear, skills, unit templates, provenance and encounter data. |
| `src/game/` | Shared Zustand store, controller/AI pacing, share links and preview helpers. |
| `src/board/` | Phaser scene, overlays and event-driven animations. |
| `src/hud/` | React timeline, actions, threats, log, settings and screens. |
| `tools/`, `e2e/` | Sim/trace/balance/report/screenshot utilities and Playwright specs. |
| `notes/rules/` | Earlier shared-rules corrections and their regression evidence. |
| `notes/ai/` | AI targeting, guardian/caster routing, boss and bot-policy changes. |
| `notes/weapons-core/` | Nine-family equipment, modes, ownership and rules contracts. |
| `notes/ui-weapons/` | Weapon setup/HUD/share integration and browser checks. |
| `notes/balance/` | Balance method, measured tuning decisions, raw artifacts and UI integration handoff. `second/` records the follow-up balance pass and acceptance evidence. |
| `notes/final-rules/` | Final correctness fixes, regression gate and before/after sim comparison. |

Phase notes record the revision/experiment they tested, not an evergreen guarantee for every later build.

## Why this stack

| Choice | Why |
|---|---|
| **Phaser 4** (board) | A full 2D framework supplies tweens, input, cameras, scaling and WebGL. PixiJS alone would require rebuilding those pieces; Godot's web export is heavier for a quick shared link; boardgame.io solves multiplayer we do not need. |
| **React 19 + Zustand** (HUD) | Dense forms, settings, timelines and tables suit the DOM. A vanilla Zustand store is shared by Phaser and React without either owning it. |
| **Pure TypeScript rules core** | Seeded mulberry32, serializable state and browser-free tests. A future engine port can use the golden tests as an executable spec. |
| **Vite 8, Vitest 5, fast-check, Playwright** | Fast dev/build, unit/property tests and real-browser e2e. TypeScript 6 is the project's supported compiler/tooling baseline. |

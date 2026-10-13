# W2 — weapons UI delivery

## Delivered

1. Setup uses the encounter catalog: Granary remains four single-slot starters; other encounters expose nine families, primary/optional reserve, and starting equipped slot. Special locks use the engine's Juggernaut/Hoplite/Dual-Wielder source combinations. Each mode has a pattern diagram and content/config-derived AP, damage, accuracy and range. Both item skills show basic/proficiency tags, AP/damage multiplier, and concept/numbers provenance. Unproficient rows explain Soldier/Savage/Rogue proficiency.
2. ActionPanel shows carried slots and crossbow ammo, item-owned skill rows, mode controls, engine-gated Reload/Swap with AP and reasons, and swap commitment text. M/A/1–9/Space/Esc retained; R/W/T added. T is used rather than trapping Tab, preserving keyboard focus navigation. Sweep button commits a self-centered sweep; T plus self-click is also supported. Hovering mode controls only updates pure UI targeting intent, never combat state or RNG.
3. Board queries now honor selected mode. Dual previews fill only guaranteed target tiles, show dashed conditional candidates and selection percentages, and explain one random secondary. Reload/swap have floating labels; dual's second strike is called out in the existing strike animation. Crossbow previews show the full fire/reload cycle in the HUD.
4. Shared pending previews handle reload/swap without requiring a hovered tile; timeline and Incoming show the same projected next turn. Mode previews use shared AP helpers. Committed end-turn projections continue to use engine-spent AP.
5. Links preserve `w=` and add `w2=`/`slot=`. Decode validates encounter, special locks and nonempty equipped slots. Battle links/report use canonical starting loadout, not in-battle equipped weapon. Reports include both weapons and each party member's reload/swap counts.
6. New unit and browser coverage listed below.
7. Built and ran an independent preview server on 127.0.0.1:4185, drove all nine families through real Wolves encounter actions without state mutation, then ran the controlled UI parity suite against that server. Zero pageerrors. The server was killed and the port checked closed.

## Verification

Final full verification:

- `npx tsc --noEmit -p tsconfig.json`: passed.
- `npx eslint .`: passed.
- `npx vitest run`: **16 files / 193 tests passed**.
- `E2E_PORT=4185 WEAPON_SCREENSHOTS=/home/needz/.hermes/cache/scratch/soc-ui-weapons npx playwright test`: **25 passed**. Includes production build.
- `npm run build`: passed independently before live playtest.
- `git diff --check`: passed.
- No edits under `src/rules/**` or `src/content/**`.

New tests:

- `src/game/share-weapons.test.ts`: two-slot/starting-slot round trip, legacy migration, invalid tutorial reserve and empty starting slot. These three tests were observed failing before implementation.
- `src/game/weapon-ui.test.ts`: reload/swap pure ghost parity; javelin throw AP parity and immutable RNG/state.
- `src/game/weapons-report.test.ts`: real swap preserves original loadout in report/share; names and counts present.
- `e2e/weapons.spec.ts`: nine per-family distinctive-action/AP/immutable-preview cases, multi-target shape assertions, crossbow fire→reload, swaps for all families, strict debt reason/overlay shortcut suppression, two-slot starting-slot share round trip, and Granary/special locks. Added after the initial UI implementation; not claimed as test-first.

The controlled browser fixtures keep a legal Wolves setup, then arrange enemies and disable reactions to isolate UI geometry/AP rather than retest balance. Expected AP is read from queries, never pinned to balance values. Tests wait for animation transactions to commit before comparing snapshots. A separate live playtest uses unmodified encounter state and real UI movement/waits/attacks.

## Browser artifacts and reproduction

Directory: `/home/needz/.hermes/cache/scratch/soc-ui-weapons/`.

**36 PNG files**, verified programmatically: each of `daggers`, `shield`, `polearm`, `two_handed`, `hunting_bow`, `crossbow`, `dual_wield`, `javelin_shield`, `colossal` has:

- `<id>-setup.png`
- `<id>-action-panel.png`
- `<id>-preview.png`
- `<id>-live-encounter.png`

`live-playtest.json` records nine successful live encounter attacks with zero pageerrors. Live action counts were respectively 6, 6, 6, 6, 2, 2, 6, 5, 6. These are smoke-playtest action counts, not balance statistics.

Reproduce after building:

```
npx vite preview --port 4185 --strictPort --host 127.0.0.1
npx tsx notes/ui-weapons/live-playtest.ts
WEAPON_SCREENSHOTS=/home/needz/.hermes/cache/scratch/soc-ui-weapons npx playwright test --config notes/ui-weapons/playtest.config.ts
```

Vision review inspected dual candidate preview before and after fixes, setup diagrams, crossbow action panel and live javelin throw. Fixed overlapping probability sentences, clarified primary/random legend, enlarged range diagrams (including the complete bow range), themed the starting-slot select, clarified movement versus action AP and labeled the selected-attack cost. Final setup/action-panel/preview images come from the last full suite; live encounter images were captured before the final text-only readability refinements.

## Core issues

No missing query exports or rules-core bugs identified. No core/content changes or balance-number changes were needed.

# Final rules correctness round

Baseline: `286b0d09d900abd3026afbfbd7bf2945829b1d60`. Branch: `fix/final-rules`. No HUD/board/game/e2e files changed.

## Disposition

- **F-01, D-03, U-04, FP-04, FP-08 — rules complete.** Each reachable path node replaces the mover in a coherent hypothetical board before checking engagement. Initially flanked enemies are not permanently excluded. Local-contact filtering avoids unnecessary flank work; path-local rolled opponents remain intact. Existing escapeOutlook and AI path safety consume the corrected risks without changing engine engagement rules.
- **F-02, D-11, FP-07 — complete.** Delayed skills honor authored dodge/parry/block lists, defaulting only absent lists to none. Casts copy the list and origin into the effect. Immediate and delayed hits share reaction ordering, flank/daze/immobile gates, AP pushback and dodge displacement. Delayed effects retain guaranteed area contact, no critical roll and existing damage semantics. Reactions occur at impact against the then-current board; previews show current-board avoidance and policy. Successful avoidance does not apply damage or daze and is not counted as caught; geometric escape telemetry remains separate. Effect result entries carry optional reactions/avoided/displacedTo, and dodge emits the existing displace event.
- **F-04 / D-08 — rules/data complete, UI integration required.** UnitTemplate and ArmorDef use the existing `Provenance` (`concept`, `numbers`, `why`) and `FieldProvenance` types. `UNITS[id].provenance` and `ARMOR[id].provenance` are ready for the same badge component as weapons. `fieldProvenance` is a flat field-to-metadata record (like skills). Granary rats and companion concepts remain source; exact enemy labels/stats are demo. Jubal HP/damage curves are tentative; companion HP curves are demo. Armor 100/200/300 bands are source; exact MR/dodge/engage/disengage values are demo. No stat values changed.
- **X-09 — rules formatting complete.** `formatAp` / `formatNumber` in describe.ts round to at most one decimal, trim zeroes and normalize negative zero. All numeric log AP/damage/HP fields, delayed preview delay and bow surcharge text use them. UI-only optional collapsed math detail is not implemented here.
- **F-03 — complete.** README now covers encounters, nine families/modes, reload policies, two slots, skills/gating, preview limitations, scoped settings/provenance, setup-only share reproduction, sim/trace/math/source-check commands and phase notes, retaining the stack rationale.

## Regression evidence

The copied focused probes plus generated suite first failed **7 tests**: two focused bugs and five F-01 generated cases. After repairs, all pass. `properties.test.ts` retains all **19 fast-check properties** plus the setting-boundary roundtrip (20 tests), fixed seeds and original assertions. `review-regressions.test.ts` retains the two minimal repros. `final-contract.test.ts` adds 13 tests covering path-node/ally-transit parity, escape/AI risk, explicit delayed block/dodge/parry and none, cast-time policy persistence, reaction AP/displacement/status, disabled/dazed/immobile/blocked-dodge cases, provenance and formatting.

Verification:

- `npx tsc --noEmit -p tsconfig.json` — pass.
- `npx eslint .` — pass.
- `npx vitest run` — **238/238**, 20 files, pass.
- `npx tsx tools/check-balance-source.ts` — **72/72** protected source value/status comparisons pass.
- `E2E_PORT=4187 npx playwright test` — **25/25** pass (includes build).
- `git diff --check` — pass.

The existing full-battle random-seed invariant test exceeded its old 5-second wall-clock budget, also documented by the final review before this branch. Its timeout is now 30 seconds, with all 40 sampled battles and assertions preserved. A new daze fixture initially ended the victim's own turn, correctly clearing daze before impact; it was corrected to keep that victim off-turn. No assertion was weakened to hide a mechanics failure.

## Before/after simulation

Exact commands run on baseline and repaired code:

```sh
npx tsx tools/sim.ts 40 all policy=expert
npx tsx tools/sim.ts 40 all policy=novice
```

Each policy covers **85 unique encounter/loadout/armor cells × 40 seeds = 3,400 fights**, seeds 1000–1039. Both repaired sweeps report **0 stalls / 0 illegal fallbacks**. Comparisons parse full-precision ROW JSON, match cell keys, and weight each cell by trials. Raw command outputs are scratch evidence (`rules-before-{expert,novice}.txt` and `rules-after-{expert,novice}.txt`), not permanent release inputs.

| Policy | Encounter | Win before → after (%) | HP before → after (%) | Δ win / Δ HP (pp) |
|---|---|---|---|---|
| expert | Granary | 100 → 100 | 80.4167 → 80.4167 | 0 / 0 |
| expert | Wolves | 99.9074 → 99.9074 | 72.1182 → 72.0892 | 0 / −0.0291 |
| expert | Cultists | 94.5370 → 94.4444 | 49.5645 → 49.5931 | −0.0926 / +0.0287 |
| expert | Nephilim | 95.4630 → 95.4630 | 78.5229 → 78.5229 | 0 / 0 |
| novice | Granary | 100 → 100 | 80.2292 → 80.2292 | 0 / 0 |
| novice | Wolves | 100 → 100 | 71.9235 → 71.9088 | 0 / −0.0147 |
| novice | Cultists | 93.6111 → 93.6111 | 47.6799 → 47.7051 | 0 / +0.0252 |
| novice | Nephilim | 50.2778 → 50.2778 | 18.9000 → 18.9000 | 0 / 0 |

**No encounter, and no individual loadout/armor cell, moved by more than 3 percentage points in win or HP.** Current shipped delayed policies are all none, so the gameplay delta in this comparison is the corrected movement/path selection rather than newly enabled delayed defenses. These 40-seed correctness sweeps are not a fresh comprehensive balance sign-off.

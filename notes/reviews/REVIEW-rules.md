# Rules-engine correctness review

Baseline: `52886f3`, branch `review/rules`. Scope: pure TypeScript rules and their query/AI consumers; no production changes and no canon/design audit.

## Results and reproduction

**9 verified findings: 2 P0, 6 P1, 1 P2.** Eleven deliberately failing regression probes demonstrate them. These are ordinary `it` tests, not `it.fails`: the suite is intentionally red until the defects are fixed. Every failure was inspected to verify an assertion mismatch, rather than a fixture/setup exception.

- `npx vitest run --silent=false` → **11 failed, 51 passed, 62 total**; 1 failed test file, 5 passed. All failures are in `review-rules.test.ts`; existing tests and the stress probe pass. Full execution output, including stress measurements, is committed in `review-suite-output.txt`.
- `npx tsc --noEmit -p tsconfig.json` → exit 0.
- `npx eslint .` → exit 0.
- Focus one finding: `npx vitest run src/rules/review-rules.test.ts -t R-02` (replace ID as needed).
- Stress only: `npx vitest run src/rules/review-rules-stress.test.ts --silent=false`.

## Findings

### R-01 — P0 — A supported zero minimum delay starves the timeline

**Verified: true.** Evidence: `src/rules/config.ts:130`, `src/rules/engine.ts:182-190,248-254`.

The registry accepts `minTurnDelay=0`. Ending a zero-spend turn reschedules the same unit at exactly the same tick; stable order selects it again. Waiting can therefore indefinitely prevent enemies, delayed effects, and the boss break-free deadline from advancing. The local `advance()` convergence guard does not help because each call successfully returns an active unit.

Repro: **`R-01: minimum delay zero must not starve every other unit/effect`**. Twenty end-turn actions leave clock 0. The randomized full-sim probe independently reproduced this in `random:3` / Nephilim: 500 actions, clock 195, repeated zero-delay archer turns, no RulesError fallback; full config and recent events are in the output artifact.

Recommended fix: require a strictly positive wait delay in the setting registry and engine, or explicitly implement a zero-cost yield that advances past the current tick without starving scheduled work. Add an early repeated-state/no-progress detector to the simulator rather than only exhausting `maxActions`.

### R-02 — P0 — Interrupted ally traversal leaves two live units on one tile

**Verified: true.** Evidence: `src/rules/queries.ts:68-69,90-94`, `src/rules/engine.ts:321-335`.

Movement permits intermediate allied occupancy. If a later step is held and also occupied by an ally, `doMove` locks movement and breaks without restoring the last unoccupied tile. The mover remains on the preceding allied tile. This violates occupancy invariants and makes `occupant()` hide one of the overlapping units from targeting/flanking.

Repro: **`R-02: being held while crossing allies must not leave overlapping units`**. Jubal (0,1), allies (1,1)/(2,1), wolf (0,0); move to (3,1), keep chance 1 and opportunity chance 0. Jubal enters (1,1), is held when leaving the wolf's contact toward (2,1), and stops overlapping the first ally. Four live units occupy only three unique positions.

Recommended fix: track the last legal stopping position and roll back an interrupted transit to it, with consistent spent AP/events; alternatively disallow entering an allied transit chain unless interruption can end on a legal free tile. Also cover displacement/death during transit.

### R-03 — P1 — Raw-damage skill previews omit runtime damage overrides/scaling

**Verified: true.** Evidence: `src/rules/queries.ts:220-228` versus `src/rules/engine.ts:408-411,512-514`.

`previewSkill` uses the static skill's `rawDamage` and never applies its side's damage multiplier. The engine replaces Rock Throw's static 110 with configured `rockThrowDamage` (170 by default), and scales raw skill damage by player/enemy multipliers.

Repros: **`R-03: rock throw preview damage must match the configured landed damage`** reports 55 versus actual 85 damage to light armor at defaults. **`R-03: raw-damage spell preview must apply the side damage multiplier`** reports 32 versus actual 95 for Daze Bolt at player damage ×3. Reactions and criticals are disabled, and both shots land.

Recommended fix: share resolved skill strike parameters between execution and preview, including special raw-damage overrides, side multiplier, hit chance, penetration and damage type. Do not apply the multiplier twice to weapon damage already scaled at construction.

### R-04 — P1 — Boss AP previews disagree with execution and minimum rhythm

**Verified: true.** Evidence: `src/rules/queries.ts:200-202,211,278-282` versus `src/rules/engine.ts:253-254,502`.

`skillCost` always uses static `skill.apCost`; boss specials actually cost `config.bossTurnAp`. `projectedNextTurn` always applies `minTurnDelay`, whereas a massive unit's minimum delay is `bossTurnAp`.

Repros: **`R-04: boss skill AP and next-turn preview must respect bossTurnAp`** previews Rock Throw at 100 AP but execution charges 200 with `bossTurnAp=200`. **`R-04: waiting boss projected next turn must use its minimum rhythm`** predicts 25 AP versus actual 100 at defaults.

Recommended fix: centralize action AP and minimum-turn-delay calculation and call it from engine, AI and public queries. Keep `projectedNextTurn`'s relative-delay contract explicit.

### R-05 — P1 — Hypothetical attack previews compute flanking using the old position

**Verified: true.** Evidence: `src/rules/queries.ts:121,165-171,205-209,222`; AI consumers `src/rules/ai.ts:103-114,350-367`.

The `from` argument moves only a local attacker copy for targeting; `expectedStrike` still uses the original state's occupancy. Moving into a flank is not recognized; moving out of one can retain a nonexistent flank. Damage, avoidance, kill indicators and AI attack scores can all be wrong.

Repro: **`R-05: preview from a proposed tile must recompute flanking there`**. Jubal previews an attack from (2,3) against wolf (3,3), with Jabal at (4,3). Preview says unflanked / 33 damage; after actually moving to that tile, the same preview says flanked / 42 damage.

Recommended fix: construct an immutable hypothetical state with the attacker repositioned and use it for both targeting and all position-sensitive strike calculations. Apply the same approach to skill previews and path planning.

### R-06 — P2 — Immune units inflate delayed-effect escape telemetry

**Verified: true.** Evidence: `src/rules/engine.ts:572,595-609`.

`threatenedAtCast` includes the caster and immune allies. Resolution skips those units, then counts any living threatened unit not hit as an escape, even if it never left the area. This biases balance-simulation escape counts.

Repro: **`R-06: immune source standing in its own effect must not count as an escape`**. A caster stands motionless in its own delayed area; after resolution its escape counter increases from 0 to 1.

Recommended fix: use the same victim-eligibility predicate at cast and resolution; count an escape only for an eligible threatened unit that is alive and no longer covered when the effect resolves.

### R-07 — P1 — Timeline query ignores scheduler tie-breaks

**Verified: true.** Evidence: `src/rules/queries.ts:263-274` versus `src/rules/engine.ts:183-190`.

The display query sorts only by relative time; ties preserve unit-array order and put effects after units. It ignores `tiePlayerFirst`, `tieUnitBeforeEffect`, and active-unit precedence. The displayed first entry can be different from the actual active unit.

Repro: **`R-07: timeline display ties must match the scheduler settings`**. Jubal and wolf are due at tick 50 with `tiePlayerFirst=false`; engine selects wolf, but the first timeline entry is Jubal.

Recommended fix: share the scheduler's tie comparator with the query (kind priority, side priority, stable order), and explicitly present the currently active unit before other same-tick entries.

### R-08 — P1 — Hypothetical bow previews omit movement surcharge

**Verified: true.** Evidence: `src/rules/queries.ts:159-173,200-211`; planning consumption `src/rules/ai.ts:350-362`; execution `src/rules/engine.ts:464-472`.

A preview from a different position still uses the *current* active turn's `moved` flag. Consequently a move-then-shoot plan is priced as stationary. The AI uses that underpriced attack AP when evaluating tempo and delayed-effect danger.

Repro: **`R-08: bow attack preview from a proposed move must include the movement surcharge`**. From (0,0), preview a bow shot from (0,1) at wolf (4,0): preview 75 AP, actual after moving 125 AP.

Recommended fix: include hypothetical movement in preview context and cost resolution; ensure planned retreat after a stationary shot also includes the pending surcharge. Do not blindly add surcharge inside `projectedNextTurn(extra)`: its caller may already supply it (`src/game/preview.ts:45` does so correctly).

### R-09 — P1 — Delayed-skill preview timing ignores configured delays

**Verified: true.** Evidence: `src/rules/queries.ts:212-217` versus `src/rules/engine.ts:548-557`; definitions `src/content/gear.ts:95-97`.

The preview note interpolates static `skill.delay`. Sweep has no static delay, producing `Erupts in undefined AP`; Rockfall has a static 100 that becomes stale when its config delay changes. These are precisely the timing-sensitive boss telegraphs being tuned.

Repro: **`R-09: sweep preview must show its configured impact delay`**. With sweep delay 150, execution schedules impact at +150; preview reads `Erupts in undefined AP`.

Recommended fix: share resolved effect specs between execution and previews, selecting `sweepDelay`/`rockfallDelay` as appropriate. Derive the impact note from that spec, not optional static metadata.

## Broader checks and boundaries of confidence

- **126 instrumented simulations**: 12 default runs (all four encounters × seeds 1/7/99), 94 individual setting-boundary runs (47 settings × two values), and 20 deterministic randomly generated in-range configs. Every numeric setting was exercised separately at both endpoints; booleans/selects at both choices. Boss-group boundaries ran Nephilim, other boundaries Granary. Random configs rotated through all four encounters. All runs use daggers/light and a 500-action cap; this is not an exhaustive config × loadout matrix.
- **125 simulations finished; 1 stalled**, the confirmed zero-delay starvation case in R-01. No non-RulesError exception, nonfinite HP/next-turn/AP, negative HP/AP was observed in this sample.
- Instrumented `applyAction` during real `runBattle` calls to count caught RulesErrors. **Fallback counts were zero in all 126 runs**, including all three default seeds for each of Granary, Wolves, Cultists and Nephilim. Thus the fallback branch was not masking a bug in this sample. `sim.ts:56` discards its local `stuck` count; exposing that metric would improve audits, but no speculative AI failure is claimed.
- 100 fast-check seeds: `applyAction` on deeply frozen input was deterministic and input-preserving, including equality after JSON round-trip.
- Frozen query/AI checks found no state or RNG mutation in the exercised APIs.
- 30 generated seed/movement-cost cases: every returned unobstructed destination's reach cost matched execution.
- 4,000 fixed seeds: empirical landed-hit frequency agreed with `landChance` within the test's 0.035 tolerance.
- A delayed area covering only a non-anchor boss footprint tile damaged it exactly once.
- Sanitizer rejected tested invalid types, nonfinite values, unknown keys, and JSON prototype-pollution keys. Out-of-range numbers are **clamped**, not rejected: that is documented in the implementation and not reported as a defect. Zero delay remains an accepted but unsafe registry value (R-01).
- Existing formula, pattern, engine and sim tests all passed. This review does not claim exhaustive validation of every displacement/reaction interaction, every map-edge pattern, or the complete Cartesian product of settings.

## Artifacts

- `src/rules/review-rules.test.ts`: eleven intentionally failing regression tests and six passing control/property tests.
- `src/rules/review-rules-stress.test.ts`: bounded config/encounter sampling and actual simulator fallback instrumentation.
- `review-suite-output.txt`: full final suite output and machine-readable `REVIEW_STRESS` measurements.
- `REVIEW-rules.md`: this report.

No production code, dependencies, main worktree, other worktrees, or design sources were modified.

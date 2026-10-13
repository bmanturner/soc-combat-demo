# Rules core and preview parity — completed Track A

Branch: `fix/rules`, based on `b6a1869`.

Implementation commits:
- `a01eb19` — rules, shared resolvers, engine/query regression tests.
- `863a23f` — AI/HUD/board integrations and integration/golden tests.

## Behavior changes

- Nonempty turns cost AP actually spent (movement + action + reactions); empty Wait uses `minTurnDelay`, with a 5 AP registry minimum and runtime progress guard. Massive units retain their boss rhythm.
- `autoEndTurn` is a demo setting, default true, with explicit provenance/rationale. After an action, exhausted or locked movement ends the turn through the ordinary turnEnd path. Victory also settles the final turn's AP exactly once.
- Delayed damage shares defense, flanking and zero-raw handling with strikes. Ally-enabled effects include their caster; eligibility is shared by resolution, cast telemetry, escape credit, previews, AI and Incoming.
- Escape outlook checks scheduling ties and full next-turn geometric reachability. Walking is instantaneous during the turn, not subtracted from time-to-impact. It reports disengagement risk separately. Predictions use the current board, not intervening AI movement or RNG.
- Skill parameters, configured damage/delays, side scaling, action costs, bow hypothetical movement (including later retreat), reaction eligibility, and scheduler ordering are shared. Hypothetical previews replace the unit on the board so flanking changes with position.
- Interrupted allied-tile traversal settles on the last free position, retaining AP actually traversed and an animation path to the final position.
- Incoming, action buttons, timeline ghost and board move labels consume shared queries. No duplicate AI timing/damage formula remains in the four requested integration points. `plannedActionAp` remains an exported compatibility wrapper over `actionApCost`.
- AI repeated danger evaluation is memoized only within one decision, preserving immutable/frozen-state query behavior.

## Exported helpers

New in `src/rules/resolvers.ts`: `schedulerCompare`, `unitSchedule`, `unitActsBefore`, `unitMinDelay`, `turnDelay`, `actionApCost`, `hypotheticalBoard`, `effectCanHit`, `resolvedDamage`, `delayedDamage`, `allowedReactions`, `resolveSkill`.

New query: `escapeOutlook` (`EscapeOutlook` exposes eligible, inside, actsBefore, reachableSafe, disengageRisk, canEscape).

Existing public queries now delegate to shared rules: `basicAttackApCost`, `skillCost`, `expectedStrike`, `previewAttack`, `previewSkill`, `projectedNextTurn`, `timelineEntries`, `dangerAt`, `bossSweepThreat`.

## Findings and regression coverage

All requested findings are implemented. Paths below abbreviate `src/rules/` unless stated otherwise.

| ID | Test / coverage |
|---|---|
| D-01 | design-contract: a nonempty 10 AP turn returns after 10 AP, not the empty-Wait price |
| D-02 | design-contract: Flanked increases delayed magic damage too |
| D-03 | design-contract: an early turn is not a guaranteed escape without a reachable safe tile; shared-contract: escape uses instant movement even when walking costs more than impact margin |
| D-04 | design-contract: delayedHitsAllies includes the caster standing in its own sigil |
| D-06 | design-contract: turns automatically finish after both action and movement are exhausted; shared-contract: auto-end respects leftover fractional tiles, explicit opt-out and one turnEnd only |
| D-09 | shared-contract: E/W melee pair flanks; replacing either flank with a ranged attacker removes flanking; timeline golden: ten movement plus seven reaction AP projects 17, not Wait price |
| D-11 | shared-contract: ability reaction metadata controls resolution and preview together; skill-specific reaction metadata does not inherit the weapon policy |
| D-13 | design-contract: zero configured effect damage deals zero, not one; shared-contract: zero raw strike and zero preview damage stay zero |
| R-01 | parity: minimum delay zero must not starve every other unit/effect; sanitizer boundary test; existing simulator frozen-timeline watchdog |
| R-02 | parity: being held while crossing allies must not leave overlapping units; existing randomized sim occupancy invariants |
| R-03 | parity: rock throw preview damage must match the configured landed damage; raw-damage spell preview must apply the side damage multiplier |
| R-04 | parity: boss skill AP and next-turn preview must respect bossTurnAp; waiting boss projected next turn must use its minimum rhythm |
| R-05 | parity: preview from a proposed tile must recompute flanking there |
| R-06 | parity: immune source standing in its own effect must not count as an escape |
| R-07 | parity: timeline display ties must match the scheduler settings; shared-contract: effect and unit tie predicates honor configuration |
| R-08 | parity: bow attack preview from a proposed move must include the movement surcharge |
| R-09 | parity: sweep preview must show its configured impact delay |
| W-04 | shared-contract: inactive bow hypothetical attack and skill costs include movement; existing AI movement-after-shot planning tests |
| U-04 | game/preview-parity: anticipated sweep danger honors impact equality (both units-first settings) |
| U-05 | game/preview-parity: bow move-after-shot hover includes surcharge and matches actual turn-end; board now calls pendingFor directly |
| U-06 | game/preview-parity: Incoming, judge and timeline warn when an early turn has no safe reachable tile |
| U-08 | game/preview-parity: winning action is included in report AP exactly once |
| U-11 | game/preview-parity: immune caster is absent from Incoming and receives no escape credit |
| AI integration 1–4 | plannedActionAp/actionApCost parity; shared turnDelay; tileDanger/escapeOutlook and disengage-risk tests; delayed preview damage includes side scaling and flanking for AI ally risk; existing AI behavior suite |

Controller integration: `game/preview-parity: controller accepts engine auto-end without a duplicate endTurn`.

## Test-first evidence and changed test assumptions

Before production edits, the ported parity suite produced **11 failing / 6 passing** tests; the ported design suite produced **6 failing / 2 passing** tests. These defects now pass. The later inactive-bow hypothetical test was observed failing at 75 vs 125 AP, then fixed. Additional golden/HUD/reaction tests were added during integration; not every additional test was written before its corresponding shared implementation.

Updated existing `engine.test.ts` boss sweep scenario driver: it no longer blindly appends endTurn after a boss skill or an exhausted player action. It checks the returned active turn, preserving the existing AP/margin/escape assertions. This was the source of six expected failures after auto-end was introduced.

Updated imported probes: sanitizer expects 5 rather than 0 for negative minTurnDelay; immune-caster regression explicitly disables delayedHitsAllies (default-on now correctly hurts the caster). No existing production test was skipped or weakened. The design charger test is retained as a passing control from the already-merged AI track, not claimed as new work here.

## Verification

- `npx tsc --noEmit -p tsconfig.json` — exit 0.
- `npx eslint .` — exit 0.
- `npx vitest run` — **11 files, 129 tests passed**.
- `git diff --check` — clean.
- `E2E_PORT=4181 npx playwright test` — **13 passed**, final rerun 29.8 seconds. Earlier complete output retained in `e2e-results.txt`.
- `npx tsx tools/sim.ts 40 all policy=expert` — exit 0.
- `npx tsx tools/sim.ts 40 all policy=novice` — exit 0.
- Both sim output files were parsed to verify **40 cells / 1,600 battles per policy**, each cell reporting **0 stalls and 0 illegal fallbacks**. Seeds 1000–1039 per cell. Raw tables: `sim-expert.txt`, `sim-novice.txt`.

## Simulation headlines

Win/HP ranges are across loadout cells using the CLI's rounded percentages. Fight AP is the approximate mean of the CLI's one-decimal cell means. These are not exact unrounded aggregate win rates.

| Policy | Encounter | Battles | Win range | HP-left range | Mean fight AP | Stalls | Illegal |
|---|---|---:|---:|---:|---:|---:|---:|
| expert | granary | 160 | 98–100% | 66–87% | 302.2 | 0 | 0 |
| expert | wolves | 480 | 100% | 69–79% | 359.4 | 0 | 0 |
| expert | cultists | 480 | 78–100% | 28–68% | 574.7 | 0 | 0 |
| expert | nephilim | 480 | 90–100% | 74–94% | 1026.8 | 0 | 0 |
| novice | granary | 160 | 98–100% | 66–87% | 299.6 | 0 | 0 |
| novice | wolves | 480 | 100% | 64–80% | 355.9 | 0 | 0 |
| novice | cultists | 480 | 93–100% | 41–68% | 579.5 | 0 | 0 |
| novice | nephilim | 480 | 0–60% | 0–31% | 829.5 | 0 | 0 |

AP-spent cadence, final-turn telemetry, flanked telegraphs, caster self-damage and coherent AI hypothetical previews change balance; this track does not tune encounter numbers. The novice Nephilim results remain a clear balance concern for the later balance track. Crossbow/weapon-expansion golden tests remain intentionally outside this track's scope.

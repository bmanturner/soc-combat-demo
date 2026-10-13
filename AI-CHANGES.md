# Track C — enemy AI, party bot, simulation

Base: `8ac7c3b`; branch: `fix/ai`. Implementation commits: `84f3a0e` (AI) and `95afe0c` (sim). This report covers decisions 11–14, not the concurrent rules/UI fixes or later weapon/balance work.

## Implemented behavior and fixtures

| Finding | Change | Regression evidence |
|---|---|---|
| D-05 | Charger attack options must include the closest body; equal distance resolves to lowest current HP. Damage/kill scoring cannot override that target. | `D-05 wolf pursues the strictly closest healthy body rather than a distant kill`; `D-05 wolves bite closest body even when a farther kill is available` (the latter fixture tests the HP tie). |
| A-01 | After two consecutive sweeps, an exposed ranged foe gets Rock Throw instead. Streak is derived without mutation from public attack history, including resets after non-sweep actions or an empty boss turn. | `A-01 reviewer bait policy now draws rock throws and damages the exposed archer`. |
| D-12 | Camp memory stores the nearest blocking tile on the unit-to-boss ray. Consecutive boss-turn samples count only the same tile; changing cover starts at one, exposure clears to zero. | `D-12 same-cover camping increments, changing cover resets, exposure clears`. |
| A-02 | Signed expected damage/KO utility; allies have double penalty, overkill is capped, and ally-only patterns are excluded for both sides. Seer sigils price allied defense-adjusted damage and KO risk without banning self-overlap. | Party and enemy ally-only tests; `A-02 Seer prices allied KO risk but still permits a self-sigil lure`. |
| A-03 | If no one-turn firing position exists, Seer builds a multi-source terrain distance field from legal firing tiles and advances toward it. Deterministic goal/tie order avoids arbitrary waypoint churn. | `A-03 Seer approaches a firing position beyond one movement budget`: the reviewer's 13-tile wall fixture now reaches casting positions. |
| A-06 | Guardians occupy enemy-facing interception positions within three tiles of a living Seer, avoid occupied screen slots, and attack nearby intruders. With the Seer dead they revert to pursuit. | `A-06 guardian stays tethered on the threatened side of the Seer`. |
| A-05 | `SimResult.illegalFallbacks` and detailed `fallbacks` preserve original action, seed, encounter, policy, clock, active turn and RulesError. CLI adds an illegal column and prints detailed failures to stderr. Tests require zero in normal battles. | `A-05 records illegal action, seed, policy and clock before falling back`; every encounter/loadout smoke test for both policies; randomized invariants. |
| Watchdog | Stall with an explicit reason after 100 actions without clock advance or 250 actions without HP/KO progress; distinguish action-cap/no-active-unit termination. `simulateBattle` supports scripted/custom maps. | Disconnected no-combat-progress fixture and fault-injected frozen-scheduler fixture. The latter does not depend on retaining the zero-Wait rules bug. |
| Party utility | Expected useful damage/status per committed AP, approach success probability, failed-retreat danger and opportunity damage; hypothetical move-before/move-after bow surcharges charged once. Daze bonus is chance-weighted and omitted for already-dazed targets. | `party utility values damage per AP rather than a larger burst`; bow-cost test including Aimed Shot; risky-retreat test. |
| Policies | `botAction(state, policy)` / sixth `runBattle` argument; `policy=expert` (default) predicts sweep/rock exposure, `policy=novice` only reacts to existing telegraphs and prefers the nearest target instead of the weakest. | `novice ignores future boss sweeps but both policies react to visible telegraphs`; both-policy sim smoke tests. |

New demo settings, each with registry rationale:
- `sweepStreakCap = 2`, range 1–10 boss attacks.
- `rockThrowFallback = 'any-exposed'`, alternative `'ranged-only'`. Both modes prefer exposed ranged targets. Fallback applies when there is no exposed ranged target; the streak override itself specifically pressures ranged foes.

No new optional fields in `types.ts`. Cover identity uses the existing numeric `state.memory` map (`hiddenCover:<unitId>`).

## Bait replay

The legal, state-reactive policy from the reviewer's `tools/probe-ai-cases.ts` is reproduced in `src/rules/ai-boss.test.ts`: seed 2, default boss spawn, Jubal alternates row 4/5 according to pending sweep, Jabal uses the bot, archer stands at (5,5) and fires without seeking cover. The recorded static enemy actions must **not** be forced back into the new AI: doing that would force the old 12 sweeps regardless of the fix. We retain the full event history, which the new pure streak query reads.

| Replay | Sweeps | Rock Throws | Archer damage | End |
|---|---:|---:|---:|---|
| Review baseline | 12 | 0 | 0 | Defeat at AP 1300 |
| Fixed policy | 8 | 4 | 170 | Defeat at AP 1300 |

This closes ranged-threat suppression; it does not turn the intentionally passive bait policy into a winning strategy. Verified with `npx vitest run src/rules/ai-boss.test.ts --silent=false --reporter=verbose`.

## Before / after simulation

Commands: `npx tsx tools/sim.ts 40 all policy=expert` and the same with `policy=novice`. Seeds are 1000–1039 per cell. Four starter weapons; clothing in Granary, light/medium/heavy elsewhere. Each policy has 40 cells / 1600 battles, with 160 Granary and 480 per other encounter. Final total: **3200 battles, zero stalls, zero illegal fallbacks**. Counts and every CLI row were parsed and checked programmatically.

Baseline expert is the unchanged `8ac7c3b` policy. Baseline novice was measured after adding only the policy switch (nearest-target preference and disabling boss prediction), before any AI/utility/cover changes. Baseline runner did not return illegal fallback counts; no claim of baseline zero fallbacks is made from those files. Both baseline commands reported zero stalls.

Win percentages below are reconstructed exactly from the 40-seed integer CLI percentages (each win is 2.5 percentage points). HP is the equal-cell mean of the CLI's rounded percentages, so it is **approximate**, with up to 0.5 percentage point rounding uncertainty. HP includes losses and KO units; it is not conditional on winning.

| Policy | Encounter | Before win | After win | Before HP ≈ | After HP ≈ |
|---|---|---:|---:|---:|---:|
| expert | granary | 100.00% | 99.38% | 74.00% | 76.25% |
| expert | wolves | 100.00% | 100.00% | 74.33% | 75.42% |
| expert | cultists | 88.96% | 95.21% | 40.50% | 53.00% |
| expert | nephilim | 87.92% | 97.71% | 72.58% | 84.50% |
| novice | granary | 100.00% | 99.38% | 74.00% | 76.75% |
| novice | wolves | 100.00% | 100.00% | 74.50% | 75.25% |
| novice | cultists | 92.29% | 95.62% | 43.08% | 54.00% |
| novice | nephilim | 9.58% | 9.58% | 5.83% | 5.83% |

Full per-weapon/armor tables, including AP, catches, escapes and final illegal counts:
- [Baseline expert](baseline-expert.txt)
- [Baseline novice](baseline-novice.txt)
- [Final expert](final-expert.txt)
- [Final novice](final-novice.txt)

The boss remains highly policy-sensitive. The stronger expert now avoids the bow-surcharge timing mistakes that previously caused catches; closing one bait exploit does not imply lower expert win rates. Novice boss outcomes are unchanged for these seeds despite the fixed bait case. Cultists also became easier with the new positional screen and better party utility. These are behavior measurements, **not approval of balance**. In particular, do not increase sweep damage based on an expert who avoids it; later balance work must consider both policies. Forty shared seeds are reproducible comparisons, not human win-rate estimates or strong evidence for small cell differences.

## Encounter lessons remain observable

Additional strict runs: 40 seeds per encounter and policy with daggers/default armor. Raw event counts are in [lesson-evidence.jsonl](lesson-evidence.jsonl). Every additional run also had zero stalls/fallbacks.

| Lesson | Expert evidence | Novice evidence |
|---|---|---|
| Granary positioning/basic patterns | 183 moves, 121 Dagger strikes | 190 moves, 115 Dagger strikes |
| Wolves charge/engage/scatter | 98 disengage checks, 120 fear applications | 75 disengage checks, 120 fear applications |
| Zealots pin while Seer dazes/brands | 133 disengage checks; 93 Daze Bolts, 43 Hellfire Sigils | 137 checks; 111 bolts, 53 sigils |
| Boss melee telegraphs + ranged pressure + cover relocation | 281 sweeps, 37 throws, 91 rockfalls; 177 archer moves | 248 sweeps, 141 throws, 40 rockfalls; 40 archer moves |

Event counts establish that the mechanics actually occur, not that a novice successfully learns them. Fixtures separately establish same-cover resetting, multi-turn caster navigation, nearest-body pursuit, and guardian tethering. Self-overlapping Seer sigils remain selectable when profitable; do not replace this with a hard self-area ban. The concurrent rules track owns making the caster itself take delayed damage.

## Integration / ownership

Production edits are limited to `src/rules/ai.ts`, `sim.ts`, `sim.test.ts`, appended config keys/defaults/settings, `engine.ts`'s `trackHiding` block plus its two required imports, and `tools/sim.ts`. Added tests: `ai-behavior.test.ts`, `ai-boss.test.ts`. No edits to queries, targeting, formulas, state, types, game/HUD/board, content, dependencies, other worktrees or design vault.

AI-local integration points to replace with rules-track helpers after merge:
1. `plannedActionAp`: swap for the shared action-AP helper with hypothetical movement, including retreat movement.
2. `projected` and the plan-loop `Math.max(..., minTurnDelay)`: use the shared unit-specific/empty-turn delay resolver. This branch deliberately remains executable against its baseline engine, whose global floor is being corrected independently.
3. `tileDanger` eligibility/tie logic: use shared effect-hit eligibility and escape outlook. Current timing model assumes an earlier next turn permits a later escape; the shared outlook additionally handles safe reachable tiles and ties centrally.
4. Seer sigil `allyRisk` estimate: replace `damageAfterDefense`/raw-sigil estimate with shared delayed-effect preview damage once available (especially flanking).
5. `pathFailureCost` is policy utility, not an alternative reachability implementation; it consumes existing `Reach.risks`/`pathSafety`. Its raw opportunity-damage estimate is conservative; it does not predict dodge displacement or future RNG.

No helper was added to queries and no shared state fields were required. Exact before/after numbers must be remeasured after merging the rules track; that merge changes AP and delayed-damage semantics.

## Verification

Final executed gates:
- `npx tsc --noEmit -p tsconfig.json` — passed.
- `npx eslint .` — passed.
- `npx vitest run` — 6 files, 64 tests passed.
- Both 40-seed/all-encounter policy commands — 3200 clean final battles.
- Additional lesson sample — 320 clean battles.
- `git diff --check` — passed.

A later optional batch to add redundant rock-fallback/cap assertions was held for tool approval and was not applied; the implemented settings and existing bait/same-cover fixtures remain verified as described above.

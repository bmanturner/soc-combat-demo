**Scope:** demo-only second pass on `fix/balance2`, starting from `630da48`. The first-pass acceptance above is historical and does **not** establish C1–C4. This section and its computed tables supersede that acceptance. No source-backed weapon AP, patterns, ranges, engagement base/per-point, movement costs, damage formula, bow 75/125, or crossbow 50/50 were changed. No engine, queries, targeting, or production UI edits. The one test-only edit in `src/game/preview-parity.test.ts` explicitly pins the historical depth-3 sweep fixture; its impact-equality assertion is unchanged.

### Restoring the shrine without hiding a routing flaw

The old expert granted a 1.6× utility focus bonus to the lowest-HP enemy anywhere on the map. In the shrine that was the backline Seer. The paired seed-1000 light-dagger traces at restored 1/1 enemy damage show the problem directly: before, Jubal moves all five tiles to (7,5), then throws at the Seer; after, he moves three tiles to (4,4), then stabs the nearby left zealot. This is not a claim that killing the caster first is always wrong. It is a correction to giving a distant weak enemy an unconditional melee focus bonus before accounting for the frontline.

The expert now chooses lowest HP **within one tile of its nearest enemy distance** for melee focus. Legal options are not removed; a worthwhile distant throwing-knife shot can still win on utility. Ranged focus remains lowest HP, novice focus remains nearest enemy, and novice still ignores unannounced boss sweeps. A regression test was observed failing with `seer` instead of `guard`, then passing. The same function handles ordinary enemies; the final Granary/wolf runs check those possible side effects. No enemy AI behavior changed.

| Changed demo value | Old → new | Why |
|---|---|---|
| Zealot damage multiplier | .5 → .75 | Restore physical pinning pressure, but do not return to the 1/1 candidate's 80% expert light-javelin wins. |
| Seer damage multiplier | .5 → 1.5 | Put more of the restored challenge in the caster's daze/fire threat rather than light-melee blade attrition. With .75 zealots, the 100-seed intermediate confirmation had expert minima 86/86/93% by armor and HP spreads 26.27/25.52/21.95 pp. This is joint tuning, not an isolated estimate of either multiplier. |

The restored challenge is real, but **C1's upper win ceilings remain a miss**: some medium/heavy and ranged cells are still too reliable. This is no longer the first pass's 100% everywhere/roughly three-quarters-HP encounter. Do not relabel an upper-bound miss as success merely because fewer builds die. The final table below is the authority for every cell and median.

### Narrowing novice boss outcomes

| Changed demo value | Old → new | Why |
|---|---|---|
| Sweep streak cap | 2 → 1 | More frequent exposed-ranged pressure; the boss does not spend two successive turns being baited into sweeps before throwing a rock. |
| Sweep depth | 3 → 2 tiles | Offset the earlier companion losses from more rocks with a shorter melee escape route. Keep sweep damage 350 and telegraph 100 AP: ignored warnings can still kill light armor. |
| Boss HP multiplier | .9 → .95 (1080 → 1140 HP) | Restore some of the race after reducing sweep depth. Deadline remains 1200 AP; no weapon damage or AP budget concession. |

The screen evidence rejected several superficially simple fixes. Cap 1 alone drove novice colossal to 6.67% and shield to 15%. Sweep damage 275–300 kept the companion alive and sent ranged novice wins to approximately 100%; changing damage alone is not a smooth knob. Increasing rock damage to 160–170 hurt expert bow before sufficiently narrowing novice spread. Depth 2 with cap 1 improved novice colossal to 41.67%, but made expert wins too certain; additional boss HP counterbalances that. Faster/slower boss cadences and two cover additions were also rejected. The final candidate keeps the original cadence, cover map, damage and warning time. This is a **joint candidate with explicitly reported misses**, not a claim that every threshold was solved.

### Reproducibility and limits

Raw machine-readable `ROW` records are retained in `notes/balance/second/`. `METHOD.md` identifies AI/content snapshots and the rejected partial cover experiment. Every candidate prints its effective config. Candidate screens are 40 seeds/cell, final singles 100 seeds/cell, and final combinations 40 seeds/cell. Final commands:

```sh
npx tsx tools/sim.ts 100 all policy=expert
npx tsx tools/sim.ts 100 all policy=novice
npx tsx tools/sim.ts 40 all policy=expert combos=1
npx tsx tools/sim.ts 40 all policy=novice combos=1
npx tsx tools/balance-math.ts
npx tsx tools/check-balance-source.ts
npx tsc --noEmit
npx eslint .
npx vitest run
python3 tools/second-balance-report.py
```

The report rejects incomplete or duplicate cell sets, mismatched policies/trial counts, or inconsistent final configs. It checks all 85 singles and all 121 combination cells per policy. It does not round before accepting thresholds. T4 is separately checked by the unchanged analytic budgets and executable budget tests. The source guard compares against the earlier source-backed baseline, not against freshly tuned demo numbers.

These are selected deterministic bot results on seeds 1000–1099, **not** a held-out validation sample and not evidence that a human finds every build equally fun. A zero-win novice light cell remains visible in the detailed tables even when the armor aggregate passes. Mean HP includes defeats, including HP retained at a deadline loss.

### Confirmed outcome and remaining work

**This is a partial second pass, not an all-targets-met release.** C2 and C4 pass. C1 meets all damage floors, HP medians, HP spreads and lower win bounds; expert light is fully in-band, but upper win ceilings remain exceeded in the other five policy/armor rows. The largest cultist HP spread is 26.27 pp, and the expert light dagger/javelin/dual cells are 91/90/91% wins instead of the restored-1/1 routing failures.

The complete novice portion of C3 passes: 49.67% overall, all families 29.00–75.67%, spread 46.67 pp (first pass 65.67 pp), and armor aggregates 27.78/55.00/66.22%. **The expert portion misses:** dagger, axe, crossbow and javelin each win 97.33%, dual wins 99.67%, and dagger mean HP is 90.0531% (slightly over 90, not rounded away). The other expert families remain above the 80% floor. Additional boss HP was screened and rejected because it drove expert bow to 79.17% before fixing dual's upper win outlier. A 1150-AP deadline screen still left dual at 99.17% while reducing bow to 83.33%; a blanket shorter race was not accepted as a demonstrated solution. The novice's light axe and colossal cells remain zero-win; meeting an armor aggregate is not a solution to every individual loadout.

Final verification: **203 Vitest tests / 17 files pass; TypeScript and ESLint exit 0; 72 source-backed comparisons pass; all nine isolated basic-damage budgets remain unchanged and pass.** The 100-seed singles and 40-seed combination runs cover 26,680 battles with zero stalls and zero illegal fallbacks. E2E was not rerun in this worktree; no production UI code changed.

### Recommendations for Aaron

1. Play the restored shrine's light dagger, javelin and dual builds; compare a screen-first approach with a deliberate Seer dive. The bot fix is a baseline competency correction, not the only correct tactic.
2. Treat the remaining cultist upper win ceilings as unfinished work, not justification for another blanket damage increase. The 1/1, .9/1.5 and 1/1.25 screens showed that raising attrition indiscriminately reinstates weak-build failures before eliminating strong-build certainty.
3. Keep the boss's lethal warning lesson and novice's lack of anticipation visible. Use the full armor table; never advertise a family aggregate as evidence that every light loadout has a reasonable first attempt.
4. Validate the selected build on held-out seeds and with first-time humans before adopting demo values as design recommendations. The source-backed combat rules remain unchanged.

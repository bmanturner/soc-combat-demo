# Sons of Cain — demo balance phase

**Scope:** numerical demo tuning on `fix/balance`, based on `83cd5df`. This is a deterministic bot benchmark, not proof of human balance or new canon. Source AP costs, patterns, ranges, engagement probabilities, movement, damage formula, two-handed side penalties, bow surcharge and crossbow reload are unchanged. No engine, AI, HUD, board or game implementation was edited.

## Binding targets

- **T1 Granary:** every legal starter ≥97% wins and ≥55% mean party HP in both policies.
- **T2 Wolves/Cultists:** within each armor row, every family within ±15 percentage points of median win; minimum 80% expert / 75% novice; max family HP spread ≤25 pp.
- **T3 Nephilim:** expert family aggregate 80–97% wins, no family >90% mean HP; novice overall 35–60%, every family ≥20%. These are family aggregates across light/medium/heavy, as specified, **not** per-armor boss floors. Some novice light builds still have near-zero wins; see the full table instead of hiding that behind the aggregate.
- **T4 Identity/budgets:** no-reaction, zero-armor, level-one sustained basic damage/100 AP: 60–70 dagger/bow/dual/crossbow; 55–65 shield/polearm/axe and javelin thrust; 40–50 throw; 45–55 colossal. Dual assumes one surviving target; crossbow includes reload.
- **T5:** zero stalls and illegal fallbacks in all measured runs.

## Measurement and reproducibility

Baseline raw logs were copied byte-for-byte from the weapons-core handoff: `baseline-expert.txt`, `baseline-novice.txt` (40 seeds/cell). Final commands:

```sh
npx tsx tools/sim.ts 40 all policy=expert
npx tsx tools/sim.ts 40 all policy=novice
npx tsx tools/sim.ts 100 all policy=expert
npx tsx tools/sim.ts 100 all policy=novice
npx tsx tools/sim.ts 40 all policy=expert combos=1
npx tsx tools/sim.ts 40 all policy=novice combos=1
npx tsx tools/balance-math.ts
python3 tools/build-balance-report.py
```

Logs `candidate-m-*` are the complete 40-seed screen; `candidate-n-crossbow-*` screen the last crossbow 80→79 adjustment. `confirmation-m-*` retains the first 100-seed confirmation, which narrowly missed T3 (crossbow 97.33%). `final-*` are full repeated confirmations of candidate N, with 100 seeds for singles and 40 for combinations. Seeds start at 1000. All final runs use the same final production numbers. Expert predicts boss timing; novice still ignores unannounced sweeps. **No bot changes.** Reload/swap are charged. Combination cases are crossbow+shield, crossbow+axe, bow+daggers and colossal+daggers. The report generator requires exactly 85 unique single-loadout cells and 121 combination cells per policy, and checks trial counts before computing acceptance. `balance-report.py` is a quick diagnostic summary, not the acceptance gate. `sim.ts` adds optional `weapons=id,id` screening and rejects unknown or empty filters; it now prints the effective config for future captures.

Raw strike throughput is not full-fight throughput: AP charged to movement, waits and reactions, tactical geometry, target reactions, kill timing and overkill all matter. The analytic table uses the engine's separate normal/critical rounding. The prior handoff's so-called unarmored budget included a rat's **15% dodge**, masking an across-the-board excess against a truly reaction-free target. Both columns are now explicit. This is why even the low realized-throughput dual received a small raw reduction rather than an unjustified buff.

## Changes and rationale

Every changed weapon raw field now carries **demo** ownership and a specific balance reason rather than still implying it is the original Drafts/09 number. All skill AP/cooldowns and weapon accuracy, penetration, defense and engagement identities remain unchanged.

| Parameter | Before → after | Reason/evidence |
|---|---|---|
| Dagger raw | 45 → 38 | No-reaction basic 81.22 → 68.55 damage/100 AP; retain fastest single-target tempo and disengagement. |
| Shield raw | 60 → 55 | 70.52 → 64.67; defense and high engagement unchanged. |
| Polearm raw | 85 → 72 | 73.21 → 61.99; reach remains valuable. Intermediate 75 still gave 98.33% expert boss wins in candidate L; final screen at 72 gave 97.50%. |
| Axe raw | 115 → 101 | 73.57 → 64.62; high raw damage, low hit, five-cell arc and side penalties preserved. |
| Bow raw | 65 → 58 | 77.31 → 68.96; 75/125 AP and range unchanged. This also changes the companion's bow damage (shared item), explicitly accounted for in every final party sim. |
| Crossbow raw | 85 → 79 | Sustained fire+reload 74.08 → 68.85; loaded opener and both reload policies preserved. The intermediate raw 80 confirmation narrowly exceeded T3 at 97.33%; raw 79 gave 97.00% in the targeted 100-seed check. |
| Dual raw per hit | 42 → 40 | Two-hit 73.18 → 69.70; one random secondary is still not guaranteed two-target damage. |
| Javelin raw thrust / throw | 60/80 → 55/70 | 64.67 / 49.36; hybrid defense and immutable 75/125 AP preserved. |
| Colossal raw | 135 → 130 | 56.94 → 54.82 per target; huge AoE and 175 AP risk preserved. |
| Throwing Knife multiplier | .6 → .8 | With dagger reduction, level-one raw 27 → 30.4. Keeps modest ranged finishing utility rather than buffing frequent basic attacks. Candidate I showed this alone did not cure the expert light-cultist HP deficit. |
| Rat damage multiplier | 1 → .8 | Tutorial safety margin for misses/slow axe: candidate K 100-seed wins 100%, axe HP 70.57%; rechecked after weapon-budget changes. |
| Cultist fighter and mage damage multipliers | 1 → .5 each | Bring the expert light-dagger attrition outlier into T2 without distorting weapon patterns. Intermediate .75 spread exceeded 30 pp; .6 spread 27.60 pp; final-budget .55 spread 25.90 pp. Final 40-seed .5 screen spread 22.76 pp. This deliberately makes cultists easier; do not portray a numerical parity target as proof of an exciting fight. |
| Boss HP multiplier | 1 → .9 | Adjust encounter health budget after lower weapon budgets, including companion bow; no global party multiplier. Actual HP 1200 → 1080. |
| Sweep delay | 75 → 100 AP | Gives a first-timer a response opportunity while preserving long-commitment risk; 150 AP warnings trivialized the fight. |
| Sweep damage | 500 → 350 | Still lethal to a full-health level-five light Jubal, but medium/heavy can survive one hit; 250 was too forgiving. |
| Rock damage | 170 → 150 | Relieves the baseline expert bow outlier while retaining ranged exposure pressure. |
| Escape deadline | 1300 → 1200 AP | Counterbalances readable warnings/lower HP: disciplined players still face an actual race, rather than 100% wins. |

The boss settings are a **joint candidate**, not isolated causal effects. Candidate L (final weapon budgets except polearm 75, cultists .55) produced expert family wins 89.17–98.33%, novice overall 47.04%, every novice family ≥22.50% (colossal 25%). Baseline novice overall was 18.70% and colossal 0%. Candidate M adjusts polearm 75→72 and cultists .55→.5, with other values unchanged.

## Exploratory candidates (not release evidence)

A–K logs preserve screening output and overrides in their first line; most use the original weapon budgets. L and M are the fully specified candidate snapshots above. A–K are not suitable for automated historical replay against current defaults: some chained exploratory processes loaded after intermediate content changes. No final acceptance is computed from these logs. In particular, use complete L/M plus the final confirmations to justify shipping, not cherry-picked A–K cells.

Useful rejected directions:
- 150 AP sweep warnings: novice wins approached 100% and expert HP often exceeded 95%.
- Delay 110 without a damage concession: novice colossal remained 5% while bow reached 91.67%.
- Sweep 250 + delay 110: novice families generally exceeded 80%, too easy.
- 125 AP warnings with a short deadline: expert win rates looked plausible but party HP remained >95% for many families; timing alone did not create meaningful attrition.
- Knife-only cultist utility: insufficient; avoid calling a marginal skill tweak a parity fix.

## Recommendations for Aaron

1. **Human-test novice light-armor boss runs first.** Family aggregates meet a different question than every armor having a fair first-attempt chance. Death from committing just before an unseen sweep remains especially harsh; changing the novice bot to anticipate it would hide that problem.
2. **Test whether the cultist damage cut is fun.** The T2 spread ceiling and the expert's lowest-HP focus routing drove a large encounter nerf. A separate enemy formation/teaching pass or a justified routing fix may make a harder encounter equally fair; neither was smuggled into this numerical pass.
3. **Keep warning time, depth and damage separate.** Warning time can cross discrete AP breakpoints and abruptly trivialize a fight. Damage controls one-mistake tolerance; deadline/HP control the race. Re-run all armors when any changes.
4. **Do not buff dual solely from pooled damage/AP.** Conditional random second hits, overkill, movement and the bot's approximation affect its realized output. Its isolated basic budget is already near the top of its band.
5. **Use more seeds and held-out seeds before release.** Forty seeds are screening; 100 narrows noise but still makes a one- or two-point threshold brittle. A 400-seed held-out run plus first-time human playtests is the next validation step.

## Test and integration status

Nine new budget tests were observed failing before raw tuning, then passing. Existing javelin scaling golden pins were updated (90/120 → 82.5/105); the factor-of-1.5 assertion remains. Historical AP/tie-rule fixtures in `engine.test.ts` and `ai-behavior.test.ts` explicitly retain their 75-AP/500-damage test settings rather than weakening source-backed assertions.

`src/game/preview-parity.test.ts:31` is owned by the concurrent UI worker and still assumes a 75-AP warning when asserting impact at 105. The owner must add `sweepDelay: 75` to that fixture; see `UI-INTEGRATION.md` and the ready-to-apply `ui-fixture.patch` (`git apply --check` passed). This worker did not edit the forbidden game/UI directories. **Final verification: typecheck exit 0; ESLint exit 0; rules-only Vitest 12 files / 168 tests passed; full Vitest 195 passed / 1 failed (14 files / 196 tests).** The sole failure is that UI-owned historical sweep fixture, not a weakened or skipped assertion. Full-suite green remains an explicit integration blocker. Exact output is in `typecheck.txt`, `lint.txt`, `rules-tests.txt`, and `unit-tests.txt`.


## Final acceptance (computed, not manually selected)

- **T1 MET**: Minimum win 100.00%, minimum HP 70.57% across both policies.
- **T2 MET**: Maximum HP spread 21.26 pp; see every armor row below.
- **T3 MET**: Expert family win range 86.00–97.00%, max mean HP 88.22%; novice overall 45.89%, family minimum 21.00%.
- **T4 MET**: All nine families meet no-reaction single-target bands in tools/balance-math.ts and nine executable budget tests. Source AP, patterns, ranges, penalties and reaction identities unchanged.
- **T5 MET**: 26680 final/combination battles, 0 stalls, 0 illegal fallbacks; 16579 reloads and 1405 swaps.
### T2 per-armor check

| Policy | Encounter | Armor | Minimum win | Maximum median deviation | HP spread | Pass |
|---|---|---|---:|---:|---:|---|
| expert | wolves | light | 99.00% | 1.00 pp | 11.28 pp | True |
| expert | wolves | medium | 99.00% | 1.00 pp | 10.12 pp | True |
| expert | wolves | heavy | 100.00% | 0.00 pp | 10.25 pp | True |
| expert | cultists | light | 100.00% | 0.00 pp | 21.26 pp | True |
| expert | cultists | medium | 100.00% | 0.00 pp | 9.49 pp | True |
| expert | cultists | heavy | 100.00% | 0.00 pp | 12.04 pp | True |
| novice | wolves | light | 99.00% | 1.00 pp | 11.41 pp | True |
| novice | wolves | medium | 99.00% | 1.00 pp | 10.56 pp | True |
| novice | wolves | heavy | 100.00% | 0.00 pp | 10.73 pp | True |
| novice | cultists | light | 100.00% | 0.00 pp | 14.98 pp | True |
| novice | cultists | medium | 100.00% | 0.00 pp | 10.19 pp | True |
| novice | cultists | heavy | 100.00% | 0.00 pp | 11.81 pp | True |

### T3 Nephilim family aggregates

| Family | Expert win | Expert HP | Novice win | Novice HP |
|---|---:|---:|---:|---:|
| daggers | 90.67% | 85.97% | 45.33% | 34.19% |
| shield | 91.67% | 88.22% | 25.33% | 15.62% |
| polearm | 96.67% | 82.47% | 47.00% | 22.12% |
| two_handed | 96.00% | 85.06% | 38.33% | 6.42% |
| hunting_bow | 86.00% | 46.78% | 86.67% | 29.92% |
| crossbow | 97.00% | 82.23% | 85.33% | 28.67% |
| dual_wield | 93.67% | 85.02% | 34.67% | 11.43% |
| javelin_shield | 96.00% | 79.82% | 29.33% | 15.31% |
| colossal | 93.33% | 75.12% | 21.00% | 4.46% |

## Analytic damage per 100 action AP

| Family / mode | AP cycle | No armor/reactions | Unarmored rat (15% dodge) | Armor 100, no reactions |
|---|---:|---:|---:|---:|
| daggers/basic | 50 | 68.55 | 58.27 | 37.84 |
| shield/basic | 75 | 64.67 | 54.97 | 34.06 |
| polearm/basic | 100 | 61.99 | 52.69 | 34.44 |
| two_handed/basic | 125 | 64.62 | 54.92 | 37.75 |
| hunting_bow/basic | 75 | 68.96 | 58.62 | 36.83 |
| crossbow/fire | 100 | 68.85 | 58.52 | 38.33 |
| dual_wield/basic | 100 | 69.70 | 59.24 | 36.63 |
| javelin_shield/thrust | 75 | 64.67 | 54.97 | 34.06 |
| javelin_shield/throw | 125 | 49.36 | 41.96 | 26.08 |
| colossal/line | 175 | 54.82 | 46.60 | 31.21 |
| colossal/sweep | 175 | 54.82 | 46.60 | 31.21 |

Dual assumes the primary survives and remains the only secondary candidate. All AoE rows are one distinct target; no multi-cell boss multiplication. Bow movement changes the attack cost from 75 to 125, plus movement itself. Crossbow includes fire + reload, not opener-only throughput.


## Before / after by encounter × family × armor

Baseline: 40 seeds/cell (1000–1039). Final: 100 seeds/cell (1000–1099). HP means all outcomes, including surviving HP at deadline defeats. These are not victory-only means. Extra seeds are confirmation, not a wholly held-out sample.

### expert

| Encounter | Family | Armor | Before win | After win | Before HP | After HP |
|---|---|---|---:|---:|---:|---:|
| granary | daggers | clothing | 100.00% | 100.00% | 87.00% | 90.23% |
| granary | shield | clothing | 97.50% | 100.00% | 74.42% | 80.52% |
| granary | polearm | clothing | 100.00% | 100.00% | 77.15% | 84.57% |
| granary | two_handed | clothing | 97.50% | 100.00% | 61.19% | 70.57% |
| wolves | daggers | light | 97.50% | 100.00% | 72.79% | 70.84% |
| wolves | daggers | medium | 100.00% | 100.00% | 75.77% | 75.00% |
| wolves | daggers | heavy | 100.00% | 100.00% | 72.68% | 71.47% |
| wolves | shield | light | 100.00% | 100.00% | 79.19% | 78.64% |
| wolves | shield | medium | 100.00% | 100.00% | 76.45% | 77.72% |
| wolves | shield | heavy | 100.00% | 100.00% | 67.64% | 69.08% |
| wolves | polearm | light | 100.00% | 100.00% | 77.18% | 71.78% |
| wolves | polearm | medium | 100.00% | 100.00% | 71.84% | 73.92% |
| wolves | polearm | heavy | 100.00% | 100.00% | 68.41% | 74.22% |
| wolves | two_handed | light | 100.00% | 100.00% | 79.08% | 79.22% |
| wolves | two_handed | medium | 100.00% | 100.00% | 76.41% | 77.40% |
| wolves | two_handed | heavy | 100.00% | 100.00% | 69.93% | 68.45% |
| wolves | hunting_bow | light | 100.00% | 99.00% | 68.03% | 69.51% |
| wolves | hunting_bow | medium | 100.00% | 99.00% | 69.12% | 71.03% |
| wolves | hunting_bow | heavy | 100.00% | 100.00% | 68.07% | 70.05% |
| wolves | crossbow | light | 97.50% | 99.00% | 70.08% | 72.11% |
| wolves | crossbow | medium | 100.00% | 100.00% | 70.73% | 73.54% |
| wolves | crossbow | heavy | 100.00% | 100.00% | 66.30% | 69.88% |
| wolves | dual_wield | light | 100.00% | 100.00% | 71.11% | 67.97% |
| wolves | dual_wield | medium | 100.00% | 100.00% | 72.77% | 68.39% |
| wolves | dual_wield | heavy | 100.00% | 100.00% | 70.51% | 68.99% |
| wolves | javelin_shield | light | 100.00% | 100.00% | 74.21% | 72.55% |
| wolves | javelin_shield | medium | 100.00% | 100.00% | 72.22% | 67.60% |
| wolves | javelin_shield | heavy | 100.00% | 100.00% | 67.73% | 63.97% |
| wolves | colossal | light | 100.00% | 100.00% | 84.16% | 79.26% |
| wolves | colossal | medium | 100.00% | 100.00% | 74.49% | 74.59% |
| wolves | colossal | heavy | 100.00% | 100.00% | 75.08% | 72.67% |
| cultists | daggers | light | 65.00% | 100.00% | 18.97% | 56.14% |
| cultists | daggers | medium | 97.50% | 100.00% | 55.72% | 73.96% |
| cultists | daggers | heavy | 100.00% | 100.00% | 59.74% | 75.70% |
| cultists | shield | light | 97.50% | 100.00% | 53.55% | 75.10% |
| cultists | shield | medium | 100.00% | 100.00% | 61.03% | 78.41% |
| cultists | shield | heavy | 100.00% | 100.00% | 64.52% | 81.04% |
| cultists | polearm | light | 95.00% | 100.00% | 53.36% | 71.91% |
| cultists | polearm | medium | 97.50% | 100.00% | 50.99% | 71.41% |
| cultists | polearm | heavy | 100.00% | 100.00% | 52.13% | 70.98% |
| cultists | two_handed | light | 92.50% | 100.00% | 50.71% | 77.39% |
| cultists | two_handed | medium | 97.50% | 100.00% | 59.06% | 79.03% |
| cultists | two_handed | heavy | 100.00% | 100.00% | 64.60% | 81.79% |
| cultists | hunting_bow | light | 97.50% | 100.00% | 56.30% | 76.52% |
| cultists | hunting_bow | medium | 100.00% | 100.00% | 53.61% | 76.80% |
| cultists | hunting_bow | heavy | 92.50% | 100.00% | 47.41% | 73.38% |
| cultists | crossbow | light | 97.50% | 100.00% | 60.43% | 72.95% |
| cultists | crossbow | medium | 97.50% | 100.00% | 56.05% | 74.90% |
| cultists | crossbow | heavy | 100.00% | 100.00% | 58.98% | 74.85% |
| cultists | dual_wield | light | 85.00% | 100.00% | 35.72% | 69.28% |
| cultists | dual_wield | medium | 100.00% | 100.00% | 53.70% | 73.01% |
| cultists | dual_wield | heavy | 95.00% | 100.00% | 53.39% | 75.79% |
| cultists | javelin_shield | light | 82.50% | 100.00% | 26.40% | 62.21% |
| cultists | javelin_shield | medium | 100.00% | 100.00% | 40.99% | 69.54% |
| cultists | javelin_shield | heavy | 100.00% | 100.00% | 43.77% | 69.75% |
| cultists | colossal | light | 92.50% | 100.00% | 51.60% | 74.61% |
| cultists | colossal | medium | 92.50% | 100.00% | 55.78% | 77.69% |
| cultists | colossal | heavy | 95.00% | 100.00% | 59.97% | 79.85% |
| nephilim | daggers | light | 97.50% | 94.00% | 83.43% | 82.58% |
| nephilim | daggers | medium | 95.00% | 91.00% | 91.79% | 86.61% |
| nephilim | daggers | heavy | 100.00% | 87.00% | 92.90% | 88.71% |
| nephilim | shield | light | 95.00% | 97.00% | 82.63% | 86.46% |
| nephilim | shield | medium | 100.00% | 91.00% | 88.41% | 87.75% |
| nephilim | shield | heavy | 90.00% | 87.00% | 90.17% | 90.43% |
| nephilim | polearm | light | 100.00% | 98.00% | 76.05% | 80.79% |
| nephilim | polearm | medium | 100.00% | 98.00% | 77.34% | 81.99% |
| nephilim | polearm | heavy | 97.50% | 94.00% | 86.27% | 84.63% |
| nephilim | two_handed | light | 100.00% | 98.00% | 73.55% | 83.98% |
| nephilim | two_handed | medium | 100.00% | 98.00% | 79.60% | 88.35% |
| nephilim | two_handed | heavy | 95.00% | 92.00% | 75.63% | 82.85% |
| nephilim | hunting_bow | light | 82.50% | 93.00% | 40.44% | 51.09% |
| nephilim | hunting_bow | medium | 80.00% | 92.00% | 39.10% | 53.96% |
| nephilim | hunting_bow | heavy | 62.50% | 73.00% | 26.31% | 35.30% |
| nephilim | crossbow | light | 95.00% | 100.00% | 73.68% | 88.30% |
| nephilim | crossbow | medium | 97.50% | 99.00% | 92.48% | 94.06% |
| nephilim | crossbow | heavy | 95.00% | 92.00% | 62.47% | 64.33% |
| nephilim | dual_wield | light | 95.00% | 96.00% | 78.30% | 82.84% |
| nephilim | dual_wield | medium | 92.50% | 94.00% | 77.14% | 86.74% |
| nephilim | dual_wield | heavy | 87.50% | 91.00% | 77.16% | 85.48% |
| nephilim | javelin_shield | light | 95.00% | 95.00% | 70.66% | 76.40% |
| nephilim | javelin_shield | medium | 92.50% | 96.00% | 75.43% | 80.51% |
| nephilim | javelin_shield | heavy | 97.50% | 97.00% | 77.63% | 82.56% |
| nephilim | colossal | light | 85.00% | 93.00% | 64.05% | 70.70% |
| nephilim | colossal | medium | 92.50% | 93.00% | 68.92% | 75.63% |
| nephilim | colossal | heavy | 80.00% | 94.00% | 78.02% | 79.04% |
### novice

| Encounter | Family | Armor | Before win | After win | Before HP | After HP |
|---|---|---|---:|---:|---:|---:|
| granary | daggers | clothing | 100.00% | 100.00% | 87.25% | 90.50% |
| granary | shield | clothing | 97.50% | 100.00% | 73.52% | 80.28% |
| granary | polearm | clothing | 100.00% | 100.00% | 77.15% | 84.57% |
| granary | two_handed | clothing | 97.50% | 100.00% | 61.19% | 70.57% |
| wolves | daggers | light | 97.50% | 99.00% | 70.77% | 67.81% |
| wolves | daggers | medium | 100.00% | 100.00% | 74.83% | 73.24% |
| wolves | daggers | heavy | 100.00% | 100.00% | 73.61% | 71.62% |
| wolves | shield | light | 100.00% | 100.00% | 79.43% | 79.22% |
| wolves | shield | medium | 100.00% | 100.00% | 76.26% | 77.41% |
| wolves | shield | heavy | 100.00% | 100.00% | 68.03% | 69.65% |
| wolves | polearm | light | 100.00% | 99.00% | 75.87% | 71.55% |
| wolves | polearm | medium | 100.00% | 100.00% | 75.02% | 73.61% |
| wolves | polearm | heavy | 100.00% | 100.00% | 68.37% | 74.05% |
| wolves | two_handed | light | 100.00% | 100.00% | 78.37% | 77.28% |
| wolves | two_handed | medium | 100.00% | 100.00% | 74.72% | 75.70% |
| wolves | two_handed | heavy | 100.00% | 100.00% | 71.25% | 68.46% |
| wolves | hunting_bow | light | 100.00% | 99.00% | 70.13% | 69.72% |
| wolves | hunting_bow | medium | 100.00% | 99.00% | 70.81% | 70.84% |
| wolves | hunting_bow | heavy | 100.00% | 100.00% | 70.03% | 70.34% |
| wolves | crossbow | light | 100.00% | 100.00% | 66.75% | 70.23% |
| wolves | crossbow | medium | 100.00% | 100.00% | 69.67% | 72.72% |
| wolves | crossbow | heavy | 100.00% | 100.00% | 66.00% | 69.10% |
| wolves | dual_wield | light | 100.00% | 99.00% | 70.78% | 68.43% |
| wolves | dual_wield | medium | 100.00% | 100.00% | 73.65% | 69.98% |
| wolves | dual_wield | heavy | 100.00% | 100.00% | 72.55% | 69.73% |
| wolves | javelin_shield | light | 100.00% | 100.00% | 74.87% | 71.17% |
| wolves | javelin_shield | medium | 100.00% | 100.00% | 71.18% | 66.86% |
| wolves | javelin_shield | heavy | 100.00% | 100.00% | 67.90% | 63.32% |
| wolves | colossal | light | 100.00% | 100.00% | 82.25% | 78.08% |
| wolves | colossal | medium | 100.00% | 100.00% | 74.49% | 74.68% |
| wolves | colossal | heavy | 100.00% | 100.00% | 74.96% | 71.87% |
| cultists | daggers | light | 90.00% | 100.00% | 45.87% | 71.24% |
| cultists | daggers | medium | 100.00% | 100.00% | 53.19% | 73.27% |
| cultists | daggers | heavy | 100.00% | 100.00% | 56.65% | 75.98% |
| cultists | shield | light | 95.00% | 100.00% | 53.25% | 74.47% |
| cultists | shield | medium | 100.00% | 100.00% | 63.37% | 78.72% |
| cultists | shield | heavy | 100.00% | 100.00% | 65.14% | 81.36% |
| cultists | polearm | light | 97.50% | 100.00% | 51.63% | 72.29% |
| cultists | polearm | medium | 97.50% | 100.00% | 52.03% | 71.18% |
| cultists | polearm | heavy | 100.00% | 100.00% | 52.12% | 70.78% |
| cultists | two_handed | light | 92.50% | 100.00% | 48.40% | 77.15% |
| cultists | two_handed | medium | 97.50% | 100.00% | 59.40% | 78.47% |
| cultists | two_handed | heavy | 100.00% | 100.00% | 64.59% | 80.87% |
| cultists | hunting_bow | light | 97.50% | 100.00% | 43.72% | 71.58% |
| cultists | hunting_bow | medium | 97.50% | 100.00% | 45.75% | 71.70% |
| cultists | hunting_bow | heavy | 90.00% | 100.00% | 46.56% | 72.99% |
| cultists | crossbow | light | 97.50% | 100.00% | 59.21% | 74.83% |
| cultists | crossbow | medium | 100.00% | 100.00% | 57.02% | 74.33% |
| cultists | crossbow | heavy | 100.00% | 100.00% | 58.85% | 73.87% |
| cultists | dual_wield | light | 92.50% | 100.00% | 40.05% | 70.06% |
| cultists | dual_wield | medium | 100.00% | 100.00% | 57.25% | 72.15% |
| cultists | dual_wield | heavy | 95.00% | 100.00% | 55.32% | 75.36% |
| cultists | javelin_shield | light | 95.00% | 100.00% | 45.61% | 62.17% |
| cultists | javelin_shield | medium | 97.50% | 100.00% | 41.01% | 68.53% |
| cultists | javelin_shield | heavy | 95.00% | 100.00% | 40.92% | 69.55% |
| cultists | colossal | light | 95.00% | 100.00% | 47.62% | 74.93% |
| cultists | colossal | medium | 95.00% | 100.00% | 54.59% | 77.90% |
| cultists | colossal | heavy | 92.50% | 100.00% | 63.28% | 80.04% |
| nephilim | daggers | light | 35.00% | 44.00% | 14.24% | 33.65% |
| nephilim | daggers | medium | 0.00% | 26.00% | 0.00% | 32.89% |
| nephilim | daggers | heavy | 0.00% | 66.00% | 0.00% | 36.02% |
| nephilim | shield | light | 22.50% | 2.00% | 8.73% | 7.04% |
| nephilim | shield | medium | 0.00% | 39.00% | 0.00% | 30.28% |
| nephilim | shield | heavy | 0.00% | 35.00% | 0.00% | 9.53% |
| nephilim | polearm | light | 0.00% | 0.00% | 0.00% | 2.42% |
| nephilim | polearm | medium | 0.00% | 74.00% | 0.00% | 39.42% |
| nephilim | polearm | heavy | 30.00% | 67.00% | 9.61% | 24.51% |
| nephilim | two_handed | light | 0.00% | 0.00% | 0.00% | 0.00% |
| nephilim | two_handed | medium | 0.00% | 41.00% | 0.00% | 4.98% |
| nephilim | two_handed | heavy | 2.50% | 74.00% | 0.08% | 14.27% |
| nephilim | hunting_bow | light | 45.00% | 71.00% | 7.90% | 20.01% |
| nephilim | hunting_bow | medium | 67.50% | 91.00% | 18.06% | 31.25% |
| nephilim | hunting_bow | heavy | 92.50% | 98.00% | 30.39% | 38.50% |
| nephilim | crossbow | light | 37.50% | 71.00% | 6.58% | 19.04% |
| nephilim | crossbow | medium | 52.50% | 89.00% | 13.66% | 29.88% |
| nephilim | crossbow | heavy | 82.50% | 96.00% | 23.47% | 37.08% |
| nephilim | dual_wield | light | 0.00% | 42.00% | 0.00% | 25.55% |
| nephilim | dual_wield | medium | 0.00% | 62.00% | 0.00% | 8.32% |
| nephilim | dual_wield | heavy | 0.00% | 0.00% | 0.00% | 0.41% |
| nephilim | javelin_shield | light | 7.50% | 28.00% | 3.01% | 12.38% |
| nephilim | javelin_shield | medium | 12.50% | 31.00% | 4.35% | 15.68% |
| nephilim | javelin_shield | heavy | 17.50% | 29.00% | 8.76% | 17.87% |
| nephilim | colossal | light | 0.00% | 0.00% | 0.00% | 2.75% |
| nephilim | colossal | medium | 0.00% | 11.00% | 0.00% | 1.61% |
| nephilim | colossal | heavy | 0.00% | 52.00% | 0.00% | 9.03% |

## Verification counts

PASS: 72 source-backed value/status comparisons against 83cd5df.

All stored baseline, exploratory, intermediate and final ROW records were also checked for stalls/illegal fallbacks.

| Run | Cells | Battles | Stalls | Illegal | Reloads | Swaps |
|---|---:|---:|---:|---:|---:|---:|
| final-expert | 85 | 8500 | 0 | 0 | 3658 | 0 |
| final-novice | 85 | 8500 | 0 | 0 | 4494 | 0 |
| combos-expert | 121 | 4840 | 0 | 0 | 3620 | 782 |
| combos-novice | 121 | 4840 | 0 | 0 | 4807 | 623 |

## Useful landed damage / 100 active-turn AP

This metric includes movement, reload, swap and wait AP and excludes companions. It caps overkill, unlike the isolated budget table. Different encounter access makes pooled family values diagnostic, not a controlled ranking.

| Family | Expert before | Expert after | Novice before | Novice after |
|---|---:|---:|---:|---:|
| daggers | 31.77 | 28.16 | 31.90 | 29.23 |
| shield | 32.29 | 30.53 | 33.74 | 31.43 |
| polearm | 38.46 | 33.51 | 36.01 | 33.76 |
| two_handed | 37.77 | 34.93 | 35.04 | 34.30 |
| hunting_bow | 32.81 | 30.48 | 42.56 | 39.45 |
| crossbow | 38.91 | 33.29 | 46.39 | 41.25 |
| dual_wield | 29.43 | 28.67 | 28.48 | 29.67 |
| javelin_shield | 34.72 | 30.51 | 35.84 | 31.66 |
| colossal | 31.94 | 30.94 | 31.48 | 30.87 |

## Second pass

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

### Computed second-pass acceptance

No rounding is used for acceptance. Singles: 100 seeds/cell; combinations: 40. Seeds start at 1000. HP averages include defeats, not only victories.

| Policy | Cultist armor | Win range | Median HP | HP spread | C1 |
|---|---|---:|---:|---:|---|
| expert | light | 86.00–98.00% | 49.44% | 26.27 pp | MET |
| expert | medium | 86.00–100.00% | 54.10% | 25.52 pp | MISSED |
| expert | heavy | 93.00–99.00% | 50.79% | 21.95 pp | MISSED |
| novice | light | 88.00–97.00% | 43.38% | 12.97 pp | MISSED |
| novice | medium | 87.00–98.00% | 47.45% | 17.66 pp | MISSED |
| novice | heavy | 91.00–100.00% | 50.26% | 23.14 pp | MISSED |

| Policy | Wolf armor | Minimum win | Median HP | C2 |
|---|---|---:|---:|---|
| expert | light | 99.00% | 71.61% | MET |
| expert | medium | 99.00% | 74.10% | MET |
| expert | heavy | 100.00% | 69.20% | MET |
| novice | light | 99.00% | 71.17% | MET |
| novice | medium | 99.00% | 73.24% | MET |
| novice | heavy | 100.00% | 69.73% | MET |

| Boss family | Expert win | Expert HP | Novice win | Novice HP |
|---|---:|---:|---:|---:|
| daggers | 97.33% | 90.05% | 68.33% | 35.37% |
| shield | 96.67% | 89.28% | 42.00% | 19.80% |
| polearm | 95.33% | 71.72% | 48.00% | 20.72% |
| two_handed | 97.33% | 77.51% | 50.67% | 16.53% |
| hunting_bow | 85.33% | 50.06% | 75.67% | 23.92% |
| crossbow | 97.33% | 73.95% | 68.33% | 21.71% |
| dual_wield | 99.67% | 87.65% | 29.00% | 9.64% |
| javelin_shield | 97.33% | 81.37% | 29.67% | 11.98% |
| colossal | 92.00% | 77.18% | 35.33% | 9.31% |

**C3 MISSED:** expert family wins 85.33–99.67%, max family HP 90.05%; novice overall 49.67%, family range 29.00–75.67% (spread 46.67 pp). Novice armor aggregates: light 27.78%, medium 55.00%, heavy 66.22%.

**C4:** Granary minimum win 100.00%, minimum HP 70.57%. 26680 confirmed battles; 0 stalls, 0 illegal fallbacks; 16634 reloads and 1442 swaps. Analytic budgets and source guard are separate executable checks (see `second/budgets.txt`, `second/source.txt`, and `second/unit-tests.txt`).

### Second-pass before / after: every family × armor

Before is the first-pass 100-seed final, not the original weapons-core baseline. After uses the identical seed range. Win / HP in percent.

#### expert

| Encounter | Family | Armor | Before win | After win | Before HP | After HP |
|---|---|---|---:|---:|---:|---:|
| wolves | daggers | light | 100.00 | 100.00 | 70.84 | 70.76 |
| wolves | daggers | medium | 100.00 | 100.00 | 75.00 | 75.05 |
| wolves | daggers | heavy | 100.00 | 100.00 | 71.47 | 72.01 |
| wolves | shield | light | 100.00 | 100.00 | 78.64 | 79.50 |
| wolves | shield | medium | 100.00 | 100.00 | 77.72 | 77.51 |
| wolves | shield | heavy | 100.00 | 100.00 | 69.08 | 68.81 |
| wolves | polearm | light | 100.00 | 99.00 | 71.78 | 71.61 |
| wolves | polearm | medium | 100.00 | 100.00 | 73.92 | 74.10 |
| wolves | polearm | heavy | 100.00 | 100.00 | 74.22 | 73.99 |
| wolves | two_handed | light | 100.00 | 100.00 | 79.22 | 79.12 |
| wolves | two_handed | medium | 100.00 | 100.00 | 77.40 | 76.19 |
| wolves | two_handed | heavy | 100.00 | 100.00 | 68.45 | 68.30 |
| wolves | hunting_bow | light | 99.00 | 99.00 | 69.51 | 69.62 |
| wolves | hunting_bow | medium | 99.00 | 99.00 | 71.03 | 71.00 |
| wolves | hunting_bow | heavy | 100.00 | 100.00 | 70.05 | 70.31 |
| wolves | crossbow | light | 99.00 | 99.00 | 72.11 | 72.18 |
| wolves | crossbow | medium | 100.00 | 100.00 | 73.54 | 73.76 |
| wolves | crossbow | heavy | 100.00 | 100.00 | 69.88 | 69.20 |
| wolves | dual_wield | light | 100.00 | 100.00 | 67.97 | 69.21 |
| wolves | dual_wield | medium | 100.00 | 100.00 | 68.39 | 68.09 |
| wolves | dual_wield | heavy | 100.00 | 100.00 | 68.99 | 69.05 |
| wolves | javelin_shield | light | 100.00 | 100.00 | 72.55 | 71.27 |
| wolves | javelin_shield | medium | 100.00 | 100.00 | 67.60 | 67.72 |
| wolves | javelin_shield | heavy | 100.00 | 100.00 | 63.97 | 63.20 |
| wolves | colossal | light | 100.00 | 100.00 | 79.26 | 79.31 |
| wolves | colossal | medium | 100.00 | 100.00 | 74.59 | 74.59 |
| wolves | colossal | heavy | 100.00 | 100.00 | 72.67 | 72.49 |
| cultists | daggers | light | 100.00 | 91.00 | 56.14 | 44.81 |
| cultists | daggers | medium | 100.00 | 97.00 | 73.96 | 46.02 |
| cultists | daggers | heavy | 100.00 | 97.00 | 75.70 | 49.92 |
| cultists | shield | light | 100.00 | 98.00 | 75.10 | 50.87 |
| cultists | shield | medium | 100.00 | 96.00 | 78.41 | 54.10 |
| cultists | shield | heavy | 100.00 | 99.00 | 81.04 | 60.40 |
| cultists | polearm | light | 100.00 | 86.00 | 71.91 | 36.95 |
| cultists | polearm | medium | 100.00 | 86.00 | 71.41 | 39.58 |
| cultists | polearm | heavy | 100.00 | 93.00 | 70.98 | 38.71 |
| cultists | two_handed | light | 100.00 | 90.00 | 77.39 | 49.71 |
| cultists | two_handed | medium | 100.00 | 96.00 | 79.03 | 55.81 |
| cultists | two_handed | heavy | 100.00 | 95.00 | 81.79 | 58.87 |
| cultists | hunting_bow | light | 100.00 | 98.00 | 76.52 | 63.23 |
| cultists | hunting_bow | medium | 100.00 | 100.00 | 76.80 | 64.52 |
| cultists | hunting_bow | heavy | 100.00 | 94.00 | 73.38 | 46.93 |
| cultists | crossbow | light | 100.00 | 98.00 | 72.95 | 56.52 |
| cultists | crossbow | medium | 100.00 | 98.00 | 74.90 | 59.78 |
| cultists | crossbow | heavy | 100.00 | 99.00 | 74.85 | 54.47 |
| cultists | dual_wield | light | 100.00 | 91.00 | 69.28 | 42.18 |
| cultists | dual_wield | medium | 100.00 | 97.00 | 73.01 | 48.92 |
| cultists | dual_wield | heavy | 100.00 | 96.00 | 75.79 | 50.79 |
| cultists | javelin_shield | light | 100.00 | 90.00 | 62.21 | 39.86 |
| cultists | javelin_shield | medium | 100.00 | 91.00 | 69.54 | 39.00 |
| cultists | javelin_shield | heavy | 100.00 | 95.00 | 69.75 | 39.83 |
| cultists | colossal | light | 100.00 | 92.00 | 74.61 | 49.44 |
| cultists | colossal | medium | 100.00 | 95.00 | 77.69 | 55.52 |
| cultists | colossal | heavy | 100.00 | 96.00 | 79.85 | 60.66 |
| nephilim | daggers | light | 94.00 | 96.00 | 82.58 | 87.57 |
| nephilim | daggers | medium | 91.00 | 96.00 | 86.61 | 90.34 |
| nephilim | daggers | heavy | 87.00 | 100.00 | 88.71 | 92.25 |
| nephilim | shield | light | 97.00 | 96.00 | 86.46 | 86.20 |
| nephilim | shield | medium | 91.00 | 98.00 | 87.75 | 92.80 |
| nephilim | shield | heavy | 87.00 | 96.00 | 90.43 | 88.84 |
| nephilim | polearm | light | 98.00 | 89.00 | 80.79 | 65.49 |
| nephilim | polearm | medium | 98.00 | 99.00 | 81.99 | 74.84 |
| nephilim | polearm | heavy | 94.00 | 98.00 | 84.63 | 74.81 |
| nephilim | two_handed | light | 98.00 | 96.00 | 83.98 | 72.96 |
| nephilim | two_handed | medium | 98.00 | 99.00 | 88.35 | 77.93 |
| nephilim | two_handed | heavy | 92.00 | 97.00 | 82.85 | 81.64 |
| nephilim | hunting_bow | light | 93.00 | 94.00 | 51.09 | 55.83 |
| nephilim | hunting_bow | medium | 92.00 | 97.00 | 53.96 | 61.22 |
| nephilim | hunting_bow | heavy | 73.00 | 65.00 | 35.30 | 33.13 |
| nephilim | crossbow | light | 100.00 | 98.00 | 88.30 | 75.78 |
| nephilim | crossbow | medium | 99.00 | 97.00 | 94.06 | 73.11 |
| nephilim | crossbow | heavy | 92.00 | 97.00 | 64.33 | 72.98 |
| nephilim | dual_wield | light | 96.00 | 100.00 | 82.84 | 84.36 |
| nephilim | dual_wield | medium | 94.00 | 99.00 | 86.74 | 86.57 |
| nephilim | dual_wield | heavy | 91.00 | 100.00 | 85.48 | 92.02 |
| nephilim | javelin_shield | light | 95.00 | 97.00 | 76.40 | 77.63 |
| nephilim | javelin_shield | medium | 96.00 | 98.00 | 80.51 | 82.39 |
| nephilim | javelin_shield | heavy | 97.00 | 97.00 | 82.56 | 84.08 |
| nephilim | colossal | light | 93.00 | 89.00 | 70.70 | 66.68 |
| nephilim | colossal | medium | 93.00 | 94.00 | 75.63 | 83.69 |
| nephilim | colossal | heavy | 94.00 | 93.00 | 79.04 | 81.16 |

#### novice

| Encounter | Family | Armor | Before win | After win | Before HP | After HP |
|---|---|---|---:|---:|---:|---:|
| wolves | daggers | light | 99.00 | 99.00 | 67.81 | 67.81 |
| wolves | daggers | medium | 100.00 | 100.00 | 73.24 | 73.24 |
| wolves | daggers | heavy | 100.00 | 100.00 | 71.62 | 71.62 |
| wolves | shield | light | 100.00 | 100.00 | 79.22 | 79.22 |
| wolves | shield | medium | 100.00 | 100.00 | 77.41 | 77.41 |
| wolves | shield | heavy | 100.00 | 100.00 | 69.65 | 69.65 |
| wolves | polearm | light | 99.00 | 99.00 | 71.55 | 71.55 |
| wolves | polearm | medium | 100.00 | 100.00 | 73.61 | 73.61 |
| wolves | polearm | heavy | 100.00 | 100.00 | 74.05 | 74.05 |
| wolves | two_handed | light | 100.00 | 100.00 | 77.28 | 77.28 |
| wolves | two_handed | medium | 100.00 | 100.00 | 75.70 | 75.70 |
| wolves | two_handed | heavy | 100.00 | 100.00 | 68.46 | 68.46 |
| wolves | hunting_bow | light | 99.00 | 99.00 | 69.72 | 69.72 |
| wolves | hunting_bow | medium | 99.00 | 99.00 | 70.84 | 70.84 |
| wolves | hunting_bow | heavy | 100.00 | 100.00 | 70.34 | 70.34 |
| wolves | crossbow | light | 100.00 | 100.00 | 70.23 | 70.23 |
| wolves | crossbow | medium | 100.00 | 100.00 | 72.72 | 72.72 |
| wolves | crossbow | heavy | 100.00 | 100.00 | 69.10 | 69.10 |
| wolves | dual_wield | light | 99.00 | 99.00 | 68.43 | 68.43 |
| wolves | dual_wield | medium | 100.00 | 100.00 | 69.98 | 69.98 |
| wolves | dual_wield | heavy | 100.00 | 100.00 | 69.73 | 69.73 |
| wolves | javelin_shield | light | 100.00 | 100.00 | 71.17 | 71.17 |
| wolves | javelin_shield | medium | 100.00 | 100.00 | 66.86 | 66.86 |
| wolves | javelin_shield | heavy | 100.00 | 100.00 | 63.32 | 63.32 |
| wolves | colossal | light | 100.00 | 100.00 | 78.08 | 78.08 |
| wolves | colossal | medium | 100.00 | 100.00 | 74.68 | 74.68 |
| wolves | colossal | heavy | 100.00 | 100.00 | 71.87 | 71.87 |
| cultists | daggers | light | 100.00 | 90.00 | 71.24 | 43.38 |
| cultists | daggers | medium | 100.00 | 98.00 | 73.27 | 46.76 |
| cultists | daggers | heavy | 100.00 | 96.00 | 75.98 | 50.26 |
| cultists | shield | light | 100.00 | 97.00 | 74.47 | 49.23 |
| cultists | shield | medium | 100.00 | 97.00 | 78.72 | 54.29 |
| cultists | shield | heavy | 100.00 | 100.00 | 81.36 | 60.38 |
| cultists | polearm | light | 100.00 | 88.00 | 72.29 | 39.63 |
| cultists | polearm | medium | 100.00 | 92.00 | 71.18 | 41.83 |
| cultists | polearm | heavy | 100.00 | 93.00 | 70.78 | 40.24 |
| cultists | two_handed | light | 100.00 | 88.00 | 77.15 | 50.43 |
| cultists | two_handed | medium | 100.00 | 96.00 | 78.47 | 56.67 |
| cultists | two_handed | heavy | 100.00 | 96.00 | 80.87 | 60.24 |
| cultists | hunting_bow | light | 100.00 | 93.00 | 71.58 | 42.80 |
| cultists | hunting_bow | medium | 100.00 | 96.00 | 71.70 | 43.48 |
| cultists | hunting_bow | heavy | 100.00 | 92.00 | 72.99 | 45.64 |
| cultists | crossbow | light | 100.00 | 97.00 | 74.83 | 52.52 |
| cultists | crossbow | medium | 100.00 | 98.00 | 74.33 | 53.48 |
| cultists | crossbow | heavy | 100.00 | 98.00 | 73.87 | 52.92 |
| cultists | dual_wield | light | 100.00 | 92.00 | 70.06 | 42.56 |
| cultists | dual_wield | medium | 100.00 | 96.00 | 72.15 | 47.45 |
| cultists | dual_wield | heavy | 100.00 | 95.00 | 75.36 | 50.20 |
| cultists | javelin_shield | light | 100.00 | 90.00 | 62.17 | 39.54 |
| cultists | javelin_shield | medium | 100.00 | 87.00 | 68.53 | 39.01 |
| cultists | javelin_shield | heavy | 100.00 | 91.00 | 69.55 | 38.06 |
| cultists | colossal | light | 100.00 | 88.00 | 74.93 | 47.00 |
| cultists | colossal | medium | 100.00 | 94.00 | 77.90 | 54.17 |
| cultists | colossal | heavy | 100.00 | 96.00 | 80.04 | 61.19 |
| nephilim | daggers | light | 44.00 | 73.00 | 33.65 | 32.19 |
| nephilim | daggers | medium | 26.00 | 71.00 | 32.89 | 36.27 |
| nephilim | daggers | heavy | 66.00 | 61.00 | 36.02 | 37.66 |
| nephilim | shield | light | 2.00 | 31.00 | 7.04 | 24.59 |
| nephilim | shield | medium | 39.00 | 35.00 | 30.28 | 20.40 |
| nephilim | shield | heavy | 35.00 | 60.00 | 9.53 | 14.42 |
| nephilim | polearm | light | 0.00 | 28.00 | 2.42 | 22.67 |
| nephilim | polearm | medium | 74.00 | 61.00 | 39.42 | 20.24 |
| nephilim | polearm | heavy | 67.00 | 55.00 | 24.51 | 19.26 |
| nephilim | two_handed | light | 0.00 | 0.00 | 0.00 | 0.00 |
| nephilim | two_handed | medium | 41.00 | 73.00 | 4.98 | 24.87 |
| nephilim | two_handed | heavy | 74.00 | 79.00 | 14.27 | 24.73 |
| nephilim | hunting_bow | light | 71.00 | 48.00 | 20.01 | 13.15 |
| nephilim | hunting_bow | medium | 91.00 | 82.00 | 31.25 | 25.48 |
| nephilim | hunting_bow | heavy | 98.00 | 97.00 | 38.50 | 33.14 |
| nephilim | crossbow | light | 71.00 | 41.00 | 19.04 | 10.62 |
| nephilim | crossbow | medium | 89.00 | 72.00 | 29.88 | 23.13 |
| nephilim | crossbow | heavy | 96.00 | 92.00 | 37.08 | 31.38 |
| nephilim | dual_wield | light | 42.00 | 5.00 | 25.55 | 6.35 |
| nephilim | dual_wield | medium | 62.00 | 24.00 | 8.32 | 9.76 |
| nephilim | dual_wield | heavy | 0.00 | 58.00 | 0.41 | 12.82 |
| nephilim | javelin_shield | light | 28.00 | 24.00 | 12.38 | 8.99 |
| nephilim | javelin_shield | medium | 31.00 | 28.00 | 15.68 | 12.33 |
| nephilim | javelin_shield | heavy | 29.00 | 37.00 | 17.87 | 14.62 |
| nephilim | colossal | light | 0.00 | 0.00 | 2.75 | 0.93 |
| nephilim | colossal | medium | 11.00 | 49.00 | 1.61 | 18.53 |
| nephilim | colossal | heavy | 52.00 | 57.00 | 9.03 | 8.48 |

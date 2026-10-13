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

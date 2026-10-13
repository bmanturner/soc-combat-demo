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

# Enemy AI and party-bot review

Reviewed production baseline `52886f3`, branch `review/ai`. Production files are unchanged. This is a behavioral review, not a balance patch. Canon is Aaron’s Transcriptions; published notes supply encounter intent; the web-app proposal supplies demo choices, not additional canon. Tentative Math was not used as authority.

## Executive assessment

- **No illegal-action fallback, crash, or action-cap stall in 800 default-config battles** (50 seeds × four encounters × four loadouts). This is stronger evidence than the stock sim, which discards its fallback counter.
- Rats and wolves broadly teach their intended lessons. Wolf fear visibly works. Cultists provide meaningful target priority and control, though guardians are offensive pursuers rather than a positional shield wall.
- The boss teaches AP timing but its unconditional sweep priority allows a player-controlled bait to disable the entire ranged-cover lesson. In a legal default-spawn replay, the archer stood exposed at (5,5), fired 14 times, and took **zero damage**; all 12 boss attacks were sweeps. **This particular script still lost to the 1300-AP deadline with 80 boss HP remaining**: it proves ranged threat suppression, not a guaranteed trivial victory.
- The party bot is materially influencing balance measurements: it preempts sweeps so well that **none of 910 resolved sweeps hit a party member**, while 162 party catches occurred from other boss effects. Do not increase sweep damage in response to these bot results; it already does nothing to this policy when avoided.
- Supported tuning settings expose two definite issues: allied damage is positively rewarded with weapon friendly fire enabled, and a zero minimum delay can freeze timeline progress.

## Reproduction and coverage

Run from this worktree (no install required):

```sh
npx tsx tools/probe-ai.ts
npx tsx tools/probe-ai-cases.ts
npx tsx tools/probe-ai-replay.ts
npm run typecheck
npm test
```

Artifacts:
- `tools/probe-ai.ts`: instrumented copy of the sim loop calling unmodified production policies and engine; captures RulesError before performing the same end-turn fallback.
- `tools/probe-ai-results.json`: full counters, all run outcomes and first friendly-fire replay.
- `tools/probe-ai-runs.jsonl`: durable per-battle results (800 unique encounter/loadout/seed combinations).
- `tools/probe-ai-cases.ts`, `tools/probe-ai-cases.json`: deterministic focused counterexamples and their observed results.
- `tools/probe-ai-bait-actions.json`: exact legal action sequence from the real boss spawn.
- `tools/probe-ai-replay.ts`: independently replays recorded actions, verifies counts and outcomes.

Seeds 1–50; Jubal loadouts daggers/light, shield/medium, polearm/heavy, two_handed/light. All granary armor is clothing. Companion gear is unchanged. This is several representative loadouts, **not** the entire weapon×armor cross-product. Stop cap 4000 actions; none reached it. Random seeds are reused across loadouts, not independent human playtest samples. No conclusions about exact human win probability follow.

### Measurement definitions and limitations

“Turns” means emitted turnEnd events; a victory-producing action may not emit turnEnd, so attack counts can exceed turn counts. “No attack/skill” includes useful movement-only, fear, cooldown, and AP-saving turns; it is not synonymous with broken idle. AP spent includes active-turn reactions; delay includes minimum wait. Target counts are previewed affected enemies, including multiple targets and telegraphs, not solely the chosen anchor. Zero/low chance means target landChance = 0 / ≤20%; AoE previews use 100% and do not predict escape.

Unsafe move counts evaluate the **actual resulting tile**, known effects, and current AP if ending now. Unsafe ends reevaluate using the final turn delay. These exclude later-created effects and later enemy pushback; a unit may be caught despite zero unsafe ends. They also do not attribute movement interruption versus deliberate risk-taking. Catch/escape counters are the engine’s per-effect telemetry; `caught/(caught+escapes)` is a useful event ratio, **not** a probability conditioned on being initially threatened (units can enter effects after cast).

Engaged/flanked percentages are AP-weighted snapshots after each engine call, summed over living units. They are descriptive estimates: an endTurn call can resolve effects/deaths while advancing, so this is not an exact continuous-time integral. Screening samples are Seer turn starts: “screen engaged” means a living zealot is adjacent to a party member; “Seer exposed” means a party member is adjacent to the Seer. This proxy measures contact, not a guaranteed path-blocking wall.

## Measured behavior

| Group | Ended turns | No attack/skill | Mean AP spent / delay | Unsafe moves / moves | Unsafe ends | Caught / escapes | Engaged / flanked AP% |
|---|---:|---:|---:|---:|---:|---:|---:|
| granary/bot | 520 | 0 (0.0%) | 107.3 / 107.3 | 0 / 254 | 0 | 0 / 0 | 85.4 / 33.9 |
| granary/swarm | 1116 | 0 (0.0%) | 90.9 / 90.9 | 0 / 534 | 0 | 0 / 0 | 78.9 / 0.0 |
| wolves/bot | 1577 | 490 (31.1%) | 96.0 / 96.0 | 0 / 1238 | 0 | 0 / 0 | 56.2 / 0.1 |
| wolves/charger | 1623 | 426 (26.2%) | 90.3 / 90.8 | 0 / 1307 | 0 | 0 / 0 | 63.1 / 0.0 |
| cultists/bot | 1791 | 85 (4.7%) | 116.5 / 116.6 | 3 / 1299 | 2 | 68 / 162 | 65.9 / 0.3 |
| cultists/guardian | 1930 | 32 (1.7%) | 81.8 / 81.9 | 0 / 651 | 1 | 5 / 13 | 85.4 / 0.8 |
| cultists/caster | 768 | 209 (27.2%) | 88.0 / 93.0 | 0 / 255 | 0 | 0 / 0 | 11.8 / 0.2 |
| nephilim/bot | 6286 | 1869 (29.7%) | 95.3 / 95.8 | 0 / 5067 | 0 | 162 / 1554 | 17.2 / 0.0 |
| nephilim/nephilim | 1893 | 0 (0.0%) | 100.0 / 100.0 | 0 / 0 | 0 | 0 / 0 | 40.7 / 0.0 |

Every group: **0 RulesErrors, 0 zero-land-chance targets, 0 ≤20%-land-chance targets**. No default weapon-friendly-fire damage. Seer delayed friendly damage: **250 across five zealot hits**; all other source groups zero. Cultist party catch/escape ratio 29.6%; boss party ratio 9.4%. Zero sweep hits among 910 resolved sweeps; 95 additional sweep casts had not resolved before battle completion.

### Targets and action mix

| Brain | Attack/skill declarations | Preview target distribution | Skills |
|---|---:|---|---|
| Rat swarm | 1117 | Jubal 1117 | none |
| Wolf charger | 1197 | Jubal 396; Jabal 801 | none |
| Zealot guardian | 1925 | Jubal 809; Jabal 1282 | none |
| Seer caster | 562 | Jubal 266; Jabal 374 | Hellfire 179; Daze Bolt 380; remaining 3 basic attacks |
| Nephilim | 1893 | Jubal 1010; Jabal 566; archer 644 | Sweep 1005 (53.1%); Rockfall 619 (32.7%); Rock Throw 269 (14.2%); idle 0 |

Wolf attacks never chose a strictly more distant target at the moment of attack in this sample. That does not establish strict closest-body pursuit: the focus is only a scoring multiplier and can be overridden by expected damage or a kill.

Wolf fear: **406 completed feared turns**, 389 moved (95.8%), 383 increased distance to the nearest surviving foe (94.3%). Failure to increase distance can follow engagement or no improving endpoint, rather than a missing fear trigger. Fleeing is one turn and survivors resume normal pursuit; there is no explicit group-rally formation.

Seer screening: 628/773 sampled starts (81.2%) had a zealot contacting a party member; 151/773 (19.5%) had the Seer adjacent to a party member. The two can overlap. This supports “pin you down” more than “maintain a shield wall.”

Party bot skills (yes, it uses them): granary overhead_smash 86; wolves throwing_knife 50, heavy_daze 189, overhead_smash 59; cultists throwing_knife 92, heavy_daze 344, overhead_smash 108; boss throwing_knife 147, aimed_shot 798, heavy_daze 618, overhead_smash 122. No shield/hook skills selected in these runs; legality and skill availability were not inferred from non-use.

### Outcomes (50 seeds per row; HP includes losses)

| Encounter | Weapon / armor | Wins | Mean party HP left |
|---|---|---:|---:|
| Granary | daggers / clothing | 50/50 | 83.2% |
| Granary | shield / clothing | 50/50 | 74.8% |
| Granary | polearm / clothing | 49/50 | 81.5% |
| Granary | two_handed / clothing | 50/50 | 61.2% |
| Wolves | daggers / light | 50/50 | 70.7% |
| Wolves | shield / medium | 50/50 | 75.1% |
| Wolves | polearm / heavy | 50/50 | 74.4% |
| Wolves | two_handed / light | 50/50 | 73.7% |
| Cultists | daggers / light | 29/50 | 17.4% |
| Cultists | shield / medium | 47/50 | 42.5% |
| Cultists | polearm / heavy | 49/50 | 50.3% |
| Cultists | two_handed / light | 44/50 | 48.1% |
| Nephilim | daggers / light | 50/50 | 95.6% |
| Nephilim | shield / medium | 49/50 | 75.4% |
| Nephilim | polearm / heavy | 39/50 | 64.2% |
| Nephilim | two_handed / light | 49/50 | 60.6% |

## Intent mapping (all brains)

### Swarm / granary
Canon, Aaron’s Transcriptions:59: “low-pressure and straightforward — no big deal, just enough to teach how basic attacks work.” `encounters.ts:10`: “Weapon patterns. Every starter has a different shape, so position before you swing.”

`ai.ts:299–302` routes rats through shared meleeBrute. It searches legal attack positions, values expected damage and kills, approaches adjacent goals, and avoids imminent effects. There is no unique swarm coordination, summoning, or flanking policy. That is appropriate for these three ordinary tutorial rats: the published brood-mother idea is a different encounter, not a missing requirement here. Strong consistency overall, but one polearm loss and 61.2% average two-handed HP deserve human tutorial testing. The bot uses Overhead Smash in the supposedly basic-attack tutorial; available skills come from `engine.ts:70–97`, not AI progression gating. Consider a basic-attacks-only tutorial bot mode before changing rat stats.

### Charger / wolves
Canon, transcription:895–896 and published Enemies:21,27: “charge directly at the closest enemy and attack”; survivors “become feared for one turn, run away, then return and regroup.” Encounter lesson explicitly promises the scatter.

`ai.ts:45–57,153–178` picks nearest by Chebyshev footprint distance with lower-HP tie break, but scores all options with only a 1.6 focus multiplier (`87–94`). It can maneuver for a better damage opportunity rather than strictly charging closest; distanceField routes around terrain but ignores bodies. `engine.ts:453–460` sets fear; `ai.ts:140–155` maximizes nearest-enemy distance; `engine.ts:266` clears fear after the turn. Scatter works well in measurement. There is no rally point or pack reassembly, just independently resuming pursuit. These are small interpretation differences rather than measured lesson failure.

### Guardian / zealots
Published Enemies:48: “mages with basic crowd control and light-armored fighters in the front line.” `units.ts:23` strengthens this to “Shield wall for the caster”; encounter lesson (`77`) says zealots pin you while Seer dazes/brands.

`ai.ts:193–199,297–298` only selects the foe closest to the Seer, then runs generic melee scoring. No guard radius, intercept tile, chokepoint occupancy, reservation, or coordination exists. High engagement occupancy supports pinning, but contact does not mean protecting a path to the mage. Recommendation rather than a claim that all screening is broken: give one zealot a near-Seer guard role and allow the other to pursue. See A-06.

### Caster / Seer
Published Enemies:48 supports crowd control; the specific Daze Bolt + Hellfire combination is demo content. Encounter lesson (`77`) explicitly promises both. `ai.ts:201–267` searches every valid sigil center, values present foes 3 and allies -2, requires multiple foes / a dazed foe / only one foe remaining; otherwise bolts a not-dazed, low-HP target, retreats, or uses staff.

Observed 179 sigils and 380 bolts demonstrate both roles. Deviations: sigil placement is occupancy-based, not scheduled-turn/escape-based, so it can brand easily vacated tiles; caster self-danger is not checked before casting; fallback movement only seeks a firing tile reachable **this turn**, not a multi-turn route. It has no general pursuit fallback (A-03). Friendly sigil damage is intentional: config commentary (`config.ts:153`) explicitly allows shoving cultists into their own sigils. Treat five ally hits as a tactical feature, not proof of a bug.

### Nephilim
Canon transcription:923–936 / published Enemies:70–92: boss teaches telegraphs, melee should avoid overspending AP, ranged units “need to step out, fire, and return behind cover,” and delayed cover AoE “forces ranged characters to eventually abandon cover and reposition.” Encounter lesson (`112`) repeats all three.

`ai.ts:270–285` is a strict priority tree: any foe in sweep zone → Sweep; else any ranged foe with hidden counter at threshold → Rockfall; else exposed foe (ranged preferred) → Rock Throw; else wait. It does not move. Counter is sampled by `engine.ts:233–239` at boss turn starts; it tracks consecutive unseen turns, **not the same cover object/tile**. Relocating between different covers without becoming visible still increments it. Proposal §5.1 listed exposed ranged throw before cover AoE; implementation reverses those two, a demo-policy difference rather than a canon violation.

Readable and highly learnable; no hidden future intent or RNG inspection. However sweep-first can indefinitely starve both ranged attacks (A-01). The time-to-break-free supplies a real pressure check and prevented the passive bait script from winning. Baseline dagger bot nevertheless wins 50/50 with 95.6% party HP, so boss lethality against errors and challenge against optimized scheduling are different things.

### Party bot
`ai.ts:324–404` searches attack position + retreat endpoint, scores damage/tempo/safety, then replans after every action. It uses skills, weak-target focus, known delayed effects, and a predicted next boss sweep. It neither reads queued human inputs nor future RNG. Predicting deterministic sweep timing is legitimate expert knowledge, but far stronger than a first-time learner. Its retreat is not committed; it recomputes from actual state. Its “cover within reach that keeps a shot available” comment overstates `379–387`, which scores danger/range but does not require LoS or a future shot.

It ignores path-risk probabilities despite reachable providing them, and ignores movement-induced bow surcharges in hypothetical plans (see query notes). Unconditional +18 Daze value (`111`) is not multiplied by landing chance or reduced for an already-dazed foe; likewise shove/hook +6 does not establish useful displacement. These are tuning blind spots, not measured zero-chance spam in the defaults.

## Findings

### A-01 — P1 — Sweep priority disables the ranged-cover lesson
**Verified: true.** `ai.ts:275–279`. Canon/published quote: ranged characters must “step out, fire, and return behind cover”; cover AoE forces relocation.

**Evidence/repro:** `probe-ai-cases.ts` uses the real nephilim encounter, defaults, seed 2. Jubal moves from the default spawn to (4,4), waits until a sweep is pending, steps to (4,5), and re-enters after resolution. Jabal uses botAction. Archer moves to (5,5) and shoots/aims without returning to cover. All **12 boss actions are sweeps**, archer fires **14 times**, remains fully exposed and takes **0 damage** through AP 1300. Replay artifact records every action. Result is defeat, boss 80 HP: do not label it a universal win exploit.

**Fix:** Preserve readable sweep triggers but do not let one threat permanently suppress another. For example track `lastRangedPressureAt`; when overdue and ranged foe exposed/camping, explicitly telegraph an upcoming ranged-pressure phase, then resolve that phase independently of the next sweep choice. Alternatively bounded sweep streak + visible intent. Do not secretly choose a different action after the player commits based on hidden plans. **Expected impact:** restores cover movement and reduces bait safety; likely lowers boss win rates, magnitude unmeasured. Rebalance deadline/damage only after measuring the new policy.

### A-02 — P1 — Friendly-fire setting makes the bot seek allied damage
**Verified: true.** `ai.ts:87–94`, `queries.ts:169–172,192–195`. Demo friendly-fire setting exists at `config.ts:152`; no canon requirement says bots should attack allies.

**Evidence/repro:** focused open-7×7 fixture, Jubal two-handed at (1,1), Jabal at (2,1), wolf at (6,6), `friendlyFire:true`. botAction immediately attacks (2,1), an ally-only pattern, rather than approaching the wolf. The seed-1 attack was avoided (Jabal stays 162/162), but the ally-only attack declaration is verified. This is shared scoring, so enemy AoE users can also reward friendly damage. Defaults hide this because weapon friendlyFire is false.

**Fix:** signed target utility: `enemy expected damage + enemy kill value - ally expected damage * allyPenalty - ally KO penalty`; prohibit ally-only attacks unless an explicitly modeled beneficial mechanic exists. **Expected impact:** eliminates tuning-mode self-sabotage, minimal default win-rate impact.

### A-03 — P2 — Seer cannot navigate toward firing positions beyond one movement budget
**Verified: true (fixture); default-map exploit not established.** `ai.ts:237–267`. Published intent: mage crowd control; encounter lesson requires the Seer to daze/brand rather than silently wait.

**Evidence/repro:** fixture has 7×15 walkable terrain with a central x=3 wall from y=1–13 and routes around its ends. Seer (5,7), stationary Jubal (1,9), Jabal (1,5); nobody is in the same 3×3 sigil. No valid shooting tile lies within one movement budget. Over 60 legal actions the Seer ends **20 turns with no action**, clock advances to 500, Jubal remains 120 HP. It never progresses toward either wall end, despite a traversable route. Shorter walls do not reproduce because it can obtain LoS in a single turn.

**Fix:** if no current or reachable firing tile exists, build a distance field from valid range+LoS firing tiles and take a safe reducing step; remember a target/waypoint for a turn to avoid switching goals. **Expected impact:** removes terrain dead zones in future maps, little evidence for a default encounter win-rate change.

### A-04 — P0 — Allowed zero Wait delay can starve every enemy and effect
**Verified: true; engine/config issue, not a default AI failure.** `config.ts:130` permits minTurnDelay=0; `engine.ts:253–254` schedules a zero-spend unit at its existing start time. Canon Combat System:19 requires AP cost to determine when the next turn begins; the demo minimum exists to avoid looping.

**Evidence/repro:** `probe-ai-cases.ts` supplies zero minimum delay and repeats 50 legal endTurn actions from AP 0. Clock stays **0**, Jubal remains active, wolf never reaches initiative 15. Map disconnection is irrelevant to the scheduling bug. The UI tuning surface permits this setting; a bot returning idle at such a state can do the same.

**Fix:** clamp minimum turn progression above zero or give zero-spend Wait an explicit scheduling rule that advances beyond current time; add a non-progress watchdog to bot/sim loops. **Expected impact:** no default balance change; prevents configurable hard stalls.

### A-05 — P2 — Balance simulator silently discards illegal-action diagnostics
**Verified: true by code; zero occurrences measured in defaults.** `sim.ts:32–38,56` catches RulesError, increments `stuck`, then spreads an empty object regardless of its value. Probe duplicates the fallback but retains errors.

**Evidence:** 800 battles report zero, so no present default illegal-action loop is alleged. Yet a future invalid AI choice becomes an apparently normal idle turn and contaminates win-rate results. This is especially important when tuning rule settings beyond the default matrix.

**Fix:** return `illegalActions`, messages, action/state identifiers; fail strict review/CI runs on any fallback, and separately classify same-clock stalls. **Expected impact:** no combat behavior change, materially more trustworthy balancing.

### A-06 — P2 — “Shield wall” is target preference, not positioning behavior
**Verified: true for implementation/measurement; not a proof every screen fails.** `units.ts:23`, `ai.ts:193–199,297–298`. Quote: “Shield wall for the caster”; encounter: “Zealots pin you down.”

**Evidence:** Seer closest-foe selection is the only guardian specialization. 628/773 Seer starts have guard contact but 151/773 have melee contact on Seer. Guardians have no maximum pursuit distance or protected firing corridor, and can follow a lure away from the caster. No deterministic full-encounter lure victory was established; keep severity minor.

**Fix:** split guard/interceptor roles; score tiles for party-to-Seer approach interception plus engagement, with a tether penalty and distinct tile reservations. Allow abandoning guard after caster dies. **Expected impact:** makes target-priority puzzle more explicit and may lower cultist wins; avoid simply making already-weak daggers/light harsher without compensating tuning.

## Cheese hunt and counterevidence

- **Stand-still boss safe spot:** (5,5) is safe under the verified bait policy, not intrinsically unreachable by Rock Throw. Explicitly distinguish the policy exploit from a terrain immunity tile. The script tests default Wait=25 scheduling, not altered speed.
- **Wait 25 abuse:** waiting and instant movement genuinely allow bait-and-escape, but waiting does not pause the break-free clock. Both early exploratory bait variants and the final script lose at AP 1300; do not claim AP hoarding alone guarantees victory. Wait=0 is the separate verified stall.
- **Lure/shove cultists into their own sigil:** real default run cultists/daggers/light seed 6, exact 56-action recorded prefix, resolves Hellfire into zealot1 for **50 damage**, leaving 6 HP, with no party victim in that resolution. Independent replay verifies it. This is achieved by normal legal movement/combat; the supplied trace demonstrates friendly hazard exploitation, not a purpose-built optimal lure strategy. It is explicitly intended by config.ts:153 and should be retained.
- **Unreachable/corner spots:** Seer wall-detour dead zone is verified in a fixture. No default-map permanently unreachable enemy, infinite oscillation, or corner trap was established in the 800-run set. The probes are not an exhaustive adversarial state-space search; absence of observed stalls does not prove none exist.
- **Wolves kiting:** faster pursuit and actual engagement/fear recovery worked in the sample. No endless default wolf orbit was found. Fear can be interrupted by engagement; that is consistent with movement rules rather than the fear flag being ignored.
- **Omniscience:** neither enemyAction nor botAction reads hidden future actions/RNG. Full board knowledge, publicly visible unit nextTurnAt, and deterministic boss anticipation are used. The Seer can brand behind walls because sigil targeting lacks LoS requirements; that is a targeting/content rule, not evidence of AI cheating.

## Engine/query notes for the engine reviewer

1. Zero-delay starvation: A-04.
2. Hypothetical movement does not change preview bow cost: `previewAttack(...from)` still calls basicAttackApCost using current active.moved (`queries.ts:159–173`); previewSkill similarly uses current moved (`200–211`). Bot planned retreat also omits surchargePending in `projected` (`ai.ts:60–63`). Engine does charge +50 after moving (`engine.ts:341–345`). Thus candidate planning can underprice shoot-and-retreat, even though actual re-evaluation often recovers. No focused lethal default repro asserted here.
3. Hypothetical attack preview moves the attacker object but not state.units when checking flank status (`queries.ts:166–171,118–122`); candidate flank utility can describe the old position. Shared scoring should evaluate a coherent hypothetical board.
4. Delayed effects always exempt their source (`engine.ts:596`), whereas tileDanger only excludes same-side effects when delayedHitsAllies=false (`ai.ts:73–75`). Thus the Seer can fear its own sigil despite engine immunity. “Burns cultists too” currently means other cultists, not caster. Clarify intended self-hit semantics before tuning.
5. `guardianFocus` uses nearest-to-Seer distance, not route length; generic approach fields ignore bodies. Not an illegal path bug—reachable validates final movement—but it can reject useful temporary detours.

## Prioritized implementation recommendations (not implemented)

1. Add strict sim diagnostics and the zero-delay guard first; prevent invisible balancing regressions.
2. Add bounded/telegraphed boss ranged-pressure phases; retain the AP escape model: a unit must get a turn before impact (or tie under the configured tie rule) and have enough movement reach, **not** subtract movement AP from impact as elapsed travel time.
3. Correct signed friendly-fire utility and coherent hypothetical cost/state. Multiply status value by landChance and marginal status gain. Include expected interruption cost from Reach.risks, without making default boss escapes probabilistic while bossesEngage=false.
4. Add caster multi-turn approach, then optional guardian tether/interception. Preserve the intended self-sigil displacement tactic.
5. Run separate party policies: basic-attack beginner, reactive-to-existing-telegraphs, current predictive expert, and the fixed bait script. Report win/HP/catch/action-mix by policy. Especially investigate granary polearm seed loss and cultist dagger disparity before stronger enemy AI.

Expected directional balance changes above are hypotheses, not fabricated post-fix measurements. No production patch was applied. Verification completed: production typecheck passed; existing test suite **44/44 tests across 4 files** passed. Focused script assertions and recorded replays are the acceptance evidence for behavioral findings.

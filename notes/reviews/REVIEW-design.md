# Design-adherence review

Reviewed baseline `52886f3` in branch `review/design`. Review only: production code and design vault unchanged. Scope is combat, characters, encounters, provenance, and golden-test coverage; detailed per-weapon numbers/pattern auditing belongs to the parallel weapon reviewer.

## Authority and interpretation

- **T** = `Aaron’s Transcriptions.md` (canonical; read all combat/character/encounter sections).
- **C**, **E**, **P**, **CH**, **W**, **O** = `Publish/Combat System.md`, `Enemies and Encounters.md`, `Prototype Scope.md`, `Characters.md`, `Weapons.md`, `Open Questions.md`.
- **D03**, **D05**, **D09**, **D10** = corresponding numbered files in `Drafts/`.
- **TM** = `Publish/Tentative Math.md`; **SIM** = `Simulations/act_one_balance_sim.py`. TM and SIM are proposals, not Aaron's canon.
- Source priority: T > non-tentative Publish > D03/D05/D09 > tentative proposals > demo defaults. D10 defines the narrower sandbox scope, not new canon. Brendan explicitly approved four independent encounters and tunable demo choices for unresolved rules.
- A missing full-game system is recorded below, but not automatically a sandbox defect. In particular, no demand to add the story campaign, all enemies, all status families, or skill trees.
- `verified: true` below means an executed probe demonstrates the finding. Static-only findings are deliberately `false`, even where the source evidence is conclusive.

## Execution evidence

Before adding probes: `npx vitest run && npx tsc --noEmit -p tsconfig.json && npx eslint .` exited 0: **4 files, 44 tests passed**, typecheck and lint passed.

Review probes are in `src/rules/review-design.test.ts`. They intentionally assert the design requirement and remain failing; do not mistake this review branch for a production-fix branch. The original tests are unchanged. Probe command: `npx vitest run src/rules/review-design.test.ts`. Individual repro: append `-t D-01` etc. A passing reaction-control probe confirms ranged non-parry, highest-first block, and 35 AP pushback. Final execution results are recorded at the end.

## Findings

### D-01 — P0 — Minimum Wait delay also taxes nonempty turns
- **Code:** `src/rules/engine.ts:248–254`, `src/rules/queries.ts:277–283`; `src/rules/config.ts:130` explains only an empty turn: `Ending a turn having spent nothing still costs 25 AP`.
- **Exact source:** T:137: “The total number of action points spent on movement and combat actions combined determines the cooldown before that character’s next turn begins.” C:19: “The total AP spent determines how long it takes before that character’s next turn begins.”
- **Observed:** moving one light-armor tile spends 10 AP but sets delay 25. Short reposition/wait tactics lose the source's armor/tempo advantage; 10, 12.5 and 15 AP single steps all return at 25. The exposed minimum-delay name could support a deliberate variant, but its rationale and the promise of exact AP-spent timing do not disclose that variant.
- **Repro:** D-01 probe: `{spent:10, delay:25}` instead of `{spent:10, delay:10}`.
- **Fix:** charge the Wait price only when nothing was spent; alternatively expose a separately named nonempty-turn floor with explicit demo provenance and retain exact AP timing as the source mode. **verified: true**.

### D-02 — P0 — Delayed effects bypass Flanked's damage increase
- **Code:** `src/rules/engine.ts:415–418` applies Flanked to strikes; `:591–600` resolves delayed damage without it.
- **Exact source:** T:886: “Flanked also causes the character to take increased damage and have reduced **block**, **parry**, and **dodge** until the status effect is gone.” C:185 gives the same unqualified damage rule.
- **Observed:** a flanked target with 0 MR takes 40 from a 40-raw magic effect, not 50 with the configured +25%. The same omission affects rockfall/sweep damage when their targets are flanked.
- **Repro:** D-02 probe checks an actual N/S flank, casts, advances the scheduler, and measures HP loss.
- **Fix:** share final-damage modifiers between immediate strikes and effects; do not silently exempt delayed damage. **verified: true**.

### D-03 — P1 — Escape advice checks time but not reachability
- **Code:** `src/rules/queries.ts:293–300`; `src/hud/Incoming.tsx:31–38,52–61`; `src/hud/Screens.tsx:329` says “If your next turn comes before impact, you can walk out.”
- **Exact source:** D10:168–169: “**escape margin = impact time − your next-turn time.** If it's greater than 0, you get to act before impact.” AND “**reachability:** the tiles to safety must fit in one turn's movement (5 / 4 / 3 for light / medium / heavy), less any engagement penalty.” This is the explicit correction endorsed by Brendan.
- **Observed:** `dangerAt.safe` is true for a heavy unit returning in 25 AP before a 30 AP impact even when every tile within its next full movement budget is threatened. The HUD promotes that timing-only result to “can still escape.” Engagement risk and blocked escape routes are likewise omitted. Core movement itself is instant and correct; this is an incorrect safety claim, not the old continuous-time engine model.
- **Repro:** D-03 probe establishes that the entire reachable set is covered, then gets `safe:true`.
- **Fix:** distinguish “acts before impact” from “can reach safety”; evaluate next-turn safe reachable tiles and disclose probabilistic disengagement. Update help accordingly. **verified: true** (query demonstrated; UI wording statically traced).

### D-04 — P1 — “Delayed AoEs hit everyone” silently excludes the caster
- **Code:** `src/rules/engine.ts:595–597` always skips `source.id` before consulting `delayedHitsAllies`; `src/content/gear.ts:98` promises “burns everyone inside, cultists included.”
- **Exact source:** D10:133: “Patterns skip allies; delayed AoEs hit everyone”. This is a promised demo default, not a claim that Aaron defined friendly fire.
- **Observed:** a Seer standing in its own delayed area takes no damage with `delayedHitsAllies:true`; other cultists are hit. The setting has no self-hit exemption label or alternative.
- **Repro:** D-04 probe advances an effect covering its caster: HP remains 90/90.
- **Fix:** include the source in the same friendly-fire policy, or expose and label a separate caster-immunity demo option and amend descriptions. **verified: true**.

### D-05 — P1 — Wolves optimize damage instead of attacking the closest enemy
- **Code:** `src/rules/ai.ts:87–93,153–176,299–302`. The nearest foe is only a score multiplier; options still include every opponent.
- **Exact source:** T:895: “Very simple AI: charge directly at the closest enemy and attack.” E:21: “Wolves use simple AI: charge directly at the closest enemy and attack.” `src/content/encounters.ts:43` repeats that promise.
- **Observed:** a wolf next to a healthy heavy-armored Jubal moves away and attacks a farther, low-HP Jabal. This defeats the simple closest-body manipulation lesson. The smarter behavior has no selectable provenance-bearing variant.
- **Repro:** D-05 probe starts wolf (3,3), Jubal (3,2), Jabal (6,3); after its move the chosen attack targets (6,3), not (3,2).
- **Fix:** restrict charger target selection to nearest foe, using pathfinding only to reach it; expose tactical target optimization separately if desired. **verified: true**.

### D-06 — P2 — Exhausted turns do not end automatically
- **Code:** `src/rules/engine.ts:151–170,475–489`; `src/game/controller.ts:128–136` returns control to the player regardless of exhausted action/movement.
- **Exact source:** T:173: “The turn does not end until the player decides to end the turn or runs out of actions completely.” D03:34: “The unit's turn ends when the actor ends it or has no remaining legal action.”
- **Observed:** spend all 50 movement AP and attack; no `turnEnd` event is produced and manual End Turn is still needed.
- **Repro:** D-06 probe leaves an ongoing fight with no movement or combat action remaining.
- **Fix:** auto-end when both resources are exhausted, or explicitly label manual-only ending as a demo setting. **verified: true**.

### D-07 — P1 — The sandbox cannot tune many unresolved rules and numbers
- **Code:** registry `src/rules/config.ts:127–184`; fixed values in `src/content/gear.ts:5–11,16–98`, `src/content/units.ts:6–28`, `src/rules/engine.ts:93,366,418`, `src/rules/state.ts:67–74`, `src/rules/targeting.ts:49–55,99–105`.
- **Exact source:** D10:23: “Every unresolved rule becomes a visible, tunable setting”; D10:123: “Weapon damage, unit HP/Armor, enemy numbers” / “Imported as defaults, all tunable”; D09:44–45: “Every combat-relevant number should have an owner and status.” / “Prototype values should be easy to change without code edits.”
- **Observed by inspection:** 47 registered settings exist, but no per-unit HP/Armor/MR, armor MR/dodge/E/D, weapon base hit or E/D, individual skill AP/cooldown/damage, companion curves, or initiative controls. Global multipliers cannot express these changes. Further hardwired choices include hit floor/ceiling 5%/95%, damage rounding/minimum, diagonal engagement, passage through allies, per-engager check timing, massive flank immunity, dodge succeeding without displacement, automatic reactions, Dazed disabling reactions, cover blocking all sight/movement, sweep width/anchor, and rockfall shape.
- **D10 §7 missing alternatives:** summed engagement, reaction opt-in/automatic, blocked dodge behavior, check timing, knockout policy; §5.1's 3×2 rockfall is instead a clipped 3×3 square. These may be good demo choices, but are not tunable or individually attributed as promised.
- **Fix:** register the unresolved in-scope parameters with `why` and value-level provenance; expose content overrides in the shareable ruleset. Do not invent mandatory values. **verified: false** (static inventory; registry enumeration executed, behavior variants not exercised).

### D-08 — P2 — Content provenance disappears in player-facing data; source skill tags cover invented details
- **Code:** `src/content/gear.ts:90,95–97`, `src/content/units.ts:6–28`, `src/content/encounters.ts:66–68,101–103`; `src/hud/Screens.tsx:65–86`; `src/hud/ActionPanel.tsx:108` adds a placeholder notice only when `def.status==='demo'`.
- **Exact source:** CH:38: “A working example is a heavy daze attack.” O:24: “What exact skill kit should Jabal have beyond the current standard-fighter / heavy-daze starting concept?” D09:43: “Keep source-backed rules separate from tentative numeric tuning.” P:111: “Exact starting stats, detailed starting skill loadout, full enemy numbers, and detailed encounter-by-encounter scripting are not yet defined.”
- **Observed:** Heavy Daze is `status:'source'` for an entire record containing invented AP 125, cooldown 300, damage multiplier and reaction suppression. Source boss attack concepts similarly carry invented range/shape/numbers in source-tagged records. Weapon-selection damage/hit, armor dodge, enemy names (Seer/Zealot and named wolves), enemy stats, and companion curves have no visible per-value tentative/demo labels; most unit numbers have no metadata at all. This is missing disclosure, not evidence Aaron forbids those names. There is no explicit “canon” badge on the names, so do not characterize them as an affirmative canon claim.
- **Fix:** split concept provenance from numeric/mechanical provenance; visibly identify authored demo names and tunings. Keep correct source concepts intact. **verified: false** (static rendering/data trace).

### D-09 — P2 — D10's golden-test checklist is not fully represented
- **Code:** `src/rules/engine.test.ts:91–103,172–179`, `src/rules/patterns.test.ts:10–28`, `src/rules/formulas.test.ts:7–68`; no crossbow definition in `src/content/gear.ts:16–81` or weapon family in `src/rules/types.ts:42`.
- **Exact source:** D10:218: “Every worked example in the design docs becomes a test”; :227: “Bow: 75 if stationary, 125 if moved. Crossbow cadence: fire 50, reload 50 (data only)”; :230: “Flanked triggers on N+S or E+W melee enemies only”.
- **Observed:** crossbow cadence/data golden is absent. Flank test checks N/S and diagonal toggle, but not E/W or that ranged opponents do not flank. Scheduler has numeric tests, but not a direct `timelineEntries`/bar-slide assertion. These are coverage gaps, not proof those implemented behaviors are wrong.
- **Fix:** add explicit data-only crossbow golden despite gameplay deferral, E/W and ranged-negative flank cases, and a projection/slide assertion. Full audit below. **verified: false** (test-source audit; existing suite passed).

### D-10 — P2 — Source weapon-swapping mechanic is absent, without an explicit sandbox deferral
- **Code:** `src/rules/types.ts:139,221–224,264–268`; `src/rules/engine.ts:151–164`. Only one weapon and no swap action/reserve slot/AP knob exist.
- **Exact source:** T:355: “Every character can carry **two weapons at a time**.” T:368: “Weapon swapping counts as the character’s combat action for the turn.” W:154: “A character who swaps weapons must wait until a later turn to use an ability from the newly equipped weapon.”
- **Observed:** AP-costed role switching cannot be tested. D10 narrows the weapon set and excludes inventory, but does not explicitly resolve this cross-cutting combat mechanic; therefore this is a documented scope/traceability omission, not a claim that the sandbox must implement the entire inventory system.
- **Fix:** explicitly defer in the sandbox's scope/provenance text, or add a second loadout and a whole-action swap with configurable demo AP cost; update skills/passives only for the wielded weapon. **verified: false**.

### D-11 — P1 — Skills cannot explicitly declare permitted reactions
- **Code:** `src/rules/types.ts:73–94` has no reaction-policy field; `src/rules/engine.ts:376–381,510,519,591–600` derives all shot reactions from kind and bypasses every reaction for delayed effects. `StrikeOpts.noReactions` exists but skill definitions cannot use it.
- **Exact source:** T:1007: “Area-of-effect attacks, spells, and skills may sometimes be dodged, blocked, or parried, but this is ability-specific. Each spell or skill should explicitly define which defensive reactions are allowed against it.” D09:245 explicitly lists `allowed_reactions`.
- **Observed:** all shot skills allow dodge/block, all immediate melee skills allow parry, all delayed skills allow none, without ability-specific data or a tunable choice. Current ranged non-parry is correct, but there is no way to author the source-required exceptions for spells/skills or disclose delayed no-reaction policy.
- **Fix:** add explicit allowed-reaction metadata and use the same declared policy in resolution and previews; retain the ranged-parry prohibition. **verified: false** (static schema/dispatch trace).

### D-12 — P1 — Boss target/cover policy differs from the specified lesson without a setting
- **Code:** `src/rules/ai.ts:278–284`, `src/rules/engine.ts:233–239`; the hiding memory stores only `hidden:<unit>` counts, not cover identity.
- **Exact source:** E:84: “The boss targets ranged characters by throwing rocks from the debris pile around him.” E:90: “This prevents ranged characters from solving the fight by repeatedly stepping one tile out, firing, then stepping back behind the same cover.” D10:103: “a ranged unit has stayed behind the same cover for 2 boss turns”.
- **Observed:** rock throw merely prioritizes ranged units and falls back to exposed melee units; cover-camping counts all occluded positions, including walls or different cover. Moving to new cover therefore does not reset the counter if still hidden at the next boss turn. Rockfall is evaluated before exposed-rock-throw, reversing D10's proposed priority. These may improve challenge, but need explicit demo variants rather than silently replacing the stated ranged/same-cover behavior.
- **Fix:** expose target fallback and priority settings; track cover identity or define/document a different occlusion-pressure rule. **verified: false** (static dispatch and memory trace).

### D-13 — P0 — Zero damage still removes HP
- **Code:** `src/rules/engine.ts:418,599` unconditionally applies `Math.max(1, Math.round(dmg))`; settings `src/rules/config.ts:174,176` allow rock throw/rockfall damage 0.
- **Exact source:** C:105: “true damage taken = raw incoming damage × 100 / (100 + Armor or Magic Resist)”. D10:117 marks that formula “Exact”. Zero raw times this factor is zero, not one.
- **Observed:** an effect explicitly configured with zero damage reduces 120 HP to 119. A designer trying to turn damage off still chips targets to death.
- **Repro:** D-13 casts zero raw damage, advances, compares HP.
- **Fix:** preserve zero through final rounding; expose a minimum-positive-hit policy separately if desired. **verified: true**.

## Traceability matrix — combat

“Implemented” means traced to production code, not necessarily separately runtime-tested. Where a rule is undefined, a reasonable demo choice is not itself a deviation; disclosure/tunability can still be missing (D-07).

| Mechanic / source | Code | Disposition |
|---|---|---|
| Proximity exploration → visible-enemy combat (T:131–135; C:11–15) | `createBattle`, engine:107 | Independent encounter launch only; explicitly out of scope D10:75. |
| Full squad controlled, not round-robin (T:137,587–591) | controller:75–78,128–140; engine:177–218 | Implemented; party remains player-controlled unless Auto chosen. |
| AP spent determines next-turn delay (T:137,175) | engine:242–267 | D-01; empty Wait is a labeled demo addition. |
| One combat action plus movement; flexible move/act/move (T:165–175) | engine:279–347,475–505; active turn fields | Implemented and tested; shared movement budget. |
| Explicit or exhausted turn ending (T:173) | engine:151–170 | Explicit implemented; exhausted omitted D-06. |
| Movement 10/12.5/15; budget 50; ranges 5/4/3 (T:143–159) | config:66–74; engine:48–55; queries:35–96 | Implemented; formulas and engine tests. |
| Movement-speed bonus reduces cost multiplicatively (T:153–161) | formulas:38–40 | Formula tested but no live passive/bonus field; deferred skill trees. Manual per-armor AP override approximates it. |
| Clothing start (T:562) | gear:7; encounters:28–29; controller:171 | UI enforces clothing in Granary. Raw `createBattle` trusts setup; not an additional user-facing finding. |
| Terrain movement/topology (D03:70; D10:132) | queries:53,67; state:44–46 | 4/8 direction setting; floor only, allies passable, diagonal contact hardwired; D-07. |
| Melee equipment engagement (T:1042–1056) | state:79–94; engine:91–96 | Ranged cannot hold; heavy/shield highest, light/dagger escape-oriented. Diagonal contact via Chebyshev is an unlabeled assumption. |
| Base 20%, +10% per E−D; 10 vs 6→60% (T:1060–1071) | formulas:28–30; config:75–80 | Implemented; scores remain hypothetical/demo. |
| Failed disengage permits one step (T:1071) | engine:289–335 | Implemented on first step leaving Chebyshev contact; moving around within contact has no roll (existing test). |
| Chance-based AoO, not automatic (T:1071) | engine:309–317 | Implemented; default 50%, free single-target normal strike. Check timing/profile choices need D-07 disclosure. |
| Multi-engager unresolved (D03:113; D10:137–140) | config:144; engine:296–305 | Highest or each; summed-score alternative absent. |
| Flank N/S or E/W melee opposites (T:879–886) | state:67–75 | Implemented; optional diagonals. Massive footprint cannot flank/be flanked as target (demo exemption not labeled). |
| Flanked no engagement (T:884,1075) | state:82 | Implemented. |
| Flanked +damage, reduced dodge/block/parry (T:886) | engine:375–381,417 | Magnitudes tunable demo; delayed damage missing D-02. |
| HP/Armor/MR; no STR/DEX/etc.; no mana (T:665–695) | types:121–153; engine:413 | Implemented for HP/Armor/MR, no mana or traditional attributes. |
| Lightning/Water/Fire/Earth damage and resistances (T:672–679,791–807) | types:9,133–134 | Absent; only physical/magic. Record as deferred broad elemental system; “Hellfire” is generic magic, not modeled Fire. |
| Armor/MR same diminishing-return formula (T:811–835) | formulas:5–16; engine:413–418,598–599 | Formula correct; rounding/minimum policy differs D-13 and D-07. |
| Approximate Armor bands 100/200/300 (T:817–823) | gear:9–11 | Exact band representatives, not evidence every item must have those exact stats. |
| % then flat penetration, clamp remaining defense (T:739–769) | formulas:5–16 | Implemented, worked examples tested. Generic profile pen selects defense by damage type; no independent armor/magic pen stats. No current split-pen item requires both. |
| Physical identities via penetration, not slash/pierce/blunt resistance (T:785–789) | types:9; gear weapon profiles | Implemented broad taxonomy; individual profiles audited separately. |
| Hit→highest reaction→damage/status (T:962–1003) | engine:364–425 | Implemented for strikes. AoE guaranteed-hit/no-reaction is hardwired D-11. |
| Diminishing-return avoidance; 20%+10%=28% (T:977–989) | formulas:23–24; engine:382–399 | Sequential independent rolls stop at first success; correct, formula golden passes. |
| Reaction AP pushback; block > parry (T:1024,1031–1037) | engine:271–274,389; config:93–95 | Defaults 25/25/35 are demo. Active-unit reaction AP retained. Exposed costs permit non-source combinations, correctly demo tagged. |
| Ranged cannot be parried (T:1005) | engine:380,510; queries:126 | Implemented; passing review control. |
| Ability-specific reaction permissions (T:1007) | types:73–94 | Missing D-11. |
| Dodge one tile backward (T:1037–1038) | engine:390–396 | Implemented for single-tile targets; obstacle means no displacement but still avoidance. This fallback is not tunable D-07. |
| Parry/block no automatic counterattack (T:1020–1032) | engine:387–404 | Implemented; counter-builds absent/deferred trees. |
| Rough 70–75% ceiling via items/skills (T:1013–1015) | gear current reaction values; formulas:23–24 | No explicit total cap, but source specifies design caps, not compulsory global clamp. Current items do not establish a violation. |
| Armor dodge penalty light/medium/heavy (T:779) | gear:7–11 | 15%/8%/0% plus weapon bonus implements direction; invented magnitudes need provenance/tuning. |
| Block meaningful through shield equipment (T:781) | gear:21,27,33,39,46,52,69 | Implemented; shield block vs other zero block. |
| Dazed→Stunned buildup (T:851,869–873) | engine:446–450; types:150 | Only binary Dazed (+AP, no reactions until next turn end); simplification explicitly in D10. Pushback tunable; suppression rule not independently tunable. |
| Hot→On Fire; Cold→Frozen; Electrocuted→Paralyzed; Tangled→Wrapped (T:848–852) | no status model beyond dazed/feared | Deferred by D10:78; not a sandbox blocker. |
| Bleed/Poison stacks; Armor/MR application resistance; provisional poison cap20 (T:798,856–867) | absent | Explicit full-status deferral; do not treat 20 as locked canon. |
| Element resistance buildup and critical failures (T:867–873) | absent | Deferred full-status system. |
| Skill AP cost + AP cooldown, no mana (T:688–695) | engine:502–507; state:97–100 | Implemented; cooldown starts at cast clock. Values demo; timing interpretation not exposed. |
| Delayed cast and caster-next-turn clocks independent (T:722–728) | engine:502–507,565–588 | Implemented; instant actions during turns, scheduler interleaves impact. |
| Delayed indicators/timeline/AP countdown (T:946–958) | queries:263–274; hud/Timeline.tsx; Incoming.tsx; board/BoardScene.ts | Present by source inspection; no visual/browser audit in this scope. |
| Timeline range 0–300; advance to next unit/effect (T:948–954) | Timeline.tsx:7; engine:177–203 | Implemented scheduler; hover/animation belongs UI reviewer. |
| Unit/effect ties and side ties undefined (D10:134–135) | engine:181–190; config:131–132 | Both settings; units-before-effects tested at exact-zero margin. |
| Full heal between fights, non-permanent KO, loss when all out (T:629,657) | engine:81–82,99,622–630; controller:166–180 | Fresh battle full HP; KO until next fight. Boss timeout is separate demo defeat, openly configured. |
| Two carried weapons/AP whole-action swapping (T:325–331,355–370) | single weapon/action union | Missing/deferral needs documentation D-10. |
| Wielded weapon only grants skills/passives (T:325–331) | engine:63–70,91–97 | Single-weapon subset satisfies active-kit rule; cannot test reserve exclusion. |
| Every weapon two skills, second proficiency-gated (T:313–335) | gear:skills arrays; engine:70,97 | One starter skill in demo; full itemization/proficiency deferred. Added placeholder weapon skills are valid basic-skill examples, not premature tree unlocks. |

## Traceability matrix — characters, armor and encounters

| Source requirement | Code mapping | Disposition |
|---|---|---|
| Jubal customizable; musician has no combat effect (CH:13–24; T:552) | units:17; engine:60–70; Screens:46–98 | Implemented weapon/armor subset; role is flavor only. |
| Head, armor, weapon-set, accessory; two consumables (T:572–581) | types:221–224 | Only armor/weapon; inventory/consumables explicitly excluded D10:77. |
| Three of six permanent tree choices; four active tree slots; town loadout/respec; rare full respec (T:63,697–720) | absent | D10:76 explicitly excludes tree selection and leveling flow. All six identities and fifteen Tier2 combinations deferred, not forgotten mechanics. |
| Granary first melee choice, Jubal alone, clothing, three rats (T:57–59,560–564) | encounters:7–35; Screens:10,61–86 | Correct. Maps/rat timing and stats demo. Starter weapon skills are basic weapon skills, not first tree skill. |
| First level-up and first tree skill after wolves (T:73,566) | encounters:60; gear:90 | Sandbox starts Wolves at L2 and Jabal already has Heavy Daze, per D10:88. Explicit abstraction from source chronology, not a campaign bug. Jubal has no tree skill (out of scope). |
| Jabal shepherd, two-handed club/staff, heavy daze example (CH:36–38) | units:18; gear:43–47,90 | Identity correct; authored exact daze kit mislabeled D-08. |
| Companions fixed kits, level with Jubal, not managed items (T:595–625) | engine:115–118; units:9–19; shared weapon data | Same encounter level, immutable setup; implementation reuses item-shaped data but player does not micromanage it. Not itself a violation. |
| Mercenary chosen from handful; no class diversity requirement; max party probably5; one consumable (T:87,591,603–615) | fixed archer encounter placement:135–137 | Fixed three-person boss squad per D10; roster/hiring/consumables omitted by narrowed scope. Naamah support kit and later companions not included, intentionally. |
| Act One end L5–6 (CH:28; T:566) | encounters:131 | Boss L5 correct. |
| Jubal HP120/135/150/170/190/215 (TM:160–165) | units:6 | Exact tentative table, not canon. Damage scales match SIM:120, not exact TM weapon-range bands. |
| Jabal/archer HP proposals (D09:153–154) | units:11–12 | Jabal L2 174, archer L5 190; Jabal base template 174 is superseded by function. Armor instead fixed light100, not tentative95/140. Permissible retuning, missing labels/knobs D-07/08. |
| Clothing unspecified numeric Armor/MR; light/medium/heavy bands (D09:78–81) | gear:7–11 | 25/0 clothing, MR25/40/50, dodge and scores are demo values. Armor band defaults correct; not a full authored item table. |
| Equipment E/D directions and hypothetical scores (T:1046–1067) | gear:7–11,21–52 | Clothing0/3, light1/4, medium3/3, heavy5/1; source direction, hypothetical exact values. |
| Wolves closest charge and optional one-turn fear (E:21,27) | ai:140–190,299–302; engine:453–461,266 | Fear clears after next turn; charge targeting D-05. Fear default-on is optional source concept chosen as demo default. |
| Giant rats/brood mother summons and two strategies (E:29–36) | only small_rat template:21 | Absent intentionally: approved Granary is three tutorial rats, no brood mother encounter. |
| Bandit fighter/archer false lead and mine-route battles (E:38–44) | no templates/encounter | Absent intentionally: approved roster has four encounters, no campaign. |
| Cultist frontline light fighters + mage control (E:48) | units:23–24; encounters:100–103; ai:193–267 | Implemented; zealots guard seer, Daze Bolt and Hellfire Sigil invented demo skills. Mage HP90 differs tentative85; no canon issue, label/tuning gap. |
| Roughly three ruins fights plus mine cultists (E:50,54) | one cultist encounter | Collapsed into one test encounter intentionally by D10. |
| No grind, standalone full recovery (E:11–15) | fresh fixed-level encounters | Correct test-bench abstraction; not a progression simulator. |
| Boss trapped, massive head/free arm, kill before escape (T:93,917) | units:25–28; encounters:113,139; engine:186–195,226–230 | Immobile six-tile footprint; timeout1300 is disclosed demo interpretation, not a canon number. Visual quality not audited. |
| Sweep near free arm, punishes overcommit, wait/attack/retreat (E:76–80) | targeting:49–55; ai:274–276; engine:555–558 | Delayed full-width rectangular zone, depth tunable3; width/anchor not tunable. D10 suggested roughly3×3 boss, implementation3×2 footprint; placeholder difference, not canon violation. |
| Boss rock throw at ranged, blocked by cover (E:84–86) | ai:280–284; state:34–41; targeting:85–90 | LOS block implemented; fallback melee target D-12. No separate cover value/edge model; all cover blocks sight. |
| Rockfall flushes repeated same-cover ranged unit (E:90–92) | engine:233–239; ai:278–279; targeting:95–105 | Delayed flush exists; occlusion identity/priorities D-12, hardwired 3×3 vs proposed3×2 D-07. |
| Archer + cover lesson (D10:90,105) | encounters:125–137; gear:49–53 | Present; reachability advice D-03 affects tuning validity. |
| Boss exact stats/actions undefined (P:111; D10:94–104) | units:26; config:99–108 | HP1200, Armor100, MR100 vs D10 placeholder900/150/50; sweep500+50%pen vs300; rock170 vs~90; rockfall220 vs~200. These are allowed retunings, not canonical deviations. Stats not all exposed D-07. |

## SETTINGS provenance audit (every non-demo entry)

Runtime enumeration found **47 SETTINGS**, of which the following **13** are non-demo. No unsupported numeric source claim was found among these defaults. Qualification matters: a source *example or possibility* is not a mandatory rule, and an automatic-resolution implementation is not itself source-backed.

| Key; code line | Label / default | Exact backing quote and verdict |
|---|---|---|
| movementBudget; config:129 | source / 50 | T:147: “There is a maximum allowable action point usage for movement turns, set to **50 action points**.” Accurate. |
| moveApLight; :135 | source / 10 | T:143: “**Light armor** costs **10 action points** to move one square.” Accurate. |
| moveApMedium; :136 | source / 12.5 | T:144: “**Medium armor** costs **12.5 action points** to move one square.” Accurate. |
| moveApHeavy; :137 | source / 15 | T:145: “**Heavy armor** costs **15 action points** to move one square.” Accurate. |
| engageBase; :140 | source / .2 | T:1069: “The base chance to keep the target engaged is **20%**.” Accurate. |
| engagePerPoint; :141 | source / .1 | T:1069: “The engagement score difference is **10 - 6 = +4**, adding **40%**.” Accurate as inferred example; `why` explicitly says implied. D09:133 says exact scaling TBD; do not promote it to a separately confirmed universal law. |
| critChance; :154 | tentative / .05 | SIM:31: `crit: float = 0.05`; Publish/Simulation Results.md:22: “Hit/crit variance is included.” Correct simulation provenance; TM itself does not specify the number. |
| critMult; :155 | tentative / 1.5 | SIM:32: `crit_mult: float = 1.5`. Correct simulation provenance, not an Aaron rule. |
| bowMoveSurcharge; :158 | source / 50 | T:202: “The bow has a base AP cost of **75 AP**.” T:204: “the bow’s AP cost becomes **125 AP** instead.” T:206: “The only way to get the bow’s low AP cost of 75 is to **not move** on the same turn.” Accurate basic-bow delta; skill extensions are demo. |
| reactionsEnabled; :160 | source / true | T:969: “If the attack hits, check defensive reactions: **dodge**, **block**, and **parry**.” Accurate existence/order; “Rolled automatically here” is demo policy and deserves separate metadata/control (D-07), not source authority. |
| dodgeDisplaces; :164 | source / true | T:1037: “the character moves one tile backward from the direction of the attack.” Accurate; blocked displacement fallback is demo. |
| sweepDelay; :170 | tentative / 75 | TM:232: `| Light armor, saved movement | 20–30 | 75 | Safe |`; D03:315: “A 75 AP telegraph is the current tentative default for the first trapped Nephilim boss.” Correct value provenance; old escape analysis rejected. |
| wolfPackFear; :180 | source / true | T:896: “Possible pack mechanic: when one wolf dies, the remaining wolves become feared for one turn, run away, then come back and regroup.” Correct source concept but explicitly *possible*; default enabled is a demo selection. `why` retains that qualifier, so not a false quote. |

All remaining SETTINGS entries are labeled demo; their `why` strings generally identify the uncertainty or tuning purpose. Important inaccurate/overstrong explanations: minTurnDelay describes only empty Wait (D-01); delayedHitsAllies implies own-side inclusion but self is immune (D-04); sweepDepth says every armor can escape at3 without mentioning blocked paths/engagement (D-03). `reactionsEnabled` does not offer an automatic-vs-opt-in alternative, only off/on. Mutable source settings are appropriate for a sandbox; changing one does not make the changed value canon.

## D10 §7 settings checklist

| Row | Coverage |
|---|---|
| 1 topology | diagonalMovement. |
| 2 friendly fire | friendlyFire / delayedHitsAllies; self exemption D-04. |
| 3 unit/effect tie | tieUnitBeforeEffect. |
| 4 unit/unit tie | tiePlayerFirst; fixed list order hardwired. |
| 5 base hit / side penalties | Only side penalties exposed; base hit values fixed. |
| 6 E/D equipment scores | Formula base/per-point/clamps exposed; individual scores fixed. |
| 7 multi-engager | highest/each, no sum option. |
| 8 AoO chance and attack | Chance exposed; normal basic single-target profile fixed. |
| 9 check timing | Fixed first exit per engager, not configurable global once/turn. |
| 10 automatic/opt-in reactions | Only enabled/disabled; auto hardwired. |
| 11 reaction costs | All three exposed; defaults25/25/35. |
| 12 blocked dodge displacement | Always succeeds without displacement; not configurable. |
| 13 flank values / diagonals | All three exposed. Massive target exception not exposed. |
| 14 bow fire then move | Retroactive surcharge implemented; surcharge amount exposed. |
| 15 Dazed meaning | Pushback and boss multiplier exposed; no-reactions and duration fixed. |
| 16 boss engagement | bossesEngage. |
| 17 sweep depth | sweepDepth; width/arm placement fixed encounter data. |
| 18 KO/loss | KO/all-party defeat hardwired; additional boss timer configurable. |

## D10 §11 golden checklist

| Listed example | Existing Vitest coverage | Verdict |
|---|---|---|
| 100 raw vs100/200/300 =50/33.33/25 | formulas.test:8–11 | Present/pass; fractional formula tested before engine rounding. |
| 20%+25flat vs100 =55effective/64.52damage | formulas.test:22–24 | Present/pass. |
| 100flat vs100/200 | formulas.test:26–28 | Present/pass. |
| 75% vs100/200 →25/50 | formulas.test:30–32 | Present/pass. |
| 20%dodge+10%parry=28% | formulas.test:40–44 | Present/pass mathematical total; review adds runtime order/AP control. |
| E10 vsD6=60% | formulas.test:49–50 | Present/pass. |
| 10% speed→9/11.25/13.5; ranges5/4/3 | formulas.test:59–67 | Present/pass helper. No live bonus system; not claimed as integration coverage. |
| Bow75/125; crossbow50fire/50reload data | engine.test:129–141 | Bow present/pass incl reverse ordering. Crossbow absent, D-09. |
| ShieldN+NE; 2H NW/N/NE/W/E; polearm2; daggercardinal | patterns.test:10–28 | Present/pass. Per-weapon review owns further correctness. |
| Timeline reposition then slide to next unit/effect | engine.test:91–103; escape tests56–88 | Scheduler delay/clock partly covered; no direct projection/bar-slide golden. |
| Flanked N/S or E/W melee only | engine.test:172–179 | Partial: N/S and diagonal toggle only, no E/W or ranged-negative case. |
| §9 escape table | engine.test:56–88 | All five exact scenarios present/pass plus both tie modes. Finite-board reachability edge missing D-03. |

## Final verification

`REVIEW-design-execution.txt` preserves real command output. Final `npx vitest run`: **7 failed / 45 passed / 52 total**, with all failures exclusively in review probes D-01–D-06 and D-13; the original 44 tests still pass. `npx tsc --noEmit -p tsconfig.json` and `npx eslint .` both exit 0. Added files only: this report, execution transcript, and the review test file. No production fixes were attempted.

## Prototype purpose and bounded conclusions

AP timing, movement/armor tradeoffs, patterns, telegraphs, visible timeline, and full fresh-battle recovery all have real implemented paths, not stubs. The corrected instant-movement model is used by the scheduler and the five escape scenarios. The major review risks are the short-turn tax, incomplete safety prediction, delayed damage inconsistencies, and insufficient tuning/provenance granularity—not absent campaign systems.

This review does not establish that every loadout is balanced or that the art/readability is acceptable to Aaron; those require playtesting. It does not evaluate browser animation, hover rendering, share/replay fidelity, export format, or deployment. No Rust repository was accessed. No new invented default is recommended as canon.

# Weapons audit, implementation specification, and balance review

Review base: main `52886f3`; worktree `review/weapons`. Review-only: production source unchanged. Canon was read directly from the read-only Sons of Cain vault. Authority: Aaron’s Transcriptions > Publish > Drafts > Tentative Math > existing demo defaults. “Verified” below means observed in code/test/output, not that a recommended fix was implemented.

## Executive result

The four melee starters and existing companion bow implement the documented basic patterns/AP well. All eight directional rotations pass independent-coordinate probes. Bow movement charging is correct in the engine, including shooting before moving, but hypothetical-position previews underprice it. Four entire weapon families are missing: crossbow, dual wield, javelin + shield, colossal. Bow exists but is unavailable to Jubal in setup. Two carried weapons, action-consuming swapping, and proficiency-gated second item skills are absent. Therefore the request “all weapons implemented and balanced” is not met.

40-seed baseline: every Granary and wolves cell wins 100%; cultists range 55–100%; Nephilim 67.5–100%, no stalls. Daggers/light is the cultist outlier. Polearms dominate that encounter but are not globally dominant: heavy polearm is the weakest current melee boss cell. These are party-bot outcomes, not isolated weapon performance or a human skill ceiling. Missing families have analytic starting budgets below, NOT invented simulation results.

## Findings

### W-01 — P1 — Four documented families and required attack state are absent
- Evidence: `src/content/gear.ts:16–81` and `src/rules/types.ts:21,39–50,264–268` contain no crossbow/dual-wield/javelin/colossal families, reload action, dual strike, or alternative basic modes. Aaron’s Transcriptions.md:212–218: “once every two turns”; :266–272 random second attack; :295–309 hybrid and colossal modes. Publish/Weapons.md:46–125 supplies the same definitions.
- Fix: implement the item/mode/action model and deterministic resolution in sections below; test each family rather than merely adding setup cards.
- Verified: true (inventory and union inspection; existing suite does not cover missing behavior).

### W-02 — P1 — No two-slot inventory or action-consuming weapon swap
- Evidence: `src/rules/types.ts:139–147,221–224,264–268` has one weapon and no swap action; `engine.ts:63–97,150–162` copies one kit at creation. Aaron’s Transcriptions.md:355 “Every character can carry two weapons at a time”; :368 “Weapon swapping counts as the character’s combat action”.
- Fix: two persistent item instances; swap action spends configurable 50 AP, consumes action, refreshes only active-item stats/skills, retains cooldown/ammo state. Do not permit attack or new skill in the same turn.
- Verified: true.

### W-03 — P1 — Playable items have one ungated weapon skill, not basic plus proficiency
- Evidence: `gear.ts:21,27,33,39,52` each has one skill; `types.ts:50,147` has neither skill tier nor proficiency; `engine.ts:70,97` merges weapon/template skills. Aaron’s Transcriptions.md:313 “two weapon skills”; :325 “only ... currently ... equipped”; :333 second skill requires proficiency.
- Fix: distinguish personal/authored abilities from item-owned basic/proficiency slots; add sandbox proficiency/access controls and persistent item cooldowns. Do not merge retired item abilities into personal skills.
- Verified: true. Later canon (:597–625) explicitly exempts fixed companion kits from a universal skill-count/item template; do not manufacture two skills for every monster pseudo-weapon.

### W-04 — P2 — Planned bow movement is absent from preview AP and bot timing
- Evidence: `queries.ts:159–173,200–209`: `from` changes targeting position but cost only checks `active.moved`; `ai.ts:350–367` evaluates future positions with those prices. Aaron’s Transcriptions.md:204 “if ... movement action on the same turn ... 125 AP”. Two `it.fails` probes reproduce 75 instead of 125 and Aimed Shot 100 instead of 150.
- Fix: price prospective movement explicitly (including planned retreat after shooting), and use that price in next-turn/danger projections. Engine charging itself is correct (`engine.ts:338–345,464–484`).
- Verified: true; expected failures are intentionally recorded rather than hidden.

### W-05 — P1 — Setup and stock balance runner restrict every encounter to four starters
- Evidence: `hud/Screens.tsx:10,59–64`; `tools/sim.ts:20,30`. Publish/Weapons.md:17: bows/crossbows “introduced later rather than ... initial weapon pick”. Prototype Scope.md:94–101 restricts the initial tutorial, not all subsequent tests; Brendan now requests all families.
- Fix: shared encounter-aware selectable-item query used by UI, validation and simulator; keep Granary four melee-only; offer six ordinary types after it and special types through an explicit sandbox unlock.
- Verified: true. Headless `runBattle` already accepts hunting_bow for Jubal (review-bow.json), proving this is a UI/catalog omission for bow, not a missing bow engine.

### W-06 — P2 — Existing light dagger cultist performance misses a reasonable parity band
- Evidence: `review-baseline.txt:20–31`: dagger/light 55%, other light weapons 82.5%,100%,85%; `gear.ts:85` Throwing Knife only 60% damage. Transcriptions.md:196 describes “single-target, high-damage-output”; it does not promise equal wins and does not supply numeric skill damage.
- Fix: first fix bot valuation; candidate Throwing Knife multiplier .60→.80 improves measured light cultist wins to 62.5% and HP 14%→19.1%, but is insufficient alone. Do not globally buff dagger basic damage (already strong against boss).
- Verified: true (measured imbalance under proposed demo target; NOT a canon violation or proven final balance fix).

No P0 findings. Polearm wording is ambiguous, not a confirmed range bug: Transcriptions :289 says “tile behind the target”, but :276 caps range at two; Drafts/09:57 explicitly says “Two-tile straight line.” Existing `[origin+dir, origin+2dir]`, even when clicking the far tile, is the sensible bounded interpretation. Do not extend to range three without Aaron's decision.

## Audit matrix: implemented basics and equipment

All raw damage/hit numbers below are tentative or demo, not immutable canon. Numeric engagement/disengagement values in the transcription's worked example are explicitly “hypothetical” (:1060).

| Item | Actual basic | AP | Weapon engage/disengage | Parry/block/dodge bonus | Verdict |
|---|---|---:|---|---|---|
| Bronze Daggers | N/E/S/W adjacent only, one target | 50 | 0/4 | .05/0/.05 | Canon geometry, tempo and escape identity match |
| Sword & Shield | target + next clockwise adjacent tile | 75 | 5/0 | .05/.30/0 | Canon clockwise rotation and defensive identity match |
| Bronze Spear | distances 1 and 2 in a chosen 8-way line | 100 | 3/2 | .10/0/0 | Canon range and bounded line match; wording caveat above |
| Two-Handed Axe | adjacent offsets -2,-1,0,+1,+2 around ring | 125 | 3/1 | .10/0/0 | Canon shape/AP/high raw damage/low hit match |
| Shepherd's Club | same five-tile arc; 72 raw, .80 hit | 125 | 3/1 | .05/0/0 | Matches two-handed authored companion style; numbers are demo |
| Hunting Bow | one hostile, Chebyshev 2–10, LOS | 75/125 | cannot engage; disengage 2 | 0/0/0 | Engine matches; not selectable for Jubal; planned-move preview bug |
| Rat bite | cardinal adjacent, 10 raw/.75 hit | 80 | 1/3 | 0/0/0 | Authored enemy kit, not a canon ninth/tenth player family |
| Wolf bite | any adjacent, 40/.80 | 80 | 2/4 | 0/0/0 | Authored enemy kit |
| Cultist blade & shield | same clockwise pair, 45/.82 | 75 | 5/0 | .05/.25/0 | Correct shield-family shape, weaker demo defense |
| Cultist staff | one adjacent, 22/.80 | 75 | 1/3 | .05/0/0 | Authored caster kit, not a polearm |
| Nephilim arm | one adjacent, 150/.90 | 100 | 10/0 | 0/0/0 | Authored boss; boss-engagement disabled by demo config |

Evidence: `gear.ts:18–79`, `patterns.ts:13–58`, `targeting.ts:15–46`, `state.ts:62–94`, `engine.ts:89–97,475–489`. Armor adds engagement/disengagement (clothing 0/3, light 1/4, medium 3/3, heavy 5/1), with bespoke enemy overrides (`engine.ts:92–93`). Thus shield + heavy gives engagement 10; dual wield + medium should give disengagement 6 when implemented.

Direction oracle: screen y increases downward; ring is N, NE, E, SE, S, SW, W, NW. North→NE and NW→N are clockwise. Tests independently enumerate coordinates, not reusing `geometry.dir`, for all eight rotations. Dagger diagonal aiming is rejected; line off-axis `(2,1)` is rejected. Arc near tiles receive -.10 hit, far -.20; source says penalties “eventually” but supplies no amounts. This is acceptable demo completion, not a source value. Hit clamps .05–.95. Large footprints are deduplicated and assigned their best (lowest) ring penalty: a boss overlapping five tiles is NOT hit five times.

LOS: ranged basics and Aimed Shot check walls and cover, not units (`state.ts:34–41`); melee does not share ranged LOS. Line2 rejects a wall in tile 1 and truncates at a wall in tile 2. Whether a low cover tile obstructs a spear or a diagonal thrust can clip a corner is not specified exactly in canon; preserve current behavior as a labeled demo rule and add explicit fixtures rather than calling it canon. Chebyshev interpretation of “tiles in any direction” is also a grid convention, not a documented Euclidean formula. Ranged distance currently uses the nearest occupied footprint tile, while LOS uses the clicked tile: document this behavior or unify both on one legal hit tile before expanding ranged content.

Bow: engine charges 75 if no voluntary movement, 125 once movement happens, regardless of ordering, and never double-charges on a second move. Movement AP is additional, not included in 125. Forced displacement is not a movement action and does not set `active.moved`. `canEngageUnit` rejects bow regardless of armor contribution. Ranged attacks omit parry but retain dodge/block, as Publish/Combat System.md:199 requires. Shield block .30 negates the attack and costs 35 AP on success; no hidden armor bonus is necessary to satisfy unspecified “defensive bonuses”. Actual amount is demo.

## Implementer-ready completion specification

### 1. Catalog and provenance

Use the nine family IDs `daggers`, `shield`, `polearm`, `two_handed`, `bow`, `crossbow`, `dual_wield`, `javelin_shield`, `colossal`. Keep `natural` and `staff` for authored enemy kits, excluded from selectable player gear. Paired daggers, shield sets and dual wield are ONE item (Transcriptions :579). Do not implement them as separately equipped hands.

Every numeric/content field needs an owner/status/why (extend data metadata as well as SETTINGS; current comments alone do not expose all weapon numbers to the tuning UI). Source: patterns, base AP/ranges, bow surcharge, two-skill ownership/proficiency rule, swap consumes combat action, access combinations. Tentative: existing raw damage table from Drafts/09:64–72 and crossbow 85. Demo: accuracy, penetration, reaction chances, skill specifics/cooldowns, swap AP, range metric, corner/cover convention, random-target timing, reload persistence/defer policy, special unlock and proficiency testing switches. Split concept from numeric provenance (e.g. Heavy Daze concept is source, its 300 cooldown and 1.0 multiplier are not).

Add `weaponSwapAp` number default 50, min 25 max 100 step 5, status demo, why: one cheap action, but real delay; compare 25/50/75 later. Add `proficientAllWeapons` boolean false, demo, why: inspect second skills without building trees. Add `unlockSpecialWeapons` false in story preset / true in named All Weapons Sandbox preset, demo, why: no full tree implementation; NOT a fictional acquired class. Store/serialize these in config/share links. Do not change source base AP to equalize wins.

### 2. Data model and migration

Replace single-basic assumptions explicitly:

```ts
type WeaponFamily = /* the nine player families plus natural/staff */;
type AttackMode = AttackProfile & { id: string; ammo?: 'bolt' };
interface WeaponDef {
  // existing name, family, engage/disengage, reactions, blurb
  modes: readonly AttackMode[]; // stable ids, first = default
  basicSkill: string | null; proficiencySkill: string | null;
  reloadAp?: number; // crossbow 50, source
  access?: 'normal' | 'soldier+savage' | 'soldier+rogue' | 'savage+rogue';
}
interface WeaponInstance {
  instanceId: string; defId: string;
  loaded: boolean; // true for crossbow on battle creation; irrelevant otherwise
  skillReadyAt: Record<string, number>;
}
// UnitState additions:
// carried: [WeaponInstance, WeaponInstance | null]; equippedSlot: 0|1;
// personalSkills: {id:string; readyAt:number}[];
// proficiencies: WeaponFamily[]; unlockedSpecialFamilies: WeaponFamily[];
// reloadOwedSlot: 0|1|null; turnOrdinal: number;
// Attack action: add modeId; new reload and swapWeapon {slot} actions.
```

Use an `equippedWeapon(state,u)` / `effectiveStats(state,u)` selector. Prefer deriving active attack/defenses rather than copying and incrementally subtracting bonuses: repeated swaps otherwise stack dodge/engagement. During migration a single `refreshEquipment` can populate existing cached fields from armor/base stats and active item, but it must be idempotent and never reset HP, ammo, or cooldowns. Scale every mode's raw damage by existing level and player multiplier once, not on each swap. Keep authored template abilities separate, so swapping cannot grant both sets permanently. Jabal/archer remain fixed loadout characters; author an optional second weapon in UnitTemplate, do not expose their equipment editor. Their variable skill counts are allowed by later canon.

Extend Setup with `weaponIds: [string, string|null]`, `equippedSlot: 0|1`; adapt legacy `weaponId` links to `[weaponId,null]`. Validate exact known IDs, encounter allowed IDs, special unlock, distinct instance IDs; reject invalid actions before mutation/RNG use. Permit two items of same family, but optionally forbid identical def IDs in the sandbox setup (demo UI convenience, not canon). New battle creates independent instances, resets loaded state and cooldowns. Cloning/replay must retain both instances. Add explicit reload/swap events with AP, slot and old/new item names. Analytics must count their AP as action AP and expose reload/swap counts.

### 3. Basic catalog, modes, and initial numeric budgets

Keep existing four starters and bow values initially. New defaults are proposals, not validated balance:

| Item / mode | Pattern / range | AP | Raw / hit | % pen / flat pen | Engage / disengage | Parry/block/dodge bonus |
|---|---|---:|---|---|---|---|
| Crossbow fire | ranged 1–6 | 50, then reload 50 | 85 / .85 | .15 / 5 | cannot / 2 | 0/0/0 |
| Dual blades | primary adjacent + stochastic second in five-tile arc | 100 total | 42 each / .85 each | 0 / 10 | 2 / 3 | .08/0/.03 |
| Javelin thrust | adjacent single | 75 | 60 / .86 | 0 / 10 | 4 / 1 | .05/.25/0 |
| Javelin throw | ranged 2–4 | 125 | 80 / .86 | 0 / 10 | equipment stays same | same |
| Colossal line | line2 | 175 | 135 / .72 | .25 / 0 | 4 / 0 | .10/0/0 |
| Colossal sweep | ring8 | 175 | 135 / .72 each | .25 / 0 | same | same |

Why: crossbow's 100 AP sustained cycle sits near bow but with shorter range/armor tech; double 42 gives dual wield less pure single-target output than 45-damage daggers, paying for diagonals/second-target flexibility; javelin trades shield pair-cleave and .30 block for ranged reach; colossal gives lower single-target efficiency but the highest surrounding-area ceiling. Keep axe better for ordinary five-target directional cleave efficiency; colossal wins on all-eight coverage/extra line reach and burst per action. None of these profiles proves balance until implemented and simulated. Crossbow optional heavy-bolt ITEM variant: raw 80, hit .83, .35 pen/0 flat, same AP/reload. Not a free mode that changes ammo or reload price. Test vs armor 0/75/100/300; initial encounters have no armored enemy above 100, so they cannot fully validate an anti-heavy niche.

#### Crossbow state machine

- Start loaded (demo initial condition). A fire/basic or bolt skill checks loaded, consumes it even on miss/block, marks `reloadOwedSlot`, uses one combat action. No bow movement surcharge.
- Source says next turn must reload; implement the conservative literal behavior: next combat action must be reload, 50 AP, including before swapping. Movement/end-turn remain possible; waiting does NOT auto-reload. Pending reload persists across turns until paid. Block fire/other skills/swap while debt exists. This prevents swapping to another loaded crossbow to evade the cadence.
- Reload requires pending unloaded crossbow and unspent action; it sets loaded, clears debt, spends 50 AP and `acted=true`. Cannot fire in that same turn. Normal cadence: fire, reload, fire. Fire→reload→swap is the literal frontline opener before melee.
- **Author decision needed:** “frontline opener” may intend fire→swap and deferred reload; if Aaron chooses this, allow swap with unloaded state persisted on item and require reload after re-equipping. Do NOT quietly claim both policies are source. Strict debt behavior is this spec's default; add a separately labeled demo option only if testing the alternative. Both retain no repeated shots without a paid reload action.
- UI: loaded/unloaded/debt badge on both slots, Reload action with 50 AP and “must reload before another combat action”; disable fire with reason; no target click for reload. Queries return a non-targeted reload preview and correct next-turn AP. AI reloads when debt exists, then considers movement/cover; score opener and sustainable cycle separately.

#### Dual wield deterministic resolution

- Primary target: hostile occupying clicked adjacent tile in any direction. The second pool is the five adjacent RING cells at direction offsets -2,-1,0,+1,+2, not an unrestricted radius-two square and not enemies two tiles away from the attacker.
- Resolve primary first. Recompute pool of living hostile units currently occupying those cells, sorted by stable unit order/id; dedupe footprints. Uniform draw among eligible units (not weighted by occupied tiles), using `state.rng` only. If no eligible unit, no draw/no second strike; otherwise one target-selection draw then independent normal hit/reaction/crit rolls for second strike. A dodged-away/killed primary cannot be hit at its old position. A surviving primary still in the arc can be selected again.
- Timing, uniformity and post-first-hit recomputation are demo decisions because the source supplies only “random second attack”. Friendly-fire setting must not add allies to the random enemy-only pool. Log primary + secondary separately under one 100 AP attack.
- Add `dualArc` pattern/target result with guaranteed primary and candidate IDs; do NOT put all secondaries into ordinary `hits` (that would hit all of them). Query/UI show solid primary and dashed “one random enemy” candidates, with selection probabilities; hover never consumes RNG. Expected secondary damage should integrate primary hit/kill/dodge outcomes for accurate bots; a first version can display conditional expectation with an explicit note instead of pretending every candidate is guaranteed.
- Golden seeds: primary survives alone → two strikes; primary dies alone → one; adjacent enemies at offsets ±2 eligible, ±3 and radial distance 2 excluded; pool order invariant to array iteration; multi-cell target included once; identical action replay identical RNG/events; preview repeated 100 times leaves RNG unchanged.

#### Javelin + shield

- One item, two basic modes (`thrust`, `throw`), not separate slots and not a 0-AP swap. Mode selection is UI intent with no state/tempo cost. Actual action names modeId and engine validates it. Thrust is single adjacent 8-way; no shield clockwise cleave. Throw has inclusive 2–4 range and LOS, is ranged (no parry), costs 125 regardless of movement. No ammo/recovery mechanic in source: do not invent a retrieval requirement.
- Defensive/engagement stats belong to held item, not last selected mode. Hold javelin+shield as melee-capable (`canEngage=true`) even when throw is selected. Remove dependence on the *selected attack's* ranged flag from generic engagement/flank helpers; otherwise hovering throw can switch off threat for free. This equipment-level interpretation is demo where the source is silent.
- UI mode buttons show costs/ranges and preserve selected mode only while item/turn context is valid. Board thrust vs throw previews derive from same query. AI enumerates both modes, prefers thrust efficiency when adjacent and throw to finish without unsafe approach. Golden cases: range 1/2/4/5, melee diagonal, throw behind wall, post-throw movement (no +50 bow charge), shield block and engagement remain during throw selection.

#### Colossal

- `line` reuses line2 and its obstruction policy; `sweep` adds `ring8`, all adjacent coordinates once, independent of aim direction. 175 AP for either. UI exposes two modes, sweep preview centered on wielder (button confirmation or clicking self), line asks direction. Same damage/hit per target in both modes initially.
- Do not inherit arc5 near/far penalties: source penalties describe two-handed extra tiles, not colossal. Deduplicate large footprints; all-eight attack hits each unit once. Apply friendlyFire consistently with existing multi-tile basics. Empty sweep should be rejected like empty melee attack unless friendlyFire permits a valid ally target.
- AI enumerates both and weighs action delay/escape, not just total raw damage. Golden: eight distinct enemies each struck once; six-cell boss once; each line direction; wall truncation; AP 175; invalid mode rejected without RNG change.

### 4. Weapon swapping and skills

`swapWeapon(slot)` requires active living actor, unspent action, valid nonempty other slot, no strict reload debt. Costs config.weaponSwapAp, `acted=true`; resets targeting UI, not movement budget or status effects. Movement allowed before/after as usual. New equipment defense/engagement applies immediately, but no basic/skill until later actor turn; existing `acted` gate must protect ALL action types (including reload and swap). No-op swap rejected, not charged. Swap does not itself count as bow movement. Reserve provides no defense, passive, engagement or skill access. Cooldowns use absolute timeline `readyAt` per item, so putting it away does not reset or freeze time.

Skills: use item `basicSkill` and `proficiencySkill` selectors plus separately authored personal skills. Basic attack is NOT the “basic weapon skill”. `availableSkills` derives exactly equipped item basic + prof slot if authorized + personal abilities. Engine independently checks it; UI filtering alone is insufficient. Proficiencies correspond to Soldier (crossbow/shield), Savage (polearm/two-handed), Rogue (daggers/bow); special access per tree combination. Since no trees exist, individual family toggles or `proficientAllWeapons` are explicit sandbox scaffolding; special access remains a distinct switch. All Weapons preset can enable both, but normal preset cannot imply they are earned. Basic abilities always usable without proficiency.

Minimal fully implementable demo skill pairs (reuse existing SkillKind; all new names/numbers are demo). Multiplier applies to the named mode's raw damage, pct bonus clamps total at 1. Existing abilities keep current values except optional tested knife tuning. Introduce `modeId` on SkillDef so hybrid mode selection cannot change skill damage for free; add `consumesBolt` for crossbow shot skills. Every listed skill consumes one combat action and starts cooldown at current clock + listed cooldown, even on miss:

| Item | Basic skill | Proficiency skill (AP / cooldown / resolution) |
|---|---|---|
| Daggers | existing Throwing Knife | Precision Stab: 75 / 200 / strike adjacent, 1.25x, +.25 pct pen |
| Sword & Shield | existing Shield Bash | Sundering Blow: 100 / 250 / strike adjacent, 1.25x, +.20 pct pen |
| Polearm | existing Hook | Piercing Cast: 125 / 250 / shot 2–3 LOS, 1.2x, +.20 pct pen; no ammo |
| Two-Handed Axe | existing Overhead Smash | Staggering Blow: 150 / 300 / strike adjacent, 1.0x and dazed on hit |
| Hunting Bow | existing Aimed Shot | Piercing Arrow: 125 / 300 / shot 2–10 LOS, 1.3x, +.35 pct pen, bow movement surcharge |
| Crossbow | Steady Bolt: 75 / 200 / shot 1–6 LOS, 1.0x, +.10 hit, consumes bolt | Breaching Bolt: 100 / 300 / shot 1–6 LOS, 1.25x, +.25 pct pen, consumes bolt |
| Dual Blades | Measured Cut: 100 / 200 / strike adjacent, 1.8x one 42-damage mode, +.05 hit | Disorient: 125 / 300 / strike adjacent, 1.5x one blade, dazed |
| Javelin & Shield | Shield Check: 75 / 200 / shove adjacent, .5x thrust | Piercing Javelin: 150 / 300 / shot 2–4 LOS, 1.25x throw, +.25 pct pen |
| Colossal | Crushing Blow: 175 / 250 / strike adjacent, 1.3x line | Stunning Impact: 200 / 350 / strike adjacent, 1.0x line, dazed |

These intentionally simple second skills complete the access/ownership mechanic without pretending to implement a full tree/status system. Fan of Knives and teleport-backstab are optional examples, not obligatory skills (Transcriptions :317–321). If desired later, add an explicit directional cone SkillKind, never use a boss-only sweep kind. Do not count Jabal's authored Heavy Daze twice or demand two pseudo-item skills for natural monsters; his fixed kit may remain unchanged.

### 5. Queries, AI, HUD, board, persistence

- Generalize `basicAttackHits`, `previewAttack`, `attackOptions`, `doAttack` around explicit mode profile. Avoid keeping an out-of-sync selected mode in UnitState. Pure helpers should accept modeId/from/plannedMovement; all routes share validation, range, LOS and AP calculation.
- Fix bow prospective movement: `movedThisTurn || !eq(from,u.pos) || plannedRetreatMovement` sets surcharge. Do not double count it if already paid. UI movement hover after a stationary shot must show pending +50 alongside movement AP. Goldens compare preview and resulting `active.actionSpent` for attack-first/move-first/split moves.
- Preview returns direct AP plus full repeat-cycle AP for crossbow; random candidate probabilities for dual wield; one fixed ring for colossal; skills carry exact active item identity. Dead/illegal actions yield reasons and no RNG advancement.
- In `ai.ts`, enumerate (mode, target), ready skills, reload and swap. Reload is obligatory under strict debt. For swap, compare discounted next-turn options to current equipped options including 50 AP swap cost; require a meaningful margin and suppress immediate swap-back unless threats/range changed (avoid oscillation). Do not evaluate just new weapon's immediate damage as if swap also attacks.
- Current bot `scoreAttack` weights weakest-HP focus 1.6, adds a kill bonus, subtracts only `.04 * AP`; it is not an optimizer of sustained DPS. It values unbounded overkill, ignores useful reaction pushback, and uses optimistic reachable paths despite engagement risks. Retreat planning has no guaranteed execution of the chosen safe destination after a failed disengage. Fix costing/risk before drawing balance conclusions for slow/short-range kits.
- Crossbow bot compare 100 AP sustained cycle, but preserve opener burst value; seek protection during reload. Dual bot uses expected one-secondary, not all candidates. Javelin bot considers both modes without changing threat. Colossal bot requires AP-safe exit or accepts damage explicitly, and prefers sweep only when extra coverage pays for commitment.
- Setup `Screens.tsx` replace STARTERS with shared selectable catalog and two slots; display patterns per mode, AP, skills with lock reasons, source/demo tags. ActionPanel adds weapon slots/Swap, Reload, basic mode toggles, basic+proficiency skill rows. Board receives preview tiles plus candidate styling (solid guaranteed/dashed random), supports self-centered ring. Hover/cancel never commits action or RNG.
- Update controller/store, keyboard controls, action serialization, replay/export, share URL and battle-summary names. Migrate old links; include both weapons, starting slot, proficiency/unlock configuration and seed in report. Sim runner must enumerate same catalog and print two-weapon combination metrics separately from single-family baselines.

### 6. Encounter gating and acceptance tests

Story/default Granary: exactly daggers/shield/polearm/two-handed, clothing, one starting item; no bow/crossbow/special weapons and no reserve selection. Preserve this invariant in engine setup validation, not just UI. This is a deliberate tutorial equipment limit, not removal of the general two-slot mechanic. Wolves/cultists/Nephilim sandbox: all six ordinary families, two slots allowed; specials visible with required-combination description and enabled when explicit unlock is on. Story notes only say bows/crossbows arrive “later”, not exactly which fight: choosing wolves as first sandbox test is demo, not canon campaign acquisition. A separate custom laboratory can override tutorial restrictions; do not silently put everything into Granary's story picker.

Golden suite to add beyond supplied probes:
1. Catalog validation: nine player families, exactly two skills on each selectable item, known modes/skills, source costs/ranges, no monster offerings; old link migration.
2. All eight rotations for every directional pattern; dagger diagonal rejection; ring8 invariant; two-handed penalties only on arc5; map-edge/wall/cover/corner and multi-cell fixtures.
3. Crossbow fire→reload→fire AP timeline, must reload next combat action, no swap/skill bypass, miss still unloads, invalid reload/free loaded reload rejected, independent instances and new battle reset.
4. Dual deterministic seeds, exactly two independent strikes at most, eligibility and post-primary death/dodge semantics, no RNG in hover, no footprint weighting.
5. Javelin boundary/LOS/reaction/parry tests and constant equipped engagement; colossal exact eight/line targets and 175 AP.
6. Swap before/after movement, consumes action, no same-turn skill/basic/reload, reserve contributes nothing, both directions restore exact stats without accumulation, cooldown/ammo survive, no reset by duplicate def IDs, replay equality.
7. Proficiency false/true/one family; basic always available; reserve proficiency skill forbidden even via injected action; authored personal skill stays available; identical skill IDs across different items do not share/reset cooldown inadvertently.
8. UI interaction tests: nine choices in unlocked post-tutorial sandbox, four in Granary; keyboard modes/reload/swap; disabled reason matches engine; displayed AP agrees with action; random uncertainty visible.
9. AI exhaustive action legality and no stalls across all families/armor/seeds; assertions for illegal-action fallback count (currently `sim.ts:56` discards `stuck`). Add single-family and two-slot sweeps; report per-weapon damage/turn/utility, reload and swap usage.

## Balance measurement and targets

### Method and exact damage formula

`tools/review-weapons-math.ts` imports live gear/unit data and computes each implemented item's expected physical damage per 100 action AP against all five enemy defenses. Level 1, unflanked, not dazed, no movement, no target HP cap, no reaction AP charged to attacker, default crit .05 ×1.5. This is an isolated strike budget, not full-fight DPS. Higher-level raw damage follows DAMAGE_SCALE; because rounding happens after mitigation/crit, recalculate instead of simply multiplying final table cells.

Let A=max(0, armor*(1-pctPen)-flatPen). Land probability is clamp(hit-penalty,.05,.95) × (1-dodge) × (1-parry for melee) × (1-block); immobile target skips dodge. Expected damage = Land × [.95*max(1,round(raw*100/(100+A))) + .05*max(1,round(1.5*raw*100/(100+A)))] ×100/AP. This matches engine `strike` rounding. `queries.expectedStrike` currently rounds normal damage then scales by average crit, so it is slightly approximate rather than exact; this small rounding difference is not the main imbalance.

Enemy inputs from units.ts / gear.ts:

| Enemy | Armor | Dodge | Parry | Block |
|---|---:|---:|---:|---:|
| Rat | 0 | .15 | 0 | 0 |
| Wolf | 50 | .20 | 0 | 0 |
| Cultist fighter | 75 | .08 | .05 | .25 |
| Cultist mage | 25 | .10 | .05 | 0 |
| Nephilim | 100 | 0 (immobile) | 0 | 0 |

See **review-math.md** for the complete table (11 implemented items × five defenses), with single-target / homogeneous full-pattern total in every cell. Key player rows:

| Weapon | Rat | Wolf | Fighter | Mage | Boss |
|---|---:|---:|---:|---:|---:|
| Daggers | 69.04 | 47.66 | 33.11 | 63.20 | 43.30 |
| Shield | 59.94 | 40.41 | 27.77 | 52.26 | 37.55 |
| Polearm | 62.23 | 43.38 | 30.48 | 55.91 | 40.49 |
| Two-handed primary | 62.53 | 45.05 | 32.27 | 57.41 | 43.46 |
| Bow stationary | 65.72 | 43.80 | 32.02 | 60.97 | 40.43 |
| Bow moved (attack cost only) | 39.43 | 26.28 | 19.21 | 36.58 | 24.26 |

Shield and polearm peak at twice these single-target values. Axe five-target totals are 264.57/190.61/136.54/242.87/183.88 after side penalties (not 5× primary). These hypothetical maxima require distinct homogeneous enemies occupying all pattern cells, not multiple hits on one boss. Movement, spacing, dodge displacement, overkill and reaction delays make actual returns lower/different. Basic dagger efficiency is already strong; its cultist problem is NOT low raw single-target DPS. Daggers' 45-damage hit also overkills a 25-HP tutorial rat; heavy weapons waste more damage.

Candidate calculated single-target totals vs rat/wolf/fighter/mage/boss, not simulations:
- Crossbow 85/.85/.15 pen/5 flat: 62.97/43.21/32.43/57.26/40.97 per 100 AP fire+reload cycle. First-shot damage per 100 fire AP alone is double, but advertising that as sustained DPS would be wrong.
- Dual two 42-damage strikes: 62.21/41.82/28.58/55.09/38.33 if same target survives in range for second. If first kills, overkill is lost; if others occupy arc, the second can redirect. Do not multiply this row again by five.
- Javelin melee: shield single-target row; throw: 47.95/32.17/23.38/44.40/29.62. Versatility/defense compensates for no pair cleave.
- Colossal per target: 48.40/33.06/23.79/41.10/32.48; multiply by 2 for distinct line targets or 8 for full ring, no side penalties. Strong when surrounded, weak into one target; 175 AP timing is the cost.

### Baseline bot table

Command: `npx tsx tools/sim.ts 40 all`, seeds 1000–1039 per cell, default config. Full output is **review-baseline.txt** (40 cells, 1,600 battles). Wins below expressed at exact 2.5-point sample resolution inferred from the runner's rounded percentage output; HP is the runner's rounded mean across all outcomes, not wins only. Each row is light/medium/heavy except Granary clothing.

| Encounter | Weapon | Win % L/M/H | HP-left % L/M/H |
|---|---|---|---|
| Granary | daggers / shield / polearm / two-handed | 100 / 100 / 100 / 100 (clothing) | 82 / 74 / 78 / 62 |
| Wolves | daggers | 100 / 100 / 100 | 77 / 76 / 73 |
| Wolves | shield | 100 / 100 / 100 | 81 / 77 / 69 |
| Wolves | polearm | 100 / 100 / 100 | 70 / 75 / 75 |
| Wolves | two-handed | 100 / 100 / 100 | 76 / 75 / 68 |
| Cultists | daggers | 55 / 95 / 100 | 14 / 33 / 39 |
| Cultists | shield | 82.5 / 100 / 90 | 29 / 45 / 36 |
| Cultists | polearm | 100 / 97.5 / 92.5 | 56 / 50 / 45 |
| Cultists | two-handed | 85 / 87.5 / 82.5 | 48 / 49 / 42 |
| Nephilim | daggers | 100 / 97.5 / 90 | 93 / 86 / 83 |
| Nephilim | shield | 92.5 / 92.5 / 85 | 80 / 74 / 75 |
| Nephilim | polearm | 80 / 92.5 / 67.5 | 63 / 65 / 63 |
| Nephilim | two-handed | 95 / 87.5 / 75 | 61 / 68 / 60 |

Direct engine-only bow experiment (not UI implementation), 40 seeds/cell, **review-bow.json**:

| Encounter | Bow win % L/M/H | HP-left % L/M/H |
|---|---|---|
| Wolves | 100 / 100 / 100 | 70.8 / 70.0 / 69.0 |
| Cultists | 95 / 97.5 / 95 | 52.7 / 57.5 / 40.1 |
| Nephilim | 75 / 77.5 / 97.5 | 39.4 / 46.9 / 55.8 |

No stalls in baseline or reviewed variants. The bow boss armor reversal warns against “heavy armor always worse” conclusions: survivability against targeted rock attacks changes the tradeoff. Two bows in the boss party also differ from a melee Jubal + existing archer configuration.

### Explicit proposed acceptance targets (demo, not Aaron's promises)

1. Granary every starter ≥95% wins, no stalls, median surviving HP ≥50%, clear basic identity; current baseline passes observed win/mean-HP criteria, but median HP was not collected by the stock runner and is not claimed verified.
2. Later encounters, compare same armor/party/seed budget: each weapon within ±15 percentage points of weapon-median win rate, no cell below 70% after a competent bot; small-n uncertainty means this is a screening threshold, not a significance claim. Repeat 400 seeds plus human trials before release tuning. Do not enforce cross-armor equality.
3. No strict dominance on range, single-target AP efficiency, AoE, defense, burst and mobility together. Each family must win a controlled niche fixture: dagger fast finisher; shield protected doorway pair; polearm two aligned targets; axe five-cell arc; bow safe long-range sustained; crossbow opening armor burst; dual adjacent two-strike/cleanup; javelin hybrid without swap tax; colossal surrounded ring.
4. Pure single-target unarmored expected damage/100 AP: approximately 60–70 daggers/bow/dual/crossbow; 55–65 shield/polearm/axe; 45–55 colossal. Javelin thrust ~55–65, throw ~40–50. Against armor 100, recheck ~35–45 for ordinary basics and ~30–35 colossal; confirm skill utility, not just basic DPS.
5. No RNG mutations from previews; no illegal bot action fallbacks/stalls; every mode used in appropriate fixture; reload/swap AP included in throughput. No weapon purchase/access power tax counted as balance in a sandbox with all unlocked.

### Tested numeric candidates and recommendation

A. **Throwing Knife damage multiplier .60→.80** (75 AP and cooldown 150 unchanged), isolated in-memory mutation only via `tools/review-weapons-sim.ts knife`. Cultists daggers L/M/H: 55/95/100 → **62.5/97.5/100** wins, HP → **19.1/40.7/43.1%**, mean fight AP → **650.4/646.9/645.4** from 693.5/717.6/697.3. Boss daggers → **100/97.5/92.5** (from 100/97.5/90), HP **93.8/85.5/83.4%**. Recommend this as a modest trial utility buff, not a balance-complete fix. Helps reach without buffing already-strong basic tempo. Per-shot raw damage rises by one third; outcomes need not rise proportionally. Inspect human dagger routing and bot focus/path risk before any larger buff.

B. **twoHandedNearPenalty .10→.05, far .20→.15**. `npx tsx tools/sim.ts 40 cultists twoHandedNearPenalty=0.05 twoHandedFarPenalty=0.15`. Axe L/M/H wins **85/87.5/80**, baseline **85/87.5/82.5**. Slight HP/time changes, no reliable win improvement. Also changes Jabal in every party; therefore not isolated to Jubal axe. **Do not adopt as a parity fix** based on this sample; keep existing penalties pending large-seed/AoE fixture testing.

C. **bossBreakFreeAt 1300→1400**, source AP untouched. `npx tsx tools/sim.ts 40 nephilim bossBreakFreeAt=1400`. Daggers **100/100/100**, shield **95/100/92.5**, polearm **85/100/82.5**, axe **95/90/82.5**. Improves weakest slow/heavy polearm cell **67.5→82.5%**, axe heavy **75→82.5%**; keeps measurable HP attrition. Recommend 1400 as an optional less-punitive tuning preset, not a weapon fix or automatic default: it also makes daggers universally win in this sample. Re-evaluate after all nine families, correct bow costing and human timing tests.

Do not nerf polearm's raw damage solely because it clears cultists well: it is already weak in boss heavy armor. Do not make daggers attack diagonally or reduce source costs to fix parity; that erases identity. Keep authored companion club numbers distinct from player axe; they are not competing shop items. Special-family defaults above need simulations after implementation; the report makes no win-rate claim for them.

### Bot and metric caveats

- `ai.ts:87–93` expected-damage plus kill reward is not damage/time optimization; high burst overkill can win score. Basic tempo differences are underweighted by small `.04*AP` penalty (:366–367).
- `queries.ts:165–173` future-position previews also evaluate flank state against original units, not a fully hypothetical board. This can misvalue a new flank; treat preview/bot planning as a separate correctness follow-up.
- Reachability lists probabilistic escape paths; the bot does not weight their failure chance when committing to future attack/retreat. Daggers' short cardinal range demands positioning. Slow attacks can lose a later escape turn even with high expected damage.
- Boss danger anticipates sweep but evaluates exposed rocks for ranged units specially (:315–331); it does not provide full adversarial future enemy planning. Ranged movement surcharge omission further distorts planning.
- Global arc overrides affect Jabal and global deadline changes affect all weapons; party synergies mean aggregate win rate cannot uniquely identify a weapon's strength.
- `sim.ts:33–37,56` silently ends illegal bot turns and discards the count. “No stalls” is not proof of no invalid actions; instrument and require zero before claiming a new weapon balanced.
- Stock moveShare uses telemetry.actionAp, which is accrued from active.actionSpent on end turn; actual bow surcharge is charged. Reload/swap must join that path. Full fight time is global clock, not sum of party weapon AP; turns/unit is averaged across party.
- 40 shared seeds support reproducibility and gross outlier discovery only. Changing decisions changes RNG consumption, so samples are paired by initial seed, not identical hit outcomes. Near-100% samples do not prove a guaranteed victory; a few percentage points are not reliable superiority.

## Verification and artifacts

Executed stock baseline, both targeted config overrides, isolated knife candidate, and engine-only Jubal bow experiment. Complete raw outputs/seed records are committed. `src/rules/review-weapons.test.ts`: 13 ordinary passes, 2 expected failures documenting W-04. Full Vitest: 5 files, 57 ordinary passes, 2 expected failures (59 total). `npx tsc -b` passes. No production code changed, no dependencies installed, no vault edits, no main changes, no deployment. Added tools are reproducible review utilities, not shipping weapon implementations.

Reproduction:

```sh
npx vitest run src/rules/review-weapons.test.ts
npx tsx tools/sim.ts 40 all
npx tsx tools/review-weapons-math.ts
npx tsx tools/sim.ts 40 cultists twoHandedNearPenalty=0.05 twoHandedFarPenalty=0.15
npx tsx tools/sim.ts 40 nephilim bossBreakFreeAt=1400
npx tsx tools/review-weapons-sim.ts knife
npx tsx tools/review-weapons-sim.ts bow
npx vitest run
npx tsc -b
```

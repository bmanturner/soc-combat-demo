# Weapons core (W1) — handoff to W2 and balance

Branch: `fix/weapons-core`, based on `8e7e9f5`. Core implementation commit: `5a6097d`. Binding decisions: `../WEAPONS-BRIEF.md`; source specification: `../../soc-review/weapons/REVIEW-weapons.md` §completion specification. No existing weapon/encounter base numbers were retuned.

## Delivered rules

- Nine selectable families: `daggers`, `shield`, `polearm`, `two_handed`, `bow` (item ID `hunting_bow`), `crossbow`, `dual_wield`, `javelin_shield`, `colossal`.
- Explicit modes: ordinary weapons `basic`; crossbow `fire`; javelin `thrust`/`throw`; colossal `line`/`sweep`. Omitted attack `modeId` chooses the first mode for backward compatibility. Unknown modes reject before any RNG use.
- Crossbows start loaded. Basics and both bolt skills unload even on miss/block. Reload is a separate combat action costing 50 AP. Flexible default allows fire → swap → melee and preserves unloaded reserves; strict debt blocks every other combat action until paid. Waiting does not reload. Movement/end-turn remain legal during debt.
- Dual wield resolves the primary, then recomputes living hostile occupants of offsets −2..+2, deduplicates footprints, sorts by stable unit order/ID, and uniformly selects one using the seeded PRNG. Empty pools consume no selection draw. The secondary uses independent strike rolls. No allies enter the pool, even with friendly fire on.
- Javelin has single-target adjacent thrust and LOS throw at inclusive range 2–4. Throw costs 125 AP independent of movement. Its shield/engagement belong to equipment, not selected mode. Unlimited throws are explicitly demo.
- Colossal line reuses `line2`; sweep hits the eight-cell ring once per unit at 175 AP, independent of aim. No arc5 side penalties. Self-click is supported. Empty sweeps reject.
- Two independent carried item instances, one equipped slot. Swapping consumes the combat action, costs `weaponSwapAp`, and immediately rebuilds defense/engagement from base armor/template plus the new item. It never stacks stats or resets HP/status/ammo/cooldowns. Movement before/after remains available. `readyAt` is absolute per item; duplicate definition IDs have independent instance IDs and cooldown maps.
- All nine selectable items own the two skills in the specification, including basic skills available without proficiency. Individual `unit.proficiencies` and the sandbox switch gate proficiency skills. Reserve skills cannot be injected via actions or the legacy cached `unit.skills` list. Explicit personal abilities remain available. Jabal and the hired archer retain their exact authored fixed kits.
- Engine setup validation enforces four melee starters / clothing / one item in Granary; the other encounters permit all unlocked families and optional reserve. Unknown/non-player definitions, locked specials, invalid/empty equipped slots and duplicate instance identities reject.
- Legacy `Setup.weaponId` input is accepted through `normalizeSetup`; modern callers supply `weaponIds: [primary, secondary|null]` and optional `equippedSlot` (default 0). `state.setup` preserves the canonical **starting** loadout separately from in-battle swaps for W2 share/replay work.
- Explicit reload/swap events include AP, slot and names. `UnitTelemetry.reloads/swaps` count use; normal action AP settlement includes these actions. Sim statistics include per-equipped-weapon useful damage, spent AP and turns.

## Settings and provenance

All new SETTINGS entries are `demo` and therefore automatically supported by the existing config sanitizer/share-config encoder:

- `proficientAllWeapons=true`; `unlockSpecialWeapons=true`.
- `crossbowReload='flexible'`, options `flexible` / `strict`; rationale quotes both actual Aaron sentences.
- `weaponSwapAp=50`, range 25–100, step 5.
- Weapon tuning: `wpn_<family>_dmg=1` (0.5–1.5, step .05), `wpn_<family>_hit=0` (−.2..+.2, step .01), all nine families. Multipliers/additions cover every mode and item skill, including the named javelin skill mode; scaling derives from immutable definitions rather than repeatedly scaling swapped caches.
- Enemy tuning: `enemy_<template>_hp=1` and `_dmg=1` (0.5–1.5, step .05) for `small_rat`, `wolf`, `cultist_fighter`, `cultist_mage`, `nephilim`. Damage includes raw-damage spells and configured boss effects.

Weapon/skill definitions carry `provenance: { concept, numbers, why }`. Weapon `numbers='tentative'` refers to existing Drafts/09 raw-damage budgets (including crossbow 85), not accuracy/reactions. New special-family damage and every skill's numeric parameters are demo. `fieldProvenance` makes ownership/status/rationale explicit: weapons expose `fields`, `attack`, and `modes[modeId]`; skills expose a field-name map. Source AP entries quote Aaron; accuracy, penetration and reaction amounts remain demo. Heavy Daze has source concept but demo numbers. Weapon/skill blurbs no longer repeat tunable numerical budgets.

## W2 API contract

Primary public surface: `src/rules/queries.ts`; underlying equipment rules: `src/rules/equipment.ts`.

| API | Contract |
|---|---|
| `availableWeapons(encounterOrId, config)` | Encounter-allowed, unlocked player definitions only. `PLAYER_WEAPON_IDS` is the full nine-item catalog for showing locked choices. |
| `weaponLockReason(weapon, config)` | `null`, or Juggernaut / Hoplite / Dual-Wielder plus the source tree combination. |
| `normalizeSetup(setup)` / `validateSetup(enc, setup, config)` | Legacy input conversion / authoritative validation. |
| `equippedItem(unit)` | Instance identity, loaded flag, per-skill absolute ready times. |
| `equippedWeapon(state, unit)` | Current definition, modes, skill slots, provenance and access. |
| `effectiveStats(config, unit)` | Pure equipment-derived legacy combat fields. `refreshEquipment(state,unit)` is a **mutating engine/fixture utility**, never call it on the real state from hover. |
| `attackModes(state, unit)` | Scaled profiles, stable mode IDs; no selected-mode state on units. |
| `availableSkills(state, unit)` | Exactly legal ownership slots plus personal skills: `{id, readyAt, instanceId}` (personal has `null`). Cooldown/acted/ammo legality is separately checked by `skillUseReason`/`skillReady`. |
| `previewAttack(state,u,anchor,from=u.pos,modeId?)` | Pure hypothetical-board preview, or null. Direct AP, `cycleAp` (includes reload), mode and item identity, exact per-strike hit/land/damage, guaranteed `targets`, optional stochastic `candidates`, and uncertainty note. |
| `attackOptions(state,u,from?)` | Enumerates every legal mode/anchor; each result includes `modeId`. |
| `previewSkill(state,u,skillId,anchor,from?)` | Ownership/cooldown/ammo/action-gated preview using the skill's fixed `modeId`, not UI intent. |
| `previewReload(state,u)` / `previewSwap(state,u,slot)` | Active-unit non-target previews: `{valid,reason,apCost,nextTurnIn,slot,instanceId}`. For timeline ghost use their `nextTurnIn`; for attack/skill use `projectedNextTurn(state,p.apCost)`. |
| `dualWieldCandidates(state,u,anchor)` | Stable deduplicated pool with uniform `probability`, no RNG. Re-exported from targeting. |
| `colossalRingTiles(unit)` | Fixed eight coordinates, aim-independent. Re-exported from targeting. |
| `combatActionReason`, `skillUseReason`, `reloadReason`, `swapReason` (equipment module) | Shared rule reasons; engine independently enforces them. |

New action payloads:

```ts
{ type: 'attack', unitId, target, modeId: 'throw' }
{ type: 'attack', unitId, target: unit.pos, modeId: 'sweep' }
{ type: 'reload', unitId }
{ type: 'swapWeapon', unitId, slot: 1 }
```

Do not add a separate attack intent to `UnitState`, mutate `unit.attack` for mode selection, copy skill cooldowns between items, or infer melee threat from the selected profile's `ranged` flag. Keep intent in the controller/UI and invalidate it on turn/item context changes. For a dual preview, style only the primary as guaranteed; candidates mean **one random secondary**, never ordinary guaranteed hits.

### Scope deliberately left for W2

Only the existing single-slot setup list was switched to the shared catalog; controller now passes `weaponIds: [selected,null]`, sanitizes selection across encounters/settings, and existing UI/e2e paths remain intact. Full two-slot store/setup UI, mode/reload/swap controls, provenance/lock tags, candidate board styling, keyboard, two-slot share serialization/report names, and new family e2e playtests remain W2 work. Until those controls land, manual crossbow reloading and alternate-mode selection require a rules action/bot, not an invented UI affordance. Existing legacy links still start correctly through the normalization/validation path.

## AI and simulation contract

Both policies enumerate all mode/target options and ready owned skills with shared AP/movement/preview helpers. Crossbow utility prices its full reload cycle; strict debt reloads immediately, flexible may choose a paid useful melee swap. Swap evaluation discounts the reserve's follow-up damage by swap+attack AP, requires a 25%+5 utility margin, and allows no immediate swap-back (two intervening turns). Existing post-action danger movement runs after reload/swap. Colossal modes use the same AP commitment / retreat / failed-disengagement risk scoring as other attacks; javelin modes do not change threat.

Dual AI scores one probability-weighted secondary, caps useful damage and discounts lethal-primary survival. Its secondary estimate is deliberately approximate, as allowed by the specification's first-version conditional-preview option: it does **not** integrate every primary crit/dodge displacement outcome and pool redistribution. The UI note explicitly labels the conditional pool. Exact execution/replay is deterministic; previews never draw RNG.

`tools/sim.ts` enumerates encounter-allowed catalog × clothing (Granary) or light/medium/heavy (other encounters). `combos=1` adds crossbow+shield, crossbow+two_handed, hunting_bow+daggers, colossal+daggers. Javelin alone is already included and is not duplicated. `policy=expert|novice` and rule overrides remain supported. Every row also emits machine-readable `ROW {...}`; the process exits nonzero for any stall or illegal fallback.

Damage/100 AP is **Jubal's useful landed strike damage**, capped by remaining target HP (including sequential dual hits), divided by attributed **active-turn AP** (movement, action, reload, swap, empty wait and active-turn reaction costs). A swap turn is charged to the incoming weapon. Off-turn reaction/status pushback changes the timeline but is not attributed as active-turn weapon AP; this is not damage per 100 global fight-clock AP. Companions are excluded from this per-weapon measure; win/HP outcomes remain party-wide. Raw per-cell counts and per-weapon damage/AP/turn sums are retained in logs so weighted aggregation is reproducible. These results are baseline diagnostics, not evidence that the new families are balanced.

## Golden coverage and test-first evidence

- `weapons.test.ts`: all nine catalog cases were observed red before catalog implementation; the crossbow cadence, strict/flexible debt, javelin, dual-wield and colossal execution cases were observed red before implementing those execution paths. Field-level provenance assertions were also observed red before metadata implementation.
- `weapon-goldens.test.ts`: broader regression suite (added after the first execution implementation, not claimed as entirely test-first) covers catalog/source AP/modes/skills, engine encounter restrictions, legacy conversion, knobs, tuning parity, all-eight independent-coordinate rotations, dagger diagonal rejection, line obstruction, cover/edge/boss deduplication, empty/invalid modes, reload misses/waiting/action gates, swap before/after movement/stat restoration, independent duplicate items, absolute cooldown/ammo/replay, basic/proficiency/personal/reserve ownership, conditional candidate pool/order/footprint checks, killed/dodged primary recomputation, 100 immutable hovers, javelin range/LOS/no-parry/engagement, and per-mode/per-skill AP/hit/damage/next-turn parity across all nine families.
- AI goldens cover both policies across every encounter-allowed family/armor at seed 1000 in strict mode, plus flexible opener and strict debt choice/no-immediate-swap-back.
- Existing tests were not removed or skipped. The old fixture that granted a shield skill by mutating cached `skills` now grants a `personalSkills` entry; the ranged-flanker fixture changes equipment `canEngage` rather than intent `attack.ranged`. Test-only monster gear is installed by the laboratory helper after constructing a legal setup, never by weakening production gates.
- Geometry conventions preserved, not mislabeled canon: ranged distance is to the nearest occupied footprint tile while LOS uses the clicked tile; line2 stops at wall tiles but not low cover, with no new diagonal corner-blocking rule.

## Verification and baseline

- `npx tsc --noEmit -p tsconfig.json`: exit 0.
- `npx eslint .`: exit 0.
- `npx vitest run`: **13 files / 187 tests passed** (final isolated rerun, 13.78s).
- `git diff --check`: clean.
- `E2E_PORT=4184 npx playwright test`: **13 passed** (36.6s), raw output `e2e-weapons.txt`.
- One intermediate property-suite run exceeded its existing 5s test budget while three CPU-heavy sim processes and Playwright ran concurrently. It passed on the isolated final rerun; no test budget, assertion or iteration count was weakened.

### Completed simulations

| Run / raw log | Trials/cell | Cells | Battles | Reloads | Swaps | Stalls | Illegal fallbacks |
|---|---:|---:|---:|---:|---:|---:|---:|
| `npx tsx tools/sim.ts 40 all policy=expert` → `sim-expert.txt` | 40 | 85 | 3400 | 1483 | 0 | 0 | 0 |
| `npx tsx tools/sim.ts 40 all policy=novice` → `sim-novice.txt` | 40 | 85 | 3400 | 1615 | 0 | 0 | 0 |
| `4 all policy=expert combos=1 crossbowReload=strict` → `sim-strict-expert.txt` | 4 | 121 | 484 | 404 | 52 | 0 | 0 |
| `4 all policy=novice combos=1 crossbowReload=strict` → `sim-strict-novice.txt` | 4 | 121 | 484 | 465 | 43 | 0 | 0 |
| `4 all policy=expert combos=1` → `sim-flexible-expert.txt` | 4 | 121 | 484 | 357 | 64 | 0 | 0 |
| `4 all policy=novice combos=1` → `sim-flexible-novice.txt` | 4 | 121 | 484 | 437 | 53 | 0 | 0 |

Each complete log was parsed to verify the expected cell count, unique encounter/loadout/armor keys, and zero stalls/illegal fallbacks. Seeds are 1000–1039 for baseline and 1000–1003 for the combination sweeps. Single-slot baseline swaps are correctly zero. Both strict and flexible combination sweeps exercised real reloads and swaps, not merely action availability.

### Family outcome headline

These are family aggregates across allowed **tested** armors: Granary clothing (40 battles/family), other encounters light/medium/heavy (120 battles/family). Best/worst rank by win rate, breaking ties by party HP-left percentage, then item ID. A displayed worst/best is a representative where multiple families tie. HP is mean remaining party HP on **all** trials, not victory-only. `bow` below means item `hunting_bow`.

| Policy | Encounter | Best family | Win | HP left | Worst family | Win | HP left |
|---|---|---|---:|---:|---|---:|---:|
| expert | granary | daggers | 100.0% | 87.0% | two_handed | 97.5% | 61.2% |
| expert | wolves | colossal | 100.0% | 77.9% | crossbow | 99.2% | 69.0% |
| expert | cultists | shield | 99.2% | 59.7% | daggers | 87.5% | 44.8% |
| expert | nephilim | polearm | 99.2% | 79.9% | bow | 75.0% | 35.3% |
| novice | granary | daggers | 100.0% | 87.3% | two_handed | 97.5% | 61.2% |
| novice | wolves | colossal | 100.0% | 77.2% | daggers | 99.2% | 73.1% |
| novice | cultists | crossbow | 99.2% | 58.4% | colossal | 94.2% | 55.2% |
| novice | nephilim | bow | 68.3% | 18.8% | colossal | 0.0% | 0.0% |

### Useful damage / 100 active-turn AP

Pooled damage divided by pooled AP from single-family baseline rows, across all encounters/armors where that family is allowed. This is not the arithmetic average of rounded per-cell ratios. Existing four starters include Granary; other families start at Wolves. Level and encounter mix differ, so use the raw per-cell logs for controlled balance comparisons.

| Family | Expert | Novice |
|---|---:|---:|
| daggers | 31.77 | 31.90 |
| shield | 32.29 | 33.74 |
| polearm | 38.46 | 36.01 |
| two_handed | 37.77 | 35.04 |
| bow | 32.81 | 42.56 |
| crossbow | 38.91 | 46.39 |
| dual_wield | 29.43 | 28.48 |
| javelin_shield | 34.72 | 35.84 |
| colossal | 31.94 | 31.48 |

**Balance handoff:** novice Nephilim remains a major difficulty/kit spread, and dual wield has the lowest pooled useful damage/AP in these policies. Do not infer a retune from the pooled table alone: inspect armor-specific rows, action selection and the approximate dual-secondary utility first. No balance claim or numeric retune is part of W1.

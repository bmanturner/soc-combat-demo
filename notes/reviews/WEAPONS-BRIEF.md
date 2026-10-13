# Weapons phase brief (Multivac decisions on top of the reviewer spec)

The base spec is `/home/needz/Dev/personal/soc-review/weapons/REVIEW-weapons.md`, section "Implementer-ready completion specification" (lines 71–202). Follow it except where a decision below overrides it. Balance targets are in the same file at lines 270–277.

## Decisions (overrides and resolutions of the spec's open choices)

1. **Families.** Nine player families: `daggers`, `shield`, `polearm`, `two_handed`, `bow`, `crossbow`, `dual_wield`, `javelin_shield`, `colossal`. Use the spec's initial numbers for the new ones and keep the current values for the existing ones. The balance phase retunes them later.

2. **Encounter gating.**
   - Granary allows exactly the four melee starters, one slot, clothing. Enforce this in engine setup validation, not just the UI.
   - Wolves, Cultists and Nephilim allow all nine families and two carried weapons (the second slot is optional; the default is none).
   - Jabal and the hired archer keep their authored fixed kits.

3. **Sandbox switches** (RulesConfig, status `demo`, serialized in share links):
   - `proficientAllWeapons`, default **true**. Why: the demo has no skill trees, so Aaron sees every weapon's second skill. Turn it off to see the unproficient kit.
   - `unlockSpecialWeapons`, default **true**. Why: the specials need Tier-2 tree combinations that the demo doesn't model, so it's on for testing. Turn it off to see the normal-weapon roster.
   - When these are off, the UI explains the lock with the source combination (Juggernaut / Hoplite / Dual-Wielder; Soldier / Savage / Rogue proficiency).

4. **Crossbow reload policy.** Setting `crossbowReload`, a select with options `flexible` (default, demo) and `strict`.
   - **flexible:** the crossbow starts loaded. Firing (basic or bolt skill) unloads it, even on a miss. A 50 AP reload combat action is required before it can fire again. Swapping away is allowed and the item stays unloaded; you can't fire it again until it's reloaded.

     Why: the docs call it a frontline opener ("fire at range before engaging in melee"), and fire→swap→melee makes that real. "Can only be fired once every two turns" still holds, because a reload always sits between shots.
   - **strict:** the literal reading ("must be reloaded on the character's next turn"). The next combat action must be the reload, and swapping or skills are blocked until it's paid.
   - The `why` text quotes both source sentences.

5. **Weapon swap.**
   - `weaponSwapAp`: default 50, min 25, max 100, step 5, status `demo`.
   - A swap consumes the combat action. The new weapon's attack and skills can't be used until a later turn (source).
   - Defenses and engagement switch immediately, derived from the equipped item (no incremental stat stacking).
   - Cooldowns use absolute `readyAt` per item instance.

6. **Javelin.** Unlimited throws (no retrieval rule in the source; label it demo). Engagement is equipment-level, so the wielder still engages while "throw" is selected.

7. **Dual wield.** Exactly as the spec's deterministic resolution: a five-cell ring at offsets −2..+2 around the primary; uniform pick among living hostile units after the primary resolves; seeded RNG only; previews never consume RNG.

8. **Colossal.** Two modes: `line` (line2) and `sweep` (ring8, each unit once, aim-independent; trigger by clicking self or the Sweep mode button). There are no arc5 penalties.

9. **Second skills.** Use the spec's skill table. All new names and numbers are `demo`. `modeId` goes on SkillDef, and `consumesBolt` goes on crossbow bolt skills.

10. **Tunability (D-07).** Add SETTINGS group "Weapon tuning":
    - `wpn_<family>_dmg`: multiplier, 0.5–1.5, step 0.05, default 1.
    - `wpn_<family>_hit`: additive, −0.2..+0.2, step 0.01, default 0.

    These apply to every mode and skill of that family. Add group "Enemy tuning":
    - `enemy_<template>_hp`: multiplier.
    - `enemy_<template>_dmg`: multiplier.

    Cover rats, wolves, zealots, seer and nephilim (use actual template ids). Base numbers stay in content; the balance phase edits the base numbers, and these multipliers stay at 1 for Aaron.

11. **Provenance (D-08).** Weapon and skill defs carry concept vs numbers provenance, e.g. `{ concept: 'source', numbers: 'demo' }`. Heavy Daze's concept is source; its numbers are demo. Setup and tooltips show a small tag. Strip hardcoded numbers out of blurbs, or derive them from config.

12. **Golden tests.** Add the spec's golden list, plus the D-09 crossbow cadence golden (fire 50 / reload 50 / fire).

13. **Sim.**
    - `tools/sim.ts` enumerates the encounter-allowed catalog. The default run gives single-family rows for all allowed families × armors.
    - Add `combos=1` to also run a few two-slot combos: crossbow+shield, crossbow+two_handed, bow+daggers, javelin_shield alone, and colossal+daggers.
    - Report reload/swap usage and per-weapon damage per AP.
    - Strict mode needs 0 illegal fallbacks and 0 stalls with both `policy=expert` and `policy=novice`.

## Split into two sequential implementers

- **W1, core:** types, content, engine, targeting, queries/previews (incl. shared AP helpers), AI/bot usage of all modes, reload, swap and skills, sim, config settings, golden tests. A minimal UI touch is allowed only to keep compile and e2e green.
- **W2, UI:**
  - Setup: two slots, nine families, lock reasons, provenance tags, pattern diagrams per mode.
  - ActionPanel: mode toggles, Reload, Swap, slot badges, loaded state, basic + proficiency skill rows.
  - Board: dual-wield candidate styling (solid primary, dashed "one random"), colossal ring preview, javelin mode previews.
  - Share links and reports: both weapons, legacy `w=` migration.
  - Keyboard.
  - e2e for each family.
  - Hands-on browser playtest.

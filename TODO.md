# TODO: canon content for the combat demo

Recommended additions from the canon audit (`notes/canon-audit/CANON-AUDIT.md`, §2 "canon gap" rows). Ordered by effort, existing-piece reuse and value to the prototype questions (Drafts/10 §1; Prototype Scope › Prototype Goal). Effort: S / M / L, relative.

Open questions for Aaron ship as labeled demo defaults with a setting, per "Don't block on Aaron" (PRODUCT.md).

In progress elsewhere (not listed below): the bandit fight (fighter + archer) and the rat brood mother.

## Prerequisite

- [ ] **Playtest telemetry in the result report**: unspent AP at turn end, multi-target hits per weapon, catch reasons, KOs, next-turn ghost green-then-caught; JSON export (CA-27). Without it, new content adds play but not measurement.

## Wave 1: cheap, reuses existing pieces

- [ ] **Rubble cover in the boss arena** instead of timber boxes (S). The cover lesson relies on debris; boxes read as crates (CA-10).
- [ ] **Cultists at the boss**: encounter variant with 1–2 Zealots or a Seer (S). E&E › First Boss: "Cultists are trying to free him when the party arrives." Tests target priority under telegraph pressure (CA-86).
- [ ] **Giant rats**: granary variant with a Large rat (45 HP / 25 Armor, Tentative Math) (S). Matches "giant rats" and Tubal-Cain's "something large"; re-checks the slow-starter trap (CA-59).
- [ ] **Movement-speed bonus setting**: −10% move AP (S). Trans › Mechanics: Movement / Armor AP; helpers exist in `formulas.ts` but are unused (CA-35).
- [ ] **Avoidance-cap setting**: 70–75% total dodge/block/parry (S). Trans › Combat Resolution (CA-80).

## Wave 2: weapon identity

- [ ] **Axe + shield and mace + shield variants, and Jabal's shepherd's staff** (M). Data, 3D props, and a golden test for the penetration profiles. Exercises Aaron's profiles (sword/dagger flat-heavy, axe mixed, blunt %-heavy) (CA-84, CA-55).
- [ ] **Proficiency presets**: Soldier / Savage / Rogue / Tier 2 pairs, instead of only the all-on switch (S–M) (CA-85).

## Wave 3: party and skills

- [ ] **Mercenary pick before the boss**: archer / spear + bow ranger / warrior (M). Trans: "selects from a handful of characters". Tests whether the boss works without a dedicated archer (CA-15).
- [ ] **Aaron's example skills** (M):
  - Rain of Arrows, reusing the delayed AoE.
  - Fan of Knives, which needs a new cone shape.
  - Teleport-backstab, which needs a new move-and-strike skill.

  Source: Trans › Weapon Skills (CA-69).
- [ ] **Basic weapon skill from level 1**, mostly a gating change (S). Trans: "Anybody can use this first basic skill" (CA-62).

## Wave 4: chained play

- [ ] **Gauntlet mode** (L): chain encounters with full recovery between them, and add the missing fights:
  - more ruin cultist fights;
  - valley bandits, once the bandit fight lands;
  - mine cultists with terrain.

  Without this mode, "does full recovery make fights sharper?" can't be tested.
- [ ] **Mine lighting**: lamps and shafts of light (S–M). From Drafts/08 › Color Philosophy (CA-42).

## Not now

- Elemental damage and the full status/buildup system: Prototype Scope › Prototype Goal doesn't require it, and Drafts/10 §4 put it out of scope.
- Weapon passives and item-specific skill variants: these need inventory/loot first (CA-82, CA-83).

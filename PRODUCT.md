# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Aaron, the game's designer (primary).** He plays encounters and tunes the rules to decide how Sons of Cain's combat should work before a full engine implementation exists. He judges whether rules are fun, fair and faithful to his canon, and sends feedback through result reports and setup links.
- **First-time playtesters.** People who have never seen the rules play the encounters cold, so the demo can measure human balance rather than bot benchmarks. They need to learn the AP timeline from the demo itself.
- **Brendan (builder).** Builds and maintains the sandbox under a "fun and challenging, don't block on Aaron" mandate, and runs simulations and balance passes.

## Product Purpose

A browser combat sandbox for Sons of Cain's AP-timeline tactics. AP spent on a turn determines when that unit acts next; it is not a per-turn action budget. Movement has its own separate budget. The demo makes it possible to play the encounters, swap loadouts, change rules live, and compare outcomes, so that unresolved design questions are answered by play rather than speculation.

Success: Aaron and playtesters can reach a confident judgment about a rule or number by playing it, and that judgment travels back as a reproducible setup plus telemetry.

## Positioning

A rules instrument that is honest about where every number comes from. Each weapon, skill, unit, armor value and rules control is labeled as Aaron's canon, tentative math or a demo default, with its rationale. Previews (movement risk, damage, reactions, next-turn ghosts, escape outlook) use the same rules code as execution, so what the player is shown is what the engine will do on the current board.

## Operating Context

- Desktop browser, typically a laptop or larger display. The battle screen is a three-column layout: actions, board, incoming threats and combat log.
- Core loop: choose encounter → choose a two-slot loadout and armor → fight (manually or with the party bot) → read the timeline and incoming threats → tune rules in the Rules drawer → copy the result report or share link.
- Share links reproduce encounter, loadout, seed and rules — not an action replay. The same seed only reproduces a fight if the action sequence also matches.
- Board can be shown in 2D (Phaser) or 3D (three.js). The two are equal alternatives chosen by the player, drawing the same overlays, labels and animations.
- Balance work runs offline through `tools/sim.ts` (expert and novice bot policies) and the notes under `notes/balance/`.

## Capabilities and Constraints

- Seven encounters: The Granary (tutorial), The Rat Nest (brood mother), Road Wolves, Bandits on the Trail, The Ruined Shrine (cultists), Valley Road Bandits, The Trapped Nephilim (boss).
- Nine weapon families with modes, two carried slots, paid swapping, reload/cooldown state, basic and proficiency skills.
- Party: Jubal (player-chosen loadout) with companions Jabal and the Hired Archer; Tubal-Cain offers the weapon in setup.
- Rules core is pure deterministic TypeScript (seeded RNG, no DOM). Golden and property tests are intended to serve as an executable spec for a future engine port.
- Rule changes restart the fight. Not every open design question is an exposed control.
- **Open decision:** what happens to this demo once the real engine exists — retired as a spec, or kept as a living tuning tool — is undecided.

## Brand Commitments

- Name: "Sons of Cain — Combat Demo".
- Setting language from canon: Cainites, Jubal, Jabal, Tubal-Cain, the Nephilim. Biblical/mythic register.
- Source priority is binding: Aaron's Transcriptions > non-tentative published docs > drafts > tentative proposals > demo defaults. Never relabel demo or tentative values as canon, and never relabel Aaron's legitimate concepts as invented.

## Evidence on Hand

- Encounter story, lesson and unit copy: `src/content/encounters.ts`, `src/content/units.ts`, `src/content/gear.ts` (with provenance metadata).
- Balance method, bot benchmarks and recommendations: `notes/balance/` (bot results are screening data, not human balance).
- Review findings and fix records: `notes/reviews/`, `notes/final-rules/`.
- Canon design documents (Aaron's Transcriptions, published Combat System / Weapons / Enemies and Encounters) live in an external vault, not this repository.
- No human playtest results, testimonials or player data exist yet. Do not fabricate them.

## Product Principles

1. **What you see is what the engine does.** Every preview, warning and number comes from the same rules code as execution, and is described as a current-board estimate, never a promise about future AI moves or random outcomes.
2. **Provenance is always visible.** A value's source tier is part of its meaning; tuning surfaces must keep canon, tentative and demo distinctions legible.
3. **Teach the timeline through play.** First-time playtesters should understand "AP spent = delay" and escaping a telegraphed blow from the board and timeline, not from reading the rules.
4. **Protect the feedback loop.** Results, reports and setup links must always be recoverable, so a judgment made in play reliably reaches Aaron.
5. **Don't block on Aaron.** Unresolved rules ship as labeled, tunable demo defaults rather than waiting for decisions.

# Sons of Cain combat demo — consolidated fix plan (from 5 reviews, 2026-10-13)

Review reports (read for full evidence and probe tests):
- notes/reviews/REVIEW-design.md (D-xx), probes src/rules/review-design.test.ts
- notes/reviews/REVIEW-rules.md (R-xx), probes src/rules/review-rules.test.ts, review-rules-stress.test.ts
- notes/reviews/REVIEW-weapons.md (W-xx + full weapon spec + balance targets)
- notes/reviews/REVIEW-ai.md (A-xx), probes tools/probe-ai*.ts
- notes/reviews/REVIEW-app.md (U-xx), probes src/game/review-app.test.ts, tools/playtest-review-*.{ts,mjs}

## Decisions (Multivac, on Brendan's "fun and challenging, don't block on Aaron" mandate)
1. Next-turn delay = AP actually spent (move + action + reaction AP). Only an EMPTY turn (Wait) costs `minTurnDelay` (relabel "Wait (empty turn) costs", demo, min 5). Unit-specific minimum: massive boss uses `bossTurnAp`. (D-01, R-01, R-04)
2. Delayed effects use the same damage modifiers as strikes, incl. Flanked. (D-02)
3. One shared eligibility helper decides who a delayed effect can hit; with `delayedHitsAllies` on it includes the CASTER ("burns everyone inside, cultists included"). Used by resolution, cast-time telemetry (threatenedAtCast/escapes), AI danger, and the Incoming UI. Immune units are never shown CAUGHT nor credited an escape. (D-04, R-06, U-11)
4. Escape = acts before impact (configured tie predicates, shared) AND a safe tile is reachable with its movement budget (report disengage risk). One shared query powers Incoming, preview.ts, board labels, timeline ghost. (D-03, U-04, U-06)
5. Auto-end a turn once the unit has acted and cannot afford another tile of movement. Setting `autoEndTurn` (demo, default on). (D-06)
6. Zero raw damage deals 0; the min-1 floor applies only when raw > 0. (D-13)
7. Per-ability `allowedReactions` metadata; default derived from today's policy (ranged never parried; delayed effects none). Engine and previews read the same field. (D-11)
8. Previews must equal engine outcomes: shared resolvers for skill damage/scaling/config numbers, action AP costs (incl. bow surcharge on hypothetical moves), unit min delays, effect delays, and a coherent hypothetical board for move-then-attack previews (flanking from the new position). timelineEntries uses the scheduler's own comparator. (R-03..R-09, W-04, U-05)
9. Interrupted traversal through allies can never leave two live units on one tile. (R-02)
10. Result telemetry includes the final (winning) action's AP. (U-08)
11. Wolves target the closest body (tie → most damaged/lowest HP). (D-05)
12. Boss: bounded sweep streak — after `sweepStreakCap` (demo, 2) consecutive sweeps, if an exposed ranged unit exists he throws a rock at it instead (telegraph-free but cover blocks). Cover-camping counts consecutive boss turns a ranged unit stays hidden behind the SAME cover tile; moving to different cover resets it (rewards "move when he drops rocks on it"). Settings for streak cap and rock-throw target fallback (ranged-only vs any exposed). (A-01, D-12)
13. Bot/AI utility subtracts ally damage/KO risk; never picks ally-only attacks. Seer paths toward firing positions over multiple turns. Zealots actually screen the Seer (interception tiles, tether), keep pursuing after the Seer dies. (A-02, A-03, A-06)
14. Sim: strict diagnostics (illegal-action fallbacks returned and reported; tests fail on any), no-progress watchdog, and party policies (`expert` = current predictive bot, `novice` = reacts only to existing telegraphs, ignores boss anticipation) selectable in tools/sim.ts. (A-05, R-01)
15. App: serialize apply calls; cancel/settle animations on scene shutdown; restart/menu release loops; validate share links (unknown weapon/armor/encounter, non-finite/oversized seed, garbage config) and never throw; combat hotkeys disabled under overlays; Copy share link in Settings serializes the DRAFT without applying; report link uses the battle's config; result dismissal keyed to a battle generation id; one close-and-reset path for the drawer; Help text and stat lines derived from the active config. (U-01..U-03, U-07, U-09, U-10, U-12, U-13)
16. Weapons (phase 3): all nine families + Jubal bow + two carried weapons with action-consuming swap + basic and proficiency skill per player weapon + encounter-aware availability (Granary: four melee starters only; others: all nine). Weapon/enemy numbers exposed as settings (D-07 scope: per player weapon damage + hit; per enemy type HP + damage multipliers). Provenance split: concept vs numbers (D-08). Golden tests incl. crossbow cadence (D-09).
17. Balance (phase 4): targets from REVIEW-weapons.md §"Explicit proposed acceptance targets", measured with both expert and novice policies, zero illegal-action fallbacks.

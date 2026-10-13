# App-layer review — Sons of Cain combat sandbox

Reviewed branch `review/app`, based on `52886f3`, in `/home/needz/Dev/personal/soc-review/app`. **Review only: no production files changed.** Severity uses the requested rubric (P0 includes hangs/desync/wrong numeric output, not only security catastrophes).

## Outcome and verification

- Production build passed (`npm run build`). Baseline suite: 44 tests passed. Final suite: **49 ordinary passes + 7 expected failures, 56 total, 5 files**. Expected failures are deliberate defect assertions in `src/game/review-app.test.ts`, not fixes. Typecheck passed as part of build.
- Real installed Chromium drove the built app at `127.0.0.1:4180`, using canvas clicks, keyboard and normal HUD controls. All four encounters received manual-style input (script chooses reachable tiles/targets but does not call botAction for those turns), then deterministic retries were bot-completed. This is an automated hands-on UI playtest, not a claim of an unaided human balancing session.
- Browser captured the invalid-loadout exception and reproduced the menu/animation hang, bot concurrency, modal key leak, result dismissal collision, and config-copy divergence. No pageerrors/console errors in ordinary four-encounter play; the malformed weapon link generated `unknown weapon not-a-weapon`.
- Every one of **47 setting rows** was changed through its actual range/checkbox/select control, applied, compared with `battle.config`, copied to clipboard, reopened in a new page and compared again. **Zero roundtrip mismatches.** Reset + Apply restored defaults. This proves UI bindings and serialization, not that every individual rules knob has a separately measured combat-effect test.
- Preview parity probes cover ordinary movement, Wait, bow post-shot movement surcharge, all four starter attack and skill hit/damage/AP expressions (noncritical, reactions disabled), hypothetical sweep equality, unescapable delayed effects, immune targets, last-action telemetry, hostile config decoding and controller animation serialization.
- Preview server was killed using its process handle; a subsequent HTTP probe returned `000` (no listener). No pushes/deploys/installations; main repo and design documents untouched.

## Findings

### U-01 — P0 — Leaving an AI animation permanently strands the controller loop
**Verified: true (real browser).**

- Evidence: `src/board/BoardScene.ts:434-441,465-468` resolves promises only through Phaser timer/tween completion. Scene destroy does not resolve outstanding promises. `src/hud/BoardHost.tsx:20` destroys the game; `src/game/controller.ts:112-125,137-141` leaves `looping=true` until the awaited animation settles. Restart retries only for two seconds and then encounters the same guard.
- Repro: Granary, speed 0.5×, enable Bot; while `busy=true`, click ☰, choose Wolves and Fight. After 4.5 seconds the new battle is still clock 0, actions 0, bot on, busy false. Toggling bot cannot bypass the permanently held loop guard. This is a silent stopped AI rather than a busy-spinner hang.
- Artifact: `tools/review-app-evidence/races.json` first case; screenshot `/home/needz/.hermes/cache/scratch/soc-review-app/menu-ai-hang.png`.
- Fix: give animation jobs explicit cancellation/settlement on scene shutdown and token replacement; abort and release the old loop before starting a new one. A finite sleep/retry is not cancellation.

### U-02 — P0 — Enabling Bot during a manual animation applies actions against stale state
**Verified: true (browser + expected-failure unit probe).**

- Evidence: `controller.ts:89-108` has no serialization/busy guard; `setBotParty` (`192-195`) starts `runLoop`, whose `loopBody` (`130-141`) does not check busy. The manual animation has not committed its `after` state when the bot computes another action.
- Repro: Granary, 0.5×; start manual movement to (5,4), enable Bot during tween. Log commits “moves 4 tiles … (40 AP)” and then “moves 5 tiles … (50 AP)” both from the old position, rather than the second action being computed from the first result. Controlled Animator probe sees **two simultaneous play calls**.
- Related handoff defect: enable Bot and immediately disable it before its think sleep ends: one bot move still commits, with `bot=false`. `loopBody` retains the earlier side/bot decision after sleep.
- Evidence: `races.json` cases “bot on during manual animation” and “bot on then off immediately”; `review-app.test.ts` controller test.
- Fix: serialize all apply callers and recompute active unit/bot ownership/busy after each await; bot enabling should wait for the current transaction. Check cancellation when turning it off.

### U-03 — P0 — Unvalidated shared weapon breaks Fight; seed can overflow
**Verified: true (browser exception + unit probes).**

- Evidence: `src/game/share.ts:44-47` accepts arbitrary weapon IDs and unbounded digit seeds; `src/main.tsx:14` trusts weapon ID; `src/rules/engine.ts:63-64` throws on unknown weapon.
- Repro: fresh page `/#e=granary&w=not-a-weapon`, then Fight: pageerror `unknown weapon not-a-weapon`, battle does not start. Setup is still visible and selecting a valid weapon recovers; this is not a permanently blank app. `s=` followed by 400 nines decodes to `Infinity`.
- Artifact: `races.json`, `playtest.json`, screenshot `.../soc-review-app/invalid-weapon.png`, expected-failure tests for loadout/seed.
- Fix: validate against the allowed starter weapon IDs before hydration, use own-property lookup rather than inherited object keys, bound seeds to a finite supported integer range, and fall back visibly on invalid input.
- Positive check: malformed base64/JSON, unknown config keys, wrong value types, `__proto__` and out-of-range numeric overrides were safely ignored/clamped in the tested cases.

### U-04 — P1 — “Can still escape” checks time only, not whether escape is possible
**Verified: true (rendered Incoming component + engine fixture; code trace).**

- Evidence: `src/hud/Incoming.tsx:33-38,54-61` derives escape solely from next turn versus impact; `src/game/preview.ts:26-33`/`dangerAt` similarly treat an earlier turn as safe. Neither checks a reachable safe tile, movement budget, locked movement or engagement failure risk. Help repeats this promise at `Screens.tsx:329`.
- Repro fixture: delayed effect covers all reachable tiles; the unit gets another turn before impact, Incoming renders “can still escape”, reachable contains no safe tile, and engine records the unit caught. Deep configurable sweep zones/heavy armor and blocked exits are the practical scenario.
- Fix: distinguish “acts before impact” from “can escape”; only claim escape after a next-turn reachability test finds an eligible safe destination, and display engagement risk rather than guaranteed safety. Use the shared classifier in Incoming, ghost and board.

### U-05 — P0 — Board move cost/risk omits the post-shot bow surcharge
**Verified: true (engine/preview parity probe + exact board expression).**

- Evidence: `BoardScene.ts:371-376` uses `projectedNextTurn(b,r.cost)` and labels `r.cost`; `preview.ts:45` correctly includes `bowMoveSurcharge` when a stationary shot is followed by movement; engine adds it at `engine.ts:341-345`.
- Repro: fire a stationary bow shot, then hover an adjacent move. With default 50 surcharge, timeline ghost and eventual next turn are **50 AP later** than the delay used to color the board warning. Board label presents movement-only AP without the surcharge. The problem exists for the normal hired archer, not only the bow loadout used by the compact fixture.
- Fix: consume `pendingFor` or the same surcharge-aware action projection on board and HUD; distinguish movement AP from total extra AP explicitly.

### U-06 — P1 — Hypothetical sweep warning disagrees with effect-tie rule
**Verified: true (expected-failure probe and code).**

- Evidence: `preview.ts:30` and `BoardScene.ts:373` use `landsIn <= projected`, regardless of `tieUnitBeforeEffect`. Incoming (`58`) correctly accepts an equal timestamp when that setting is true. Actual effect ordering uses the configured rank at `engine.ts:189-190`.
- Repro: Nephilim projected next turn exactly at `bossActsIn + sweepDelay` with default units-first. `judge` warns risk and says the sweep lands “before your turn”; Incoming says the unit can get out. A reachable exit at that tie is legal under the engine.
- Fix: use one configured ordering predicate for existing/hypothetical effects; do not describe equality as “before”.

### U-07 — P1 — Combat shortcuts execute through Help/Rules overlays
**Verified: true (real browser).**

- Evidence: `src/hud/App.tsx:69-86` checks only input/select targets and battle screen, not `helpOpen`/`settingsOpen`.
- Repro: fresh Granary, open ?, press Space. Help remains visible but actions becomes 1 and clock advances from 0 to 25. M/A/number keys also change the underlying mode. On later turns Space can commit a lethal wait while the player is reading help or a rule explanation.
- Artifact: `races.json`, “space through help”.
- Fix: suppress combat keys while any modal is open; process Escape before form-target filtering and retain modal keyboard focus.

### U-08 — P0 — Result/report omits the battle-winning action's AP and turn
**Verified: true (engine outcome fixture + report renderer trace).**

- Evidence: totals accumulate only in `engine.ts:255-260` at endTurn, but victory clears active at `622-630` before that turn is ended. `Screens.tsx:143,189-193` prints these totals as completed battle statistics.
- Repro: adjacent 1-HP final rat, hit with 50-AP dagger attack. Victory contains the strike and damage, but telemetry.actionAp remains 0 and turns remains 0 for that fight fixture.
- Fix: account for spent movement/action AP as actions occur (or flush the final active turn exactly once at outcome); define whether turns count starts or completions, then report consistently.
- Additional interpretation caveat: damageTaken/dealt count overkill damage, not HP actually removed. This is not flagged independently because raw damage totals may be intended.

### U-09 — P1 — Copy share link silently changes global settings without changing this fight
**Verified: true (real browser); misleading exact-replay claim verified by code.**

- Evidence: `Screens.tsx:263` calls `controller.applyConfig(cfg,false)` from a Copy button. `controller.ts:197-200` updates top-level config/hash only, while an existing `battle.config` remains the old object. Result copy obtains its link from top-level settings (`Screens.tsx:208`) but its “Changed settings” section from battle.config (`138,153`).
- Repro: start with movement budget 50, open Rules, set it to 80, Copy share link, close. Store config is 80, battle config 50. A later report can describe defaults and link to nondefault rules; subsequent Restart silently switches rules.
- Also, report line 154 says **“Replay this exact fight”** although the URL includes seed/loadout/config only, not `store.actions` or bot decisions. Different manual actions do not replay the exact fight.
- Fix: Copy should serialize the draft without applying it. Keep explicit apply/restart semantics, and generate a battle report's link from that battle's config/setup/seed. Call it “same setup and seed” unless an action trace is serialized.

### U-10 — P1 — Dismissing a result hides future same-seed results
**Verified: true (real browser).**

- Evidence: `Screens.tsx:163-164,214` remembers `seed + clock` as the dismissed identity. ResultOverlay stays mounted over in-battle Restart; a deterministic retry has the same sum.
- Repro: bot-complete Granary seed 1 at 225 AP, choose Look at the board, Restart, finish again. Second fight reaches victory with 19 actions at 225 AP, but `data-testid=result` is absent. Retry/report/loadout actions are not offered.
- Artifact: `races.json`, screenshot `.../soc-review-app/missing-result.png`.
- Fix: key dismissal to a unique battle generation (`boardVersion` or token), not arithmetic on seed/time; clear it on restart.

### U-11 — P0 — Incoming and escape statistics count units immune to an effect
**Verified: true (rendered Incoming + engine fixture).**

- Evidence: `Incoming.tsx:18` includes all occupants without checking source or friendly-side immunity. `engine.ts:596-597` skips the source and optionally its allies when resolving; `castEffect` (`572`) nonetheless records them as threatened, and `resolveEffect` (`605-609`) awards escape if not hit.
- Repro fixture: caster standing inside its own sigil, impact before next turn. Incoming says CAUGHT; engine takes no HP, and telemetry awards an escape despite no movement. With delayedHitsAllies off, same issue applies to friendly occupants. Cultist enemy rows are affected even if the caster is not player-controllable.
- Fix: share a `canEffectHit` eligibility predicate between cast-time threatened tracking, Incoming/danger classifiers, and resolution; immunity is not an escape.

### U-12 — P2 — Escape closes Rules inconsistently and retains a stale draft
**Verified: true (real browser).**

- Evidence: `App.tsx:69` ignores Escape while a form input/select has focus; global Escape (`72`) hides the drawer without invoking `Screens.tsx:232-234` draft reset.
- Repro: focus a slider and press Escape: drawer remains. Change movement budget to 85, click heading, Escape, reopen: 85 draft reappears although it was never applied. The ✕/backdrop path discards it.
- Artifact: `settings.json`: `focusedEscapeRemains:true`, `retainedDraftAfterEscape:"85"`.
- Fix: one close/cancel action for Escape, ✕ and backdrop; reset draft on close or initialize on each open.

### U-13 — P2 — Help and setup blurbs present default rules as current rules
**Verified: true (code + controls demonstrably mutate the corresponding config).**

- Evidence: `Screens.tsx:324,328,330` hardcodes 50 movement, 5/4/3 tiles, +25% flank damage/half reactions and 25-AP Wait. Armor blurbs in `content/gear.ts:9-11` are likewise fixed. Rules allows all those numbers to change.
- Repro: change movement budget or Wait in Rules, apply, open Help. Help still teaches the defaults. On the active screenshot `Incoming` also says sweep “landing at 115” even though the value is relative AP, not clock time (`Incoming.tsx:50`).
- Fix: derive help and relevant blurbs from active config, or explicitly label them as default examples; use “in N AP” for relative times.

## Playtest log and coverage

Scripts (review-only):

```
npm run build
npx vite preview --port 4180 --strictPort --host 127.0.0.1
npx tsx tools/playtest-review-app.ts
node tools/playtest-review-races.mjs
npx tsx tools/playtest-review-settings.ts
npm test
```

`tools/review-app-evidence/` contains the actual structured browser logs; copies and screenshots are also in `/home/needz/.hermes/cache/scratch/soc-review-app/`.

| Encounter / chosen weapon | Manual-style canvas inputs (attempts logged) | Follow-up bot retry |
|---|---|---|
| Granary / daggers | 3 moves, 4 attacks, 3 end turns | victory, 19 engine actions |
| Wolves / shield | 6 moves, 8 attacks, 1 skill, 8 end turns; defeat screenshot | victory, 40 engine actions |
| Cultists / polearm | 5 moves, 6 attacks, 5 end turns; defeat screenshot | victory, 39 engine actions |
| Nephilim / two-handed | 5 moves, 3 attacks, 5 end turns; defeat at sweep, 115 AP | victory, 98 engine actions |

Attack inputs alternated explicit A mode and move-mode enemy clicking. M, 1, 2, Escape and right-click cancel were exercised; only one **valid skill click** occurred in the manual-style paths (Shield Bash), and all four starter skill formula paths were additionally tested in Vitest. The 2 key is a no-op for normal units without a second skill, not a claimed second ability cast. Wait is separately exercised by the modal probe and engine parity test. Heavy armor was selected in the settings probe; the four baseline scripts used clothing. Restart/retry, weapon selection, speed 0.5/1/4, mid-fight Rules, Copy and fresh-page reopening, Bot on/off were exercised. Speed 2× and the Result's Copy report, Change loadout and New seed buttons were exercised in `tools/playtest-review-extras.mjs`: speed read back as 2, clipboard contained VICTORY, seed changed from 1 to 1128582608, Setup opened and the next battle equipped two_handed. No errors (`tools/review-app-evidence/extras.json`).

The initial playtest script required two harness corrections: it first tried opening Rules behind a result modal; later its malformed-hash navigation was same-document and did not rerun main hydration. The final script retries before Rules and reloads malformed links. A settings probe initially passed a floating-point artifact (`0.060000000000000005`) to a range control; the harness now rounds the test value. These were probe problems, not app bugs. Evidence JSON is from the corrected successful runs.

### Screenshots and visual inspection

All under `/home/needz/.hermes/cache/scratch/soc-review-app/`:

- `granary-human.png`, `wolves-human.png`, `cultists-human.png`, `nephilim-human.png`
- `granary-result.png`, `wolves-result.png`, `cultists-result.png`, `nephilim-result.png`
- `nephilim-active.png`, `menu-ai-hang.png`, `missing-result.png`, `invalid-weapon.png`

Vision inspection performed on Wolves/Cultists/Nephilim human-result images and Nephilim active image. Foreground results table/buttons are readable at 1600×950; no confirmed text-on-text collision in active screenshot. Results naturally dim/occlude the board, with Look at the board providing inspection. Narrow log is dense. Do not mistake relative sweep AP for an absolute past timestamp: the visual assistant initially suggested that, but code establishes it is a wording issue, not a past-scheduled event. No unsupported overlap/stale-clock bug is filed.

## Other audit conclusions and limits

- React selectors return existing store references/scalars; no fresh-object useSyncExternalStore snapshot loop found. Runtime did not emit React loop errors.
- Ordinary double-click movement committed one action, busy returned false. `clickTile`/`endTurn` correctly gate manual busy input. Bot path lacks that gate (U-02).
- registerAnimator/unregisterAnimator identity check avoids an older scene clearing a newer registration. Production mounts had exactly one canvas. **Production StrictMode does not run development's double-effect lifecycle**: no claim that double-mount timing was browser-verified. Its code looks plausible, but pending animation shutdown remains broken.
- Board event view updates HP/displacements/KO and final store commit snaps tokens correctly on uninterrupted paths by code inspection; bot battle completions showed no persistent obvious visual mismatch. No pixel/scene-object equality oracle was installed, so arbitrary multi-hit/displacement chains and resize-during-tween aren't exhaustively verified.
- Restart during an AI animation in the tested browser timing continued to clock 30/actions 3 after 4.5 seconds; `busy=true` then was ongoing animation, **not evidence of a stuck busy flag**. Destroying the whole scene mid-AI is the proven hang. Rebuilding tokens during other tween timings remains an unproven risk.
- `apply` has no try/finally for animator rejection; an exception would leave busy true. No real non-injected animation rejection was observed, so not filed separately.
- Attack preview formulas agree on tested single-target, noncritical/nonreaction cases. Multi-target attacks can change flank/reaction state for later targets and movement can be held; projected values are conditional, not deterministic guarantees. Board held% uses the same chance formulas, but exhaustive stochastic multi-engager parity is outside these probes.
- Design combat text was checked read-only for flexible movement/action order, AP costs, reactions and visibility. Missing broader RPG systems are not treated as regressions in this sandbox.
- Existing e2e suite was not run, and playwright.config.ts was not changed. Standalone scripts use port 4180 explicitly.

## Reusable review lessons

Use a fresh page or reload to test hash hydration (hash-only navigation won't rerun main). Capture both busy and controller progress: false busy can coexist with a stuck global loop. Test bot handoff while an animation is pending, not only between turns. For SSR component probes, mock the selector to read the test store; Zustand's server snapshot otherwise reads its initial state and can make Incoming tests vacuous. Keep expected-failure defect probes separate from production fixes, and distinguish successful UI serialization from proof every rules setting changes combat as intended.

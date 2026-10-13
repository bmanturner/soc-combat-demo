# Final correctness and specification gate

Reviewed **630da48**, branch `review/final-code`. Production files, other worktrees and design vault were not modified. This is **not a clean correctness gate**: two reproducible gaps remain, plus two documentation/provenance gaps. Balance numbers are explicitly outside this review; the concurrent balance branch is not included.

## Executed verification

Traceability inventory (programmatically checked for all 77 unique IDs): **67 fixed / 7 partially / 0 not / 3 deliberately deferred**. Original findings alone: **41 fixed / 4 partially / 0 not / 2 deliberately deferred**. Partial IDs: D-03, D-08, D-11, U-04, FP-04, FP-07, FP-08. Deferred IDs: D-07 (scope narrowed), W-06 and FP-17 (balance verdict excluded). There are no rows classified wholly `not`; the partial rows still block a complete sign-off.

- `npx vitest run --testTimeout=30000 --reporter=json --outputFile=/home/needz/.hermes/cache/scratch/final-code-verified.json`: **277 total: 266 passed, 7 failed, 4 intentionally obsolete/skipped**. All **202 production tests pass**. The seven failures are two focused regressions plus five property cases, not seven independent bugs.
- **19 new fast-check property tests**: nine random legal-sequence cases (one per family), nine all-mode/all-skill conditional parity cases, and one arbitrary-invalid-mode case. **Five fail**, all on F-01; the other fourteen pass. One additional new non-property test roundtrips both endpoints/options of every registered setting with a two-slot loadout. Two focused tests reproduce F-01/F-02. Thus **22 new tests**, plus **53 copied original tests**.
- Initial default-timeout full run: 265 passed / 8 failed / 4 skipped. The additional failure was the existing `sim.test.ts` property exceeding its 5-second timeout (also reproduced alone at 5.48s), not an assertion defect. Raising only the CLI timeout to 30 seconds gives the authoritative results above; no production test timeout was edited.
- Original Vitest probes after dispositions below: **49 pass / 4 obsolete skips / 0 unexplained failures**.
- `E2E_PORT=4191 npx playwright test`: **25/25 pass**, including every weapon, strict reload, slot-1 share links, all controller/modal/result regressions. Build succeeds as part of this command.
- `npm run typecheck`, `npm run lint`, `git diff --check`: pass after adding probes.
- Original AI matrix: **800 unique runs, zero illegal-action errors**, 797 victories / 3 defeats. This is correctness sampling, not a balance endorsement. No ongoing/action-cap result.
- `tools/check-balance-source.ts`: **72 baseline value/status comparisons pass**. This checks preservation, not canon by itself; the quote audit below supplies canon grounding.
- All nine current `tools/*.{ts,mjs,py}` scripts were exercised; see hygiene table.

### Coverage and limitations

`final-review-properties.test.ts` samples every SETTINGS field, numeric values on the registered grid (including min/max), booleans/selects, enemy/family multipliers, all nine weapons, two-slot loadouts (including duplicate instances), both reload policies, both bot policies, and Wolves/Cultists/Nephilim. It samples 20 configurations per family and 35 legal action choices per sequence, mixing query-enumerated actions with production AI. Special unlock is forced on **only to admit every family into this particular sequence matrix**; off/on gating is separately tested in the existing catalog goldens and new share-boundary test. The controlled matrix separately runs every mode and every item skill under 20 configurations per family.

Deep-freeze plus snapshot equality guards queries and actions; the same action on the same cloned seeded state must return identical state/events. Every reached state checks finite/nonnegative HP/AP/time, HP <= maxHP, and distinct occupied cells across all live footprints. No non-RulesError crash, RNG/query mutation, HP violation or overlap was observed before the reproduced failures. Failing properties stop at their first counterexample; this is bounded sampling, not exhaustive model checking or a claim that all planned sequence steps completed.

Damage parity is **conditional**: compare landed noncritical damage, and do not compare a later sequential strike against an earlier flank snapshot after the board has changed. Random crit/reaction outcomes and future AI movement are not deterministic promises from a preview. Dual-wield preview explicitly describes its pool as conditional. AP/next-turn parity covers move, attack, skill, reload, swap and Wait; risk-free advertised movement is asserted to complete, exposing F-01. Delayed damage/ties have the existing shared-contract and copied original probes in addition to this new matrix.

## Findings

### F-01 — P1 — Movement/escape queries miss engagement that returns after leaving a flank

- **Verified: true.** `src/rules/queries.ts:58,76-85` caches eligible engagers on the initial board. `src/rules/state.ts:80-94` and `src/rules/engine.ts:315-329` correctly recompute eligibility on the actual board after each step. A currently flanked enemy is filtered out of the entire proposed path even after the mover breaks that flank. This is a **current-board path projection bug**, not an intervening enemy-move caveat.
- **Minimal repro:** `final-review-findings.test.ts`, `F-01: departing a flank must expose the later disengagement risk in the advertised path`. Jubal (1,3), wolf (2,3), Jabal (3,3); move to (1,0). With bounded settings `engageBase=1`, `engagePerPoint=0`, `engageMax=1`, `aooChance=0`, query advertises no risks; actual movement is held at (1,1). The first two assertions prove the engine check and shortened destination; the final risk assertion fails (0).
- **Generated corroboration:** seed 7132026, path 14 for shield/polearm/dual_wield: Seer plans four steps for 38 AP, no risks; Jabal recovers engagement mid-path and stops it after 19 AP. Path 8 for bow/crossbow: wolf plans 25 AP/no risks, is held after 16.666 AP by Jabal. Full configs/actions are in the JSON test output and are replayable from the fixed property seed.
- **Impact:** movement cost/destination, disengage-risk labels, `escapeOutlook` (`queries.ts:320-336`) and AI path safety can be optimistic even when the engine is correct. D-03/U-04 and FIX decisions 4/8 therefore remain partial.
- **Precise fix:** evaluate candidate engagers on a coherent hypothetical board at each path node, with the mover at that node; do not permanently discard initially flanked enemies. Preserve per-path rolled-against state and test both gaining and losing flanks, including ally transit. Feed corrected Reach risks into escape/UI/AI without changing engine engagement semantics.

### F-02 — P1 — Delayed abilities still cannot honor authored reaction permissions

- **Verified: true.** `src/rules/resolvers.ts:56,65` unconditionally assigns `[]` for sigil/sweep, regardless of `SkillDef.allowedReactions`. `engine.ts:618,626-645,652-660` neither carries that metadata into an effect nor rolls it at impact; `queries.ts:232-239` unconditionally reports 100% landing/no avoidance.
- **Repro:** `final-review-findings.test.ts`, `F-02: declared delayed ability reactions must not be silently discarded by resolveSkill`: a copied Hellfire definition declaring `allowedReactions:['block']` resolves to `[]`. No global content mutation is involved. Current shipped delayed abilities all intentionally declare `[]`, so this is an unfulfilled **authoring/spec contract**, not a claim that their present default damage should be blocked.
- **Canon:** Aaron’s Transcriptions:1007: “Area-of-effect attacks, spells, and skills may sometimes be dodged, blocked, or parried, but this is ability-specific. Each spell or skill should explicitly define which defensive reactions are allowed against it.” FIX-PLAN 7 calls for a **default** delayed policy of none, not discarding explicit exceptions.
- **Precise fix:** default delayed reaction metadata to `[]` only when absent, persist the resolved policy with the effect, and apply it consistently in effect execution and previews (including reaction AP/displacement semantics). Add an explicit-block delayed fixture plus the existing empty-policy control. Alternatively record a deliberate narrower authoring deferral instead of calling D-11 fully fixed.

### F-03 — P2 — README does not describe the completed sandbox and overpromises tunability/replay

- **Verified: false (static documentation finding).** `README.md:10` says every open rule is a setting, despite FIX-PLAN 16 narrowing D-07; `:16` calls the setup URL a replay link while `src/hud/Screens.tsx:135` correctly says it is not an action replay. `README.md:35-45` omits `notes/`; no nine-family roster, two slots, proficiency/special switches, reload policies, Weapon/Enemy tuning groups or expert/novice sim usage appears anywhere in the file. `:52` still describes only “40+ controls”; actual registry has 82 (not mathematically false, but stale).
- **Repro:** read README against `equipment.ts:15-29`, `config.ts:162-231`, `tools/sim.ts` and the verified catalog/share/e2e tests. No runtime failing test is claimed.
- **Precise fix:** document the current features and scoped tuning limits; distinguish same-setup/seed reproduction from action replay; add `notes/` and current sim policy/combo examples. Keep historical phase evidence in notes rather than expanding the shipping source tree with review scripts.

### F-04 — P2 — Original provenance disclosure finding is only fixed for weapon/skill records

- **Verified: false (static schema/rendering finding).** `src/content/units.ts:6-28` still has no structured concept/numbers/why metadata for unit stats, growth curves and demo enemy names; `src/content/gear.ts:5-11` armor has only comments. In contrast weapon/skill metadata and their HUD tags are now explicit (`gear.ts:107-162,195-197`, `hud/WeaponDetails.tsx:135-144`). D-08 originally included enemy stats/names and companions, not just Heavy Daze.
- **Repro:** compare the original D-08 scope with UnitTemplate/ArmorDef and those records; existing `weapons.test.ts` provenance checks prove the implemented weapon subset, not unit/armor disclosure. These values are **not falsely claimed to be canon**; the remaining problem is missing disclosure/ownership.
- **Precise fix:** add unit/armor concept and numerical provenance, label authored enemy names/curves and show the distinction on relevant stat/tooltips; or explicitly defer that part of D-08. Do not relabel Aaron’s legitimate character/armor concepts as invented.

## Original probe disposition

The five original Vitest files were copied under permitted `src/**/final-review-original-*.test.ts` names. Their assertion bodies were not rewritten to fit the new implementation. Original `it.fails` markers in app/weapons were converted to ordinary `it` so repaired behavior is actually required. No import/API adaptation was needed for those files.

| Original | Current copied file / result | Necessary disposition |
|---|---|---|
| design/review-design.test.ts | rules/final-review-original-design.test.ts: 8 pass | Unchanged assertions. |
| rules/review-rules.test.ts | rules/final-review-original-rules.test.ts: 16 pass, 1 skip | The old sanitizer asserts negative Wait clamps to zero. Obsolete under FIX-PLAN 1: minimum is now 5. Assertion retained, test explicitly skipped; `parity.test.ts` tests current floor. R-06 itself passes (no escape credit); the stricter current immune-off fixture is in production parity tests. |
| rules/review-rules-stress.test.ts | rules/final-review-original-stress.test.ts: 1 pass | Sole fixture adaptation: Granary uses clothing, not forbidden light armor. No assertions changed. Samples defaults, all registry boundaries and 20 generated configs with actual RulesError instrumentation. |
| weapons/review-weapons.test.ts | rules/final-review-original-weapons.test.ts: 15 pass | Both prior expected failures now ordinary passing W-04 assertions. |
| app/review-app.test.ts | game/final-review-original-app.test.ts: 9 pass, 3 skips | Bow-in-Granary is now illegal by brief 2; default caster immunity intentionally removed by FIX 3; decoder now rejects an entire invalid config rather than selectively clamping it (FIX 15). These three assertion bodies are preserved as explicit obsolete skips. Current equivalents are in preview-parity, robustness, share-weapons and e2e. |

The original AI `tools/probe-ai*.ts` write report files themselves. To respect the only-probe-writes restriction, byte copies and their original JSON inputs were executed in **`/home/needz/.hermes/cache/scratch/final-review-ai/`**, with `src` and `node_modules` symlinked read-only by convention to this reviewed worktree; none ran against old production code. This is an explicit exception to the requested in-worktree copying location, solely to keep their generated JSON out of the repository. No AI assertions/imports were changed.

- `probe-ai.ts`: completes all 800 runs; parsed/deduplicated count 800, errors 0.
- `probe-ai-cases.ts`: fails its **old-bug observation** `idle === 20` with actual 9. The later assertions demand sweep-only behavior, frozen zero-Wait time and an ally attack; these are intentionally obsolete goals, not unmet acceptance criteria. The script stops at the first assertion, so its later cases are **not claimed to have rerun there**. Current independent equivalents all ran green in `ai-behavior.test.ts`, `ai-boss.test.ts`, `parity.test.ts`.
- `probe-ai-replay.ts`: validates 800 unique rows and zero errors, then fails its old `zealot1 damage === 50` expectation. Old exact damage/clock/action traces are obsolete after rules/AI/content changes; no historical trace was adjusted and presented as exact replay. Current seeded replay checks pass in production sim/goldens and the new properties before any F-01 interruption.

Raw execution logs: `/home/needz/.hermes/cache/scratch/final-{originals,ai-matrix,ai-cases,ai-replay,e2e}.log`; final structured assertions: `final-code-verified.json`. These scratch paths are execution evidence, not a promise of permanent release artifacts. The committed probes and commands reproduce the gate.

## Traceability — original findings

Statuses are against the **whole original finding**, with explicit decisions overriding scope. “Fixed” means the cited regression passed in this gate; it does not claim exhaustive correctness beyond the stated test. “Partially” identifies a residual below. “Deliberately deferred” is not a hidden success. Test paths abbreviate `src/rules/` unless prefixed `game/` or `e2e/`. `OD`, `OR`, `OW`, `OU` mean the copied final-review-original design/rules/weapons/app files; the ID or quoted test fragment identifies the proving test.

| ID | Status | Current code location | Proving test / residual |
|---|---|---|---|
| D-01 | fixed | resolvers.ts:21-25; engine.ts:275-294 | OD D-01; shared-contract “timeline golden”. |
| D-02 | fixed | resolvers.ts:38-45; engine.ts:658 | OD D-02 (actual delayed flanked damage). |
| D-03 | partially | queries.ts:320-336 | OD D-03 proves unreachable-safe rejection; F-01 proves path risk still wrong. |
| D-04 | fixed | resolvers.ts:34-36; engine.ts:633,657 | OD D-04 caster hit. |
| D-05 | fixed | ai.ts:130 onward (closest-body filtering) | OD D-05; ai-behavior “wolf pursues the strictly closest healthy body”. |
| D-06 | fixed | engine.ts:184; config.ts:174 | OD D-06; shared-contract “auto-end respects leftover fractional tiles”. |
| D-07 | deliberately deferred | config.ts:163-171 | Full original all-content/all-rule tuning scope narrowed by FIX-PLAN 16/brief 10. Implemented subset proven by weapon-goldens “all knobs”, new share-boundary test. No claim of every original requested knob. |
| D-08 | partially | content/gear.ts:107-162,195-197; hud/WeaponDetails.tsx:135-144 | weapons.test item provenance checks and weapon-ui tests pass; unit/armor portion remains F-04. |
| D-09 | fixed | queries.ts:278-298; engine.ts:508-559 | shared-contract E/W/ranged-negative and timeline goldens; weapons.test “crossbow cadence”. |
| D-10 | fixed | equipment.ts:7-29,63-75; engine.ts:520-531 | weapon-goldens “swap before/after movement”, “independent duplicate instances”. |
| D-11 | partially | resolvers.ts:47-67; engine.ts:414,618 | shared-contract immediate reaction-policy tests pass; delayed exception F-02. |
| D-12 | fixed | engine.ts:253-266; ai.ts:333-361; config.ts:229-230 | ai-boss “same-cover camping increments, changing cover resets”; A-01 bait regression. Priority fixed by decision 12 rather than exposing every original proposed alternative. |
| D-13 | fixed | resolvers.ts:38-42 | OD D-13; shared-contract zero raw strike. |
| R-01 | fixed | config.ts:175; resolvers.ts:21-25; sim.ts watchdog | OR R-01; sim frozen-timeline watchdog. |
| R-02 | fixed | engine.ts:314,368-372 | OR R-02 and copied random occupancy tests. |
| R-03 | fixed | resolvers.ts:50-67; queries.ts:230-244 | OR both R-03 damage tests; all nine controlled parity properties. |
| R-04 | fixed | resolvers.ts:21-28; queries.ts:294-298 | OR both R-04 tests (boss AP and Wait). |
| R-05 | fixed | resolvers.ts:30-33; queries.ts:170-178,225-228 | OR R-05 hypothetical flank. Distinct path-node issue is F-01. |
| R-06 | fixed | resolvers.ts:34-36; engine.ts:633,657,668 | OR R-06; game/preview-parity immune-off caster fixture. |
| R-07 | fixed | resolvers.ts:9-19; queries.ts:278-290 | OR R-07; shared-contract effect/unit ties. |
| R-08 | fixed | resolvers.ts:27-33; queries.ts:170-180 | OR R-08; OW both W-04 tests; ai-behavior planned bow AP. |
| R-09 | fixed | resolvers.ts:67; queries.ts:230-240 | OR R-09 configured sweep delay. |
| W-01 | fixed | content/gear.ts:55-77,143-149; engine.ts:504-559 | weapons.test family mechanics; weapon-goldens direction/dual/crossbow tests; nine all-mode property cases. |
| W-02 | fixed | equipment.ts:7-32,63-75; engine.ts:520-531 | weapon-goldens swap/duplicate-instance tests. |
| W-03 | fixed | equipment.ts:55-61,84-88; engine.ts:563-580 | weapon-goldens “proficiency is item-owned”, fixed companion kits. |
| W-04 | fixed | queries.ts:170-180,221-230; ai.ts:386-389,487 | OW both W-04; ai-behavior planned bow AP. |
| W-05 | fixed | equipment.ts:15-29; hud/Screens.tsx setup; tools/sim.ts catalog | weapon-goldens catalog; e2e/weapons Granary/locks and every family. |
| W-06 | deliberately deferred | notes/balance/BALANCE.md; content/gear.ts tuning | Numeric performance verdict owned by concurrent balance pass, not this correctness gate. Existing budget tests run but are not a new balance sign-off. |
| A-01 | fixed | ai.ts:333-361; config.ts:229 | ai-boss reviewer bait now draws rocks/damages archer. |
| A-02 | fixed | ai.ts:90-115,245 onward | ai-behavior ally-only rejection for party/enemy and Seer allied KO risk. |
| A-03 | fixed | ai.ts:245-331 (multi-turn firing route) | ai-behavior “Seer approaches a firing position beyond one movement budget”; original old-idle assertion obsolete as above. |
| A-04 | fixed | resolvers.ts:21-25; config.ts:175 | OR R-01; sim watchdog controls. |
| A-05 | fixed | rules/sim.ts diagnostic result/watchdogs; tools/sim.ts output | sim.test “records illegal action, seed, policy and clock”; original 800-run matrix error count zero. |
| A-06 | fixed | ai.ts:207-243 | ai-behavior “guardian stays tethered on the threatened side”; code falls back to pursuit when caster absent. |
| U-01 | fixed | game/controller.ts:39-46,119-150; board/BoardScene.ts cancellation | e2e/robustness:78 leaving/restarting during animation. |
| U-02 | fixed | game/controller.ts:105-175 | OU serialization; e2e/robustness:95 bot handoff/cancellation. |
| U-03 | fixed | game/share.ts:36-93; equipment.ts:19-29 | OU invalid weapon/seed; game/robustness/share-weapons; e2e/robustness:122. |
| U-04 | partially | queries.ts:320-350; hud/Incoming.tsx | OU unreachable area and game/preview-parity pass; F-01 still understates path interruption risk. |
| U-05 | fixed | game/preview.ts pendingFor; board/BoardScene.ts shared move preview | game/preview-parity “bow move-after-shot hover includes surcharge”; engine parity passes. |
| U-06 | fixed | resolvers.ts:17-19; game/preview.ts judge | OU sweep equality; game/preview-parity both tie policies. |
| U-07 | fixed | hud/App.tsx modal key guard | e2e/robustness:13 Help/Settings key capture and focus. |
| U-08 | fixed | engine.ts:681-689 | OU winning-action AP; game/preview-parity exactly-once telemetry. |
| U-09 | fixed | hud/Screens.tsx:135,209-254; game/share.ts:96-99 | e2e/robustness:50 draft copy and :132 battle report snapshot. |
| U-10 | fixed | hud/Screens.tsx:145-146; game/controller.ts:212 | e2e/robustness:132 same-seed result reappears. |
| U-11 | fixed | resolvers.ts:34-36; engine.ts:633,657,668; hud/Incoming.tsx | game/preview-parity immune caster absent/no escape credit; OD self-hit policy. |
| U-12 | fixed | hud/Screens.tsx:209 onward; hud/App.tsx Escape handling | e2e/robustness:33 all three close paths and focused Escape. |
| U-13 | fixed | hud/Screens.tsx:97-99,313 onward | e2e/robustness:66 active rules/help; armor blurbs explicitly Default example. |

## Traceability — FIX-PLAN decisions

| ID | Status | Current code location | Proving test / residual |
|---|---|---|---|
| FP-01 | fixed | resolvers.ts:21-25; engine.ts:275-294; config.ts:175 | OD D-01; OR R-01/R-04; shared-contract reaction AP golden. |
| FP-02 | fixed | resolvers.ts:38-45; engine.ts:658 | OD D-02. |
| FP-03 | fixed | resolvers.ts:34-36; engine.ts:633,657,668 | OD D-04; game/preview-parity immunity. |
| FP-04 | partially | queries.ts:320-350; game/preview.ts; hud/Incoming.tsx | shared-contract instant movement/ties; F-01 risk omission. |
| FP-05 | fixed | engine.ts:184; config.ts:174 | OD D-06; shared-contract exhausted/fractional/opt-out. |
| FP-06 | fixed | resolvers.ts:38-42 | OD D-13; shared-contract zero raw strike. |
| FP-07 | partially | resolvers.ts:47-67; engine.ts:414,618 | Immediate ability tests green; F-02 delayed metadata ignored. |
| FP-08 | partially | resolvers.ts; queries.ts:170-244,278-350 | OR R-03..09 and game/preview-parity pass; F-01 movement-risk/AP path projection mismatch remains. |
| FP-09 | fixed | engine.ts:314,368-372 | OR R-02. |
| FP-10 | fixed | engine.ts:681-689 | OU winning-action AP; game exactly-once test. |
| FP-11 | fixed | ai.ts:130 onward | OD D-05 and ai-behavior closest healthy body. |
| FP-12 | fixed | engine.ts:253-266; ai.ts:333-361; config.ts:229-230 | ai-boss cover identity and bounded bait replay. |
| FP-13 | fixed | ai.ts:90-115,207-331 | ai-behavior ally cost, caster detour, guardian tether. |
| FP-14 | fixed | sim.ts diagnostics/watchdogs; ai.ts:439 policy | sim.test injected fallback/watchdogs; ai-behavior novice/expert telegraph distinction; CLI smoke. |
| FP-15 | fixed | game/controller.ts; game/share.ts; hud/App.tsx/Screens.tsx; board/BoardScene.ts | All eight e2e/robustness tests plus game/robustness and preview-parity. |
| FP-16 | fixed | equipment.ts; content/gear.ts; config.ts:163-171 | Catalog, equipment ownership, cadence, scaling/provenance goldens; nine family e2e. Scoped weapon/skill provenance done; broader D-08 not claimed. |
| FP-17 | deliberately deferred | notes/balance/BALANCE.md; tools/build-balance-report.py | Existing artifact computation executes; concurrent balance results deliberately not judged. |

## Traceability — WEAPONS-BRIEF decisions

| ID | Status | Current code location | Proving test |
|---|---|---|---|
| WB-01 | fixed | content/gear.ts:18-77,142-149 | weapon-goldens exact nine catalog; nine controlled all-mode properties. |
| WB-02 | fixed | equipment.ts:15-29,55-61; engine.ts:118 | engine gating/fixed companion goldens; e2e Granary restrictions. |
| WB-03 | fixed | config.ts:163-164; equipment.ts:11-17,55-61; hud/WeaponDetails.tsx:130-137 | proficiency/lock goldens, share boundary test, e2e locks. |
| WB-04 | fixed | config.ts:166; equipment.ts:77-98; engine.ts:504-518,544,580 | crossbow miss/debt/flexible persistence/cadence and e2e strict reasons. Both quoted source sentences in why. |
| WB-05 | fixed | config.ts:165; equipment.ts:63-75,99-100; engine.ts:520-531,574-579 | repeated swaps exact defenses, action consumption, duplicate instance cooldowns. |
| WB-06 | fixed | content/gear.ts:67-71,147; state.ts:63-84 | javelin ranges/LOS/engagement and post-throw movement tests. Unlimited throws labeled demo. |
| WB-07 | fixed | targeting.ts dualWieldCandidates; engine.ts:548-557; queries.ts:184 | dual post-death/dodge/footprint/stable-order goldens, frozen/replay properties. Conditional probability note explicit. |
| WB-08 | fixed | content/gear.ts:148; patterns.ts ring8; targeting.ts | colossal eight targets/large footprint/self aim/penalty goldens; e2e colossal. |
| WB-09 | fixed | content/gear.ts:165-197; resolvers.ts:50-67; engine.ts:580 | every skill mode exists, crossbow skill consumption, nine-family AP/damage properties. All new skill numbers demo. |
| WB-10 | fixed | config.ts:7-14,167-171; equipment.ts:36-44; resolvers.ts:54-60 | goldens per-template/family scaling and new random-config parity/share-boundary tests. Default balance overrides not judged. |
| WB-11 | fixed | content/gear.ts:107-162,195-197; hud/WeaponDetails.tsx:135-144 | item/skill metadata tests; field inventory and quote audit below. Applies to weapon/skill scope, not all unit records. |
| WB-12 | fixed | weapons.test.ts; weapon-goldens.test.ts; shared-contract.test.ts | Catalog, directional patterns, cadence, dual, hybrid, colossal, swapping, proficiency, AI legal-action goldens all pass. |
| WB-13 | fixed | tools/sim.ts; rules/sim.ts; ai.ts:421-433,494-495 | expert/novice full strict catalog/armor goldens (zero fallback/stalls); CLI catalog smoke; archived combos report reload/swap/AP. |

## Config and provenance audit

Runtime inventory: **82 SETTINGS = 70 demo + 10 source + 2 tentative**; all have nonempty `why`. New Weapons/Weapon tuning/Enemy tuning comprise **32** settings, all demo. Registry defaults and both numeric boundaries / boolean and select options roundtrip through real encode/decode with `crossbow + shield`, starting slot 1 and maximum supported seed. Decode validates the new keys against the same registry, rejects nonfinite/wrong/out-of-range config as one invalid payload, drops invalid reserve slots/locks, and preserves legacy `w=`. Production setup independently rejects forbidden Granary kits and empty equipped slot. This audit does not mistake sanitizer clamping (`sanitizeOverrides`) for the stricter URL decoder policy.

### Every source SETTINGS entry

All quotes below checked against the read-only **Aaron’s Transcriptions.md**. Changing a source-tagged slider remains a sandbox override, not newly authored canon.

| Setting | Canon line / quote | Verdict |
|---|---|---|
| movementBudget | 147: “maximum allowable action point usage for movement turns, set to **50 action points**” | Default backed. |
| moveApLight | 143: “Light armor costs 10 action points to move one square.” | Backed. |
| moveApMedium | 144: “Medium armor costs 12.5 action points to move one square.” | Backed. |
| moveApHeavy | 145: “Heavy armor costs 15 action points to move one square.” | Backed. |
| engageBase | 1069: “The base chance to keep the target engaged is 20%.” | Backed. |
| engagePerPoint | 1069: “10 - 6 = +4, adding 40%.” | Inference from worked example; registry explicitly says implied, not an independently finalized universal rule. |
| bowMoveSurcharge | 202/204/206: base 75; moved 125; only low cost if not moving that turn | Default difference backed. |
| reactionsEnabled | 969/971: check dodge/block/parry, highest chance first | Existence/order backed; auto-resolution is openly demo wording, not an opt-in system. |
| dodgeDisplaces | 1037: “moves one tile backward from the direction of the attack” | Backed; blocked-destination behavior remains demo. |
| wolfPackFear | 896: “Possible pack mechanic ... feared for one turn, run away, then ... regroup.” | Source concept is explicitly possible; enabled default is a sandbox selection. |

The two tentative settings are critChance/critMult, labeled simulation defaults rather than Aaron quotes. The other 70 are demo controls/amounts; their `why` fields exist. No invented weapon damage/hit number is labeled source. `sweepDepth` why still overgeneralizes geometric escape (“at 3 every armor can escape”); blocked paths/engagement can invalidate that example. Treat it as a default open-board example, not a proof of guaranteed escape (same documentation caveat as F-03).

### Every structured source content field (52 field instances)

The runtime inventory includes duplicate legacy `attack` and canonical `modes` entries. They are accounted for below; no unlisted structured `source` field was found. `profileFields` labels geometry/AP/range, not its invented damage/hit/penetration. `why` for patterns references the weapon section rather than embedding a quote; this audit supplies the quote mapping.

| Record(s) / exact field set | Aaron backing |
|---|---|
| daggers: attack + basic mode, each pattern/apCost | 187–194: one square in each cardinal direction; attack 50 AP. |
| shield: attack + basic, each pattern/apCost | 237/243: “The attack hits the targeted tile and one tile clockwise”; “standard 75 AP”. |
| polearm: attack + basic, each pattern/apCost | 276/289/291: eight directions, range two, straight line/tile behind, 100 AP. Bounded two-cell interpretation explicitly chosen in weapons review/brief; no range-three claim. |
| two_handed and shepherds_club: attack + basic, each pattern/apCost | 247–262: “two tiles to each side” of the target; “125 AP”. Shepherd’s two-handed club is an authored companion application of the family, not invented AP canon. |
| hunting_bow: attack + basic, each pattern/apCost/stationaryDiscount/range | 200–206: single target, 2–10 tiles, 75 stationary / 125 moved. Chebyshev convention explicitly demo. |
| crossbow: reloadAp; attack + fire, each pattern/apCost/range | 212–220: range 1–6; attack 50; next-turn reload action 50. Flexible versus strict timing/persistence is correctly demo, not a second canonical reading. |
| dual_wield: attack + basic, each pattern/apCost | 266–272: eight directions, random second enemy within two clockwise/counterclockwise including primary; 100 AP. Post-hit pool timing/seeded uniform selection is the explicit demo decision. |
| javelin_shield: attack + thrust, each pattern/apCost; throw pattern/apCost/range | 295–303: single adjacent melee 75; throw range 2–4 and 125. Unlimited ammo and equipment-level engagement are demo. |
| colossal: attack + line + sweep, each pattern/apCost | 305–309: two-cell line or every surrounding tile; 175 AP. No arc5 penalties. |

Concept-level `source` values: all nine player weapon families plus shepherds_club are backed by those family/character sections. Four source skill concepts are Heavy Daze (transcription:73), Sweeping Arm (923–928), Rock Throw (930–933), Rockfall/cover AoE (935–937). All their numeric field metadata is demo. Names like “Rockfall” are UI labels for the sourced concept, not a claim Aaron supplied that exact spelling. Armor source comments correctly distinguish approximate 100/200/300 bands and equipment directions from demo exact secondary stats. Remaining structured disclosure gap is F-04, not an unsupported numerical source tag.

## Repo hygiene and script smoke tests

Only the review report and `src/**/final-review*.test.ts` are added. These probes are deliberately **review-only and partly red**; do not merge them blindly into a release branch as if they were completed fixes. No old `review-*.test.ts` remained in production; production `design-contract`/`parity` files are intentional regressions, not stale review leftovers. Compatibility selectors/caches (`WeaponDef.attack`, `UnitState.attack/skills`, `plannedActionAp`) still have active production/test consumers; no safe dead-code deletion is proposed without a separate migration.

| Script | Actual smoke invocation / result |
|---|---|
| tools/sim.ts | `npx tsx tools/sim.ts 1 granary` — completes, four starter rows with diagnostics. |
| tools/trace.ts | `npx tsx tools/trace.ts granary daggers clothing 1` — prints real fight events. |
| tools/debug.ts | `npx tsx tools/debug.ts 1` — exits normally; arg unused, developer-only fixed fixture. |
| tools/check-balance-source.ts | `npx tsx tools/check-balance-source.ts 1` — 72 comparisons pass; arg unused. Depends on retained git revision 83cd5df, so a shallow checkout must include that revision. |
| tools/balance-math.ts | `npx tsx tools/balance-math.ts 1` — real analytic table emitted; arg unused. |
| tools/balance-report.py | `python tools/balance-report.py notes/balance/cli-smoke.txt` — parses stored ROW records. |
| tools/build-balance-report.py | Executed with `runpy`, redirecting **only Path.write_text output destinations** to scratch; real inputs/subprocesses unchanged. Completes and regenerates all five stored acceptance entries. No production notes overwritten; not a fresh balance experiment. |
| tools/shoot.mjs | `node tools/shoot.mjs http://127.0.0.1:4173/ <scratch>/final-shoot` — screenshots written, no JS exception; four Chromium ReadPixels performance warnings. |
| tools/shoot-midfight.mjs | `node tools/shoot-midfight.mjs nephilim daggers light <scratch>/final-shoot` — stops on real pending sweep, clock 60, Jabal active, impact 140; no console errors. |

Both screenshot tools used this worktree’s built preview after HTTP 200 readiness. The owned server was stopped; socket check confirms no listener on 4173. No visual quality claim is inferred merely from screenshots. README repairs are F-03; no script was confirmed broken in the full-history checkout.

## Gate disposition

Do not call this fully correct until F-01 is fixed and its five generated failures plus focused fixture turn green. Resolve or explicitly defer F-02’s delayed authoring contract before closing D-11. F-03/F-04 are minor but prevent a complete documentation/provenance sign-off. Existing default mechanics, weapon goldens, original applicable regressions and all browser tests pass. Deferred numerical balance work must be judged on its own branch and evidence.

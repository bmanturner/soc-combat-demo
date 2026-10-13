# Final UX / product gate — Sons of Cain combat demo

## Verdict

**HOLD for an unaccompanied Aaron handoff.** The core sandbox works: all four encounters opened, all nine weapon families were exercised through real UI input or the real bot toggle, attacks/reload/swap resolve, telegraphs hurt, and victory/defeat reports copy. No P0 crash or hang was observed. The important remaining problems are interaction consistency, retaining feedback access, same-tab share navigation, tuning navigation, and crowded hazard labels. **This is not a balance assessment.**

Reviewed build: `630da48d783e6f680288b21fe56e7a038d95ff83` on `review/final-ux`. Production code unchanged. `npm run build` passed (TypeScript plus Vite). Chromium was driven using `@playwright/test`, at `http://127.0.0.1:4186`, against the built preview. Debug bridge used **only** for reading state and locating tile centers; no controller calls or state writes. Preview process terminated; socket connection then returned ECONNREFUSED (111).

## Evidence and replay

Screenshot/log root: **`/home/needz/.hermes/cache/scratch/soc-final-ux/`** (abbreviated **S/** below).

- **64 named states, 128 PNG screenshots**, each state captured at **1600×950** and **1280×800**. Names end `-1600.png` and `-1280.png`.
- `S/log.json`, `S/followup.json`, `S/checks.json`: actual DOM text, read-only battle snapshots, clipboard reports, and focused checks.
- `S/manifest.json`: full screenshot-to-contact-sheet inventory. Images were inspected using the vision tool, all via paired contact sheets and critical states additionally at original resolution. Some moving/bot/hover captures differ slightly between resolutions because resizing and animations continue; these are not pixel-parity assertions. Proficiency post-action captures were re-taken after resolution.
- Scripts: `notes/final-ux/play.mjs`, `followup.mjs`, `checks.mjs`; contact sheets: `/usr/bin/python3 notes/final-ux/sheets.py` (system Python has Pillow; default Python does not).
- Reproduce with `npm run build`, then `npx vite preview --port 4186 --strictPort --host 127.0.0.1`, then the three scripts in the order above. Stop preview afterward. No npm installation is needed.
- Reference wording checked read-only in `Combat System.md`, `Weapons.md`, and `Enemies and Encounters.md` under the published Sons of Cain design docs.

## Playtest log / verified behavior

| Session | Real input and result | Evidence stems (both resolutions) |
|---|---|---|
| First run | Read encounter menu, opened optional help, Escape closed it, chose Granary. Four starter choices and clothing restriction are communicated. Setup armor controls can be reached by scrolling; not an inaccessible clipping bug. | `01-menu`, `02-help`, `03-granary-setup`, `34-setup-scroll` |
| Granary manual + bot finish | Hovered movement ghost; clicked (4,4), spent 30 movement AP. Used keyboard skill 1 and clicked a rat. Ended turn, set 4×, enabled bot; victory at 230 AP. Copied actual report. Separate manual skill-2 run used Precision Stab, spent 75 AP, and killed a rat. | `04-granary-start` through `08-granary-result`, `39-proficiency-used` |
| Rules/share | Drawer contains 82 settings. Changed swap 50→55 and friendly fire off→on. Changed counter shows 2. Copied actual share URL. A **fresh load** restored 55 and true. Badges distinguish Aaron’s rule, tentative math, demo default; rows provide rationale. | `09-rules-top`, `10-rules-changed`, `31-settings-bottom`; `followup.json.shareRestored` |
| Road Wolves, crossbow → dual wield | Tried out-of-range shot: toast explains invalid range and no AP spent. Waited for wolves, fired (unloaded, 50 AP); same-turn R was correctly blocked with “already acted this turn.” Separate followup ended turn, reloaded on next Jubal turn: loaded, 50 AP, reload telemetry 1. W swapped to Dual Blades, 50 AP, new skills; following turn dual strike resolved with a primary and random secondary. | `crossbow-attempt-*`, `12-crossbow-fired`, `13-crossbow-reload` (**blocked attempt**, not success), `27-reload-preview`, `28-reload-success`, `14-swapped`–`16-dual-attack` |
| Mid-fight rules | Opened Rules after dual attack, disabled auto-end, pressed explicitly labeled Apply & restart fight: clock reset from 125 to 0 with changed config. Strict crossbow policy also applied through its select. | `17-midfight-rules`, `18-rules-restarted`, `37-strict-reload-rules` |
| Ruined Shrine | Selected Javelin & Shield, clicked throw mode, tested T mode cycling, aimed at Left Zealot, threw: 125 AP and a logged block. Enabled real bot then handed control back at Hellfire Sigil. Incoming showed 35 AP and Jabal’s 20% held risk; wait button warned escape risk. | `19-mode-key`–`22-shrine-telegraph` |
| Colossal | At boss start, empty sweep attempt produced a truthful no-target message and spent no AP. Followup in Wolves waited for an adjacent foe: hover preview showed 175 AP; clicking the sweep mode button immediately attacked, dealt 104, killed a wolf and triggered pack fear. | `23-colossal-hover`, `24-colossal-commit` (**invalid attempt**), `29-sweep-targets`, `30-sweep-success` |
| Other families | Selected sword & shield, polearm, two-handed axe, hunting bow; inspected their controls/previews, ran the real party bot, then returned control. No crash or stuck flow in these samples. | `family-shield*`, `family-polearm*`, `family-two_handed*`, `family-hunting_bow*` |
| Boss deliberate failure | Waited without evading. Saw Rockfall at 80/55/30/5 AP. Incoming and end-turn warning escalated to no escape. At 240 AP Rockfall hit Jabal and Archer for 110 each; again at 440, both down, Jubal also killed by rock. Defeat at 440 AP, report counted Jabal/Archer caught twice each. | `danger-*`, `25-boss-wait-result`, `26-result-dismissed` |
| Report loop | Victory and defeat copy succeeded via actual browser clipboard. Report includes encounter/outcome, clock, seed, original loadout, AP/damage/escape metrics, reload/swap counts, config differences, notes placeholder, and a setup/seed link explicitly **not an action replay**. Fresh opening restores setup. Dismissing result loses report access (X-02). | `08-granary-result`, `25-boss-wait-result`, `32-dismissed-victory`, `33-report-link-reopened` |
| Keys/focus/speed | M/A change modes, T cycles, R reloads, W swaps, 1/2 select skills, Space advances an empty Granary turn to 25 AP when focus is not on a button, Escape and right-click cancel to move; Escape closes dialogs. Tab enters drawer controls. 0.5× and 4× persist in live speed state; Restart restarts fight. Space while a button is focused uses ordinary button activation, not global end-turn. | `checks.json`, `followup.json.focus`, `38-restart` |

No pageerror events were recorded in the main/followup scripts. Earlier harness retries corrected the encounter ID (`cultists`, not `shrine`) and bow ID (`hunting_bow`); those were test-script errors, not product defects.

## Findings

### X-01 — P1 — Mode selector sometimes commits an attack; hover changes the selected mode
- **Verified: true.** `S/29-sweep-targets-{1280,1600}.png` → `S/30-sweep-success-{1280,1600}.png`. Merely hovering Colossal sweep changed stored mode to `attack/sweep`; clicking the same-looking mode selector immediately spent 175 AP and killed a wolf. Javelin throw / colossal line select targeting instead. Text says “Click a tile to aim”; no explicit distinction warns that this button executes.
- **Fix:** All mode buttons should select only; commit with a board click or a distinct “Sweep now · 175 AP” action. Keep hover preview separate from committed selection. Test identical semantics for pointer and T keyboard cycling.

### X-02 — P1 — Looking at the final board strands the report
- **Verified: true.** After victory and defeat, clicked “Look at the board.” `S/32-dismissed-victory-{1280,1600}.png`, `S/26-result-dismissed-{1280,1600}.png`; `copy-report` count becomes 0. No “Show result” or report entry remains. Aaron can inspect the log or copy the result, but cannot safely choose that order without having copied first.
- **Fix:** Keep a persistent “Results / Copy report” button after battle, or make the result drawer reopenable without restarting.

### X-03 — P1 — Pasting a share link into an already-open tab silently leaves the old fight active
- **Verified: true.** `S/35-share-same-tab-{1280,1600}.png` and `checks.json`: URL changed to `#e=wolves&w=crossbow&slot=0&a=heavy&s=33`, while state stayed Granary/daggers/seed 1. Full reload then showed Wolves/crossbow/seed 33 (`S/36-share-refreshed-{1280,1600}.png`). Copied links work on fresh load, not same-document hash navigation.
- **Fix:** Handle hash changes with the same validation/import path as initial load and show a clear replace-current-run confirmation. Do not silently advertise one setup in the URL while displaying another.

### X-04 — P1 — The main tuning surface is an 82-setting unindexed scroll
- **Verified: true.** `S/09-rules-top-{1280,1600}.png`, `S/10-rules-changed-{1280,1600}.png`, `S/31-settings-bottom-{1280,1600}.png`; live DOM: 82 rows, 8540px scroll height at 950px viewport, no search or collapsible groups. Section headings are not navigation. Only action buttons stay at the top while scrolled; title/close disappear. Finding a rule or revisiting the two changed values requires scrolling through unrelated tuning rows.
- **Fix:** Add search, collapsible groups/group jump list, Changed-only filter, per-row reset, and sticky title/close. Retain the existing useful badges and rationale.

### X-05 — P1 — Hazard and attack labels obscure the units they describe
- **Verified: true.** `S/22-shrine-telegraph-1280.png` (also 1600): “Hellfire Sigil · 35 AP” spans Jabal/Zealot marker and status/health space. `S/15-dual-preview-{1280,1600}.png`: primary/33%/“Dashed: one random” annotations crowd the adjacent wolves. Danger is communicated, but reading occupied tiles and unit status at the exact decision point becomes harder.
- **Fix:** Collision-aware labels in reserved gutters with leader lines; never place an opaque hazard label over a unit/HP/status. Give timeline effects a dedicated lane and collapse duplicate candidate annotations into one readable summary.

### X-06 — P2 — Granary is a safe encounter, not a guided first lesson
- **Verified: true.** `S/04-granary-start-{1280,1600}.png`, `S/05-move-ghost-{1280,1600}.png`. The menu and optional Help explain AP well, but opening “Start here” never walks Aaron through move → aim → ghost → end turn. Two J markers and several AP quantities arrive at once. No persistent legend identifies the dashed next-turn marker in the first battle.
- **Fix:** A dismissible three-step first-run cue anchored to reachable tiles, the ghost, and End turn. Explain “AP spent = delay, not an action budget” and the separate movement budget. Keep it skippable for repeat tuning runs.

### X-07 — P2 — Settings inputs have no programmatic names
- **Verified: true.** `S/09-rules-top-{1280,1600}.png` plus `checks.json.settingsDOM`: all 82 inputs/selects lack associated labels or aria-labels. Tab reaches anonymous inputs; visible row labels are not connected. Native sliders work by arrow key, but assistive technology cannot identify the rule.
- **Fix:** Unique input IDs, `label htmlFor`, `aria-describedby` for rationale/provenance, and an accessible name for the close icon. Preserve visible keyboard focus.

### X-08 — P2 — Weapon summaries omit dual pattern and ignore selected mode
- **Verified: true.** `S/15-dual-preview-1600.png`: unit card reads “Dual Blades · 100 AP · · 44 dmg” with no shape description. `S/29-sweep-targets-1600.png`: selected sweep surrounds Jubal, but unit card still says “Two tiles in a straight line.” `S/20-javelin-preview-1600.png`: throw selection costs 125 while the card describes 75 AP adjacent thrust.
- **Fix:** Render the selected mode’s shape/cost/range, or explicitly label the card “default attack” and show the selected mode separately. Add the missing dualArc pattern text.

### X-09 — P2 — Combat log exposes floating-point noise
- **Verified: true.** `S/16-dual-attack-1600.png`, `S/30-sweep-success-1280.png`: logs include `121.66499999999999 AP`, `49.998 AP`, etc. Formula-heavy wrapping makes outcome lines harder to scan.
- **Fix:** Centralized AP formatting with consistent precision; emphasize damage/outcome and collapse raw math into optional detail. No balance-value change requested.

## Top five fixes, ranked for Aaron

1. **X-02:** Preserve/reopen results and Copy report after board inspection; protect the feedback loop.
2. **X-01:** Make mode selection and attack commitment consistent; prevent accidental expensive actions.
3. **X-03:** Import same-tab share links correctly; protect reproducibility and tuning comparisons.
4. **X-04:** Search/group/Changed navigation in Rules; make 82 settings usable as a designer tool.
5. **X-05:** Keep telegraphs and target labels clear of units and health/status; protect tactical readability.

## What is not a defect / limitations

- Disabled reload/swap/skill controls usually give useful reasons (unloaded/already loaded/already acted/empty slot/cooldown). A blocked same-turn reload is correct, not a no-op defect.
- Rules changes explicitly restart fights; this is labeled, not silent mid-run mutation.
- Settings provenance and changed highlights are useful; the problem is finding settings, not missing provenance.
- Setup and left details can extend below the viewport, especially at 1280×800. Setup armor was reached by scrolling and left panels use `overflow:auto`; not classified as inaccessible clipping. A scroll affordance and brighter small secondary text would improve polish.
- Incoming and no-escape warnings were materially useful. Boss red Rockfall tiles remained distinguishable; the cultist/dual label overlap is the specific critical issue, not a claim that all warnings are unreadable.
- Successful sharing is setup/seed/rules, not battle replay, and the report says so. A build/version and human-vs-bot indicator would improve reports but were not required to understand these runs.
- This pass did **not** exhaustively A/B every setting, every skill, every seed/armor, clipboard-denied behavior, or every result navigation button. Strict reload was applied but its entire forced-next-action flow was not separately played. Shield/polearm/axe/bow samples used the real bot for combat after manual setup/preview. No claim that all 82 rules are proven functional.
- No production changes were made and no recommendation here judges the concurrent balance pass.

# Final UI verification

Branch: `fix/final-ui`. No rules/content files changed.

## Automated gate
- `npm run typecheck`: pass.
- `npm run lint`: pass.
- `npm test`: 212 tests, 18 files passed.
- `E2E_PORT=4188 npx playwright test`: 32 passed.
- New `final-ui.spec.ts`: real UI selection/commit (all nine families, enabled skills, T), sweep query AP (175 in this build), recoverable report, same-tab share accept/cancel, rules search/filter/reset/names/descriptions, selected throw/dual summary and skippable guidance.
- New `weapon-summary.test.ts`: all nine families, every mode, default/inspect fallback and pure query parity.

## Reviewer replay
`node e2e/review-replay.mjs` replays the reviewer's unchanged `play.mjs`, `followup.mjs`, `checks.mjs` via an explicit wrapper. Adaptations: port/output directory; accept the new replacement confirmation; board click after selecting Sweep. The wrapper also records read-only label/token bounds.

Final replay: 64 named states, 128 viewport captures/audits, zero pageerrors and zero label/token intersections. Original followup's `copy-report` count is still zero after dismissal because the persistent recovery control is now `reopen-results`; the new e2e clicks it and verifies Copy report is available again.

Artifacts: `/home/needz/.hermes/cache/scratch/soc-final-ui/` (`log.json`, `followup.json`, `checks.json`, `replay.stdout`).

## Visual evidence
Before root: `/home/needz/.hermes/cache/scratch/soc-final-ux/`.
After root: `/home/needz/.hermes/cache/scratch/soc-final-ui/`.
Same stems in both roots, each with `-1280.png` and `-1600.png`:
- `15-dual-preview`: primary and secondary labels in reserved annotation lane.
- `22-shrine-telegraph`: hazard lane and separate timeline effect lane.
- `09-rules-top`: search, group jumps, changed filter and sticky controls.
- `31-settings-bottom`: close/apply remain visible after scrolling.

Final vision checks passed both board examples at both required resolutions and the drawer top/bottom. Token HP/status geometry was tightened after the first vision pass found adjacent-token crowding; final vision passed.

Unit/armor provenance is rendered conditionally from content definitions and remains safe when absent. Integration with the concurrent rules agent's populated provenance fields still requires their commit; no rules-side code changes are needed from this branch. X-09 remains owned by that agent.

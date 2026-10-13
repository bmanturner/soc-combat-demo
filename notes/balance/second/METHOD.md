# Second-pass measurement notes

All files in this directory are evidence, not approval to ship. `final-*` (once produced) alone define final acceptance. `screen-*` are 40-seed cells, `confirm-*` are intermediate 100-seed cells. Do not average candidates together.

## Snapshots

- `screen-original-expert`: first-pass production code, cultist damage restored to 1/1 through overrides. Light dagger won 57.5%, mean HP 14.8%.
- `screen-seerhp-*`: same old AI, damage 1/1 and Seer HP ×1.5. Changing the weak-target ordering improved light daggers but is not a good substitute for fixing routing. Rejected.
- `screen-focus-*`, `screen-magic-*`, `screen-balanced-*`, `screen-magic75-*`, `screen-seer125-*`, and both `confirm-*` families use the local melee focus fix. All preserve original content/maps. The only boss target is the Nephilim, so the focus fix has no effect on boss screens.
- Boss screens use the config printed in each file. Until `screen-turn110-rock160-*`, untouched cultist defaults were .5/.5, but that is irrelevant to boss-only runs. Some later boss processes print .75/1.5 after the cultist default update. Boss content is otherwise identical except the explicitly rejected cover test below.
- `screen-lateral200-*`: a second rejected cover experiment at (3,5), with rocks 200. Both policies use that map snapshot; novice shield/dual/colossal became severe outliers. The source map was reverted after both processes had imported it. No cover change is in the final candidate.
- `screen-cover190-*` was a deliberately rejected map experiment: add cover at (4,6), rocks 190. It damaged several novice melee routes (shield below 20%, polearm below 20%). The process was stopped early, the map edit reverted, and the partial file must never count as confirmation.

## Bot regression evidence

`trace-restored.txt` and `trace-local-focus.txt` both use seed 1000, light daggers and cultist damage 1/1. Before: Jubal spends all 50 movement AP crossing toward (7,5), then throws at the Seer, leaving both zealots active. After: Jubal spends 30 movement AP approaching (4,4), then stabs the nearer left zealot. The fix restricts the *focus bonus*, not legal attacks, to melee foes no more than one tile farther than the nearest enemy. Ranged focus remains lowest HP; novice remains nearest enemy and still ignores future boss sweeps. `focus-red.txt` records the failing guard-versus-Seer assertion; `focus-green.txt` records its pass.

`trace.ts` now accepts `policy=novice` and ordinary `setting=value` overrides after the seed and prints the effective config. This makes the diagnostic traces reproducible without editing defaults.

## Important limits

The same seeds 1000–1099 are used for final comparison, not a held-out sample. Selection across many screens means a 100-seed result is not a human-balance guarantee. Report all threshold misses, including upper win limits: a 100% cell is not automatically good. All novice per-armor cells must remain visible even when the binding boss criterion uses family/armor aggregates. Damage/AP budgets are isolated throughput, not whole-fight performance. A deadline defeat can retain HP and still counts as a defeat.

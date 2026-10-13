# UI-owner integration action

`src/game/preview-parity.test.ts:31` tests an impact at 105 = boss initiative 30 + old demo sweep delay 75. The new balanced default is 100. Preserve the existing equality assertion, and pin the fixture:

```diff
- config: { tieUnitBeforeEffect: first }
+ config: { tieUnitBeforeEffect: first, sweepDelay: 75 }
```

This is a test-fixture dependency, not an engine or preview defect. No source-backed golden should be weakened. This balance worker has not edited `src/game/**` because the UI worker owns it. Until the owner applies this change, the full suite has one expected failing test. The owned rules fixtures explicitly pin their historical sweep values for the same reason.

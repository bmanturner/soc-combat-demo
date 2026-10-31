import { expect, it, vi } from 'vitest';
import { encounterById } from '../content/encounters';
import { DEFAULT_CONFIG } from '../rules/config';
import { applyAction, castEffect, createBattle } from '../rules/engine';
import { FIGHT_SUMMARY_SCHEMA, fightReport, fightSummary } from './report';

it('the fight summary pairs each telegraph cast with its landing, survives JSON, and the report names the catch', () => {
  vi.stubGlobal('location', { origin: 'https://example.test', pathname: '/' });
  try {
    let b = createBattle(encounterById('granary'), { weaponIds: ['daggers', null], equippedSlot: 0, armor: 'clothing' }, { ...DEFAULT_CONFIG, reactionsEnabled: false }, 1).state;
    const rat = b.units.find((u) => u.side === 'enemy')!;
    const jubal = b.units.find((u) => u.id === 'jubal')!;
    // Real casts reach the log through applyAction; this injected one is logged by hand.
    const cast = [] as Parameters<typeof castEffect>[3];
    castEffect(b, rat, { name: 'Test sigil', tiles: [{ ...jubal.pos }], delay: 10, damage: 5, damageType: 'magic', pctPen: 0 }, cast);
    b.log.push(...cast);
    while (b.effects.length) b = applyAction(b, { type: 'endTurn', unitId: b.active!.unitId }).state;

    const summary = fightSummary(b);
    expect(JSON.parse(JSON.stringify(summary))).toEqual(summary);
    expect(summary).toMatchObject({ schema: FIGHT_SUMMARY_SCHEMA, encounter: { id: 'granary' }, setup: { weapons: ['Bronze Daggers'], armor: 'clothing' } });
    expect(summary.telegraphs).toEqual([
      expect.objectContaining({ name: 'Test sigil', sourceId: rat.id, castAt: 0, resolveAt: 10, threatened: ['jubal'], escaped: [], caught: [expect.objectContaining({ unitId: 'jubal', reason: 'stayed', previewSafe: false })] }),
    ]);
    expect(summary.party).toMatchObject({ caught: 1, turnsNoAction: 1 });
    expect(fightReport(b)).toContain('- Test sigil (Granary Rat), cast @0, landed @10: Jubal caught for');
  } finally {
    vi.unstubAllGlobals();
  }
});

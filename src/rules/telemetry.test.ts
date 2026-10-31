import { describe, expect, it } from 'vitest';
import { applyAction, castEffect } from './engine';
import { OPEN_7x7, play, testBattle } from './testkit';
import type { BattleState } from './types';

const SIGIL = { name: 'Test sigil', damageType: 'magic' as const, pctPen: 0 };
const QUIET = { reactionsEnabled: false, critChance: 0 };

function untilImpact(start: BattleState): BattleState {
  let s = start;
  for (let i = 0; i < 20 && s.effects.length; i++) s = applyAction(s, { type: 'endTurn', unitId: s.active!.unitId }).state;
  return s;
}

describe('fight telemetry for the prototype questions', () => {
  it('classifies each turn as all-in, acted with movement left, or no action', () => {
    const b = testBattle({ rows: OPEN_7x7, jubal: { x: 0, y: 3 }, enemies: [{ template: 'wolf', at: { x: 6, y: 3 }, initiative: 999 }], config: QUIET });
    const { state } = play(b, [
      { type: 'move', unitId: 'jubal', to: { x: 5, y: 3 } },
      { type: 'attack', unitId: 'jubal', target: { x: 6, y: 3 } },
      { type: 'attack', unitId: 'jubal', target: { x: 6, y: 3 } },
      { type: 'endTurn', unitId: 'jubal' },
      { type: 'endTurn', unitId: 'jubal' },
    ]);
    expect(state.telemetry.jubal).toMatchObject({ turns: 3, turnsAllIn: 1, turnsActedWithMoveLeft: 1, turnsNoAction: 1, moveLeftAp: 100 });
  });

  it('counts distinct enemies an attack swung at and how often it caught several', () => {
    const b = testBattle({ rows: OPEN_7x7, jubal: { x: 3, y: 3 }, weapon: 'two_handed', enemies: [{ template: 'wolf', at: { x: 3, y: 2 }, id: 'w1', initiative: 999 }, { template: 'wolf', at: { x: 4, y: 3 }, id: 'w2', initiative: 999 }], config: QUIET });
    const { state } = play(b, [{ type: 'attack', unitId: 'jubal', target: { x: 3, y: 2 } }]);
    expect(state.telemetry.jubal!.patterns['Great swing']).toMatchObject({ kind: 'attack', weaponId: 'two_handed', uses: 1, enemiesTargeted: 2, multiTargetUses: 1, mostEnemiesTargeted: 2 });
  });

  it('flags a catch when the last end-turn preview said the unit could still get out', () => {
    const b = testBattle({ rows: OPEN_7x7, jubal: { x: 3, y: 3 }, enemies: [{ template: 'wolf', at: { x: 6, y: 6 }, initiative: 10 }], config: QUIET });
    const wolf = b.units.find((u) => u.side === 'enemy')!;
    castEffect(b, wolf, { ...SIGIL, damage: 10, tiles: [{ x: 3, y: 3 }], delay: 200 }, []);
    const ended = applyAction(b, { type: 'endTurn', unitId: 'jubal' }).state;
    expect(ended.active?.unitId).toBe(wolf.id);
    expect(ended.effects[0]!.endTurnPreviewSafe).toEqual({ jubal: true });
    // While the wolf holds the turn, something (a daze, a reaction) pushes Jubal's next turn past impact.
    ended.units.find((u) => u.id === 'jubal')!.nextTurnAt = 300;
    const s = untilImpact(ended);
    const hit = s.log.flatMap((e) => (e.t === 'effectResolve' ? e.hits : []))[0]!;
    // It ended its turn inside (stayed), but on the preview's word that it would act again before impact.
    expect(hit.caught).toMatchObject({ reason: 'stayed', previewSafe: true });
    expect(s.telemetry.jubal).toMatchObject({ caught: 1, caughtBy: { late: 0, stayed: 1, trapped: 0, held: 0 }, caughtAfterSafePreview: 1 });
  });

  it('a catch the preview warned about is not flagged, and a knockout records when and by what', () => {
    const b = testBattle({ rows: OPEN_7x7, jubal: { x: 3, y: 3 }, enemies: [{ template: 'wolf', at: { x: 6, y: 6 }, initiative: 999 }], config: QUIET });
    const wolf = b.units.find((u) => u.side === 'enemy')!;
    castEffect(b, wolf, { ...SIGIL, damage: 9999, tiles: [{ x: 3, y: 3 }], delay: 10 }, []);
    const s = untilImpact(applyAction(b, { type: 'endTurn', unitId: 'jubal' }).state);
    const hit = s.log.flatMap((e) => (e.t === 'effectResolve' ? e.hits : []))[0]!;
    expect(hit.caught).toMatchObject({ reason: 'stayed', previewSafe: false });
    expect(s.telemetry.jubal).toMatchObject({ caughtAfterSafePreview: 0, downed: { at: 10, by: `${wolf.name}: Test sigil` } });
  });
});

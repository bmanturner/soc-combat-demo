import { describe, expect, it } from 'vitest';
import { applyAction, castEffect } from './engine';
import { OPEN_7x7, testBattle } from './testkit';
import type { BattleState, GameEvent } from './types';

const SIGIL = { name: 'Test sigil', damage: 10, damageType: 'magic' as const, pctPen: 0 };

function setup() {
  const b = testBattle({ rows: OPEN_7x7, jubal: { x: 3, y: 3 }, allies: [{ template: 'jabal', at: { x: 1, y: 1 }, id: 'jabal' }], enemies: [{ template: 'wolf', at: { x: 6, y: 6 }, initiative: 999 }], config: { reactionsEnabled: false } });
  return { b, jubal: b.units.find((u) => u.id === 'jubal')!, jabal: b.units.find((u) => u.id === 'jabal')!, wolf: b.units.find((u) => u.side === 'enemy')! };
}

/** End turns until the sigil resolves, returning its impact event. */
function impact(start: BattleState): { state: BattleState; event: Extract<GameEvent, { t: 'effectResolve' }> } {
  let state = start;
  for (let i = 0; i < 20 && state.effects.length; i++) {
    const r = applyAction(state, { type: 'endTurn', unitId: state.active!.unitId });
    state = r.state;
    const event = r.events.find((e) => e.t === 'effectResolve');
    if (event?.t === 'effectResolve') return { state, event };
  }
  throw new Error('sigil never resolved');
}

describe('telegraph catch reasons and escapes', () => {
  it('a unit whose next turn comes after impact is caught as late, with both times', () => {
    const { b, jabal, wolf } = setup();
    expect(b.active?.unitId).toBe('jubal');
    jabal.nextTurnAt = 200;
    castEffect(b, wolf, { ...SIGIL, tiles: [jabal.pos], delay: 10 }, []);
    const { event } = impact(b);
    expect(event.hits.find((h) => h.unitId === 'jabal')?.caught).toEqual({ reason: 'late', nextTurnAt: 200 });
    expect(event.escaped).toEqual([]);
  });

  it('a unit that steps out on its turn is reported escaped and credited once', () => {
    const { b, jubal, wolf } = setup();
    expect(b.active?.unitId).toBe('jubal');
    castEffect(b, wolf, { ...SIGIL, tiles: [jubal.pos], delay: 60 }, []);
    const moved = applyAction(b, { type: 'move', unitId: 'jubal', to: { x: 2, y: 3 } }).state;
    const { state, event } = impact(moved);
    expect(event.hits).toEqual([]);
    expect(event.escaped).toEqual(['jubal']);
    expect(state.telemetry.jubal).toMatchObject({ escapes: 1, caught: 0 });
  });

  it('a unit that could leave but ends its turns inside is caught as stayed', () => {
    const { b, jubal, wolf } = setup();
    castEffect(b, wolf, { ...SIGIL, tiles: [jubal.pos], delay: 60 }, []);
    const { state, event } = impact(b);
    expect(event.hits.find((h) => h.unitId === 'jubal')?.caught?.reason).toBe('stayed');
    expect(state.telemetry.jubal).toMatchObject({ escapes: 0, caught: 1 });
  });

  it('a unit with no reachable clear tile on its turn is caught as trapped', () => {
    const { b, jubal, wolf } = setup();
    jubal.immobile = true;
    b.active!.movementLocked = true;
    castEffect(b, wolf, { ...SIGIL, tiles: [jubal.pos], delay: 60 }, []);
    const { event } = impact(b);
    expect(event.hits.find((h) => h.unitId === 'jubal')?.caught?.reason).toBe('trapped');
  });

  it('a unit knocked out before impact is neither hit nor credited with an escape', () => {
    const { b, jabal, wolf } = setup();
    jabal.nextTurnAt = 200;
    castEffect(b, wolf, { ...SIGIL, tiles: [jabal.pos], delay: 10 }, []);
    jabal.hp = 0;
    jabal.ko = true;
    const { state, event } = impact(b);
    expect(event.hits).toEqual([]);
    expect(event.escaped).toEqual([]);
    expect(state.telemetry.jabal?.escapes).toBe(0);
  });
});

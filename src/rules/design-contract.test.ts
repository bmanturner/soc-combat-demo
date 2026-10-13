// Canonical design contracts, including instant movement and delayed damage.
import { describe, expect, it } from 'vitest';
import { advance, applyAction, castEffect, strike } from './engine';
import { dangerAt, reachable } from './queries';
import { isFlanked, unitById } from './state';
import { OPEN_7x7, play, testBattle } from './testkit';
import type { GameEvent } from './types';
import { enemyAction } from './ai';

describe('Canonical design contracts', () => {
  it('D-01: a nonempty 10 AP turn returns after 10 AP, not the empty-Wait price', () => {
    const s = testBattle({ rows: OPEN_7x7, jubal: { x: 0, y: 0 }, enemies: [{ template: 'wolf', at: { x: 6, y: 6 }, initiative: 999 }] });
    const r = play(s, [{ type: 'move', unitId: 'jubal', to: { x: 1, y: 0 } }, { type: 'endTurn', unitId: 'jubal' }]);
    expect(r.events.find(e => e.t === 'turnEnd')).toMatchObject({ spent: 10, delay: 10 });
  });

  it('D-02: Flanked increases delayed magic damage too', () => {
    const s = testBattle({ rows: OPEN_7x7, jubal: { x: 3, y: 3 }, enemies: [
      { template: 'wolf', at: { x: 3, y: 2 }, id: 'north', initiative: 999 },
      { template: 'wolf', at: { x: 3, y: 4 }, id: 'south', initiative: 999 },
    ] });
    const j = unitById(s, 'jubal');
    j.mr = 0;
    expect(isFlanked(s, j)).toBe(true);
    castEffect(s, unitById(s, 'north'), { name: 'probe', tiles: [j.pos], delay: 1, damage: 40, damageType: 'magic', pctPen: 0 }, []);
    j.nextTurnAt = 999;
    s.active = null;
    advance(s, []);
    expect(j.maxHp - j.hp).toBe(50);
  });

  it('D-03: an early turn is not a guaranteed escape without a reachable safe tile', () => {
    const s = testBattle({ rows: OPEN_7x7, armor: 'heavy', jubal: { x: 3, y: 3 }, enemies: [{ template: 'wolf', at: { x: 6, y: 6 }, initiative: 999 }] });
    const j = unitById(s, 'jubal');
    const zone = [...reachable(s, 'jubal').values()].map(r => r.path[r.path.length - 1]!);
    castEffect(s, s.units[1]!, { name: 'inescapable', tiles: zone, delay: 30, damage: 500, damageType: 'physical', pctPen: 0 }, []);
    expect([...reachable(s, 'jubal').keys()].every(k => zone.some(t => `${t.x},${t.y}` === k))).toBe(true);
    expect(dangerAt(s, j.pos, 25)[0]?.safe).toBe(false);
  });

  it('D-04: delayedHitsAllies includes the caster standing in its own sigil', () => {
    const s = testBattle({ rows: OPEN_7x7, jubal: { x: 6, y: 6 }, enemies: [{ template: 'cultist_mage', at: { x: 3, y: 3 }, id: 'seer', initiative: 999 }], config: { delayedHitsAllies: true } });
    const seer = unitById(s, 'seer');
    castEffect(s, seer, { name: 'self sigil', tiles: [seer.pos], delay: 1, damage: 40, damageType: 'magic', pctPen: 0 }, []);
    unitById(s, 'jubal').nextTurnAt = 999;
    s.active = null;
    advance(s, []);
    expect(seer.hp).toBeLessThan(seer.maxHp);
  });

  it('D-05: a charger attacks the closest enemy rather than a weaker farther enemy', () => {
    let s = testBattle({ rows: OPEN_7x7, jubal: { x: 3, y: 2 }, armor: 'heavy', allies: [{ template: 'jabal', at: { x: 6, y: 3 }, id: 'jabal', initiative: 999 }], enemies: [{ template: 'wolf', at: { x: 3, y: 3 }, id: 'wolf', initiative: 0 }] });
    const j = unitById(s, 'jubal');
    j.hp = j.maxHp = 1000;
    const other = unitById(s, 'jabal');
    other.armor = 0;
    other.hp = 1;
    other.dodge = other.parry = other.block = 0;
    s = applyAction(s, { type: 'endTurn', unitId: 'jubal' }).state;
    expect(s.active?.unitId).toBe('wolf');
    const first = enemyAction(s);
    if (first.type === 'move') s = applyAction(s, first).state;
    expect(enemyAction(s)).toMatchObject({ type: 'attack', target: { x: 3, y: 2 } });
  });

  it('D-06: turns automatically finish after both action and movement are exhausted', () => {
    const s = testBattle({ rows: OPEN_7x7, jubal: { x: 0, y: 0 }, enemies: [{ template: 'wolf', at: { x: 5, y: 1 }, initiative: 999 }] });
    const r = play(s, [{ type: 'move', unitId: 'jubal', to: { x: 5, y: 0 } }, { type: 'attack', unitId: 'jubal', target: { x: 5, y: 1 } }]);
    expect(r.events.some(e => e.t === 'turnEnd')).toBe(true);
  });

  it('D-13: zero configured effect damage deals zero, not one', () => {
    const s = testBattle({ rows: OPEN_7x7, jubal: { x: 3, y: 3 }, enemies: [{ template: 'wolf', at: { x: 6, y: 6 }, initiative: 999 }] });
    const j = unitById(s, 'jubal');
    castEffect(s, s.units[1]!, { name: 'zero damage', tiles: [j.pos], delay: 1, damage: 0, damageType: 'physical', pctPen: 0 }, []);
    j.nextTurnAt = 999; s.active = null;
    advance(s, []);
    expect(j.hp).toBe(j.maxHp);
  });

  it('reaction control: highest-first successful block charges AP and ranged is never parried', () => {
    const s = testBattle({ rows: OPEN_7x7, jubal: { x: 3, y: 3 }, enemies: [{ template: 'wolf', at: { x: 3, y: 2 }, initiative: 999 }], config: { critChance: 0 } });
    const j = unitById(s, 'jubal');
    j.block = 1; j.parry = 0.9; j.dodge = 0.2;
    const events: GameEvent[] = [];
    const wolf = s.units[1]!;
    const ev = strike(s, wolf, j, { ...wolf.attack, hit: 1, ranged: true }, 0, events);
    expect(ev.hit).toBe(true);
    expect(ev.avoided).toBe('block');
    expect(ev.reactions.map(r => r.kind)).toEqual(['block']);
    expect(s.active?.reactionSpent).toBe(35);
  });
});

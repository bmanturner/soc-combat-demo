// Canonical design contracts, including instant movement and delayed damage.
import { describe, expect, it } from 'vitest';
import { advance, applyAction, castEffect, createBattle, strike } from './engine';
import { DEFAULT_CONFIG, type RulesConfig } from './config';
import { dangerAt, previewSwap, projectedNextTurn, reachable } from './queries';
import { isFlanked, unitById } from './state';
import { OPEN_7x7, play, testBattle, testEncounter } from './testkit';
import type { GameEvent } from './types';
import { enemyAction } from './ai';

describe('Canonical design contracts', () => {
  it('D-01: a move-only 10 AP turn returns after 35 (10 + 25 no-action surcharge, Aaron\'s ruling), not the empty-Wait price', () => {
    const s = testBattle({ rows: OPEN_7x7, jubal: { x: 0, y: 0 }, enemies: [{ template: 'wolf', at: { x: 6, y: 6 }, initiative: 999 }] });
    const r = play(s, [{ type: 'move', unitId: 'jubal', to: { x: 1, y: 0 } }, { type: 'endTurn', unitId: 'jubal' }]);
    expect(r.events.find(e => e.t === 'turnEnd')).toMatchObject({ spent: 10, delay: 35 });
  });
  describe('no-action turn surcharge (noActionTurnAp)', () => {
    const lone = (config: Partial<RulesConfig> = {}) => testBattle({ rows: OPEN_7x7, jubal: { x: 0, y: 0 }, enemies: [{ template: 'wolf', at: { x: 6, y: 6 }, initiative: 999 }], config });
    const endEvent = (events: GameEvent[], unitId: string) => {
      const e = events.find(x => x.t === 'turnEnd' && x.unitId === unitId);
      if (e?.t !== 'turnEnd') throw new Error('no turnEnd');
      return e;
    };

    it('player move-only turn: delay = moveSpent + 25, and the projection before ending agrees', () => {
      let s = lone();
      s = applyAction(s, { type: 'move', unitId: 'jubal', to: { x: 3, y: 0 } }).state;
      const spent = s.active!.moveSpent;
      expect(spent).toBe(30);
      expect(projectedNextTurn(s, 0)).toBe(spent + 25);
      const end = endEvent(applyAction(s, { type: 'endTurn', unitId: 'jubal' }).events, 'jubal');
      expect(end.delay).toBe(spent + 25);
      expect(end.nextTurnAt).toBe(spent + 25);
    });

    it('move + basic attack: delay = spent, no surcharge', () => {
      const s = testBattle({ rows: OPEN_7x7, jubal: { x: 0, y: 0 }, enemies: [{ template: 'wolf', at: { x: 2, y: 0 }, initiative: 999 }], config: { reactionsEnabled: false } });
      let t = applyAction(s, { type: 'move', unitId: 'jubal', to: { x: 1, y: 0 } }).state;
      t = applyAction(t, { type: 'attack', unitId: 'jubal', target: { x: 2, y: 0 } }).state;
      if (t.active?.unitId !== 'jubal') throw new Error('turn auto-ended; fixture expects an open turn after one move and one attack');
      const a = t.active;
      const spent = a.moveSpent + a.actionSpent + a.reactionSpent;
      expect(a.actionSpent).toBeGreaterThan(0);
      expect(projectedNextTurn(t, 0)).toBe(spent);
      expect(endEvent(applyAction(t, { type: 'endTurn', unitId: 'jubal' }).events, 'jubal')).toMatchObject({ spent, delay: spent });
    });

    it('swap-only turn (no move, no attack) counts as an action: no surcharge', () => {
      const enc = testEncounter({ rows: OPEN_7x7, jubal: { x: 3, y: 3 }, enemies: [{ template: 'wolf', at: { x: 6, y: 6 }, initiative: 9999 }] });
      const s = createBattle(enc, { weaponIds: ['daggers', 'shield'], armor: 'light' }, { ...DEFAULT_CONFIG, autoEndTurn: false, reactionsEnabled: false, critChance: 0 }, 1).state;
      const preview = previewSwap(s, unitById(s, 'jubal'), 1);
      expect(preview.valid).toBe(true);
      const swapped = applyAction(s, { type: 'swapWeapon', unitId: 'jubal', slot: 1 });
      expect(swapped.state.active!.acted).toBe(true);
      const spent = swapped.state.active!.actionSpent;
      expect(spent).toBe(preview.apCost);
      expect(projectedNextTurn(swapped.state, 0)).toBe(spent);
      expect(endEvent(applyAction(swapped.state, { type: 'endTurn', unitId: 'jubal' }).events, 'jubal')).toMatchObject({ spent, delay: spent });
    });

    it('Wait (nothing spent) returns after exactly 25', () => {
      const s = lone();
      expect(projectedNextTurn(s, 0)).toBe(25);
      expect(endEvent(applyAction(s, { type: 'endTurn', unitId: 'jubal' }).events, 'jubal')).toMatchObject({ spent: 0, delay: 25, nextTurnAt: 25 });
    });

    it('an enemy that only moves pays the surcharge too', () => {
      let s = testBattle({ rows: OPEN_7x7, jubal: { x: 0, y: 0 }, enemies: [{ template: 'wolf', at: { x: 6, y: 6 }, id: 'wolf', initiative: 0 }] });
      s = applyAction(s, { type: 'endTurn', unitId: 'jubal' }).state;
      expect(s.active?.unitId).toBe('wolf');
      s = applyAction(s, { type: 'move', unitId: 'wolf', to: { x: 6, y: 5 } }).state;
      const spent = s.active!.moveSpent;
      expect(spent).toBeGreaterThan(0);
      expect(s.active!.acted).toBe(false);
      expect(projectedNextTurn(s, 0)).toBe(spent + 25);
      expect(endEvent(applyAction(s, { type: 'endTurn', unitId: 'wolf' }).events, 'wolf')).toMatchObject({ spent, delay: spent + 25 });
    });

    it('massive boss turn delay is unchanged: max(spent, bossTurnAp), no surcharge', () => {
      let s = testBattle({ rows: OPEN_7x7, jubal: { x: 2, y: 5 }, enemies: [{ template: 'nephilim', at: { x: 2, y: 0 }, id: 'nephilim', initiative: 0 }], config: { tiePlayerFirst: false, reactionsEnabled: false, critChance: 0 }, boss: { eye: { x: 3, y: 1 }, sweepRowStart: 2, sweepCols: [0, 6] } });
      while (s.active?.unitId !== 'nephilim') s = applyAction(s, { type: 'endTurn', unitId: s.active!.unitId }).state;
      const end = endEvent(applyAction(s, { type: 'endTurn', unitId: 'nephilim' }).events, 'nephilim');
      expect(end.spent).toBe(0);
      expect(end.delay).toBe(s.config.bossTurnAp);
      expect(projectedNextTurn(s, 0)).toBe(s.config.bossTurnAp);
    });

    it('the setting is respected: noActionTurnAp = 40 makes a move-only 10 AP turn return after 50', () => {
      let s = lone({ noActionTurnAp: 40 });
      expect(projectedNextTurn(s, 0)).toBe(40);
      s = applyAction(s, { type: 'move', unitId: 'jubal', to: { x: 1, y: 0 } }).state;
      const projected = projectedNextTurn(s, 0);
      expect(projected).toBe(50);
      const end = endEvent(applyAction(s, { type: 'endTurn', unitId: 'jubal' }).events, 'jubal');
      expect(end.spent).toBe(10);
      expect(end.delay).toBe(projected);
    });
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

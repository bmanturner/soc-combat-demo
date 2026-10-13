import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { IncomingPanel } from '../hud/Incoming';
import { Timeline } from '../hud/Timeline';
import { ActionPanel } from '../hud/ActionPanel';
import { applyAction, castEffect } from '../rules/engine';
import { OPEN_7x7, testBattle } from '../rules/testkit';
import { unitById } from '../rules/state';
import { reachable } from '../rules/queries';
import { judge, pendingFor } from './preview';
import { store } from './store';
import { controller, registerAnimator } from './controller';
vi.mock('../hud/hooks', async importOriginal => ({ ...await importOriginal<object>(), useGame: (selector: (s: ReturnType<typeof store.getState>) => unknown) => selector(store.getState()) }));
const battle = () => testBattle({ rows: OPEN_7x7, jubal: { x: 3, y: 3 }, enemies: [{ template: 'wolf', at: { x: 6, y: 6 }, initiative: 999 }], config: { reactionsEnabled: false, critChance: 0 } });
afterEach(() => { registerAnimator(null); vi.useRealTimers(); });

describe('HUD and engine parity', () => {
  it('Incoming, judge and timeline warn when an early turn has no safe reachable tile', () => {
    const b = battle();
    const tiles = b.map.tiles.map((_, i) => ({ x: i % b.map.width, y: Math.floor(i / b.map.width) }));
    castEffect(b, b.units[1]!, { name: 'Flood', tiles, delay: 50, damage: 10, damageType: 'magic', pctPen: 0 }, []);
    store.setState({ battle: b, busy: false, hoverTile: null, botParty: false });
    const html = renderToStaticMarkup(createElement(IncomingPanel));
    expect(html).toContain('CAUGHT (no reachable safe tile)');
    expect(html).not.toContain('can still escape');
    expect(judge(b, b.units[0]!.pos, 25).danger).toBe('hit');
    expect(renderToStaticMarkup(createElement(Timeline))).toContain('no escape');
  });
  it.each([true, false])('anticipated sweep danger honors impact equality (%s units first)', first => {
    const b = testBattle({ rows: OPEN_7x7, jubal: { x: 3, y: 4 }, enemies: [{ template: 'nephilim', at: { x: 2, y: 0 }, initiative: 30 }], boss: { eye: { x: 3, y: 1 }, sweepRowStart: 2, sweepCols: [0, 6] }, config: { tieUnitBeforeEffect: first, sweepDelay: 75, sweepDepth: 3 } });
    expect(judge(b, b.units[0]!.pos, 105).danger).toBe(first ? 'none' : 'risk');
  });
  it('immune caster is absent from Incoming and receives no escape credit', () => {
    let b = battle(); b.config.delayedHitsAllies = false;
    castEffect(b, b.units[0]!, { name: 'Self sigil', tiles: [b.units[0]!.pos], delay: 1, damage: 10, damageType: 'magic', pctPen: 0 }, []);
    expect(b.effects[0]!.threatenedAtCast).toEqual([]);
    store.setState({ battle: b });
    expect(renderToStaticMarkup(createElement(IncomingPanel))).not.toContain('CAUGHT');
    b = applyAction(b, { type: 'endTurn', unitId: 'jubal' }).state;
    expect(b.telemetry.jubal).toMatchObject({ escapes: 0, caught: 0, damageTaken: 0 });
  });
  it('winning action is included in report AP exactly once', () => {
    const b = battle(); const enemy = b.units[1]!; enemy.pos = { x: 4, y: 3 }; enemy.hp = 1;
    const result = applyAction(b, { type: 'attack', unitId: 'jubal', target: enemy.pos });
    expect(result.state.outcome).toBe('victory');
    expect(result.state.telemetry.jubal).toMatchObject({ actionAp: 50, turns: 1 });
    expect(result.events.filter(e => e.t === 'turnEnd')).toHaveLength(1);
  });
  it('bow move-after-shot hover includes surcharge and matches actual turn-end', () => {
    let b = testBattle({ rows: OPEN_7x7, weapon: 'hunting_bow', jubal: { x: 0, y: 0 }, enemies: [{ template: 'wolf', at: { x: 4, y: 0 }, initiative: 999 }] });
    b = applyAction(b, { type: 'attack', unitId: 'jubal', target: { x: 4, y: 0 } }).state;
    const r = [...reachable(b, 'jubal').values()].find(x => x.path.length === 2)!;
    const to = r.path.at(-1)!;
    const p = pendingFor({ battle: b, hoverTile: to, mode: { kind: 'move' }, busy: false })!;
    expect(p.extra).toBe(60); expect(p.projected).toBe(135);
    b = applyAction(b, { type: 'move', unitId: 'jubal', to }).state;
    store.setState({ battle: b, busy: false, botParty: false });
    expect(renderToStaticMarkup(createElement(ActionPanel))).toContain('Attack · 125');
    const end = applyAction(b, { type: 'endTurn', unitId: 'jubal' }).events.find(e => e.t === 'turnEnd');
    expect(end?.delay).toBe(p.projected);
  });
  it('controller accepts engine auto-end without a duplicate endTurn', async () => {
    const b = battle();
    unitById(b, 'wolf').pos = { x: 4, y: 3 };
    b.active!.moveSpent = 50;
    store.setState({ battle: b, busy: false, botParty: false, mode: { kind: 'attack' }, actions: [] });
    await controller.clickTile({ x: 4, y: 3 });
    expect(store.getState().battle!.telemetry.jubal!.turns).toBe(1);
    expect(store.getState().actions).toHaveLength(1);
    expect(store.getState().battle!.active!.acted).toBe(false);
  });
});

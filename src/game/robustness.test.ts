import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { controller, registerAnimator } from './controller';
import { store } from './store';
import { DEFAULT_CONFIG } from '../rules/config';
import { decodeShare, encodeShare } from './share';

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('location', { origin: 'https://example.test', pathname: '/' });
  vi.stubGlobal('history', { replaceState: vi.fn() });
  controller.openMenu();
  store.setState({ encounterId: 'granary', weaponId: 'daggers', armor: 'clothing', seed: 1, config: { ...DEFAULT_CONFIG }, botParty: false, speed: 1 });
  controller.startBattle();
});
afterEach(() => { controller.openMenu(); registerAnimator(null); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('controller transaction regressions', () => {
  it('U-02 immediate bot handoff after restart cannot lose the loop wakeup', async () => {
    controller.restart();
    controller.setBotParty(true);
    await vi.advanceTimersByTimeAsync(500);
    expect(store.getState().actions.length).toBeGreaterThan(0);
  });
  it('U-02 duplicate manual commands cannot overlap; rejected animation releases busy', async () => {
    let reject!: (reason: Error) => void;
    const play = vi.fn(() => new Promise<void>((_resolve, fail) => { reject = fail; }));
    registerAnimator({ play });
    const first = controller.clickTile({ x: 5, y: 4 });
    await controller.clickTile({ x: 4, y: 4 });
    await controller.endTurn();
    expect(play).toHaveBeenCalledTimes(1);
    reject(new Error('injected renderer failure'));
    await first;
    expect(store.getState().busy).toBe(false);
    expect(store.getState().actions).toHaveLength(1);
  });
  it('U-01 cancelled old animation cannot commit into the new generation', async () => {
    let finish!: () => void;
    const cancel = vi.fn(() => finish());
    registerAnimator({ play: () => new Promise<void>(resolve => { finish = resolve; }), cancel });
    const old = controller.clickTile({ x: 5, y: 4 });
    controller.restart();
    await old;
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(store.getState().actions).toHaveLength(0);
    expect(store.getState().busy).toBe(false);
  });
  it('U-02 bot during manual animation never overlaps play', async () => {
    let plays = 0;
    const pending: Array<() => void> = [];
    registerAnimator({ play: () => { plays++; return new Promise<void>(r => pending.push(r)); } });
    const manual = controller.clickTile({ x: 5, y: 4 });
    controller.setBotParty(true);
    await vi.advanceTimersByTimeAsync(230);
    const overlap = plays;
    controller.setBotParty(false);
    pending.forEach(r => r());
    await manual;
    await vi.advanceTimersByTimeAsync(500);
    expect(overlap).toBe(1);
    expect(store.getState().actions).toHaveLength(1);
  });
  it('U-02 disabling bot during think delay prevents an action', async () => {
    controller.setBotParty(true);
    controller.setBotParty(false);
    await vi.advanceTimersByTimeAsync(500);
    expect(store.getState().actions).toHaveLength(0);
  });
  it('U-01 menu cancels a stranded animation and a new loop progresses', async () => {
    registerAnimator({ play: () => new Promise<void>(() => {}) });
    controller.setBotParty(true);
    await vi.advanceTimersByTimeAsync(230);
    expect(store.getState().busy).toBe(true);
    controller.openMenu();
    registerAnimator(null);
    controller.startBattle();
    await vi.advanceTimersByTimeAsync(500);
    expect(store.getState().actions.length).toBeGreaterThan(0);
  });
});

describe('U-03 hostile share input', () => {
  it('roundtrips typed overrides', () => {
    const config = { ...DEFAULT_CONFIG, movementBudget: 80, diagonalMovement: true, multiEngager: 'each' as const };
    expect(decodeShare(encodeShare({ config })).config).toEqual(config);
  });
  it.each(['not-a-weapon', '__proto__', 'constructor'])('rejects weapon %s', w => {
    expect(decodeShare('#w=' + w).weaponId).toBe('daggers');
  });
  it.each(['Infinity', '-1', '1.5', '4294967296', '9'.repeat(400)])('bounds seed %s', s => {
    expect(decodeShare('#s=' + s).seed).toBe(1);
  });
  it('rejects invalid encounter and armor', () => {
    const s = decodeShare('#e=wat&a=wat');
    expect(s.encounterId).toBe('granary');
    expect(s.armor).toBe('clothing');
  });
  it.each(['%%%', btoa('null'), btoa('[]'), btoa('{"__proto__":{"polluted":true},"movementBudget":80}'), 'a'.repeat(20000)])('rejects garbage config', c => {
    expect(decodeShare('#c=' + c).config).toEqual(DEFAULT_CONFIG);
  });
});

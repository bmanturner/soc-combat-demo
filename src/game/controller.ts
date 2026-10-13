// Orchestrates battles: player input → rules → board animation → AI turns. The only place that mutates `store`.

import { attackModes, availableWeapons } from '../rules/equipment';
import { encounterById } from '../content/encounters';
import { botAction, enemyAction } from '../rules/ai';
import { DEFAULT_CONFIG, type RulesConfig } from '../rules/config';
import { describeEvent } from '../rules/describe';
import { RulesError, applyAction, createBattle } from '../rules/engine';
import { cheb, eq, key, type Vec } from '../rules/geometry';
import { attackOptions, previewAttack, previewSkill, reachable } from '../rules/queries';
import { occupant, unitById } from '../rules/state';
import type { Action, BattleState, GameEvent } from '../rules/types';
import { shareUrl } from './share';
import { showToast, store, type LogLine, type Mode } from './store';

export interface Animator {
  play(events: GameEvent[], before: BattleState, after: BattleState, speed: number): Promise<void>;
  /** Stop visual work and settle all pending play promises. */
  cancel?(): void;
}

let animator: Animator | null = null;
export function registerAnimator(a: Animator | null): void {
  animator = a;
}

/** Clear the animator only if it is still `a` (a newer board may have replaced it). */
export function unregisterAnimator(a: Animator): void {
  if (animator === a) animator = null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let logSeq = 0;
let battleToken = 0;
let releaseAnimation: (() => void) | null = null;
let transaction: Promise<void> | null = null;
let loopingToken: number | null = null;

function cancelBattle(): void {
  battleToken += 1;
  animator?.cancel?.();
  releaseAnimation?.();
  releaseAnimation = null;
  transaction = null;
  // Old continuations are token-guarded; they cannot clear the new loop's lock.
  loopingToken = null;
}

function toneOf(state: BattleState, e: GameEvent): LogLine['tone'] {
  const side = (id: string | undefined) => (id ? state.units.find((u) => u.id === id)?.side : undefined);
  switch (e.t) {
    case 'turnStart':
      return 'turn';
    case 'effectCast':
    case 'effectResolve':
      return 'danger';
    case 'ko':
      return side(e.unitId) === 'enemy' ? 'good' : 'danger';
    case 'outcome':
      return e.outcome === 'victory' ? 'good' : 'danger';
    case 'strike':
      return side(e.attackerId) === 'player' ? 'player' : 'enemy';
    case 'attack':
      return side(e.attackerId) === 'player' ? 'player' : 'enemy';
    case 'move':
    case 'disengage':
    case 'turnEnd':
      return side(e.unitId) === 'player' ? 'player' : 'enemy';
    default:
      return 'info';
  }
}

function appendLog(state: BattleState, events: GameEvent[]): void {
  const lines: LogLine[] = [];
  for (const e of events) {
    const text = describeEvent(state, e);
    if (!text) continue;
    logSeq += 1;
    lines.push({ id: logSeq, text, tone: toneOf(state, e) });
  }
  if (lines.length) store.setState((s) => ({ log: [...s.log, ...lines].slice(-400) }));
}

function syncHash(): void {
  const s = store.getState();
  const url = shareUrl({ encounterId: s.encounterId, weaponId: s.weaponId, secondaryWeaponId: s.secondaryWeaponId, equippedSlot: s.equippedSlot, armor: s.armor, seed: s.seed, config: s.config });
  history.replaceState(null, '', url);
}

function activePlayer(state: BattleState | null) {
  if (!state?.active || state.outcome !== 'ongoing') return null;
  const u = unitById(state, state.active.unitId);
  return u.side === 'player' ? u : null;
}

function defaultMode(state: BattleState): Mode {
  const u = activePlayer(state);
  const a = state.active;
  if (!u || !a) return { kind: 'move' };
  if (a.moved && !a.acted && attackOptions(state, u).length > 0) return { kind: 'attack' };
  return { kind: 'move' };
}

async function apply(action: Action): Promise<boolean> {
  const s = store.getState();
  const before = s.battle;
  if (!before || s.busy || before.active?.unitId !== action.unitId) return false;
  let result: { state: BattleState; events: GameEvent[] };
  try {
    result = applyAction(before, action);
  } catch (err) {
    if (err instanceof RulesError) {
      showToast(err.message);
      return false;
    }
    throw err;
  }
  const token = battleToken;
  store.setState({ busy: true, hoverTile: null });
  let release!: () => void;
  const cancelled = new Promise<void>(resolve => { release = resolve; });
  releaseAnimation = release;
  transaction = cancelled;
  try {
    if (animator) await Promise.race([animator.play(result.events, before, result.state, s.speed), cancelled]);
  } catch {
    // Animation is presentation only: commit the legal action and let refresh snap the board.
    if (token === battleToken) showToast('Animation interrupted; battle state recovered.');
  } finally {
    release();
    if (token === battleToken) { transaction = null; releaseAnimation = null; }
  }
  if (token !== battleToken) return false; // battle was restarted mid-animation
  appendLog(result.state, result.events);
  store.setState((st) => ({ battle: result.state, actions: [...st.actions, action], busy: false, mode: defaultMode(result.state) }));
  return true;
}

async function runLoop(): Promise<void> {
  const s = store.getState();
  if (!s.battle?.active || s.battle.outcome !== 'ongoing') return;
  if (activePlayer(s.battle) && !s.botParty) return;
  const token = battleToken;
  if (loopingToken === token) return;
  loopingToken = token;
  try {
    await loopBody();
  } finally {
    if (loopingToken === token) loopingToken = null;
  }
}

async function loopBody(): Promise<void> {
  const token = battleToken;
  for (let guard = 0; guard < 2000; guard++) {
    if (token !== battleToken) return;
    if (transaction) { await transaction; if (token !== battleToken) return; }
    const s = store.getState();
    const state = s.battle;
    if (s.busy || !state || state.outcome !== 'ongoing' || !state.active) return;
    const u = unitById(state, state.active.unitId);
    if (u.side === 'player' && !s.botParty) return;
    await sleep((u.side === 'player' ? 220 : 280) / s.speed);
    if (token !== battleToken) return;
    const latest = store.getState();
    const fresh = latest.battle;
    if (latest.busy || fresh !== state || fresh.active?.unitId !== u.id) continue;
    if (u.side === 'player' && !latest.botParty) return;
    let action: Action = u.side === 'player' ? botAction(fresh) : enemyAction(fresh);
    const ok = await apply(action);
    const current = store.getState();
    if (!ok && token === battleToken && !current.busy && current.battle?.active?.unitId === u.id && (u.side !== 'player' || current.botParty)) {
      action = { type: 'endTurn', unitId: u.id };
      await apply(action);
    }
  }
}

export const controller = {
  openMenu(): void {
    cancelBattle();
    store.setState({ screen: 'menu', battle: null, busy: false, log: [], actions: [] });
  },

  openSetup(encounterId: string): void {
    const enc = encounterById(encounterId);
    const s = store.getState();
    const armor = enc.allowedArmor.includes(s.armor) ? s.armor : enc.defaultArmor;
    cancelBattle();
    const weaponId = availableWeapons(enc, s.config).some(w => w.id === s.weaponId) ? s.weaponId : 'daggers';
    const secondaryWeaponId = encounterId !== 'granary' && availableWeapons(enc, s.config).some(w => w.id === s.secondaryWeaponId) ? s.secondaryWeaponId : null;
    store.setState({ screen: 'setup', battle: null, busy: false, encounterId, armor, weaponId, secondaryWeaponId, equippedSlot: secondaryWeaponId ? s.equippedSlot : 0 });
  },

  setLoadout(patch: Partial<{ weaponId: string; secondaryWeaponId: string | null; equippedSlot: 0 | 1; armor: 'clothing' | 'light' | 'medium' | 'heavy' }>): void {
    store.setState(patch);
  },

  startBattle(opts: { newSeed?: boolean } = {}): void {
    cancelBattle();
    const s = store.getState();
    const enc = encounterById(s.encounterId);
    const seed = opts.newSeed ? Math.floor(Math.random() * 2 ** 31) : s.seed;
    const armor = enc.allowedArmor.includes(s.armor) ? s.armor : enc.defaultArmor;
    const weaponId = availableWeapons(enc, s.config).some(w => w.id === s.weaponId) ? s.weaponId : 'daggers';
    const secondaryWeaponId = enc.id !== 'granary' && availableWeapons(enc, s.config).some(w => w.id === s.secondaryWeaponId) ? s.secondaryWeaponId : null;
    const equippedSlot = secondaryWeaponId ? s.equippedSlot : 0;
    store.setState({ secondaryWeaponId, equippedSlot, actionHover: null });
    const { state, events } = createBattle(enc, { weaponIds: [weaponId, secondaryWeaponId], equippedSlot, armor }, s.config, seed);
    logSeq = 0;
    store.setState({ screen: 'battle', weaponId, battle: state, battleGeneration: s.battleGeneration + 1, seed, armor, actions: [], log: [], busy: false, mode: defaultMode(state), boardVersion: s.boardVersion + 1, hoverTile: null, hoverUnitId: null });
    appendLog(state, [{ t: 'info', text: `${enc.name}: ${enc.story}` }, ...events]);
    syncHash();
    void runLoop();
  },

  restart(newSeed = false): void {
    controller.startBattle({ newSeed });
  },

  setMode(mode: Mode): void {
    const u = activePlayer(store.getState().battle);
    store.setState({ mode, actionHover: null, ...(mode.kind === 'attack' && mode.modeId === 'sweep' && u ? { hoverTile: u.pos } : {}) });
  },

  cycleMode(): void {
    const s = store.getState(), u = activePlayer(s.battle);
    if (!s.battle || !u) return;
    const modes = attackModes(s.battle, u);
    const current = s.mode.kind === 'attack' ? s.mode.modeId : undefined;
  const index = current === undefined ? 0 : modes.findIndex(m => m.id === current);
    controller.setMode({ kind: 'attack', modeId: modes[(index + 1) % modes.length]!.id });
  },

  async reload(): Promise<void> {
    const s = store.getState(), u = activePlayer(s.battle);
    if (!u || s.busy || s.botParty) return;
    if (await apply({ type: 'reload', unitId: u.id })) await runLoop();
  },

  async swapWeapon(): Promise<void> {
    const s = store.getState(), u = activePlayer(s.battle);
    if (!u || s.busy || s.botParty) return;
    if (await apply({ type: 'swapWeapon', unitId: u.id, slot: u.equippedSlot === 0 ? 1 : 0 })) await runLoop();
  },

  setSpeed(speed: number): void {
    store.setState({ speed });
  },

  setBotParty(on: boolean): void {
    store.setState({ botParty: on });
    if (on) void runLoop();
  },

  applyConfig(config: RulesConfig, restart: boolean): void {
    store.setState({ config });
    syncHash();
    if (restart && store.getState().battle) controller.startBattle();
  },

  resetConfig(): void {
    controller.applyConfig({ ...DEFAULT_CONFIG }, !!store.getState().battle);
  },

  hover(tile: Vec | null): void {
    const s = store.getState();
    if (s.hoverTile && tile && eq(s.hoverTile, tile)) return;
    const u = tile && s.battle ? occupant(s.battle, tile) : undefined;
    store.setState({ hoverTile: tile, hoverUnitId: u?.id ?? null });
  },

  hoverUnit(id: string | null): void {
    store.setState({ hoverUnitId: id });
  },

  async clickTile(tile: Vec): Promise<void> {
    const s = store.getState();
    const state = s.battle;
    const u = activePlayer(state);
    if (!state || !u || s.busy || s.botParty) return;
    const a = state.active!;
    if (s.mode.kind === 'move') {
      const r = reachable(state, u.id).get(key(tile));
      if (r && !eq(tile, u.pos)) {
        await apply({ type: 'move', unitId: u.id, to: tile });
        await runLoop();
        return;
      }
      const target = occupant(state, tile);
      if (target && target.side !== u.side && !a.acted && previewAttack(state, u, tile)) {
        await apply({ type: 'attack', unitId: u.id, target: tile });
        await runLoop();
        return;
      }
      if (a.movementLocked) showToast(`${u.name} can't move again this turn.`);
      else if (!eq(tile, u.pos)) showToast('Out of movement range.');
      return;
    }
    if (s.mode.kind === 'attack') {
      const modeId = s.mode.modeId;
      const mode = attackModes(state, u).find(m => m.id === modeId);
      if (mode?.pattern === 'ring8' && cheb(tile, u.pos) > 1) return showToast('Click yourself or a surrounding ring tile to commit Sweep.');
      if (a.acted) return showToast('Already acted this turn.');
      if (!previewAttack(state, u, tile, u.pos, s.mode.modeId)) return showToast('No target in this mode’s range and pattern.');
      await apply({ type: 'attack', unitId: u.id, target: tile, modeId: s.mode.modeId });
      await runLoop();
      return;
    }
    if (s.mode.kind === 'skill') {
      if (a.acted) return showToast('Already acted this turn.');
      if (!previewSkill(state, u, s.mode.skillId, tile)) return showToast('Invalid target for that skill.');
      await apply({ type: 'skill', unitId: u.id, skillId: s.mode.skillId, target: tile });
      await runLoop();
    }
  },

  async endTurn(): Promise<void> {
    const s = store.getState();
    const u = activePlayer(s.battle);
    if (!u || s.busy || s.botParty) return;
    const ok = await apply({ type: 'endTurn', unitId: u.id });
    if (ok) await runLoop();
  },

  shareLink(config?: RulesConfig): string {
    const s = store.getState();
    return shareUrl({ encounterId: s.encounterId, weaponId: s.weaponId, secondaryWeaponId: s.secondaryWeaponId, equippedSlot: s.equippedSlot, armor: s.armor, seed: s.seed, config: config ?? s.config });
  },
};

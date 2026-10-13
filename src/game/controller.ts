// Orchestrates battles: player input → rules → board animation → AI turns. The only place that mutates `store`.

import { encounterById } from '../content/encounters';
import { botAction, enemyAction } from '../rules/ai';
import { DEFAULT_CONFIG, type RulesConfig } from '../rules/config';
import { describeEvent } from '../rules/describe';
import { RulesError, applyAction, createBattle } from '../rules/engine';
import { eq, key, type Vec } from '../rules/geometry';
import { attackOptions, previewAttack, previewSkill, reachable } from '../rules/queries';
import { occupant, unitById } from '../rules/state';
import type { Action, BattleState, GameEvent } from '../rules/types';
import { shareUrl } from './share';
import { showToast, store, type LogLine, type Mode } from './store';

export interface Animator {
  play(events: GameEvent[], before: BattleState, after: BattleState, speed: number): Promise<void>;
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
  const url = shareUrl({ encounterId: s.encounterId, weaponId: s.weaponId, armor: s.armor, seed: s.seed, config: s.config });
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
  if (!before) return false;
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
  if (animator) await animator.play(result.events, before, result.state, store.getState().speed);
  if (token !== battleToken) return false; // battle was restarted mid-animation
  appendLog(result.state, result.events);
  store.setState((st) => ({ battle: result.state, actions: [...st.actions, action], busy: false, mode: defaultMode(result.state) }));
  return true;
}

let looping = false;
async function kickAfterRestart(): Promise<void> {
  // A previous loop may still be unwinding (it bails on the token change); wait for it, then run.
  for (let i = 0; i < 100 && looping; i++) await sleep(20);
  await runLoop();
}
async function runLoop(): Promise<void> {
  if (looping) return;
  looping = true;
  try {
    await loopBody();
  } finally {
    looping = false;
  }
}

async function loopBody(): Promise<void> {
  const token = battleToken;
  for (let guard = 0; guard < 2000; guard++) {
    if (token !== battleToken) return;
    const s = store.getState();
    const state = s.battle;
    if (!state || state.outcome !== 'ongoing' || !state.active) return;
    const u = unitById(state, state.active.unitId);
    if (u.side === 'player' && !s.botParty) return;
    await sleep((u.side === 'player' ? 220 : 280) / s.speed);
    if (token !== battleToken) return;
    const fresh = store.getState().battle!;
    let action: Action = u.side === 'player' ? botAction(fresh) : enemyAction(fresh);
    const ok = await apply(action);
    if (!ok && token === battleToken) {
      action = { type: 'endTurn', unitId: u.id };
      await apply(action);
    }
  }
}

export const controller = {
  openMenu(): void {
    battleToken += 1;
    store.setState({ screen: 'menu', battle: null, busy: false, log: [], actions: [] });
  },

  openSetup(encounterId: string): void {
    const enc = encounterById(encounterId);
    const s = store.getState();
    const armor = enc.allowedArmor.includes(s.armor) ? s.armor : enc.defaultArmor;
    store.setState({ screen: 'setup', encounterId, armor });
  },

  setLoadout(patch: Partial<{ weaponId: string; armor: 'clothing' | 'light' | 'medium' | 'heavy' }>): void {
    store.setState(patch);
  },

  startBattle(opts: { newSeed?: boolean } = {}): void {
    battleToken += 1;
    const s = store.getState();
    const enc = encounterById(s.encounterId);
    const seed = opts.newSeed ? Math.floor(Math.random() * 2 ** 31) : s.seed;
    const armor = enc.allowedArmor.includes(s.armor) ? s.armor : enc.defaultArmor;
    const { state, events } = createBattle(enc, { weaponId: s.weaponId, armor }, s.config, seed);
    logSeq = 0;
    store.setState({ screen: 'battle', battle: state, seed, armor, actions: [], log: [], busy: false, mode: defaultMode(state), boardVersion: s.boardVersion + 1, hoverTile: null, hoverUnitId: null });
    appendLog(state, [{ t: 'info', text: `${enc.name}: ${enc.story}` }, ...events]);
    syncHash();
    void kickAfterRestart();
  },

  restart(newSeed = false): void {
    controller.startBattle({ newSeed });
  },

  setMode(mode: Mode): void {
    store.setState({ mode });
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
      if (a.acted) return showToast('Already acted this turn.');
      if (!previewAttack(state, u, tile)) return showToast(u.attack.pattern === 'ranged' ? 'No target in range and sight there.' : 'Aim at an adjacent tile with an enemy in the pattern.');
      await apply({ type: 'attack', unitId: u.id, target: tile });
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

  shareLink(): string {
    const s = store.getState();
    return shareUrl({ encounterId: s.encounterId, weaponId: s.weaponId, armor: s.armor, seed: s.seed, config: s.config });
  },
};

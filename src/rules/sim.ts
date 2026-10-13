// Headless battle runner: bots play the party, AI plays the enemies. Used for balance sims and tests.

import { encounterById } from '../content/encounters';
import { botAction, enemyAction, type PartyPolicy } from './ai';
import type { RulesConfig } from './config';
import { RulesError, applyAction, createBattle } from './engine';
import { unitById } from './state';
import type { Action, BattleState, Setup } from './types';

export interface IllegalFallback {
  encounterId: string;
  seed: number;
  policy: PartyPolicy;
  clock: number;
  action: Action;
  active: BattleState['active'];
  message: string;
}

export interface SimResult {
  illegalFallbacks: number;
  fallbacks: IllegalFallback[];
  stallReason: 'clock-not-advancing' | 'no-combat-progress' | 'action-cap' | 'no-active-unit' | null;
  outcome: BattleState['outcome'] | 'stalled';
  clock: number;
  actions: number;
  partyHpPct: number;
  partyKos: number;
  playerTurns: number;
  caught: number;
  escapes: number;
  moveShare: number;
  state: BattleState;
}

export function runBattle(encounterId: string, setup: Setup, config: RulesConfig, seed: number, maxActions = 4000, policy: PartyPolicy = 'expert'): SimResult {
  return simulateBattle(createBattle(encounterById(encounterId), setup, config, seed).state, maxActions, policy);
}

/** Also accepts scripted/custom maps. Watchdogs distinguish scheduler freezes from tactical deadlock. */
export function simulateBattle(initial: BattleState, maxActions = 4000, policy: PartyPolicy = 'expert'): SimResult {
  let state = initial;
  let actions = 0;
  let frozen = 0;
  let noDamage = 0;
  let stallReason: SimResult['stallReason'] = null;
  const fallbacks: IllegalFallback[] = [];
  while (state.outcome === 'ongoing' && state.active && actions < maxActions) {
    const previous = state;
    const u = unitById(state, state.active.unitId);
    let action: Action = u.side === 'player' ? botAction(state, policy) : enemyAction(state);
    try {
      state = applyAction(state, action).state;
    } catch (err) {
      if (!(err instanceof RulesError)) throw err;
      // Keep the offending request and pre-fallback context; callers must not mistake
      // a recovered battle for a clean policy run.
      fallbacks.push({ encounterId: state.encounterId, seed: state.seed, policy, clock: state.clock, action, active: state.active ? { ...state.active } : null, message: err.message });
      action = { type: 'endTurn', unitId: u.id };
      state = applyAction(state, action).state;

    }
    actions += 1;
    frozen = state.clock > previous.clock ? 0 : frozen + 1;
    noDamage = state.units.some((u, i) => u.hp !== previous.units[i]?.hp || u.ko !== previous.units[i]?.ko) ? 0 : noDamage + 1;
    if (state.outcome === 'ongoing' && (frozen >= 100 || noDamage >= 250)) {
      stallReason = frozen >= 100 ? 'clock-not-advancing' : 'no-combat-progress';
      break;
    }
  }
  const party = state.units.filter((x) => x.side === 'player');
  const tel = party.map((p) => state.telemetry[p.id]!);
  const moveAp = tel.reduce((s, t) => s + t.moveAp, 0);
  const actAp = tel.reduce((s, t) => s + t.actionAp, 0);
  return {
    outcome: state.outcome === 'ongoing' ? 'stalled' : state.outcome,
    clock: state.clock,
    actions,
    partyHpPct: party.reduce((s, p) => s + p.hp, 0) / party.reduce((s, p) => s + p.maxHp, 0),
    partyKos: party.filter((p) => p.ko).length,
    playerTurns: tel.reduce((s, t) => s + t.turns, 0) / party.length,
    caught: tel.reduce((s, t) => s + t.caught, 0),
    escapes: tel.reduce((s, t) => s + t.escapes, 0),
    moveShare: moveAp / Math.max(1, moveAp + actAp),
    state,
    illegalFallbacks: fallbacks.length,
    fallbacks,
    stallReason: state.outcome === 'ongoing' ? stallReason ?? (state.active ? 'action-cap' : 'no-active-unit') : null,
  };
}

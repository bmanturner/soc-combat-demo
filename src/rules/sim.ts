// Headless battle runner: bots play the party, AI plays the enemies. Used for balance sims and tests.

import { encounterById } from '../content/encounters';
import { botAction, enemyAction } from './ai';
import type { RulesConfig } from './config';
import { RulesError, applyAction, createBattle } from './engine';
import { unitById } from './state';
import type { Action, BattleState, Setup } from './types';

export interface SimResult {
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

export function runBattle(encounterId: string, setup: Setup, config: RulesConfig, seed: number, maxActions = 4000): SimResult {
  let state = createBattle(encounterById(encounterId), setup, config, seed).state;
  let actions = 0;
  let stuck = 0;
  while (state.outcome === 'ongoing' && state.active && actions < maxActions) {
    const u = unitById(state, state.active.unitId);
    let action: Action = u.side === 'player' ? botAction(state) : enemyAction(state);
    try {
      state = applyAction(state, action).state;
    } catch (err) {
      if (!(err instanceof RulesError)) throw err;
      // An AI asked for something illegal: end its turn rather than wedge the sim.
      action = { type: 'endTurn', unitId: u.id };
      state = applyAction(state, action).state;
      stuck += 1;
    }
    actions += 1;
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
    ...(stuck ? {} : {}),
  };
}

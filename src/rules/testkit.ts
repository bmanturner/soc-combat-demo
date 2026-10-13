// Helpers for building small deterministic battles in tests and fixtures.

import { DEFAULT_CONFIG, type RulesConfig } from './config';
import { applyAction, createBattle } from './engine';
import type { Vec } from './geometry';
import type { Action, ArmorClass, BattleState, EncounterDef, GameEvent, Placement } from './types';

export interface TestBattleOpts {
  rows: string[];
  jubal: Vec;
  weapon?: string;
  armor?: ArmorClass;
  level?: number;
  allies?: Placement[];
  enemies?: Placement[];
  config?: Partial<RulesConfig>;
  seed?: number;
  boss?: EncounterDef['boss'];
}

export function testEncounter(o: TestBattleOpts): EncounterDef {
  return {
    id: 'test',
    name: 'Test',
    subtitle: '',
    lesson: '',
    story: '',
    floorTone: '#000',
    map: { width: o.rows[0]!.length, height: o.rows.length, rows: o.rows },
    jubalLevel: o.level ?? 1,
    jubalAt: o.jubal,
    allowedArmor: ['clothing', 'light', 'medium', 'heavy'],
    defaultArmor: o.armor ?? 'light',
    allies: o.allies ?? [],
    enemies: o.enemies ?? [],
    ...(o.boss && { boss: o.boss }),
    targetTurns: '',
    danger: '',
  };
}

export function testBattle(o: TestBattleOpts): BattleState {
  const config = { ...DEFAULT_CONFIG, ...o.config };
  return createBattle(testEncounter(o), { weaponId: o.weapon ?? 'daggers', armor: o.armor ?? 'light' }, config, o.seed ?? 1).state;
}

/** Apply a list of actions, collecting events. */
export function play(state: BattleState, actions: Action[]): { state: BattleState; events: GameEvent[] } {
  let s = state;
  const events: GameEvent[] = [];
  for (const a of actions) {
    const r = applyAction(s, a);
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events };
}

export const OPEN_7x7 = ['.......', '.......', '.......', '.......', '.......', '.......', '.......'];

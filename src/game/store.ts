// App state shared by the Phaser board and the React HUD (vanilla Zustand store: no React dependency).

import { createStore } from 'zustand/vanilla';
import { DEFAULT_CONFIG, type RulesConfig } from '../rules/config';
import type { Vec } from '../rules/geometry';
import type { Action, ArmorClass, BattleState } from '../rules/types';

export type Mode = { kind: 'move' } | { kind: 'attack'; modeId?: string } | { kind: 'skill'; skillId: string };
export type ActionHover = 'reload' | 'swap' | null;

export interface LogLine {
  id: number;
  text: string;
  tone: 'turn' | 'player' | 'enemy' | 'danger' | 'good' | 'info';
}

export interface Toast {
  id: number;
  text: string;
}

export interface GameStore {
  screen: 'menu' | 'setup' | 'battle';
  encounterId: string;
  weaponId: string;
  secondaryWeaponId: string | null;
  equippedSlot: 0 | 1;
  actionHover: ActionHover;
  armor: ArmorClass;
  seed: number;
  config: RulesConfig;
  battle: BattleState | null;
  actions: Action[];
  log: LogLine[];
  mode: Mode;
  hoverTile: Vec | null;
  hoverUnitId: string | null;
  busy: boolean;
  speed: number;
  botParty: boolean;
  settingsOpen: boolean;
  helpOpen: boolean;
  toast: Toast | null;
  /** Bumped whenever the board must fully redraw (new battle, resize). */
  boardVersion: number;
  /** Unique fight identity, independent of seed, time and board redraws. */
  battleGeneration: number;
}

export const store = createStore<GameStore>(() => ({
  screen: 'menu',
  encounterId: 'granary',
  weaponId: 'daggers',
  secondaryWeaponId: null,
  equippedSlot: 0,
  actionHover: null,
  armor: 'clothing',
  seed: 1,
  config: { ...DEFAULT_CONFIG },
  battle: null,
  actions: [],
  log: [],
  mode: { kind: 'move' },
  hoverTile: null,
  hoverUnitId: null,
  busy: false,
  speed: 1,
  botParty: false,
  settingsOpen: false,
  helpOpen: false,
  toast: null,
  boardVersion: 0,
  battleGeneration: 0,
}));

let toastSeq = 0;
export function showToast(text: string): void {
  toastSeq += 1;
  const id = toastSeq;
  store.setState({ toast: { id, text } });
  setTimeout(() => {
    if (store.getState().toast?.id === id) store.setState({ toast: null });
  }, 2600);
}

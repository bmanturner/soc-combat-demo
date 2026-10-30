// App state shared by the boards and the React HUD (vanilla Zustand store: no React dependency).

import { createStore } from 'zustand/vanilla';
import { DEFAULT_CONFIG, type RulesConfig } from '../rules/config';
import type { Vec } from '../rules/geometry';
import type { Action, ArmorClass, BattleState } from '../rules/types';

export type Mode = { kind: 'move' } | { kind: 'attack'; modeId?: string } | { kind: 'skill'; skillId: string };
export type ActionHover = 'reload' | 'swap' | null;
export type BoardViewKind = '2d' | '3d';
export type SheetTab = 'actions' | 'intel';

export const BOARD_VIEW_KEY = 'soc.boardView';
/** Devices whose primary input cannot hover (phones, tablets): UI copy says "tap" instead of "click/hover". */
export const TOUCH_UI_QUERY = '(hover: none) and (pointer: coarse)';
export const TELEGRAPH_GUIDE_KEY = 'soc.guide.telegraph';

/** Read a per-browser preference; storage can be missing (tests) or blocked (private mode). */
function saved(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

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
  /** Board renderer: Phaser 2D or three.js 3D. Presentation only; not part of share links. */
  boardView: BoardViewKind;
  /** The first-telegraph guide was finished or skipped in this browser; Help can replay it. */
  telegraphGuideDone: boolean;
  /** Which battle panel the compact (phone) layouts show. Presentation only. */
  sheetTab: SheetTab;
  /** The portrait bottom panel is expanded. Presentation only. */
  sheetOpen: boolean;
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
  boardView: saved(BOARD_VIEW_KEY) === '3d' ? '3d' : '2d',
  telegraphGuideDone: saved(TELEGRAPH_GUIDE_KEY) === 'done',
  sheetTab: 'actions',
  sheetOpen: false,
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

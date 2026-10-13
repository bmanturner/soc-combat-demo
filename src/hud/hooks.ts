import { useStore } from 'zustand';
import { store, type GameStore } from '../game/store';

export function useGame<T>(selector: (s: GameStore) => T): T {
  return useStore(store, selector);
}

export const pct = (n: number) => `${Math.round(n * 100)}%`;
export const ap = (n: number) => `${Math.round(n * 10) / 10}`;

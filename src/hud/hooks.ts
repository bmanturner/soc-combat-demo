import { useStore } from 'zustand';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { TOUCH_UI_QUERY, store, type GameStore } from '../game/store';

export function useGame<T>(selector: (s: GameStore) => T): T {
  return useStore(store, selector);
}

let touchQuery: MediaQueryList | null = null;
const touchMedia = (): MediaQueryList | null =>
  touchQuery ?? (typeof matchMedia === 'function' ? (touchQuery = matchMedia(TOUCH_UI_QUERY)) : null);
const subscribeTouch = (cb: () => void) => {
  const q = touchMedia();
  q?.addEventListener('change', cb);
  return () => q?.removeEventListener('change', cb);
};

/** The primary input cannot hover (phone, tablet): copy should say "tap", and taps preview before committing. */
export function useTouchUI(): boolean {
  return useSyncExternalStore(subscribeTouch, () => touchMedia()?.matches ?? false, () => false);
}

/** Focus the dialog itself (Space must not activate its first button), trap Tab, restore opener. */
export function useModal(open: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!open || !root) return;
    const opener = document.activeElement;
    root.focus();
    const onKey = (e: KeyboardEvent) => {
      const dialogs = document.querySelectorAll('[aria-modal="true"]');
      if (e.key !== 'Tab' || dialogs[dialogs.length - 1] !== root) return;
      const controls = [...root.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]')];
      const first = controls[0];
      const last = controls.at(-1);
      if (!first || !last) { e.preventDefault(); root.focus(); return; }
      if (e.shiftKey && (document.activeElement === first || document.activeElement === root)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [open]);
  return ref;
}

export const pct = (n: number) => `${Math.round(n * 100)}%`;
export const ap = (n: number) => `${Math.round(n * 10) / 10}`;

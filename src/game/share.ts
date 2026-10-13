// Share links: encounter, loadout, seed and only the settings that differ from defaults.

import { DEFAULT_CONFIG, diffFromDefaults, withOverrides, type RulesConfig } from '../rules/config';
import type { ArmorClass } from '../rules/types';

export interface ShareState {
  encounterId?: string;
  weaponId?: string;
  armor?: ArmorClass;
  seed?: number;
  config: RulesConfig;
}

const toB64Url = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64Url = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));

export function encodeShare(s: ShareState): string {
  const p = new URLSearchParams();
  if (s.encounterId) p.set('e', s.encounterId);
  if (s.weaponId) p.set('w', s.weaponId);
  if (s.armor) p.set('a', s.armor);
  if (s.seed !== undefined) p.set('s', String(s.seed));
  const diff = diffFromDefaults(s.config);
  if (Object.keys(diff).length) p.set('c', toB64Url(JSON.stringify(diff)));
  return p.toString();
}

export function decodeShare(hash: string): ShareState {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  let config: RulesConfig = { ...DEFAULT_CONFIG };
  const c = p.get('c');
  if (c) {
    try {
      config = withOverrides(JSON.parse(fromB64Url(c)));
    } catch {
      config = { ...DEFAULT_CONFIG };
    }
  }
  const seed = p.get('s');
  const out: ShareState = { config };
  const e = p.get('e');
  const w = p.get('w');
  const a = p.get('a');
  if (e) out.encounterId = e;
  if (w) out.weaponId = w;
  if (a && ['clothing', 'light', 'medium', 'heavy'].includes(a)) out.armor = a as ArmorClass;
  if (seed && /^\d+$/.test(seed)) out.seed = Number(seed);
  return out;
}

export function shareUrl(s: ShareState): string {
  const base = `${location.origin}${location.pathname}`;
  return `${base}#${encodeShare(s)}`;
}

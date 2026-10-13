// Share links: encounter, loadout, seed and only the settings that differ from defaults.

import { DEFAULT_CONFIG, SETTINGS, diffFromDefaults, withOverrides, type RulesConfig } from '../rules/config';
import type { ArmorClass, BattleState } from '../rules/types';
import { ENCOUNTERS } from '../content/encounters';
import { WEAPONS } from '../content/gear';
import { availableWeapons, normalizeSetup } from '../rules/equipment';

export interface ShareState {
  encounterId?: string;
  weaponId?: string;
  secondaryWeaponId?: string | null;
  equippedSlot?: 0 | 1;
  armor?: ArmorClass;
  seed?: number;
  config: RulesConfig;
  invalid?: boolean;
}

const toB64Url = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64Url = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));

export function encodeShare(s: ShareState): string {
  const p = new URLSearchParams();
  if (s.encounterId) p.set('e', s.encounterId);
  if (s.weaponId) p.set('w', s.weaponId);
  if (s.secondaryWeaponId) p.set('w2', s.secondaryWeaponId);
  if (s.equippedSlot !== undefined) p.set('slot', String(s.equippedSlot));
  if (s.armor) p.set('a', s.armor);
  if (s.seed !== undefined) p.set('s', String(s.seed));
  const diff = diffFromDefaults(s.config);
  if (Object.keys(diff).length) p.set('c', toB64Url(JSON.stringify(diff)));
  return p.toString();
}

export function decodeShare(hash: string): ShareState {
  const out: ShareState = { config: { ...DEFAULT_CONFIG } };
  // Bound work before URL decoding or base64 allocation.
  if (hash.length > 16384) return { ...out, encounterId: 'granary', weaponId: 'daggers', armor: 'clothing', seed: 1, invalid: true };
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const e = p.get('e');
  if (e !== null) {
    out.encounterId = ENCOUNTERS.some(enc => enc.id === e) ? e : 'granary';
    if (out.encounterId !== e) out.invalid = true;
  }
  const w = p.get('w');
  if (w !== null) {
    out.weaponId = Object.hasOwn(WEAPONS, w) ? w : 'daggers';
    if (out.weaponId !== w) out.invalid = true;
  }
  const enc = ENCOUNTERS.find(enc => enc.id === (out.encounterId ?? 'granary'))!;
  const a = p.get('a');
  if (a !== null) {
    out.armor = enc.allowedArmor.includes(a as ArmorClass) ? a as ArmorClass : enc.defaultArmor;
    if (out.armor !== a) out.invalid = true;
  }
  const seed = p.get('s');
  if (seed !== null) {
    const n = Number(seed);
    const valid = /^\d{1,10}$/.test(seed) && Number.isSafeInteger(n) && n >= 0 && n <= 0xffffffff;
    out.seed = valid ? n : 1;
    if (!valid) out.invalid = true;
  }
  const c = p.get('c');
  if (c !== null) {
    try {
      if (!c || c.length > 12000 || !/^[A-Za-z0-9_\-+/=]+$/.test(c)) throw new Error('Invalid encoding');
      const raw: unknown = JSON.parse(fromB64Url(c));
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid config');
      for (const [key, value] of Object.entries(raw)) {
        const def = SETTINGS.find(s => s.key === key);
        if (!def || (def.type === 'number' ? typeof value !== 'number' || !Number.isFinite(value) || value < def.min || value > def.max
          : def.type === 'boolean' ? typeof value !== 'boolean'
          : !def.options.some(o => o.value === value))) throw new Error('Invalid setting');
      }
      out.config = withOverrides(raw);
    } catch {
      out.invalid = true;
    }
  }
  out.secondaryWeaponId = null;
  out.equippedSlot = 0;
  const allowed = availableWeapons(enc, out.config).map(w => w.id);
  if (out.weaponId && !allowed.includes(out.weaponId)) { out.weaponId = 'daggers'; out.invalid = true; }
  const reserve = p.get('w2');
  if (reserve !== null) {
    if (enc.id !== 'granary' && allowed.includes(reserve)) out.secondaryWeaponId = reserve;
    else out.invalid = true;
  }
  const slot = p.get('slot');
  if (slot === '1' && out.secondaryWeaponId) out.equippedSlot = 1;
  else if (slot !== null && slot !== '0') out.invalid = true;
  return out;
}

export function battleShareUrl(b: BattleState): string {
  const setup = normalizeSetup(b.setup);
  return shareUrl({ encounterId: b.encounterId, weaponId: setup.weaponIds[0], secondaryWeaponId: setup.weaponIds[1], equippedSlot: setup.equippedSlot, armor: setup.armor, seed: b.seed, config: b.config });
}

export function shareUrl(s: ShareState): string {
  const base = `${location.origin}${location.pathname}`;
  return `${base}#${encodeShare(s)}`;
}

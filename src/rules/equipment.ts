// Equipment ownership, validation and pure selectors. Cached legacy fields are rebuilt, never incremented.
import { ARMOR, PLAYER_WEAPON_IDS, SKILLS, WEAPONS } from '../content/gear';
import { DAMAGE_SCALE, UNITS } from '../content/units';
import { ENEMY_TEMPLATES, type EnemyTemplateId, type RulesConfig } from './config';
import type { AttackMode, BattleState, EncounterDef, PlayerWeaponFamily, Setup, UnitState, WeaponDef, WeaponInstance } from './types';

export function normalizeSetup(setup: Setup): Setup & { weaponIds: [string, string | null]; weaponId: string; equippedSlot: 0 | 1 } {
  const ids = setup.weaponIds ?? [setup.weaponId ?? '', null];
  return { ...setup, weaponIds: [ids[0], ids[1]], weaponId: ids[0], equippedSlot: setup.equippedSlot ?? 0 };
}
export function weaponLockReason(w: WeaponDef, config: RulesConfig): string | null {
  if (!w.access || w.access === 'normal' || config.unlockSpecialWeapons) return null;
  return w.access === 'soldier+savage' ? 'Juggernaut: Soldier + Savage' : w.access === 'soldier+rogue' ? 'Hoplite: Soldier + Rogue' : 'Dual-Wielder: Savage + Rogue';
}
export function availableWeapons(encounter: EncounterDef | string, config: RulesConfig): WeaponDef[] {
  const id = typeof encounter === 'string' ? encounter : encounter.id;
  return PLAYER_WEAPON_IDS.map(x => WEAPONS[x]!).filter(w => (id !== 'granary' || ['daggers', 'shield', 'polearm', 'two_handed'].includes(w.id)) && !weaponLockReason(w, config));
}
export function validateSetup(enc: EncounterDef, input: Setup, config: RulesConfig): ReturnType<typeof normalizeSetup> {
  if (input.weaponIds && (!Array.isArray(input.weaponIds) || input.weaponIds.length !== 2)) throw new Error('requires exactly two weapon slots');
  const setup = normalizeSetup(input);
  const [primary, secondary] = setup.weaponIds;
  const allowed = availableWeapons(enc, config).map(w => w.id);
  if (!allowed.includes(primary) || (secondary !== null && !allowed.includes(secondary))) throw new Error('weapon not allowed in this encounter');
  if (!enc.allowedArmor.includes(setup.armor)) throw new Error('armor not allowed in this encounter');
  if (enc.id === 'granary' && (secondary !== null || setup.armor !== 'clothing')) throw new Error('Granary requires clothing and one melee starter');
  if (setup.equippedSlot !== 0 && setup.equippedSlot !== 1) throw new Error('invalid equipped slot');
  if (setup.equippedSlot === 1 && secondary === null) throw new Error('empty equipped slot');
  return setup;
}
export function weaponInstance(owner: string, slot: number, defId: string): WeaponInstance {
  return { instanceId: `${owner}:weapon:${slot}`, defId, loaded: true, skillReadyAt: {} };
}
export function equippedItem(u: UnitState): WeaponInstance { return u.carried[u.equippedSlot]!; }
export function equippedWeapon(_state: BattleState, u: UnitState): WeaponDef { return WEAPONS[equippedItem(u).defId]!; }
export function enemyTuning(config: RulesConfig, template: string, kind: 'hp' | 'dmg'): number {
  return ENEMY_TEMPLATES.some(x => x === template) ? config[`enemy_${template as EnemyTemplateId}_${kind}`] : 1;
}
export function familyTuning(config: RulesConfig, family: WeaponDef['family'], kind: 'dmg' | 'hit'): number {
  return family === 'natural' || family === 'staff' ? (kind === 'dmg' ? 1 : 0) : config[`wpn_${family as PlayerWeaponFamily}_${kind}`];
}
export function scaledMode(config: RulesConfig, u: Pick<UnitState, 'side' | 'level' | 'templateId'>, w: WeaponDef, mode: AttackMode): AttackMode {
  const scale = u.side === 'player' ? (DAMAGE_SCALE[u.level] ?? 1) * config.playerDamageMult : config.enemyDamageMult * enemyTuning(config, u.templateId, 'dmg');
  return { ...mode, damage: Math.round(mode.damage * scale * familyTuning(config, w.family, 'dmg') * 1000) / 1000, hit: mode.hit + familyTuning(config, w.family, 'hit') };
}
/** First-mode attack cache remains compatible with authored fixtures; non-default modes scale from immutable content. */
export function attackModes(state: BattleState, u: UnitState): AttackMode[] {
  const w = equippedWeapon(state, u);
  return w.modes.map((m, i) => i === 0 ? { ...m, ...u.attack, id: m.id } : scaledMode(state.config, u, w, m));
}
export function attackMode(state: BattleState, u: UnitState, modeId?: string): AttackMode | undefined {
  const modes = attackModes(state, u);
  return modeId === undefined ? modes[0] : modes.find(m => m.id === modeId);
}
export function availableSkills(state: Pick<BattleState, 'config'>, u: UnitState): { id: string; readyAt: number; instanceId: string | null }[] {
  const item = equippedItem(u), w = WEAPONS[item.defId]!;
  // Fixed companions/monsters keep the authored kit, independent of the Jubal proficiency switch.
  const ids = u.templateId === 'jubal'
    ? [w.basicSkill, ...(state.config.proficientAllWeapons || u.proficiencies.includes(w.family) ? [w.proficiencySkill] : [])].filter((s): s is string => !!s)
    : [];
  return [...ids.map(id => ({ id, readyAt: item.skillReadyAt[id] ?? 0, instanceId: item.instanceId })), ...u.personalSkills.filter(s => !ids.includes(s.id)).map(s => ({ ...s, instanceId: null }))];
}
export function effectiveStats(config: RulesConfig, u: UnitState) {
  const w = WEAPONS[equippedItem(u).defId]!, tpl = UNITS[u.templateId]!, armor = ARMOR[u.armorClass];
  return {
    weaponId: w.id, attack: scaledMode(config, u, w, w.modes[0]!), canEngage: w.canEngage,
    engagement: w.engagement + (tpl.armor === undefined ? armor.engagement : 0),
    disengagement: w.disengagement + (tpl.armor === undefined ? armor.disengagement : 2),
    dodge: (tpl.dodge ?? armor.dodge) + w.dodgeBonus, parry: w.parry, block: w.block,
  };
}
export function refreshEquipment(state: Pick<BattleState, 'config'>, u: UnitState): void {
  Object.assign(u, effectiveStats(state.config, u));
  u.skills = availableSkills(state, u).map(({ id, readyAt }) => ({ id, readyAt }));
}
/** Reason shared by engine and hover; hypothetical previews may ignore turn ownership, not action/ammo gates. */
export function combatActionReason(state: BattleState, u: UnitState, kind: 'attack' | 'skill' | 'swapWeapon' | 'reload', consumesBolt = false): string | null {
  if (u.ko) return 'unit is knocked out';
  if (state.active?.unitId === u.id && state.active.acted) return 'already acted this turn';
  if (kind !== 'reload' && state.config.crossbowReload === 'strict' && u.reloadOwedSlot !== null) return 'must reload before another combat action';
  if (consumesBolt && !equippedItem(u).loaded) return 'crossbow is unloaded';
  return null;
}
export function skillUseReason(state: BattleState, u: UnitState, id: string): string | null {
  const skill = SKILLS[id];
  const slot = availableSkills(state, u).find(s => s.id === id);
  if (!skill || !slot) return 'skill not owned by equipped item or character';
  return combatActionReason(state, u, 'skill', !!skill.consumesBolt) ?? (slot.readyAt > state.clock + 1e-9 ? 'skill on cooldown' : null);
}
export function reloadSlot(u: UnitState, config: RulesConfig): 0 | 1 {
  return config.crossbowReload === 'strict' && u.reloadOwedSlot !== null ? u.reloadOwedSlot : u.equippedSlot;
}
export function reloadReason(state: BattleState, u: UnitState): string | null {
  const reason = combatActionReason(state, u, 'reload');
  if (reason) return reason;
  const item = u.carried[reloadSlot(u, state.config)];
  return !item || !WEAPONS[item.defId]?.reloadAp ? 'no crossbow to reload' : item.loaded ? 'crossbow is already loaded' : null;
}
export function swapReason(state: BattleState, u: UnitState, slot: 0 | 1): string | null {
  return combatActionReason(state, u, 'swapWeapon') ?? (slot !== 0 && slot !== 1 ? 'invalid slot' : slot === u.equippedSlot ? 'already equipped' : !u.carried[slot] ? 'empty slot' : null);
}

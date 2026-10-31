// Shared deterministic rules used by execution, previews and AI.
import { attackMode, enemyTuning, equippedWeapon, familyTuning } from './equipment';
import type { RulesConfig } from './config';
import { damageAfterDefense } from './formulas';
import { eq, type Vec } from './geometry';
import { alive, isFlanked, round3 } from './state';
import type { AttackProfile, BattleState, DelayedEffect, ReactionResult, SkillDef, UnitState } from './types';

export interface Scheduled { kind: 'unit' | 'effect'; at: number; side: number; order: number }
export function schedulerCompare(cfg: RulesConfig, a: Scheduled, b: Scheduled): number {
  const rank = (x: Scheduled) => (x.kind === 'unit') === cfg.tieUnitBeforeEffect ? 0 : 1;
  return a.at - b.at || rank(a) - rank(b) || a.side - b.side || a.order - b.order;
}
export function unitSchedule(state: BattleState, u: UnitState, at = u.nextTurnAt): Scheduled {
  return { kind: 'unit', at, side: (u.side === 'player') === state.config.tiePlayerFirst ? 0 : 1, order: u.order };
}
export function unitActsBefore(state: BattleState, u: UnitState, at: number, target: { kind: 'effect'; at: number } | { kind: 'unit'; at: number; unit: UnitState }): boolean {
  const other = target.kind === 'unit' ? unitSchedule(state, target.unit, target.at) : { ...target, side: 0, order: 0 };
  return schedulerCompare(state.config, unitSchedule(state, u, at), other) < 0;
}
export function unitMinDelay(state: BattleState, u: UnitState): number {
  return Math.max(5, u.massive ? state.config.bossTurnAp : state.config.noActionTurnAp);
}
/** Delay until the unit's next turn. Massive units keep a steady boss rhythm; everyone else pays what they spent, plus a no-action surcharge when they never acted (attack, skill, reload, swap). */
export function turnDelay(state: BattleState, u: UnitState, spent: number, acted: boolean): number {
  if (u.massive) return round3(Math.max(spent, unitMinDelay(state, u)));
  return round3(acted ? Math.max(0.001, spent) : spent + unitMinDelay(state, u));
}
export function actionApCost(state: BattleState, u: UnitState, profile: { apCost: number; stationaryDiscount?: boolean; special?: SkillDef['special'] }, moved = false): number {
  return profile.special ? state.config.bossTurnAp : profile.apCost + (profile.stationaryDiscount && (moved || (state.active?.unitId === u.id && state.active.moved)) ? state.config.bowMoveSurcharge : 0);
}
export function hypotheticalBoard(state: BattleState, u: UnitState, from: Vec): BattleState {
  if (eq(u.pos, from)) return state;
  return { ...state, units: state.units.map(x => x.id === u.id ? { ...x, pos: from } : x), active: state.active?.unitId === u.id ? { ...state.active, moved: true } : state.active };
}
export function effectCanHit(state: BattleState, effect: Pick<DelayedEffect, 'sourceId'>, u: UnitState): boolean {
  const source = state.units.find(x => x.id === effect.sourceId);
  return alive(u) && (!source || source.side !== u.side || state.config.delayedHitsAllies);
}
export function resolvedDamage(state: BattleState, target: UnitState, raw: number, damageType: AttackProfile['damageType'], pctPen = 0, flatPen = 0): number {
  if (raw <= 0) return 0;
  const defense = damageType === 'physical' ? target.armor : target.mr;
  const damage = damageAfterDefense(raw, defense, Math.min(1, pctPen), flatPen) * (isFlanked(state, target) ? 1 + state.config.flankDamageTaken : 1);
  return Math.max(1, Math.round(damage));
}
export function delayedDamage(state: BattleState, effect: Pick<DelayedEffect, 'damage' | 'damageType' | 'pctPen'>, target: UnitState): number {
  return resolvedDamage(state, target, effect.damage, effect.damageType, effect.pctPen);
}
export function allowedReactions(profile: { ranged?: boolean; allowedReactions?: ReactionResult['kind'][] }): ReactionResult['kind'][] {
  return (profile.allowedReactions ?? ['dodge', 'parry', 'block']).filter(x => x !== 'parry' || !profile.ranged);
}
export function reactionOptions(state: BattleState, target: UnitState, profile: { ranged?: boolean; allowedReactions?: ReactionResult['kind'][] }): { kind: ReactionResult['kind']; chance: number; ap: number }[] {
  const cfg = state.config;
  if (!cfg.reactionsEnabled || target.dazed) return [];
  const mult = isFlanked(state, target) ? cfg.flankReactionMult : 1;
  const allowed = allowedReactions(profile);
  return (['dodge', 'parry', 'block'] as const)
    .filter(kind => allowed.includes(kind) && (kind !== 'dodge' || !target.immobile))
    .map(kind => ({ kind, chance: target[kind] * mult, ap: cfg[`${kind}Ap`] }))
    .filter(o => o.chance > 0).sort((a, b) => b.chance - a.chance);
}
export function resolveSkill(state: BattleState, u: UnitState, skill: SkillDef) {
  const cfg = state.config;
  const base = attackMode(state, u, skill.modeId) ?? u.attack;
  const family = equippedWeapon(state, u).family;
  const mult = (u.side === 'player' ? cfg.playerDamageMult : cfg.enemyDamageMult * enemyTuning(cfg, u.templateId, 'dmg')) * familyTuning(cfg, family, 'dmg');
  const raw = skill.special === 'rockThrow' ? cfg.rockThrowDamage : skill.special === 'rockfall' ? cfg.rockfallDamage : skill.special === 'sweep' ? cfg.sweepDamage : skill.rawDamage;
  const delayed = skill.kind === 'sigil' || skill.kind === 'sweep';
  const profile: AttackProfile = {
    ...base,
    damage: (raw === undefined ? base.damage : raw * mult) * skill.damageMult,
    hit: (raw === undefined ? base.hit : 0.9 + familyTuning(cfg, family, 'hit')) + (skill.hitBonus ?? 0),
    damageType: skill.damageType ?? base.damageType,
    pctPen: skill.special === 'sweep' ? cfg.sweepArmorPen : Math.min(1, (raw === undefined ? base.pctPen : 0) + (skill.pctPenBonus ?? 0)),
    flatPen: raw === undefined ? base.flatPen : 0,
    ranged: skill.kind === 'shot',
    allowedReactions: delayed ? [...(skill.allowedReactions ?? [])] : allowedReactions({ ranged: skill.kind === 'shot', ...(skill.allowedReactions && { allowedReactions: skill.allowedReactions }) }),
  };
  return { profile, delay: skill.special === 'sweep' ? cfg.sweepDelay : skill.special === 'rockfall' ? cfg.rockfallDelay : (skill.delay ?? 100) };
}

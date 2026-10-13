// Derived, hover-dependent previews shared by the HUD (timeline ghost, action panel).

import { SKILLS } from '../content/gear';
import { eq, key, type Vec } from '../rules/geometry';
import { bossSweepThreat, dangerAt, escapeOutlook, previewAttack, previewSkill, projectedNextTurn, reachable } from '../rules/queries';
import { unitById } from '../rules/state';
import { unitActsBefore } from '../rules/resolvers';
import type { BattleState, UnitState } from '../rules/types';
import type { GameStore } from './store';

export interface Pending {
  extra: number;
  tile: Vec;
  what: string;
  projected: number;
  danger: 'none' | 'risk' | 'hit';
  dangerText: string;
}

export function activePlayer(b: BattleState | null): UnitState | null {
  if (!b?.active || b.outcome !== 'ongoing') return null;
  const u = unitById(b, b.active.unitId);
  return u.side === 'player' ? u : null;
}

/** Classify the danger of ending a turn on `tile` with a next turn `projected` AP from now. */
export function judge(b: BattleState, tile: Vec, projected: number): { danger: Pending['danger']; text: string } {
  const dangers = dangerAt(b, tile, projected);
  const hit = dangers.find(d => !d.safe);
  if (hit) return { danger: 'hit', text: !hit.outlook.actsBefore ? `${hit.effect.name} lands in ${Math.round(hit.impactIn)} AP, before your next turn.` : `${hit.effect.name}: no safe tile is reachable within your movement budget.` };
  const risky = dangers.find(d => d.outlook.disengageRisk > 0);
  if (risky) return { danger: 'risk', text: `${risky.effect.name}: escape requires disengaging (${Math.round(risky.outlook.disengageRisk * 100)}% held risk).` };
  const t = bossSweepThreat(b);
  const u = b.active ? unitById(b, b.active.unitId) : null;
  if (t && u) {
    const boss = unitById(b, t.bossId);
    const nextAt = b.clock + projected;
    const beforeBoss = unitActsBefore(b, u, nextAt, { kind: 'unit', unit: boss, at: boss.nextTurnAt });
    const outlook = escapeOutlook(b, u, { sourceId: boss.id, tiles: t.tiles, resolveAt: b.clock + t.landsIn }, { from: tile, nextAt });
    if (!beforeBoss && outlook.eligible && outlook.inside && (!outlook.canEscape || outlook.disengageRisk > 0)) return { danger: 'risk', text: `Possible sweep in ${Math.round(t.landsIn)} AP: ${!outlook.canEscape ? 'no escape before impact' : 'escape requires disengaging'}.` };
  }
  return { danger: 'none', text: '' };
}

export function pendingFor(s: Pick<GameStore, 'battle' | 'hoverTile' | 'mode' | 'busy'>): Pending | null {
  const b = s.battle;
  const u = activePlayer(b);
  if (!b || !u || !s.hoverTile || s.busy) return null;
  const a = b.active!;
  const tile = s.hoverTile;
  if (s.mode.kind === 'move') {
    const r = reachable(b, u.id).get(key(tile));
    if (r && !eq(tile, u.pos)) {
      const extra = r.cost + (a.surchargePending && !a.surchargePaid ? b.config.bowMoveSurcharge : 0);
      const projected = projectedNextTurn(b, extra);
      const j = judge(b, tile, projected);
      return { extra, tile, what: `Move ${r.path.length - 1}`, projected, danger: j.danger, dangerText: j.text };
    }
    if (!a.acted) {
      const p = previewAttack(b, u, tile);
      if (p) {
        const projected = projectedNextTurn(b, p.apCost);
        const j = judge(b, u.pos, projected);
        return { extra: p.apCost, tile: u.pos, what: u.attack.name, projected, danger: j.danger, dangerText: j.text };
      }
    }
    return null;
  }
  if (a.acted) return null;
  const p = s.mode.kind === 'skill' ? previewSkill(b, u, s.mode.skillId, tile) : previewAttack(b, u, tile);
  if (!p) return null;
  const projected = projectedNextTurn(b, p.apCost);
  const j = judge(b, u.pos, projected);
  const what = s.mode.kind === 'skill' ? (SKILLS[s.mode.skillId]?.name ?? 'Skill') : u.attack.name;
  return { extra: p.apCost, tile: u.pos, what, projected, danger: j.danger, dangerText: j.text };
}

/** What ending the turn right now would cost and whether it's safe. */
export function endTurnPreview(b: BattleState): { projected: number; danger: Pending['danger']; text: string } | null {
  const u = activePlayer(b);
  if (!u) return null;
  const projected = projectedNextTurn(b, 0);
  const j = judge(b, u.pos, projected);
  return { projected, danger: j.danger, text: j.text };
}

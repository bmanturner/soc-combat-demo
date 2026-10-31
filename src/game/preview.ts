// Derived, hover-dependent previews shared by the HUD (timeline ghost, action panel).

import { attackModes } from '../rules/equipment';
import { SKILLS } from '../content/gear';
import { eq, key, type Vec } from '../rules/geometry';
import { bossSweepThreat, dangerAt, escapeOutlook, previewAttack, previewReload, previewSwap, previewSkill, projectedNextTurn, reachable } from '../rules/queries';
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
  verdict?: Verdict;
}

/** One words-and-tone judgement of ending the turn on a tile; the single source for the ghost, the warning and the Incoming panel.
 *  `text` is the full sentence, `short` the form for the timeline header. `at` numbers are AP from now, the same axis as the timeline. */
export interface Verdict {
  tone: 'safe' | 'risk' | 'hit' | 'clear';
  text: string;
  short: string;
  landsIn?: number;
}

/** Verdict for ending a turn on `tile` with the next turn `projected` AP away. `j` is the matching judge() result. */
export function verdictFor(b: BattleState, tile: Vec, projected: number, j: { danger: Pending['danger']; text: string }): Verdict {
  const dangers = dangerAt(b, tile, projected);
  const at = Math.round(projected);
  if (j.danger === 'hit') {
    const hit = dangers.find(d => !d.safe);
    const caught = hit && !hit.outlook.actsBefore ? `caught by ${hit.effect.name} at ${Math.round(hit.impactIn)}, no escape` : 'no safe tile in reach, no escape';
    return { tone: 'hit', landsIn: hit?.impactIn, text: `Caught: ${j.text}`, short: caught };
  }
  if (j.danger === 'risk') {
    const risky = dangers.find(d => d.outlook.disengageRisk > 0);
    const t = bossSweepThreat(b);
    const landsIn = risky ? risky.impactIn : t?.landsIn;
    return { tone: 'risk', landsIn, text: `Risky: ${j.text}`, short: landsIn === undefined ? 'risky escape' : `risky, lands at ${Math.round(landsIn)}` };
  }
  if (dangers.length > 0) {
    const first = dangers.reduce((a, d) => (d.impactIn < a.impactIn ? d : a));
    return { tone: 'safe', landsIn: first.impactIn, text: `Safe: you act at ${at}, ${first.effect.name} lands at ${Math.round(first.impactIn)}`, short: `safe, ${first.effect.name} lands at ${Math.round(first.impactIn)}` };
  }
  const t = bossSweepThreat(b);
  const u = b.active ? unitById(b, b.active.unitId) : null;
  if (t && u) {
    const o = escapeOutlook(b, u, { sourceId: t.bossId, tiles: t.tiles, resolveAt: b.clock + t.landsIn }, { from: tile, nextAt: b.clock + projected });
    if (o.eligible && o.inside) return { tone: 'safe', landsIn: t.landsIn, text: `Safe: you act at ${at}, sweep lands at ${Math.round(t.landsIn)}`, short: `safe, sweep lands at ${Math.round(t.landsIn)}` };
  }
  return { tone: 'clear', text: 'Clear: nothing lands on this tile', short: 'clear' };
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
  if (hit) return { danger: 'hit', text: !hit.outlook.actsBefore ? `${hit.effect.name} lands at ${Math.round(hit.impactIn)}, your next turn is ${Math.round(projected)}` : `${hit.effect.name} leaves no safe tile within your movement` };
  const risky = dangers.find(d => d.outlook.disengageRisk > 0);
  if (risky) return { danger: 'risk', text: `${risky.effect.name} lands at ${Math.round(risky.impactIn)}, escape needs a disengage (${Math.round(risky.outlook.disengageRisk * 100)}% risk)` };
  const t = bossSweepThreat(b);
  const u = b.active ? unitById(b, b.active.unitId) : null;
  if (t && u) {
    const boss = unitById(b, t.bossId);
    const nextAt = b.clock + projected;
    const beforeBoss = unitActsBefore(b, u, nextAt, { kind: 'unit', unit: boss, at: boss.nextTurnAt });
    const outlook = escapeOutlook(b, u, { sourceId: boss.id, tiles: t.tiles, resolveAt: b.clock + t.landsIn }, { from: tile, nextAt });
    if (!beforeBoss && outlook.eligible && outlook.inside && (!outlook.canEscape || outlook.disengageRisk > 0)) return { danger: 'risk', text: `a sweep could land at ${Math.round(t.landsIn)}, ${!outlook.canEscape ? 'no escape before impact' : 'escape needs a disengage'}` };
  }
  return { danger: 'none', text: '' };
}

export function pendingFor(s: Pick<GameStore, 'battle' | 'hoverTile' | 'mode' | 'busy'> & Partial<Pick<GameStore, 'actionHover'>>): Pending | null {
  const b = s.battle;
  const u = activePlayer(b);
  if (!b || !u || s.busy) return null;
  if (s.actionHover) {
    const p = s.actionHover === 'reload' ? previewReload(b,u) : previewSwap(b,u,u.equippedSlot === 0 ? 1 : 0);
    if (!p.valid) return null;
    const j = judge(b,u.pos,p.nextTurnIn);
    return {extra:p.apCost, tile:u.pos, what:s.actionHover === 'reload' ? 'Reload' : 'Swap', projected:p.nextTurnIn, danger:j.danger, dangerText:j.text, verdict:verdictFor(b,u.pos,p.nextTurnIn,j)};
  }
  if (!s.hoverTile) return null;
  const a = b.active!;
  const tile = s.hoverTile;
  if (s.mode.kind === 'move') {
    const r = reachable(b, u.id).get(key(tile));
    if (r && !eq(tile, u.pos)) {
      const extra = r.cost + (a.surchargePending && !a.surchargePaid ? b.config.bowMoveSurcharge : 0);
      const projected = projectedNextTurn(b, extra);
      const j = judge(b, tile, projected);
      return { extra, tile, what: `Move ${r.path.length - 1}`, projected, danger: j.danger, dangerText: j.text, verdict: verdictFor(b, tile, projected, j) };
    }
    if (!a.acted) {
      const p = previewAttack(b, u, tile);
      if (p) {
        const projected = projectedNextTurn(b, p.apCost, true);
        const j = judge(b, u.pos, projected);
        return { extra: p.apCost, tile: u.pos, what: u.attack.name, projected, danger: j.danger, dangerText: j.text, verdict: verdictFor(b, u.pos, projected, j) };
      }
    }
    return null;
  }
  if (a.acted) return null;
  const p = s.mode.kind === 'skill' ? previewSkill(b, u, s.mode.skillId, tile) : previewAttack(b, u, tile, u.pos, s.mode.kind === 'attack' ? s.mode.modeId : undefined);
  if (!p) return null;
  const projected = projectedNextTurn(b, p.apCost, true);
  const j = judge(b, u.pos, projected);
  const what = s.mode.kind === 'skill' ? (SKILLS[s.mode.skillId]?.name ?? 'Skill') : (attackModes(b,u).find(m => m.id === p.modeId)?.name ?? u.attack.name);
  return { extra: p.apCost, tile: u.pos, what, projected, danger: j.danger, dangerText: j.text, verdict: verdictFor(b, u.pos, projected, j) };
}

/** What ending the turn right now would cost and whether it's safe. */
export function endTurnPreview(b: BattleState): { projected: number; danger: Pending['danger']; text: string; verdict: Verdict } | null {
  const u = activePlayer(b);
  if (!u) return null;
  const projected = projectedNextTurn(b, 0);
  const j = judge(b, u.pos, projected);
  return { projected, danger: j.danger, text: j.text, verdict: verdictFor(b, u.pos, projected, j) };
}

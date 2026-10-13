// Human-readable combat log lines with the math shown. Shared by the HUD and CLI traces.

import type { BattleState, GameEvent } from './types';

const pct = (n: number) => `${Math.round(n * 100)}%`;
const DIR = (v: { x: number; y: number }) => `(${v.x},${v.y})`;

export function unitName(state: BattleState, id: string): string {
  return state.units.find((u) => u.id === id)?.name ?? id;
}

export function describeEvent(state: BattleState, e: GameEvent): string | null {
  const n = (id: string) => unitName(state, id);
  switch (e.t) {
    case 'turnStart':
      return `— ${n(e.unitId)}'s turn @ ${e.clock} AP`;
    case 'move':
      return `${n(e.unitId)} moves ${e.path.length - 1} tile${e.path.length === 2 ? '' : 's'} to ${DIR(e.path[e.path.length - 1]!)} (${e.cost} AP)`;
    case 'disengage':
      return `${n(e.unitId)} tries to break from ${n(e.engagerId)}: held ${pct(e.chance)}, rolled ${e.roll} → ${e.held ? 'HELD (1 tile only)' : 'slips free'}`;
    case 'attack':
      return e.free ? `${n(e.attackerId)}: ${e.name}` : `${n(e.attackerId)} uses ${e.name} (${e.apCost} AP)`;
    case 'strike': {
      const head = `  → ${n(e.targetId)}: hit ${pct(e.hitChance)} rolled ${e.hitRoll}`;
      if (!e.hit) return `${head} → miss`;
      const reacts = e.reactions.map((r) => `${r.kind} ${pct(r.chance)} rolled ${r.roll}${r.success ? ' ✓' : ''}`).join(' · ');
      if (e.avoided) return `${head} · ${reacts} → ${e.avoided.toUpperCase()}${e.displacedTo ? ` (pushed to ${DIR(e.displacedTo)})` : ''}`;
      const math = `${e.raw}${e.crit ? ' (crit)' : ''} × 100/(100+${e.effectiveDefense})${e.flanked ? ' × flanked' : ''} = ${e.damage}`;
      return `${head}${reacts ? ` · ${reacts}` : ''} → ${math} dmg (HP ${e.hpAfter})`;
    }
    case 'ko':
      return `✖ ${n(e.unitId)} is down`;
    case 'status':
      if (e.status === 'dazed') return `${n(e.unitId)} is DAZED (+${e.pushback} AP, no reactions)`;
      if (e.status === 'feared') return `${n(e.unitId)} panics and will flee`;
      return `${n(e.unitId)} recovers`;
    case 'displace':
      return `${n(e.unitId)} is ${e.reason === 'push' ? 'shoved' : e.reason === 'pull' ? 'dragged' : 'moved'} to ${DIR(e.to)}`;
    case 'effectCast':
      return `⚠ ${e.effect.name} telegraphed on ${e.effect.tiles.length} tiles: lands in ${e.effect.resolveAt - e.effect.castAt} AP (@${e.effect.resolveAt})`;
    case 'effectResolve':
      return e.hits.length
        ? `✸ ${e.name} lands: ${e.hits.map((h) => `${n(h.unitId)} −${h.damage} (HP ${h.hpAfter})`).join(', ')}`
        : `✸ ${e.name} lands on empty ground`;
    case 'turnEnd':
      return `  ${n(e.unitId)} spent ${e.spent} AP → next turn in ${e.delay} AP`;
    case 'outcome':
      return e.outcome === 'victory' ? '★ VICTORY' : '☠ DEFEAT';
    case 'info':
      return e.text;
  }
}

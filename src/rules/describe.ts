// Human-readable combat log lines. Formatting never changes simulation values.
import type { BattleState, CaughtReason, GameEvent } from './types';

/** Why a party member was caught, in the log's voice. */
function caughtWhy(reason: CaughtReason, nextTurnAt: number, impactAt: number): string {
  switch (reason) {
    case 'late': return `next turn @${formatAp(nextTurnAt)} came after impact @${formatAp(impactAt)}`;
    case 'trapped': return 'no clear tile within reach on their turn';
    case 'held': return 'held by engagement while leaving';
    case 'stayed': return 'ended their turn inside';
  }
}

/** AP, HP and damage: at most one decimal, no trailing zero or negative zero. */
export const formatNumber = (n: number | undefined): string => n === undefined ? '?' : String(Number(n.toFixed(1)));
export const formatAp = formatNumber;
const pct = (n: number) => `${Math.round(n * 100)}%`;
const DIR = (v: { x: number; y: number }) => `(${v.x},${v.y})`;

export function unitName(state: BattleState, id: string): string {
  return state.units.find((u) => u.id === id)?.name ?? id;
}

export function describeEvent(state: BattleState, e: GameEvent): string | null {
  const n = (id: string) => unitName(state, id);
  switch (e.t) {
    case 'reload':
      return `${n(e.unitId)} reloads ${e.name} in slot ${e.slot + 1} (${formatAp(e.apCost)} AP)`;
    case 'swapWeapon':
      return `${n(e.unitId)} swaps ${e.oldName} → ${e.newName}, slot ${e.slot + 1} (${formatAp(e.apCost)} AP)`;
    case 'turnStart':
      return `— ${n(e.unitId)}'s turn @ ${formatAp(e.clock)} AP`;
    case 'move':
      return `${n(e.unitId)} moves ${e.path.length - 1} tile${e.path.length === 2 ? '' : 's'} to ${DIR(e.path[e.path.length - 1]!)} (${formatAp(e.cost)} AP)`;
    case 'disengage':
      return `${n(e.unitId)} tries to break from ${n(e.engagerId)}: held ${pct(e.chance)}, rolled ${e.roll} → ${e.held ? 'HELD (1 tile only)' : 'slips free'}`;
    case 'attack':
      return e.free ? `${n(e.attackerId)}: ${e.name}` : `${n(e.attackerId)} uses ${e.name} (${formatAp(e.apCost)} AP)`;
    case 'strike': {
      const head = `  → ${n(e.targetId)}: hit ${pct(e.hitChance)} rolled ${e.hitRoll}`;
      if (!e.hit) return `${head} → miss`;
      const reacts = e.reactions.map((r) => `${r.kind} ${pct(r.chance)} rolled ${r.roll}${r.success ? ' ✓' : ''}`).join(' · ');
      if (e.avoided) return `${head} · ${reacts} → ${e.avoided.toUpperCase()}${e.displacedTo ? ` (pushed to ${DIR(e.displacedTo)})` : ''}`;
      const math = `${formatNumber(e.raw)}${e.crit ? ' (crit)' : ''} × 100/(100+${formatNumber(e.effectiveDefense)})${e.flanked ? ' × flanked' : ''} = ${formatNumber(e.damage)}`;
      return `${head}${reacts ? ` · ${reacts}` : ''} → ${math} dmg (HP ${formatNumber(e.hpAfter)})`;
    }
    case 'ko':
      return `✖ ${n(e.unitId)} is down`;
    case 'status':
      if (e.status === 'dazed') return `${n(e.unitId)} is DAZED (+${formatAp(e.pushback)} AP, no reactions)`;
      if (e.status === 'feared') return `${n(e.unitId)} panics and will flee`;
      return `${n(e.unitId)} recovers`;
    case 'displace':
      return `${n(e.unitId)} is ${e.reason === 'push' ? 'shoved' : e.reason === 'pull' ? 'dragged' : 'moved'} to ${DIR(e.to)}`;
    case 'effectCast':
      return `⚠ ${e.effect.name} telegraphed on ${e.effect.tiles.length} tiles: lands in ${formatAp(e.effect.resolveAt - e.effect.castAt)} AP (@${formatAp(e.effect.resolveAt)})`;
    case 'effectResolve': {
      const party = (id: string) => state.units.find((u) => u.id === id)?.side === 'player';
      const hits = e.hits.map((h) => {
        if (h.avoided) return `${n(h.unitId)} ${h.avoided.toUpperCase()}`;
        const why = h.caught && party(h.unitId) ? ` — caught: ${caughtWhy(h.caught.reason, h.caught.nextTurnAt, e.at)}` : '';
        return `${n(h.unitId)} −${formatNumber(h.damage)} (HP ${formatNumber(h.hpAfter)})${why}`;
      });
      const escaped = e.escaped.filter(party).map((id) => `${n(id)} escaped`);
      return `✸ ${e.name} lands${hits.length ? `: ${hits.join(', ')}` : ' on empty ground'}${escaped.length ? ` · ${escaped.join(', ')}` : ''}`;
    }
    case 'turnEnd':
      return `  ${n(e.unitId)} spent ${formatAp(e.spent)} AP → next turn in ${formatAp(e.delay)} AP`;
    case 'outcome':
      return e.outcome === 'victory' ? '★ VICTORY' : '☠ DEFEAT';
    case 'info':
      return e.text;
  }
}

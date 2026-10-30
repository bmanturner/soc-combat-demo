// Pure diagnosis of why an attack aimed at a tile found nothing to hit. Mirrors the gates in rules/targeting.ts basicAttackHits.

import { attackMode, combatActionReason } from '../rules/equipment';
import { aimDirection, patternTiles } from '../rules/patterns';
import { distToUnit, inBounds, lineOfSight, occupant, terrainAt } from '../rules/state';
import { eq } from '../rules/geometry';
import type { Vec } from '../rules/geometry';
import type { BattleState, UnitState } from '../rules/types';

export function attackFailureReason(b: BattleState, u: UnitState, tile: Vec, modeId?: string): string {
  const mode = attackMode(b, u, modeId);
  if (!mode) return 'No attack mode equipped.';
  const gate = combatActionReason(b, u, 'attack', mode.ammo === 'bolt');
  if (gate) return `Can't attack: ${gate}.`;
  if (!inBounds(b, tile)) return 'That tile is off the board.';

  const occ = occupant(b, tile);
  if (mode.pattern === 'ranged') {
    if (!occ || occ.ko) return `${mode.name} needs a living enemy on that tile.`;
    if (occ.side === u.side) return `${mode.name} can't target an ally.`;
    const [lo, hi] = mode.range ?? [1, 1];
    const d = distToUnit(u.pos, occ);
    if (d > hi) return `Out of range: ${d} tiles, max ${hi}.`;
    if (d < lo) return `Too close: ${d} tile${d === 1 ? '' : 's'}, min ${lo}.`;
    if (!lineOfSight(b, u.pos, tile)) return 'No line of sight to that tile.';
    return 'No valid target there.';
  }

  const dirIdx = aimDirection(mode.pattern, u.pos, tile);
  if (dirIdx === null) {
    if (mode.pattern === 'ring8') return 'Sweep: click yourself or an adjacent tile.';
    return `${mode.name} reaches ${mode.pattern === 'cardinal' ? 'the four adjacent straight tiles' : 'adjacent tiles'} only.`;
  }
  if (mode.pattern === 'line2' && terrainAt(b, patternTiles('line2', u.pos, dirIdx)[0]!.tile) === 'wall') return 'A wall blocks the thrust.';
  if (mode.pattern === 'dualArc' && (!occ || occ.ko || occ.side === u.side)) return 'Dual strike needs an enemy on the aimed tile.';
  const covered = patternTiles(mode.pattern, u.pos, dirIdx).map(p => p.tile);
  const foes = covered.some(t => { const o = occupant(b, t); return o && !o.ko && o.side !== u.side; });
  if (!foes) return eq(tile, u.pos) ? 'No enemy within reach.' : 'No living enemy in that attack\'s tiles.';
  return 'No valid target there.';
}

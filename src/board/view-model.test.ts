import { describe, expect, it } from 'vitest';
import { key } from '../rules/geometry';
import { OPEN_7x7, testBattle } from '../rules/testkit';
import { boardView, type BoardView, type BoardViewInput } from './view-model';
import { COLORS } from './palette';

// Jubal stands in the wolf's column, so tiles straight past him need a detour.
const battle = () => testBattle({ rows: OPEN_7x7, jubal: { x: 6, y: 3 }, enemies: [{ template: 'wolf', id: 'wolf', at: { x: 6, y: 6 }, initiative: 999 }] });
const input = (hoverUnitId: string | null): BoardViewInput => ({ battle: battle(), hoverTile: null, hoverUnitId, mode: { kind: 'move' }, busy: false, botParty: false });
const enemyReach = (v: BoardView) => v.fills.filter((f) => f.color === COLORS.enemy).flatMap((f) => f.tiles.map(key));

describe('hovered enemy movement range', () => {
  it('shows where the wolf can end a 6-tile move, routing around party units', () => {
    const tiles = new Set(enemyReach(boardView(input('wolf'))));
    expect(tiles.size).toBe(24);
    expect(tiles.has('6,2')).toBe(true); // 6 steps around Jubal
    expect(tiles.has('6,1')).toBe(false); // 4 straight, 7 around
    expect(tiles.has('6,3')).toBe(false); // occupied
    expect(tiles.has('0,6')).toBe(true);
    expect(tiles.has('0,5')).toBe(false); // 7 steps
  });

  it('draws nothing for a hovered party unit', () => {
    expect(enemyReach(boardView(input('jubal')))).toEqual([]);
  });
});

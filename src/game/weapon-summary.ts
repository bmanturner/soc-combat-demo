import { attackModes } from '../rules/equipment';
import type { BattleState, UnitState } from '../rules/types';
import type { Mode } from './store';

export const PATTERN_TEXT: Record<string, string> = {
  dualArc: 'Primary + one random secondary in arc',
  ring8: 'Ring: all eight surrounding tiles',
  cardinal: 'One tile N/E/S/W',
  pairCw: 'Target + next tile clockwise',
  line2: 'Two tiles in a straight line',
  arc5: 'Target + two tiles each side',
  adjacent: 'Any one adjacent tile',
  ranged: 'Ranged single target',
};

export function selectedWeaponMode(battle: BattleState, unit: UnitState, selection: Mode) {
  const modes = attackModes(battle, unit);
  const id = battle.active?.unitId === unit.id && selection.kind === 'attack' ? selection.modeId : undefined;
  return modes.find(m => m.id === id) ?? modes[0]!;
}

// Isolated level-one sustained basic budget; no movement/skills/overkill.
import { PLAYER_WEAPON_IDS, WEAPONS } from '../src/content/gear';
import { DEFAULT_CONFIG } from '../src/rules/config';
import { scaledMode } from '../src/rules/equipment';
const bands: Record<string, [number, number]> = { daggers: [60,70], shield: [55,65], polearm: [55,65], two_handed: [55,65], hunting_bow: [60,70], crossbow: [60,70], dual_wield: [60,70], javelin_shield: [55,65], colossal: [45,55] };
console.log('| Family / mode | AP cycle | No armor/reactions | Unarmored rat (15% dodge) | Armor 100, no reactions |');
console.log('|---|---:|---:|---:|---:|');
for (const id of PLAYER_WEAPON_IDS) {
  const w = WEAPONS[id]!;
  for (const mode of w.modes) {
    const m = scaledMode(DEFAULT_CONFIG, { side: 'player', level: 1, templateId: 'jubal' }, w, mode);
    const ap = m.apCost + (w.reloadAp ?? 0);
    const count = m.pattern === 'dualArc' ? 2 : 1;
    const expected = (armor: number, dodge: number) => {
      const effective = Math.max(0, armor * (1 - m.pctPen) - m.flatPen);
      const normal = Math.max(1, Math.round(m.damage * 100 / (100 + effective)));
      const crit = Math.max(1, Math.round(m.damage * DEFAULT_CONFIG.critMult * 100 / (100 + effective)));
      return count * Math.min(.95, Math.max(.05, m.hit)) * (1-dodge) * ((1-DEFAULT_CONFIG.critChance)*normal + DEFAULT_CONFIG.critChance*crit) * 100 / ap;
    };
    const [low, high] = m.id === 'throw' ? [40, 50] : bands[id]!;
    if (expected(0, 0) < low || expected(0, 0) > high) throw new Error(`${id}/${m.id} outside T4 budget`);
    console.log(`| ${id}/${m.id} | ${ap} | ${expected(0,0).toFixed(2)} | ${expected(0,.15).toFixed(2)} | ${expected(100,0).toFixed(2)} |`);
  }
}
console.log('\nDual assumes the primary survives and remains the only secondary candidate. All AoE rows are one distinct target; no multi-cell boss multiplication. Bow movement changes the attack cost from 75 to 125, plus movement itself. Crossbow includes fire + reload, not opener-only throughput.');

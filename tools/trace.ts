// Print a condensed log of one bot-played battle. Usage: npx tsx tools/trace.ts <encounter> <weapon> <armor> [seed]

import { DEFAULT_CONFIG } from '../src/rules/config';
import { runBattle } from '../src/rules/sim';
import type { ArmorClass } from '../src/rules/types';
import { describeEvent } from '../src/rules/describe';

const [enc = 'cultists', weaponId = 'daggers', armor = 'light', seed = '1000'] = process.argv.slice(2);
const r = runBattle(enc, { weaponId, armor: armor as ArmorClass }, DEFAULT_CONFIG, Number(seed));
for (const e of r.state.log) {
  const line = describeEvent(r.state, e);
  if (line) console.log(line);
}
console.log(`\n${r.outcome} at ${r.clock} AP; party HP ${(r.partyHpPct * 100).toFixed(0)}%`);

// Print a condensed log of one bot-played battle. Usage: npx tsx tools/trace.ts <encounter> <weapon> <armor> [seed]

import { withOverrides, type RulesConfig } from '../src/rules/config';
import { runBattle } from '../src/rules/sim';
import type { ArmorClass } from '../src/rules/types';
import { describeEvent } from '../src/rules/describe';

const [enc = 'cultists', weaponId = 'daggers', armor = 'light', seed = '1000'] = process.argv.slice(2);
const overrides: Record<string, unknown> = {};
let policy: 'expert' | 'novice' = 'expert';
for (const arg of process.argv.slice(6)) {
  const [key, value] = arg.split('=');
  if (!key || value === undefined) throw new Error('expected setting=value');
  if (key === 'policy') {
    if (value !== 'expert' && value !== 'novice') throw new Error('invalid policy');
    policy = value;
  } else overrides[key] = value === 'true' ? true : value === 'false' ? false : Number.isNaN(Number(value)) ? value : Number(value);
}
const config = withOverrides(overrides as Partial<RulesConfig>);
console.log(`policy: ${policy}; CONFIG ${JSON.stringify(config)}`);
const r = runBattle(enc, { weaponId, armor: armor as ArmorClass }, config, Number(seed), 4000, policy);
for (const e of r.state.log) {
  const line = describeEvent(r.state, e);
  if (line) console.log(line);
}
console.log(`\n${r.outcome} at ${r.clock} AP; party HP ${(r.partyHpPct * 100).toFixed(0)}%`);

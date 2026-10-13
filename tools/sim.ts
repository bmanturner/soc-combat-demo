// Balance baseline: encounter-allowed single-family loadouts, optional two-slot combinations.
// npx tsx tools/sim.ts 40 all policy=expert combos=1 crossbowReload=strict
import { ENCOUNTERS } from '../src/content/encounters';
import { availableWeapons } from '../src/rules/equipment';
import { withOverrides, type RulesConfig } from '../src/rules/config';
import { runBattle, type SimResult } from '../src/rules/sim';
import type { ArmorClass } from '../src/rules/types';

const trials = Number(process.argv[2] ?? 40);
if (!Number.isSafeInteger(trials) || trials < 1) throw new Error('positive integral trial count required');
const only = process.argv[3] && process.argv[3] !== 'all' ? process.argv[3] : undefined;
const overrides: Record<string, unknown> = {};
let policy: 'expert' | 'novice' = 'expert', combos = false;
for (const arg of process.argv.slice(4)) {
  const [k, v] = arg.split('=');
  if (!k || v === undefined) continue;
  if (k === 'combos') { combos = v === '1'; continue; }
  if (k === 'policy') {
    if (v !== 'expert' && v !== 'novice') throw new Error('policy must be expert or novice');
    policy = v; continue;
  }
  overrides[k] = v === 'true' ? true : v === 'false' ? false : Number.isNaN(Number(v)) ? v : Number(v);
}
const config = withOverrides(overrides as Partial<RulesConfig>);
console.log(`policy: ${policy}; trials per cell: ${trials}; overrides: ${JSON.stringify(overrides)}`);
console.log('encounter weapon armor win% hp% stalls illegal reloads swaps damage/100AP');
let problems = 0;
for (const enc of ENCOUNTERS) {
  if (only && enc.id !== only) continue;
  const allowed = availableWeapons(enc, config).map(w => w.id);
  const loadouts: [string, string | null][] = allowed.map(w => [w, null]);
  if (combos && enc.id !== 'granary') {
    const pairs: [string, string | null][] = [['crossbow', 'shield'], ['crossbow', 'two_handed'], ['hunting_bow', 'daggers'], ['colossal', 'daggers']];
    loadouts.push(...pairs.filter(pair => pair.every(w => w === null || allowed.includes(w))));
    // javelin_shield alone is already a single-family row; do not double count it.
  }
  const armors: ArmorClass[] = enc.allowedArmor.length === 1 ? enc.allowedArmor : ['light', 'medium', 'heavy'];
  for (const weaponIds of loadouts) for (const armor of armors) {
    let wins = 0, stalls = 0, hp = 0, kos = 0, turns = 0, clock = 0, caught = 0, escapes = 0, move = 0, illegal = 0, reloads = 0, swaps = 0;
    const weaponStats: SimResult['weaponStats'] = {};
    for (let i = 0; i < trials; i++) {
      const r = runBattle(enc.id, { weaponIds, armor }, config, 1000 + i, 4000, policy);
      if (r.outcome === 'victory') wins++;
      if (r.outcome === 'stalled') stalls++;
      hp += r.partyHpPct; kos += r.partyKos; turns += r.playerTurns; clock += r.clock;
      caught += r.caught; escapes += r.escapes; move += r.moveShare; illegal += r.illegalFallbacks; reloads += r.reloads; swaps += r.swaps;
      for (const [id, stats] of Object.entries(r.weaponStats)) {
        const target = weaponStats[id] ??= { damage: 0, ap: 0, turns: 0 };
        target.damage += stats.damage; target.ap += stats.ap; target.turns += stats.turns;
      }
      if (r.illegalFallbacks) console.error(JSON.stringify(r.fallbacks));
      if (r.outcome === 'stalled') console.error(JSON.stringify({ encounter: enc.id, weaponIds, armor, seed: 1000 + i, reason: r.stallReason }));
    }
    problems += stalls + illegal;
    const damage100Ap = Object.fromEntries(Object.entries(weaponStats).map(([id, s]) => [id, s.ap ? 100 * s.damage / s.ap : 0]));
    const row = { encounter: enc.id, weaponIds, armor, policy, trials, wins, winPct: 100 * wins / trials, hpPct: 100 * hp / trials, stalls, illegal, reloads, swaps, damage100Ap, weaponStats, kos: kos / trials, turns: turns / trials, clock: clock / trials, caught: caught / trials, escapes: escapes / trials, moveShare: move / trials };
    console.log(`${enc.id} ${weaponIds.filter(Boolean).join('+')} ${armor} ${row.winPct.toFixed(1)} ${row.hpPct.toFixed(1)} ${stalls} ${illegal} ${reloads} ${swaps} ${JSON.stringify(damage100Ap)}`);
    console.log(`ROW ${JSON.stringify(row)}`);
  }
}
if (problems) process.exitCode = 1;

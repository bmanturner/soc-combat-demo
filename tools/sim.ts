// Balance sim: bots play every encounter with every starter weapon (and armor where allowed).
// Usage: npm run sim -- [trials=40] [encounter]

import { ENCOUNTERS } from '../src/content/encounters';
import { DEFAULT_CONFIG } from '../src/rules/config';
import { runBattle } from '../src/rules/sim';
import type { ArmorClass } from '../src/rules/types';

const trials = Number(process.argv[2] ?? 40);
const only = process.argv[3];
const weapons = ['daggers', 'shield', 'polearm', 'two_handed'];

const pct = (n: number) => `${(n * 100).toFixed(0)}%`.padStart(5);
const num = (n: number, w = 6) => n.toFixed(1).padStart(w);

console.log(`trials per cell: ${trials}\n`);
console.log('encounter   weapon      armor     win   stall  hp-left  KOs   turns/unit  fight-AP  caught  escaped  move%');
for (const enc of ENCOUNTERS) {
  if (only && enc.id !== only) continue;
  const armors: ArmorClass[] = enc.allowedArmor.length === 1 ? enc.allowedArmor : (['light', 'medium', 'heavy'] as ArmorClass[]);
  for (const weaponId of weapons) {
    for (const armor of armors) {
      let wins = 0, stalls = 0, hp = 0, kos = 0, turns = 0, clock = 0, caught = 0, escapes = 0, move = 0;
      for (let i = 0; i < trials; i++) {
        const r = runBattle(enc.id, { weaponId, armor }, DEFAULT_CONFIG, 1000 + i);
        if (r.outcome === 'victory') wins++;
        if (r.outcome === 'stalled') stalls++;
        hp += r.partyHpPct;
        kos += r.partyKos;
        turns += r.playerTurns;
        clock += r.clock;
        caught += r.caught;
        escapes += r.escapes;
        move += r.moveShare;
      }
      console.log(
        `${enc.id.padEnd(11)} ${weaponId.padEnd(11)} ${armor.padEnd(8)} ${pct(wins / trials)} ${pct(stalls / trials)}  ${pct(hp / trials)}   ${num(kos / trials, 4)}  ${num(turns / trials, 8)}    ${num(clock / trials, 7)}  ${num(caught / trials, 5)}  ${num(escapes / trials, 6)}  ${pct(move / trials)}`,
      );
    }
  }
}

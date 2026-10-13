import { DEFAULT_CONFIG } from '../src/rules/config';
import { createBattle, applyAction } from '../src/rules/engine';
import { encounterById } from '../src/content/encounters';
import { botAction, enemyAction, tileDanger } from '../src/rules/ai';
import { unitById } from '../src/rules/state';
import { reachable } from '../src/rules/queries';

let s = createBattle(encounterById('cultists'), { weaponId: 'daggers', armor: 'light' }, DEFAULT_CONFIG, 1000).state;
for (let i = 0; i < 200 && s.active; i++) {
  const u = unitById(s, s.active.unitId);
  if (u.id === 'jabal' && s.effects.length) {
    const a = botAction(s);
    console.log('clock', s.clock, 'jabal at', u.pos, 'action', JSON.stringify(a), 'effects', s.effects.map((e) => [e.resolveAt, e.tiles.length]));
    console.log('danger here', tileDanger(s, u, u.pos, 25, true), 'reach', reachable(s, 'jabal').size, 'active', JSON.stringify(s.active));
  }
  const a = u.side === 'player' ? botAction(s) : enemyAction(s);
  s = applyAction(s, a).state;
  if (s.clock > 130) break;
}

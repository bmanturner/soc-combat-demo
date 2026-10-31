import { describe, expect, it } from 'vitest';
import { ENCOUNTERS, encounterById } from '../content/encounters';
import { PLAYER_WEAPON_IDS, SKILLS, WEAPONS } from '../content/gear';
import { decodeShare } from '../game/share';
import { botAction } from './ai';
import { DEFAULT_CONFIG, SETTINGS, withOverrides } from './config';
import { applyAction, createBattle } from './engine';
import { attackModes, availableSkills, availableWeapons, effectiveStats, normalizeSetup, refreshEquipment, validateSetup } from './equipment';
import { aimDirection, patternTiles } from './patterns';
import { previewAttack, previewReload, previewSkill, previewSwap, projectedNextTurn } from './queries';
import { canEngageUnit, isFlanked, unitById } from './state';
import { basicAttackHits, dualWieldCandidates } from './targeting';
import { OPEN_7x7, testBattle, testEncounter } from './testkit';
import type { Action, BattleState } from './types';
import { simulateBattle } from './sim';

const origin = { x: 3, y: 3 };
const ring = [{ x:3,y:2 },{ x:4,y:2 },{ x:4,y:3 },{ x:4,y:4 },{ x:3,y:4 },{ x:2,y:4 },{ x:2,y:3 },{ x:2,y:2 }];
function arena(primary: string, secondary: string | null = null, config = {}, seed = 1): BattleState {
  const enc = testEncounter({ rows: OPEN_7x7, jubal: origin, enemies: [{ template: 'wolf', id: 'target', at: { x: 3, y: 2 }, initiative: 99999 }] });
  const s = createBattle(enc, { weaponIds: [primary, secondary], armor: 'medium' }, { ...DEFAULT_CONFIG, autoEndTurn: false, reactionsEnabled: false, critChance: 0, ...config }, seed).state;
  unitById(s, 'target').hp = unitById(s, 'target').maxHp = 10000;
  return s;
}
const jubal = (s: BattleState) => unitById(s, 'jubal');
const nextTurn = (s: BattleState) => applyAction(s, { type: 'endTurn', unitId: 'jubal' }).state;
const attack = (modeId?: string): Action => ({ type: 'attack', unitId: 'jubal', target: ring[0]!, ...(modeId ? { modeId } : {}) });

function assertPreview(s: BattleState, a: Action): void {
  const u = jubal(s);
  const p = a.type === 'attack' ? previewAttack(s, u, a.target, u.pos, a.modeId) : a.type === 'skill' ? previewSkill(s, u, a.skillId, a.target) : null;
  expect(p).not.toBeNull();
  const delay = projectedNextTurn(s, p!.apCost, true);
  const result = applyAction(s, a);
  expect(result.state.active!.actionSpent).toBe(p!.apCost);
  for (const e of result.events) if (e.t === 'strike') {
    const tp = p!.targets.find(t => t.unitId === e.targetId) ?? p!.candidates?.find(t => t.unitId === e.targetId);
    expect(e.hitChance).toBeCloseTo(tp!.hitChance);
    if (e.hit && !e.avoided) expect(e.damage).toBe(tp!.damageIfLands);
  }
  expect(jubal(nextTurn(result.state)).nextTurnAt - s.clock).toBe(delay);
}

describe('catalog, encounter and tuning golden', () => {
  it('exactly nine families; known modes and two skill ownership slots; no monster offerings', () => {
    const catalog = availableWeapons('wolves', DEFAULT_CONFIG);
    expect(catalog).toHaveLength(9);
    expect(new Set(catalog.map(w => w.family)).size).toBe(9);
    for (const w of catalog) {
      expect(w.skills).toEqual([w.basicSkill, w.proficiencySkill]);
      expect(new Set(w.modes.map(m => m.id)).size).toBe(w.modes.length);
      for (const id of w.skills) expect(w.modes.some(m => m.id === SKILLS[id]!.modeId)).toBe(true);
    }
    expect(availableWeapons('granary', DEFAULT_CONFIG).map(w => w.id)).toEqual(['daggers','shield','polearm','two_handed']);
    expect(availableWeapons('wolves', { ...DEFAULT_CONFIG, unlockSpecialWeapons: false })).toHaveLength(6);
    expect(WEAPONS.crossbow!.modes[0]).toMatchObject({ apCost: 50, range: [1,6] });
    expect(WEAPONS.crossbow!.reloadAp).toBe(50);
  });
  it('engine rejects injected tutorial gear/armor/reserve and locked specials before constructing a battle', () => {
    const enc = encounterById('granary');
    for (const id of ['hunting_bow','crossbow','dual_wield','javelin_shield','colossal','rat_bite','bogus','__proto__']) expect(() => createBattle(enc, { weaponIds: [id,null], armor:'clothing' }, DEFAULT_CONFIG, 1)).toThrow();
    expect(() => createBattle(enc, { weaponIds: ['daggers','shield'], armor:'clothing' }, DEFAULT_CONFIG, 1)).toThrow();
    expect(() => createBattle(enc, { weaponId: 'daggers', armor:'heavy' }, DEFAULT_CONFIG, 1)).toThrow();
    expect(() => createBattle(encounterById('wolves'), { weaponId: 'colossal', armor:'light' }, { ...DEFAULT_CONFIG, unlockSpecialWeapons:false }, 1)).toThrow();
    expect(() => validateSetup(encounterById('wolves'), { weaponIds:['shield',null], equippedSlot:1, armor:'light' }, DEFAULT_CONFIG)).toThrow();
  });
  it('legacy w links and single-weapon setup normalize to two slots without mutating input', () => {
    const decoded = decodeShare('e=wolves&w=polearm&a=medium&s=23');
    const input = { weaponId: decoded.weaponId!, armor: decoded.armor! };
    expect(normalizeSetup(input)).toMatchObject({ weaponIds: ['polearm',null], equippedSlot:0 });
    expect(input).not.toHaveProperty('weaponIds');
    expect(jubal(createBattle(encounterById('wolves'), input, decoded.config, decoded.seed!).state).carried[0].defId).toBe('polearm');
  });
  it('all knobs are registered as demo, defaults and sanitization preserve tunable bounds', () => {
    const config = withOverrides({ wpn_colossal_dmg: 99, wpn_crossbow_hit: -.9, weaponSwapAp: 1 });
    expect(config).toMatchObject({ wpn_colossal_dmg: 1.5, wpn_crossbow_hit: -.2, weaponSwapAp: 25 });
    const keys = SETTINGS.filter(s => ['Weapon tuning','Enemy tuning','Weapons'].includes(s.group));
    expect(keys).toHaveLength(42);
    expect(keys.every(s => s.status === 'demo' && s.why)).toBe(true);
    expect(DEFAULT_CONFIG).toMatchObject({ proficientAllWeapons: true, unlockSpecialWeapons:true, crossbowReload:'flexible' });
  });
  it('enemy HP and skill/raw damage multipliers apply once; mode/skill family scaling agrees', () => {
    const s = arena('javelin_shield', null, { wpn_javelin_shield_dmg:1.5, wpn_javelin_shield_hit:.1, enemy_wolf_hp:1.5, enemy_wolf_dmg:1.5 });
    expect(jubal(s).attack.damage).toBe(82.5);
    expect(attackModes(s, jubal(s))[1]!.damage).toBe(105);
    expect(attackModes(s, jubal(s))[1]!.hit).toBeCloseTo(.96);
    unitById(s,'target').pos = {x:3,y:0};
    assertPreview(s, { type:'skill', unitId:'jubal', skillId:'piercing_javelin', target:{x:3,y:0} });
    const e = createBattle(encounterById('wolves'), { weaponId:'shield', armor:'light' }, { ...DEFAULT_CONFIG, enemy_wolf_hp:1.5, enemy_wolf_dmg:1.5 }, 1).state.units.find(u=>u.templateId==='wolf')!;
    expect(e.maxHp).toBe(120); expect(e.attack.damage).toBe(60);
  });
});

describe('direction and terrain golden', () => {
  it.each([0,1,2,3,4,5,6,7])('independent coordinate oracle rotation %s for every directional family', i => {
    expect(patternTiles('pairCw',origin,i).map(p=>p.tile)).toEqual([ring[i],ring[(i+1)%8]]);
    expect(patternTiles('line2',origin,i).map(p=>p.tile)).toEqual([ring[i],{x:2*ring[i]!.x-3,y:2*ring[i]!.y-3}]);
    expect(patternTiles('arc5',origin,i).map(p=>p.tile)).toEqual([-2,-1,0,1,2].map(d=>ring[(i+d+8)%8]));
    expect(patternTiles('dualArc',origin,i).map(p=>p.tile)).toEqual([-2,-1,0,1,2].map(d=>ring[(i+d+8)%8]));
    expect(patternTiles('ring8',origin,i).map(p=>p.tile)).toEqual(ring);
    expect(patternTiles('adjacent',origin,i).map(p=>p.tile)).toEqual([ring[i]]);
    expect(aimDirection('cardinal',origin,ring[i]!)).toBe(i%2 ? null : i);
  });
  it('only arc5 has side penalties; ring8 is self-aimable and line off-axis rejected', () => {
    expect(patternTiles('arc5',origin,0).map(p=>p.ring)).toEqual([2,1,0,1,2]);
    expect(patternTiles('dualArc',origin,0).every(p=>p.ring===0)).toBe(true);
    expect(patternTiles('ring8',origin,0).every(p=>p.ring===0)).toBe(true);
    expect(aimDirection('ring8',origin,origin)).toBe(0);
    expect(aimDirection('line2',origin,{x:5,y:4})).toBeNull();
  });
  it('line walls truncate, cover/corner policy preserved, edges and boss footprints deduplicated', () => {
    const s = arena('colossal');
    s.map.tiles[1*7+3]='wall';
    expect(basicAttackHits(s,jubal(s),ring[0]!,'line')!.tiles).toEqual([ring[0]]);
    s.map.tiles[2*7+3]='wall';
    expect(basicAttackHits(s,jubal(s),ring[0]!,'line')).toBeNull();
    s.map.tiles[2*7+3]='cover';
    expect(basicAttackHits(s,jubal(s),ring[0]!,'line')).not.toBeNull();
    const b = testBattle({rows:OPEN_7x7,jubal:origin,weapon:'colossal',enemies:[{template:'nephilim',at:{x:3,y:2}}]});
    expect(basicAttackHits(b,jubal(b),origin,'sweep')!.hits).toHaveLength(1);
    jubal(b).pos={x:0,y:0};
    expect(basicAttackHits(b,jubal(b),{x:-1,y:0},'line')).toBeNull();
    expect(basicAttackHits(b,jubal(b),{x:1,y:1},'line')).not.toBeNull();
  });
});

describe('crossbow and swap ownership golden', () => {
  it('miss unloads; loaded reload, same-turn reload and waiting bypass are rejected', () => {
    let s=arena('crossbow',null,{},1); jubal(s).attack.hit=0;
    expect(previewReload(s,jubal(s)).valid).toBe(false);
    expect(()=>applyAction(s,{type:'reload',unitId:'jubal'})).toThrow();
    const result=applyAction(s,attack('fire'));
    expect(result.events.find(e=>e.t==='strike')).toMatchObject({hit:false});
    expect(jubal(result.state).carried[0].loaded).toBe(false);
    expect(()=>applyAction(result.state,{type:'reload',unitId:'jubal'})).toThrow();
    s=nextTurn(nextTurn(result.state));
    expect(()=>applyAction(s,attack('fire'))).toThrow();
    const p=previewReload(s,jubal(s));
    const r=applyAction(s,{type:'reload',unitId:'jubal'});
    expect(r.state.active!.actionSpent).toBe(p.apCost);
    expect(jubal(nextTurn(r.state)).nextTurnAt-s.clock).toBe(p.nextTurnIn);
  });
  it('strict debt rejects every skill and swap while allowing movement/end; reload is a whole action', () => {
    let s=arena('crossbow','crossbow',{crossbowReload:'strict'});
    s=nextTurn(applyAction(s,attack('fire')).state);
    for(const skillId of ['steady_bolt','breaching_bolt','shield_bash']) expect(()=>applyAction(s,{type:'skill',unitId:'jubal',skillId,target:ring[0]!})).toThrow();
    expect(()=>applyAction(s,{type:'swapWeapon',unitId:'jubal',slot:1})).toThrow();
    s=applyAction(s,{type:'move',unitId:'jubal',to:{x:4,y:3}}).state;
    s=applyAction(s,{type:'reload',unitId:'jubal'}).state;
    expect(()=>applyAction(s,{type:'swapWeapon',unitId:'jubal',slot:1})).toThrow();
    expect(jubal(s).carried.map(w=>w?.loaded)).toEqual([true,true]);
  });
  it('swap before/after movement consumes action and repeatedly restores exact defenses without stacking', () => {
    let s=arena('daggers','shield');
    const first=effectiveStats(s.config,jubal(s));
    for(let i=0;i<6;i++) {
      if(i===0) s=applyAction(s,{type:'move',unitId:'jubal',to:{x:4,y:3}}).state;
      const slot=jubal(s).equippedSlot===0?1:0;
      const p=previewSwap(s,jubal(s),slot);
      s=applyAction(s,{type:'swapWeapon',unitId:'jubal',slot}).state;
      expect(s.active!.actionSpent).toBe(p.apCost);
      expect(()=>applyAction(s,attack())).toThrow();
      expect(()=>applyAction(s,{type:'reload',unitId:'jubal'})).toThrow();
      if(i===1) s=applyAction(s,{type:'move',unitId:'jubal',to:origin}).state;
      s=nextTurn(s);
    }
    expect(effectiveStats(s.config,jubal(s))).toEqual(first);
    expect(()=>applyAction(s,{type:'swapWeapon',unitId:'jubal',slot:0})).toThrow();
  });
  it('independent duplicate instances retain cooldowns/ammo; new battles reset, replay is identical', () => {
    const initial=arena('crossbow','crossbow');
    const fire:Action={type:'skill',unitId:'jubal',skillId:'steady_bolt',target:ring[0]!};
    expect(applyAction(initial,fire)).toEqual(applyAction(structuredClone(initial),fire));
    let s=nextTurn(applyAction(initial,fire).state);
    const ready=jubal(s).carried[0].skillReadyAt.steady_bolt;
    s=nextTurn(applyAction(s,{type:'swapWeapon',unitId:'jubal',slot:1}).state);
    expect(availableSkills(s,jubal(s)).find(x=>x.id==='steady_bolt')!.readyAt).toBe(0);
    expect(jubal(s).carried[1]!.loaded).toBe(true);
    s=nextTurn(applyAction(s,{type:'swapWeapon',unitId:'jubal',slot:0}).state);
    expect(jubal(s).carried[0]).toMatchObject({loaded:false,skillReadyAt:{steady_bolt:ready}});
    expect(jubal(initial).carried[0].loaded).toBe(true);
    expect(new Set(jubal(initial).carried.map(w=>w!.instanceId)).size).toBe(2);
    expect(jubal(arena('crossbow')).carried[0].skillReadyAt).toEqual({});
  });
  it('proficiency is item-owned: basic always available, individual family grants work and reserve injection fails', () => {
    const s=arena('daggers','shield',{proficientAllWeapons:false}), u=jubal(s);
    expect(availableSkills(s,u).map(x=>x.id)).toEqual(['throwing_knife']);
    expect(previewSkill(s,u,'precision_stab',ring[0]!)).toBeNull();
    u.proficiencies=['daggers'];
    expect(availableSkills(s,u).map(x=>x.id)).toEqual(['throwing_knife','precision_stab']);
    u.skills.push({id:'sundering_blow',readyAt:0});
    expect(()=>applyAction(s,{type:'skill',unitId:'jubal',skillId:'sundering_blow',target:ring[0]!})).toThrow();
    u.personalSkills.push({id:'heavy_daze',readyAt:0});
    let swapped=nextTurn(applyAction(s,{type:'swapWeapon',unitId:'jubal',slot:1}).state);
    expect(availableSkills(swapped,jubal(swapped)).map(x=>x.id)).toEqual(['shield_bash','heavy_daze']);
    swapped.config.proficientAllWeapons=true;
    expect(availableSkills(swapped,jubal(swapped)).map(x=>x.id)).toEqual(['shield_bash','sundering_blow','heavy_daze']);
    swapped=applyAction(swapped,{type:'skill',unitId:'jubal',skillId:'heavy_daze',target:ring[0]!}).state;
    expect(jubal(swapped).personalSkills[0]!.readyAt).toBeGreaterThan(swapped.clock);
  });
  it('fixed companions retain exactly their authored kits when all proficiencies are enabled', () => {
    const b=createBattle(encounterById('nephilim'),{weaponId:'daggers',armor:'light'},DEFAULT_CONFIG,1).state;
    for(const u of b.units.filter(u=>['jabal','hired_archer'].includes(u.templateId))) expect(availableSkills(b,u).map(s=>s.id)).toEqual([u.templateId==='jabal'?'heavy_daze':'aimed_shot']);
  });
});

describe('dual wield resolution golden', () => {
  it('eligible offsets ±2, not ±3 or distance two; allies never candidates; footprint dedup and stable order', () => {
    const s=testBattle({rows:OPEN_7x7,jubal:origin,weapon:'dual_wield',enemies:ring.map((at,i)=>({template:'wolf',id:`w${i}`,at})),config:{friendlyFire:true}});
    expect(dualWieldCandidates(s,jubal(s),ring[0]!).map(c=>c.unit.id)).toEqual(['w0','w1','w2','w6','w7']);
    expect(dualWieldCandidates({...s,units:[...s.units].reverse()},jubal(s),ring[0]!)).toEqual(dualWieldCandidates(s,jubal(s),ring[0]!));
    unitById(s,'w2').side='player'; unitById(s,'w6').pos={x:1,y:3};
    unitById(s,'w0').footprint=[{x:0,y:0},{x:1,y:0}]; unitById(s,'w1').ko=true;
    expect(dualWieldCandidates(s,jubal(s),ring[0]!).map(c=>[c.unit.id,c.probability])).toEqual([['w0',.5],['w7',.5]]);
  });
  it('primary dying alone yields one strike and no selection draw; hover 100 times preserves state and RNG', () => {
    const s=arena('dual_wield'); unitById(s,'target').hp=1;
    const snapshot=structuredClone(s);
    for(let i=0;i<100;i++) expect(previewAttack(s,jubal(s),ring[0]!)!.candidates).toHaveLength(1);
    expect(s).toEqual(snapshot);
    const r=applyAction(s,attack());
    expect(r.events.filter(e=>e.t==='strike')).toHaveLength(1);
    expect(r).toEqual(applyAction(snapshot,attack()));
    const control=arena('daggers'); unitById(control,'target').hp=1;
    expect(r.state.rng).toEqual(applyAction(control,attack()).state.rng);
  });
  it('dodge displacement recomputes the pool before selection', () => {
    const s=arena('dual_wield',null,{reactionsEnabled:true,dodgeDisplaces:true});
    unitById(s,'target').dodge=1;
    const r=applyAction(s,attack());
    const moved=r.events.find(e=>e.t==='strike'&&e.displacedTo);
    expect(moved).toMatchObject({ avoided:'dodge', displacedTo:{x:3,y:1} });
    const pool=dualWieldCandidates(r.state,jubal(r.state),ring[0]!);
    expect(pool).toHaveLength(0);
    expect(r.events.filter(e=>e.t==='strike')).toHaveLength(1);
  });
});

describe('javelin, colossal and preview/engine parity golden', () => {
  it.each([1,2,4,5])('javelin throw inclusive range at %s', distance => {
    const s=arena('javelin_shield'); jubal(s).pos={x:0,y:3}; unitById(s,'target').pos={x:distance,y:3};
    expect(!!previewAttack(s,jubal(s),{x:distance,y:3},jubal(s).pos,'throw')).toBe(distance>=2&&distance<=4);
  });
  it('javelin diagonal thrust, wall LOS, no ranged parry, engagement and flanking survive throw intent', () => {
    const s=arena('javelin_shield',null,{reactionsEnabled:true}); unitById(s,'target').pos=ring[1]!;
    expect(previewAttack(s,jubal(s),ring[1]!,origin,'thrust')).not.toBeNull();
    const t=unitById(s,'target'); t.pos={x:3,y:0}; t.dodge=0; t.parry=1; t.block=0;
    expect(previewAttack(s,jubal(s),t.pos,origin,'throw')!.targets[0]!.avoidChance).toBe(0);
    s.map.tiles[2*7+3]='wall'; expect(previewAttack(s,jubal(s),t.pos,origin,'throw')).toBeNull();
    s.map.tiles[2*7+3]='floor';
    expect(canEngageUnit(s,jubal(s),t)).toBe(true);
    const b=testBattle({rows:OPEN_7x7,jubal:{x:2,y:3},weapon:'javelin_shield',allies:[{template:'jabal',at:{x:4,y:3}}],enemies:[{template:'wolf',at:origin}]});
    jubal(b).attack.ranged=true; // even a hypothetical mode must not change equipment threat
    expect(isFlanked(b,unitById(b,'wolf'))).toBe(true);
  });
  it('invalid modes and empty sweeps reject without state or RNG mutation', () => {
    const s=arena('colossal'), copy=structuredClone(s);
    expect(()=>applyAction(s,attack('bogus'))).toThrow();
    expect(previewAttack(s,jubal(s),ring[0]!,origin,'bogus')).toBeNull();
    expect(s).toEqual(copy);
    unitById(s,'target').pos={x:0,y:0};
    expect(()=>applyAction(s,attack('sweep'))).toThrow();
  });
  it.each(PLAYER_WEAPON_IDS)('%s: every mode and owned skill matches AP, damage, hit chance and next-turn projection', id => {
    for(const mode of WEAPONS[id]!.modes) {
      const s=arena(id); const target=unitById(s,'target');
      target.pos=mode.ranged?{x:3,y:0}:ring[0]!;
      assertPreview(s,{type:'attack',unitId:'jubal',target:mode.pattern==='ring8'?origin:target.pos,modeId:mode.id});
    }
    for(const skillId of WEAPONS[id]!.skills) {
      const s=arena(id), def=SKILLS[skillId]!, t=unitById(s,'target');
      t.pos=def.kind==='shot'?{x:3,y:0}:def.kind==='hook'?{x:3,y:1}:ring[0]!;
      assertPreview(s,{type:'skill',unitId:'jubal',skillId,target:t.pos});
    }
  });
});

describe('AI legality golden', () => {
  it.each(['expert','novice'] as const)('%s strict reload and flexible opener swap are legal and non-oscillating', policy => {
    for(const strict of [true,false]) {
      let s=arena('crossbow','shield',{crossbowReload:strict?'strict':'flexible'});
      s=nextTurn(applyAction(s,attack('fire')).state);
      const action=botAction(s,policy);
      expect(action.type).toBe(strict?'reload':'swapWeapon');
      s=applyAction(s,action).state;
      expect(s.active!.acted).toBe(true);
      s=nextTurn(s);
      expect(botAction(s,policy).type).not.toBe('swapWeapon');
    }
  });
  it.each(['expert','novice'] as const)('%s every encounter-allowed family/armor chooses legal actions with no stalls (strict)', policy => {
    for(const enc of ENCOUNTERS) for(const w of availableWeapons(enc,DEFAULT_CONFIG)) for(const armor of enc.allowedArmor) {
      const s=createBattle(enc,{weaponIds:[w.id,null],armor},{...DEFAULT_CONFIG,crossbowReload:'strict'},1000).state;
      const r=simulateBattle(s,4000,policy);
      expect(r.illegalFallbacks,`${enc.id}/${w.id}/${armor}`).toBe(0);
      expect(r.outcome,`${enc.id}/${w.id}/${armor}`).not.toBe('stalled');
    }
  },120000);
  it('refresh is idempotent, never changing HP, ammo, cooldown or status', () => {
    const s=arena('crossbow'); const u=jubal(s); u.hp=5; u.dazed=true; u.carried[0].loaded=false; u.carried[0].skillReadyAt.steady_bolt=300;
    refreshEquipment(s,u); const copy=structuredClone(u); refreshEquipment(s,u); expect(u).toEqual(copy);
  });
});

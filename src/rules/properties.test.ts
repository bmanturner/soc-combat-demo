import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { PLAYER_WEAPON_IDS, SKILLS, WEAPONS } from '../content/gear';
import { encounterById } from '../content/encounters';
import { decodeShare, encodeShare } from '../game/share';
import { DEFAULT_CONFIG, SETTINGS, withOverrides, type RulesConfig } from './config';
import { applyAction, createBattle, RulesError } from './engine';
import { attackModes, availableSkills, effectiveStats } from './equipment';
import { botAction, enemyAction } from './ai';
import { attackOptions, dangerAt, previewAttack, previewReload, previewSkill, previewSwap, projectedNextTurn, reachable, timelineEntries } from './queries';
import { alive, tilesOf, unitById } from './state';
import { OPEN_7x7, testEncounter } from './testkit';
import type { Action, BattleState } from './types';

const configArb = fc.tuple(...SETTINGS.map(s => s.type === 'boolean' ? fc.boolean() : s.type === 'select' ? fc.constantFrom(...s.options.map(o => o.value)) : fc.integer({min:0,max:Math.round((s.max-s.min)/s.step)}).map(n => Math.min(s.max, Number((s.min+n*s.step).toFixed(5)))))).map(values => withOverrides(Object.fromEntries(SETTINGS.map((s,i)=>[s.key,values[i]]))));
function freeze<T>(x:T):T { if(x && typeof x==='object' && !Object.isFrozen(x)){ Object.freeze(x); for(const v of Object.values(x))freeze(v); } return x; }
function invariant(s:BattleState) {
  expect(Number.isFinite(s.clock)).toBe(true); expect(s.clock).toBeGreaterThanOrEqual(0);
  const occupied:string[]=[];
  for(const u of s.units){
    expect(Number.isFinite(u.hp)).toBe(true); expect(u.hp).toBeGreaterThanOrEqual(0); expect(u.hp).toBeLessThanOrEqual(u.maxHp);
    expect(Number.isFinite(u.nextTurnAt)).toBe(true); expect(u.nextTurnAt).toBeGreaterThanOrEqual(0);
    if(alive(u))occupied.push(...tilesOf(u).map(p=>`${p.x},${p.y}`));
  }
  expect(new Set(occupied).size).toBe(occupied.length);
  if(s.active)for(const v of [s.active.moveSpent,s.active.actionSpent,s.active.reactionSpent]){expect(Number.isFinite(v)).toBe(true);expect(v).toBeGreaterThanOrEqual(0);}
}
function actions(s:BattleState):Action[]{
  const u=unitById(s,s.active!.unitId), out:Action[]=[{type:'endTurn',unitId:u.id}];
  for(const r of reachable(s,u.id).values())if(r.path.length>1)out.push({type:'move',unitId:u.id,to:r.path.at(-1)!});
  for(const p of attackOptions(s,u))out.push({type:'attack',unitId:u.id,target:p.anchor,modeId:p.modeId!});
  for(const sk of availableSkills(s,u))for(const t of s.units.flatMap(tilesOf))if(previewSkill(s,u,sk.id,t))out.push({type:'skill',unitId:u.id,skillId:sk.id,target:t});
  if(previewReload(s,u).valid)out.push({type:'reload',unitId:u.id});
  for(const slot of [0,1] as const)if(previewSwap(s,u,slot).valid)out.push({type:'swapWeapon',unitId:u.id,slot});
  timelineEntries(s); effectiveStats(s.config,u); dangerAt(s,u.pos,projectedNextTurn(s,0));
  return out;
}
function parity(s:BattleState,a:Action){
  const u=unitById(s,a.unitId), active=s.active!;
  const p=a.type==='attack'?previewAttack(s,u,a.target,u.pos,a.modeId):a.type==='skill'?previewSkill(s,u,a.skillId,a.target):null;
  const ap=p?.apCost ?? (a.type==='reload'?previewReload(s,u).apCost:a.type==='swapWeapon'?previewSwap(s,u,a.slot).apCost:0);
  const acted=!['move','endTurn'].includes(a.type);
  const expectedDelay=projectedNextTurn(s,ap,acted);
  const r=applyAction(s,a);
  if(!['move','endTurn'].includes(a.type)){
    const event=r.events.find(e=>(e.t==='attack'&&!e.free)||e.t==='reload'||e.t==='swapWeapon');
    expect(event && 'apCost' in event ? event.apCost : undefined).toBe(ap);
    const end=r.events.find(e=>e.t==='turnEnd'&&e.unitId===u.id);
    if(end?.t==='turnEnd')expect(end.nextTurnAt-s.clock).toBeCloseTo(expectedDelay);
    else expect(projectedNextTurn(r.state,0)).toBeCloseTo(expectedDelay);
    // Damage is conditional on landing, non-critical, and the advertised flank remaining intact.
    // Sequential AoE/dual strikes can legitimately change the board after the first hit.
    if(p)for(const e of r.events)if(e.t==='strike'&&e.attackerId===u.id){
      const tp=p.targets.find(t=>t.unitId===e.targetId)??p.candidates?.find(t=>t.unitId===e.targetId);
      expect(tp).toBeDefined(); expect(e.hitChance).toBeCloseTo(tp!.hitChance);
      if(e.hit&&!e.avoided&&!e.crit&&e.flanked===tp!.flanked)expect(e.damage).toBe(tp!.damageIfLands);
    }
  }else if(a.type==='endTurn'){
    const end=r.events.find(e=>e.t==='turnEnd'&&e.unitId===u.id);
    expect(end?.t==='turnEnd'?end.nextTurnAt-s.clock:undefined).toBeCloseTo(expectedDelay);
  }else if(a.type==='move'){
    const reach=reachable(s,u.id).get(`${a.to.x},${a.to.y}`)!;
    if(!reach.risks.length){
      const cost=r.events.filter(e=>e.t==='move').reduce((n,e)=>n+(e.t==='move'?e.cost:0),0);
      expect(cost,JSON.stringify({action:a,positions:s.units.map(x=>({id:x.id,pos:x.pos,canEngage:x.canEngage,ko:x.ko})),reach,events:r.events})).toBeCloseTo(reach.cost);
      const surcharge=active.surchargePending&&!active.surchargePaid?s.config.bowMoveSurcharge:0;
      const end=r.events.find(e=>e.t==='turnEnd'&&e.unitId===u.id);
      const expected=projectedNextTurn(s,reach.cost+surcharge);
      if(end?.t==='turnEnd')expect(end.nextTurnAt-s.clock).toBeCloseTo(expected);
      else expect(projectedNextTurn(r.state,0)).toBeCloseTo(expected);
    }
  }
  return r;
}

describe('generated legal sequences',()=>{
 it.each(PLAYER_WEAPON_IDS)('%s random configs/actions: replay, frozen input/query purity, legal errors, HP/AP/occupancy and conditional previews',id=>{
  fc.assert(fc.property(configArb,fc.integer({min:1,max:0x7fffffff}),fc.array(fc.nat({max:100000}),{minLength:35,maxLength:35}),(cfg,seed,choices)=>{
    const config={...cfg,unlockSpecialWeapons:true};
    let s=createBattle(encounterById(['wolves','cultists','nephilim'][seed%3]!),{weaponIds:[id,PLAYER_WEAPON_IDS[seed%9]!],armor:seed%2?'heavy':'light'},config,seed).state;
    for(const choice of choices){
      invariant(s); if(s.outcome!=='ongoing')break;
      const snapshot=structuredClone(s); freeze(s);
      const options=actions(s);
      const u=unitById(s,s.active!.unitId);
      const ai=u.side==='enemy'?enemyAction(s):botAction(s,choice%2?'expert':'novice');
      expect(s).toEqual(snapshot);
      const action=choice%3===0?ai:options[choice%options.length]!;
      const result=parity(s,action);
      expect(result).toEqual(applyAction(snapshot,action)); expect(s).toEqual(snapshot);
      s=result.state; s.log=[];
    }
    invariant(s);
  }),{seed:7132026,numRuns:20,endOnFailure:true});
 },120000);
});

describe('controlled all-mode/skill parity under randomized tuning',()=>{
 it.each(PLAYER_WEAPON_IDS)('%s every mode and skill: random config damage/AP/next-turn, reload and swaps',id=>{
  fc.assert(fc.property(configArb,fc.integer({min:1,max:100000}),(cfg,seed)=>{
    const config:RulesConfig={...cfg,unlockSpecialWeapons:true,proficientAllWeapons:true,reactionsEnabled:false,critChance:0,autoEndTurn:false};
    const enc=testEncounter({rows:OPEN_7x7,jubal:{x:3,y:3},enemies:[{template:'wolf',id:'target',at:{x:3,y:2},initiative:999999}]});
    const start=createBattle(enc,{weaponIds:[id,'shield'],armor:'light'},config,seed).state;
    const target=unitById(start,'target');target.hp=target.maxHp=10000;
    for(const mode of attackModes(start,start.units[0]!)){
      const s=structuredClone(start);unitById(s,'target').pos={x:3,y:mode.ranged?0:2};
      parity(freeze(s),{type:'attack',unitId:'jubal',target:mode.pattern==='ring8'?{x:3,y:3}:unitById(s,'target').pos,modeId:mode.id});
    }
    for(const skillId of WEAPONS[id]!.skills){
      const s=structuredClone(start),def=SKILLS[skillId]!;unitById(s,'target').pos={x:3,y:def.kind==='shot'?0:def.kind==='hook'?1:2};
      parity(freeze(s),{type:'skill',unitId:'jubal',skillId,target:unitById(s,'target').pos});
    }
    parity(freeze(start),{type:'swapWeapon',unitId:'jubal',slot:1});
  }),{seed:7132027,numRuns:20,endOnFailure:true});
 });
});
it('every registered setting boundary survives share links with two-slot normalization',()=>{
 for(const def of SETTINGS){
  const values=def.type==='number'?[def.min,def.max]:def.type==='boolean'?[false,true]:def.options.map(o=>o.value);
  for(const value of values){const config=withOverrides({[def.key]:value});const decoded=decodeShare(encodeShare({encounterId:'wolves',weaponId:'crossbow',secondaryWeaponId:'shield',equippedSlot:1,armor:'light',config,seed:0xffffffff}));expect(decoded.invalid).toBeUndefined();expect(decoded.config).toEqual(config);expect(decoded.secondaryWeaponId).toBe('shield');expect(decoded.equippedSlot).toBe(1);}
 }
});
it('arbitrary illegal modes reject with RulesError and no mutation',()=>{
 fc.assert(fc.property(fc.string(),modeId=>{
  const s=createBattle(encounterById('wolves'),{weaponId:'colossal',armor:'light'},DEFAULT_CONFIG,1).state;
  if(['line','sweep'].includes(modeId))return;
  freeze(s);expect(()=>applyAction(s,{type:'attack',unitId:'jubal',target:{x:0,y:0},modeId})).toThrow(RulesError);
 }),{numRuns:100,seed:7132028});
});

import { expect, it } from 'vitest';
import { SKILLS } from '../content/gear';
import { applyAction } from './engine';
import { reachable } from './queries';
import { resolveSkill } from './resolvers';
import { isFlanked, unitById } from './state';
import { OPEN_7x7, testBattle } from './testkit';

it('F-01: departing a flank must expose the later disengagement risk in the advertised path',()=>{
 const s=testBattle({rows:OPEN_7x7,jubal:{x:1,y:3},weapon:'daggers',allies:[{template:'jabal',at:{x:3,y:3}}],enemies:[{template:'wolf',at:{x:2,y:3}}],config:{engageBase:1,engagePerPoint:0,engageMax:1,aooChance:0},seed:1});
 expect(isFlanked(s,unitById(s,'wolf'))).toBe(true);
 const to={x:1,y:0},r=reachable(s,'jubal').get('1,0')!;
 const actual=applyAction(s,{type:'move',unitId:'jubal',to});
 expect(actual.events.some(e=>e.t==='disengage'&&e.held)).toBe(true);
 expect(unitById(actual.state,'jubal').pos).toEqual({x:1,y:1});
 expect(r.risks.length).toBeGreaterThan(0);
});
it('F-02: declared delayed ability reactions must not be silently discarded by resolveSkill',()=>{
 const s=testBattle({rows:OPEN_7x7,jubal:{x:1,y:3},enemies:[{template:'cultist_mage',id:'seer',at:{x:4,y:3}}]});
 const authored={...SKILLS.hellfire_sigil!,allowedReactions:['block'] as ['block']};
 expect(resolveSkill(s,unitById(s,'seer'),authored).profile.allowedReactions).toEqual(['block']);
});

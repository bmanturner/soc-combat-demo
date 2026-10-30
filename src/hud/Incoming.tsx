import { useEffect, useRef } from 'react';
import { breakFreeAt } from '../rules/engine';
import { eq } from '../rules/geometry';
import { bossSweepThreat, escapeOutlook, projectedNextTurn } from '../rules/queries';
import { effectCanHit, unitActsBefore } from '../rules/resolvers';
import { alive, tilesOf } from '../rules/state';
import { activePlayer, endTurnPreview, pendingFor } from '../game/preview';
import { controller } from '../game/controller';
import { useGame } from './hooks';

/** What's about to land, who is inside, and whether they act before it does. */
export function IncomingPanel() {
  const battle = useGame((s) => s.battle);
  const hoverTile = useGame(s => s.hoverTile), mode = useGame(s => s.mode), busy = useGame(s => s.busy), actionHover = useGame(s => s.actionHover);
  const pending = pendingFor({battle,hoverTile,mode,busy,actionHover});
  if (!battle) return null;
  const idle = !pending && activePlayer(battle) ? endTurnPreview(battle) : null;
  const party = battle.units.filter((u) => u.side === 'player' && alive(u));
  const threat = bossSweepThreat(battle);
  const bf = breakFreeAt(battle);
  const items = battle.effects.map((e) => {
    const impactIn = e.resolveAt - battle.clock;
    const inside = battle.units.filter((u) => effectCanHit(battle, e, u) && tilesOf(u).some((t) => e.tiles.some((x) => eq(x, t))));
    return { e, impactIn, inside };
  });
  return (
    <div className="incoming" data-testid="incoming">
      <div className="section-title">Incoming</div>
      {pending && <div className={`muted inc-verdict ${pending.verdict?.tone ?? ''}`} data-testid="incoming-preview">{pending.what}: {pending.verdict?.text ?? pending.dangerText}</div>}
      {idle && <div className={`muted inc-verdict ${idle.verdict.tone}`} data-testid="incoming-idle">Wait: {idle.verdict.text}</div>}
      {items.length === 0 && !threat && <div className="muted">Nothing telegraphed.</div>}
      {items.map(({ e, impactIn, inside }) => (
        <div key={e.id} className="inc-item">
          <div className="inc-head">
            <b>{e.name}</b> lands in <b>{Math.round(impactIn)}</b> AP · {Math.round(e.damage)} raw
          </div>
          {inside.length === 0 && <div className="muted">No one inside.</div>}
          {inside.map((u) => {
            const isActive = battle.active?.unitId === u.id;
            const nextIn = isActive ? projectedNextTurn(battle, 0) : u.nextTurnAt - battle.clock;
            const outlook = escapeOutlook(battle, u, e);
            const acts = outlook.canEscape;
            const who = isActive ? `${u.name} (if you stop here, next turn in ${Math.round(nextIn)})` : `${u.name} acts in ${Math.round(nextIn)}`;
            return (
              <div key={u.id} className={`inc-unit ${acts ? 'ok' : 'caught'}`} onMouseEnter={() => controller.hoverUnit(u.id)} onMouseLeave={() => controller.hoverUnit(null)}>
                {who}: {acts ? outlook.disengageRisk > 0 ? `escape needs a disengage (${Math.round(outlook.disengageRisk * 100)}% risk)` : `can still escape (+${Math.round(impactIn - nextIn)})` : `CAUGHT (${outlook.actsBefore ? 'no reachable safe tile' : 'impact before next turn'})`}
              </div>
            );
          })}
        </div>
      ))}
      {threat && (
        <div className="inc-item boss">
          <div className="inc-head">
            Nephilim acts in <b>{Math.round(threat.bossActsIn)}</b> AP
          </div>
          <div className="muted">
            Anyone in the sweep zone then gets a sweep landing <b>{Math.round(threat.landsIn)}</b> AP from now. To be safe there, your next turn must come first.
          </div>
          {party.map((u) => {
            const isActive = battle.active?.unitId === u.id;
            const nextIn = isActive ? projectedNextTurn(battle, 0) : u.nextTurnAt - battle.clock;
            const inZone = threat.tiles.some((t) => eq(t, u.pos));
            if (!inZone) return null;
            const boss = battle.units.find(x => x.id === threat.bossId)!;
            const nextAt = battle.clock + nextIn;
            const beforeBoss = unitActsBefore(battle, u, nextAt, { kind: 'unit', unit: boss, at: boss.nextTurnAt });
            const outlook = escapeOutlook(battle, u, { sourceId: boss.id, tiles: threat.tiles, resolveAt: battle.clock + threat.landsIn }, { nextAt });
            const ok = beforeBoss || outlook.canEscape;
            return (
              <div key={u.id} className={`inc-unit ${ok ? 'ok' : 'caught'}`}>
                {u.name} in the zone, {isActive ? 'next turn if you stop now' : 'acts'} in {Math.round(nextIn)}: {beforeBoss ? 'acts before he does' : ok ? outlook.disengageRisk > 0 ? 'escape needs a disengage' : 'can get out before it lands' : 'would be caught'}
              </div>
            );
          })}
          {bf !== null && <div className="muted">He tears free at {bf} AP ({Math.round(bf - battle.clock)} left).</div>}
        </div>
      )}
    </div>
  );
}

export function CombatLog() {
  const log = useGame((s) => s.log);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [log]);
  return (
    <div className="log" ref={ref} data-testid="log">
      {log.map((l) => (
        <div key={l.id} className={`log-line ${l.tone}`}>
          {l.text}
        </div>
      ))}
    </div>
  );
}

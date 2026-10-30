import type { CSSProperties } from 'react';
import { breakFreeAt } from '../rules/engine';
import { bossSweepThreat, timelineEntries } from '../rules/queries';
import { controller } from '../game/controller';
import { activePlayer, endTurnPreview, pendingFor } from '../game/preview';
import { useGame } from './hooks';

const SPAN = 300; // Aaron: the timeline bar runs 0–300 AP.

export function Timeline() {
  const battle = useGame((s) => s.battle);
  const hoverUnitId = useGame((s) => s.hoverUnitId);
  const hoverTile = useGame((s) => s.hoverTile);
  const mode = useGame((s) => s.mode);
  const busy = useGame((s) => s.busy);
  const actionHover = useGame(s => s.actionHover);
  const pending = pendingFor({ battle, hoverTile, mode, busy, actionHover });
  if (!battle) return null;
  const entries = timelineEntries(battle);
  const pos = (at: number) => `${(Math.min(Math.max(at, 0), SPAN) / SPAN) * 100}%`;
  const u = activePlayer(battle);
  const end = u ? endTurnPreview(battle) : null;
  const ghost = pending ?? (u ? { projected: end!.projected, danger: end!.danger, what: 'Wait / end turn', dangerText: end!.text, verdict: end!.verdict } : null);
  const tone = ghost?.verdict?.tone ?? (ghost?.danger === 'none' ? 'clear' : ghost?.danger);
  const threat = bossSweepThreat(battle);
  const bf = breakFreeAt(battle);
  const bfIn = bf === null ? null : bf - battle.clock;
  // Stack icons that share an AP slot.
  const slots = new Map<number, number>();
  const ticks = [];
  for (let t = 0; t <= SPAN; t += 25) ticks.push(t);

  return (
    <div className="timeline" data-testid="timeline">
      <div className="timeline-head">
        <span className="tl-title">AP Timeline</span>
        <small>Dashed ghost = your next turn after the hovered action</small>
        <span className="tl-clock">Clock {Math.round(battle.clock)} AP</span>
        {bfIn !== null && (
          <span className={`tl-breakfree ${bfIn < 300 ? 'urgent' : ''}`} title="Kill him before he tears free of the rubble.">
            Breaks free in {Math.round(bfIn)} AP
          </span>
        )}
        {ghost && (
          <span className={`tl-ghost-text ${tone}`} data-testid="ghost-text">
            {ghost.what}: next turn in <b>{Math.round(ghost.projected)}</b> AP{ghost.verdict ? ` · ${ghost.verdict.short}` : ''}
          </span>
        )}
      </div>
      <div className="tl-track" style={{ '--tl-effects': entries.filter(e => e.kind !== 'unit' && e.at <= SPAN).length } as CSSProperties}>
        {ticks.map((t) => (
          <div key={t} className={`tl-tick ${t % 50 === 0 ? 'major' : ''}`} style={{ left: pos(t) }}>
            {t % 50 === 0 && <span>{t}</span>}
          </div>
        ))}
        {threat && threat.landsIn <= SPAN && (
          <div className="tl-sweep" style={{ left: pos(threat.bossActsIn), width: `${((Math.min(threat.landsIn, SPAN) - Math.min(threat.bossActsIn, SPAN)) / SPAN) * 100}%` }} title="If anyone is in the sweep zone when the Nephilim acts, the sweep lands at the end of this band.">
            <span>next sweep, if anyone is in the zone</span>
            <em className="tl-lands-cap" data-testid="tl-sweep-lands">sweep lands · {Math.round(threat.landsIn)}</em>
          </div>
        )}
        {bfIn !== null && bfIn <= SPAN && <div className="tl-bf" style={{ left: pos(bfIn) }} title="He tears free here." />}
        {ghost && (
          <div className={`tl-ghost ${tone}`} style={{ left: pos(ghost.projected) }} data-testid="ghost" title={ghost.verdict?.text || ghost.dangerText || 'Where your next turn would land'}>
            {u?.glyph}
          </div>
        )}
        {entries
          .filter((e) => e.kind !== 'unit' && e.at <= SPAN)
          .map((e, i) => (
            <div key={`tag-${e.id}`} className="tl-effect-tag" style={{ left: pos(Math.min(e.at, 240)), '--tl-i': i } as CSSProperties}>
              {e.label} lands · {Math.round(e.at)}
            </div>
          ))}
        {entries.map((e) => {
          const slot = Math.round(Math.min(e.at, SPAN));
          const n = slots.get(slot) ?? 0;
          slots.set(slot, n + 1);
          const hovered = e.kind === 'unit' && e.id === hoverUnitId;
          return (
            <div
              key={e.id}
              className={`tl-item ${e.kind} ${e.side} ${e.active ? 'active' : ''} ${hovered ? 'hovered' : ''}`}
              style={{ left: pos(e.at), top: `${4 + n * 22}px` }}
              onMouseEnter={() => e.kind === 'unit' && controller.hoverUnit(e.id)}
              onMouseLeave={() => controller.hoverUnit(null)}
              title={e.kind === 'unit' ? `${battle.units.find((x) => x.id === e.id)?.name}: acts in ${Math.round(e.at)} AP` : `${e.label}: lands in ${Math.round(e.at)} AP`}
              data-testid={`tl-${e.id}`}
            >
              {e.kind === 'unit' ? e.label : '✸'}
              {e.at > SPAN && <span className="tl-over">+</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

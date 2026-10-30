import { useEffect, useRef, useState } from 'react';
import type { DelayedEffect } from '../rules/types';
import { boardRect } from '../game/board-anchor';
import { controller } from '../game/controller';
import { activePlayer } from '../game/preview';
import { store } from '../game/store';
import { useGame, useTouchUI } from './hooks';

export function GranaryGuide() {
  const battle = useGame(s => s.battle);
  const actions = useGame(s => s.actions);
  const [watchedGhost, setWatchedGhost] = useState(false);
  const touch = useTouchUI();
  const [skipped, setSkipped] = useState(() => sessionStorage.getItem('soc-guide-skipped') === 'yes');
  if (skipped || battle?.encounterId !== 'granary' || battle.outcome !== 'ongoing') return null;
  const moved = actions.some(a => a.type === 'move');
  return <div className="granary-guide" data-testid="granary-guide">
    <b>{!moved ? '1 · Move' : watchedGhost ? '3 · Attack / End turn' : '2 · Watch the ghost'}</b>
    <span>{!moved
      ? (touch ? 'Tap a blue tile to preview it, then tap it again to move. Movement has its own per-turn budget.' : 'Hover a blue tile, then click to move. Movement has its own per-turn budget.')
      : watchedGhost
        ? (touch ? 'Aim an attack, tap a target to preview, then tap it again to commit. End turn when ready.' : 'Aim an attack, then click a target to commit. End turn when ready.')
        : (touch ? 'Tap a target and watch the dashed next-turn marker above.' : 'Hover a target and watch the dashed next-turn marker above.')} AP spent = delay, not an action budget.</span>
    {moved && !watchedGhost && <button onClick={() => setWatchedGhost(true)}>Next: attack / end turn</button>}
    <button onClick={() => { sessionStorage.setItem('soc-guide-skipped', 'yes'); setSkipped(true); }}>Skip guidance</button>
  </div>;
}

const LAST_STEP = 2;

/**
 * First-telegraph lesson, shown once per browser at the first player turn with a telegraph on the board.
 * Three steps walk the race that decides an escape: the tiles, when it lands, and where your next turn lands.
 * The card docks above Incoming and the ring never takes pointer input, so play continues underneath.
 */
export function TelegraphGuide() {
  const battle = useGame(s => s.battle);
  const busy = useGame(s => s.busy);
  const bot = useGame(s => s.botParty);
  const done = useGame(s => s.telegraphGuideDone);
  const dialogOpen = useGame(s => s.settingsOpen || s.helpOpen);
  const [progress, setProgress] = useState<{ effectId: string; step: number } | null>(null);
  const touch = useTouchUI();
  const effect = battle && !done && !busy && !bot && activePlayer(battle)
    ? battle.effects.reduce<DelayedEffect | null>((first, e) => (!first || e.resolveAt < first.resolveAt ? e : first), null)
    : null;
  const effectId = effect?.id;
  // Compact layouts hide the Incoming panel behind a tab: bring the lesson into view when it starts.
  useEffect(() => { if (effectId) store.setState({ sheetTab: 'intel', sheetOpen: true }); }, [effectId]);
  if (!battle || !effect) return null;
  // A new telegraph restarts an unfinished lesson from its first step.
  const step = progress?.effectId === effect.id ? progress.step : 0;
  const landsIn = Math.round(effect.resolveAt - battle.clock);
  const copy = [
    { title: `${effect.name} is coming`, body: 'It will hit the red tiles. Anyone still standing on them when it lands is caught.' },
    { title: 'It lands at the diamond', body: `On the timeline, ${effect.name} lands ${landsIn} AP from now. Every unit whose marker sits left of the diamond acts before it does.` },
    { title: 'Keep your marker left of it', body: `The dashed marker shows where your next turn lands for whatever you ${touch ? 'tap' : 'hover'}. Left of the diamond, you get to step out first. Blue tiles are clear of the red; Incoming lists who is inside.` },
  ][step]!;
  const finish = () => {
    setProgress(null);
    controller.setTelegraphGuideDone(true);
    store.setState({ sheetTab: 'actions', sheetOpen: false });
  };
  return (
    <section className="telegraph-guide" aria-label="Telegraph guide" data-testid="telegraph-guide">
      <div aria-live="polite">
        <h3>{copy.title}</h3>
        <p>{copy.body}</p>
      </div>
      <div className="tg-foot">
        <span className="tg-step">{step + 1} of {LAST_STEP + 1}</span>
        <button className="tg-skip" onClick={finish}>Skip</button>
        <button onClick={() => (step < LAST_STEP ? setProgress({ effectId: effect.id, step: step + 1 }) : finish())} data-testid="telegraph-guide-next">
          {step < LAST_STEP ? 'Next' : 'Got it'}
        </button>
      </div>
      {!dialogOpen && <GuideRing effect={effect} step={step} />}
    </section>
  );
}

/** Outline around the step's subject (board tiles, timeline diamond, next-turn marker), tracked every frame so it follows 3D orbit and layout. */
function GuideRing({ effect, step }: { effect: DelayedEffect; step: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    const place = () => {
      const ring = ref.current;
      if (ring) {
        const r = step === 0 ? tilesRect(effect.tiles) : document.querySelector(`[data-testid="${step === 1 ? `tl-${effect.id}` : 'ghost'}"]`)?.getBoundingClientRect() ?? null;
        ring.style.display = r ? 'block' : 'none';
        if (r) Object.assign(ring.style, { left: `${r.left - 6}px`, top: `${r.top - 6}px`, width: `${r.width + 12}px`, height: `${r.height + 12}px` });
      }
      frame = requestAnimationFrame(place);
    };
    place();
    return () => cancelAnimationFrame(frame);
  }, [effect, step]);
  return <div ref={ref} key={step} className="tg-ring" aria-hidden="true" data-testid="telegraph-guide-ring" />;
}

function tilesRect(tiles: DelayedEffect['tiles']): DOMRect | null {
  const xs = tiles.map(t => t.x);
  const ys = tiles.map(t => t.y);
  return boardRect(Math.min(...xs), Math.min(...ys), Math.max(...xs) + 1, Math.max(...ys) + 1);
}

export function Provenance({ value, label }: { value: object; label?: string }) {
  const p = (value as { provenance?: { concept: string; numbers: string; why?: string } }).provenance;
  return p ? <small className="provenance" title={p.why}>{label ? `${label} · ` : ''}Concept: {p.concept} · numbers: {p.numbers}</small> : null;
}

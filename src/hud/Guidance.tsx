import { useState } from 'react';
import { useGame } from './hooks';

export function GranaryGuide() {
  const battle = useGame(s => s.battle);
  const actions = useGame(s => s.actions);
  const [watchedGhost, setWatchedGhost] = useState(false);
  const [skipped, setSkipped] = useState(() => sessionStorage.getItem('soc-guide-skipped') === 'yes');
  if (skipped || battle?.encounterId !== 'granary' || battle.outcome !== 'ongoing') return null;
  const moved = actions.some(a => a.type === 'move');
  return <div className="granary-guide" data-testid="granary-guide">
    <b>{!moved ? '1 · Move' : watchedGhost ? '3 · Attack / End turn' : '2 · Watch the ghost'}</b>
    <span>{!moved ? 'Hover a blue tile, then click to move. Movement has its own per-turn budget.' : watchedGhost ? 'Aim an attack, then click a target to commit. End turn when ready.' : 'Hover a target and watch the dashed next-turn marker above.'} AP spent = delay, not an action budget.</span>
    {moved && !watchedGhost && <button onClick={() => setWatchedGhost(true)}>Next: attack / end turn</button>}
    <button onClick={() => { sessionStorage.setItem('soc-guide-skipped', 'yes'); setSkipped(true); }}>Skip guidance</button>
  </div>;
}

export function Provenance({ value, label }: { value: object; label?: string }) {
  const p = (value as { provenance?: { concept: string; numbers: string; why?: string } }).provenance;
  return p ? <small className="provenance" title={p.why}>{label ? `${label} · ` : ''}Concept: {p.concept} · numbers: {p.numbers}</small> : null;
}

import { useEffect } from 'react';
import { controller } from '../game/controller';
import { activePlayer } from '../game/preview';
import { store } from '../game/store';
import { ActionPanel } from './ActionPanel';
import { BoardHost } from './BoardHost';
import { CombatLog, IncomingPanel } from './Incoming';
import { HelpOverlay, Menu, ResultOverlay, SettingsDrawer, Setup, Toast } from './Screens';
import { Timeline } from './Timeline';
import { useGame } from './hooks';
import { encounterById } from '../content/encounters';

function TopBar() {
  const encounterId = useGame((s) => s.encounterId);
  const speed = useGame((s) => s.speed);
  const bot = useGame((s) => s.botParty);
  const seed = useGame((s) => s.seed);
  const enc = encounterById(encounterId);
  return (
    <header className="topbar">
      <button onClick={() => controller.openMenu()} title="Back to encounters">☰</button>
      <div className="tb-title">
        <b>{enc.name}</b> <span className="muted">{enc.subtitle} · seed {seed}</span>
      </div>
      <div className="tb-right">
        <label title="Animation speed">
          Speed
          <select value={speed} onChange={(e) => controller.setSpeed(Number(e.target.value))}>
            <option value={0.5}>0.5×</option>
            <option value={1}>1×</option>
            <option value={2}>2×</option>
            <option value={4}>4×</option>
          </select>
        </label>
        <label title="Let the bot play the party (watch how the rules behave)">
          <input type="checkbox" checked={bot} onChange={(e) => controller.setBotParty(e.target.checked)} data-testid="bot-toggle" /> Bot plays party
        </label>
        <button onClick={() => controller.restart(false)}>Restart</button>
        <button onClick={() => store.setState({ settingsOpen: true })} data-testid="open-settings">Rules</button>
        <button onClick={() => store.setState({ helpOpen: true })}>?</button>
      </div>
    </header>
  );
}

function Battle() {
  return (
    <div className="battle" data-testid="battle">
      <TopBar />
      <Timeline />
      <div className="battle-main">
        <ActionPanel />
        <BoardHost />
        <aside className="panel right">
          <IncomingPanel />
          <div className="section-title">Combat log</div>
          <CombatLog />
        </aside>
      </div>
      <ResultOverlay />
    </div>
  );
}

export function App() {
  const screen = useGame((s) => s.screen);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = store.getState();
      // Dialogs own Escape and focus, including when a slider/select is focused.
      if (s.settingsOpen || s.helpOpen || s.battle?.outcome !== 'ongoing') return;
      if (e.key === 'Escape') {
        controller.setMode({ kind: 'move' });
        return;
      }
      if (e.target instanceof HTMLElement && (e.target.matches('input, select, textarea') || e.target.isContentEditable)) return;
      if (e.key === ' ' && e.target instanceof HTMLButtonElement) return;
      if (s.screen !== 'battle' || s.busy || s.botParty) return;
      const u = activePlayer(s.battle);
      if (!u) return;
      if (e.key === ' ') {
        e.preventDefault();
        void controller.endTurn();
      } else if (e.key === 'm' || e.key === 'M') controller.setMode({ kind: 'move' });
      else if (e.key === 'a' || e.key === 'A') controller.setMode({ kind: 'attack' });
      else if (/^[1-9]$/.test(e.key)) {
        const skill = u.skills[Number(e.key) - 1];
        if (skill) controller.setMode({ kind: 'skill', skillId: skill.id });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <>
      {screen === 'menu' && <Menu />}
      {screen === 'setup' && <Setup />}
      {screen === 'battle' && <Battle />}
      <SettingsDrawer />
      <HelpOverlay />
      <Toast />
    </>
  );
}

import { ENCOUNTERS, encounterById } from '../content/encounters';
import { ARMOR, WEAPONS } from '../content/gear';
import { DEFAULT_CONFIG, SETTINGS, diffFromDefaults, type RulesConfig, type SettingDef } from '../rules/config';
import type { ArmorClass, BattleState } from '../rules/types';
import { controller } from '../game/controller';
import { showToast, store } from '../game/store';
import { useState } from 'react';
import { useGame } from './hooks';

const STARTERS = ['daggers', 'shield', 'polearm', 'two_handed'];

export function Menu() {
  return (
    <div className="screen menu" data-testid="menu">
      <div className="menu-hero">
        <div className="eyebrow">Sons of Cain</div>
        <h1>Combat Demo</h1>
        <p className="lede">
          AP-timeline tactics. Every move and swing costs Action Points, and the AP you spend decides when you act again. Read the timeline,
          commit at the right moment, and get out before the blow lands.
        </p>
      </div>
      <div className="enc-grid">
        {ENCOUNTERS.map((e, i) => (
          <button key={e.id} className="enc-card" onClick={() => controller.openSetup(e.id)} data-testid={`enc-${e.id}`}>
            <div className="enc-num">{i + 1}</div>
            <div className="enc-name">{e.name}</div>
            <div className="enc-sub">{e.subtitle}</div>
            <div className="enc-lesson">{e.lesson}</div>
            <div className="enc-meta">
              <span>Length: {e.targetTurns}</span>
              <span>Danger: {e.danger}</span>
            </div>
            <div className="enc-play">{i === 0 ? 'Start here →' : 'Choose loadout →'}</div>
          </button>
        ))}
      </div>
      <div className="menu-foot">
        <button onClick={() => store.setState({ helpOpen: true })}>How to play</button>
        <button onClick={() => store.setState({ settingsOpen: true })}>Rules & settings</button>
      </div>
    </div>
  );
}

export function Setup() {
  const encounterId = useGame((s) => s.encounterId);
  const weaponId = useGame((s) => s.weaponId);
  const armor = useGame((s) => s.armor);
  const enc = encounterById(encounterId);
  return (
    <div className="screen setup" data-testid="setup">
      <button className="back" onClick={() => controller.openMenu()}>
        ← Encounters
      </button>
      <h2>{enc.name}</h2>
      <p className="lede">{enc.story}</p>
      <p className="lesson">Lesson: {enc.lesson}</p>
      <h3>Tubal-Cain offers you a weapon</h3>
      <div className="choice-grid">
        {STARTERS.map((id) => {
          const w = WEAPONS[id]!;
          return (
            <button key={id} className={`choice ${weaponId === id ? 'on' : ''}`} onClick={() => controller.setLoadout({ weaponId: id })} data-testid={`weapon-${id}`}>
              <div className="choice-name">{weaponId === id ? '✓ ' : ''}{w.name}</div>
              <PatternGlyph pattern={w.attack.pattern} />
              <div className="choice-stats">
                {w.attack.apCost} AP · {w.attack.damage} dmg · {Math.round(w.attack.hit * 100)}% hit
              </div>
              <div className="choice-blurb">{w.blurb}</div>
            </button>
          );
        })}
      </div>
      <h3>Armor</h3>
      <div className="choice-grid armor">
        {(['clothing', 'light', 'medium', 'heavy'] as ArmorClass[]).map((id) => {
          const a = ARMOR[id];
          const allowed = enc.allowedArmor.includes(id);
          return (
            <button key={id} className={`choice ${armor === id ? 'on' : ''}`} disabled={!allowed} onClick={() => controller.setLoadout({ armor: id })} data-testid={`armor-${id}`}>
              <div className="choice-name">{armor === id ? '✓ ' : ''}{a.name}</div>
              <div className="choice-stats">
                Armor {a.armor} · Dodge {Math.round(a.dodge * 100)}%
              </div>
              <div className="choice-blurb">{allowed ? a.blurb : 'Jubal starts in village clothing. Armor comes later.'}</div>
            </button>
          );
        })}
      </div>
      <div className="setup-go">
        <button className="primary" onClick={() => controller.startBattle()} data-testid="start">
          Fight
        </button>
        <button onClick={() => controller.startBattle({ newSeed: true })}>Fight (new seed)</button>
      </div>
    </div>
  );
}

/** Tiny 3×3 diagram of a weapon pattern aimed north. */
function PatternGlyph({ pattern }: { pattern: string }) {
  const hit: Record<string, number[]> = {
    cardinal: [1],
    pairCw: [1, 2],
    line2: [1, -1],
    arc5: [0, 1, 2, 3, 5],
    adjacent: [1],
    ranged: [],
  };
  const cells = hit[pattern] ?? [];
  return (
    <div className={`pattern ${pattern === 'line2' ? 'tall' : ''}`}>
      {pattern === 'line2' && (
        <div className="prow">
          <i />
          <i className="hit" />
          <i />
        </div>
      )}
      <div className="prow">
        {[0, 1, 2].map((i) => (
          <i key={i} className={cells.includes(i) ? 'hit' : ''} />
        ))}
      </div>
      <div className="prow">
        <i className={cells.includes(3) ? 'hit' : ''} />
        <i className="me" />
        <i className={cells.includes(5) ? 'hit' : ''} />
      </div>
    </div>
  );
}

export function report(b: BattleState, shareLink: string): string {
  const enc = encounterById(b.encounterId);
  const jubal = b.units.find((u) => u.id === 'jubal');
  const diff = diffFromDefaults(b.config);
  const rows = b.units
    .filter((u) => u.side === 'player')
    .map((u) => {
      const t = b.telemetry[u.id]!;
      return `| ${u.name} | ${u.ko ? 'down' : `${u.hp}/${u.maxHp}`} | ${t.turns} | ${Math.round(t.moveAp)} | ${Math.round(t.actionAp)} | ${Math.round(t.waitAp)} | ${t.damageDealt} | ${t.damageTaken} | ${t.escapes} | ${t.caught} | ${t.disengageFails}/${t.disengageAttempts} |`;
    });
  return [
    `## ${enc.name}: ${b.outcome.toUpperCase()} at ${Math.round(b.clock)} AP`,
    `Jubal: ${WEAPONS[jubal?.weaponId ?? '']?.name ?? '?'} + ${ARMOR[jubal?.armorClass ?? 'light'].name} · seed ${b.seed}`,
    '',
    '| Unit | HP | Turns | Move AP | Action AP | Wait AP | Dealt | Taken | Escaped | Caught | Held/tries |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
    ...rows,
    '',
    Object.keys(diff).length ? `Changed settings: ${Object.entries(diff).map(([k, v]) => `${k}=${String(v)}`).join(', ')}` : 'Settings: all defaults',
    `Replay this exact fight: ${shareLink}`,
    '',
    'Notes:',
  ].join('\n');
}

export function ResultOverlay() {
  const battle = useGame((s) => s.battle);
  const busy = useGame((s) => s.busy);
  const [dismissed, setDismissed] = useState<number | null>(null);
  if (!battle || battle.outcome === 'ongoing' || busy || dismissed === battle.seed + battle.clock) return null;
  const win = battle.outcome === 'victory';
  const party = battle.units.filter((u) => u.side === 'player');
  return (
    <div className="overlay" data-testid="result">
      <div className={`result ${win ? 'win' : 'loss'}`}>
        <h2>{win ? 'Victory' : 'Defeat'}</h2>
        <p className="muted">Fight length {Math.round(battle.clock)} AP</p>
        <table>
          <thead>
            <tr>
              <th>Unit</th>
              <th>Turns</th>
              <th>Dealt</th>
              <th>Taken</th>
              <th>Moving / acting AP</th>
              <th>Escaped / caught</th>
            </tr>
          </thead>
          <tbody>
            {party.map((u) => {
              const t = battle.telemetry[u.id]!;
              return (
                <tr key={u.id}>
                  <td>{u.name}{u.ko ? ' ✖' : ''}</td>
                  <td>{t.turns}</td>
                  <td>{t.damageDealt}</td>
                  <td>{t.damageTaken}</td>
                  <td>{Math.round(t.moveAp)} / {Math.round(t.actionAp)}</td>
                  <td>{t.escapes} / {t.caught}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="btn-row">
          <button className="primary" onClick={() => controller.restart(false)}>Retry (same seed)</button>
          <button onClick={() => controller.restart(true)}>New seed</button>
          <button onClick={() => controller.openSetup(battle.encounterId)}>Change loadout</button>
          <button onClick={() => controller.openMenu()}>Encounters</button>
        </div>
        <div className="btn-row">
          <button
            onClick={() => {
              void navigator.clipboard.writeText(report(battle, controller.shareLink())).then(() => showToast('Report copied: paste it to Brendan'));
            }}
            data-testid="copy-report"
          >
            Copy report
          </button>
          <button onClick={() => setDismissed(battle.seed + battle.clock)}>Look at the board</button>
        </div>
      </div>
    </div>
  );
}

const STATUS_LABEL = { source: "Aaron's rule", tentative: 'Tentative math', demo: 'Demo default' } as const;

export function SettingsDrawer() {
  const open = useGame((s) => s.settingsOpen);
  const config = useGame((s) => s.config);
  const hasBattle = useGame((s) => !!s.battle);
  const [draft, setDraft] = useState<RulesConfig | null>(null);
  if (!open) return null;
  const cfg = draft ?? config;
  const groups = [...new Set(SETTINGS.map((s) => s.group))];
  const set = (k: keyof RulesConfig, v: unknown) => setDraft({ ...cfg, [k]: v } as RulesConfig);
  const close = () => {
    setDraft(null);
    store.setState({ settingsOpen: false });
  };
  const changed = Object.keys(diffFromDefaults(cfg)).length;
  return (
    <div className="drawer-wrap" onClick={close}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()} data-testid="settings">
        <div className="drawer-head">
          <h2>Rules & settings</h2>
          <button onClick={close}>✕</button>
        </div>
        <p className="muted">
          Every rule the design docs leave open is a setting here. Badges show where each value comes from. Change anything, then copy the link: it
          carries your settings, so Aaron can send back the version he likes.
        </p>
        <div className="drawer-actions">
          <button
            className="primary"
            onClick={() => {
              controller.applyConfig(cfg, hasBattle);
              setDraft(null);
              store.setState({ settingsOpen: false });
            }}
            data-testid="apply-settings"
          >
            {hasBattle ? 'Apply & restart fight' : 'Apply'}
          </button>
          <button onClick={() => setDraft({ ...DEFAULT_CONFIG })}>Reset to defaults</button>
          <button
            onClick={() => {
              controller.applyConfig(cfg, false);
              void navigator.clipboard.writeText(controller.shareLink()).then(() => showToast('Share link copied'));
            }}
          >
            Copy share link
          </button>
          <span className="muted">{changed} changed</span>
        </div>
        {groups.map((g) => (
          <section key={g}>
            <h3>{g}</h3>
            {SETTINGS.filter((s) => s.group === g).map((s) => (
              <SettingRow key={s.key} def={s} value={cfg[s.key]} onChange={(v) => set(s.key, v)} changed={cfg[s.key] !== DEFAULT_CONFIG[s.key]} />
            ))}
          </section>
        ))}
      </aside>
    </div>
  );
}

function SettingRow({ def, value, onChange, changed }: { def: SettingDef; value: unknown; onChange: (v: unknown) => void; changed: boolean }) {
  const fmt = (n: number) => (def.type === 'number' && def.unit === '%' ? `${Math.round(n * 100)}%` : def.type === 'number' && def.unit === 'x' ? `×${n}` : `${n}${def.type === 'number' && def.unit === 'AP' ? ' AP' : ''}`);
  return (
    <div className={`setting ${changed ? 'changed' : ''}`} data-testid={`setting-${def.key}`}>
      <div className="setting-top">
        <label>{def.label}</label>
        <span className={`badge ${def.status}`}>{STATUS_LABEL[def.status]}</span>
      </div>
      <div className="setting-control">
        {def.type === 'boolean' && <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />}
        {def.type === 'number' && (
          <>
            <input type="range" min={def.min} max={def.max} step={def.step} value={Number(value)} onChange={(e) => onChange(Number(e.target.value))} />
            <span className="setting-val">{fmt(Number(value))}</span>
          </>
        )}
        {def.type === 'select' && (
          <select value={String(value)} onChange={(e) => onChange(e.target.value)}>
            {def.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="setting-why">{def.why}</div>
    </div>
  );
}

export function HelpOverlay() {
  const open = useGame((s) => s.helpOpen);
  if (!open) return null;
  return (
    <div className="overlay" onClick={() => store.setState({ helpOpen: false })}>
      <div className="help" onClick={(e) => e.stopPropagation()} data-testid="help">
        <h2>How to play</h2>
        <ul>
          <li><b>The timeline is the game.</b> Every action costs AP. When you end your turn, your icon moves that many AP to the right. Whoever reaches 0 next acts next.</li>
          <li><b>Move, act, move.</b> You get up to 50 AP of movement per turn (5 / 4 / 3 tiles in light / medium / heavy) and one action, in any order.</li>
          <li><b>The ghost icon</b> on the timeline shows where your next turn lands for whatever you're hovering. Red: something lands on you first. Amber: the Nephilim could sweep you first.</li>
          <li><b>Weapons hit shapes.</b> Aim at a tile; everything in the pattern gets hit. Two-handed side tiles are less accurate.</li>
          <li><b>Engagement.</b> Walking away from an adjacent melee enemy can get you held: you move one tile and stop, and they may get a free swing. The path preview shows the odds.</li>
          <li><b>Flanked.</b> Enemies on opposite sides (N/S or E/W) strip your engagement, halve your reactions and make you take +25% damage. It works on them too.</li>
          <li><b>Telegraphs.</b> Red tiles land after a delay. If your next turn comes before impact, you can walk out. If not, you're caught.</li>
          <li><b>Wait</b> costs 25 AP: a cheap way to slip behind an enemy's turn.</li>
        </ul>
        <p className="muted">Keys: M move · A attack · 1–2 skills · Space end turn · Esc / right-click cancel.</p>
        <button className="primary" onClick={() => store.setState({ helpOpen: false })}>Got it</button>
      </div>
    </div>
  );
}

export function Toast() {
  const toast = useGame((s) => s.toast);
  if (!toast) return null;
  return <div className="toast" data-testid="toast">{toast.text}</div>;
}

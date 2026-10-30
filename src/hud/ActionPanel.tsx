import { UNITS } from '../content/units';
import { Provenance } from './Guidance';
import { Pattern } from './WeaponDetails';
import { ARMOR, SKILLS, WEAPONS } from '../content/gear';
import { basicAttackApCost, movementLeft, previewAttack } from '../rules/queries';
import { combatActionReason, attackModes } from '../rules/equipment';
import { WeaponControls } from './WeaponControls';
import { unitById } from '../rules/state';
import type { BattleState, UnitState } from '../rules/types';
import { controller } from '../game/controller';
import { activePlayer, endTurnPreview, pendingFor } from '../game/preview';
import { ap, pct, useGame, useTouchUI } from './hooks';

import { PATTERN_TEXT, selectedWeaponMode } from '../game/weapon-summary';

export function UnitCard({ unit, battle, compact = false }: { unit: UnitState; battle: BattleState; compact?: boolean }) {
  const selection = useGame(s => s.mode);
  const selected = selectedWeaponMode(battle, unit, selection);
  const weapon = WEAPONS[unit.weaponId];
  const nextIn = battle.active?.unitId === unit.id ? 0 : unit.nextTurnAt - battle.clock;
  return (
    <div className={`unit-card ${unit.side}`} data-testid={`card-${unit.id}`}>
      <div className="uc-head">
        <span className="uc-glyph">{unit.glyph}</span>
        <div>
          <div className="uc-name">{unit.name}{unit.ko ? ' (down)' : ''}</div>
          <div className="uc-role">{unit.role}</div>
        </div>
      </div>
      <div className="uc-hp">
        <div className="uc-hp-bar" style={{ width: `${(unit.hp / unit.maxHp) * 100}%` }} />
        <span>{unit.hp} / {unit.maxHp} HP</span>
      </div>
      {!compact && (
        <div className="uc-stats">
          <span title="Armor reduces physical damage: ×100/(100+Armor)">Armor {unit.armor}</span>
          <span title="Magic Resist reduces magical damage">MR {unit.mr}</span>
          <span title="Movement AP per tile">{ap(unit.moveApPerTile)} AP/tile</span>
          <span>Dodge {pct(unit.dodge)}</span>
          {unit.parry > 0 && <span>Parry {pct(unit.parry)}</span>}
          {unit.block > 0 && <span>Block {pct(unit.block)}</span>}
          <span title="Engagement: how well this unit pins adjacent enemies">Eng {unit.canEngage && !unit.attack.ranged ? unit.engagement : '—'}</span>
          <span title="Disengagement: how well this unit slips away">Dis {unit.disengagement}</span>
          {!unit.ko && <span>Acts in {Math.round(nextIn)} AP</span>}
        </div>
      )}
      <Provenance value={UNITS[unit.templateId] ?? unit} label="Unit" />
      <Provenance value={ARMOR[unit.armorClass]} label="Armor" />
      <div className="uc-weapon">
        <b>{weapon?.name ?? unit.attack.name} · {selected.name}</b> · {basicAttackApCost(battle, unit, selected.id)} AP · {PATTERN_TEXT[selected.pattern]}
        {selected.range && ` · range ${selected.range[0]}–${selected.range[1]}`} · {Math.round(selected.damage)} dmg · {pct(selected.hit)} hit
        {!compact && <Pattern mode={selected} />}
      </div>
      {unit.skills.length > 0 && (
        <div className="uc-skills">
          {unit.skills.map((s) => {
            const def = SKILLS[s.id];
            if (!def) return null;
            const ready = s.readyAt <= battle.clock;
            return (
              <span key={s.id} className={ready ? 'ready' : 'cooling'} title={def.description}>
                {def.name}: {ready ? 'ready' : `in ${Math.round(s.readyAt - battle.clock)} AP`}
              </span>
            );
          })}
        </div>
      )}
      {(unit.dazed || unit.feared) && <div className="uc-status">{unit.dazed ? 'DAZED: no reactions until its turn ends' : 'FEARED: will flee next turn'}</div>}
    </div>
  );
}

export function ActionPanel() {
  const battle = useGame((s) => s.battle);
  const mode = useGame((s) => s.mode);
  const busy = useGame((s) => s.busy);
  const bot = useGame((s) => s.botParty);
  const hoverUnitId = useGame((s) => s.hoverUnitId);
  const hoverTile = useGame(s => s.hoverTile);
  const actionHover = useGame(s => s.actionHover);
  const touch = useTouchUI();
  if (!battle) return null;
  const u = activePlayer(battle);
  const a = battle.active;
  const acting = a ? unitById(battle, a.unitId) : null;
  const hovered = hoverUnitId ? battle.units.find((x) => x.id === hoverUnitId) : null;
  const end = u ? endTurnPreview(battle) : null;
  const attackMode = u ? attackModes(battle,u).find(m => m.id === (mode.kind === 'attack' ? mode.modeId : undefined)) ?? attackModes(battle,u)[0] : null;
  const attackReason = u ? combatActionReason(battle,u,'attack',attackMode?.ammo === 'bolt') : null;
  const preview = u && hoverTile && mode.kind === 'attack' ? previewAttack(battle,u,hoverTile,u.pos,mode.modeId) : null;
  const pending = pendingFor({ battle, hoverTile, mode, busy, actionHover });
  const commitWarn = pending && pending.danger !== 'none' ? pending : null;
  const spent = a ? a.moveSpent + a.actionSpent + a.reactionSpent : 0;

  return (
    <aside className="panel left">
      {u && a && !bot ? (
        <div className="turn-box" data-testid="turn-box">
          <div className="turn-title">{u.name}'s turn</div>
          <div className="turn-ap">
            <span>Spent <b>{ap(spent)}</b> AP</span>
            <span>Movement left <b>{ap(movementLeft(battle, u))}</b> AP</span>
          </div>
          <div className="commit-warn-slot" role="status" aria-live="polite" data-testid="commit-warn-slot">
            {commitWarn && (
              <div className={`commit-warn ${commitWarn.danger}`} data-testid="commit-warn">
                {commitWarn.verdict?.text ?? commitWarn.dangerText}
                <span className="commit-warn-cost">{commitWarn.what}, {ap(commitWarn.extra)} AP</span>
              </div>
            )}
          </div>
          <div className="btn-row">
            <button className={mode.kind === 'move' ? 'on' : ''} onClick={() => controller.setMode({ kind: 'move' })} disabled={busy || a.movementLocked} title="M">
              Move <kbd>M</kbd>
            </button>
            <button className={mode.kind === 'attack' ? 'on' : ''} onClick={() => controller.setMode({ kind: 'attack' })} disabled={busy || !!attackReason} title={attackReason ?? 'A'}>
              Attack · {basicAttackApCost(battle, u, mode.kind === 'attack' ? mode.modeId : undefined)} <kbd>A</kbd>
            </button>
          </div>
          <WeaponControls battle={battle} unit={u} busy={busy} mode={mode} />
          {preview && <div data-testid="attack-preview" className="hint">Selected attack: {preview.apCost} AP{preview.cycleAp !== preview.apCost && ` · ${preview.cycleAp} AP including reload`}<div>{preview.note}</div>{preview.candidates?.map(c => <div key={c.unitId}>{unitById(battle,c.unitId).name}: {pct(c.probability)} selection · one random</div>)}</div>}
          <button className={`end-turn ${end?.danger ?? ''}`} onClick={() => void controller.endTurn()} disabled={busy} data-testid="end-turn" title={end?.text || 'End your turn'}>
            {spent === 0 ? 'Wait' : 'End turn'} → next in {Math.round(end?.projected ?? 0)} AP <kbd>Space</kbd>
            {end?.danger === 'hit' && <div className="warn">No escape if you stop here</div>}
            {end?.danger === 'risk' && <div className="warn">Escape risk, check the timeline</div>}
          </button>
          <div className="hint">{mode.kind === 'move'
            ? (touch ? 'Tap a blue tile or an enemy to preview it, then tap it again to commit. Swap and Reload preview on the first tap too.' : 'Click a blue tile to move, or an enemy to attack it. Right-click cancels.')
            : mode.kind === 'attack'
              ? (u.attack.pattern === 'dualArc' ? 'Solid = primary. Dashed = one random surviving enemy; the primary can be picked again.' : touch ? 'Tap a tile to aim and preview, then tap it again to commit. Sweep can target yourself.' : 'Click a tile to aim; T cycles attack modes. Sweep can target yourself.')
              : (touch ? 'Tap a highlighted target to preview, then tap it again to commit. Tap the skill again to cancel.' : 'Click a highlighted target. Click the skill again, press Esc or right-click to cancel.')}</div>
        </div>
      ) : (
        <div className="turn-box waiting">{battle.outcome !== 'ongoing' ? 'Battle over' : acting ? `${acting.name} is acting…` : '…'}</div>
      )}
      {u && <UnitCard unit={u} battle={battle} />}
      {hovered && hovered.id !== u?.id && (
        <>
          <div className="section-title">Inspecting</div>
          <UnitCard unit={hovered} battle={battle} />
        </>
      )}
    </aside>
  );
}

export function armorLabel(id: keyof typeof ARMOR) {
  return ARMOR[id].name;
}

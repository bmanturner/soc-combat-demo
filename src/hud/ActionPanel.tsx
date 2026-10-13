import { ARMOR, SKILLS, WEAPONS } from '../content/gear';
import { movementLeft, skillCost } from '../rules/queries';
import { unitById } from '../rules/state';
import type { BattleState, UnitState } from '../rules/types';
import { controller } from '../game/controller';
import { activePlayer, endTurnPreview } from '../game/preview';
import { ap, pct, useGame } from './hooks';

const PATTERN_TEXT: Record<string, string> = {
  cardinal: 'One tile N/E/S/W',
  pairCw: 'Target + next tile clockwise',
  line2: 'Two tiles in a straight line',
  arc5: 'Target + two tiles each side',
  adjacent: 'Any one adjacent tile',
  ranged: 'Ranged single target',
};

export function UnitCard({ unit, battle, compact = false }: { unit: UnitState; battle: BattleState; compact?: boolean }) {
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
      <div className="uc-weapon">
        <b>{weapon?.name ?? unit.attack.name}</b> · {unit.attack.apCost} AP{unit.attack.stationaryDiscount ? ` (+${battle.config.bowMoveSurcharge} if moved)` : ''} · {PATTERN_TEXT[unit.attack.pattern]}
        {unit.attack.range && ` ${unit.attack.range[0]}–${unit.attack.range[1]}`} · {Math.round(unit.attack.damage)} dmg · {pct(unit.attack.hit)} hit
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
  if (!battle) return null;
  const u = activePlayer(battle);
  const a = battle.active;
  const acting = a ? unitById(battle, a.unitId) : null;
  const hovered = hoverUnitId ? battle.units.find((x) => x.id === hoverUnitId) : null;
  const end = u ? endTurnPreview(battle) : null;
  const spent = a ? a.moveSpent + a.actionSpent + a.reactionSpent : 0;

  return (
    <aside className="panel left">
      {u && a && !bot ? (
        <div className="turn-box" data-testid="turn-box">
          <div className="turn-title">{u.name}'s turn</div>
          <div className="turn-ap">
            <span>Spent <b>{ap(spent)}</b> AP</span>
            <span>Move left <b>{ap(movementLeft(battle, u))}</b> AP</span>
          </div>
          <div className="btn-row">
            <button className={mode.kind === 'move' ? 'on' : ''} onClick={() => controller.setMode({ kind: 'move' })} disabled={busy || a.movementLocked} title="M">
              Move <kbd>M</kbd>
            </button>
            <button className={mode.kind === 'attack' ? 'on' : ''} onClick={() => controller.setMode({ kind: 'attack' })} disabled={busy || a.acted} title="A">
              Attack · {u.attack.stationaryDiscount && a.moved ? u.attack.apCost + battle.config.bowMoveSurcharge : u.attack.apCost} <kbd>A</kbd>
            </button>
          </div>
          <div className="btn-row">
            {u.skills.map((s, i) => {
              const def = SKILLS[s.id];
              if (!def) return null;
              const ready = s.readyAt <= battle.clock;
              const on = mode.kind === 'skill' && mode.skillId === s.id;
              return (
                <button key={s.id} className={on ? 'on' : ''} disabled={busy || a.acted || !ready} onClick={() => controller.setMode({ kind: 'skill', skillId: s.id })} title={`${def.description}${def.status === 'demo' ? ' [demo placeholder skill]' : ''}`}>
                  {def.name} · {skillCost(battle, u, def)}
                  {!ready && <small> ({Math.round(s.readyAt - battle.clock)})</small>} <kbd>{i + 1}</kbd>
                </button>
              );
            })}
          </div>
          <button className={`end-turn ${end?.danger ?? ''}`} onClick={() => void controller.endTurn()} disabled={busy} data-testid="end-turn" title={end?.text || 'End your turn'}>
            {spent === 0 ? 'Wait' : 'End turn'} → next in {Math.round(end?.projected ?? 0)} AP <kbd>Space</kbd>
            {end?.danger === 'hit' && <div className="warn">⚠ You'll be hit before you act</div>}
            {end?.danger === 'risk' && <div className="warn">⚠ In the sweep zone when he acts</div>}
          </button>
          <div className="hint">{mode.kind === 'move' ? 'Click a blue tile to move, or an enemy to attack it. Right-click cancels.' : mode.kind === 'attack' ? 'Click a tile to aim. Patterns hit every enemy in them.' : 'Click a highlighted target.'}</div>
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

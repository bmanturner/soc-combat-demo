import { SKILLS, WEAPONS } from "../content/gear";
import {
  attackModes,
  availableSkills,
  equippedWeapon,
  skillUseReason,
} from "../rules/equipment";
import {
  basicAttackApCost,
  previewReload,
  previewSwap,
  skillCost,
} from "../rules/queries";
import type { BattleState, UnitState } from "../rules/types";
import { controller } from "../game/controller";
import { store, type Mode } from "../game/store";

export function WeaponControls({
  battle: b,
  unit: u,
  busy,
  mode,
}: {
  battle: BattleState;
  unit: UnitState;
  busy: boolean;
  mode: Mode;
}) {
  const w = equippedWeapon(b, u),
    modes = attackModes(b, u);
  const reload = previewReload(b, u),
    swap = previewSwap(b, u, u.equippedSlot === 0 ? 1 : 0);
  const skills = availableSkills(b, u);
  const rows = [...skills.map((s) => s.id)];
  if (
    u.templateId === "jubal" &&
    w.proficiencySkill &&
    !rows.includes(w.proficiencySkill)
  )
    rows.push(w.proficiencySkill);
  return (
    <div className="weapon-controls">
      <div data-testid="weapon-slots">
        {u.carried.map((item, i) => (
          <div key={i}>
            <b>{i === u.equippedSlot ? "Equipped" : "Reserve"}:</b>{" "}
            {item ? WEAPONS[item.defId]?.name : "None"}{" "}
            {item && WEAPONS[item.defId]?.reloadAp && (
              <strong>{item.loaded ? "Loaded" : "Unloaded"}</strong>
            )}
          </div>
        ))}
      </div>
      {modes.length > 1 && (
        <div className="btn-row" aria-label="Attack modes">
          {modes.map((m) => (
            <button
              key={m.id}
              data-testid={`mode-${m.id}`}
              className={
                mode.kind === "attack" && (mode.modeId ?? modes[0]!.id) === m.id
                  ? "on"
                  : ""
              }
              disabled={busy || b.active?.acted}
              onMouseEnter={() => {
                controller.setMode({ kind: "attack", modeId: m.id });
                if (m.id === "sweep") controller.hover(u.pos);
              }}
              onClick={() => {
                controller.setMode({ kind: "attack", modeId: m.id });
                if (m.id === "sweep") void controller.clickTile(u.pos);
              }}
            >
              {m.name} · {basicAttackApCost(b, u, m.id)} AP
            </button>
          ))}
        </div>
      )}
      {w.reloadAp && (
        <div
          onMouseEnter={() => store.setState({ actionHover: "reload" })}
          onMouseLeave={() => store.setState({ actionHover: null })}
        >
          <button
            data-testid="reload"
            disabled={busy || !reload.valid}
            title={reload.reason ?? "Reload crossbow"}
            onClick={() => void controller.reload()}
          >
            Reload · {reload.apCost} AP <kbd>R</kbd>
          </button>
          {!reload.valid && <small>{reload.reason}</small>}
        </div>
      )}
      <div
        onMouseEnter={() => store.setState({ actionHover: "swap" })}
        onMouseLeave={() => store.setState({ actionHover: null })}
      >
        <button
          data-testid="swap"
          disabled={busy || !swap.valid}
          title={swap.reason ?? "Swap weapons"}
          onClick={() => void controller.swapWeapon()}
        >
          Swap · {swap.apCost} AP <kbd>W</kbd>
        </button>
        <small>
          {swap.reason ?? "Counts as your action; new weapon usable next turn."}
        </small>
      </div>
      <div className="skill-rows">
        {rows.map((id, i) => {
          const def = SKILLS[id]!;
          const owned = skills.some((s) => s.id === id);
          const reason = owned
            ? skillUseReason(b, u, id)
            : "Requires Soldier / Savage / Rogue weapon proficiency";
          return (
            <div key={id}>
              <button
                disabled={busy || !!reason}
                onClick={() =>
                  controller.setMode({ kind: "skill", skillId: id })
                }
                title={`${def.description} · Concept: ${def.provenance.concept}; numbers: ${def.provenance.numbers}`}
                className={
                  mode.kind === "skill" && mode.skillId === id ? "on" : ""
                }
              >
                {def.name} · {skillCost(b, u, def)} AP <kbd>{i + 1}</kbd>
              </button>
              <small>
                {id === w.proficiencySkill
                  ? "Proficiency"
                  : id === w.basicSkill
                    ? "Basic"
                    : "Personal"}
                {reason && ` · ${reason}`}
              </small>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { SKILLS } from "../content/gear";
import { scaledMode } from "../rules/equipment";
import type { RulesConfig } from "../rules/config";
import type { AttackMode, WeaponDef } from "../rules/types";

function Pattern({ mode }: { mode: AttackMode }) {
  const ring = [
    [-1, -1],
    [0, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
  ];
  const cells =
    mode.pattern === "ring8"
      ? ring
      : mode.pattern === "arc5"
        ? ring.slice(0, 5)
        : mode.pattern === "line2"
          ? [
              [0, -1],
              [0, -2],
            ]
          : mode.pattern === "pairCw"
            ? [
                [0, -1],
                [1, -1],
              ]
            : [[0, -1]];
  const ranged = mode.range;
  return (
    <svg
      width="160"
      height="72"
      viewBox={`0 0 ${Math.max(130, 22 + (ranged?.[1] ?? 0) * 14)} 65`}
      role="img"
      aria-label={`${mode.name}: ${mode.pattern}${ranged ? ` range ${ranged.join("–")}` : ""}`}
    >
      {ranged ? (
        <>
          {Array.from({ length: ranged[1] }, (_, i) => (
            <rect
              key={i}
              x={22 + i * 14}
              y="25"
              width="11"
              height="11"
              fill={i + 1 >= ranged[0] ? "#ffb347" : "#334155"}
            />
          ))}
          <rect x="5" y="25" width="11" height="11" fill="#73baff" />
        </>
      ) : (
        <>
          <rect x="57" y="35" width="11" height="11" fill="#73baff" />
          {cells.map(([x, y], i) => (
            <rect
              key={i}
              x={57 + x! * 14}
              y={35 + y! * 14}
              width="11"
              height="11"
              fill="#ffb347"
            />
          ))}
          {mode.pattern === "dualArc" &&
            ring
              .slice(0, 5)
              .map(([x, y], i) => (
                <rect
                  key={i}
                  x={57 + x! * 14}
                  y={35 + y! * 14}
                  width="11"
                  height="11"
                  fill="none"
                  stroke="#ffb347"
                  strokeDasharray="2 2"
                />
              ))}
        </>
      )}
    </svg>
  );
}
export function WeaponDetails({
  weapon: w,
  config,
  level,
}: {
  weapon: WeaponDef;
  config: RulesConfig;
  level: number;
}) {
  return (
    <>
      {w.modes.map((raw) => {
        const m = scaledMode(
          config,
          { side: "player", level, templateId: "jubal" },
          w,
          raw,
        );
        return (
          <div key={m.id} className="weapon-mode">
            <b>{m.name}</b>
            <Pattern mode={m} />
            <div>
              {m.apCost} AP · {Math.round(m.damage)} dmg ·{" "}
              {Math.round(m.hit * 100)}% hit
              {m.range && ` · range ${m.range.join("–")}`}
            </div>
            {m.pattern === "dualArc" && (
              <small>Solid primary + dashed arc: one random secondary</small>
            )}
          </div>
        );
      })}
      {[w.basicSkill, w.proficiencySkill].map(
        (id, i) =>
          id && (
            <div className="choice-blurb" key={id}>
              <b>{SKILLS[id]!.name}</b> · {i ? "proficiency" : "basic"} ·{" "}
              {SKILLS[id]!.apCost} AP · ×{SKILLS[id]!.damageMult} damage
              <br />
              {SKILLS[id]!.description}
              {i === 1 && !config.proficientAllWeapons && (
                <small>
                  Locked: requires Soldier / Savage / Rogue weapon proficiency.
                </small>
              )}
              <small>
                Concept: {SKILLS[id]!.provenance.concept} · numbers:{" "}
                {SKILLS[id]!.provenance.numbers}
              </small>
            </div>
          ),
      )}
      <small title={w.provenance.why}>
        Concept: {w.provenance.concept} · numbers: {w.provenance.numbers}
      </small>
    </>
  );
}

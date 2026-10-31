// Per-fight feedback for Aaron: a JSON summary for analysis and a Markdown report to paste. Pure; reads only the battle.
import { encounterById } from '../content/encounters';
import { ARMOR, WEAPONS } from '../content/gear';
import { diffFromDefaults, type RulesConfig } from '../rules/config';
import { caughtWhy, formatAp, unitName } from '../rules/describe';
import type { ArmorClass, BattleState, CaughtReason, DelayedEffect, Outcome, ReactionResult, UnitTelemetry } from '../rules/types';
import { battleShareUrl } from './share';

export const FIGHT_SUMMARY_SCHEMA = 'soc-fight-summary/1';

export interface TelegraphRecord {
  name: string;
  sourceId: string;
  castAt: number;
  resolveAt: number;
  /** Units inside the area when it was cast. */
  threatened: string[];
  escaped: string[];
  caught: { unitId: string; reason: CaughtReason; damage: number; nextTurnAt: number; previewSafe?: boolean }[];
  avoided: { unitId: string; by: ReactionResult['kind'] }[];
}

type PartyTotals = Pick<UnitTelemetry,
  'turns' | 'turnsAllIn' | 'turnsActedWithMoveLeft' | 'turnsNoAction' | 'moveLeftAp' | 'moveAp' | 'actionAp' | 'waitAp' | 'reactionAp' | 'dazedAp'
  | 'damageDealt' | 'damageTaken' | 'escapes' | 'caught' | 'caughtAfterSafePreview'> & { downed: number };

export interface FightSummary {
  schema: typeof FIGHT_SUMMARY_SCHEMA;
  encounter: { id: string; name: string };
  outcome: Outcome;
  /** Fight length on the AP timeline. */
  endedAt: number;
  seed: number;
  setup: { weaponIds: [string, string | null]; weapons: string[]; startingSlot: 0 | 1; armor: ArmorClass };
  changedSettings: Partial<RulesConfig>;
  shareUrl: string;
  party: PartyTotals;
  units: { id: string; name: string; side: 'player' | 'enemy'; templateId: string; hp: number; maxHp: number; telemetry: UnitTelemetry }[];
  telegraphs: TelegraphRecord[];
}

const TOTAL_KEYS = ['turns', 'turnsAllIn', 'turnsActedWithMoveLeft', 'turnsNoAction', 'moveLeftAp', 'moveAp', 'actionAp', 'waitAp', 'reactionAp', 'dazedAp', 'damageDealt', 'damageTaken', 'escapes', 'caught', 'caughtAfterSafePreview'] as const;

/** Every delayed effect that has landed, matched to its cast by effect id. */
function telegraphs(b: BattleState): TelegraphRecord[] {
  const casts = new Map<string, DelayedEffect>();
  const out: TelegraphRecord[] = [];
  for (const e of b.log) {
    if (e.t === 'effectCast') casts.set(e.effect.id, e.effect);
    if (e.t !== 'effectResolve') continue;
    const cast = casts.get(e.effectId);
    out.push({
      name: e.name,
      sourceId: cast?.sourceId ?? '',
      castAt: cast?.castAt ?? e.at,
      resolveAt: e.at,
      threatened: cast?.threatenedAtCast ?? [],
      escaped: e.escaped,
      caught: e.hits.flatMap((h) => h.caught ? [{ unitId: h.unitId, reason: h.caught.reason, damage: h.damage, nextTurnAt: h.caught.nextTurnAt, ...(h.caught.previewSafe !== undefined && { previewSafe: h.caught.previewSafe }) }] : []),
      avoided: e.hits.flatMap((h) => h.avoided ? [{ unitId: h.unitId, by: h.avoided }] : []),
    });
  }
  return out;
}

export function fightSummary(b: BattleState): FightSummary {
  const party = b.units.filter((u) => u.side === 'player');
  const totals = Object.fromEntries(TOTAL_KEYS.map((k) => [k, party.reduce((s, u) => s + b.telemetry[u.id]![k], 0)])) as Omit<PartyTotals, 'downed'>;
  return {
    schema: FIGHT_SUMMARY_SCHEMA,
    encounter: { id: b.encounterId, name: encounterById(b.encounterId).name },
    outcome: b.outcome,
    endedAt: b.clock,
    seed: b.seed,
    setup: { weaponIds: b.setup.weaponIds, weapons: b.setup.weaponIds.flatMap((id) => id ? [WEAPONS[id]?.name ?? id] : []), startingSlot: b.setup.equippedSlot, armor: b.setup.armor },
    changedSettings: diffFromDefaults(b.config),
    shareUrl: battleShareUrl(b),
    party: { ...totals, downed: party.filter((u) => b.telemetry[u.id]!.downed).length },
    units: b.units.map((u) => ({ id: u.id, name: u.name, side: u.side, templateId: u.templateId, hp: u.hp, maxHp: u.maxHp, telemetry: b.telemetry[u.id]! })),
    telegraphs: telegraphs(b),
  };
}

const avg = (sum: number, n: number) => n ? formatAp(sum / n) : '0';

export function fightReport(b: BattleState): string {
  const s = fightSummary(b);
  const party = s.units.filter((u) => u.side === 'player');
  const partyIds = new Set(party.map((u) => u.id));
  const jubal = b.units.find((u) => u.id === 'jubal');
  const name = (id: string) => unitName(b, id);
  const unitRows = party.map(({ name: n, hp, maxHp, telemetry: t }) =>
    `| ${n} | ${t.downed ? 'down' : `${hp}/${maxHp}`} | ${t.turns} | ${t.turnsAllIn} / ${t.turnsActedWithMoveLeft} / ${t.turnsNoAction} | ${Math.round(t.moveAp)} | ${Math.round(t.actionAp)} | ${Math.round(t.waitAp)} | ${Math.round(t.reactionAp + t.dazedAp)} | ${t.damageDealt} | ${t.damageTaken} | ${t.escapes} | ${t.caught} | ${t.disengageFails}/${t.disengageAttempts} |`);
  const attackRows = party.flatMap(({ name: n, telemetry: t }) => Object.entries(t.patterns).map(([label, p]) =>
    `| ${n} | ${label}${p.weaponId && WEAPONS[p.weaponId] ? ` (${WEAPONS[p.weaponId]!.name})` : ''} | ${p.uses} | ${avg(p.enemiesTargeted, p.uses)} | ${p.multiTargetUses} | ${avg(p.enemiesDamaged, p.uses)} | ${p.multiHitUses} | ${p.alliesTargeted} | ${p.damage} |`));
  const telegraphLines = s.telegraphs
    .filter((t) => [...t.threatened, ...t.escaped, ...t.caught.map((c) => c.unitId), ...t.avoided.map((a) => a.unitId)].some((id) => partyIds.has(id)))
    .map((t) => {
      const parts = [
        ...t.escaped.filter((id) => partyIds.has(id)).map((id) => `${name(id)} escaped`),
        ...t.avoided.filter((a) => partyIds.has(a.unitId)).map((a) => `${name(a.unitId)} avoided it (${a.by})`),
        ...t.caught.filter((c) => partyIds.has(c.unitId)).map((c) => `${name(c.unitId)} caught for ${c.damage}: ${caughtWhy(c.reason, c.nextTurnAt, t.resolveAt)}${c.previewSafe ? ' (their last end-turn preview said they could still get out)' : ''}`),
      ];
      return `- ${t.name} (${name(t.sourceId)}), cast @${formatAp(t.castAt)}, landed @${formatAp(t.resolveAt)}: ${parts.length ? parts.join('; ') : 'no party member was left in the area'}`;
    });
  const downed = party.filter((u) => u.telemetry.downed).map((u) => `${u.name} @${formatAp(u.telemetry.downed!.at)} by ${u.telemetry.downed!.by}`);
  const p = s.party;
  return [
    `## ${s.encounter.name}: ${s.outcome.toUpperCase()} at ${Math.round(s.endedAt)} AP`,
    `Jubal: ${s.setup.weapons.join(' / ')} + ${ARMOR[jubal?.armorClass ?? 'light'].name} · starting slot ${s.setup.startingSlot + 1} · seed ${s.seed}`,
    ...party.map((u) => `${u.name}: reloads ${u.telemetry.reloads}, swaps ${u.telemetry.swaps}`),
    '',
    '| Unit | HP | Turns | All-in / move left / no action | Move AP | Action AP | Wait AP | Reaction + daze AP | Dealt | Taken | Escaped | Caught | Held/tries |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...unitRows,
    '',
    `Party turns: ${p.turnsAllIn} all-in (acted, no tile of movement left), ${p.turnsActedWithMoveLeft} acted with movement left, ${p.turnsNoAction} without a combat action; ${Math.round(p.moveLeftAp)} AP of movement left unused.`,
    `Downed: ${downed.length ? downed.join('; ') : 'none'}`,
    '',
    '### Attacks',
    ...(attackRows.length
      ? ['| Unit | Attack | Uses | Enemies in pattern (avg) | Multi-target uses | Enemies damaged (avg) | Multi-hit uses | Allies in pattern | Damage |', '|---|---|---|---|---|---|---|---|---|', ...attackRows]
      : ['No attacks.']),
    '',
    '### Telegraphs',
    ...(telegraphLines.length ? telegraphLines : ['No telegraph threatened the party.']),
    ...(p.caughtAfterSafePreview ? [`Caught after a safe end-turn preview: ${p.caughtAfterSafePreview}`] : []),
    '',
    Object.keys(s.changedSettings).length ? `Changed settings: ${Object.entries(s.changedSettings).map(([k, v]) => `${k}=${String(v)}`).join(', ')}` : 'Settings: all defaults',
    `Try the same setup and seed (encounter, loadout and rules; not an action replay): ${s.shareUrl}`,
    '',
    'Notes:',
  ].join('\n');
}

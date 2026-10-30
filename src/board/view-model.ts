// Renderer-neutral board description shared by the 2D (Phaser) and 3D (three.js) boards.
// Pure functions of store state; each renderer only decides how to draw the result.
// Coordinates are tile units: tile (x, y) spans [x, x+1) × [y, y+1); its center is (x + 0.5, y + 0.5).

import { aimDirection, patternTiles } from '../rules/patterns';
import { attackModes } from '../rules/equipment';
import { cheb, eq, key, type Vec } from '../rules/geometry';
import { attackOptions, bossSweepThreat, engagedPairs, pathSafety, previewAttack, previewSkill, reachable, skillOptions, type AttackPreview } from '../rules/queries';
import { alive, isFlanked, lineOfSight, terrainAt, tilesOf, unitById } from '../rules/state';
import type { BattleState, UnitState } from '../rules/types';
import { pendingFor } from '../game/preview';
import type { GameStore } from '../game/store';
import { COLORS } from './palette';

/** A point in tile space. */
export interface Pt {
  x: number;
  y: number;
}

export type FillLayer = 'zone' | 'telegraph' | 'overlay';
export type LineLayer = 'zone' | 'overlay' | 'links';

/** Inset squares over whole tiles. `stroke` adds a border in that color. */
export interface TileFill {
  layer: FillLayer;
  tiles: Vec[];
  color: string;
  alpha: number;
  stroke?: string;
}

export interface Segment {
  layer: LineLayer;
  from: Pt;
  to: Pt;
  color: string;
  alpha: number;
  /** Nominal pixel width at the 2D board's reference tile size. */
  width: number;
}

/** Axis-aligned rectangle outline in tile space. */
export interface Outline {
  layer: LineLayer;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  alpha: number;
  width: number;
  dashed?: boolean;
}

/** Annotation placed in the reserved lane above the board, with a leader to `anchor`. */
export interface Label {
  anchor: Pt;
  text: string;
  color: string;
  /** Font size as a fraction of the tile size. */
  size: number;
  bg?: string;
}

export interface TokenView {
  unit: UnitState;
  active: boolean;
  hovered: boolean;
  badge: string;
}

export interface BoardView {
  tokens: TokenView[];
  fills: TileFill[];
  segments: Segment[];
  outlines: Outline[];
  labels: Label[];
}

export type BoardViewInput = Pick<GameStore, 'battle' | 'hoverTile' | 'hoverUnitId' | 'mode' | 'busy' | 'botParty'>;

/** Reference tile size (px) for converting nominal pixel widths into tile units. */
export const REFERENCE_TILE = 56;

export function tileCenter(p: Vec): Pt {
  return { x: p.x + 0.5, y: p.y + 0.5 };
}

/** Center of a unit's footprint. */
export function unitCenter(u: UnitState, pos: Vec = u.pos): Pt {
  const xs = u.footprint.map((o) => pos.x + o.x);
  const ys = u.footprint.map((o) => pos.y + o.y);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2 + 0.5, y: (Math.min(...ys) + Math.max(...ys)) / 2 + 0.5 };
}

/** Footprint extent in tiles. */
export function footprintSize(u: UnitState): { w: number; h: number } {
  const xs = u.footprint.map((o) => o.x);
  const ys = u.footprint.map((o) => o.y);
  return { w: Math.max(...xs) - Math.min(...xs) + 1, h: Math.max(...ys) - Math.min(...ys) + 1 };
}

export function statusBadge(b: BattleState, u: UnitState): string {
  const tags: string[] = [];
  if (u.dazed) tags.push('DAZED');
  if (u.feared) tags.push('FEARED');
  if (!u.ko && isFlanked(b, u)) tags.push('FLANKED');
  return tags.join(' · ');
}

function bounds(tiles: Vec[]): { x0: number; y0: number; x1: number; y1: number } {
  const xs = tiles.map((p) => p.x);
  const ys = tiles.map((p) => p.y);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

export function boardView(s: BoardViewInput): BoardView {
  const view: BoardView = { tokens: [], fills: [], segments: [], outlines: [], labels: [] };
  const b = s.battle;
  if (!b) return view;
  const fill = (layer: FillLayer, tiles: Vec[], color: string, alpha: number, stroke?: string) => {
    if (tiles.length) view.fills.push({ layer, tiles, color, alpha, ...(stroke && { stroke }) });
  };
  const label = (anchor: Pt, text: string, color = '#ffffff', size = 0.22, bg?: string) => {
    view.labels.push({ anchor, text, color, size, ...(bg && { bg }) });
  };

  for (const u of b.units) view.tokens.push({ unit: u, active: b.active?.unitId === u.id, hovered: s.hoverUnitId === u.id, badge: statusBadge(b, u) });

  // Boss sweep zone: always visible so the danger area is learnable.
  const threat = bossSweepThreat(b);
  if (threat && threat.tiles.length) {
    fill('zone', threat.tiles, COLORS.amber, 0.09);
    const r = bounds(threat.tiles);
    const w = r.x1 - r.x0 + 1;
    const h = r.y1 - r.y0 + 1;
    view.outlines.push({ layer: 'zone', x: r.x0, y: r.y0, w, h, color: COLORS.amber, alpha: 0.55, width: 2 });
    label({ x: r.x0 + w - 0.9, y: r.y0 + h - 0.18 }, 'SWEEP ZONE', '#ffb347', 0.15);
  }

  // Telegraphed effects
  for (const e of b.effects) {
    fill('telegraph', e.tiles, COLORS.danger, 0.5, COLORS.danger);
    const r = bounds(e.tiles);
    label({ x: (r.x0 + r.x1) / 2 + 0.5, y: r.y0 + 0.25 }, `${e.name} · ${Math.round(e.resolveAt - b.clock)} AP`, '#ffffff', 0.22, 'rgba(120,20,20,0.85)');
  }

  // Engagement links
  for (const [a, c] of engagedPairs(b)) {
    view.segments.push({ layer: 'links', from: unitCenter(unitById(b, a)), to: unitCenter(unitById(b, c)), color: COLORS.engage, alpha: 0.55, width: 2 });
  }

  const u = b.active && b.outcome === 'ongoing' ? unitById(b, b.active.unitId) : null;
  if (!u || u.side !== 'player' || s.busy || s.botParty) return view;
  const a = b.active!;

  const markTargets = (p: AttackPreview, alpha: number) => {
    for (const t of p.targets) {
      const tu = unitById(b, t.unitId);
      if (tu.side !== 'player') fill('overlay', tilesOf(tu), COLORS.aim, alpha);
    }
  };

  const attackPreview = (p: AttackPreview) => {
    const guaranteed = p.candidates ? p.targets.flatMap((t) => tilesOf(unitById(b, t.unitId))) : p.tiles;
    fill('overlay', guaranteed, COLORS.aim, 0.4, COLORS.aim);
    for (const t of p.targets) {
      const tu = unitById(b, t.unitId);
      if (!alive(tu)) continue;
      const c = unitCenter(tu);
      const txt = p.kind === 'skill' && p.area ? '' : `${tu.name}: ${p.candidates ? 'Primary ' : ''}${Math.round(t.landChance * 100)}% · ${t.damageIfLands} dmg${t.kills ? ' ☠' : ''}`;
      if (txt) label({ x: c.x, y: c.y - 0.55 }, txt, t.kills ? '#ffd166' : '#ffffff', 0.21, 'rgba(0,0,0,0.75)');
    }
    if (u.attack.pattern === 'ranged' && p.kind === 'attack') {
      const tgt = p.targets[0];
      if (tgt) view.segments.push({ layer: 'overlay', from: tileCenter(u.pos), to: unitCenter(unitById(b, tgt.unitId)), color: COLORS.aim, alpha: 0.8, width: 2 });
    }
    if (p.candidates) label({ x: u.pos.x + 0.5, y: u.pos.y + 0.5 + 0.85 }, 'Dashed: one random', '#ffd166', 0.2, 'rgba(0,0,0,0.85)');
    for (const candidate of p.candidates ?? []) {
      const tu = unitById(b, candidate.unitId);
      const c = unitCenter(tu);
      view.outlines.push({ layer: 'overlay', x: c.x - 0.4, y: c.y - 0.4, w: 0.8, h: 0.8, color: COLORS.aim, alpha: 1, width: 2, dashed: true });
      label({ x: c.x, y: c.y + 0.48 }, `${tu.name}: ${Math.round(candidate.probability * 100)}% secondary`, '#ffd166', 0.2, 'rgba(0,0,0,0.85)');
    }
    if (p.note && !p.candidates) {
      const t0 = p.tiles[0]!;
      label({ x: t0.x + 0.5, y: t0.y + 0.5 + 0.42 }, p.note, '#ffd166', 0.17);
    }
  };

  if (s.mode.kind === 'move') {
    const reach = reachable(b, u.id);
    const tiles = [...reach.values()].map((r) => r.path[r.path.length - 1]!).filter((p) => !eq(p, u.pos));
    // Reach is the quietest overlay: a light wash plus the perimeter below. It skips telegraphed tiles so Path Blue never mixes with the red zone.
    const telegraphed = new Set(b.effects.flatMap((e) => e.tiles.map(key)));
    fill('overlay', tiles.filter((p) => !telegraphed.has(key(p))), COLORS.move, 0.16);
    // Path Blue perimeter: edges between a reachable tile and a non-reachable / out-of-map neighbour.
    const inReach = new Set([key(u.pos), ...tiles.map(key)]);
    for (const p of [u.pos, ...tiles]) {
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
        if (inReach.has(key({ x: p.x + dx, y: p.y + dy }))) continue;
        const from = dx === 0 ? { x: p.x, y: p.y + (dy > 0 ? 1 : 0) } : { x: p.x + (dx > 0 ? 1 : 0), y: p.y };
        const to = dx === 0 ? { x: p.x + 1, y: from.y } : { x: from.x, y: p.y + 1 };
        view.segments.push({ layer: 'overlay', from, to, color: COLORS.move, alpha: 0.85, width: 2 });
      }
    }
    // Attackable enemies from here (click them to attack).
    if (!a.acted) for (const opt of attackOptions(b, u)) markTargets(opt, 0.25);
    const hov = s.hoverTile;
    const r = hov ? reach.get(key(hov)) : undefined;
    if (hov && r && !eq(hov, u.pos)) {
      const color = pathSafety(r) < 1 ? COLORS.amber : COLORS.move;
      for (let i = 1; i < r.path.length; i++) {
        view.segments.push({ layer: 'overlay', from: tileCenter(r.path[i - 1]!), to: tileCenter(r.path[i]!), color, alpha: 0.9, width: 4 });
      }
      fill('overlay', [hov], color, 0.34, color);
      for (const risk of r.risks) {
        const p = r.path[risk.index]!;
        label({ x: p.x + 0.5, y: p.y + 0.5 - 0.3 }, `held ${Math.round(risk.chance * 100)}%`, '#ffcf66', 0.18);
      }
      const pending = pendingFor({ battle: b, hoverTile: hov, mode: { kind: 'move' }, busy: false });
      const tone = pending?.danger === 'hit' ? '#ff6b5b' : pending?.danger === 'risk' ? '#ffb347' : '#ffffff';
      const note = pending?.danger === 'hit' ? ' · no escape' : pending?.danger === 'risk' ? ' · escape risk' : '';
      label({ x: hov.x + 0.5, y: hov.y + 0.5 + 0.05 }, `${pending?.extra ?? r.cost} AP${note}`, tone, 0.2);
    } else if (hov && !a.acted) {
      const p = previewAttack(b, u, hov);
      if (p) attackPreview(p);
    }
  } else if (s.mode.kind === 'attack' || s.mode.kind === 'skill') {
    const skillId = s.mode.kind === 'skill' ? s.mode.skillId : null;
    const modeId = s.mode.kind === 'attack' ? s.mode.modeId : undefined;
    const selected = attackModes(b, u).find((m) => m.id === modeId);
    const mode = selected ?? attackModes(b, u)[0];
    if (!skillId && selected?.pattern === 'ring8') {
      const ring = patternTiles('ring8', u.pos, 0).map((p) => p.tile).filter((p) => p.x >= 0 && p.y >= 0 && p.x < b.map.width && p.y < b.map.height);
      fill('overlay', ring, COLORS.aim, 0.25, COLORS.aim);
      label(tileCenter(u.pos), `${selected.name} · ${selected.apCost} AP · click self or ring to commit`, '#ffd166', 0.2);
    }
    const opts = skillId ? skillOptions(b, u, skillId) : attackOptions(b, u).filter((o) => o.modeId === (modeId ?? attackModes(b, u)[0]!.id));
    for (const opt of opts) markTargets(opt, 0.3);
    // Show the aimable directions.
    if (!skillId && mode && mode.pattern !== 'ranged') fill('overlay', opts.map((o) => o.anchor), COLORS.aim, 0.14);
    // Weapon reach, visible even without a valid hovered target.
    if (!skillId && mode?.pattern === 'ranged') {
      const [lo, hi] = mode.range ?? [1, 1];
      const inRange: Vec[] = [];
      for (let y = 0; y < b.map.height; y++)
        for (let x = 0; x < b.map.width; x++) {
          const p = { x, y };
          const d = cheb(u.pos, p);
          if (d < lo || d > hi || terrainAt(b, p) === 'wall' || !lineOfSight(b, u.pos, p)) continue;
          inRange.push(p);
        }
      fill('overlay', inRange, COLORS.aim, 0.1);
    }
    const hov = s.hoverTile;
    if (!skillId && hov && mode && mode.pattern !== 'ranged' && mode.pattern !== 'ring8' && !previewAttack(b, u, hov, u.pos, modeId)) {
      const i = aimDirection(mode.pattern, u.pos, hov);
      if (i !== null) {
        const aimed = patternTiles(mode.pattern, u.pos, i).map((p) => p.tile).filter((p) => p.x >= 0 && p.y >= 0 && p.x < b.map.width && p.y < b.map.height && terrainAt(b, p) !== 'wall');
        fill('overlay', aimed, COLORS.aim, 0.2);
      }
    }
    if (hov) {
      const p = skillId ? previewSkill(b, u, skillId, hov) : previewAttack(b, u, hov, u.pos, modeId);
      if (p) attackPreview(p);
    }
  }
  return view;
}

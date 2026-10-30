// Geometry builders for the 3D board: flat ground overlays (tile fills, strokes, ribbons) and unit tokens.
// Ground space: tile-space point (x, y) maps to world (x - W/2, height, y - H/2); one tile = one world unit.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Vec } from '../rules/geometry';
import type { UnitState } from '../rules/types';
import { COLORS } from '../board/palette';
import { REFERENCE_TILE, footprintSize, type Pt } from '../board/view-model';
import { makeFigure, type Figure } from './figures';

/** Nominal 2D pixels to tile units. */
export const PX = 1 / REFERENCE_TILE;
const FILL_INSET = 2 * PX;

/** Flat triangles on the ground plane, in tile space; converted to world by the caller's offset. */
export class GroundShape {
  readonly positions: number[] = [];

  quad(a: Pt, b: Pt, c: Pt, d: Pt): void {
    this.positions.push(a.x, 0, a.y, c.x, 0, c.y, b.x, 0, b.y, a.x, 0, a.y, d.x, 0, d.y, c.x, 0, c.y);
  }

  rect(x: number, y: number, w: number, h: number): void {
    this.quad({ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h });
  }

  /** Rectangle border of thickness `t`, drawn inside the rectangle. */
  frame(x: number, y: number, w: number, h: number, t: number): void {
    this.rect(x, y, w, t);
    this.rect(x, y + h - t, w, t);
    this.rect(x, y + t, t, h - 2 * t);
    this.rect(x + w - t, y + t, t, h - 2 * t);
  }

  /** Flat line of width `w` from `a` to `b`. */
  ribbon(a: Pt, b: Pt, w: number): void {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len === 0) return;
    const nx = (-(b.y - a.y) / len) * (w / 2);
    const ny = ((b.x - a.x) / len) * (w / 2);
    this.quad({ x: a.x + nx, y: a.y + ny }, { x: b.x + nx, y: b.y + ny }, { x: b.x - nx, y: b.y - ny }, { x: a.x - nx, y: a.y - ny });
  }

  /** Inset tile squares, matching the 2D board's 2px inset. */
  tiles(tiles: Vec[]): void {
    for (const p of tiles) this.rect(p.x + FILL_INSET, p.y + FILL_INSET, 1 - 2 * FILL_INSET, 1 - 2 * FILL_INSET);
  }

  tileStrokes(tiles: Vec[], width: number): void {
    for (const p of tiles) this.frame(p.x + FILL_INSET, p.y + FILL_INSET, 1 - 2 * FILL_INSET, 1 - 2 * FILL_INSET, width);
  }

  /** Dashed rectangle outline: 5px dashes, 10px period, like the 2D board. */
  dashedRect(x: number, y: number, w: number, h: number, width: number): void {
    const dash = 5 * PX;
    const period = 10 * PX;
    for (let d = 0; d < w; d += period) {
      const end = Math.min(d + dash, w);
      this.ribbon({ x: x + d, y }, { x: x + end, y }, width);
      this.ribbon({ x: x + d, y: y + h }, { x: x + end, y: y + h }, width);
    }
    for (let d = 0; d < h; d += period) {
      const end = Math.min(d + dash, h);
      this.ribbon({ x, y: y + d }, { x, y: y + end }, width);
      this.ribbon({ x: x + w, y: y + d }, { x: x + w, y: y + end }, width);
    }
  }

  /** Mesh at `height` above the ground, offset so tile space lands in world space. */
  mesh(material: THREE.Material, offset: THREE.Vector3, height: number): THREE.Mesh | null {
    if (!this.positions.length) return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(offset.x, height, offset.z);
    return mesh;
  }
}

/** Overlays are unlit and untone-mapped so their hues keep the 2D board's strength over lit floors. */
export function overlayMaterial(color: string, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color, opacity, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false });
}

// ---------------- Tokens ----------------

export interface Token3D {
  unitId: string;
  root: THREE.Group;
  /** Meshes that resolve pointer picks to this unit. */
  pickables: THREE.Object3D[];
  ring: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  hoverRing: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  plate: THREE.Sprite;
  plateCanvas: HTMLCanvasElement;
  plateTexture: THREE.CanvasTexture;
  plateKey: string;
  materials: THREE.Material[];
  big: boolean;
  /** KO dimming and fades. */
  alpha: number;
  /** Hit-flash multiplier. */
  flash: number;
  badge: string;
  /** Posed unit figure; null for units still drawn as pawns or blocks. */
  figure: Figure | null;
  /** Height of the unit's body top, for the plate and rising combat text. */
  top: number;
}

const PLATE_W = 256;
const PLATE_H = 176;
/** HP bar row on the plate canvas; its backing box ends 24px lower, the plate's lowest painted edge. */
const PLATE_BAR_Y = 148;
const FONT = 'Georgia, "Times New Roman", serif';
const UI_FONT = 'Inter, "Segoe UI", system-ui, sans-serif';

/** Pawn silhouette (radius, height) for the lathe; slimmer than a tile so neighbours and walls stay visible. */
const PAWN = [
  [0, 0], [0.26, 0], [0.26, 0.07], [0.2, 0.1], [0.14, 0.15], [0.1, 0.3], [0.09, 0.38], [0.14, 0.41], [0.14, 0.44], [0.07, 0.47], [0, 0.47],
].map(([r, h]) => new THREE.Vector2(r!, h!));

export const PAWN_HEIGHT = 0.62;
/** Floating plate sprite size (world units wide) per token kind. */
export const PLATE_SCALE = { pawn: 2.0, boss: 2.5 };
/** Plate centre above a pawn's top: the HP bar along the plate's lower edge clears the head. */
const PLATE_CLEARANCE = 0.88;
/**
 * Screen-aligned gap (world units) between a figure's top and its plate's lowest edge. Height alone can't clear
 * figures from a steep camera: their bodies cover ground that projects up into the plate.
 */
const FIGURE_PLATE_GAP = 0.42;
const BOSS_TOP = 1.8;
const BOSS_PLATE_HEIGHT = 2.7;
/** Figures are modelled near pawn size; scaled up so their silhouettes read at the default camera distance. */
const FIGURE_SCALE = 1.35;

export function makeToken(u: UnitState): Token3D {
  const big = u.footprint.length > 1;
  const sideColor = u.side === 'player' ? COLORS.party : COLORS.enemy;
  const root = new THREE.Group();
  root.userData.unitId = u.id;
  const materials: THREE.Material[] = [];
  const track = <M extends THREE.Material>(m: M): M => {
    m.transparent = true;
    materials.push(m);
    return m;
  };
  let pickables: THREE.Object3D[] = [];
  let ringGeometry: THREE.BufferGeometry;
  let hoverGeometry: THREE.BufferGeometry;
  let plateHeight: number;
  let figure: Figure | null;
  let top = PAWN_HEIGHT;

  if (big) {
    const { w, h } = footprintSize(u);
    figure = makeFigure(u);
    if (figure) {
      // Built at world size over the whole footprint; the token root sits at the footprint centre.
      top = figure.height;
      for (const m of figure.materials) track(m);
      root.add(figure.object);
      pickables = figure.meshes;
    } else {
      const body = new THREE.Mesh(
        new RoundedBoxGeometry(w - 0.22, 1.25, h - 0.22, 4, 0.14),
        track(new THREE.MeshStandardMaterial({ color: COLORS.boss, roughness: 0.75, metalness: 0.1 })),
      );
      body.position.y = 0.625;
      const crown = new THREE.Mesh(
        new RoundedBoxGeometry(w * 0.55, 0.5, h * 0.45, 3, 0.12),
        track(new THREE.MeshStandardMaterial({ color: '#7a3a2e', roughness: 0.6 })),
      );
      crown.position.y = 1.45;
      for (const m of [body, crown]) {
        m.castShadow = true;
        m.receiveShadow = true;
        root.add(m);
        pickables.push(m);
      }
      top = BOSS_TOP;
    }
    const shape = new GroundShape();
    shape.frame(-w / 2 + 0.04, -h / 2 + 0.04, w - 0.08, h - 0.08, 0.06);
    ringGeometry = groundGeometry(shape);
    const hover = new GroundShape();
    hover.frame(-w / 2 - 0.02, -h / 2 - 0.02, w + 0.04, h + 0.04, 0.04);
    hoverGeometry = groundGeometry(hover);
    plateHeight = figure ? top : BOSS_PLATE_HEIGHT;
  } else {
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.3, 0.05, 32),
      track(new THREE.MeshStandardMaterial({ color: u.side === 'player' ? COLORS.partyDark : COLORS.enemyDark, roughness: 0.8 })),
    );
    base.position.y = 0.025;
    base.castShadow = true;
    root.add(base);
    figure = makeFigure(u);
    if (figure) {
      figure.object.position.y = 0.05;
      figure.object.scale.setScalar(FIGURE_SCALE);
      top = 0.05 + figure.height * FIGURE_SCALE;
      for (const m of figure.materials) track(m);
      root.add(figure.object);
      // Live list: weapon swaps add and remove figure meshes.
      figure.meshes.push(base);
      pickables = figure.meshes;
    } else {
      const pawnMaterial = track(new THREE.MeshStandardMaterial({ color: sideColor, roughness: 0.55, metalness: 0.15 }));
      const pawn = new THREE.Mesh(new THREE.LatheGeometry(PAWN, 28), pawnMaterial);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 16), pawnMaterial);
      head.position.y = 0.53;
      pawn.position.y = 0.05;
      for (const m of [pawn, head]) {
        m.castShadow = true;
        root.add(m);
      }
      pickables.push(pawn, head, base);
    }
    ringGeometry = new THREE.RingGeometry(0.32, 0.38, 40).rotateX(-Math.PI / 2);
    hoverGeometry = new THREE.RingGeometry(0.41, 0.45, 40).rotateX(-Math.PI / 2);
    plateHeight = figure ? top : top + PLATE_CLEARANCE;
  }

  const ring = new THREE.Mesh(ringGeometry, track(new THREE.MeshBasicMaterial({ color: sideColor, depthWrite: false, side: THREE.DoubleSide })));
  ring.position.y = 0.03;
  ring.renderOrder = 5;
  const hoverRing = new THREE.Mesh(hoverGeometry, track(new THREE.MeshBasicMaterial({ color: '#ffffff', opacity: 0.9, depthWrite: false, side: THREE.DoubleSide })));
  hoverRing.position.y = 0.03;
  hoverRing.renderOrder = 5;
  hoverRing.visible = false;

  const plateCanvas = document.createElement('canvas');
  plateCanvas.width = PLATE_W;
  plateCanvas.height = PLATE_H;
  const plateTexture = new THREE.CanvasTexture(plateCanvas);
  plateTexture.colorSpace = THREE.SRGBColorSpace;
  plateTexture.anisotropy = 4;
  const plate = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: plateTexture, depthTest: false, depthWrite: false })));
  const plateScale = big ? PLATE_SCALE.boss : PLATE_SCALE.pawn;
  plate.scale.set(plateScale, (plateScale * PLATE_H) / PLATE_W, 1);
  plate.position.y = plateHeight;
  // Figures: anchor the sprite by its painted lower edge, offset in screen space, so it clears from any orbit angle.
  if (figure) plate.center.set(0.5, (PLATE_H - PLATE_BAR_Y - 24) / PLATE_H - FIGURE_PLATE_GAP / plate.scale.y);
  plate.renderOrder = 20;
  root.add(ring, hoverRing, plate);

  return { unitId: u.id, root, pickables, ring, hoverRing, plate, plateCanvas, plateTexture, plateKey: '', materials, big, alpha: 1, flash: 1, badge: '', figure, top };
}

function groundGeometry(shape: GroundShape): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(shape.positions, 3));
  return geometry;
}

/** Repaint selection rings, opacity and the floating plate (glyph medallion, status, HP). */
export function paintToken(tok: Token3D, u: UnitState, active: boolean, hovered: boolean): void {
  const sideColor = u.side === 'player' ? COLORS.party : COLORS.enemy;
  tok.ring.material.color.set(active ? COLORS.gold : tok.big && hovered ? '#ffffff' : sideColor);
  tok.ring.scale.setScalar(active && !tok.big ? 1.08 : 1);
  tok.hoverRing.visible = hovered && !tok.big;
  tok.alpha = u.ko ? 0.22 : 1;
  applyOpacity(tok);
  tok.figure?.sync(u);

  const key = `${u.hp}/${u.maxHp}|${tok.badge}|${active}|${u.ko}`;
  if (key === tok.plateKey) return;
  tok.plateKey = key;
  const g = tok.plateCanvas.getContext('2d')!;
  g.clearRect(0, 0, PLATE_W, PLATE_H);
  const cx = PLATE_W / 2;
  if (tok.badge) {
    g.font = `bold 30px ${UI_FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'top';
    g.lineWidth = 7;
    g.lineJoin = 'round';
    g.strokeStyle = '#000';
    g.strokeText(tok.badge, cx, 2, PLATE_W - 8);
    g.fillStyle = '#ffd166';
    g.fillText(tok.badge, cx, 2, PLATE_W - 8);
  }
  const my = 88;
  if (tok.big) {
    g.font = `bold 60px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 8;
    g.lineJoin = 'round';
    g.strokeStyle = '#000';
    g.strokeText(u.glyph, cx, my - 10);
    g.fillStyle = '#f3e9d2';
    g.fillText(u.glyph, cx, my - 10);
    g.font = `bold 30px ${FONT}`;
    g.strokeText(u.name.toUpperCase(), cx, my + 38, PLATE_W - 12);
    g.fillStyle = '#e8c9a0';
    g.fillText(u.name.toUpperCase(), cx, my + 38, PLATE_W - 12);
  } else {
    g.beginPath();
    g.arc(cx, my + 4, 54, 0, Math.PI * 2);
    g.fillStyle = u.side === 'player' ? COLORS.partyDark : COLORS.enemyDark;
    g.fill();
    g.lineWidth = 8;
    g.strokeStyle = active ? COLORS.gold : sideColor;
    g.stroke();
    g.font = `bold 62px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#f3e9d2';
    g.fillText(u.glyph, cx, my + 8);
  }
  const bw = tok.big ? 220 : 108;
  const by = PLATE_BAR_Y;
  const frac = Math.max(0, u.hp / u.maxHp);
  g.fillStyle = 'rgba(0,0,0,0.8)';
  g.fillRect(cx - bw / 2 - 4, by - 4, bw + 8, 28);
  g.fillStyle = frac > 0.5 ? '#6fbf73' : frac > 0.25 ? '#e0b13a' : '#d9534f';
  g.fillRect(cx - bw / 2, by, bw * frac, 20);
  tok.plateTexture.needsUpdate = true;
}

export function applyOpacity(tok: Token3D): void {
  const opacity = tok.alpha * tok.flash;
  for (const m of tok.materials) m.opacity = m === tok.hoverRing.material ? 0.9 * opacity : opacity;
}

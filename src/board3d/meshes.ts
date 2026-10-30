// Geometry builders for the 3D board: flat ground overlays (tile fills, strokes, ribbons) and unit tokens.
// Ground space: tile-space point (x, y) maps to world (x - W/2, height, y - H/2); one tile = one world unit.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Vec } from '../rules/geometry';
import type { UnitState } from '../rules/types';
import { COLORS } from '../board/palette';
import { REFERENCE_TILE, footprintSize, type Pt } from '../board/view-model';

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

export function overlayMaterial(color: string, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color, opacity, transparent: true, depthWrite: false, side: THREE.DoubleSide });
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
}

const PLATE_W = 256;
const PLATE_H = 176;
const FONT = 'Georgia, "Times New Roman", serif';
const UI_FONT = 'Inter, "Segoe UI", system-ui, sans-serif';

/** Pawn silhouette (radius, height) for the lathe. */
const PAWN = [
  [0, 0], [0.31, 0], [0.31, 0.07], [0.24, 0.1], [0.17, 0.15], [0.12, 0.3], [0.11, 0.38], [0.17, 0.41], [0.17, 0.44], [0.08, 0.47], [0, 0.47],
].map(([r, h]) => new THREE.Vector2(r!, h!));

export const PAWN_HEIGHT = 0.62;

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
  const pickables: THREE.Object3D[] = [];
  let ringGeometry: THREE.BufferGeometry;
  let hoverGeometry: THREE.BufferGeometry;
  let plateHeight: number;

  if (big) {
    const { w, h } = footprintSize(u);
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
    const shape = new GroundShape();
    shape.frame(-w / 2 + 0.04, -h / 2 + 0.04, w - 0.08, h - 0.08, 0.06);
    ringGeometry = groundGeometry(shape);
    const hover = new GroundShape();
    hover.frame(-w / 2 - 0.02, -h / 2 - 0.02, w + 0.04, h + 0.04, 0.04);
    hoverGeometry = groundGeometry(hover);
    plateHeight = 2.25;
  } else {
    const pawnMaterial = track(new THREE.MeshStandardMaterial({ color: sideColor, roughness: 0.55, metalness: 0.15 }));
    const pawn = new THREE.Mesh(new THREE.LatheGeometry(PAWN, 28), pawnMaterial);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 16), pawnMaterial);
    head.position.y = 0.53;
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.33, 0.35, 0.05, 32),
      track(new THREE.MeshStandardMaterial({ color: u.side === 'player' ? COLORS.partyDark : COLORS.enemyDark, roughness: 0.8 })),
    );
    base.position.y = 0.025;
    pawn.position.y = 0.05;
    for (const m of [pawn, head, base]) {
      m.castShadow = true;
      root.add(m);
      pickables.push(m);
    }
    ringGeometry = new THREE.RingGeometry(0.36, 0.42, 40).rotateX(-Math.PI / 2);
    hoverGeometry = new THREE.RingGeometry(0.45, 0.49, 40).rotateX(-Math.PI / 2);
    plateHeight = 1.02;
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
  const plateScale = big ? 1.9 : 1.2;
  plate.scale.set(plateScale, (plateScale * PLATE_H) / PLATE_W, 1);
  plate.position.y = plateHeight;
  plate.renderOrder = 20;
  root.add(ring, hoverRing, plate);

  return { unitId: u.id, root, pickables, ring, hoverRing, plate, plateCanvas, plateTexture, plateKey: '', materials, big, alpha: 1, flash: 1, badge: '' };
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

  const key = `${u.hp}/${u.maxHp}|${tok.badge}|${active}|${u.ko}`;
  if (key === tok.plateKey) return;
  tok.plateKey = key;
  const g = tok.plateCanvas.getContext('2d')!;
  g.clearRect(0, 0, PLATE_W, PLATE_H);
  const cx = PLATE_W / 2;
  if (tok.badge) {
    g.font = `bold 22px ${UI_FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'top';
    g.lineWidth = 5;
    g.strokeStyle = '#000';
    g.strokeText(tok.badge, cx, 4, PLATE_W - 8);
    g.fillStyle = '#ffd166';
    g.fillText(tok.badge, cx, 4, PLATE_W - 8);
  }
  const my = 80;
  if (tok.big) {
    g.font = `bold 46px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 6;
    g.strokeStyle = '#000';
    g.strokeText(u.glyph, cx, my - 8);
    g.fillStyle = '#f3e9d2';
    g.fillText(u.glyph, cx, my - 8);
    g.font = `24px ${FONT}`;
    g.strokeText(u.name.toUpperCase(), cx, my + 34, PLATE_W - 12);
    g.fillStyle = '#e8c9a0';
    g.fillText(u.name.toUpperCase(), cx, my + 34, PLATE_W - 12);
  } else {
    g.beginPath();
    g.arc(cx, my, 40, 0, Math.PI * 2);
    g.fillStyle = u.side === 'player' ? COLORS.partyDark : COLORS.enemyDark;
    g.fill();
    g.lineWidth = 6;
    g.strokeStyle = active ? COLORS.gold : sideColor;
    g.stroke();
    g.font = `bold 40px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#f3e9d2';
    g.fillText(u.glyph, cx, my + 2);
  }
  const bw = 180;
  const by = 140;
  const frac = Math.max(0, u.hp / u.maxHp);
  g.fillStyle = 'rgba(0,0,0,0.75)';
  g.fillRect(cx - bw / 2 - 3, by - 3, bw + 6, 22);
  g.fillStyle = frac > 0.5 ? '#6fbf73' : frac > 0.25 ? '#e0b13a' : '#d9534f';
  g.fillRect(cx - bw / 2, by, bw * frac, 16);
  tok.plateTexture.needsUpdate = true;
}

export function applyOpacity(tok: Token3D): void {
  const opacity = tok.alpha * tok.flash;
  for (const m of tok.materials) m.opacity = m === tok.hoverRing.material ? 0.9 * opacity : opacity;
}

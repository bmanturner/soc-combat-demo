// Shared base for procedural unit figures: the Figure contract the board drives, low-poly geometry helpers,
// and Rig, a joint hierarchy reset to rest each frame and posed in code (stance, idle, stride, clips, statuses, KO).
// Local frame: +z is the figure's front, +y is up, the origin sits on the token base; one world unit = one tile.

import * as THREE from 'three';
import type { UnitState } from '../rules/types';

/** What leaves the hand (or arm) on a ranged strike; the board flies it from attacker to target. */
export type Projectile = 'arrow' | 'bolt' | 'knife' | 'javelin' | 'orb' | 'boulder';

export interface Figure {
  /** Added under the token root; carries the facing yaw. */
  readonly object: THREE.Group;
  /** Solid parts: picking and label-avoidance bounds. */
  readonly meshes: THREE.Mesh[];
  /** Every material, so token fades and hit flashes reach the whole figure. */
  readonly materials: THREE.Material[];
  /** Top of the head in local units, before the board's figure scale. */
  readonly height: number;
  /** Mirror unit state that changes the model: KO, statuses, carried weapons, armour. */
  sync(u: UnitState): void;
  /** Turn toward a world-space yaw (0 = +z). The first call snaps. */
  face(yaw: number): void;
  /** One tile of walking, `ms` long. */
  walk(ms: number): void;
  /** Shoved, hooked or sidestepping, over a `ms` move. */
  stagger(ms: number): void;
  /**
   * Strike paired with the board's lunge or pulse. `reach` is the distance to the target tile in tiles, `attack` the
   * rules attack or skill name, `ms` one lunge leg. Returns what flies to the target, if anything.
   */
  strike(reach: number, attack: string, ms: number): Projectile | null;
  /** Names of this unit's delayed effects still pending on the board (telegraphs being held). */
  pending(effects: readonly string[]): void;
  /** One of this unit's delayed effects lands now. */
  land(effect: string, ms: number): void;
  hit(ms: number): void;
  fall(ms: number): void;
  /** Drop any transient clip (the board snapped to state). */
  settle(): void;
  update(dtMs: number): void;
}

/** Shared material palette: earthy and unsaturated, so side color stays on the base, ring and plate. */
export const TONE = {
  skin: '#b27a52',
  hair: '#2b1d14',
  robe: '#d2bf98',
  tunic: '#9c7d55',
  rope: '#6e5434',
  leather: '#5a3c26',
  wood: '#7a5532',
  bronze: '#c08a45',
  bronzeShade: '#8a5c2c',
  hide: '#8c6c48',
  stone: '#7d7366',
  string: '#ddd0b4',
  bone: '#e6dac0',
  ink: '#1b120c',
};

// ---------------- Geometry helpers ----------------

export type V3 = readonly [number, number, number];
export type Keys = readonly (readonly [number, number])[];

export const cyl = (rt: number, rb: number, h: number, seg = 6) => new THREE.CylinderGeometry(rt, rb, h, seg);
export const ico = (r: number, detail = 0) => new THREE.IcosahedronGeometry(r, detail);
export const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
export const cone = (r: number, h: number, seg = 5) => new THREE.ConeGeometry(r, h, seg);
export const UP = new THREE.Vector3(0, 1, 0);

/** Cylinder from a to b, for limbs, shafts and strings. */
export function rod(r: number, a: V3, b: V3, seg = 5): THREE.BufferGeometry {
  const from = new THREE.Vector3(...a);
  const dir = new THREE.Vector3(...b).sub(from);
  const g = cyl(r, r, dir.length(), seg).translate(0, dir.length() / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize()));
  return g.translate(from.x, from.y, from.z);
}

/** Smoothstep-interpolated keyframe track. */
export function key(p: number, keys: Keys): number {
  const first = keys[0]!;
  if (p <= first[0]) return first[1];
  for (let i = 1; i < keys.length; i++) {
    const [p1, v1] = keys[i]!;
    if (p <= p1) {
      const [p0, v0] = keys[i - 1]!;
      const t = (p - p0) / (p1 - p0 || 1);
      return v0 + (v1 - v0) * t * t * (3 - 2 * t);
    }
  }
  return keys[keys.length - 1]![1];
}

/** Stable per-unit number: idle phase offsets and small variations, so a pack never moves in lockstep. */
export function phaseSeed(id: string): number {
  let h = 7;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return (Math.abs(h) % 997) / 31;
}

// ---------------- Rig base ----------------

/** A strike's clip, how long it runs (in lunge legs; default 4) and what it throws. */
export interface StrikePlan {
  clip: string;
  legs?: number;
  projectile?: Projectile;
}

export abstract class Rig implements Figure {
  readonly object = new THREE.Group();
  /** Ground pivot under the figure: falls and pounces turn around it. */
  protected readonly body = new THREE.Group();
  readonly meshes: THREE.Mesh[] = [];
  readonly materials: THREE.Material[] = [];
  abstract readonly height: number;
  private readonly rest = new Map<THREE.Object3D, { r: THREE.Euler; p: THREE.Vector3; s: THREE.Vector3 }>();
  protected yaw = 0;
  protected targetYaw = 0;
  private yawSet = false;
  private clip: { kind: string; t: number; dur: number } | null = null;
  private stride = 0;
  private striding = 0;
  private down = 0;
  private downTarget = 0;
  private downRate = 0;
  protected time: number;
  protected dazed = false;
  protected feared = false;

  constructor(id: string) {
    this.object.add(this.body);
    this.time = phaseSeed(id);
    this.track(this.body);
  }

  /** Record an object's current transform as its rest pose; every frame starts from it. */
  protected track(o: THREE.Object3D): void {
    this.rest.set(o, { r: o.rotation.clone(), p: o.position.clone(), s: o.scale.clone() });
  }

  protected joint(parent: THREE.Object3D, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): THREE.Group {
    const j = new THREE.Group();
    j.position.set(x, y, z);
    j.rotation.set(rx, ry, rz);
    parent.add(j);
    this.track(j);
    return j;
  }

  protected paint(color: string, metalness = 0, roughness = 0.85): THREE.MeshStandardMaterial {
    const m = new THREE.MeshStandardMaterial({ color, metalness, roughness, flatShading: true });
    this.materials.push(m);
    return m;
  }

  protected part(parent: THREE.Object3D, g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): THREE.Mesh {
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true;
    parent.add(mesh);
    this.meshes.push(mesh);
    return mesh;
  }

  /** Start a one-shot clip; poseClip receives its progress 0..1. */
  protected play(kind: string, dur: number): void {
    this.clip = { kind, t: 0, dur: Math.max(1, dur) };
  }

  /** Whether facing turns the whole figure; anchored figures turn parts of themselves from `yaw` instead. */
  protected turnsBody(): boolean {
    return true;
  }

  face(yaw: number): void {
    this.targetYaw = yaw;
    if (!this.yawSet) {
      this.yaw = yaw;
      this.yawSet = true;
    }
  }

  walk(ms: number): void {
    this.play('walk', ms);
  }

  stagger(ms: number): void {
    this.play('stagger', ms * 2.5);
  }

  strike(reach: number, attack: string, ms: number): Projectile | null {
    const plan = this.strikePlan(reach, attack);
    this.play(plan.clip, ms * (plan.legs ?? 4));
    return plan.projectile ?? null;
  }

  pending(_effects: readonly string[]): void {}

  land(_effect: string, _ms: number): void {}

  hit(ms: number): void {
    this.play('hit', ms);
  }

  fall(ms: number): void {
    this.clip = null;
    this.downTarget = 1;
    this.downRate = 1 / Math.max(1, ms);
  }

  settle(): void {
    this.clip = null;
    this.striding = 0;
  }

  sync(u: UnitState): void {
    this.dazed = u.dazed;
    this.feared = u.feared;
    const target = u.ko ? 1 : 0;
    if (target !== this.downTarget) this.down = this.downTarget = target;
  }

  update(dtMs: number): void {
    const dt = dtMs / 1000;
    this.time += dt;
    const turn = Math.atan2(Math.sin(this.targetYaw - this.yaw), Math.cos(this.targetYaw - this.yaw));
    this.yaw += turn * (1 - Math.exp(-dt * 16));
    this.object.rotation.y = this.turnsBody() ? this.yaw : 0;
    if (this.down !== this.downTarget) {
      const step = dtMs * this.downRate;
      this.down = this.downTarget > this.down ? Math.min(this.downTarget, this.down + step) : Math.max(this.downTarget, this.down - step);
    }

    const clip = this.clip;
    let p = 0;
    if (clip) {
      clip.t += dtMs;
      p = Math.min(1, clip.t / clip.dur);
      if (clip.kind === 'walk') this.stride += (dtMs / clip.dur) * Math.PI;
      if (p >= 1) this.clip = null;
    }
    this.striding = clip?.kind === 'walk' ? Math.min(1, this.striding + dt * 12) : Math.max(0, this.striding - dt * 8);

    for (const [o, r] of this.rest) {
      o.rotation.copy(r.r);
      o.position.copy(r.p);
      o.scale.copy(r.s);
    }
    const down = this.down * this.down * (3 - 2 * this.down);
    const life = 1 - down;
    this.poseStance(this.time, life);
    this.poseIdle(this.time, life);
    if (this.striding > 0) this.poseStride(this.stride, this.striding);
    if (clip && clip.kind !== 'walk') this.poseClip(clip.kind, p);
    if (this.dazed) this.poseDazed(this.time, life);
    if (this.feared) this.poseFeared(life);
    if (down > 0) this.poseDown(down);
  }

  /** Which clip a strike plays, for how long, and what it throws. */
  protected abstract strikePlan(reach: number, attack: string): StrikePlan;
  /** Held pose under everything else (weapon grip, held telegraph); `t` and `life` as for idle. */
  protected abstract poseStance(t: number, life: number): void;
  protected abstract poseIdle(t: number, life: number): void;
  protected abstract poseStride(phase: number, weight: number): void;
  protected abstract poseClip(kind: string, p: number): void;
  protected abstract poseDazed(t: number, life: number): void;
  protected abstract poseFeared(life: number): void;
  protected abstract poseDown(e: number): void;
}

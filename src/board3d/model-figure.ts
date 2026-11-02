// A unit drawn as a generated, rigged model (see models.ts): skeletal clips from the model files stand in for the
// procedural poses, and props are parented to hand, forearm and spine bones so they follow every clip. Each carried
// weapon has its own props, idle and strike clips; only the equipped one shows. Picking and label bounds use a hidden
// proxy column, because skinned-mesh bounds stay in bind space.

import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import type { UnitState } from '../rules/types';
import { isAreaEffect, isRangedAttack } from './attacks';
import { modelBounds, modelGltf, type Aim, type ClipRef, type HeldProp, type UnitModel } from './models';
import { phaseSeed, type Figure, type Projectile } from './rig';

const FADE = 0.12;

/**
 * Edge light on generated figures: a view-facing fresnel term, so dark robes keep their silhouette against a dark
 * floor under the dim Shrine light (DESIGN.md, Readability first). Warm neutral, never a side colour.
 */
const RIM = { color: new THREE.Color('#ffe2bc'), strength: 0.32, power: '3.0' };

function addRim(m: THREE.Material): void {
  if (!(m instanceof THREE.MeshStandardMaterial)) return;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.rimColor = { value: RIM.color };
    shader.uniforms.rimStrength = { value: RIM.strength };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 rimColor;\nuniform float rimStrength;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>\ntotalEmissiveRadiance += rimColor * rimStrength * pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), ${RIM.power});`,
      );
  };
  m.customProgramCacheKey = () => 'unit-rim';
}

/** Parts cut from clips, shared by every figure of a model. */
const parts = new WeakMap<THREE.AnimationClip, Map<string, THREE.AnimationClip>>();

function part(source: THREE.AnimationClip, from = 0, to = 1): THREE.AnimationClip {
  let byRange = parts.get(source);
  if (!byRange) parts.set(source, (byRange = new Map()));
  const key = `${from}-${to}`;
  let p = byRange.get(key);
  if (!p) {
    const fps = 30;
    const frames = Math.round(source.duration * fps);
    p = THREE.AnimationUtils.subclip(source, `${source.name}@${key}`, Math.round(frames * from), Math.round(frames * to), fps);
    byRange.set(key, p);
  }
  return p;
}

/** Past this, the wrist stops turning and the prop turns in the fist for the rest. */
const WRIST = Math.PI / 3;
const UP = new THREE.Vector3(0, 1, 0);
const NONE = new THREE.Quaternion();
// Scratch for aim(), which runs every frame.
const want = new THREE.Vector3();
const have = new THREE.Vector3();
const handWorld = new THREE.Quaternion();
const parentWorld = new THREE.Quaternion();
const full = new THREE.Quaternion();
const turnBy = new THREE.Quaternion();
const wristBy = new THREE.Quaternion();
const rest = new THREE.Quaternion();

/** A prop kept pointed at the target while chosen clips play (see Aim in models.ts). */
interface AimedProp {
  pivot: THREE.Object3D;
  /** The pivot's turn on its bone as mounted; each frame's correction starts from it. */
  mounted: THREE.Quaternion;
  tip: THREE.Vector3;
  pitch: Aim['pitch'];
}

interface CarriedModel {
  props: THREE.Object3D[];
  aims: AimedProp[];
  idle?: THREE.AnimationAction;
  strike: THREE.AnimationAction;
  ranged?: { action: THREE.AnimationAction; projectile: Projectile; thrown?: { prop: THREE.Object3D; back: number } };
  area?: THREE.AnimationAction;
}

/** When the board shows a strike's result and launches its projectile, as a fraction of the strike. */
const CONTACT = 0.25;

export class ModelFigure implements Figure {
  readonly object = new THREE.Group();
  readonly meshes: THREE.Mesh[] = [];
  readonly materials: THREE.Material[] = [];
  readonly height: number;
  private readonly mixer: THREE.AnimationMixer;
  /** Idle for the equipped weapon: its own, or the body's. */
  private idle: THREE.AnimationAction;
  private readonly bodyIdle: THREE.AnimationAction;
  private readonly walking: THREE.AnimationAction;
  private readonly hitAction: THREE.AnimationAction;
  private readonly fallAction: THREE.AnimationAction;
  private readonly carried = new Map<string, CarriedModel>();
  private equipped = '';
  /** The action at full weight. */
  private active: THREE.AnimationAction;
  /** What the figure returns to after a one-shot: idle, or walking while a step lasts. */
  private base: THREE.AnimationAction;
  private walkLeft = 0;
  private down = false;
  private yaw = 0;
  private targetYaw = 0;
  private yawSet = false;
  /** Yaw added while a side-on clip plays, by action; `turn` eases toward the active one. */
  private readonly turns = new Map<THREE.AnimationAction, number>();
  private turn = 0;
  /** Contact marks (fractions of each clip) of one-shots that have one. */
  private readonly hits = new Map<THREE.AnimationAction, number>();
  /** A strike playing up to its contact mark at one speed and the rest at another. */
  private timed: { action: THREE.AnimationAction; at: number; before: number; after: number } | null = null;

  constructor(u: UnitState, spec: UnitModel) {
    this.height = spec.height;
    const body = modelGltf(spec.body)!;
    const model = cloneSkinned(body.scene);
    model.updateMatrixWorld(true);
    this.mixer = new THREE.AnimationMixer(model);
    const clip = (ref: ClipRef) => {
      const name = typeof ref === 'string' ? ref : ref.clip;
      const c = body.animations.find((a) => a.name === name);
      if (!c) throw new Error(`Model ${spec.body} has no clip ${name}`);
      return typeof ref === 'string' ? c : part(c, ref.from, ref.to);
    };
    const once = (ref: ClipRef) => {
      const a = this.mixer.clipAction(clip(ref));
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
      if (typeof ref !== 'string' && ref.turn) this.turns.set(a, ref.turn);
      if (typeof ref !== 'string' && ref.hit !== undefined) this.hits.set(a, ref.hit);
      return a;
    };
    const looping = (ref: ClipRef) => {
      const a = this.mixer.clipAction(clip(ref));
      if (typeof ref !== 'string') a.setLoop(THREE.LoopPingPong, Infinity);
      // Offset the idle so a squad never breathes in lockstep.
      a.time = phaseSeed(u.id) % a.getClip().duration;
      return a;
    };

    for (const h of spec.worn ?? []) this.hold(model, h);
    for (const [id, w] of Object.entries(spec.weapons)) {
      if (!u.carried.some((c) => c?.defId === id)) continue;
      const held = w.held.flatMap((h) => {
        const pivot = this.hold(model, h);
        return pivot ? [{ h, pivot }] : [];
      });
      const thrown = w.ranged?.thrown && held.find((p) => p.h === w.held[w.ranged!.thrown!.prop]);
      this.carried.set(id, {
        props: held.map((p) => p.pivot),
        aims: held.flatMap(({ h, pivot }) =>
          h.aim ? [{ pivot, mounted: pivot.quaternion.clone(), tip: new THREE.Vector3(...h.aim.tip).normalize(), pitch: h.aim.pitch }] : [],
        ),
        idle: w.idle === undefined ? undefined : looping(w.idle),
        strike: once(w.strike),
        ranged: w.ranged && {
          action: once(w.ranged.clip),
          projectile: w.ranged.projectile,
          thrown: thrown ? { prop: thrown.pivot, back: w.ranged.thrown!.back } : undefined,
        },
        area: w.area === undefined ? undefined : once(w.area),
      });
    }
    model.scale.setScalar(spec.height / spec.sourceHeight);
    this.object.add(model);

    model.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      // Own materials: token fades and hit flashes change opacity per unit. Textures stay shared.
      const own = (m: THREE.Material) => {
        const c = m.clone();
        c.userData.ownMaterial = true;
        addRim(c);
        this.materials.push(c);
        return c;
      };
      o.material = Array.isArray(o.material) ? o.material.map(own) : own(o.material);
      o.castShadow = true;
      // Bind-space bounds would cull a posed figure; it is always on the board anyway.
      o.frustumCulled = false;
    });

    const proxy = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, spec.height, 8).translate(0, spec.height / 2, 0),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    this.object.add(proxy);
    this.meshes.push(proxy);

    this.bodyIdle = looping(spec.clips.idle);
    this.walking = this.mixer.clipAction(modelGltf(spec.walk)!.animations[0]!);
    this.hitAction = once(spec.clips.hit);
    this.fallAction = once(spec.clips.fall);
    this.idle = this.carried.get(u.weaponId)?.idle ?? this.bodyIdle;
    this.equip(u.weaponId);
    this.idle.play();
    this.active = this.base = this.idle;
    this.mixer.addEventListener('finished', (e) => {
      if (e.action === this.active && e.action !== this.fallAction) this.fadeTo(this.base, false);
    });
  }

  /** Pose a prop at its bone in T-pose model space, then reparent it so it rides the clips. */
  private hold(model: THREE.Object3D, h: HeldProp): THREE.Object3D | null {
    const bone = model.getObjectByName(h.bone);
    const src = modelGltf(h.slug);
    if (!bone || !src) return null;
    const b = modelBounds(h.slug);
    const size = b.getSize(new THREE.Vector3());
    const half = size.clone().multiplyScalar(0.5);
    const k = h.size / Math.max(size.x, size.y, size.z);
    const grip = b.getCenter(new THREE.Vector3()).add(new THREE.Vector3(...h.grip).multiply(half));
    const inner = src.scene.clone();
    inner.scale.setScalar(k);
    inner.position.copy(grip).multiplyScalar(-k);
    const pivot = new THREE.Group();
    pivot.add(inner);
    pivot.position.copy(bone.getWorldPosition(new THREE.Vector3())).add(new THREE.Vector3(...h.offset));
    pivot.rotation.set(...h.rotation);
    pivot.updateMatrix();
    pivot.matrix.premultiply(bone.matrixWorld.clone().invert());
    pivot.matrix.decompose(pivot.position, pivot.quaternion, pivot.scale);
    bone.add(pivot);
    return pivot;
  }

  /** Show only the equipped weapon's props and stand in its idle. */
  private equip(weaponId: string): void {
    this.equipped = weaponId;
    for (const [id, c] of this.carried) for (const p of c.props) p.visible = id === weaponId;
    const next = this.carried.get(weaponId)?.idle ?? this.bodyIdle;
    if (next === this.idle) return;
    const was = this.idle;
    this.idle = next;
    if (this.base === was) this.base = next;
    if (this.active === was) this.fadeTo(next, false);
  }

  /** Bring `next` to full weight over `fade` seconds, fading the current action out. */
  private fadeTo(next: THREE.AnimationAction, restart: boolean, timeScale = 1, fade = FADE): void {
    if (restart) next.reset();
    next.enabled = true;
    next.setEffectiveTimeScale(timeScale);
    next.setEffectiveWeight(1);
    next.play();
    if (next !== this.active) {
      this.active.fadeOut(fade);
      next.fadeIn(fade);
    }
    this.active = next;
  }

  /**
   * One-shot clip stretched to `ms`. A clip with a contact mark reaches it at CONTACT of `ms`, so the blow lands and
   * the weapon leaves the hand when the board shows the result and launches the projectile. It blends in over the
   * first 40% of the time before contact, so it is fully in by then: the usual fade outlasts that time at 1x speed.
   */
  private play(a: THREE.AnimationAction, ms: number): void {
    const d = a.getClip().duration;
    const s = Math.max(1, ms) / 1000;
    const hit = this.hits.get(a);
    if (hit === undefined) {
      this.timed = null;
      this.fadeTo(a, true, d / s);
      return;
    }
    this.timed = { action: a, at: hit * d, before: (hit * d) / (CONTACT * s), after: ((1 - hit) * d) / ((1 - CONTACT) * s) };
    this.fadeTo(a, true, this.timed.before, Math.min(FADE, 0.4 * CONTACT * s));
  }

  face(yaw: number): void {
    this.targetYaw = yaw;
    if (!this.yawSet) {
      this.yaw = yaw;
      this.yawSet = true;
    }
  }

  walk(ms: number): void {
    if (this.down) return;
    this.walkLeft = ms;
    this.base = this.walking;
    // One tile per step; the cycle holds two steps.
    const scale = this.walking.getClip().duration / ((2 * Math.max(1, ms)) / 1000);
    if (this.active === this.idle || this.active === this.walking) this.fadeTo(this.walking, false, scale);
    else this.walking.setEffectiveTimeScale(scale);
  }

  stagger(ms: number): void {
    if (!this.down) this.play(this.hitAction, ms * 2.5);
  }

  strike(_reach: number, attack: string, ms: number): Projectile | null {
    const c = this.carried.get(this.equipped);
    if (this.down || !c) return null;
    const ms4 = ms * 4;
    if (isAreaEffect(attack) && c.area) {
      this.play(c.area, ms4);
      return null;
    }
    if (isRangedAttack(attack) && c.ranged) {
      this.play(c.ranged.action, ms4);
      return c.ranged.projectile;
    }
    this.play(c.strike, ms4);
    return null;
  }

  pending(_effects: readonly string[]): void {}

  land(_effect: string, _ms: number): void {}

  hit(ms: number): void {
    if (!this.down) this.play(this.hitAction, Math.max(ms, 450));
  }

  fall(ms: number): void {
    this.down = true;
    this.walkLeft = 0;
    this.play(this.fallAction, Math.max(ms, 700));
  }

  settle(): void {
    this.walkLeft = 0;
    this.base = this.idle;
    if (!this.down && this.active !== this.idle) this.fadeTo(this.idle, false);
  }

  sync(u: UnitState): void {
    if (u.weaponId !== this.equipped) this.equip(u.weaponId);
    if (u.ko === this.down) return;
    this.down = u.ko;
    this.walkLeft = 0;
    this.base = this.idle;
    this.mixer.stopAllAction();
    if (u.ko) {
      // Snapped to state: already lying where the fall ends.
      const fall = this.fallAction;
      fall.reset().play();
      fall.time = fall.getClip().duration;
      this.active = fall;
    } else {
      this.idle.reset().play();
      this.active = this.idle;
    }
  }

  update(dtMs: number): void {
    const dt = dtMs / 1000;
    const turn = Math.atan2(Math.sin(this.targetYaw - this.yaw), Math.cos(this.targetYaw - this.yaw));
    this.yaw += turn * (1 - Math.exp(-dt * 16));
    this.turn += ((this.turns.get(this.active) ?? 0) - this.turn) * (1 - Math.exp(-dt * 12));
    this.object.rotation.y = this.yaw + this.turn;
    if (this.walkLeft > 0) {
      this.walkLeft -= dtMs;
      if (this.walkLeft <= 0) {
        this.base = this.idle;
        if (this.active === this.walking) this.fadeTo(this.idle, false);
      }
    }
    if (this.timed) {
      const t = this.timed;
      if (this.active !== t.action) this.timed = null;
      else t.action.timeScale = t.action.time < t.at ? t.before : t.after;
    }
    this.mixer.update(dt);
    this.aim();
    this.release();
  }

  /** A thrown weapon is gone from the hand between its release and the moment a fresh one is drawn. */
  private release(): void {
    const r = this.carried.get(this.equipped)?.ranged;
    if (!r?.thrown) return;
    const a = r.action;
    const t = a.isScheduled() && a.getEffectiveWeight() > 0.5 ? a.time / a.getClip().duration : -1;
    r.thrown.prop.visible = !(t >= (this.hits.get(a) ?? 0) && t < r.thrown.back);
  }

  /** Point the equipped weapon's aimed props along the facing, blended by the weight of each clip kind playing. */
  private aim(): void {
    const c = this.carried.get(this.equipped);
    if (!c?.aims.length) return;
    const weight = (a: THREE.AnimationAction | undefined) => (a?.isScheduled() ? a.getEffectiveWeight() : 0);
    const kinds = { idle: weight(this.idle), strike: weight(c.strike), ranged: weight(c.ranged?.action) };
    for (const a of c.aims) {
      a.pivot.quaternion.copy(a.mounted);
      if (this.down) continue;
      let w = 0;
      let pitch = 0;
      for (const kind of ['idle', 'strike', 'ranged'] as const) {
        const p = a.pitch[kind];
        if (p === undefined) continue;
        w += kinds[kind];
        pitch += kinds[kind] * p;
      }
      if (w > 1e-3) this.point(a, pitch / w, Math.min(1, w));
    }
  }

  /** Turn the wrist, then the prop in the fist, so `a` points along the facing at `pitch`; `w` blends it in. */
  private point(a: AimedProp, pitch: number, w: number): void {
    const hand = a.pivot.parent!;
    hand.getWorldQuaternion(handWorld);
    want.set(0, Math.sin(pitch), Math.cos(pitch)).applyAxisAngle(UP, this.yaw);
    if (this.object.parent) want.applyQuaternion(this.object.parent.getWorldQuaternion(parentWorld));
    have.copy(a.tip).applyQuaternion(full.copy(handWorld).multiply(a.pivot.quaternion));
    full.setFromUnitVectors(have, want);
    turnBy.slerpQuaternions(NONE, full, w);
    const angle = 2 * Math.acos(Math.min(1, Math.abs(turnBy.w)));
    wristBy.slerpQuaternions(NONE, turnBy, angle > WRIST ? WRIST / angle : 1);
    // The wrist's share, turned in world space and re-expressed against the forearm.
    handWorld.premultiply(wristBy);
    hand.quaternion.copy(hand.parent!.getWorldQuaternion(parentWorld).invert().multiply(handWorld));
    if (angle <= WRIST) return;
    // The rest turns the prop in the fist: rest = turnBy·wristBy⁻¹, re-expressed in the turned hand's frame.
    rest.copy(turnBy).multiply(wristBy.invert());
    a.pivot.quaternion.premultiply(rest.premultiply(parentWorld.copy(handWorld).invert()).multiply(handWorld));
  }
}

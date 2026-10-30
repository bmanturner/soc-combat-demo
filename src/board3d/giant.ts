// The Trapped Nephilim: a giant pinned to the chest under the cave-in, one arm free and one crushed beneath stone.
// Anchored figure (never turns); the head and chest track the target from the smoothed yaw. The free arm is the
// whole combat vocabulary: crush, hurl, slam, the held sweep windup and the sweep itself.
// Local frame as in rig.ts, built at world size: x ∈ [-1.5, 1.5], z ∈ [-1, 1], +z toward the party.

import * as THREE from 'three';
import type { UnitState } from '../rules/types';
import { SKILLS } from '../content/gear';
import { Rig, TONE, box, cone, cyl, ico, key, type Keys, type Projectile, type StrikePlan } from './rig';

const UPPER = 0.8;
const FORE = 0.65;

/** Free-arm pose: swing (yaw about the shoulder), shoulder lift (rx, negative raises forward), elbow, wrist. */
interface ArmPose {
  swing: number;
  lift: number;
  elbow: number;
  wrist: number;
}

/** Lying on the mound's front edge, fist on the stones. */
const REST: ArmPose = { swing: 0.12, lift: -0.9, elbow: -0.55, wrist: 0.5 };
/** Held sweep windup: upper arm cocked out and up, forearm vertical, fist over the shoulder. */
const RAISED: ArmPose = { swing: 0.85, lift: -2.2, elbow: -0.6, wrist: 0.2 };

const nameOf = (def: { name: string } | undefined): string => def?.name ?? '';
const SWEEP = nameOf(SKILLS.nephilim_sweep);
const THROW = nameOf(SKILLS.rock_throw);
const ROCKFALL = nameOf(SKILLS.rockfall);

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Deterministic jitter keyed on position, so shared vertices of a flat-shaded icosphere move together. */
function rock(r: number, sx: number, sy: number, sz: number, seed: number): THREE.BufferGeometry {
  const g = ico(r, 1);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed * 4.1) * 43758.5453;
    const k = 1 + ((h - Math.floor(h)) - 0.5) * 0.34;
    p.setXYZ(i, x * k * sx, y * k * sy, z * k * sz);
  }
  g.computeVertexNormals();
  return g;
}

export class Giant extends Rig {
  readonly height = 2.1;
  private readonly chest: THREE.Group;
  private readonly head: THREE.Group;
  private readonly armBase: THREE.Group;
  private readonly shoulder: THREE.Group;
  private readonly elbow: THREE.Group;
  private readonly wrist: THREE.Group;
  private readonly pin: THREE.Group;
  private readonly pinHand: THREE.Group;
  private readonly eyes: THREE.Mesh[] = [];
  private readonly boulder: THREE.Mesh;
  private hold = false;
  private holdW = 0;
  /** After a sweep strike the board may refresh before the delayed effect is listed; don't drop the windup yet. */
  private grace = 0;

  constructor(u: UnitState) {
    super(u.id);
    const stone = [this.paint('#7d7366', 0, 0.95), this.paint('#6b6258', 0, 0.95), this.paint('#8a8073', 0, 0.95), this.paint('#5d554d', 0, 0.95)];
    const wood = this.paint(TONE.wood);
    const woodDark = this.paint('#5b3f26');
    const skin = this.paint('#9d7352');
    const skinDark = this.paint('#7f5a3e');
    const hair = this.paint('#2a1c13');
    const bronze = this.paint(TONE.bronze, 0.25, 0.45);
    const ink = this.paint(TONE.ink);
    const bone = this.paint(TONE.bone);
    const cloth = this.paint('#8d7a5a');

    // ---- Rubble mound (static): rocks across the footprint, chest-high behind and low at the front ----
    const rocks: [number, number, number, number, number, number, number, number][] = [
      // x, z, r, sy, groundY, sx, sz, tone
      [-0.95, -0.62, 0.62, 1.0, 0.38, 1, 1, 0],
      [1.0, -0.62, 0.6, 0.95, 0.36, 1, 1.05, 1],
      [0.0, -0.86, 0.56, 1.15, 0.52, 1.5, 0.8, 3],
      [-0.62, -0.1, 0.5, 0.8, 0.28, 1, 1, 2],
      [0.42, -0.08, 0.46, 0.8, 0.28, 1, 1, 0],
      [-0.12, 0.02, 0.42, 0.75, 0.24, 1.2, 0.9, 1],
      [-0.9, 0.0, 0.58, 0.7, 0.26, 1.1, 1, 3],
      [-1.08, 0.5, 0.4, 0.62, 0.18, 1, 1.1, 2],
      [-0.4, 0.62, 0.32, 0.6, 0.14, 1.1, 1, 0],
      [0.1, 0.66, 0.3, 0.55, 0.12, 1, 1, 1],
      [0.72, 0.42, 0.3, 0.7, 0.18, 1.2, 1, 3],
      [1.12, 0.22, 0.4, 0.7, 0.2, 1, 1, 2],
      [1.05, 0.7, 0.26, 0.6, 0.1, 1, 1, 0],
      [0.45, 0.78, 0.18, 0.7, 0.1, 1, 1, 2],
    ];
    rocks.forEach(([x, z, r, sy, y, sx, sz, tone], i) => {
      this.part(this.body, rock(r, sx, sy, sz, i + 1), stone[tone]!, x, y, z, 0, i * 0.9, 0).receiveShadow = true;
    });
    // Broken bridge timbers: a beam across the back, a plank slid down the left side, splintered ends.
    this.part(this.body, box(0.3, 0.24, 1.7), wood, 0.7, 0.98, -0.6, 0.12, -0.75, 0.1);
    this.part(this.body, cone(0.15, 0.34, 4).rotateX(Math.PI / 2), woodDark, 1.18, 1.0, -1.05, 0.12, -0.75, 0.1);
    this.part(this.body, box(0.22, 0.12, 1.3), woodDark, -1.15, 0.58, 0.3, 0.3, 0.2, 0.05);
    this.part(this.body, cone(0.1, 0.3, 4).rotateX(Math.PI / 2), wood, -1.07, 0.3, 0.96, 0.3, 0.2, 0.05);

    // ---- Buried torso: the body pivots at the waistline, half under the stones ----
    this.chest = this.joint(this.body, 0, 0.8, -0.5);
    this.part(this.chest, ico(0.62, 1).scale(1.18, 0.95, 0.82), skin, 0, 0.3, 0);
    this.part(this.chest, ico(0.5, 1).scale(1.1, 0.7, 0.8), skinDark, 0, -0.1, 0);
    // Heavy rope sash and a strip of torn cloth across the chest.
    this.part(this.chest, new THREE.TorusGeometry(0.55, 0.05, 4, 9).rotateX(Math.PI / 2).scale(1.15, 1, 0.82), this.paint(TONE.rope), 0, -0.05, 0);
    this.part(this.chest, box(0.22, 0.8, 0.06), cloth, -0.1, 0.35, 0.5, 0, 0, 0.55);
    for (const s of [1, -1]) this.part(this.chest, ico(0.27, 1), skin, s * 0.74, 0.5, 0.0);

    // Neck, bronze torque, head.
    this.part(this.chest, cyl(0.2, 0.26, 0.28, 7), skin, 0, 0.78, 0.04);
    this.part(this.chest, new THREE.TorusGeometry(0.27, 0.045, 4, 9).rotateX(Math.PI / 2), bronze, 0, 0.74, 0.04);
    this.head = this.joint(this.chest, 0, 0.82, 0.08);
    this.part(this.head, ico(0.31, 1).scale(1, 1.05, 0.96), skin, 0, 0.27, 0);
    this.part(this.head, box(0.34, 0.07, 0.12), skinDark, 0, 0.34, 0.27, -0.12);
    for (const s of [1, -1]) {
      const eye = this.part(this.head, box(0.07, 0.05, 0.03), bone, s * 0.11, 0.26, 0.29);
      this.part(this.head, box(0.035, 0.04, 0.03), ink, s * 0.11, 0.26, 0.305);
      // Tracked so squints (hit, dazed, KO) reset with the joints every frame.
      this.track(eye);
      this.eyes.push(eye);
    }
    this.part(this.head, cone(0.055, 0.17, 4).rotateX(Math.PI / 2), skinDark, 0, 0.18, 0.31);
    // Beard, hair cap, braids with bronze rings.
    this.part(this.head, ico(0.24, 1).scale(1, 0.95, 0.7), hair, 0, 0.06, 0.18);
    this.part(this.head, new THREE.SphereGeometry(0.325, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.5), hair, 0, 0.3, -0.03, -0.25);
    this.part(this.head, ico(0.2, 1).scale(1, 1.3, 0.8), hair, 0, 0.18, -0.26);
    for (const s of [1, -1]) {
      this.part(this.head, cyl(0.045, 0.03, 0.5, 5), hair, s * 0.3, 0.1, 0.02, 0, 0, s * 0.12);
      this.part(this.head, new THREE.TorusGeometry(0.05, 0.015, 3, 6).rotateX(Math.PI / 2), bronze, s * 0.33, -0.1, 0.02);
    }

    // ---- Pinned arm: a forearm and clawing hand out from under the slab ----
    this.pin = this.joint(this.body, -0.78, 0.42, 0.02);
    this.part(this.pin, cyl(0.17, 0.2, 0.62, 6), skin, 0, 0.02, 0.3, Math.PI / 2 - 0.18, 0, 0);
    this.pinHand = this.joint(this.pin, 0, -0.04, 0.6, 0.0);
    this.part(this.pinHand, ico(0.19, 1).scale(1.1, 0.7, 1.15), skin, 0, 0, 0.1);
    for (let i = 0; i < 4; i++) {
      const f = this.joint(this.pinHand, -0.12 + i * 0.08, 0, 0.24, 0.3);
      this.part(f, cyl(0.026, 0.02, 0.2, 4), skin, 0, 0, 0.08, Math.PI / 2);
    }

    // ---- Free arm ----
    this.armBase = this.joint(this.chest, 0.78, 0.5, 0.04, 0, REST.swing, 0);
    this.shoulder = this.joint(this.armBase, 0, 0, 0, REST.lift);
    this.part(this.shoulder, ico(0.26, 1), skin, 0, 0, 0);
    this.part(this.shoulder, cyl(0.2, 0.16, UPPER, 6), skin, 0, -UPPER / 2, 0);
    this.part(this.shoulder, new THREE.TorusGeometry(0.2, 0.04, 4, 8).rotateX(Math.PI / 2), bronze, 0, -0.3, 0);
    this.elbow = this.joint(this.shoulder, 0, -UPPER, 0, REST.elbow);
    this.part(this.elbow, ico(0.18, 1), skin, 0, 0, 0);
    this.part(this.elbow, cyl(0.16, 0.14, FORE, 6), skin, 0, -FORE / 2, 0);
    this.part(this.elbow, cyl(0.165, 0.165, 0.1, 6), bronze, 0, -FORE * 0.55, 0);
    this.wrist = this.joint(this.elbow, 0, -FORE, 0, REST.wrist);
    this.part(this.wrist, ico(0.24, 1).scale(1.1, 1, 1.12), skin, 0, -0.14, 0.02);
    for (let i = 0; i < 4; i++) this.part(this.wrist, ico(0.07), skinDark, -0.14 + i * 0.093, -0.3, 0.14);
    this.part(this.wrist, box(0.12, 0.18, 0.22), skin, 0.2, -0.08, 0.1, 0, 0, -0.3);
    // Hurled stone, only visible while in the fist.
    this.boulder = new THREE.Mesh(rock(0.36, 1, 0.9, 1, 9), stone[2]!);
    this.boulder.position.set(0, -0.36, 0.1);
    this.boulder.castShadow = true;
    this.boulder.visible = false;
    this.wrist.add(this.boulder);
  }

  protected override turnsBody(): boolean {
    return false;
  }

  override sync(u: UnitState): void {
    super.sync(u);
    if (u.ko) this.hold = false;
  }

  override pending(effects: readonly string[]): void {
    const sweeping = effects.includes(SWEEP);
    if (sweeping) {
      this.hold = true;
      return;
    }
    if (this.grace <= 0) this.hold = false;
  }

  override land(effect: string, ms: number): void {
    if (effect === SWEEP) {
      this.hold = false;
      this.grace = 0;
      this.holdW = 0;
      this.play('sweep', Math.max(260, ms));
    } else if (effect === ROCKFALL) {
      this.play('jolt', 420);
    }
  }

  override update(dtMs: number): void {
    this.grace = Math.max(0, this.grace - dtMs);
    const to = this.hold ? 1 : 0;
    const step = (dtMs / 1000) * (this.hold ? 5 : 3);
    this.holdW += Math.sign(to - this.holdW) * Math.min(step, Math.abs(to - this.holdW));
    super.update(dtMs);
  }

  protected strikePlan(_reach: number, attack: string): StrikePlan {
    if (attack === SWEEP) {
      this.hold = true;
      this.holdW = 1;
      this.grace = 1500;
      return { clip: 'raise', legs: 3 };
    }
    if (attack === THROW) return { clip: 'hurl', legs: 5, projectile: 'boulder' satisfies Projectile };
    if (attack === ROCKFALL) return { clip: 'slam', legs: 5 };
    // Crush (the free arm's weapon attack) and anything unforeseen.
    return { clip: 'crush', legs: 4 };
  }

  private arm(a: ArmPose): void {
    this.armBase.rotation.y = a.swing;
    this.shoulder.rotation.x = a.lift;
    this.elbow.rotation.x = a.elbow;
    this.wrist.rotation.x = a.wrist;
  }

  private aim(): number {
    const y = Math.atan2(Math.sin(this.yaw), Math.cos(this.yaw));
    return Math.max(-0.6, Math.min(0.6, y));
  }

  protected poseStance(_t: number, _life: number): void {
    this.boulder.visible = false;
    const w = this.holdW * this.holdW * (3 - 2 * this.holdW);
    this.arm({
      swing: lerp(REST.swing, RAISED.swing, w),
      lift: lerp(REST.lift, RAISED.lift, w),
      elbow: lerp(REST.elbow, RAISED.elbow, w),
      wrist: lerp(REST.wrist, RAISED.wrist, w),
    });
  }

  protected poseIdle(t: number, life: number): void {
    const aim = this.aim();
    const breath = Math.sin(t * 1.7);
    // Slow heaves: now and then he strains against the stone.
    const heave = Math.max(0, Math.sin(t * 0.55 + 1)) ** 3;
    const strain = Math.sin(t * 7.3) * 0.012 * heave;
    this.chest.rotation.x = (0.05 + breath * 0.03 + heave * 0.14) * life;
    this.chest.rotation.y = aim * 0.3;
    this.chest.rotation.z = Math.sin(t * 0.9) * 0.025 * life + strain;
    this.chest.scale.set(1 + breath * 0.015 * life, 1 + breath * 0.03 * life, 1);
    this.head.rotation.y = aim * 0.7;
    this.head.rotation.x = (-0.05 + heave * 0.1 - breath * 0.02) * life;
    // Free arm shifts weight with the strain.
    const w = 1 - this.holdW;
    this.shoulder.rotation.x += (-heave * 0.12 + breath * 0.02) * w * life;
    this.elbow.rotation.x += heave * 0.1 * w * life;
    this.wrist.rotation.x += Math.sin(t * 2.1) * 0.05 * w * life;
    // Pinned hand twitches and claws.
    this.pin.rotation.y = Math.sin(t * 1.3) * 0.06 + heave * Math.sin(t * 9) * 0.05;
    this.pin.rotation.x = -heave * 0.06;
    this.pinHand.rotation.x = 0 + Math.sin(t * 2.6 + 1) * 0.12 + heave * 0.2;
    this.pinHand.rotation.z = Math.sin(t * 3.7) * 0.1 * life;
  }

  protected poseStride(_phase: number, _weight: number): void {}

  protected poseClip(kind: string, p: number): void {
    const swing = (keys: Keys) => key(p, keys);
    switch (kind) {
      case 'raise': {
        const a = key(p, [[0, 0], [0.25, 0.12], [1, 1]]);
        this.arm({
          swing: lerp(REST.swing, RAISED.swing, a),
          lift: lerp(REST.lift, RAISED.lift, a),
          elbow: lerp(REST.elbow, RAISED.elbow, a),
          wrist: lerp(REST.wrist, RAISED.wrist, a),
        });
        this.chest.rotation.x += key(p, [[0, 0], [0.5, -0.18], [1, -0.1]]);
        this.chest.rotation.y += key(p, [[0, 0], [1, 0.3]]);
        this.head.rotation.x += key(p, [[0, 0], [0.6, -0.12], [1, -0.05]]);
        break;
      }
      case 'sweep': {
        this.arm({
          swing: swing([[0, RAISED.swing], [0.1, RAISED.swing + 0.2], [0.5, -1.5], [0.7, -1.4], [1, REST.swing]]),
          lift: swing([[0, RAISED.lift], [0.1, RAISED.lift - 0.1], [0.4, -1.3], [0.7, -1.2], [1, REST.lift]]),
          elbow: swing([[0, RAISED.elbow], [0.4, -0.08], [0.7, -0.2], [1, REST.elbow]]),
          wrist: swing([[0, RAISED.wrist], [0.4, 0], [1, REST.wrist]]),
        });
        this.chest.rotation.y += swing([[0, 0.3], [0.1, 0.4], [0.5, -0.5], [1, 0]]);
        this.chest.rotation.x += swing([[0, -0.1], [0.3, 0.2], [1, 0]]);
        this.head.rotation.y += swing([[0, 0], [0.5, 0.2], [1, 0]]);
        this.body.position.y += Math.max(0, Math.sin(p * Math.PI * 6)) * 0.03 * (1 - p) * (p > 0.4 ? 1 : 0);
        break;
      }
      case 'crush': {
        this.arm({
          swing: REST.swing,
          lift: swing([[0, REST.lift], [0.38, -2.35], [0.52, -1.0], [0.62, -0.95], [1, REST.lift]]),
          elbow: swing([[0, REST.elbow], [0.38, -0.9], [0.52, -0.15], [0.62, -0.2], [1, REST.elbow]]),
          wrist: swing([[0, REST.wrist], [0.38, 0.2], [0.52, 0.2], [1, REST.wrist]]),
        });
        this.chest.rotation.x += swing([[0, 0], [0.35, -0.2], [0.52, 0.3], [1, 0]]);
        this.head.rotation.x += swing([[0, 0], [0.5, 0.15], [1, 0]]);
        this.body.position.y += p > 0.5 ? Math.sin((p - 0.5) * Math.PI * 10) * 0.05 * (1 - p) * 2 : 0;
        break;
      }
      case 'hurl': {
        this.arm({
          swing: swing([[0, REST.swing], [0.3, 0.3], [0.62, 0], [1, REST.swing]]),
          lift: swing([[0, REST.lift], [0.28, -0.15], [0.45, -0.35], [0.62, -2.85], [0.78, -1.9], [1, REST.lift]]),
          elbow: swing([[0, REST.elbow], [0.28, -0.1], [0.45, -0.7], [0.62, -0.1], [1, REST.elbow]]),
          wrist: swing([[0, REST.wrist], [0.3, 0.1], [0.62, 0.4], [1, REST.wrist]]),
        });
        this.boulder.visible = p > 0.27 && p < 0.6;
        this.chest.rotation.x += swing([[0, 0], [0.3, -0.12], [0.45, -0.28], [0.65, 0.3], [1, 0]]);
        this.head.rotation.x += swing([[0, 0], [0.62, 0.12], [1, 0]]);
        break;
      }
      case 'slam': {
        this.arm({
          swing: swing([[0, REST.swing], [0.4, 0.3], [0.72, 0.1], [1, REST.swing]]),
          lift: swing([[0, REST.lift], [0.4, -3.0], [0.55, -3.05], [0.72, -1.0], [0.8, -0.95], [1, REST.lift]]),
          elbow: swing([[0, REST.elbow], [0.4, -0.15], [0.72, -0.1], [1, REST.elbow]]),
          wrist: swing([[0, REST.wrist], [0.5, 0], [0.72, 0.3], [1, REST.wrist]]),
        });
        this.chest.rotation.x += swing([[0, 0], [0.4, -0.25], [0.55, -0.3], [0.72, 0.35], [1, 0]]);
        this.head.rotation.x += swing([[0, 0], [0.45, -0.35], [0.72, 0.2], [1, 0]]);
        this.body.position.y += p > 0.72 ? Math.sin((p - 0.72) * Math.PI * 14) * 0.06 * (1 - p) * 3 : 0;
        break;
      }
      case 'jolt': {
        const k = Math.sin(p * Math.PI * 5) * (1 - p);
        this.chest.rotation.z += k * 0.05;
        this.head.rotation.x += k * 0.08;
        this.body.position.y += k * 0.03;
        break;
      }
      case 'hit': {
        const k = Math.sin(p * Math.PI);
        this.chest.rotation.x += -0.3 * k;
        this.chest.rotation.z += Math.sin(p * Math.PI * 3) * 0.06 * (1 - p);
        this.head.rotation.x += -0.3 * k;
        this.shoulder.rotation.x += -0.2 * k * (1 - this.holdW);
        for (const e of this.eyes) e.scale.y = 1 - 0.8 * k;
        break;
      }
      default:
        break;
    }
  }

  protected poseDazed(t: number, life: number): void {
    this.head.rotation.z += Math.sin(t * 3.1) * 0.2 * life;
    this.head.rotation.x += Math.sin(t * 2.3) * 0.14 * life;
    this.head.rotation.y += Math.sin(t * 1.7) * 0.25 * life;
    this.chest.rotation.z += Math.sin(t * 2.2) * 0.05 * life;
    for (const e of this.eyes) e.scale.y = 0.45;
  }

  protected poseFeared(_life: number): void {}

  protected poseDown(e: number): void {
    // Slump forward into the rubble, free arm dropping to lie limp.
    this.chest.rotation.x = lerp(this.chest.rotation.x, 0.8, e);
    this.chest.rotation.y *= 1 - e;
    this.chest.rotation.z *= 1 - e;
    this.chest.position.y -= 0.22 * e;
    this.chest.position.z += 0.1 * e;
    this.head.rotation.x = lerp(this.head.rotation.x, 0.55, e);
    this.head.rotation.y *= 1 - e;
    this.head.rotation.z *= 1 - e;
    this.armBase.rotation.y = lerp(this.armBase.rotation.y, 0.35, e);
    this.shoulder.rotation.x = lerp(this.shoulder.rotation.x, -1.0, e);
    this.elbow.rotation.x = lerp(this.elbow.rotation.x, -0.15, e);
    this.wrist.rotation.x = lerp(this.wrist.rotation.x, 0.9, e);
    this.pinHand.rotation.x = lerp(this.pinHand.rotation.x, 0.4, e);
    this.pinHand.rotation.z *= 1 - e;
    this.pin.rotation.y *= 1 - e;
    this.boulder.visible = false;
    for (const eye of this.eyes) eye.scale.y = lerp(eye.scale.y, 0.12, e);
  }
}

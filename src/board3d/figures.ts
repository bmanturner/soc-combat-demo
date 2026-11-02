// Procedural low-poly unit figures for the 3D board, built on Rig (rig.ts): humanoids dressed by a per-unit look
// with weapon props and armour by class, and quadrupeds from a body spec. Templates with a generated model (models.ts)
// use ModelFigure once their files are loaded. Units without a figure keep the lathe pawn (see makeToken), so new unit
// templates still appear before they get a figure.

import * as THREE from 'three';
import type { ArmorClass, UnitState, WeaponFamily } from '../rules/types';
import { WEAPONS } from '../content/gear';
import { isAreaEffect, isRangedAttack } from './attacks';
import { Giant } from './giant';
import { ModelFigure } from './model-figure';
import { modelsReady, unitModelFor, unitModelSlugs } from './models';
import { Rig, TONE, box, cone, cyl, ico, key, phaseSeed, rod, UP, type Figure, type Keys, type StrikePlan } from './rig';

export type { Figure } from './rig';

export function makeFigure(u: UnitState): Figure | null {
  const model = unitModelFor(u);
  if (model && modelsReady(unitModelSlugs(model, u))) return new ModelFigure(u, model);
  const look = LOOKS[u.templateId];
  if (look) return new Humanoid(u, look);
  if (u.templateId === 'wolf') return new Beast(u, wolfSpec(u.name));
  if (u.templateId === 'small_rat' || u.templateId === 'brood_rat') return new Beast(u, ratSpec(u.id));
  if (u.templateId === 'large_rat') return new Beast(u, largeRatSpec(u.id));
  if (u.templateId === 'rat_brood_mother') return new Beast(u, broodSpec(u.id));
  if (u.templateId === 'nephilim') return new Giant(u);
  return null;
}

// ---------------- Weapon props ----------------

/** Where a carried weapon rides when stowed: diagonal across the back, flat on the back, or at the hips. */
type Stow = 'long' | 'shield' | 'short';
type Stance = 'bare' | 'pair' | 'shield' | 'pole' | 'heavy' | 'bow' | 'crossbow' | 'shieldPole' | 'staff';
/** Prop to build: the weapon family, except unit weapons with their own shape. */
type PropKind = WeaponFamily | 'club' | 'khopesh';

function propKind(weaponId: string): PropKind {
  if (weaponId === 'shepherds_club') return 'club';
  if (weaponId === 'cultist_blade') return 'khopesh';
  if (weaponId === 'bandit_blade') return 'shield';
  if (weaponId === 'bandit_bow') return 'bow';
  return WEAPONS[weaponId]?.family ?? 'natural';
}

interface Mats {
  bronze: THREE.Material;
  wood: THREE.Material;
  leather: THREE.Material;
  hide: THREE.Material;
  stone: THREE.Material;
  string: THREE.Material;
  /** Painted cult shields and staffs. */
  soot: THREE.Material;
}

/** Bow whose string and nocked arrow follow the draw. */
class BowProp {
  readonly root = new THREE.Group();
  private readonly upper: THREE.Mesh;
  private readonly lower: THREE.Mesh;
  private readonly arrow = new THREE.Group();
  private static readonly TIP = 0.22;
  private static readonly REST = 0.075;

  constructor(m: Mats, meshes: THREE.Mesh[]) {
    const add = (g: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D = this.root) => {
      const mesh = new THREE.Mesh(g, mat);
      mesh.castShadow = true;
      parent.add(mesh);
      meshes.push(mesh);
      return mesh;
    };
    for (const s of [1, -1]) {
      add(rod(0.009, [0, 0, 0], [0, 0.035, s * 0.12]), m.wood);
      add(rod(0.008, [0, 0.035, s * 0.12], [0, BowProp.REST, s * BowProp.TIP]), m.wood);
    }
    add(cyl(0.014, 0.014, 0.05, 5).rotateX(Math.PI / 2), m.leather);
    const unit = () => cyl(0.0025, 0.0025, 1, 3).translate(0, 0.5, 0);
    this.upper = add(unit(), m.string);
    this.lower = add(unit(), m.string);
    add(rod(0.005, [0, 0, 0], [0, -0.28, 0], 4), m.wood, this.arrow);
    add(cone(0.012, 0.035, 4).rotateX(Math.PI), m.bronze, this.arrow).position.y = -0.29;
    this.root.add(this.arrow);
    this.root.userData.stow = 'long' satisfies Stow;
    this.draw(0);
  }

  draw(d: number): void {
    const nock = new THREE.Vector3(0, BowProp.REST + 0.17 * d, 0);
    for (const [mesh, s] of [[this.upper, 1], [this.lower, -1]] as const) {
      const tip = new THREE.Vector3(0, BowProp.REST, s * BowProp.TIP);
      const dir = nock.clone().sub(tip);
      mesh.position.copy(tip);
      mesh.scale.set(1, dir.length(), 1);
      mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
    }
    this.arrow.visible = d > 0.05;
    this.arrow.position.copy(nock);
  }
}

interface Held {
  R?: THREE.Object3D;
  L?: THREE.Object3D;
  bow?: BowProp;
  bolt?: THREE.Object3D;
}

/** Build a weapon's in-hand parts; grips sit at each part's origin with the business end along +z. */
function buildWeapon(kind: PropKind, m: Mats, meshes: THREE.Mesh[]): Held | null {
  const group = (stow: Stow, ...parts: [THREE.BufferGeometry, THREE.Material][]): THREE.Group => {
    const g = new THREE.Group();
    for (const [geometry, material] of parts) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      g.add(mesh);
      meshes.push(mesh);
    }
    g.userData.stow = stow;
    return g;
  };
  const blade = (len: number, width: number, stow: Stow) =>
    group(
      stow,
      [rod(0.011, [0, 0, -0.035], [0, 0, 0.03]), m.leather],
      [ico(0.016).translate(0, 0, -0.042), m.bronze],
      [box(0.014, width * 2.4, 0.014).translate(0, 0, 0.034), m.bronze],
      [box(0.008, width, len).translate(0, 0, 0.04 + len / 2), m.bronze],
      [cone(width / 2, width * 1.4, 4).rotateX(Math.PI / 2).scale(0.3, 1, 1).translate(0, 0, 0.04 + len + width * 0.7), m.bronze],
    );
  /** Disc in front of the fist (hand -y), so a raised forearm presents it forward; `tall` stretches it upward. */
  const shield = (r: number, face: THREE.Material, tall = 1) =>
    group(
      'shield',
      [cyl(r, r, 0.02, 10).scale(1, 1, tall).translate(0, -0.035, 0), face],
      [new THREE.TorusGeometry(r, 0.01, 3, 12).rotateX(Math.PI / 2).scale(1, 1, tall).translate(0, -0.035, 0), m.bronze],
      [ico(0.032).translate(0, -0.05, 0), m.bronze],
    );
  // Shape plane (along the haft, outward) → hand space (z, -y); extrusion → x. The edge leads the downswing.
  const flatHead = (shape: THREE.Shape, depth: number) =>
    new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 4 })
      .applyMatrix4(new THREE.Matrix4().set(0, 0, 1, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1))
      .translate(-depth / 2, 0, 0);
  switch (kind) {
    case 'daggers':
      return { R: blade(0.1, 0.026, 'short'), L: blade(0.1, 0.026, 'short') };
    case 'dual_wield':
      return { R: blade(0.19, 0.03, 'short'), L: blade(0.19, 0.03, 'short') };
    case 'shield':
      return { R: blade(0.22, 0.034, 'long'), L: shield(0.12, m.hide) };
    case 'polearm':
      return {
        R: group(
          'long',
          [rod(0.0105, [0, 0, -0.24], [0, 0, 0.5]), m.wood],
          [cyl(0.014, 0.014, 0.03, 5).rotateX(Math.PI / 2).translate(0, 0, 0.5), m.bronze],
          [cone(0.027, 0.11, 4).rotateX(Math.PI / 2).scale(0.35, 1, 1).translate(0, 0, 0.565), m.bronze],
        ),
      };
    case 'javelin_shield':
      return {
        R: group('long', [rod(0.009, [0, 0, -0.16], [0, 0, 0.36]), m.wood], [cone(0.02, 0.075, 4).rotateX(Math.PI / 2).scale(0.4, 1, 1).translate(0, 0, 0.395), m.bronze]),
        L: shield(0.13, m.hide),
      };
    case 'two_handed': {
      const crescent = new THREE.Shape();
      crescent.moveTo(0.34, -0.012);
      crescent.lineTo(0.4, -0.012);
      crescent.lineTo(0.47, 0.1);
      crescent.quadraticCurveTo(0.37, 0.145, 0.27, 0.1);
      crescent.lineTo(0.34, -0.012);
      return { R: group('long', [rod(0.012, [0, 0, -0.1], [0, 0, 0.44]), m.wood], [flatHead(crescent, 0.014), m.bronze]) };
    }
    case 'colossal':
      return {
        R: group(
          'long',
          [rod(0.014, [0, 0, -0.12], [0, 0, 0.47]), m.wood],
          [box(0.085, 0.17, 0.09).translate(0, 0, 0.5), m.stone],
          [box(0.092, 0.03, 0.097).translate(0, 0.06, 0.5), m.bronze],
          [box(0.092, 0.03, 0.097).translate(0, -0.06, 0.5), m.bronze],
        ),
      };
    case 'club':
      // Jabal's shepherd's club: a knobbed cudgel of root wood.
      return {
        R: group(
          'long',
          [rod(0.015, [0, 0, -0.1], [0, 0, 0.3], 6), m.wood],
          [ico(0.055).scale(1, 0.9, 1.15).translate(0, 0, 0.34), m.leather],
          [ico(0.022).translate(0.03, 0.02, 0.27), m.leather],
          [ico(0.02).translate(-0.025, -0.03, 0.3), m.leather],
        ),
      };
    case 'khopesh': {
      // Bronze sickle-sword and a tall soot-painted shield.
      const sickle = new THREE.Shape();
      sickle.moveTo(0.03, -0.01);
      sickle.lineTo(0.15, -0.012);
      sickle.quadraticCurveTo(0.27, -0.02, 0.29, 0.07);
      sickle.quadraticCurveTo(0.25, 0.03, 0.17, 0.02);
      sickle.lineTo(0.03, 0.012);
      sickle.lineTo(0.03, -0.01);
      return {
        R: group('long', [rod(0.012, [0, 0, -0.04], [0, 0, 0.035]), m.leather], [ico(0.016).translate(0, 0, -0.046), m.bronze], [flatHead(sickle, 0.01), m.bronze]),
        L: shield(0.12, m.soot, 1.5),
      };
    }
    case 'staff':
      // Ritual staff with a horned bronze finial.
      return {
        R: group(
          'long',
          [rod(0.012, [0, 0, -0.34], [0, 0, 0.36], 6), m.soot],
          [cyl(0.02, 0.016, 0.04, 6).rotateX(Math.PI / 2).translate(0, 0, 0.37), m.bronze],
          [rod(0.009, [0, 0, 0.39], [0.05, 0, 0.45]), m.bronze],
          [rod(0.009, [0, 0, 0.39], [-0.05, 0, 0.45]), m.bronze],
          [rod(0.007, [0.05, 0, 0.45], [0.035, 0, 0.5]), m.bronze],
          [rod(0.007, [-0.05, 0, 0.45], [-0.035, 0, 0.5]), m.bronze],
        ),
      };
    case 'bow': {
      const bow = new BowProp(m, meshes);
      return { L: bow.root, bow };
    }
    case 'crossbow': {
      const R = group(
        'long',
        [box(0.035, 0.04, 0.3).translate(0, 0, 0.06), m.wood],
        [rod(0.009, [0, 0.015, 0.19], [0.14, 0.015, 0.14]), m.wood],
        [rod(0.009, [0, 0.015, 0.19], [-0.14, 0.015, 0.14]), m.wood],
        [rod(0.0025, [0.14, 0.015, 0.14], [0, 0.015, 0.08], 3), m.string],
        [rod(0.0025, [-0.14, 0.015, 0.14], [0, 0.015, 0.08], 3), m.string],
      );
      const bolt = group('long', [rod(0.006, [0, 0.03, 0.08], [0, 0.03, 0.24], 4), m.wood], [cone(0.011, 0.03, 4).rotateX(Math.PI / 2).translate(0, 0.03, 0.25), m.bronze]);
      R.add(bolt);
      return { R, bolt };
    }
    case 'natural':
      return null;
  }
}

const STANCE: Record<PropKind, Stance> = {
  daggers: 'pair',
  dual_wield: 'pair',
  shield: 'shield',
  khopesh: 'shield',
  polearm: 'pole',
  javelin_shield: 'shieldPole',
  two_handed: 'heavy',
  colossal: 'heavy',
  club: 'heavy',
  bow: 'bow',
  crossbow: 'crossbow',
  staff: 'staff',
  natural: 'bare',
};

const MELEE: Record<PropKind, string> = {
  daggers: 'stab',
  dual_wield: 'slash',
  shield: 'slash',
  khopesh: 'slash',
  polearm: 'thrust',
  javelin_shield: 'thrust',
  two_handed: 'cleave',
  colossal: 'cleave',
  club: 'cleave',
  bow: 'shoot',
  crossbow: 'bolt',
  staff: 'jab',
  natural: 'stab',
};

/** Arm offsets: shoulder pitch (negative raises forward), inward swing, outward lift, elbow bend, wrist tilt. */
type Arm = readonly [sx: number, sy: number, sz: number, ex: number, wx: number];
const RELAXED: Arm = [0, 0, 0.12, -0.35, 0];
const READY: Arm = [-0.25, 0, 0.1, -0.6, 0.2];
const GUARD: Arm = [-0.5, 0.45, 0, -1.1, 0];
const STANCE_ARMS: Record<Stance, readonly [L: Arm, R: Arm]> = {
  bare: [RELAXED, RELAXED],
  pair: [READY, READY],
  shield: [GUARD, READY],
  pole: [[-0.45, 0.35, 0, -0.8, 0], [-0.35, 0, 0.1, -0.9, 0.9]],
  shieldPole: [GUARD, [-0.3, 0, 0.15, -0.9, 0.5]],
  heavy: [[-0.35, 0.55, 0, -0.9, 0], [-0.2, 0, 0.12, -0.9, -0.2]],
  bow: [[-0.2, 0, 0.15, -0.5, 0], RELAXED],
  crossbow: [[-0.6, 0.35, 0, -0.9, 0], [-0.6, 0, 0, -0.9, 1.5]],
  // Staff planted upright beside the body.
  staff: [RELAXED, [-0.3, 0, 0.18, -1.0, -0.27]],
};

// ---------------- Humanoids ----------------

/** How a humanoid is dressed. Colors stay earthy and unsaturated; side color lives on the token, not the cloth. */
interface Look {
  robe: string;
  tunic: string;
  skin: string;
  hair: string;
  /** Torso and shoulder width. */
  build: number;
  scale: number;
  head: { kind: 'band'; color: string } | { kind: 'wrap'; color: string } | { kind: 'hood'; color: string };
  beard?: string;
  /** Ash band across the eyes. */
  facePaint?: string;
  lyre?: boolean;
  /** Fleece mantle over the shoulders. */
  fleece?: string;
  quiver?: boolean;
}

/** Looks are demo proposals for Aaron's characters, not canon. */
const LOOKS: Record<string, Look> = {
  // Jubal: young Cainite musician; rope-tied robe, headband, lyre ("father of all who play the lyre").
  jubal: { robe: TONE.robe, tunic: TONE.tunic, skin: TONE.skin, hair: TONE.hair, build: 1, scale: 1, head: { kind: 'band', color: TONE.rope }, lyre: true },
  // Jabal: shepherd and tent-dweller; undyed wool, headwrap, beard, fleece mantle, bulkier.
  jabal: { robe: '#8f7a5c', tunic: '#6f5a40', skin: '#a8704a', hair: '#3a2a1c', build: 1.15, scale: 1.05, head: { kind: 'wrap', color: '#a08660' }, beard: '#3a2a1c', fleece: '#e2d9c6' },
  // Hired Archer: valley-village mercenary; olive hood, leather, quiver.
  hired_archer: { robe: '#7a7458', tunic: '#5c4a34', skin: '#b5815a', hair: '#4a3324', build: 0.95, scale: 1, head: { kind: 'hood', color: '#5d5c3c' }, quiver: true },
  // Cultist Zealot: black robes, hood, the shield wall. Charcoal rather than true black so they separate from the shrine floor.
  cultist_fighter: { robe: '#3a332e', tunic: '#2e2824', skin: '#a6714d', hair: '#1b1410', build: 1.1, scale: 1.02, head: { kind: 'hood', color: '#332d29' } },
  // Cultist Seer: black hood, ash-white paint across the eyes.
  cultist_mage: { robe: '#352f2a', tunic: '#2a2521', skin: '#a6714d', hair: '#1b1410', build: 0.92, scale: 1.03, head: { kind: 'hood', color: '#2c2723' }, facePaint: '#ddd6c8' },
  // Bandits: demo looks (wiki silent on costume).
  bandit_fighter: { robe: '#6b5a44', tunic: '#4f3f2e', skin: '#a8724c', hair: '#2e2118', build: 1.1, scale: 1.02, head: { kind: 'wrap', color: '#7a5a3a' }, beard: '#2e2118' },
  bandit_archer: { robe: '#6f6248', tunic: '#53432f', skin: '#b07a52', hair: '#3a2a1c', build: 0.95, scale: 1, head: { kind: 'hood', color: '#5a4a34' }, quiver: true },
};

/**
 * A dressed humanoid: holds the equipped weapon (the other carried one stowed), wears armour by class over the robe
 * (heaviest change on the head and shoulders the camera sees).
 */
class Humanoid extends Rig {
  private readonly hips: THREE.Group;
  private readonly torso: THREE.Group;
  private readonly head: THREE.Group;
  /** Index 0 = left (+x), 1 = right (-x). */
  private readonly shoulder: [THREE.Group, THREE.Group];
  private readonly elbow: [THREE.Group, THREE.Group];
  private readonly wrist: [THREE.Group, THREE.Group];
  private readonly leg: [THREE.Group, THREE.Group];
  private readonly mats: Mats;
  private readonly hair: THREE.Material;
  /** Darker bronze: scale rows, cuirass ridge, helmet rim. */
  private readonly shade: THREE.Material;
  private readonly build: number;
  private armor: ArmorClass | null = null;
  private armorParts: THREE.Mesh[] = [];
  private loadout = '';
  private held: Held = {};
  private stowed: THREE.Object3D[] = [];
  private kind: PropKind = 'natural';
  private stance: Stance = 'bare';
  readonly height: number;

  constructor(u: UnitState, look: Look) {
    super(u.id);
    this.build = look.build;
    this.height = 0.7 * look.scale;
    this.body.scale.setScalar(look.scale);
    this.track(this.body);
    const robe = this.paint(look.robe);
    const tunic = this.paint(look.tunic);
    const skin = this.paint(look.skin);
    const hair = this.paint(look.hair);
    this.hair = hair;
    const rope = this.paint(TONE.rope);
    const ink = this.paint(TONE.ink);
    this.mats = {
      // Low metalness: with no environment map to reflect, metallic bronze renders as muddy brown.
      bronze: this.paint(TONE.bronze, 0.25, 0.45),
      wood: this.paint(TONE.wood),
      leather: this.paint(TONE.leather),
      hide: this.paint(TONE.hide),
      stone: this.paint(TONE.stone),
      string: this.paint(TONE.string),
      soot: this.paint('#2b2420'),
    };
    this.shade = this.paint(TONE.bronzeShade, 0.2, 0.6);
    const b = look.build;

    this.hips = this.joint(this.body, 0, 0.3, 0);
    this.part(this.hips, cyl(0.1 * b, 0.15 * b, 0.26, 7), robe, 0, -0.13, 0);
    const legs: THREE.Group[] = [];
    for (const s of [1, -1]) {
      const leg = this.joint(this.hips, s * 0.05 * b, -0.02, 0);
      this.part(leg, cyl(0.022, 0.02, 0.23, 5), skin, 0, -0.125, 0);
      this.part(leg, box(0.05, 0.035, 0.085), this.mats.leather, 0, -0.2625, 0.015);
      legs.push(leg);
    }
    this.leg = [legs[0]!, legs[1]!];

    this.torso = this.joint(this.hips, 0, 0, 0);
    this.part(this.torso, cyl(0.105 * b, 0.088 * b, 0.21, 7), tunic, 0, 0.105, 0);
    this.part(this.torso, new THREE.TorusGeometry(0.093 * b, 0.014, 4, 9).rotateX(Math.PI / 2), rope, 0, 0.01, 0);
    if (look.lyre || look.quiver) {
      // Carrying strap across the chest and back.
      this.part(this.torso, box(0.022, 0.26, 0.012), rope, 0, 0.11, 0.098 * b, 0, 0, 0.6);
      this.part(this.torso, box(0.022, 0.26, 0.012), rope, 0, 0.11, -0.098 * b, 0, 0, -0.6);
    }

    this.head = this.joint(this.torso, 0, 0.215, 0);
    this.part(this.head, cyl(0.035, 0.04, 0.04, 6), skin, 0, 0.01, 0);
    this.part(this.head, ico(0.085, 1), skin, 0, 0.085, 0.005);
    if (look.facePaint) this.part(this.head, new THREE.SphereGeometry(0.088, 8, 3, Math.PI / 2 - 0.75, 1.5, Math.PI * 0.36, Math.PI * 0.16), this.paint(look.facePaint), 0, 0.085, 0.005);
    for (const s of [1, -1]) this.part(this.head, box(0.016, 0.022, 0.01), ink, s * 0.03, 0.09, 0.088);
    this.part(this.head, cone(0.012, 0.03, 4).rotateX(Math.PI / 2), skin, 0, 0.07, 0.092);
    if (look.beard) this.part(this.head, ico(0.058).scale(1.05, 0.95, 0.75), this.paint(look.beard), 0, 0.035, 0.05);
    const headwear = this.paint(look.head.color);
    if (look.head.kind === 'band') {
      this.part(this.head, new THREE.SphereGeometry(0.091, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.5), hair, 0, 0.09, -0.01, -0.35);
      this.part(this.head, ico(0.035), hair, 0, 0.06, -0.085);
      this.part(this.head, new THREE.TorusGeometry(0.088, 0.008, 3, 10).rotateX(Math.PI / 2), headwear, 0, 0.115, -0.004, -0.2);
    } else if (look.head.kind === 'wrap') {
      // Cloth wrapped over the crown, a thick band and a tail falling behind.
      this.part(this.head, new THREE.SphereGeometry(0.094, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.38), headwear, 0, 0.09, -0.006, -0.2);
      this.part(this.head, new THREE.TorusGeometry(0.09, 0.013, 4, 10).rotateX(Math.PI / 2), headwear, 0, 0.105, -0.004, -0.2);
      this.part(this.head, box(0.05, 0.11, 0.016), headwear, 0, 0.05, -0.095, 0.25);
    } else {
      // Hood open at the face, falling into a cowl on the shoulders.
      const hood = new THREE.MeshStandardMaterial({ color: look.head.color, roughness: 0.9, flatShading: true, side: THREE.DoubleSide });
      this.materials.push(hood);
      this.part(this.head, new THREE.SphereGeometry(0.104, 9, 6, Math.PI / 2 + 1.1, Math.PI * 2 - 2.2, 0, Math.PI * 0.66), hood, 0, 0.088, -0.012, -0.28);
      this.part(this.head, cyl(0.075, 0.13 * b, 0.07, 8), hood, 0, -0.005, -0.01);
    }

    const shoulders: THREE.Group[] = [];
    const elbows: THREE.Group[] = [];
    const wrists: THREE.Group[] = [];
    for (const s of [1, -1]) {
      const sh = this.joint(this.torso, s * 0.118 * b, 0.185, 0);
      this.part(sh, ico(0.042), robe);
      this.part(sh, cyl(0.036, 0.03, 0.12, 6), robe, 0, -0.06, 0);
      const el = this.joint(sh, 0, -0.12, 0);
      this.part(el, cyl(0.027, 0.023, 0.1, 6), skin, 0, -0.05, 0);
      const wr = this.joint(el, 0, -0.105, 0);
      this.part(wr, ico(0.03), skin, 0, -0.01, 0);
      shoulders.push(sh);
      elbows.push(el);
      wrists.push(wr);
    }
    this.shoulder = [shoulders[0]!, shoulders[1]!];
    this.elbow = [elbows[0]!, elbows[1]!];
    this.wrist = [wrists[0]!, wrists[1]!];

    const { wood, bronze, string, leather } = this.mats;
    if (look.fleece) {
      // Sheep's fleece mantle: a shaggy ring over the shoulders that reads from above.
      const fleece = this.paint(look.fleece, 0, 1);
      this.part(this.torso, new THREE.TorusGeometry(0.1 * b, 0.045, 5, 9).rotateX(Math.PI / 2), fleece, 0, 0.19, -0.005);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        this.part(this.torso, ico(0.042), fleece, Math.sin(a) * 0.11 * b, 0.17 + 0.012 * (i % 2), Math.cos(a) * 0.11 * b - 0.005);
      }
    }
    if (look.lyre) {
      // Lyre slung low on the back, left of the spine. Hangs clear of any cuirass.
      const lyre = new THREE.Group();
      lyre.position.set(0.045, 0.02, -0.124 * b);
      lyre.rotation.set(0.12, 0, 0.35);
      this.torso.add(lyre);
      this.part(lyre, box(0.1, 0.045, 0.03), wood);
      for (const s of [1, -1]) {
        this.part(lyre, rod(0.009, [s * 0.04, 0.02, 0], [s * 0.066, 0.09, 0]), wood);
        this.part(lyre, rod(0.008, [s * 0.066, 0.09, 0], [s * 0.05, 0.15, 0]), wood);
      }
      this.part(lyre, rod(0.008, [-0.062, 0.148, 0], [0.062, 0.148, 0]), bronze);
      for (const x of [-0.024, -0.008, 0.008, 0.024]) this.part(lyre, rod(0.0025, [x, 0.02, -0.016], [x, 0.148, -0.016], 3), string);
    }
    if (look.quiver) {
      // Quiver over the right shoulder, fletchings showing.
      const quiver = new THREE.Group();
      quiver.position.set(-0.03, 0.1, -0.13 * b);
      quiver.rotation.set(0.1, 0, -0.45);
      this.torso.add(quiver);
      this.part(quiver, cyl(0.032, 0.027, 0.2, 7), leather);
      for (const [x, z] of [[0.012, 0.008], [-0.012, 0.004], [0, -0.012]] as const) {
        this.part(quiver, rod(0.004, [x, 0.09, z], [x, 0.14, z], 3), wood);
        this.part(quiver, box(0.004, 0.035, 0.018), string, x, 0.13, z);
      }
    }
  }

  override sync(u: UnitState): void {
    super.sync(u);
    if (u.armorClass !== this.armor) {
      this.armor = u.armorClass;
      this.wear(u.armorClass);
    }
    const equipped = u.carried[u.equippedSlot];
    const other = u.carried[u.equippedSlot === 0 ? 1 : 0];
    const loadout = `${u.weaponId}|${other?.defId ?? ''}`;
    if (loadout !== this.loadout) {
      this.loadout = loadout;
      this.equip(u.weaponId, other?.defId ?? null);
    }
    if (this.held.bolt) this.held.bolt.visible = equipped?.loaded ?? true;
  }

  /** Detach a prop or armour part, free its geometry and stop picking it. Materials are the figure's own and stay. */
  private discard(o: THREE.Object3D | undefined): void {
    if (!o) return;
    o.removeFromParent();
    o.traverse((c) => {
      if (c instanceof THREE.Mesh) {
        c.geometry.dispose();
        const i = this.meshes.indexOf(c);
        if (i >= 0) this.meshes.splice(i, 1);
      }
    });
  }

  private wear(armor: ArmorClass): void {
    for (const m of this.armorParts) this.discard(m);
    this.armorParts = [];
    if (armor === 'clothing') return;
    const { bronze, leather } = this.mats;
    const shade = this.shade;
    const b = this.build;
    const add = (parent: THREE.Object3D, g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0): THREE.Mesh => {
      const mesh = this.part(parent, g, m, x, y, z, rx, ry);
      this.armorParts.push(mesh);
      return mesh;
    };
    const metal = armor !== 'light';

    if (armor === 'heavy') {
      // Bronze muscle cuirass: pectorals and a centre ridge.
      add(this.torso, cyl(0.12 * b, 0.1 * b, 0.19, 8), bronze, 0, 0.105, 0);
      for (const s of [1, -1]) add(this.torso, ico(0.042).scale(1, 0.75, 0.5), bronze, s * 0.042 * b, 0.15, 0.1 * b);
      add(this.torso, box(0.01, 0.13, 0.012), shade, 0, 0.1, 0.112 * b, -0.08);
    } else {
      // Leather jerkin, or bronze scale shown as stepped rows.
      add(this.torso, cyl(0.112 * b, 0.095 * b, 0.17, 7), metal ? bronze : leather, 0, 0.1, 0);
      if (metal) {
        for (const [y, r] of [[0.05, 0.1], [0.095, 0.104], [0.14, 0.109]] as const) add(this.torso, cyl((r + 0.004) * b, (r + 0.004) * b, 0.012, 7), shade, 0, y, 0);
      }
    }
    if (metal) {
      // Pteruges: leather strips hanging from the belt, flaring with the robe.
      for (let i = 0; i < 8; i++) {
        const a = ((i + 0.5) / 8) * Math.PI * 2;
        const strip = add(this.torso, box(0.036, 0.085, 0.01), leather, Math.sin(a) * 0.114 * b, -0.045, Math.cos(a) * 0.114 * b, -0.25, a);
        strip.rotation.order = 'YXZ';
      }
    }
    for (const side of [0, 1] as const) {
      if (armor === 'heavy') add(this.shoulder[side], new THREE.SphereGeometry(0.06, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), bronze, 0, -0.005, 0);
      else add(this.shoulder[side], ico(0.05).scale(1, 0.6, 1.05), leather, 0, 0.008, 0);
      add(this.elbow[side], cyl(0.031, 0.028, 0.06, 6), metal ? bronze : leather, 0, -0.068, 0);
    }
    if (armor !== 'heavy') return;

    // Bronze helmet: dome above the brow so the face stays visible, cheek guards, neck guard and a dark horsehair crest.
    add(this.head, new THREE.SphereGeometry(0.1, 9, 5, 0, Math.PI * 2, 0, Math.PI * 0.42), bronze, 0, 0.088, -0.004);
    add(this.head, new THREE.TorusGeometry(0.097, 0.009, 3, 12).rotateX(Math.PI / 2), shade, 0, 0.113, -0.004);
    for (const s of [1, -1]) add(this.head, box(0.014, 0.065, 0.045), bronze, s * 0.088, 0.078, 0.022);
    add(this.head, box(0.12, 0.05, 0.014), bronze, 0, 0.085, -0.09, 0.2);
    // Crest arc from the brow over the dome, trailing down the back.
    add(this.head, new THREE.TorusGeometry(0.112, 0.016, 3, 10, Math.PI * 0.8).rotateZ(Math.PI * 0.2).rotateY(-Math.PI / 2), this.hair, 0, 0.088, -0.004);
    for (const leg of this.leg) add(leg, cyl(0.03, 0.026, 0.13, 6), bronze, 0, -0.175, 0.003);
  }

  private equip(weaponId: string, stowedId: string | null): void {
    this.discard(this.held.R);
    this.discard(this.held.L);
    for (const o of this.stowed) this.discard(o);
    this.stowed = [];

    this.kind = propKind(weaponId);
    this.stance = STANCE[this.kind];
    this.held = buildWeapon(this.kind, this.mats, this.meshes) ?? {};
    if (this.held.R) this.wrist[1].add(this.held.R);
    if (this.held.L) this.wrist[0].add(this.held.L);

    const back = stowedId ? buildWeapon(propKind(stowedId), this.mats, this.meshes) : null;
    if (!back) return;
    if (back.bolt) back.bolt.visible = false;
    const b = this.build;
    for (const [side, part] of [[1, back.L], [-1, back.R]] as const) {
      if (!part) continue;
      const mount = new THREE.Group();
      const stow = part.userData.stow as Stow;
      if (stow === 'short') {
        // Hip sheath, blade down.
        mount.position.set(side * 0.108 * b, 0.0, 0.015);
        part.rotation.x = Math.PI / 2 - 0.15;
        mount.add(part);
      } else if (stow === 'shield') {
        mount.position.set(0, 0.1, -0.13 * b);
        part.rotation.x = -Math.PI / 2;
        mount.add(part);
      } else {
        // Diagonal across the back, centred on its own length.
        const centre = new THREE.Box3().setFromObject(part).getCenter(new THREE.Vector3());
        part.position.sub(centre);
        mount.position.set(0, 0.11, -0.13 * b);
        mount.rotation.z = 0.6;
        const tilt = new THREE.Group();
        tilt.rotation.x = -Math.PI / 2;
        tilt.add(part);
        mount.add(tilt);
      }
      this.torso.add(mount);
      this.stowed.push(mount);
    }
  }

  protected strikePlan(_reach: number, attack: string): StrikePlan {
    const ranged = isRangedAttack(attack);
    switch (this.kind) {
      case 'bow':
        return { clip: 'shoot', projectile: 'arrow' };
      case 'crossbow':
        return { clip: 'bolt', projectile: 'bolt' };
      case 'staff':
        if (isAreaEffect(attack)) return { clip: 'cast' };
        return ranged ? { clip: 'cast', projectile: 'orb' } : { clip: 'jab' };
      case 'daggers':
        return ranged ? { clip: 'throw', projectile: 'knife' } : { clip: 'stab' };
      case 'javelin_shield':
        return ranged ? { clip: 'throw', projectile: 'javelin' } : { clip: 'thrust' };
      default:
        return { clip: MELEE[this.kind] };
    }
  }

  /** Add arm offsets; `sy` swings toward the midline and `sz` lifts outward, mirrored per side. */
  private arm(side: 0 | 1, sx: number, sy = 0, sz = 0, ex = 0, wx = 0): void {
    const s = side === 0 ? 1 : -1;
    const sh = this.shoulder[side].rotation;
    sh.x += sx;
    sh.y -= s * sy;
    sh.z += s * sz;
    this.elbow[side].rotation.x += ex;
    this.wrist[side].rotation.x += wx;
  }

  protected poseStance(): void {
    const [L, R] = STANCE_ARMS[this.stance];
    this.arm(0, ...L);
    this.arm(1, ...R);
    this.held.bow?.draw(0);
    if (this.held.R) this.held.R.visible = true;
  }

  protected poseIdle(t: number, life: number): void {
    this.torso.rotation.x += 0.025 * Math.sin(t * 1.9) * life;
    this.hips.rotation.y += 0.04 * Math.sin(t * 0.3) * life;
    this.head.rotation.y += 0.2 * Math.sin(t * 0.45) * life;
    this.head.rotation.x += 0.04 * Math.sin(t * 0.9) * life;
    const sway = 0.03 * Math.sin(t * 1.9 + 1) * life;
    this.arm(0, 0, 0, sway);
    this.arm(1, 0, 0, sway);
  }

  protected poseStride(phase: number, w: number): void {
    const s = Math.sin(phase) * w;
    this.leg[0].rotation.x += 0.55 * s;
    this.leg[1].rotation.x -= 0.55 * s;
    const [L, R] = STANCE_ARMS[this.stance];
    this.arm(0, -0.35 * s * (L === RELAXED ? 1 : 0.3));
    this.arm(1, 0.35 * s * (R === RELAXED ? 1 : 0.3));
    this.torso.rotation.y += 0.07 * s;
    this.hips.rotation.z += 0.03 * s;
  }

  protected poseClip(kind: string, p: number): void {
    const twist = (keys: Keys) => (this.torso.rotation.y += key(p, keys));
    switch (kind) {
      case 'stab':
      case 'slash': {
        const pair = this.stance === 'pair';
        for (const side of pair ? ([1, 0] as const) : ([1] as const)) {
          // The off hand follows a beat later.
          const q = side === 1 ? p : Math.max(0, p - 0.1);
          if (kind === 'stab') {
            this.arm(side, key(q, [[0, 0], [0.15, 0.35], [0.25, -0.9], [0.45, -0.75], [0.85, 0]]), key(q, [[0, 0], [0.25, 0.25], [0.85, 0]]), 0, key(q, [[0, 0], [0.15, -0.5], [0.25, 0.5], [0.45, 0.4], [0.85, 0]]), key(q, [[0, 0], [0.25, 0.5], [0.85, 0]]));
          } else {
            this.arm(side, key(q, [[0, 0], [0.16, -2.1], [0.27, -0.4], [0.5, -0.3], [0.9, 0]]), 0, key(q, [[0, 0], [0.16, 0.5], [0.27, -0.45], [0.5, -0.4], [0.9, 0]]), key(q, [[0, 0], [0.16, -0.3], [0.27, 0.4], [0.9, 0]]), key(q, [[0, 0], [0.16, -0.3], [0.27, 0.7], [0.9, 0]]));
          }
        }
        twist([[0, 0], [0.16, -0.35], [0.27, 0.35], [0.9, 0]]);
        this.torso.rotation.x += key(p, [[0, 0], [0.27, 0.15], [0.9, 0]]);
        break;
      }
      case 'thrust':
      case 'jab': {
        for (const side of this.stance === 'pole' ? ([0, 1] as const) : ([1] as const)) {
          this.arm(side, key(p, [[0, 0], [0.15, 0.35], [0.25, -0.45], [0.5, -0.4], [0.9, 0]]), 0, 0, key(p, [[0, 0], [0.15, -0.35], [0.25, 0.75], [0.5, 0.6], [0.9, 0]]), key(p, [[0, 0], [0.25, kind === 'jab' ? 1.2 : -0.3], [0.9, 0]]));
        }
        this.torso.rotation.x += key(p, [[0, 0], [0.15, -0.1], [0.25, 0.3], [0.5, 0.25], [0.9, 0]]);
        this.leg[1].rotation.x += key(p, [[0, 0], [0.25, -0.45], [0.6, -0.35], [0.95, 0]]);
        this.leg[0].rotation.x += key(p, [[0, 0], [0.25, 0.3], [0.6, 0.2], [0.95, 0]]);
        break;
      }
      case 'cast': {
        // Staff raised high, free hand thrust at the target on release.
        this.arm(1, key(p, [[0, 0], [0.18, -1.2], [0.6, -1.2], [1, 0]]), 0, key(p, [[0, 0], [0.18, 0.2], [0.6, 0.2], [1, 0]]), key(p, [[0, 0], [0.18, 0.5], [0.6, 0.5], [1, 0]]), key(p, [[0, 0], [0.18, -0.4], [0.6, -0.4], [1, 0]]));
        this.arm(0, key(p, [[0, 0], [0.16, 0.3], [0.26, -1.5], [0.6, -1.4], [1, 0]]), key(p, [[0, 0], [0.26, 0.2], [1, 0]]), 0, key(p, [[0, 0], [0.16, -1.2], [0.26, 0.3], [0.6, 0.2], [1, 0]]));
        this.torso.rotation.x += key(p, [[0, 0], [0.16, -0.15], [0.26, 0.15], [0.7, 0]]);
        this.head.rotation.x += key(p, [[0, 0], [0.16, -0.2], [0.3, 0], [1, 0]]);
        break;
      }
      case 'cleave': {
        for (const side of [0, 1] as const) {
          this.arm(side, key(p, [[0, 0], [0.18, -2.7], [0.28, -0.55], [0.5, -0.45], [0.9, 0]]), key(p, [[0, 0], [0.18, 0.35], [0.28, 0.35], [0.9, 0]]), 0, key(p, [[0, 0], [0.18, -0.25], [0.28, 0.75], [0.5, 0.6], [0.9, 0]]), key(p, [[0, 0], [0.18, 0.1], [0.28, 1.0], [0.5, 0.9], [0.9, 0]]));
        }
        this.torso.rotation.x += key(p, [[0, 0], [0.18, -0.3], [0.28, 0.4], [0.5, 0.35], [0.9, 0]]);
        break;
      }
      case 'shoot': {
        // Bow arm up and level (stave vertical), string hand drawn to the chin, loose at the lunge peak.
        this.arm(0, key(p, [[0, 0], [0.14, -1.35], [0.7, -1.35], [1, 0]]), key(p, [[0, 0], [0.14, -0.25], [0.7, -0.25], [1, 0]]), key(p, [[0, 0], [0.14, -0.15], [0.7, -0.15], [1, 0]]), key(p, [[0, 0], [0.14, 0.5], [0.7, 0.5], [1, 0]]));
        this.arm(1, key(p, [[0, 0], [0.14, -1.35], [0.7, -1.3], [1, 0]]), key(p, [[0, 0], [0.14, 0.35], [0.7, 0.35], [1, 0]]), 0, key(p, [[0, 0], [0.14, -1.6], [0.24, -1.9], [0.27, -0.6], [0.7, -0.6], [1, 0]]));
        twist([[0, 0], [0.14, -0.25], [0.7, -0.25], [1, 0]]);
        this.held.bow?.draw(p < 0.25 ? key(p, [[0, 0], [0.08, 0.1], [0.24, 1]]) : 0);
        break;
      }
      case 'bolt': {
        const kick = key(p, [[0, 0], [0.22, 0.05], [0.27, -0.3], [0.55, 0], [1, 0]]);
        this.arm(0, kick);
        this.arm(1, kick);
        this.torso.rotation.x += key(p, [[0, 0], [0.27, -0.12], [0.6, 0]]);
        if (this.held.bolt && p >= 0.25) this.held.bolt.visible = false;
        break;
      }
      case 'throw': {
        this.arm(1, key(p, [[0, 0], [0.17, -2.7], [0.27, -0.9], [0.5, -0.5], [0.9, 0]]), 0, key(p, [[0, 0], [0.17, 0.3], [0.27, 0], [0.9, 0]]), key(p, [[0, 0], [0.17, -0.9], [0.27, 0.1], [0.9, 0]]));
        twist([[0, 0], [0.17, -0.4], [0.27, 0.3], [0.9, 0]]);
        this.leg[0].rotation.x += key(p, [[0, 0], [0.27, -0.4], [0.6, -0.3], [0.95, 0]]);
        // The thrown weapon leaves the hand; the next one is drawn on recovery.
        if (this.held.R) this.held.R.visible = p < 0.27 || p > 0.75;
        break;
      }
      case 'hit': {
        this.torso.rotation.x += key(p, [[0, 0], [0.12, -0.35], [1, 0]]);
        this.head.rotation.x += key(p, [[0, 0], [0.1, -0.35], [0.6, 0.05], [1, 0]]);
        const flail = key(p, [[0, 0], [0.12, 0.35], [1, 0]]);
        this.arm(0, 0, 0, flail);
        this.arm(1, 0, 0, flail);
        this.body.position.z += key(p, [[0, 0], [0.12, -0.04], [1, 0]]);
        break;
      }
      case 'stagger': {
        this.torso.rotation.x += key(p, [[0, 0], [0.3, -0.45], [1, 0]]);
        const v = key(p, [[0, 0], [0.3, 1], [1, 0]]);
        this.arm(0, -0.5 * v, 0, 0.7 * v);
        this.arm(1, -0.5 * v, 0, 0.7 * v);
        this.leg[0].rotation.z += 0.25 * v;
        this.leg[1].rotation.z -= 0.25 * v;
        break;
      }
    }
  }

  protected poseDazed(t: number, life: number): void {
    this.head.rotation.z += 0.25 * Math.sin(t * 5) * life;
    this.head.rotation.x += 0.15 * life;
    this.torso.rotation.z += 0.1 * Math.sin(t * 2.5) * life;
    this.arm(0, 0.25 * life);
    this.arm(1, 0.25 * life);
  }

  protected poseFeared(life: number): void {
    this.torso.rotation.x -= 0.2 * life;
    this.head.rotation.x += 0.15 * life;
    this.arm(0, -0.4 * life, 0, 0.25 * life);
    this.arm(1, -0.4 * life, 0, 0.25 * life);
  }

  protected poseDown(e: number): void {
    // Topple backward, shifted forward so the body lies across the token's own tile.
    this.body.rotation.x -= 1.48 * e;
    this.body.position.z += 0.34 * e;
    this.body.position.y += 0.035 * e;
    this.arm(0, 0, 0, 0.9 * e);
    this.arm(1, 0, 0, 0.9 * e);
    this.head.rotation.y += 0.5 * e;
    this.leg[0].rotation.z += 0.2 * e;
    this.leg[1].rotation.z -= 0.2 * e;
  }
}

// ---------------- Quadrupeds ----------------

/** Body plan and coat for a four-legged figure. Lengths are in local units at scale 1. */
interface BeastSpec {
  coat: string;
  belly: string;
  muzzle: string;
  /** Inner ear and tail skin; defaults to the coat. */
  skin?: string;
  scale: number;
  girth: number;
  /** Torso centre height (legs reach the ground from here). */
  torsoY: number;
  torsoLen: number;
  /** Chest and haunch radii. */
  chest: number;
  haunch: number;
  /** Egg-shaped body (rodents) instead of a barrel with a scruff (canines). */
  egg: boolean;
  headR: number;
  snout: number;
  ear: { kind: 'point'; h: number } | { kind: 'round'; r: number };
  tornEar: boolean;
  scar: boolean;
  teeth: 'fangs' | 'incisors';
  tail: { r: number; len: number; droop: number };
  /** Resting head pitch (positive = low). */
  headLow: number;
  height: number;
}

/** Wolf variants follow the encounter's names (Grey, Scarred, Lean); any other wolf is grey. */
function wolfSpec(name: string): BeastSpec {
  const base: BeastSpec = {
    coat: '#857a6c', belly: '#b9ab94', muzzle: '#6c6256', scale: 1, girth: 1, torsoY: 0.235, torsoLen: 0.36, chest: 0.085, haunch: 0.065, egg: false,
    headR: 0.068, snout: 0.11, ear: { kind: 'point', h: 0.065 }, tornEar: false, scar: false, teeth: 'fangs', tail: { r: 0.032, len: 0.17, droop: -0.55 }, headLow: 0.15, height: 0.43,
  };
  if (/scarred/i.test(name)) return { ...base, coat: '#6e5a48', belly: '#a89478', muzzle: '#5e4c3c', scale: 1.08, girth: 1.08, tornEar: true, scar: true };
  if (/lean/i.test(name)) return { ...base, coat: '#4c4239', belly: '#857664', muzzle: '#3e362f', scale: 0.96, girth: 0.82 };
  return base;
}

/** Granary rats: oversized for tutorial readability, grain-dusted, each a little different in size. */
function ratSpec(id: string): BeastSpec {
  const v = (phaseSeed(id) * 7) % 1;
  return {
    coat: v > 0.5 ? '#6e6152' : '#5f5446', belly: '#a8987c', muzzle: '#5a4e42', skin: '#b58d7c', scale: 0.95 + 0.13 * v, girth: 1, torsoY: 0.115, torsoLen: 0.2, chest: 0.07, haunch: 0.085,
    egg: true, headR: 0.05, snout: 0.075, ear: { kind: 'round', r: 0.03 }, tornEar: false, scar: false, teeth: 'incisors', tail: { r: 0.012, len: 0.3, droop: -0.2 }, headLow: 0.05, height: 0.21,
  };
}

/** Large rat: bigger and darker than a granary rat, well short of the brood mother (demo look). */
function largeRatSpec(id: string): BeastSpec {
  return { ...ratSpec(id), coat: '#54493c', scale: 1.3, girth: 1.12, tornEar: true };
}

/** Brood mother: a scarred, much larger rat (demo look). */
function broodSpec(id: string): BeastSpec {
  return { ...ratSpec(id), coat: '#4e4338', belly: '#8f7f66', muzzle: '#463b31', scale: 1.7, girth: 1.25, tornEar: true, scar: true, tail: { r: 0.016, len: 0.34, droop: -0.25 } };
}

class Beast extends Rig {
  private readonly torso: THREE.Group;
  private readonly neck: THREE.Group;
  private readonly jaw: THREE.Group;
  private readonly tail: THREE.Group;
  /** Front-left, front-right, rear-left, rear-right. */
  private readonly hip: [THREE.Group, THREE.Group, THREE.Group, THREE.Group];
  private readonly ears: THREE.Group[] = [];
  private readonly spec: BeastSpec;
  readonly height: number;

  constructor(u: UnitState, v: BeastSpec) {
    super(u.id);
    this.spec = v;
    const coat = this.paint(v.coat);
    const belly = this.paint(v.belly);
    const muzzle = this.paint(v.muzzle);
    const skin = v.skin ? this.paint(v.skin) : coat;
    const ink = this.paint(TONE.ink);
    const bone = this.paint(TONE.bone);
    this.body.scale.setScalar(v.scale);
    this.track(this.body);
    this.height = v.height * v.scale;
    const half = v.torsoLen / 2;

    this.torso = this.joint(this.body, 0, v.torsoY, 0, -0.03);
    if (v.egg) {
      // Hunched rodent body, haunches heavier than the chest.
      this.part(this.torso, ico(v.haunch, 1).scale(0.9 * v.girth, 0.85, (half + v.haunch) / v.haunch / 1.6), coat, 0, 0.01, -0.01);
      this.part(this.torso, ico(v.chest * 0.85).scale(v.girth, 0.8, 1.1), belly, 0, -0.02, half * 0.45);
    } else {
      this.part(this.torso, cyl(v.chest, v.haunch, v.torsoLen, 6).rotateX(Math.PI / 2).scale(v.girth, 1.05, 1), coat);
      this.part(this.torso, ico(v.chest * 1.12).scale(0.9 * v.girth, 0.9, 1.05), coat, 0, 0.03, half * 0.55);
      this.part(this.torso, cyl(v.chest * 0.65, v.haunch * 0.7, v.torsoLen * 0.72, 6).rotateX(Math.PI / 2).scale(v.girth, 1, 1), belly, 0, -0.035, 0.01);
    }

    this.neck = this.joint(this.torso, 0, v.chest * 0.6, half - 0.01, v.headLow);
    const r = v.headR;
    this.part(this.neck, ico(r).scale(0.95, 0.85, 1.1), coat, 0, r * 0.45, r * 0.75);
    this.part(this.neck, cyl(r * 0.32, r * 0.6, v.snout, 5).rotateX(Math.PI / 2), muzzle, 0, r * 0.15, r * 0.9 + v.snout / 2);
    const tip = r * 0.9 + v.snout;
    this.part(this.neck, ico(r * 0.22), ink, 0, r * 0.25, tip);
    for (const s of [1, -1]) {
      this.part(this.neck, box(r * 0.2, r * 0.18, 0.01), ink, s * r * 0.47, r * 0.72, r * 1.45);
      const ear = this.joint(this.neck, s * r * 0.52, r * 1.1, r * 0.45, -0.2, 0, -s * 0.25);
      if (v.ear.kind === 'point') {
        const h = v.tornEar && s === -1 ? v.ear.h * 0.55 : v.ear.h;
        this.part(ear, cone(r * 0.38, h, 4), coat, 0, h / 2, 0);
      } else {
        // Round ears face sideways, so they read as discs from above and from the side.
        this.part(ear, cyl(v.ear.r, v.ear.r, 0.01, 8).rotateZ(Math.PI / 2), skin, 0, v.ear.r * 0.8, 0, 0, s * 0.5);
      }
      this.ears.push(ear);
    }
    if (v.scar) this.part(this.neck, box(0.008, 0.06, 0.006), bone, r * 0.45, r * 0.75, r * 1.52, 0, 0, 0.5);
    this.jaw = this.joint(this.neck, 0, -r * 0.18, r * 1.1);
    this.part(this.jaw, box(r * 0.66, r * 0.24, v.snout * 0.9), muzzle, 0, -r * 0.09, v.snout * 0.42);
    if (v.teeth === 'fangs') {
      for (const s of [1, -1]) {
        this.part(this.neck, cone(0.006, 0.018, 3).rotateX(Math.PI), bone, s * r * 0.24, -r * 0.18, tip - 0.027);
        this.part(this.jaw, cone(0.006, 0.018, 3), bone, s * r * 0.22, r * 0.12, v.snout * 0.78);
      }
    } else {
      // Rodent incisors: a pair of long front teeth.
      this.part(this.neck, box(0.016, 0.026, 0.006), bone, 0, -r * 0.02, tip - 0.006);
    }

    const hips: THREE.Group[] = [];
    const leg = v.torsoY - 0.035 - 0.011;
    for (const [z, rear] of [[half - 0.06 * (v.torsoLen / 0.36), false], [-half + 0.055 * (v.torsoLen / 0.36), true]] as const) {
      for (const s of [1, -1]) {
        const hip = this.joint(this.torso, s * v.chest * 0.53 * v.girth, -0.035, z);
        if (rear && !v.egg) this.part(hip, ico(v.haunch * 0.77).scale(0.8 * v.girth, 1.1, 1.1), coat);
        // Rodents stand on short, thick legs; canines on long thin ones.
        this.part(hip, cyl(leg * (v.egg ? 0.28 : 0.115), leg * (v.egg ? 0.22 : 0.09), leg, 5), coat, 0, -leg / 2, 0);
        this.part(hip, box(leg * 0.19, 0.022, leg * 0.26), v.egg ? skin : muzzle, 0, -leg, 0.01);
        hips.push(hip);
      }
    }
    this.hip = [hips[0]!, hips[1]!, hips[2]!, hips[3]!];

    this.tail = this.joint(this.torso, 0, v.chest * 0.4, -half - 0.01, v.tail.droop);
    this.part(this.tail, cone(v.tail.r, v.tail.len, 5).rotateX(-Math.PI / 2), v.egg ? skin : coat, 0, 0, -v.tail.len / 2);
  }

  protected strikePlan(): StrikePlan {
    return { clip: 'bite' };
  }

  protected poseStance(): void {}

  protected poseIdle(t: number, life: number): void {
    // Rodents twitch quicker than wolves.
    const k = this.spec.egg ? 2.2 : 1;
    this.torso.rotation.x += 0.02 * Math.sin(t * 2.4 * k) * life;
    this.neck.rotation.y += 0.25 * Math.sin(t * 0.6 * k) * life;
    this.neck.rotation.x += (this.spec.egg ? 0.08 * Math.sin(t * 7) ** 4 : 0) * life;
    this.tail.rotation.y += 0.2 * Math.sin(t * 1.6) * life;
    const twitch = 0.15 * Math.max(0, Math.sin(t * 0.7 * k)) ** 8 * life;
    for (const ear of this.ears) ear.rotation.x -= twitch;
  }

  protected poseStride(phase: number, w: number): void {
    // Trot: diagonal pairs move together.
    const s = 0.65 * Math.sin(phase) * w;
    const [fl, fr, rl, rr] = this.hip;
    fl.rotation.x += s;
    rr.rotation.x += s;
    fr.rotation.x -= s;
    rl.rotation.x -= s;
    this.torso.rotation.x += 0.04 * Math.sin(phase * 2) * w;
    this.neck.rotation.x -= 0.05 * Math.sin(phase * 2) * w;
    this.tail.rotation.y += 0.15 * Math.sin(phase) * w;
  }

  protected poseClip(kind: string, p: number): void {
    const [fl, fr, rl, rr] = this.hip;
    const size = this.spec.torsoY / 0.235;
    switch (kind) {
      case 'bite': {
        this.body.position.z += key(p, [[0, 0], [0.15, -0.05], [0.25, 0.07], [0.5, 0.03], [0.9, 0]]) * size;
        this.torso.rotation.x += key(p, [[0, 0], [0.15, 0.12], [0.25, -0.18], [0.5, -0.05], [0.9, 0]]);
        this.neck.rotation.x += key(p, [[0, 0], [0.15, 0.2], [0.25, -0.35], [0.45, 0.05], [0.9, 0]]);
        this.jaw.rotation.x += key(p, [[0, 0], [0.14, 0.6], [0.24, 0.75], [0.27, 0], [0.4, 0.25], [0.5, 0], [1, 0]]);
        const reach = key(p, [[0, 0], [0.15, 0.3], [0.25, -0.9], [0.5, -0.2], [0.9, 0]]);
        fl.rotation.x += reach;
        fr.rotation.x += reach;
        const push = key(p, [[0, 0], [0.25, 0.5], [0.6, 0]]);
        rl.rotation.x += push;
        rr.rotation.x += push;
        for (const ear of this.ears) ear.rotation.x -= key(p, [[0, 0], [0.2, 0.6], [0.7, 0]]);
        break;
      }
      case 'hit': {
        this.neck.rotation.x += key(p, [[0, 0], [0.1, 0.3], [1, 0]]);
        this.torso.rotation.x += key(p, [[0, 0], [0.1, -0.15], [1, 0]]);
        this.body.position.z += key(p, [[0, 0], [0.1, -0.04], [1, 0]]) * size;
        this.tail.rotation.x -= key(p, [[0, 0], [0.1, 0.5], [1, 0]]);
        break;
      }
      case 'stagger': {
        const v = key(p, [[0, 0], [0.3, 1], [1, 0]]);
        this.torso.rotation.z += 0.3 * v;
        fl.rotation.z += 0.3 * v;
        rl.rotation.z += 0.3 * v;
        fr.rotation.z -= 0.3 * v;
        rr.rotation.z -= 0.3 * v;
        break;
      }
    }
  }

  protected poseDazed(t: number, life: number): void {
    this.neck.rotation.z += 0.3 * Math.sin(t * 5) * life;
    this.torso.rotation.z += 0.08 * Math.sin(t * 2.5) * life;
    this.tail.rotation.x -= 0.3 * life;
  }

  protected poseFeared(life: number): void {
    // The pack scatters: tail tucked, ears flat, head low.
    this.tail.rotation.x -= 0.9 * life;
    this.neck.rotation.x += 0.25 * life;
    this.torso.rotation.x -= 0.08 * life;
    for (const ear of this.ears) ear.rotation.x -= 0.8 * life;
  }

  protected poseDown(e: number): void {
    // Roll onto its side across the token.
    const y = this.spec.torsoY;
    this.body.rotation.z += 1.5 * e;
    this.body.position.x += 0.85 * y * e;
    this.body.position.y += 0.28 * y * e;
    this.neck.rotation.x += 0.3 * e;
    this.tail.rotation.x += 0.4 * e;
    for (const hip of this.hip) hip.rotation.x += 0.2 * e;
  }
}

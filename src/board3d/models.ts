// Generated (Meshy) models on the 3D board: which unit templates and encounters use them, one shared loader and
// cache, and fitted per-tile props. Raw downloads, design images and task IDs live in meshy_output/ (see the
// .omp/skills/meshyai skill); the optimized GLBs served from public/assets/models/ use meshopt, so the loader needs
// MeshoptDecoder. Anything not loaded yet falls back to the procedural figures and blocks.

import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import type { ArmorClass, UnitState } from '../rules/types';
import type { Projectile } from './rig';

type V3 = readonly [number, number, number];

/**
 * Keeps a prop pointed at the target while chosen clips play. No clip controls the direction of a weapon held in its
 * hand, so after the clip poses the hand each frame, the wrist turns (up to a natural limit) and the prop turns in
 * the fist for the rest, until the business end points along the facing at `pitch` above level.
 */
export interface Aim {
  /** The business end, as a direction in the prop's own axes (the spearhead is +y). */
  tip: V3;
  /** Pitch above level, in radians, while each kind of clip plays; kinds left out aren't corrected. */
  pitch: Partial<Record<'idle' | 'strike' | 'ranged', number>>;
}

/**
 * A carried prop parented to a bone. Offsets and turns are in the body model's T-pose space (its own units, facing
 * +z) relative to the bone, so one kit fits every body rigged from the same skeleton.
 */
export interface HeldProp {
  slug: string;
  bone: string;
  /** Longest side of the prop, in body-model units. */
  size: number;
  /** Point of the prop (fractions of its half-extents, -1..1) that sits at `offset`: the grip or strap. */
  grip: V3;
  /** Where the grip sits, relative to the bone's T-pose position: about 7 cm past the hand bone is the palm. */
  offset: V3;
  /** Euler XYZ turning the prop from its own axes into the T-pose. */
  rotation: V3;
  aim?: Aim;
}

/**
 * An animation clip in the body file: a whole clip by name, or the part of one from `from` to `to` (fractions of its
 * length, default 0 and 1). A looping part plays back and forth, so the settled end of a transition clip loops
 * without a seam. `turn` is a yaw in radians added to the figure while the clip plays, for clips performed side-on
 * (an archer looses to his left, so he turns that side toward the target).
 *
 * `hit` marks when a strike lands or the weapon leaves the hand, as a fraction of the played part. The board shows a
 * strike's result and launches its projectile a quarter of the way through the strike, so the figure plays up to the
 * mark in that first quarter and the rest in the other three. Start a strike's part at the top of its backswing, or
 * a long wind-up is squeezed into that quarter.
 */
export type ClipRef = string | { clip: string; from?: number; to?: number; turn?: number; hit?: number };

/** How one carried weapon looks and moves on a model. */
export interface ModelWeapon {
  /** Props in hand while this weapon is equipped. */
  held: readonly HeldProp[];
  /** Idle while this weapon is equipped, when it differs from the body's (a two-handed weapon held upright). */
  idle?: ClipRef;
  /** Clip for a melee strike. */
  strike: ClipRef;
  /**
   * Clip and what flies, for ranged attacks and `shot` skills (a thrown knife, a bolt from a staff). A `thrown` prop
   * (index into `held`) leaves the hand at the clip's `hit` and is back in hand, drawn again, at `back`.
   */
  ranged?: { clip: ClipRef; projectile: Projectile; thrown?: { prop: number; back: number } };
  /** Clip for a delayed area effect cast on the ground; nothing flies. */
  area?: ClipRef;
}

export interface UnitModel {
  /** Mesh, skeleton and one-shot clips. */
  body: string;
  /** Armature-only file carrying the walk cycle. */
  walk: string;
  /** Body model height in its own units. */
  sourceHeight: number;
  /** Figure height in board-local units, matching the procedural figure it replaces. */
  height: number;
  /** Armour the body was generated in; a unit in other armour keeps its procedural figure. Omit for fixed kit. */
  armor?: ArmorClass;
  clips: { idle: ClipRef; hit: ClipRef; fall: ClipRef };
  /** Props worn whatever the weapon. */
  worn?: readonly HeldProp[];
  /** Weapons this model can carry, by weapon id. A unit carrying any other weapon keeps its procedural figure. */
  weapons: Readonly<Record<string, ModelWeapon>>;
}

// Attach conventions, in the T-pose: hands are palm down, thumb forward. A blade or haft leaves the fist on the thumb
// side with its leading edge toward the knuckles (along the forearm). A strapped shield's top runs along the thumb,
// so it stands upright when the forearm comes up across the chest. Generated props can come out mirrored from their
// design image, so every grip below was measured on the model, not read off the image.

/** Palm centres, relative to the hand bones of Meshy's rig. */
const RIGHT_PALM: V3 = [-0.078, -0.015, 0.002];
const LEFT_PALM: V3 = [0.076, -0.017, 0.002];

/**
 * Jubal's weapons, shared by every Jubal body. Each prop's own axes, measured on its model:
 * - dagger, sword: point at -x, edges on +-y, hilt at +x;
 * - spear (also the javelin), axe, hammer: head at +y; the axe's blade sticks out toward -x from a haft at +x;
 * - bow: limbs along y, string on +x; crossbow: shoots toward -x, top at +y;
 * - shield: round in x-y, boss toward +z.
 * Heads and blades lead from the thumb; the bow's string faces the body. The library has no spear, javelin or
 * dual-sword moves, so Spear Thrust, Javelin Throw and Dual Blades were generated with meshy_text_to_motion; the spear
 * and javelin aim at the target through them, since no clip controls where a held shaft points. The bow looses
 * side-on, and the crossbow fires from the steady two-handed aim in the middle of a pistol quick-draw (a generated
 * crossbow shot came out one-handed at arm's length), aimed so its 18-degree upward tilt is gone.
 */
const swordIn = (bone: 'RightHand' | 'LeftHand', size: number): HeldProp =>
  bone === 'RightHand'
    ? { slug: 'bronze-sword', bone, size, grip: [0.69, 0, 0], offset: RIGHT_PALM, rotation: [-Math.PI / 2, 0, Math.PI / 2] }
    : { slug: 'bronze-sword', bone, size, grip: [0.69, 0, 0], offset: LEFT_PALM, rotation: [Math.PI / 2, 0, -Math.PI / 2] };
const haft = (slug: string, size: number, grip: V3, aim?: Aim): HeldProp => ({ slug, bone: 'RightHand', size, grip, offset: RIGHT_PALM, rotation: [Math.PI / 2, 0, 0], aim });
// The round shield sits toward the wrist, a hand's width off the forearm. The spear thrust raises the forearm across
// the chest, which swung a shield seated nearer the elbow through the head by 30 cm; nearer the arm, the left hand
// poked out of its face in the hit reaction. Here no head, torso or hand passes through it in any clip, on any body.
const shield: HeldProp = { slug: 'hide-shield', bone: 'LeftForeArm', size: 0.65, grip: [0, 0, -1], offset: [0.27, 0.15, -0.27], rotation: [-Math.PI / 2, 0, Math.PI] };
/** Level, a touch down: the target's chest. */
const SPEAR_PITCH = -0.08;
// Each strike starts at the top of its backswing and ends where it settles (measured), so the quarter of the strike
// before contact shows the blow itself; `hit` is the contact within that part.
const spearThrust: ClipRef = { clip: 'Spear_Thrust', from: 0.12, hit: 0.28 };
const swing: ClipRef = { clip: 'Heavy_Hammer_Swing', from: 0.35, hit: 0.74 };
const slash: ClipRef = { clip: 'Right_Hand_Sword_Slash', to: 0.89, hit: 0.47 };
const twoHandedIdle: ClipRef = { clip: 'Axe_Stance', from: 0.92 };
const bowShot: ClipRef = { clip: 'Archery_Shot', from: 0.45, to: 0.85, turn: -1.75, hit: 0.46 };
// The quick-draw's two-handed aim drifts about 8 degrees off the facing while it holds; the turn centres the body.
const crossbowShot: ClipRef = { clip: 'Cowboy_Quick_Draw_Shooting', from: 0.32, to: 0.58, turn: 0.12, hit: 0.45 };

const JUBAL_WEAPONS: Readonly<Record<string, ModelWeapon>> = {
  daggers: {
    strike: { clip: 'Thrust_Slash', to: 0.94, hit: 0.28 },
    ranged: { clip: { clip: 'Over_Shoulder_Throw', to: 0.9, hit: 0.22 }, projectile: 'knife', thrown: { prop: 0, back: 0.9 } },
    held: [
      { slug: 'bronze-dagger', bone: 'RightHand', size: 0.4, grip: [0.5, 0, 0], offset: RIGHT_PALM, rotation: [-Math.PI / 2, 0, Math.PI / 2] },
      { slug: 'bronze-dagger', bone: 'LeftHand', size: 0.4, grip: [0.5, 0, 0], offset: LEFT_PALM, rotation: [Math.PI / 2, 0, -Math.PI / 2] },
    ],
  },
  shield: { strike: slash, held: [swordIn('RightHand', 0.75), shield] },
  // Contact on the cross-slash at 37%, where both blades move fastest; the right blade's follow-up comes at 53%.
  dual_wield: { strike: { clip: 'Dual_Blades', hit: 0.37 }, held: [swordIn('RightHand', 0.55), swordIn('LeftHand', 0.55)] },
  polearm: { strike: spearThrust, held: [haft('bronze-spear', 2, [0, -0.3, 0], { tip: [0, 1, 0], pitch: { strike: SPEAR_PITCH } })] },
  javelin_shield: {
    strike: spearThrust,
    // Thrown a little above level, for the arc.
    ranged: { clip: { clip: 'Javelin_Throw', from: 0.13, hit: 0.37 }, projectile: 'javelin', thrown: { prop: 0, back: 0.91 } },
    held: [haft('bronze-spear', 1.4, [0, -0.15, 0], { tip: [0, 1, 0], pitch: { strike: SPEAR_PITCH, ranged: 0.2 } }), shield],
  },
  two_handed: { idle: twoHandedIdle, strike: swing, held: [haft('bronze-axe', 1.2, [0.69, -0.75, 0])] },
  colossal: { idle: twoHandedIdle, strike: swing, held: [haft('colossal-hammer', 1.3, [0, -0.75, 0])] },
  hunting_bow: {
    strike: bowShot,
    ranged: { clip: bowShot, projectile: 'arrow' },
    held: [{ slug: 'hunting-bow', bone: 'LeftHand', size: 1.3, grip: [0, 0, 0], offset: LEFT_PALM, rotation: [-Math.PI / 2, 0, -Math.PI] }],
  },
  crossbow: {
    strike: crossbowShot,
    ranged: { clip: crossbowShot, projectile: 'bolt' },
    held: [haft('crossbow', 0.85, [0.25, 0, 0], { tip: [-1, 0, 0], pitch: { strike: 0.03, ranged: 0.03 } })],
  },
};

/** The lyre slung across Jubal's back: crossbar at +y, strings facing +z. `back` is how far behind Spine01 it sits. */
const lyre = (back: number): HeldProp => ({ slug: 'lyre', bone: 'Spine01', size: 0.5, grip: [0, 0, -1], offset: [0.055, -0.096, -back], rotation: [0, Math.PI, 0.35] });

/** Unit templates drawn as generated models instead of procedural figures, one entry per armour/weapon kit. */
export const UNIT_MODELS: Partial<Record<string, readonly UnitModel[]>> = {
  // Cultist Zealot: khopesh in the right hand, tall hide shield strapped to the left forearm.
  cultist_fighter: [
    {
      body: 'zealot',
      walk: 'zealot-walk',
      sourceHeight: 1.75,
      height: 0.72,
      clips: { idle: 'Combat_Stance', hit: 'Hit_Reaction', fall: 'Dead' },
      weapons: {
        cultist_blade: {
          strike: slash,
          // The khopesh model's handle is at +x and its crescent at -x, rising toward +y, so the crescent's convex
          // edge leads a chop. The shield rides low and close on the forearm (the arm crosses its upper third):
          // centred on the forearm it rose past the face, and the head clipped through it by up to 13 cm.
          held: [
            { slug: 'khopesh', bone: 'RightHand', size: 0.62, grip: [0.7, -0.79, 0], offset: [-0.074, -0.006, 0.033], rotation: [-Math.PI / 2, 0, Math.PI / 2] },
            { slug: 'zealot-shield', bone: 'LeftForeArm', size: 0.95, grip: [0, 0, -1], offset: [0.069, 0.011, -0.277], rotation: [-Math.PI / 2, 0, Math.PI] },
          ],
        },
      },
    },
  ],
  // Jubal in each armour class, with the lyre slung on his back and any of his weapons: his canon rope-tied linen
  // (clothing, every player's starting armour), a hardened-leather cuirass over it (light), bronze scales (medium) and
  // a bronze cuirass, greaves and crested helmet (heavy). The lyre sits 1 cm off each body's back.
  jubal: [
    {
      body: 'jubal-clothing',
      walk: 'jubal-clothing-walk',
      sourceHeight: 1.72,
      height: 0.7,
      armor: 'clothing',
      clips: { idle: 'Combat_Stance', hit: 'Hit_Reaction', fall: 'Dead' },
      worn: [lyre(0.107)],
      weapons: JUBAL_WEAPONS,
    },
    {
      body: 'jubal',
      walk: 'jubal-walk',
      sourceHeight: 1.72,
      height: 0.7,
      armor: 'medium',
      clips: { idle: 'Combat_Stance', hit: 'Hit_Reaction', fall: 'Dead' },
      worn: [lyre(0.115)],
      weapons: JUBAL_WEAPONS,
    },
    {
      body: 'jubal-light',
      walk: 'jubal-light-walk',
      sourceHeight: 1.72,
      height: 0.7,
      armor: 'light',
      clips: { idle: 'Combat_Stance', hit: 'Hit_Reaction', fall: 'Dead' },
      worn: [lyre(0.142)],
      weapons: JUBAL_WEAPONS,
    },
    {
      body: 'jubal-heavy',
      walk: 'jubal-heavy-walk',
      sourceHeight: 1.72,
      height: 0.7,
      armor: 'heavy',
      clips: { idle: 'Combat_Stance', hit: 'Hit_Reaction', fall: 'Dead' },
      worn: [lyre(0.112)],
      weapons: JUBAL_WEAPONS,
    },
  ],
  // Jabal: the shepherd's club in the right hand, its knob (+x) out past the thumb. His idle is the end of Axe Stance,
  // a transition clip that crouches, picks the weapon up and settles holding it upright.
  jabal: [
    {
      body: 'jabal',
      walk: 'jabal-walk',
      sourceHeight: 1.8,
      height: 0.735,
      clips: { idle: { clip: 'Axe_Stance', from: 0.92 }, hit: 'Hit_Reaction', fall: 'Dead' },
      weapons: {
        shepherds_club: {
          strike: swing,
          held: [{ slug: 'shepherds-club', bone: 'RightHand', size: 1.0, grip: [-0.72, 0, 0], offset: [-0.068, -0.009, 0], rotation: [0, -Math.PI / 2, 0] }],
        },
      },
    },
  ],
  // Cultist Seer: the horned staff (horns at +y) gripped a little below its middle; bolts fly from a cast, the fire
  // sigil is struck into the ground. He idles on the end of Axe Stance, which holds the staff upright, horns high:
  // the sword-style combat stance held it level like a spear. He jabs with Jubal's generated Spear Thrust, the horned
  // head aimed at the target.
  cultist_mage: [
    {
      body: 'seer',
      walk: 'seer-walk',
      sourceHeight: 1.75,
      height: 0.72,
      clips: { idle: { clip: 'Axe_Stance', from: 0.92 }, hit: 'Hit_Reaction', fall: 'Dead' },
      weapons: {
        cultist_staff: {
          strike: spearThrust,
          ranged: { clip: { clip: 'mage_soell_cast', to: 0.69, hit: 0.32 }, projectile: 'orb' },
          area: 'Charged_Ground_Slam',
          held: [
            {
              slug: 'seer-staff',
              bone: 'RightHand',
              size: 1.8,
              grip: [0, -0.05, 0],
              offset: [-0.068, -0.009, -0.003],
              rotation: [Math.PI / 2, -Math.PI / 2, 0],
              aim: { tip: [0, 1, 0], pitch: { strike: SPEAR_PITCH } },
            },
          ],
        },
      },
    },
  ],
};

/** The generated model matching this unit's armour and every weapon it carries, if there is one. */
export function unitModelFor(u: UnitState): UnitModel | undefined {
  return UNIT_MODELS[u.templateId]?.find(
    (m) => (!m.armor || m.armor === u.armorClass) && u.carried.every((c) => !c || m.weapons[c.defId] !== undefined),
  );
}

/** Generated set dressing for an encounter's floor, walls and cover, and the light that goes with it. */
export interface Dressing {
  /** Painted ground (public/assets/textures/<slug>.webp) stretched across the whole board, in its proportions. */
  floor?: string;
  /** Walls on the board's edge: a continuous rubble line. */
  edge: string;
  /** Free walls inside the board. */
  inner: string;
  cover: string;
  /** Lit brazier on top of each free-standing inner wall. */
  brazier: string;
  /** Sun and sky fill while this dressing is up; braziers carry the warm light. */
  sun: number;
  sky: number;
}

export const DRESSING: Partial<Record<string, Dressing>> = {
  cultists: { floor: 'shrine-floor', edge: 'shrine-masonry', inner: 'shrine-pillar', cover: 'shrine-masonry', brazier: 'shrine-brazier', sun: 1.2, sky: 0.7 },
};

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const textureLoader = new THREE.TextureLoader();
const cache = new Map<string, GLTF>();
const textures = new Map<string, THREE.Texture>();
const loading = new Map<string, Promise<void>>();
const sizes = new Map<string, THREE.Box3>();

const url = (slug: string) => `${import.meta.env.BASE_URL}assets/models/${slug}.glb`;
const textureUrl = (slug: string) => `${import.meta.env.BASE_URL}assets/textures/${slug}.webp`;

/**
 * Root motion fights the board, which moves and lunges the token itself: pin the hips over the base, at their rest
 * position. Clips start off-centre (the combat stance shifts the hips a third of a metre sideways), so pinning to a
 * clip's first frame would leave the figure standing beside its base.
 */
function pinHips(g: GLTF): void {
  const rest = g.scene.getObjectByName('Hips')?.position;
  if (!rest) return;
  for (const clip of g.animations)
    for (const track of clip.tracks) {
      if (!track.name.endsWith('Hips.position')) continue;
      const v = track.values;
      for (let i = 0; i < v.length; i += 3) {
        v[i] = rest.x;
        v[i + 2] = rest.z;
      }
    }
}

function prepare(g: GLTF): void {
  pinHips(g);
  g.scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    // Shared with every instance: the board's disposeTree must leave geometry and textures alone.
    o.userData.cachedModel = true;
    o.castShadow = true;
    o.receiveShadow = true;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      // No environment map to reflect: metallic surfaces render as muddy black. Keep metal a tint, not a mirror.
      if (m instanceof THREE.MeshStandardMaterial) m.metalness = Math.min(m.metalness, 0.3);
    }
  });
}

function load(slug: string): Promise<void> {
  if (cache.has(slug)) return Promise.resolve();
  let p = loading.get(slug);
  if (!p) {
    p = loader
      .loadAsync(url(slug))
      .then((g) => {
        prepare(g);
        cache.set(slug, g);
      })
      .finally(() => loading.delete(slug));
    loading.set(slug, p);
  }
  return p;
}

function loadTexture(slug: string): Promise<void> {
  if (textures.has(slug)) return Promise.resolve();
  const key = `texture:${slug}`;
  let p = loading.get(key);
  if (!p) {
    p = textureLoader
      .loadAsync(textureUrl(slug))
      .then((t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        // Seen at a low angle across the board; three clamps this to what the GPU supports.
        t.anisotropy = 8;
        textures.set(slug, t);
      })
      .finally(() => loading.delete(key));
    loading.set(key, p);
  }
  return p;
}

export function modelGltf(slug: string): GLTF | undefined {
  return cache.get(slug);
}

/** Files a figure of this model needs: body, walk, worn props and the props of the weapons the unit carries. */
export function unitModelSlugs(m: UnitModel, u: UnitState): string[] {
  const carried = u.carried.flatMap((c) => (c ? (m.weapons[c.defId]?.held ?? []) : []));
  return [m.body, m.walk, ...new Set([...(m.worn ?? []), ...carried].map((h) => h.slug))];
}

/** Files an encounter's board needs: models (GLB) and painted textures (WebP). */
export interface BoardAssets {
  models: string[];
  textures: string[];
}

export function boardAssets(encounterId: string, units: readonly UnitState[]): BoardAssets {
  const models = new Set<string>();
  const painted = new Set<string>();
  const d = DRESSING[encounterId];
  if (d) {
    for (const s of [d.edge, d.inner, d.cover, d.brazier]) models.add(s);
    if (d.floor) painted.add(d.floor);
  }
  for (const u of units) {
    const m = unitModelFor(u);
    if (m) for (const s of unitModelSlugs(m, u)) models.add(s);
  }
  return { models: [...models], textures: [...painted] };
}

export function modelsReady(slugs: readonly string[]): boolean {
  return slugs.every((s) => cache.has(s));
}

export function assetsReady(a: BoardAssets): boolean {
  return modelsReady(a.models) && a.textures.every((s) => textures.has(s));
}

export function dressingReady(d: Dressing): boolean {
  return modelsReady([d.edge, d.inner, d.cover, d.brazier]) && (!d.floor || textures.has(d.floor));
}

export async function loadAssets(a: BoardAssets): Promise<void> {
  await Promise.all([...a.models.map(load), ...a.textures.map(loadTexture)]);
}

export function boardTexture(slug: string): THREE.Texture | undefined {
  return textures.get(slug);
}

/** Untransformed bounds of a static model. */
export function modelBounds(slug: string): THREE.Box3 {
  let b = sizes.get(slug);
  if (!b) {
    b = new THREE.Box3().setFromObject(cache.get(slug)!.scene);
    sizes.set(slug, b);
  }
  return b;
}

/**
 * A static model scaled uniformly to fit `width` across its widest ground side and at most `height` tall, centred
 * on x/z with its base on y = 0. Geometry and materials are shared with the cache.
 */
export function fittedProp(slug: string, width: number, height = Infinity): THREE.Group {
  const b = modelBounds(slug);
  const size = b.getSize(new THREE.Vector3());
  const k = Math.min(width / Math.max(size.x, size.z), height / size.y);
  const inner = cache.get(slug)!.scene.clone();
  const centre = b.getCenter(new THREE.Vector3());
  inner.scale.setScalar(k);
  inner.position.set(-centre.x * k, -b.min.y * k, -centre.z * k);
  const g = new THREE.Group();
  g.add(inner);
  g.userData.height = size.y * k;
  return g;
}

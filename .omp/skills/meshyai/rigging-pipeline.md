# Meshy AI — Rigging Pipeline

**Every humanoid character MUST be rigged.** Static models require hacky programmatic animation (moving wrapper groups) that looks artificial. Rigged models get proper skeletal animation — walk, run, punch, etc.

## When to Rig

| Model type | Rig? | Why |
|-----------|------|-----|
| Humanoid character (player, NPC, enemy) | **YES — always** | Skeletal animation for walk/run/idle/attack |
| Animal, creature with non-human limbs | No | `meshy_rig` only rigs bipeds with clear body and limbs |
| Vehicle, prop, building | No | Static or simple rotation |
| Abstract shape, particle | No | Procedural animation |

## Full Pipeline: Generate -> Rig -> Animate -> Integrate

Confirm the whole pipeline's credit cost with the user before Step 1.

**Step 1: Generate a textured humanoid in T-pose**

The auto-rigger finds joints from the mesh's outer shape. Clothing that hides the body (a full-length robe, a fleece hanging over the back and sides, wide hanging sleeves, a loose stole) makes it place spine and knee joints outside the body, and every clip then bends the back the wrong way. Design rigged characters in fitted or split clothing: torso, hips, knees and ankles visible or closely outlined, space between the arms and torso and between the legs. A robe can stay a robe if it is split up the front and sides over close leggings.

```json
// meshy_image_to_3d (or meshy_text_to_3d → meshy_text_to_3d_refine; an unrefined preview can't be rigged)
{ "input_task_id": "<approved-design-image-task-id>", "pose_mode": "t-pose",
  "model_type": "smart-topology", "ai_model": "meshy-t2.5", "target_polycount": 15000,
  "enable_pbr": true, "target_formats": ["glb"] }
```

Wait with `meshy_get_task_status { "task_id": "<id>", "wait": true }`.

**Step 2: Rig**

```json
// meshy_rig — input is the image-to-3d task, or the refine task for text-to-3d
{ "input_task_id": "<generation-task-id>", "height_meters": 1.8 }
```

Wait for the rigging task, then call `meshy_download_model { "task_id": "<rig-task-id>", "task_type": "rigging" }`. It does not save files; it returns URLs for:
- the rigged character GLB
- free walking and running clips, each both with the mesh (≈7 MB) and **armature-only** (`walking_armature_glb_url`, ≈90 KB)

Use the armature-only clip files: the board plays them on the body's skeleton, so a second copy of the mesh is wasted download. The rig also returns FBX copies; use the GLBs. Fetch and optimize right away (URLs expire with the 3-day asset retention):

```bash
mkdir -p meshy_output/hero
curl -fL "<rigged-glb-url>" -o meshy_output/hero/hero.glb
curl -fL "<walking-armature-glb-url>" -o meshy_output/hero/hero-walk-armature.glb
npx -y @gltf-transform/cli optimize meshy_output/hero/hero-walk-armature.glb public/assets/models/hero-walk.glb \
  --compress meshopt
```

**Check the joints before animating.** Load the rigged GLB and, for each of `Hips`, `Spine02`, `Spine01`, `Spine`, `neck`, `Head`, `LeftLeg` and `RightLeg`, compare the joint's position with the mesh's front-to-back extent at that height. On a good rig, the spine joints form a smooth line within about 2 cm front to back, and each knee sits inside its leg. If they zig-zag (we saw 16 cm jumps and knees in front of the shins), don't animate: re-rigging the same mesh reproduces the same joints, so the fix is a redesign with fitted clothing (5 credits for a rig vs. 12–18 for clips wasted on a broken one).

**Step 3: Add game-specific animations** (optional)

Find preset IDs with `meshy_list_animations` (free) — never guess them:

```json
// meshy_list_animations — e.g. melee attacks, or a name search
{ "category": "Fighting" }
{ "search": "block" }
```

Bundle up to 10 actions into one GLB with one clip per action, in the order given — a ready-made clip set for an `AnimationMixer` state machine:

```json
// meshy_animate
{ "rig_task_id": "<rig-task-id>", "action_ids": [<idle>, <attack>, <hit>, <death>] }
```

For a motion no preset covers, generate one and apply it (biped rigs only, within 3 days of generating):

```json
// meshy_text_to_motion: 10 credits in prime mode
{ "prompt": "Standing in place, a warrior holds a spear low in his right hand with the point aimed forward, steps forward onto his left foot and stabs the spear straight ahead at chest height ..., then returns to a ready stance.", "duration": 2.5, "mode": "prime" }
// meshy_animate: 3 credits per rig
{ "rig_task_id": "<rig-task-id>", "motion_task_id": "<text-to-motion-task-id>" }
```

One generated motion serves every rig. Apply it to one body, look at it there, then apply it to the rest. Describe only the body: where each hand is, which way it moves, the step, and the finish (`returns to a ready stance` gives a clean end to trim to). The motion doesn't always follow the prompt: a crossbow shot asked for "in both hands to his right shoulder" came back one-handed at arm's length, like a pistol, and was dropped after the one apply. The applied clip arrives named `retarget_clip`; name it when merging.

`meshy_download_model { "task_id": "<animation-task-id>", "task_type": "animation" }` returns the animation file URLs. The animated GLB carries the mesh, skeleton and every requested clip, so it doubles as the body file: fetch it into `meshy_output/<slug>/` and optimize it to `public/assets/models/<slug>.glb` in place of the bare rigged model.

**More than 10 clips, or clips added later.** One `meshy_animate` call takes at most 10 actions, and every call returns the whole mesh again. Buy the extra clips in another call on the same rig and copy them into the body file with [merge-clips.mjs](./merge-clips.mjs) (its header has the one-time install), then optimize the merged file. Buy only the clips a body lacks: the merge keeps the ones it has. A single-clip export names its clip `Armature|<Clip>|baselayer`; the tool normalizes that. `Clip=NewName` renames a clip as it is copied (`retarget_clip=Spear_Thrust`) and `-Clip` drops one the body no longer uses, so the runtime file carries only clips in use. Record each merge in the body's `meta.json`.

Meshy clips move the hips (the walk travels about 1.5 m, the slash steps forward). The board moves and lunges tokens itself, so `models.ts` pins the hips' horizontal position on load; keep that when adding clips.

**Fit the clip to the weapon.** Many preset clips are combos or performed side-on, and no clip, preset or generated, aims a held shaft: the prop rides the hand, so a thrust can finish 45 degrees high. Before buying a clip for every body, buy it once and measure it:
- Where the prop's business end points through the strike, frame by frame, and when it moves fastest: that is the contact.
- Which way the move aims. Archery Shot looses about 100 degrees to the archer's left.

Then use a `ClipRef` in `models.ts`: `from`/`to` play only part of a clip (start at the backswing's apex, end where it settles; the crossbow shot is the two-handed aim in the middle of a pistol quick-draw), `turn` rotates the figure while it plays (the bow shot turns -1.75 rad), and `hit` marks the contact as a fraction of the clip. `ModelFigure` plays a marked clip so the contact lands at 25% of the strike, when the board shows the result and launches the projectile. A thrown weapon (`ranged.thrown`) leaves the hand at the mark and returns at `back`. For a spear, javelin, crossbow or staff, give the prop an `Aim` (its tip axis and a pitch per kind of clip): `ModelFigure` turns the wrist, then the prop in the fist, to keep the tip on the target while those clips play. Check the result by measuring the weapon's business end, or the bow hand against the draw hand, against the target direction through the shot: under 10 degrees off at the contact is right.

**Step 4: Integrate.** In this project, add a `UNIT_MODELS` entry in `src/board3d/models.ts` (body file, walk file, clip refs for idle/strike/hit/fall, bone-attached props) and `ModelFigure` does the rest. Props sit at offsets from their bone's T-pose position (about 7 cm past the hand bone is the palm), so one weapon kit serves every body rigged from Meshy's skeleton, as `JUBAL_WEAPONS` does for Jubal's four armours. A weapon can set its own idle (two-handed weapons stand on the settled end of Axe Stance). Read the prop's axes off its geometry, not its design image (props come out mirrored), and run the shield check: no head, torso or hand vertex through the shield in any clip. The underlying pattern is `SkeletonUtils.clone` + `AnimationMixer`:

```ts
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const modelUrl = (slug: string) => `${import.meta.env.BASE_URL}assets/models/${slug}.glb`;

// Load the animated body: mesh, skeleton and clips (SkeletonUtils.clone preserves bone bindings)
const body = await loader.loadAsync(modelUrl('hero'));
const model = cloneSkinned(body.scene);
const mixer = new THREE.AnimationMixer(model);

// The armature-only walk file shares the rig, so its clip plays on this model
const walk = await loader.loadAsync(modelUrl('hero-walk'));

// Log clip names — they vary per model; map them to game states once
console.log('Clips:', [...body.animations, ...walk.animations].map((c) => c.name));
const walkAction = mixer.clipAction(walk.animations[0]!);

// fadeToAction pattern for smooth transitions
let activeAction: THREE.AnimationAction | undefined;
function fadeToAction(nextAction: THREE.AnimationAction, duration = 0.3) {
  if (activeAction && activeAction !== nextAction) activeAction.fadeOut(duration);
  nextAction.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(duration).play();
  activeAction = nextAction;
}
fadeToAction(walkAction);

// In update loop:
mixer.update(delta);
```

---
name: meshyai
description: Generate custom 3D models from text or images with the Meshy MCP server (meshy_* tools), then auto-rig, animate, optimize and load them in this project's Three.js scene. Use when the user says "generate a 3D model", "create a character model", "use Meshy", or needs a custom GLB model that doesn't exist in the repo.
argument-hint: "[text-prompt or image-path]"
license: MIT
compatibility: Requires the `meshy` MCP server from .omp/mcp.json with MESHY_API_KEY set, plus internet access. GLB optimization runs @gltf-transform/cli through npx.
metadata:
  author: OpusGameLabs (adapted to the Meshy MCP server)
  version: 1.3.0-mcp
  upstream: playableintelligence/game-creator@4e64b83b5fe400b34ad3a484d9b4a6090b26d512 skills/meshyai
  tags: [game, 3d, meshy, ai, model-generation, rigging, animation, mcp]
---

# Meshy AI — 3D Model Generation, Rigging & Animation (MCP)

You are an expert at generating custom 3D models with Meshy AI and integrating them into Three.js browser games. **Meshy is the preferred source for new 3D game assets** — it generates exactly what you need from a text description or reference image, with consistent art style and game-ready topology.

All Meshy work goes through the `meshy` MCP server. In omp its tools are `mcp__meshy_<name>`, called by writing JSON to `xd://mcp__meshy_<name>`; read that `xd://` path for the current schema before first use. The tool schemas and descriptions are the API contract — they carry current models, parameter ranges and credit costs. Never call the Meshy REST API by hand.

## Performance Notes

- Take your time with each step. Quality is more important than speed.
- Do not skip validation steps — they catch issues early.
- Read the full context of each file before making changes.
- Always run post-generation verification. Never assume orientation or scale.

## Reference Files

| File | Description |
|------|-------------|
| [rigging-pipeline.md](./rigging-pipeline.md) | Complete generate -> rig -> animate -> integrate pipeline: joint check, clip merging, fitting clips to weapons, bone-relative props |
| [verification-patterns.md](./verification-patterns.md) | Auto-orientation check, auto-scale fitting, floor alignment code patterns |
| [merge-clips.mjs](./merge-clips.mjs) | Copies clips between animation GLBs of one rig, for bodies with more than 10 clips |

## Why Meshy First

- **Exact match**: Generate precisely the character, prop, or scenery your game needs — no compromises
- **Consistent style**: All assets from the same generation pipeline share a cohesive look
- **Custom characters**: Named personalities, branded characters, unique creatures — all generated to spec
- **Full pipeline**: Generate → rig → animate, all from one tool
- **Game-ready**: Control polycount, topology, and PBR textures for optimal Three.js performance

## Tools

| Job | Tool | Notes |
|-----|------|-------|
| Verify the key, see credits | `meshy_check_balance` | Free |
| Design image for approval | `meshy_text_to_image` | Feed the approved task into `meshy_image_to_3d` |
| Image → textured model | `meshy_image_to_3d` | One task, textured by default |
| Several views → model | `meshy_multi_image_to_3d` | Same object, different angles |
| Text → untextured preview | `meshy_text_to_3d` | Quick draft; needs refine before rigging |
| Texture a preview | `meshy_text_to_3d_refine` | `enable_pbr` for metal/roughness/normal maps |
| Change polycount/topology | `meshy_remesh` | |
| Skeleton for a humanoid | `meshy_rig` | Includes free walk + run clips |
| Find preset animation IDs | `meshy_list_animations` | Free; never guess IDs |
| Apply preset or generated motion | `meshy_animate` | Up to 10 actions in one multi-clip file |
| Motion clip from text | `meshy_text_to_motion` | Then `meshy_animate` with `motion_task_id` |
| Wait for / inspect a task | `meshy_get_task_status` | `wait: true` polls until done |
| Save outputs | `meshy_download_model` | Rigging/animation tasks return URLs instead of files |
| Find earlier work | `meshy_list_tasks` | Recover task IDs instead of regenerating |
| Remove a queued task | `meshy_cancel_task` | Refunds `PENDING`; `IN_PROGRESS` can't be canceled |

## Authentication

The MCP server reads `MESHY_API_KEY` from the `env` block of `.omp/mcp.json`. Never ask the user to paste a key into chat and never write it to `.env` or any other file.

Before any paid work, call `meshy_check_balance` (free). Success confirms the key and shows the credits available.

If the `meshy` tools are missing, or `meshy_check_balance` fails with an auth error, stop and tell the user:

> Meshy isn't connected. Put your API key (from https://www.meshy.ai/developers/keys) in `.omp/mcp.json` under `mcpServers.meshy.env.MESHY_API_KEY`, then run `/mcp reload` and `/mcp test meshy`. Or say "skip" and I'll build the asset procedurally instead.

If the user skips, build the asset from procedural Three.js geometry, following the existing meshes in `src/board3d/`.

## Spending Credits

Every generation, refine, remesh, rig, animate and motion call spends credits; each tool description lists its current cost.

- Before the first paid call, state the planned pipeline and its total cost and get the user's approval. Propose any extra paid stage or rerun before spending on it.
- Submit each task once. A `TIMEOUT` from `meshy_get_task_status` means the task is still running on Meshy — call it again with the same `task_id` (Meshy allows up to 60 minutes from creation). Never resubmit to recover from a timeout.

## File Layout

| Path | Contents |
|------|----------|
| `meshy_output/<slug>/` | Design image, raw Meshy downloads and `<slug>.meta.json`. Not served by Vite. Git ignores the raw `.glb` files and `_textures/` folders (tens of MB each); the design image and meta file are committed. |
| `public/assets/models/<slug>*.glb` | Optimized runtime GLBs. Vite copies `public/` into the build as-is. |
| `src/board3d/models.ts` | Registry: `UNIT_MODELS` (unit template → one entry per armour: body, walk file, clip refs, bone-relative props, weapon kits) and `DRESSING` (encounter → floor painting, wall, cover and brazier pieces, plus its light). Register every new runtime model here. |
| `notes/art/style-reference-shrine-mood.png` | Approved painted style reference. Pass it as `reference_file_paths` to `meshy_image_to_image` for every design image. |

`meshy_download_model` takes `save_to` as an **absolute** file path; build it from the project root (`<project-root>/meshy_output/<slug>/<slug>.glb`).

## Pipeline

### 1. Generate

Three routes, best first:

1. **Design image first** (best quality and control, recommended for characters): `meshy_text_to_image` → show the image and get approval → `meshy_image_to_3d` with `input_task_id` set to the image task. Textured in one task.
2. **From a reference image**: `meshy_image_to_3d` with `file_path` (absolute path to a local .png/.jpg/.webp; the server encodes it) or `image_url`.
3. **Straight from text** (quick drafts): `meshy_text_to_3d` → check the preview thumbnail → `meshy_text_to_3d_refine` with the preview's task ID.

Parameters for web-game assets:

- `target_formats: ["glb"]` — only GLB is used, and fewer formats finish faster.
- `pose_mode: "t-pose"` for anything that will be rigged.
- Clean game topology at a fixed budget: `model_type: "smart-topology"`, `ai_model: "meshy-t2.5"`, `target_polycount` up to 30,000. With `model_type: "standard"`, a polycount needs `should_remesh: true`.
- `enable_pbr: true` when the scene uses `MeshStandardMaterial` lighting.

```json
// meshy_image_to_3d — character from an approved design image
{ "input_task_id": "<text-to-image-task-id>", "pose_mode": "t-pose", "model_type": "smart-topology",
  "ai_model": "meshy-t2.5", "target_polycount": 15000, "enable_pbr": true, "target_formats": ["glb"] }

// meshy_text_to_3d — prop preview, then texture it
{ "prompt": "a wooden barrel, low poly game asset", "model_type": "smart-topology",
  "ai_model": "meshy-t2.5", "target_polycount": 5000, "target_formats": ["glb"] }
// meshy_text_to_3d_refine
{ "preview_task_id": "<preview-task-id>", "enable_pbr": true, "target_formats": ["glb"] }
```

### 2. Wait

```json
// meshy_get_task_status
{ "task_id": "<task-id>", "wait": true }
```

### 3. Download

Download only the GLB, and do it as soon as the task succeeds — Meshy keeps generated assets for **3 days**.

```json
// meshy_download_model
{ "task_id": "<task-id>", "format": "glb", "save_to": "<project-root>/meshy_output/<slug>/<slug>.glb" }
```

Rigging and animation tasks are not saved by the tool; it returns their file URLs. Fetch those with curl — see [rigging-pipeline.md](./rigging-pipeline.md).

### 4. Optimize

Shrink every runtime GLB (typically 80–95%): resize textures to 1024, convert them to WebP, and apply meshopt compression. Keep the raw file in `meshy_output/`.

```bash
npx -y @gltf-transform/cli optimize meshy_output/<slug>/<slug>.glb public/assets/models/<slug>.glb \
  --compress meshopt --texture-compress webp --texture-size 1024
```

Use `--texture-size 512` for mobile-first assets. Meshopt-compressed GLBs need `MeshoptDecoder` on the loader (below).

### 5. Rig and animate humanoids

Every bipedal character gets rigged; see [rigging-pipeline.md](./rigging-pipeline.md).

### 6. Record

Write `meshy_output/<slug>/<slug>.meta.json` with the prompt or image source, the tool arguments, every task ID (generation, refine, rig, animation, motion), the animation action IDs and the date. Follow-ups ("make a lower-poly version", "add a block animation") start from these IDs instead of regenerating.

## Loading in Three.js

In this project, don't write a new loader: register the model in `src/board3d/models.ts`. The board loads and caches the files, then rebuilds; until they arrive, units keep their procedural figures and boards keep their blocks. `ModelFigure` (`src/board3d/model-figure.ts`) plays a rigged unit's clips and parents held props to bones, and `fittedProp` scales static set dressing into a tile. The snippet below is the underlying pattern.

This project's Vite config uses `base: './'`, so build model URLs from `import.meta.env.BASE_URL`, never from a leading `/`.

```ts
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const modelUrl = (slug: string) => `${import.meta.env.BASE_URL}assets/models/${slug}.glb`;

// Static prop: a regular clone per instance
const barrel = (await loader.loadAsync(modelUrl('barrel'))).scene;
scene.add(barrel.clone());

// Skinned character: SkeletonUtils.clone keeps bone bindings (Object3D.clone breaks them)
const hero = await loader.loadAsync(modelUrl('hero'));
const instance = cloneSkinned(hero.scene);
const mixer = new THREE.AnimationMixer(instance);
```

## Post-Generation Verification (MANDATORY)

See [verification-patterns.md](./verification-patterns.md) for auto-orientation check, auto-scale fitting, and floor alignment code patterns.

## Prompt Engineering Tips

Good prompts produce better models:

| Goal | Prompt | Why |
|------|--------|-----|
| Game character | "a stylized goblin warrior, low poly game character, full body" | "low poly" + "game character" = game-ready topology |
| Prop | "a wooden treasure chest, stylized, closed" | Simple, specific, single object |
| Environment piece | "a fantasy stone archway, low poly, game asset" | "game asset" signals clean geometry |
| Vehicle | "a sci-fi hover bike, side view, clean topology" | "clean topology" = fewer artifacts |

**Avoid:**
- Multiple objects in one prompt ("a knight AND a dragon") — generate separately
- Vague prompts ("something cool") — be specific about style and form
- Interior/architectural scenes — Meshy is best for single objects

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| No `meshy` tools, or auth error | Server not connected or key missing/invalid | Have the user set `MESHY_API_KEY` in `.omp/mcp.json`, then `/mcp reload` and `/mcp test meshy`. |
| `meshy_get_task_status` returns `TIMEOUT` | The task is still running on Meshy | Call it again with the same `task_id`. Do not resubmit. |
| Task stuck in `PENDING` | API queue backlog or invalid parameters | Wait a few minutes and re-check. If still `PENDING`, `meshy_cancel_task` refunds it; resubmitting with a simpler prompt or lower polycount spends credits again, so confirm first. |
| Asset URL returns 404 | Meshy keeps assets for only 3 days | Regenerate (with approval). Always download as soon as a task succeeds. |
| `provider_content_refused` on a design | The image model's safety check declined the prompt (seen for a crossbow described with its "trigger mechanism"); costs nothing | Reword neutrally, for example as a museum piece, and drop mechanism words. |
| Rigging fails or the skeleton is broken | Not a textured biped, untextured preview, or over 300,000 faces | Use a textured humanoid with visible limbs, generated with `pose_mode: "t-pose"`; refine text-to-3D previews first; remesh if over the face limit. |
| Clips bend the back or knees the wrong way | Loose clothing hid the body, so the auto-rig placed spine or knee joints outside it | Check the joints before animating (rigging-pipeline.md, Step 2). Re-rigging the same mesh gives the same joints; redesign in fitted or split clothing and rig again. |
| Generated model does not match prompt | Vague or multi-object prompt | Use specific, single-object prompts with style cues ("low poly", "stylized", "game character"). See Prompt Engineering Tips. |
| `THREE.GLTFLoader: setMeshoptDecoder must be called before loading compressed files` | Optimized GLB loaded without the decoder | Call `loader.setMeshoptDecoder(MeshoptDecoder)` before loading. |

## Checklist

- [ ] `meshy_check_balance` succeeded — or the user skipped to procedural geometry
- [ ] Pipeline and credit cost approved before the first paid call
- [ ] Prompt is specific (style, poly count, single object)
- [ ] **All humanoid characters rigged** — never skip rigging for bipedal models
- [ ] GLB downloaded before the 3-day expiration
- [ ] Runtime GLB optimized into `public/assets/models/`; raw file kept in `meshy_output/<slug>/`
- [ ] **Post-generation verification done** — orientation, scale, floor alignment checked
- [ ] **Browser screenshot taken** — visually confirmed facing direction + fit in environment
- [ ] Per-model `rotationY` and scale kept in one config next to the loader (most Meshy models need `Math.PI`)
- [ ] Static models use a regular clone; rigged models use `SkeletonUtils.clone`
- [ ] Clip names logged and a clip map defined for animated models
- [ ] `meshy_output/<slug>/<slug>.meta.json` written with every task ID
- [ ] `npm run build` succeeds

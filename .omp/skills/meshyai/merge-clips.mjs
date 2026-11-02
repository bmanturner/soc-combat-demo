// Copy named animation clips from one Meshy animation GLB into another made from the same rig, so a body can carry
// more than the 10 clips one meshy_animate call allows, or gain clips later without re-buying the ones it has.
// Channels are retargeted by bone name; Blender-style names (Armature|Clip|baselayer, which single-clip exports
// use) are normalized to the clip name. Merge the raw downloads, then optimize the result.
//
// Needs @gltf-transform/core and /extensions; keep them out of the project:
//   mkdir -p /tmp/gltf-tools && cp .omp/skills/meshyai/merge-clips.mjs /tmp/gltf-tools/
//   (cd /tmp/gltf-tools && npm init -y >/dev/null && npm i @gltf-transform/core@4 @gltf-transform/extensions@4)
//   node /tmp/gltf-tools/merge-clips.mjs base.glb extra.glb out.glb [Clip | Clip=NewName | -Clip ...]
// `Clip=NewName` copies a clip under a new name: clips applied from meshy_text_to_motion arrive with a generic name.
// `-Clip` drops a clip the base no longer needs. With no clips to copy listed, every clip in extra is copied.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const [basePath, extraPath, outPath, ...args] = process.argv.slice(2);
const drop = new Set(args.filter((a) => a.startsWith('-')).map((a) => a.slice(1)));
/** Source clip name → name in the output; empty means copy every clip under its own name. */
const wanted = new Map(args.filter((a) => !a.startsWith('-')).map((a) => (a.includes('=') ? a.split('=', 2) : [a, a])));
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const base = await io.read(basePath);
const unknown = [...drop].filter((d) => !base.getRoot().listAnimations().some((a) => a.getName() === d));
if (unknown.length) throw new Error(`cannot drop ${unknown.join(', ')}: not in ${basePath}`);
for (const anim of base.getRoot().listAnimations()) if (drop.has(anim.getName())) anim.dispose();
const extra = await io.read(extraPath);
const root = base.getRoot();
const buffer = root.listBuffers()[0];
const byName = new Map(root.listNodes().map((n) => [n.getName(), n]));
const have = new Set(root.listAnimations().map((a) => a.getName()));
const copy = (acc) =>
  base.createAccessor().setType(acc.getType()).setArray(acc.getArray().slice()).setNormalized(acc.getNormalized()).setBuffer(buffer);

const added = [];
for (const anim of extra.getRoot().listAnimations()) {
  const source = anim.getName().replace(/^Armature\|/, '').replace(/\|baselayer$/, '');
  if (wanted.size && !wanted.has(source)) continue;
  const name = wanted.get(source) ?? source;
  if (have.has(name)) continue;
  const out = base.createAnimation(name);
  const samplers = new Map();
  for (const s of anim.listSamplers()) {
    const ns = base.createAnimationSampler().setInput(copy(s.getInput())).setOutput(copy(s.getOutput())).setInterpolation(s.getInterpolation());
    out.addSampler(ns);
    samplers.set(s, ns);
  }
  let missing = 0;
  for (const c of anim.listChannels()) {
    const target = byName.get(c.getTargetNode()?.getName());
    if (!target) {
      missing++;
      continue;
    }
    out.addChannel(base.createAnimationChannel().setTargetNode(target).setTargetPath(c.getTargetPath()).setSampler(samplers.get(c.getSampler())));
  }
  if (missing) throw new Error(`${source}: ${missing} channels target bones missing from ${basePath}`);
  added.push(source === name ? name : `${source} as ${name}`);
}
const found = new Set(extra.getRoot().listAnimations().map((a) => a.getName().replace(/^Armature\|/, '').replace(/\|baselayer$/, '')));
const missingWanted = [...wanted.keys()].filter((w) => !found.has(w));
if (missingWanted.length) throw new Error(`not found in ${extraPath}: ${missingWanted.join(', ')} (has ${[...found].join(', ')})`);
await io.write(outPath, base);
console.log(`${outPath.split('/').pop()}: +${added.join(', ') || 'nothing'}; now ${root.listAnimations().map((a) => a.getName()).join(', ')}`);

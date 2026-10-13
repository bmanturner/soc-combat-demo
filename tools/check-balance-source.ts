// Assert balance did not alter any source-backed config or content field.
import { execFileSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { DEFAULT_CONFIG, SETTINGS } from '../src/rules/config';
import { SKILLS, WEAPONS } from '../src/content/gear';

function baseline(path: string): Record<string, unknown> {
  const source = execFileSync('git', ['show', `83cd5df:${path}`], { encoding: 'utf8' });
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  runInNewContext(code, { exports });
  return exports;
}
const config = baseline('src/rules/config.ts') as { DEFAULT_CONFIG: typeof DEFAULT_CONFIG; SETTINGS: typeof SETTINGS };
const gear = baseline('src/content/gear.ts') as { WEAPONS: typeof WEAPONS; SKILLS: typeof SKILLS };
let checked = 0;
function same(label: string, before: unknown, after: unknown) {
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error(`source changed: ${label}`);
  checked++;
}
for (const s of config.SETTINGS.filter(s => s.status === 'source')) {
  same(`config.${s.key}`, config.DEFAULT_CONFIG[s.key], DEFAULT_CONFIG[s.key]);
  same(`config provenance.${s.key}`, s.status, SETTINGS.find(x => x.key === s.key)!.status);
}
for (const [id, before] of Object.entries(gear.WEAPONS)) {
  const after = WEAPONS[id]!;
  const fields = (old: object, current: object, provenance: typeof before.fieldProvenance.fields, label: string) => {
    for (const [key,p] of Object.entries(provenance)) if (p.status === 'source') {
      same(`${label}.${key}`, (old as Record<string, unknown>)[key], (current as Record<string, unknown>)[key]);
    }
  };
  fields(before, after, before.fieldProvenance.fields, id);
  fields(before.attack, after.attack, before.fieldProvenance.attack, `${id}.attack`);
  for (const mode of before.modes) fields(mode, after.modes.find(m => m.id === mode.id)!, before.fieldProvenance.modes[mode.id]!, `${id}.${mode.id}`);
}
for (const [id, before] of Object.entries(gear.SKILLS)) for (const [key,p] of Object.entries(before.fieldProvenance)) {
  if (p.status === 'source') same(`skill.${id}.${key}`, (before as unknown as Record<string, unknown>)[key], (SKILLS[id] as unknown as Record<string, unknown>)[key]);
}
console.log(`PASS: ${checked} source-backed value/status comparisons against 83cd5df.`);

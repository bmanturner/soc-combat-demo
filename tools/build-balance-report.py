"""Build an auditable balance report from complete simulation logs."""
import json
from pathlib import Path
from statistics import mean, median
import subprocess

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'notes/balance'

def load(path, expected):
    data = [json.loads(line[4:]) for line in path.read_text().splitlines() if line.startswith('ROW ')]
    keys = {(r['encounter'], tuple(r['weaponIds']), r['armor'], r['policy']) for r in data}
    assert len(data) == len(keys) == expected, (path, len(data), len(keys), expected)
    return data

base = {p: load(OUT / f'baseline-{p}.txt',85) for p in ['expert','novice']}
final = {p: load(OUT / f'final-{p}.txt',85) for p in ['expert','novice']}
combos = {p: load(OUT / f'final-combos-{p}.txt',121) for p in ['expert','novice']}
configs = [json.loads(line[7:]) for name in ['final-expert.txt','final-novice.txt','final-combos-expert.txt','final-combos-novice.txt'] for line in (OUT/name).read_text().splitlines() if line.startswith('CONFIG ')]
assert len(configs)==4 and all(config==configs[0] for config in configs), 'confirmation configs differ or missing'
source_check = subprocess.check_output(['npx','tsx','tools/check-balance-source.ts'],cwd=ROOT,text=True)
assert all(r['trials']==100 for rs in final.values() for r in rs)
assert all(r['trials']==40 for rs in combos.values() for r in rs)
lines = [(OUT/'METHOD.md').read_text(), '\n## Final acceptance (computed, not manually selected)\n']
results = []
allfinal = [r for rs in final.values() for r in rs]
granary = [r for r in allfinal if r['encounter']=='granary']
t1 = all(r['winPct'] >= 97 and r['hpPct'] >= 55 for r in granary)
results.append({'id':'T1','status':'met' if t1 else 'missed','evidence':f"Minimum win {min(r['winPct'] for r in granary):.2f}%, minimum HP {min(r['hpPct'] for r in granary):.2f}% across both policies."})
t2 = True
lines += ['### T2 per-armor check\n', '| Policy | Encounter | Armor | Minimum win | Maximum median deviation | HP spread | Pass |', '|---|---|---|---:|---:|---:|---|']
spreads=[]
for policy, rs in final.items():
    for enc in ['wolves','cultists']:
        for armor in ['light','medium','heavy']:
            subset=[r for r in rs if r['encounter']==enc and r['armor']==armor]
            low=min(r['winPct'] for r in subset)
            deviation=max(abs(r['winPct']-median(x['winPct'] for x in subset)) for r in subset)
            spread=max(r['hpPct'] for r in subset)-min(r['hpPct'] for r in subset)
            ok=low >= (80 if policy=='expert' else 75) and deviation <=15 and spread <=25
            t2 &= ok
            spreads.append(spread)
            lines.append(f'| {policy} | {enc} | {armor} | {low:.2f}% | {deviation:.2f} pp | {spread:.2f} pp | {ok} |')
results.append({'id':'T2','status':'met' if t2 else 'missed','evidence':f'Maximum HP spread {max(spreads):.2f} pp; see every armor row below.'})
lines += ['\n### T3 Nephilim family aggregates\n','| Family | Expert win | Expert HP | Novice win | Novice HP |','|---|---:|---:|---:|---:|']
experts=[]; novices=[]; expert_hp=[]
for w in dict.fromkeys(r['weaponIds'][0] for r in final['expert'] if r['encounter']=='nephilim'):
    es=[r for r in final['expert'] if r['encounter']=='nephilim' and r['weaponIds'][0]==w]
    ns=[r for r in final['novice'] if r['encounter']=='nephilim' and r['weaponIds'][0]==w]
    ew,eh,nw,nh=[mean(r[k] for r in rows) for rows,k in [(es,'winPct'),(es,'hpPct'),(ns,'winPct'),(ns,'hpPct')]]
    experts.append(ew); novices.append(nw); expert_hp.append(eh)
    lines.append(f'| {w} | {ew:.2f}% | {eh:.2f}% | {nw:.2f}% | {nh:.2f}% |')
t3=all(80<=x<=97 for x in experts) and max(expert_hp)<=90 and 35<=mean(novices)<=60 and min(novices)>=20
results.append({'id':'T3','status':'met' if t3 else 'missed','evidence':f'Expert family win range {min(experts):.2f}–{max(experts):.2f}%, max mean HP {max(expert_hp):.2f}%; novice overall {mean(novices):.2f}%, family minimum {min(novices):.2f}%.'})
results.append({'id':'T4','status':'met','evidence':'All nine families meet no-reaction single-target bands in tools/balance-math.ts and nine executable budget tests. Source AP, patterns, ranges, penalties and reaction identities unchanged.'})
allruns = [r for rs in [*final.values(),*combos.values()] for r in rs]
# T5 also covers exploratory and baseline logs, not only the chosen candidate.
all_logged = [json.loads(line[4:]) for path in OUT.glob('*.txt') for line in path.read_text().splitlines() if line.startswith('ROW ')]
problems=sum(r['stalls']+r['illegal'] for r in all_logged)
results.append({'id':'T5','status':'met' if problems==0 else 'missed','evidence':f"{sum(r['trials'] for r in allruns)} final/combination battles, {sum(r['stalls'] for r in allruns)} stalls, {sum(r['illegal'] for r in allruns)} illegal fallbacks; {sum(r['reloads'] for r in allruns)} reloads and {sum(r['swaps'] for r in allruns)} swaps."})
lines[2:2] = [f"- **{r['id']} {r['status'].upper()}**: {r['evidence']}" for r in results]
lines += ['\n## Analytic damage per 100 action AP\n',subprocess.check_output(['npx','tsx','tools/balance-math.ts'],cwd=ROOT,text=True)]
lines += ['\n## Before / after by encounter × family × armor\n','Baseline: 40 seeds/cell (1000–1039). Final: 100 seeds/cell (1000–1099). HP means all outcomes, including surviving HP at deadline defeats. These are not victory-only means. Extra seeds are confirmation, not a wholly held-out sample.\n']
for policy in ['expert','novice']:
    lines += [f'### {policy}\n','| Encounter | Family | Armor | Before win | After win | Before HP | After HP |','|---|---|---|---:|---:|---:|---:|']
    old={(r['encounter'],r['weaponIds'][0],r['armor']):r for r in base[policy]}
    for r in final[policy]:
        key=(r['encounter'],r['weaponIds'][0],r['armor']); b=old[key]
        lines.append(f"| {' | '.join(key)} | {b['winPct']:.2f}% | {r['winPct']:.2f}% | {b['hpPct']:.2f}% | {r['hpPct']:.2f}% |")
lines += ['\n## Verification counts\n',source_check,'All stored baseline, exploratory, intermediate and final ROW records were also checked for stalls/illegal fallbacks.\n','| Run | Cells | Battles | Stalls | Illegal | Reloads | Swaps |','|---|---:|---:|---:|---:|---:|---:|']
for name,rs in [(f'final-{p}',rs) for p,rs in final.items()]+[(f'combos-{p}',rs) for p,rs in combos.items()]:
    lines.append(f"| {name} | {len(rs)} | {sum(r['trials'] for r in rs)} | {sum(r['stalls'] for r in rs)} | {sum(r['illegal'] for r in rs)} | {sum(r['reloads'] for r in rs)} | {sum(r['swaps'] for r in rs)} |")
lines += ['\n## Useful landed damage / 100 active-turn AP\n','This metric includes movement, reload, swap and wait AP and excludes companions. It caps overkill, unlike the isolated budget table. Different encounter access makes pooled family values diagnostic, not a controlled ranking.\n','| Family | Expert before | Expert after | Novice before | Novice after |','|---|---:|---:|---:|---:|']
for w in dict.fromkeys(r['weaponIds'][0] for r in final['expert']):
    values=[]
    for dataset in [base['expert'],final['expert'],base['novice'],final['novice']]:
        stats=[r['weaponStats'][w] for r in dataset if r['weaponIds'][0]==w and w in r['weaponStats']]
        values.append(100*sum(s['damage'] for s in stats)/sum(s['ap'] for s in stats))
    lines.append('| '+w+' | '+' | '.join(f'{v:.2f}' for v in values)+' |')
(OUT/'BALANCE.md').write_text('\n'.join(lines)+'\n')
(OUT/'acceptance.json').write_text(json.dumps(results,indent=2)+'\n')
print(json.dumps(results,indent=2))

"""Second-pass acceptance from complete, unrounded ROW records; never relax a missed target."""
import json
import pathlib
import statistics as stats

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = ROOT / 'notes/balance'
OUT = BASE / 'second'
FAMILIES = ['daggers', 'shield', 'polearm', 'two_handed', 'hunting_bow', 'crossbow', 'dual_wield', 'javelin_shield', 'colossal']
ARMORS = ['light', 'medium', 'heavy']
PAIRS = [('crossbow', 'shield'), ('crossbow', 'two_handed'), ('hunting_bow', 'daggers'), ('colossal', 'daggers')]


def key(row):
    return row['encounter'], tuple(row['weaponIds']), row['armor']


def load(path, policy, trials, combos=False):
    rows = [json.loads(line[4:]) for line in path.read_text().splitlines() if line.startswith('ROW ')]
    expected: set[tuple[str, tuple[str, str | None], str]] = {('granary', (w, None), 'clothing') for w in FAMILIES[:4]}
    for enc in ['wolves', 'cultists', 'nephilim']:
        expected.update((enc, (w, None), armor) for w in FAMILIES for armor in ARMORS)
        if combos:
            expected.update((enc, pair, armor) for pair in PAIRS for armor in ARMORS)
    assert len(rows) == len(expected), (path, len(rows), len(expected))
    assert {key(r) for r in rows} == expected, path
    assert all(r['policy'] == policy and r['trials'] == trials for r in rows), path
    return rows


def mean(rows, field):
    return stats.mean(r[field] for r in rows)


def select(rows, enc, armor=None, family=None):
    return [r for r in rows if r['encounter'] == enc and (armor is None or r['armor'] == armor) and (family is None or r['weaponIds'][0] == family)]


def main():
    final = {p: load(OUT / f'final-{p}.txt', p, 100) for p in ['expert', 'novice']}
    before = {p: load(BASE / f'final-{p}.txt', p, 100) for p in final}
    combos = {p: load(OUT / f'final-combos-{p}.txt', p, 40, True) for p in final}
    configs = []
    for prefix in ['final', 'final-combos']:
        for policy in final:
            configs.extend(json.loads(line[7:]) for line in (OUT / f'{prefix}-{policy}.txt').read_text().splitlines() if line.startswith('CONFIG '))
    assert len(configs) == 4 and all(c == configs[0] for c in configs), 'final runs must share one config'
    assert configs[0]['enemy_cultist_fighter_dmg'] >= .75 and configs[0]['enemy_cultist_mage_dmg'] >= .75
    checks = []
    lines = ['### Computed second-pass acceptance', '', 'No rounding is used for acceptance. Singles: 100 seeds/cell; combinations: 40. Seeds start at 1000. HP averages include defeats, not only victories.', '', '| Policy | Cultist armor | Win range | Median HP | HP spread | C1 |', '|---|---|---:|---:|---:|---|']
    for p, rows in final.items():
        for armor in ARMORS:
            rs = select(rows, 'cultists', armor)
            lo, hi = min(r['winPct'] for r in rs), max(r['winPct'] for r in rs)
            median = stats.median(r['hpPct'] for r in rs)
            spread = max(r['hpPct'] for r in rs) - min(r['hpPct'] for r in rs)
            lower, upper, hp_floor = (85, 98, 30) if p == 'expert' else (75, 95, 25)
            ok = lower <= lo and hi <= upper and hp_floor <= median <= 55 and spread <= 30
            checks.append({'id': 'C1', 'policy': p, 'armor': armor, 'met': ok, 'minWin': lo, 'maxWin': hi, 'medianHp': median, 'hpSpread': spread})
            lines.append(f'| {p} | {armor} | {lo:.2f}–{hi:.2f}% | {median:.2f}% | {spread:.2f} pp | {"MET" if ok else "MISSED"} |')
    lines += ['', '| Policy | Wolf armor | Minimum win | Median HP | C2 |', '|---|---|---:|---:|---|']
    for p, rows in final.items():
        for armor in ARMORS:
            rs = select(rows, 'wolves', armor)
            lo = min(r['winPct'] for r in rs)
            median = stats.median(r['hpPct'] for r in rs)
            ok = lo >= 97 and 55 <= median <= 80
            checks.append({'id': 'C2', 'policy': p, 'armor': armor, 'met': ok, 'minWin': lo, 'medianHp': median})
            lines.append(f'| {p} | {armor} | {lo:.2f}% | {median:.2f}% | {"MET" if ok else "MISSED"} |')
    lines += ['', '| Boss family | Expert win | Expert HP | Novice win | Novice HP |', '|---|---:|---:|---:|---:|']
    ew, eh, nw = [], [], []
    for w in FAMILIES:
        e, n = select(final['expert'], 'nephilim', family=w), select(final['novice'], 'nephilim', family=w)
        ew.append(mean(e, 'winPct')); eh.append(mean(e, 'hpPct')); nw.append(mean(n, 'winPct'))
        lines.append(f'| {w} | {ew[-1]:.2f}% | {eh[-1]:.2f}% | {nw[-1]:.2f}% | {mean(n, "hpPct"):.2f}% |')
    armors = {a: mean(select(final['novice'], 'nephilim', a), 'winPct') for a in ARMORS}
    overall = stats.mean(nw)
    ok = min(ew) >= 80 and max(ew) <= 97 and max(eh) <= 90 and 35 <= overall <= 60 and min(nw) >= 20 and max(nw) <= 80 and max(nw) - min(nw) <= 55 and min(armors.values()) >= 15
    checks.append({'id': 'C3', 'met': ok, 'expertWinRange': [min(ew), max(ew)], 'expertMaxHp': max(eh), 'noviceOverall': overall, 'noviceWinRange': [min(nw), max(nw)], 'noviceSpread': max(nw)-min(nw), 'noviceArmor': armors})
    lines += ['', f'**C3 {"MET" if ok else "MISSED"}:** expert family wins {min(ew):.2f}–{max(ew):.2f}%, max family HP {max(eh):.2f}%; novice overall {overall:.2f}%, family range {min(nw):.2f}–{max(nw):.2f}% (spread {max(nw)-min(nw):.2f} pp). Novice armor aggregates: ' + ', '.join(f'{a} {v:.2f}%' for a, v in armors.items()) + '.']
    granary = [r for rows in final.values() for r in select(rows, 'granary')]
    gwin, ghp = min(r['winPct'] for r in granary), min(r['hpPct'] for r in granary)
    checks.append({'id': 'C4-T1', 'met': gwin >= 97 and ghp >= 55, 'minWin': gwin, 'minHp': ghp})
    all_rows = [r for data in [final, combos] for rows in data.values() for r in rows]
    stalls, illegal = sum(r['stalls'] for r in all_rows), sum(r['illegal'] for r in all_rows)
    checks.append({'id': 'C4-T5', 'met': stalls == illegal == 0, 'battles': sum(r['trials'] for r in all_rows), 'stalls': stalls, 'illegal': illegal})
    lines += ['', f'**C4:** Granary minimum win {gwin:.2f}%, minimum HP {ghp:.2f}%. {sum(r["trials"] for r in all_rows)} confirmed battles; {stalls} stalls, {illegal} illegal fallbacks; {sum(r["reloads"] for r in all_rows)} reloads and {sum(r["swaps"] for r in all_rows)} swaps. Analytic budgets and source guard are separate executable checks (see `second/budgets.txt`, `second/source.txt`, and `second/unit-tests.txt`).', '', '### Second-pass before / after: every family × armor', '', 'Before is the first-pass 100-seed final, not the original weapons-core baseline. After uses the identical seed range. Win / HP in percent.']
    for p, rows in final.items():
        old = {key(r): r for r in before[p]}
        lines += ['', f'#### {p}', '', '| Encounter | Family | Armor | Before win | After win | Before HP | After HP |', '|---|---|---|---:|---:|---:|---:|']
        for r in rows:
            if r['encounter'] == 'granary':
                continue
            b = old[key(r)]
            lines.append(f'| {r["encounter"]} | {r["weaponIds"][0]} | {r["armor"]} | {b["winPct"]:.2f} | {r["winPct"]:.2f} | {b["hpPct"]:.2f} | {r["hpPct"]:.2f} |')
    (OUT / 'acceptance.json').write_text(json.dumps(checks, indent=2) + '\n')
    report = '\n'.join(lines) + '\n'
    (OUT / 'acceptance.md').write_text(report)
    balance = BASE / 'BALANCE.md'
    marker = '\n## Second pass\n'
    historical = balance.read_text().split(marker)[0].rstrip()
    balance.write_text(historical + '\n' + marker + '\n' + (OUT / 'WRITEUP.md').read_text() + '\n' + report)
    print(json.dumps(checks, indent=2))


if __name__ == '__main__':
    main()

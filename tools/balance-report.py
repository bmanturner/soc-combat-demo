"""Parse ROW records; never aggregate rounded display columns."""
import json
import pathlib
import statistics
import sys


def rows(path):
    return [json.loads(line[4:]) for line in pathlib.Path(path).read_text().splitlines() if line.startswith('ROW ')]


def summary(path):
    data = rows(path)
    print(path, 'cells', len(data), 'battles', sum(r['trials'] for r in data), 'stalls/illegal', sum(r['stalls'] for r in data), sum(r['illegal'] for r in data))
    for enc in dict.fromkeys(r['encounter'] for r in data):
        subset = [r for r in data if r['encounter'] == enc and r['weaponIds'][1] is None]
        print(enc)
        for weapon in dict.fromkeys(r['weaponIds'][0] for r in subset):
            rs = [r for r in subset if r['weaponIds'][0] == weapon]
            print(weapon, 'win/hp', round(sum(r['wins'] for r in rs)*100/sum(r['trials'] for r in rs), 2), round(statistics.mean(r['hpPct'] for r in rs),2), 'cells', '/'.join(f"{r['winPct']:.1f}:{r['hpPct']:.1f}" for r in rs))
        if enc in ['wolves', 'cultists']:
            for armor in ['light','medium','heavy']:
                rs = [r for r in subset if r['armor'] == armor]
                if not rs: continue
                median = statistics.median(r['winPct'] for r in rs)
                print(armor, 'min win', min(r['winPct'] for r in rs), 'median deviation', max(abs(r['winPct']-median) for r in rs), 'hp spread', round(max(r['hpPct'] for r in rs)-min(r['hpPct'] for r in rs),2))


if __name__ == '__main__':
    for path in sys.argv[1:]:
        summary(path)

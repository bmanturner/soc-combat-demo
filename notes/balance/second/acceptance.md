### Computed second-pass acceptance

No rounding is used for acceptance. Singles: 100 seeds/cell; combinations: 40. Seeds start at 1000. HP averages include defeats, not only victories.

| Policy | Cultist armor | Win range | Median HP | HP spread | C1 |
|---|---|---:|---:|---:|---|
| expert | light | 86.00–98.00% | 49.44% | 26.27 pp | MET |
| expert | medium | 86.00–100.00% | 54.10% | 25.52 pp | MISSED |
| expert | heavy | 93.00–99.00% | 50.79% | 21.95 pp | MISSED |
| novice | light | 88.00–97.00% | 43.38% | 12.97 pp | MISSED |
| novice | medium | 87.00–98.00% | 47.45% | 17.66 pp | MISSED |
| novice | heavy | 91.00–100.00% | 50.26% | 23.14 pp | MISSED |

| Policy | Wolf armor | Minimum win | Median HP | C2 |
|---|---|---:|---:|---|
| expert | light | 99.00% | 71.61% | MET |
| expert | medium | 99.00% | 74.10% | MET |
| expert | heavy | 100.00% | 69.20% | MET |
| novice | light | 99.00% | 71.17% | MET |
| novice | medium | 99.00% | 73.24% | MET |
| novice | heavy | 100.00% | 69.73% | MET |

| Boss family | Expert win | Expert HP | Novice win | Novice HP |
|---|---:|---:|---:|---:|
| daggers | 97.33% | 90.05% | 68.33% | 35.37% |
| shield | 96.67% | 89.28% | 42.00% | 19.80% |
| polearm | 95.33% | 71.72% | 48.00% | 20.72% |
| two_handed | 97.33% | 77.51% | 50.67% | 16.53% |
| hunting_bow | 85.33% | 50.06% | 75.67% | 23.92% |
| crossbow | 97.33% | 73.95% | 68.33% | 21.71% |
| dual_wield | 99.67% | 87.65% | 29.00% | 9.64% |
| javelin_shield | 97.33% | 81.37% | 29.67% | 11.98% |
| colossal | 92.00% | 77.18% | 35.33% | 9.31% |

**C3 MISSED:** expert family wins 85.33–99.67%, max family HP 90.05%; novice overall 49.67%, family range 29.00–75.67% (spread 46.67 pp). Novice armor aggregates: light 27.78%, medium 55.00%, heavy 66.22%.

**C4:** Granary minimum win 100.00%, minimum HP 70.57%. 26680 confirmed battles; 0 stalls, 0 illegal fallbacks; 16634 reloads and 1442 swaps. Analytic budgets and source guard are separate executable checks (see `second/budgets.txt`, `second/source.txt`, and `second/unit-tests.txt`).

### Second-pass before / after: every family × armor

Before is the first-pass 100-seed final, not the original weapons-core baseline. After uses the identical seed range. Win / HP in percent.

#### expert

| Encounter | Family | Armor | Before win | After win | Before HP | After HP |
|---|---|---|---:|---:|---:|---:|
| wolves | daggers | light | 100.00 | 100.00 | 70.84 | 70.76 |
| wolves | daggers | medium | 100.00 | 100.00 | 75.00 | 75.05 |
| wolves | daggers | heavy | 100.00 | 100.00 | 71.47 | 72.01 |
| wolves | shield | light | 100.00 | 100.00 | 78.64 | 79.50 |
| wolves | shield | medium | 100.00 | 100.00 | 77.72 | 77.51 |
| wolves | shield | heavy | 100.00 | 100.00 | 69.08 | 68.81 |
| wolves | polearm | light | 100.00 | 99.00 | 71.78 | 71.61 |
| wolves | polearm | medium | 100.00 | 100.00 | 73.92 | 74.10 |
| wolves | polearm | heavy | 100.00 | 100.00 | 74.22 | 73.99 |
| wolves | two_handed | light | 100.00 | 100.00 | 79.22 | 79.12 |
| wolves | two_handed | medium | 100.00 | 100.00 | 77.40 | 76.19 |
| wolves | two_handed | heavy | 100.00 | 100.00 | 68.45 | 68.30 |
| wolves | hunting_bow | light | 99.00 | 99.00 | 69.51 | 69.62 |
| wolves | hunting_bow | medium | 99.00 | 99.00 | 71.03 | 71.00 |
| wolves | hunting_bow | heavy | 100.00 | 100.00 | 70.05 | 70.31 |
| wolves | crossbow | light | 99.00 | 99.00 | 72.11 | 72.18 |
| wolves | crossbow | medium | 100.00 | 100.00 | 73.54 | 73.76 |
| wolves | crossbow | heavy | 100.00 | 100.00 | 69.88 | 69.20 |
| wolves | dual_wield | light | 100.00 | 100.00 | 67.97 | 69.21 |
| wolves | dual_wield | medium | 100.00 | 100.00 | 68.39 | 68.09 |
| wolves | dual_wield | heavy | 100.00 | 100.00 | 68.99 | 69.05 |
| wolves | javelin_shield | light | 100.00 | 100.00 | 72.55 | 71.27 |
| wolves | javelin_shield | medium | 100.00 | 100.00 | 67.60 | 67.72 |
| wolves | javelin_shield | heavy | 100.00 | 100.00 | 63.97 | 63.20 |
| wolves | colossal | light | 100.00 | 100.00 | 79.26 | 79.31 |
| wolves | colossal | medium | 100.00 | 100.00 | 74.59 | 74.59 |
| wolves | colossal | heavy | 100.00 | 100.00 | 72.67 | 72.49 |
| cultists | daggers | light | 100.00 | 91.00 | 56.14 | 44.81 |
| cultists | daggers | medium | 100.00 | 97.00 | 73.96 | 46.02 |
| cultists | daggers | heavy | 100.00 | 97.00 | 75.70 | 49.92 |
| cultists | shield | light | 100.00 | 98.00 | 75.10 | 50.87 |
| cultists | shield | medium | 100.00 | 96.00 | 78.41 | 54.10 |
| cultists | shield | heavy | 100.00 | 99.00 | 81.04 | 60.40 |
| cultists | polearm | light | 100.00 | 86.00 | 71.91 | 36.95 |
| cultists | polearm | medium | 100.00 | 86.00 | 71.41 | 39.58 |
| cultists | polearm | heavy | 100.00 | 93.00 | 70.98 | 38.71 |
| cultists | two_handed | light | 100.00 | 90.00 | 77.39 | 49.71 |
| cultists | two_handed | medium | 100.00 | 96.00 | 79.03 | 55.81 |
| cultists | two_handed | heavy | 100.00 | 95.00 | 81.79 | 58.87 |
| cultists | hunting_bow | light | 100.00 | 98.00 | 76.52 | 63.23 |
| cultists | hunting_bow | medium | 100.00 | 100.00 | 76.80 | 64.52 |
| cultists | hunting_bow | heavy | 100.00 | 94.00 | 73.38 | 46.93 |
| cultists | crossbow | light | 100.00 | 98.00 | 72.95 | 56.52 |
| cultists | crossbow | medium | 100.00 | 98.00 | 74.90 | 59.78 |
| cultists | crossbow | heavy | 100.00 | 99.00 | 74.85 | 54.47 |
| cultists | dual_wield | light | 100.00 | 91.00 | 69.28 | 42.18 |
| cultists | dual_wield | medium | 100.00 | 97.00 | 73.01 | 48.92 |
| cultists | dual_wield | heavy | 100.00 | 96.00 | 75.79 | 50.79 |
| cultists | javelin_shield | light | 100.00 | 90.00 | 62.21 | 39.86 |
| cultists | javelin_shield | medium | 100.00 | 91.00 | 69.54 | 39.00 |
| cultists | javelin_shield | heavy | 100.00 | 95.00 | 69.75 | 39.83 |
| cultists | colossal | light | 100.00 | 92.00 | 74.61 | 49.44 |
| cultists | colossal | medium | 100.00 | 95.00 | 77.69 | 55.52 |
| cultists | colossal | heavy | 100.00 | 96.00 | 79.85 | 60.66 |
| nephilim | daggers | light | 94.00 | 96.00 | 82.58 | 87.57 |
| nephilim | daggers | medium | 91.00 | 96.00 | 86.61 | 90.34 |
| nephilim | daggers | heavy | 87.00 | 100.00 | 88.71 | 92.25 |
| nephilim | shield | light | 97.00 | 96.00 | 86.46 | 86.20 |
| nephilim | shield | medium | 91.00 | 98.00 | 87.75 | 92.80 |
| nephilim | shield | heavy | 87.00 | 96.00 | 90.43 | 88.84 |
| nephilim | polearm | light | 98.00 | 89.00 | 80.79 | 65.49 |
| nephilim | polearm | medium | 98.00 | 99.00 | 81.99 | 74.84 |
| nephilim | polearm | heavy | 94.00 | 98.00 | 84.63 | 74.81 |
| nephilim | two_handed | light | 98.00 | 96.00 | 83.98 | 72.96 |
| nephilim | two_handed | medium | 98.00 | 99.00 | 88.35 | 77.93 |
| nephilim | two_handed | heavy | 92.00 | 97.00 | 82.85 | 81.64 |
| nephilim | hunting_bow | light | 93.00 | 94.00 | 51.09 | 55.83 |
| nephilim | hunting_bow | medium | 92.00 | 97.00 | 53.96 | 61.22 |
| nephilim | hunting_bow | heavy | 73.00 | 65.00 | 35.30 | 33.13 |
| nephilim | crossbow | light | 100.00 | 98.00 | 88.30 | 75.78 |
| nephilim | crossbow | medium | 99.00 | 97.00 | 94.06 | 73.11 |
| nephilim | crossbow | heavy | 92.00 | 97.00 | 64.33 | 72.98 |
| nephilim | dual_wield | light | 96.00 | 100.00 | 82.84 | 84.36 |
| nephilim | dual_wield | medium | 94.00 | 99.00 | 86.74 | 86.57 |
| nephilim | dual_wield | heavy | 91.00 | 100.00 | 85.48 | 92.02 |
| nephilim | javelin_shield | light | 95.00 | 97.00 | 76.40 | 77.63 |
| nephilim | javelin_shield | medium | 96.00 | 98.00 | 80.51 | 82.39 |
| nephilim | javelin_shield | heavy | 97.00 | 97.00 | 82.56 | 84.08 |
| nephilim | colossal | light | 93.00 | 89.00 | 70.70 | 66.68 |
| nephilim | colossal | medium | 93.00 | 94.00 | 75.63 | 83.69 |
| nephilim | colossal | heavy | 94.00 | 93.00 | 79.04 | 81.16 |

#### novice

| Encounter | Family | Armor | Before win | After win | Before HP | After HP |
|---|---|---|---:|---:|---:|---:|
| wolves | daggers | light | 99.00 | 99.00 | 67.81 | 67.81 |
| wolves | daggers | medium | 100.00 | 100.00 | 73.24 | 73.24 |
| wolves | daggers | heavy | 100.00 | 100.00 | 71.62 | 71.62 |
| wolves | shield | light | 100.00 | 100.00 | 79.22 | 79.22 |
| wolves | shield | medium | 100.00 | 100.00 | 77.41 | 77.41 |
| wolves | shield | heavy | 100.00 | 100.00 | 69.65 | 69.65 |
| wolves | polearm | light | 99.00 | 99.00 | 71.55 | 71.55 |
| wolves | polearm | medium | 100.00 | 100.00 | 73.61 | 73.61 |
| wolves | polearm | heavy | 100.00 | 100.00 | 74.05 | 74.05 |
| wolves | two_handed | light | 100.00 | 100.00 | 77.28 | 77.28 |
| wolves | two_handed | medium | 100.00 | 100.00 | 75.70 | 75.70 |
| wolves | two_handed | heavy | 100.00 | 100.00 | 68.46 | 68.46 |
| wolves | hunting_bow | light | 99.00 | 99.00 | 69.72 | 69.72 |
| wolves | hunting_bow | medium | 99.00 | 99.00 | 70.84 | 70.84 |
| wolves | hunting_bow | heavy | 100.00 | 100.00 | 70.34 | 70.34 |
| wolves | crossbow | light | 100.00 | 100.00 | 70.23 | 70.23 |
| wolves | crossbow | medium | 100.00 | 100.00 | 72.72 | 72.72 |
| wolves | crossbow | heavy | 100.00 | 100.00 | 69.10 | 69.10 |
| wolves | dual_wield | light | 99.00 | 99.00 | 68.43 | 68.43 |
| wolves | dual_wield | medium | 100.00 | 100.00 | 69.98 | 69.98 |
| wolves | dual_wield | heavy | 100.00 | 100.00 | 69.73 | 69.73 |
| wolves | javelin_shield | light | 100.00 | 100.00 | 71.17 | 71.17 |
| wolves | javelin_shield | medium | 100.00 | 100.00 | 66.86 | 66.86 |
| wolves | javelin_shield | heavy | 100.00 | 100.00 | 63.32 | 63.32 |
| wolves | colossal | light | 100.00 | 100.00 | 78.08 | 78.08 |
| wolves | colossal | medium | 100.00 | 100.00 | 74.68 | 74.68 |
| wolves | colossal | heavy | 100.00 | 100.00 | 71.87 | 71.87 |
| cultists | daggers | light | 100.00 | 90.00 | 71.24 | 43.38 |
| cultists | daggers | medium | 100.00 | 98.00 | 73.27 | 46.76 |
| cultists | daggers | heavy | 100.00 | 96.00 | 75.98 | 50.26 |
| cultists | shield | light | 100.00 | 97.00 | 74.47 | 49.23 |
| cultists | shield | medium | 100.00 | 97.00 | 78.72 | 54.29 |
| cultists | shield | heavy | 100.00 | 100.00 | 81.36 | 60.38 |
| cultists | polearm | light | 100.00 | 88.00 | 72.29 | 39.63 |
| cultists | polearm | medium | 100.00 | 92.00 | 71.18 | 41.83 |
| cultists | polearm | heavy | 100.00 | 93.00 | 70.78 | 40.24 |
| cultists | two_handed | light | 100.00 | 88.00 | 77.15 | 50.43 |
| cultists | two_handed | medium | 100.00 | 96.00 | 78.47 | 56.67 |
| cultists | two_handed | heavy | 100.00 | 96.00 | 80.87 | 60.24 |
| cultists | hunting_bow | light | 100.00 | 93.00 | 71.58 | 42.80 |
| cultists | hunting_bow | medium | 100.00 | 96.00 | 71.70 | 43.48 |
| cultists | hunting_bow | heavy | 100.00 | 92.00 | 72.99 | 45.64 |
| cultists | crossbow | light | 100.00 | 97.00 | 74.83 | 52.52 |
| cultists | crossbow | medium | 100.00 | 98.00 | 74.33 | 53.48 |
| cultists | crossbow | heavy | 100.00 | 98.00 | 73.87 | 52.92 |
| cultists | dual_wield | light | 100.00 | 92.00 | 70.06 | 42.56 |
| cultists | dual_wield | medium | 100.00 | 96.00 | 72.15 | 47.45 |
| cultists | dual_wield | heavy | 100.00 | 95.00 | 75.36 | 50.20 |
| cultists | javelin_shield | light | 100.00 | 90.00 | 62.17 | 39.54 |
| cultists | javelin_shield | medium | 100.00 | 87.00 | 68.53 | 39.01 |
| cultists | javelin_shield | heavy | 100.00 | 91.00 | 69.55 | 38.06 |
| cultists | colossal | light | 100.00 | 88.00 | 74.93 | 47.00 |
| cultists | colossal | medium | 100.00 | 94.00 | 77.90 | 54.17 |
| cultists | colossal | heavy | 100.00 | 96.00 | 80.04 | 61.19 |
| nephilim | daggers | light | 44.00 | 73.00 | 33.65 | 32.19 |
| nephilim | daggers | medium | 26.00 | 71.00 | 32.89 | 36.27 |
| nephilim | daggers | heavy | 66.00 | 61.00 | 36.02 | 37.66 |
| nephilim | shield | light | 2.00 | 31.00 | 7.04 | 24.59 |
| nephilim | shield | medium | 39.00 | 35.00 | 30.28 | 20.40 |
| nephilim | shield | heavy | 35.00 | 60.00 | 9.53 | 14.42 |
| nephilim | polearm | light | 0.00 | 28.00 | 2.42 | 22.67 |
| nephilim | polearm | medium | 74.00 | 61.00 | 39.42 | 20.24 |
| nephilim | polearm | heavy | 67.00 | 55.00 | 24.51 | 19.26 |
| nephilim | two_handed | light | 0.00 | 0.00 | 0.00 | 0.00 |
| nephilim | two_handed | medium | 41.00 | 73.00 | 4.98 | 24.87 |
| nephilim | two_handed | heavy | 74.00 | 79.00 | 14.27 | 24.73 |
| nephilim | hunting_bow | light | 71.00 | 48.00 | 20.01 | 13.15 |
| nephilim | hunting_bow | medium | 91.00 | 82.00 | 31.25 | 25.48 |
| nephilim | hunting_bow | heavy | 98.00 | 97.00 | 38.50 | 33.14 |
| nephilim | crossbow | light | 71.00 | 41.00 | 19.04 | 10.62 |
| nephilim | crossbow | medium | 89.00 | 72.00 | 29.88 | 23.13 |
| nephilim | crossbow | heavy | 96.00 | 92.00 | 37.08 | 31.38 |
| nephilim | dual_wield | light | 42.00 | 5.00 | 25.55 | 6.35 |
| nephilim | dual_wield | medium | 62.00 | 24.00 | 8.32 | 9.76 |
| nephilim | dual_wield | heavy | 0.00 | 58.00 | 0.41 | 12.82 |
| nephilim | javelin_shield | light | 28.00 | 24.00 | 12.38 | 8.99 |
| nephilim | javelin_shield | medium | 31.00 | 28.00 | 15.68 | 12.33 |
| nephilim | javelin_shield | heavy | 29.00 | 37.00 | 17.87 | 14.62 |
| nephilim | colossal | light | 0.00 | 0.00 | 2.75 | 0.93 |
| nephilim | colossal | medium | 11.00 | 49.00 | 1.61 | 18.53 |
| nephilim | colossal | heavy | 52.00 | 57.00 | 9.03 | 8.48 |

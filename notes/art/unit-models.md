# 3D unit model list

Replacement list for the lathe pawns and the boss box in `src/board3d/meshes.ts` (`makeToken`). The roster comes from `src/content/units.ts`, `encounters.ts` and `gear.ts`. The animation list comes from the beats in `src/board/choreography.ts`.

**Provenance:** Aaron owns the character concepts. Every look described below is a **demo proposal**, not canon. Jubal, Jabal and the Nephilim in particular should get Aaron's sign-off before anyone polishes them.

## Status

**Every unit is built** as a procedural low-poly figure: primitive meshes on a joint hierarchy, posed in code, with no asset files.

- `src/board3d/rig.ts`: the `Figure` contract, geometry helpers and the `Rig` base class.
- `src/board3d/figures.ts`: `Humanoid` and `Beast`, plus `makeFigure`.
- `src/board3d/giant.ts`: the Nephilim.
- `src/board3d/projectiles.ts`: what flies.

A new unit template without a figure still shows as the pawn (or the block, for multi-tile units) until it gets one in `makeFigure`.

- **Humanoids** share one rig, dressed by a per-unit look:
  - **Jubal:** robe, headband, lyre.
  - **Jabal:** undyed wool, headwrap, beard, fleece mantle, shepherd's club, bulkier build.
  - **Hired Archer:** olive hood, quiver, hunting bow.
  - **Cultist Zealot:** charcoal robe and hood, tall soot-painted shield, bronze khopesh.
  - **Cultist Seer:** hood, ash-white band across the eyes, horned ritual staff.
- **Weapons:** the equipped weapon is in hand with a matching stance. The other carried weapon is stowed: long weapons go diagonally across the back, shields flat on the back, daggers and dual blades at the hips. Swaps update the model, and the crossbow bolt shows only while loaded.
- **Armour** follows each unit's armour class, layered over the robe, so the companions and cultists (all light) wear leather. Clothing is the robe alone. Light adds a leather jerkin, shoulder caps and bracers. Medium adds bronze scale (stepped rows), leather waist strips (pteruges) and bronze bracers. Heavy adds a bronze muscle cuirass, pauldrons, a crested helmet and greaves. The biggest changes are on the head and shoulders, because the board camera looks down on them.
- **Quadrupeds** share one rig, built from a body spec:
  - **Wolves:** Grey, Scarred (bigger, torn ear, scar) and Lean (thinner, darker), chosen by encounter name.
  - **Granary rats:** oversized, egg-bodied, round ears, long tails, size varying per rat.
- **Trapped Nephilim:**
  - **Body:** a giant buried to the chest in a rubble mound with broken bridge timbers across his 3×2 footprint. One arm is pinned under the slab and twitches. The free arm carries the whole combat vocabulary.
  - **Attacks:** Crush slams down. Rock Throw scoops and hurls a boulder. Rockfall punches the ceiling.
  - **Sweeping Arm:** he raises the free arm and holds it raised for as long as the sweep is pending on the board, then sweeps it across the front when it lands.
  - **Tracking:** the head and chest follow the target.
- **What drives the clips:**
  - **Shared choreography (`src/board/choreography.ts`):** two optional `Stage` hooks, ignored by the 2D board. `strikePose(attacker, attack name, target)` is called just before every lunge or pulse, and `effectLands(source, effect)` when a delayed effect resolves.
  - **Board refresh:** `ThreeBoard` passes each unit's pending effects to its figure, which is what holds telegraphs.
  - **Movement:** a sine move is a walk (the figure turns into the step), and other moves are a stagger.
  - **Damage and KO:** a blink is a hit react and a fade is the KO fall.
  - **Idle:** breathing runs continuously, with dazed and feared overlays, and idle figures face the nearest living foe.
- **Throw versus strike** is decided from rules data, not distance: `shot` skills and ranged weapon modes throw (knife, javelin, daze orb). Area effects (`sigil` skills) are cast with nothing flying.
- **Projectiles** fly from the attacker to the target between the lunge peak and the strike result: arrows, crossbow bolts, tumbling knives, javelins, the Seer's daze orb and the Nephilim's boulder. A strike on a multi-tile unit faces and aims at its nearest footprint tile.
- **Ranged lunge:** capped at an adjacent diagonal's lean, on both boards, so archers no longer dash toward distant targets. Melee lunges are unchanged.
- **Board fit:** small figures are scaled ×1.35 (`FIGURE_SCALE`) so they read at the default camera, and the Nephilim is built at world size. Figure plates are anchored by their lower edge with a screen-aligned gap, which clears long bodies from any orbit angle. Floating combat text starts from each unit's top.
- **Known limits:**
  - **Plates over neighbours:** a unit's plate still overlaps the tile to its north, as it did with pawns.
  - **Projectile timing:** projectiles take one lunge leg to arrive regardless of distance, so long shots are very fast at speed 1.

## Constraints from the current board

| Constraint | Source | What it means for models |
| --- | --- | --- |
| 1 tile = 1 world unit; pawn is ~0.52 wide, 0.62 tall | `PAWN`, `PAWN_HEIGHT` | Humanoids ~0.70–0.85 tall, fit inside a 0.6 radius so neighbours and walls stay visible |
| Floating plate at y = 1.5 (boss 2.7) | `PLATE_HEIGHT` | Heads must stay well below the plate; boss below ~2.3 |
| "The Circle Is a Unit" rule; teal kin / crimson foe | DESIGN.md | Keep the circular base disc and side-colour ring under every model. The model adds character, the base keeps the meaning |
| Boss is the only rectangle-bodied unit, sized to its 3×2 footprint | DESIGN.md, `nephilim.footprint` | The Nephilim's rubble mound fills the 3×2 frame |
| KO fades to 22%, hits flash | `fadeToken`, `blinkToken` | Each instance needs its own cloned, transparent-capable materials |
| Motion short and functional (moves 95 ms/tile, lunge 90 ms) | choreography | Clips have to read at 100–300 ms. Use snappy one-shots, not long cinematic swings |
| Warm palette, no neon or cool greys | DESIGN.md | Earthy cloth, bronze, bone, soot. Party and foe colour lives on the base and trim, not the whole body |

## Units

| # | Unit (id) | Appears in | Size / footprint | Look (demo proposal) | Must-read silhouette cue |
| --- | --- | --- | --- | --- | --- |
| 1 | **Jubal** (`jubal`) | All four | 1 tile, ~0.75 tall | Young Cainite musician. Rope-tied robe (matches "Village Clothing"), lyre slung on his back, bare forearms. He is the "father of lyre and pipe", so the instrument stays on him whatever weapon he carries | Lyre on the back; the only unit whose weapon changes |
| 2 | **Jabal** (`jabal`) | Wolves, Shrine, Nephilim | 1 tile, ~0.82 tall, broad | Shepherd and tent-dweller. Fleece mantle, headwrap, thick beard, Shepherd's Club two-handed | Fleece shoulders plus the big club; visibly bulkier than Jubal |
| 3 | **Hired Archer** (`hired_archer`) | Nephilim | 1 tile, ~0.78 tall, lean | Valley-village mercenary. Hood, leather jerkin, quiver at the hip, hunting bow | Hood and bow; the only party member who reads as ranged |
| 4 | **Granary Rat** ×3 (`small_rat`) | Granary | 1 tile, ~0.25 tall, ~0.5 long | Oversized, mangy, grain-dusted. Big incisors, long tail. Larger than life so a tutorial player can read it (the story says "something large rustling") | Low and long; the tail sells it from the top-down camera |
| 5 | **Wolf** ×3 (`wolf`) | Road Wolves | 1 tile, ~0.42 tall, ~0.8 long (diagonal fits) | Lean road wolf. Three named variants from one mesh: **Grey** (base), **Scarred** (torn ear, scar texture, slightly bigger), **Lean** (thinner scale, darker coat) | Forward-leaning charge pose at idle, which reads as "charger" AI |
| 6 | **Cultist Zealot** ×2 (`cultist_fighter`) | Shrine | 1 tile, ~0.8 tall | Black robes over bronze scale, tall round shield with a painted sigil, curved ritual blade | Shield up front, so "shield wall" reads at a glance |
| 7 | **Cultist Seer** (`cultist_mage`) | Shrine | 1 tile, ~0.85 tall incl. staff | Black hooded robe, ash-white face paint, tall staff topped with a horned or brazier finial | Staff taller than the head, no shield; the obvious priority target |
| 8 | **Trapped Nephilim** (`nephilim`) | Nephilim | 3×2 footprint, ~1.8–2.2 tall | A giant buried to the chest under cave-in rubble and broken bridge timbers. Head and shoulders out, **one huge free arm** and one arm crushed under stone. Bronze-age details: braided hair, torque, scarred skin | Rubble mound fills the rectangle; the free arm is the threat and must be readable for the sweep telegraph |

Not on the board: **Tubal-Cain** only offers the weapon in setup. Add him as an optional 9th model only if the setup screen ever gets a 3D vignette.

## Animation clips per unit

Map these to choreography events. Clips marked *opt* have a working fallback (the existing tween).

| Clip | Choreography event | Jubal | Jabal | Archer | Rat | Wolf | Zealot | Seer | Nephilim |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Idle loop | rest | ✓ | ✓ | ✓ | ✓ | ✓ (prowl) | ✓ (shield up) | ✓ | ✓ (struggling) |
| Walk/run (one stride ≈ one tile) | `move` | ✓ | ✓ | ✓ | ✓ (scurry) | ✓ (lope) | ✓ | ✓ | — immobile |
| Melee attack (per weapon family, see below) | `attack` lunge | ✓ | ✓ club | — | ✓ bite | ✓ bite | ✓ blade | ✓ staff jab | ✓ crush |
| Ranged shoot | `attack` ranged | bow, crossbow, javelin throw, throwing knife | — | ✓ bow, aimed shot | — | — | — | — | ✓ rock throw |
| Cast | `effectCast` | — | — | — | — | — | — | ✓ daze bolt, hellfire sigil | ✓ rockfall (slam the ceiling) |
| Telegraph windup → sweep | `effectCast` → `effectResolve` | — | — | — | — | — | — | — | ✓ **critical**: raised-arm hold that reads as a warning, then a fast sweep |
| Hit react | `strike` hit / `blinkToken` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ flinch |
| Block / parry / dodge | `strike` avoided | ✓ | ✓ | ✓ | dodge | dodge | block | ✓ | — |
| Shoved / hooked | `displace` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Dazed loop | `status` dazed | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Panic / flee | `status` panic (pack scatters) | — | — | — | ✓ | ✓ | — | — | — |
| Reload | `reload` | crossbow | — | — | — | — | — | — | — |
| Weapon swap | `swapWeapon` | ✓ *opt* | — | — | — | — | — | — | — |
| Held! / slipped free | `disengage` | ✓ *opt* | ✓ *opt* | ✓ *opt* | — | — | — | — | — |
| KO / death (then the 22% fade) | `ko` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ slump into rubble |

Pairing a short clip with the existing position tween keeps the board's timing intact. Clips layer on top of `moveToken` and `lungeToken`; they never replace them.

## Weapon props (hand-slot attachments)

Jubal's loadout is player-chosen, two slots, with paid swapping, so weapons are separate meshes parented to hand bones, not baked into the body.

| Prop | `gear.ts` id | Held by | Hands | Attack clip family |
| --- | --- | --- | --- | --- |
| Bronze Daggers (pair) + throwing knife | `daggers` | Jubal | both | quick stab |
| Bronze sword + round shield | `shield` | Jubal | R sword, L shield | slash + shield bash |
| Bronze Spear | `polearm` | Jubal | two-handed | thrust; hook pull |
| Two-Handed Axe | `two_handed` | Jubal | two-handed | wide arc |
| Hunting Bow + quiver | `hunting_bow` | Jubal, Archer | L bow | draw and release |
| Bronze Crossbow + bolt | `crossbow` | Jubal | two-handed | shoot; reload |
| Dual Blades | `dual_wield` | Jubal | both | double cut |
| Javelin + shield | `javelin_shield` | Jubal | R javelin, L shield | thrust; throw |
| Colossal Hammer | `colossal` | Jubal | two-handed | overhead line; spin sweep |
| Shepherd's Club | `shepherds_club` | Jabal | two-handed | wide arc |
| Ritual Blade + tall shield | `cultist_blade` | Zealot | R blade, L shield | slash |
| Ritual Staff | `cultist_staff` | Seer | two-handed | jab; cast |

Armour (`clothing` / `light` / `medium` / `heavy`, chosen per fight for Jubal) works best as 2–4 swappable torso/shoulder overlays on the same rig: robe only → leather → bronze scale → bronze plate and helm. That keeps "heavy = slow, pinned" visible on the board.

## Projectiles and effect props

Small, but they sell the hits. All of them are currently text floats or tile flashes.

| Prop | Used by |
| --- | --- |
| Arrow | Hunting Bow, Aimed Shot |
| Crossbow bolt | Steady / Breaching Bolt |
| Javelin (thrown copy) | Javelin throw, Piercing Javelin |
| Throwing knife | Daggers skill |
| Daze bolt orb (unlit, warm) | Seer |
| Thrown boulder | Nephilim Rock Throw |
| Falling rocks plus a dust puff | Nephilim Rockfall |
| Hellfire sigil ground decal (stays inside the telegraph-red meaning) | Seer |

Terrain cover (`o` tiles) per encounter is a separate list: grain sacks (Granary), rocks and stumps (Road), broken pillars (Shrine), boulders (Cave).

## Sourcing options

| Route | Fit | Tradeoff |
| --- | --- | --- |
| **KayKit Adventurers + Skeletons** (CC0, glTF): 5 characters, 76 animations, ~6.5k tris, shared 41-joint rig with hand-slot bones | Fastest path to animated humanoids with weapon attachment already solved | Medieval-cartoon styling (plate knights, wizard hats) works against the Bronze-age mythic register. Plan on retexturing and kitbashing |
| **Quaternius Universal Base Characters + Modular Outfits (Fantasy)** (CC0): 45 animations, ~13.7k tris | Robes and mix-and-match outfits fit Cainites and cultists better | Rigify skeleton, so KayKit animations don't transfer without retargeting |
| **Quaternius animal and monster packs** (CC0) | Candidate source for wolf and rat | Confirm the pack actually contains a wolf and a rat with bite/run/death clips before committing |
| **Custom Nephilim** | No stock asset matches "buried giant, one free arm" | Needs a bespoke sculpt or kitbash: a scaled humanoid torso and arm rig plus a rubble mound and timbers |
| **Commissioned set** | Best match to canon and brand | Cost and lead time; worth it only once Aaron signs off on the looks |

Recommendation: start with one CC0 rig family for every humanoid (KayKit if speed wins, Quaternius if the robed look wins) so all humanoids share one clip set. Source the animals separately and build the Nephilim custom.

## Integration notes for `ThreeBoard`

- Load with `GLTFLoader`, instance per unit with `SkeletonUtils.clone`, and run one `AnimationMixer` per token ticked from the existing render loop.
- Clone materials per instance and add them to `Token3D.materials` so `applyOpacity`, the KO fade and the hit flash keep working.
- Keep `ring`, `hoverRing`, `plate` and the base disc exactly as they are. Only the pawn, head and boss box meshes get replaced, and the replacements go into `pickables`.
- Face the token toward its move direction or attack target (a yaw on `root`), which pawns never needed.
- Budget: ≤ ~7k tris per humanoid, ≤ ~25k for the Nephilim. That keeps the busiest fight (5 units) trivial for laptops.
- The 2D Phaser board is unaffected. The boards share semantics, not meshes.

---
name: Sons of Cain — Combat Demo
description: AP-timeline tactics sandbox; bronze and forge light on soot, every number weighed and labeled.
colors:
  soot-black: "#14110e"
  smithy-brown: "#1d1813"
  hearth-brown: "#252019"
  ash-line: "#3b3127"
  parchment: "#ece2cf"
  faded-ink: "#a09482"
  cast-bronze: "#a07a45"
  forge-gold: "#f2c14e"
  forge-ember: "#6b4a1f"
  gilded-shadow: "#3a2f1b"
  kin-teal: "#57c4bf"
  kin-teal-deep: "#1f3d3c"
  foe-crimson: "#d0573f"
  foe-crimson-deep: "#3f1e18"
  telegraph-red: "#e0533f"
  warning-amber: "#ffae42"
  aim-amber: "#ffb347"
  path-blue: "#4fa3ff"
  tether-coral: "#ff8a65"
  ready-green: "#7bc47f"
  wall-soot: "#231d18"
  cover-timber: "#6d5536"
  floor-granary: "#6b5a3e"
  floor-nest: "#5f5139"
  floor-road: "#7a6a48"
  floor-trail: "#76664a"
  floor-shrine: "#57493f"
  floor-valley: "#7d6c4c"
  floor-cave: "#4b4a51"
typography:
  display:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: "46px"
    fontWeight: 400
    lineHeight: 1.1
  headline:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: 1.25
  title:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.3
  body:
    fontFamily: "Inter, 'Segoe UI', system-ui, -apple-system, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  body-small:
    fontFamily: "Inter, 'Segoe UI', system-ui, -apple-system, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Inter, 'Segoe UI', system-ui, -apple-system, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.12em"
  eyebrow:
    fontFamily: "Inter, 'Segoe UI', system-ui, -apple-system, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    letterSpacing: "0.3em"
  log:
    fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.45
rounded:
  hairline: "3px"
  sm: "4px"
  md: "6px"
  lg: "8px"
  card: "10px"
  dialog: "12px"
  pill: "10px"
spacing:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "12px"
  xxl: "16px"
components:
  button:
    backgroundColor: "{colors.hearth-brown}"
    textColor: "{colors.parchment}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "6px 10px"
  button-hover:
    backgroundColor: "{colors.hearth-brown}"
    textColor: "{colors.parchment}"
  button-selected:
    backgroundColor: "{colors.gilded-shadow}"
    textColor: "{colors.parchment}"
    rounded: "{rounded.md}"
  button-primary:
    backgroundColor: "{colors.forge-ember}"
    textColor: "{colors.parchment}"
    rounded: "{rounded.md}"
    padding: "10px 28px"
  panel:
    backgroundColor: "{colors.smithy-brown}"
    textColor: "{colors.parchment}"
    padding: "10px 12px"
  turn-box:
    backgroundColor: "{colors.hearth-brown}"
    textColor: "{colors.parchment}"
    rounded: "{rounded.lg}"
    padding: "10px"
  unit-card:
    backgroundColor: "#211b15"
    textColor: "{colors.parchment}"
    typography: "{typography.body-small}"
    rounded: "{rounded.md}"
    padding: "8px"
  encounter-card:
    backgroundColor: "{colors.smithy-brown}"
    textColor: "{colors.parchment}"
    rounded: "{rounded.card}"
    padding: "16px"
  timeline-unit-pill:
    textColor: "{colors.parchment}"
    rounded: "{rounded.pill}"
    width: "26px"
    height: "20px"
  provenance-badge:
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "1px 6px"
  input-select:
    backgroundColor: "{colors.hearth-brown}"
    textColor: "{colors.parchment}"
    rounded: "{rounded.sm}"
  dialog:
    backgroundColor: "{colors.smithy-brown}"
    textColor: "{colors.parchment}"
    rounded: "{rounded.dialog}"
    padding: "22px 26px"
---

# Design System: Sons of Cain — Combat Demo

## Overview

**Creative North Star: "The Forge Ledger"**

Tubal-Cain's workshop crossed with a designer's record book. The ground is soot. Light comes only from metal and fire: cast bronze for structure, forge gold for whatever is live right now. On that ground every number is weighed, labeled and recorded. The system is ancient and mythic, never modern-fantasy or sci-fi. It is lamplit and warm-dark, never cold or neon. It carries weight: actions have consequences, so nothing bounces, sparkles or celebrates for its own sake.

The HUD is quiet and exact. Surfaces sit flat in warm tonal steps, separated by single hairlines, so the game layer — teal kin, crimson foes, red telegraphs, amber risk, blue paths — is the only saturated color on screen and always reads first. Typography is split by meaning: names of things (encounters, people, weapons, the turn header) are set in an old-style serif; numbers, rules and controls are set in a plain sans. The result is dense but calm: a three-column battle layout where the board leads and the ledger panels flank it.

The board is the exception. It is the one window onto the game's world, and that world follows Aaron's art direction rather than the ledger's palette: a cursed cloud over a creation that still wants to be bright, never flat darkness, with sunlight, living nature and divine radiance breaking through where evil does not rule. Atmosphere always yields to a readable grid. See **Board World** under Components.

**Key Characteristics:**
- Warm soot neutrals in the HUD (hue ≈ 67–83° in OKLCH); no cool grays in the ledger.
- Two metal accents with fixed jobs: bronze structures, gold marks the live choice.
- A semantic game palette that is never borrowed for decoration.
- Serif for names, sans for numbers and controls, mono only for the combat log.
- Flat tonal layering with 1px hairlines; shadows belong to game pieces and modal scrims only.
- Dense desktop layout; board in the center, ledger panels at its sides.
- A board world under a cursed cloud rather than in the dark; tactical readability beats atmosphere.

## Colors

A soot-and-parchment ground lit by two metals, with a strictly semantic game palette on top.

### Primary
- **Forge Gold** (`forge-gold`): the one live thing. Active unit's ring and turn header, the selected tab or option border, primary call-to-action text such as "Start here →", the encounter-card hover border, focus rings. Also the timeline's active-unit halo.
- **Forge Ember** (`forge-ember`): the filled background of the primary action (Fight, Got it), always paired with a Forge Gold border.
- **Gilded Shadow** (`gilded-shadow`): background of a selected/on button or segment (current mode, 2D/3D choice, chosen loadout slot).

### Secondary
- **Cast Bronze** (`cast-bronze`): structure and wayfinding. Section labels, eyebrows, encounter numbers, drawer headings, dialog borders, button hover borders. Never used for state.

### Tertiary (game semantics)
- **Kin Teal** (`kin-teal`) with **Kin Teal Deep** (`kin-teal-deep`): the party. Token rings, timeline pills, unit-card left edge; the deep tone fills party token bodies.
- **Foe Crimson** (`foe-crimson`) with **Foe Crimson Deep** (`foe-crimson-deep`): enemies, same placement as party.
- **Telegraph Red** (`telegraph-red`): incoming harm. Telegraphed tiles (pulsing), effect diamonds on the timeline, "no escape" warnings, CAUGHT, defeat headline.
- **Warning Amber** (`warning-amber`) and **Aim Amber** (`aim-amber`): risk and aiming. Escape-risk warnings, sweep zone, held-chance labels, attack pattern cells, tentative-math badges.
- **Path Blue** (`path-blue`): movement reach on the board; the "you" cell in pattern diagrams.
- **Tether Coral** (`tether-coral`): engagement lines between locked units.
- **Ready Green** (`ready-green`): healthy HP, skills ready, can-escape, sourced (Aaron's rule) badges, victory.

### Neutral
- **Soot Black** (`soot-black`): page and board background.
- **Smithy Brown** (`smithy-brown`): side panels, dialogs and drawers.
- **Hearth Brown** (`hearth-brown`): raised controls: buttons, selects, turn box, kbd fills.
- **Ash Line** (`ash-line`): every hairline border and divider.
- **Parchment** (`parchment`): primary text.
- **Faded Ink** (`faded-ink`): secondary text, hints, captions, disabled-adjacent copy.
- **Wall Soot**, **Cover Timber** and the encounter floors (`floor-granary`, `floor-nest`, `floor-road`, `floor-trail`, `floor-shrine`, `floor-valley`, `floor-cave`): board terrain only, shared by the 2D and 3D boards via `src/board/palette.ts`. Each floor carries its location's tone (see Board World); `floor-cave` is cool cave stone, the one cool tone in the system.

### Named Rules
**The Forge Gold Rule.** Gold marks the single live thing — the active unit, the current selection, the next action to take. If two unrelated things on a screen are gold, one of them is wrong.

**The Semantic Hue Rule.** Teal is kin, crimson is foe, red is incoming harm, amber is risk or aim, blue is movement, green is ready or safe. These hues never decorate, brand or separate sections; a player must be able to trust color alone.

**The Warm Dark Rule.** Every HUD neutral is warm. No cool grays, no pure black panels, no neon. Text shadows on the board may use pure black only as a legibility stroke. Board terrain follows its location instead; the cave's cool stone (`floor-cave`) is the sanctioned exception.

**The Overlay Leads Rule.** World color stays below the semantic overlays. Terrain, light, costume, vegetation and holy radiance never reach a semantic hue at board scale: vegetation is darker and more olive than Ready Green, water and sky are greyed rather than Path Blue, no costume or prop is teal or crimson (the optional team outline is an overlay, not costume), and divine light is warm-white light, never a Forge Gold fill.

## Typography

**Display Font:** Georgia (with Times New Roman, serif)
**Body Font:** Inter (with Segoe UI, system-ui, -apple-system, sans-serif)
**Label/Mono Font:** ui-monospace (with SF Mono, Menlo, monospace) for the combat log only

**Character:** An old-style book serif for proper nouns gives the mythic register without costume. A neutral sans carries every number and control so tuning stays legible at small sizes.

### Hierarchy
- **Display** (400, 46px, ~1.1): the menu title "Combat Demo" only.
- **Headline** (400, 22px, 1.25): encounter names on cards and the setup heading; result headline scales to 34px.
- **Title** (400, 17–18px, 1.3): encounter name in the topbar, "Jubal's turn" (in Forge Gold), weapon names on choice cards, unit names (15px).
- **Body** (400, 14px, 1.45): default UI text and controls; 13px for button rows and setup body, 15px for ledes capped at 720px.
- **Body small** (400, 11–12px, 1.45): stats, hints, captions, provenance lines.
- **Label** (600, 11px, 0.12em, uppercase): section titles (INCOMING, COMBAT LOG, AP TIMELINE) in Cast Bronze.
- **Eyebrow** (600, 12px, 0.3em, uppercase): the "SONS OF CAIN" kicker above the display title.
- **Log** (400, 12px, 1.45, monospace): the combat log, color-coded by line tone.

### Named Rules
**The Names Are Serif Rule.** Serif is reserved for names of things: encounters, people, weapons, the turn header, dialog titles. Numbers, rules, stats and controls are always sans. Serif headings stay at weight 400.

**The Whispered Label Rule.** Section labels are small, uppercase, tracked and bronze. They locate; they never compete with content.

## Layout

A dense, desktop-first application layout. The battle screen stacks a 6px/12px topbar, a full-width AP timeline strip (146px track), an optional first-lesson strip, then a three-column grid: left actions panel (300px), board (flexible), right incoming-and-log panel (330px). Below 1100px the side columns narrow to 250px and 270px. Panels scroll independently; the board never scrolls.

Menu and setup are centered single columns capped at 1140px with 7vh top padding; encounter cards auto-fit at a 240px minimum, weapon choices sit in a four-column grid (two columns below 1100px). The setup's Fight bar is sticky at the bottom.

Spacing steps through 4, 6, 8, 10, 12 and 16px. Controls inside rows use 6px gaps; panels pad 10px 12px; cards pad 8–16px depending on size. On the board, a reserved annotation lane sits above the play area (up to 140px) so labels never cover tokens; leader lines tie each label to its tile.

## Elevation & Depth

Flat tonal layering. Depth is conveyed by stepping from Soot Black (page) to Smithy Brown (panels) to Hearth Brown (controls), with a single Ash Line hairline at every boundary. The HUD casts no shadows. The only exceptions are physical: game pieces on the board (token drop shadows in 2D, real-time light and shadow in 3D) and the modal scrim (`rgba(8,6,4,0.72)`, drawers `rgba(0,0,0,0.5)`) that dims the ledger behind a dialog.

### Named Rules
**The Flat Ledger Rule.** Ledger surfaces never lift. If something needs emphasis, it changes border to Forge Gold or fill to Gilded Shadow; it does not gain a shadow or glow.

## Shapes

Corners scale with the size of the object: 3–4px for keys, selects and small tags; 6px for buttons, unit cards and segmented controls; 8px for the turn box, log and timeline track; 10px for encounter cards; 12px for dialogs. Provenance badges and timeline unit markers are full pills.

Geometry carries meaning on the game layer. Units are always circles (board tokens, timeline pills, glyph medallions in unit cards). Telegraphed effects are diamonds (rotated squares) on the timeline and filled squares on the board. The next-turn ghost is a dashed outline. The boss is the only rectangle-bodied unit, sized to its footprint.

### Named Rules
**The Circle Is a Unit Rule.** Circles mean a combatant, diamonds mean a pending effect, dashed outlines mean a projection. Do not use these shapes decoratively.

## Components

### Buttons
Quiet and exact: a tonal fill, one hairline, and gold only when it is the choice.
- **Shape:** gently rounded (6px).
- **Default:** Hearth Brown fill, Ash Line border, Parchment text, 6px 10px padding; keyboard hints trail in a small faded `kbd` chip.
- **Hover / Focus:** border shifts to Cast Bronze on hover; focus-visible draws a 2px Forge Gold outline offset 2px. No motion, no fill change.
- **Selected (on):** Gilded Shadow fill with a Forge Gold border — current mode, chosen slot, active 2D/3D segment.
- **Primary:** Forge Ember fill, Forge Gold border, 600 weight; larger (10px 28px, 16px) for the setup Fight action.
- **Disabled:** 45% opacity, not-allowed cursor; the reason is given in adjacent hint text, not by color alone.
- **Segmented (board view):** two buttons joined, outer corners only rounded, compact 600 12px labels.

### Cards / Containers
- **Corner Style:** 6px (unit card), 8px (turn box), 10px (encounter card).
- **Background:** Smithy Brown panels; Hearth Brown turn box; the encounter card uses a soft vertical gradient from `#241d16` to `#1a1511`.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** Ash Line hairline. Unit cards add a 3px left edge in Kin Teal or Foe Crimson; the first (tutorial) encounter card carries a dimmed bronze border to mark "start here".
- **Internal Padding:** 8px (unit card), 10px (turn box), 16px (encounter card).

### Inputs / Fields
- **Style:** Hearth Brown fill, Ash Line border, 4px radius; range sliders fill the row; search fields use a Cast Bronze border.
- **Focus:** 2px Forge Gold outline offset 2px.
- **Changed state:** a setting row whose value differs from default turns its label Forge Gold.

### Navigation
The topbar is a single dense row on `#17130f` with a hairline below: menu button, serif encounter title with a faded subtitle, then right-aligned controls (2D/3D segment, speed select, bot toggle, Restart, Rules, Help). Drawer navigation uses small rule-group buttons that jump to sections.

### AP Timeline (signature)
The defining component. A horizontal track (gradient `#2a2219` → `#1f1913`, hairline border, 8px radius) with faint tick lines every 25 AP and labeled majors every 50 AP. Units ride it as 26×20px pills in serif bold initials, filled with their side's deep tone and bordered in side color; the active unit gains a Forge Gold halo, the hovered one a white halo. Effects ride as Telegraph Red diamonds with a small tag. The hovered action's projected next turn appears as a dashed ghost that turns red or amber when it lands after danger. The boss sweep window is a diagonal amber hatch; break-free time is a red bar. Items slide (0.35s ease) as the clock advances.

### Provenance Badges (signature)
Small pill badges (10px text, 1px border, transparent fill) attached to every tunable rule and stat: Ready Green for Aaron's rule, Warning Amber for tentative math, a pale blue (`#9fb6ff`) for demo default. They are the visible expression of the product's honesty about sources and must accompany any new tunable value.

### Board Tokens
Circular tokens in side colors with a serif glyph, an HP bar beneath (green above 50%, amber above 25%, red below) and an uppercase status badge above (DAZED · FEARED · FLANKED in amber-gold). KO'd units fade to 22% opacity; units summoned mid-battle (the Brood Mother's rats) grow into place. Floating combat text rises and fades over 1.1s in bold sans with a black stroke: damage in red, crits in gold, misses in gray, avoids in pale blue. At a telegraph's impact, party members who stepped out show ESCAPED in Ready Green and caught party members show the reason beneath the damage in soft red (`#ffb3a6`): TOO LATE, NO WAY OUT, HELD or STAYED IN. The 2D and 3D boards share these semantics exactly; 3D stands each unit's figure on a side-colored base disc and ring with a floating plate carrying the same glyph, status and HP. Figures, terrain and light are specified under Board World.

### Board World (signature)
The board is the world seen through the ledger. Sources follow PRODUCT.md's priority: **canon** is Aaron's transcriptions or the published wiki, **draft** is the wiki's Art Direction Bible, **demo** is a proposal made in this repository for playtesting. Transcription content is paraphrased here rather than quoted, because those notes are private working material and this repository is public.

**Direction.** The medium is a demo decision; mood and light are canon.
- **Medium: painted grim fantasy (demo direction).** The first concept was 32-bit pixel art in the vein of Chrono Trigger; Aaron favors the painted, grim fantasy of Diablo II if AI art generation proves workable, and the demo now follows that branch, using generated models to test it. The published wiki still lists the medium as open, so the final call stays Aaron's. Take Diablo II's painted, aged surfaces and pools of local light, not its uniform gloom: the mood below still governs.
- **Mood: a cloud over the scenery.** Evil rules the world, but creation still wants to be bright. Never Lovecraftian, swampy, wet or uniformly black; colorful places keep a sense of age, menace, corruption or spiritual weight.
- **Light lives where evil does not rule.** Sunlight through trees, strong shafts of light and vivid natural color. Angelic and divine elements are radiant, clear and colorful. The draft adds: darkness is contrast, never a blanket.

**Current treatment (demo).** Jubal and Jabal are generated models on every board. Every other unit outside the Shrine is a procedural low-poly figure posed in code (`src/board3d/`), flat-shaded with matte, untextured materials in earthy, unsaturated tones: playtest stand-ins until painted, textured models replace them. Away from the Shrine, every encounter shares one warm sun, a warm hemisphere fill and a faint cool rim, with fog fading to Soot Black.

**Generated models (Shrine).** The Ruined Shrine is the first board fully in the painted direction. Every figure on it (Jubal, Jabal, both Zealots, the Seer), their weapons, the lyre, the broken pillars, fallen masonry and braziers are textured models generated with Meshy. The floor is one painting stretched across the board. Design images and task records are in `meshy_output/`, runtime files in `public/assets/models/` and `public/assets/textures/`, and everything is registered in `src/board3d/models.ts`. Every design image is painted from `notes/art/style-reference-shrine-mood.png` under even light, so no lighting is baked into textures; scene light does the mood instead. A model matches a unit's armour and every weapon it carries: Jubal has a painted body for each armour class and all nine of his weapons, shared across the four bodies. Anything not yet loaded falls back to its procedural figure or blocks. Animated characters wear fitted or split clothing: when a full-length robe or a hanging fleece hides the body, the auto-rigger misplaces the spine and knees and every animation bends the back the wrong way, so robes are split up the front and sides over close leggings.

**Locations.**

| Location | Direction | Board today |
|---|---|---|
| Cainite village, Granary | Canon: dusty, dry and depleted; a dried-up riverbed, little grass, scattered shrubs; not a true desert. Draft: dry earth, sun-bleached wood, faded cloth, sparse greens; the granary is practical and cramped, a village problem rather than a dungeon. | `floor-granary` |
| Rat Nest | None given. | `floor-nest` |
| Road, Trail | Draft: a sparse, dry path turning toward organized danger. | `floor-road`, `floor-trail` |
| Valley | Draft: practical and local, less directly cursed than the Cainite village. | `floor-valley` |
| Ruined Shrine | Canon: ruins where men in black robes make an offering of the stolen shipment. Draft: torchlight, red-brown stone, ritual marks, giant-worship imagery. | `floor-shrine` |
| Mines, Nephilim cave-in | Canon: a cave-in; a debris pile and cover objects around the boss. Draft: cool stone and mineral color, darkness broken by lamps and shafts of light. | `floor-cave` |
| Healthy nature, divine elements | Canon: sunlight, vivid natural color, radiance. Draft: stronger greens, gold-white light. | Not on any board yet |
| Corrupted nature | Draft: sickened greens, bruised purples, ash, rust, dead bark. | Not on any board yet |

**Light.** Per-location light fits the direction (torches in the shrine, lamps and shafts in the mines, open sun on the road). The Shrine pilot lights its encounter: the sun and sky fill dim, and each free-standing pillar carries a lit brazier whose flickering point light makes a warm pool. Whether every encounter gets its own light, or the rest keep one neutral light for readability, is still open for Aaron. Either way, overlays stay unlit (`MeshBasicMaterial` without tone mapping or fog), so scene light never shifts a semantic hue.

**Units.**

| Unit | Canon | Demo figure |
|---|---|---|
| Jubal | A villager, not an armored adventurer: a simple one-piece garment tied with rope; armor is picked up as danger grows. Draft: readable as the protagonist; music is narrative, not a combat gimmick. | Rope-tied cream linen and a cloth headband; the lyre stays slung on his back in combat (demo decision). A generated model in each armour class, worn over the linen: a hardened-leather cuirass (light), bronze scales (medium), and a bronze cuirass, greaves and close crested helmet (heavy). His weapons are generated too: bronze daggers; a leaf-bladed bronze sword with a plain round hide shield; two short swords held point-forward for Dual Blades; a bronze spear, shortened for the javelin, both thrust level at the target, the javelin thrown overhand with its point on the target; a crescent-headed axe; a stone-headed colossal hammer; a recurve bow, loosed side-on; and a crossbow aimed two-handed. |
| Jabal | A shepherd and standard fighter with a two-handed club or a shepherd's staff. Draft: practical, protective, direct. | Undyed wool, headwrap, beard, fleece mantle, knobbed club. A generated model in a fitted knee-length tunic and leather jerkin with a short fleece mantle on his shoulders, resting the club upright between turns. |
| Hired Archer | Mercenary kits are fixed and authored; a mercenary may look armored without an armor item. Draft: readable by role at a glance through silhouette and animation. | Olive hood, quiver, recurve bow. |
| Rats | Giant rats; a brood mother summons smaller rats. | Egg-bodied granary and brood rats; the large rat is bigger and darker with a torn ear; the brood mother is a much larger, scarred rat. |
| Wolves | A pack; no look given. | Grey, scarred and lean variants. |
| Cultists | Men in black robes. Draft: ritual marks. | Charcoal rather than true black so they separate from the shrine floor. Both are generated models in the Shrine. The Zealot wears a hooded robe with soot under the eyes, a bronze khopesh in the right hand and a tall hide shield painted with a giant's face on the left forearm. The Seer wears a hooded robe split up the front and sides over close dark leggings, a short rust-brown stole tied under his rope belt, and an ash-white band across the eyes; he plants a horned bronze staff upright, lunges to jab its horned head level at the target, his bolts fly from a cast and the fire sigil is struck into the ground. |
| Trapped Nephilim | A giant mostly pinned under collapsed rock, essentially a massive head with one free arm, conveying overwhelming scale and danger at once. Nephilim are cannibalistic, murderous giants. Draft: too large for human infrastructure; terrifying even while vulnerable. | Rubble mound over a 3×2 footprint with chest, shoulders, a free arm and a clawing pinned hand. **Departs from canon** until Aaron says whether "massive head with one free arm" is literal. He holds the free arm raised while his sweep is pending, so the telegraph is in the figure as well as on the floor. |
| Bandits | Basic fighters and archers. | Earth-brown robes; the fighter wears a headwrap and beard and carries a sword and shield, the archer a hood, quiver and bow. |

**Materials and surfaces.** Canon names no metal, era or material; the draft asks for an ancient, dry, worn, biblical world with painterly atmosphere, age and texture. In the demo all metal is bronze, otherwise wood, hide, wool, leather and stone; armor classes read as leather (light), bronze scale (medium), and a bronze cuirass with crested helmet (heavy). Those are demo inventions: canon gives only the classes, and bronze versus iron is open for Aaron. Textured assets are hand-painted in the draft's terms: matte, dusty, sun-bleached and worn, with metal that looks used rather than polished.

**Props and terrain.** Canon puts a debris pile and cover objects that block thrown rocks in the boss arena; the draft requires cover to be visually obvious in boss fights. Outside the Shrine, every cover tile is the same rounded Cover Timber box, which reads as a crate, and walls are waist-high Wall Soot blocks, low enough that units behind them stay visible but able to read as holes where they stand inside a board. Cover should read as something native to its location: rubble and boulders around the Nephilim follow canon; grain sacks, stumps and pillars elsewhere are demo proposals. The Shrine already does this: edge walls are a low line of fallen masonry, inner walls are broken pillars below chest height with painted giant faces, and cover is a knee-high heap of fallen blocks. Pieces turn by tile so repeats don't line up. Its floor is a top-down painting of worn sandstone flagstones with soot rings and handprints, stretched over the whole board; each flagstone keeps its grout gap, so the grid reads through the painting. Projectiles fly for ranged strikes; area effects are cast with nothing flying.

**Readability first.** Atmosphere never makes a tactical decision illegible (draft). Grid tiles stay readable under any light or texture; telegraphed tiles stay the strongest mark on the board, as canon asks for clear red tile markers with the AP remaining; team color lives only on the base disc, ring, plate and the optional team-colour Outlines toggle (off by default). Silhouettes should tell units apart at the default camera (draft); until they do, the plate glyph, base ring and outlines carry identification, and a plate can cover the figure it labels. Dark-robed figures need separation from floors and walls: generated figures carry a soft warm-neutral edge light (a fresnel rim), so charcoal robes keep their outline on dark stone under the Shrine's dim light. On a phone the figures are only a few dozen pixels tall, and the plates do most of the identifying.

### Lesson Card
A one-time teaching note docked at the top of the right panel, above Incoming: Hearth Brown fill, Cast Bronze hairline, 8px radius, a 13px sans heading (not serif: it is not a name), soft-parchment body, a faded "1 of 3" step count, and a quiet text-style Skip beside a default Next button. Its subject is outlined by a parchment ring (2px, with a 1px soot edge for contrast on the board) that never takes pointer input and eases in over 260ms (no motion under reduced-motion). Lessons never cover the board and never block play.

## Do's and Don'ts

### Do:
- **Do** reserve Forge Gold (#f2c14e) for the single live element: active turn, current selection, next action.
- **Do** separate surfaces with one Ash Line (#3b3127) hairline and a tonal step, never a shadow.
- **Do** set names of encounters, people and weapons in Georgia at weight 400, and every number in the sans.
- **Do** use the game palette strictly by meaning: teal kin, crimson foe, red incoming harm, amber risk/aim, blue movement, green ready.
- **Do** attach a provenance badge to any new tunable rule, stat or number.
- **Do** keep board annotations in the reserved lane above the board with a leader line to the tile, in both 2D and 3D.
- **Do** keep motion short and functional (timeline slides 0.35s, ghost moves 0.12s); let weight come from stillness.
- **Do** follow Board World's location direction for terrain, light and props, and keep every overlay unlit.
- **Do** mark each part of a figure's look as canon or demo proposal when adding or changing one, citing the published wiki for canon.

### Don't:
- **Don't** introduce cool grays, neon, or saturated color into the HUD; on the board, world color answers to The Overlay Leads Rule.
- **Don't** add drop shadows, glows or lifted cards to HUD panels.
- **Don't** use teal, crimson, red, amber or blue as decoration, section color or branding.
- **Don't** bold the serif or set numbers and controls in it.
- **Don't** add playful bounce, confetti or celebratory motion; victory and defeat are stated, not performed.
- **Don't** reuse circles, diamonds or dashed outlines for non-game UI; they mean unit, effect and projection.
- **Don't** reach for modern-fantasy or sci-fi ornament; the register is ancient and scriptural.
- **Don't** render the world as flat darkness, swamp or Lovecraftian gloom; corruption is a cloud over a creation that still wants to be bright.
- **Don't** present a demo look as canon, or let a figure contradict the published wiki without saying so.

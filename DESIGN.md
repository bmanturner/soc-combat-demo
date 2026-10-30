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
  floor-road: "#7a6a48"
  floor-shrine: "#57493f"
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

**Key Characteristics:**
- Warm soot neutrals (hue ≈ 67–83° in OKLCH); no cool grays anywhere.
- Two metal accents with fixed jobs: bronze structures, gold marks the live choice.
- A semantic game palette that is never borrowed for decoration.
- Serif for names, sans for numbers and controls, mono only for the combat log.
- Flat tonal layering with 1px hairlines; shadows belong to game pieces and modal scrims only.
- Dense desktop layout; board in the center, ledger panels at its sides.

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
- **Wall Soot**, **Cover Timber** and the four encounter floors (`floor-granary`, `floor-road`, `floor-shrine`, `floor-cave`): board terrain only, shared by the 2D and 3D boards via `src/board/palette.ts`.

### Named Rules
**The Forge Gold Rule.** Gold marks the single live thing — the active unit, the current selection, the next action to take. If two unrelated things on a screen are gold, one of them is wrong.

**The Semantic Hue Rule.** Teal is kin, crimson is foe, red is incoming harm, amber is risk or aim, blue is movement, green is ready or safe. These hues never decorate, brand or separate sections; a player must be able to trust color alone.

**The Warm Dark Rule.** Every neutral is warm. No cool grays, no pure black panels, no neon. Text shadows on the board may use pure black only as a legibility stroke.

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
Circular tokens in side colors with a serif glyph, an HP bar beneath (green above 50%, amber above 25%, red below) and an uppercase status badge above (DAZED · FEARED · FLANKED in amber-gold). KO'd units fade to 22% opacity. Floating combat text rises and fades over 1.1s in bold sans with a black stroke: damage in red, crits in gold, misses in gray, avoids in pale blue. The 2D and 3D boards share these semantics exactly; 3D stands each unit on a side-colored base disc and ring with a floating plate carrying the same glyph, status and HP. Every unit is a posed low-poly figure in earthy, unsaturated materials (side color stays on the base, ring and plate; cultists wear charcoal, not true black, so they separate from the shrine floor). Humanoids wear their armour class (robe, leather, bronze scale, bronze plate with crested helmet). The Trapped Nephilim holds his free arm raised while his sweep is pending: the telegraph is in the figure as well as on the floor. Projectiles fly for ranged strikes; area effects are cast with nothing flying.

## Do's and Don'ts

### Do:
- **Do** reserve Forge Gold (#f2c14e) for the single live element: active turn, current selection, next action.
- **Do** separate surfaces with one Ash Line (#3b3127) hairline and a tonal step, never a shadow.
- **Do** set names of encounters, people and weapons in Georgia at weight 400, and every number in the sans.
- **Do** use the game palette strictly by meaning: teal kin, crimson foe, red incoming harm, amber risk/aim, blue movement, green ready.
- **Do** attach a provenance badge to any new tunable rule, stat or number.
- **Do** keep board annotations in the reserved lane above the board with a leader line to the tile, in both 2D and 3D.
- **Do** keep motion short and functional (timeline slides 0.35s, ghost moves 0.12s); let weight come from stillness.

### Don't:
- **Don't** introduce cool grays, neon, or saturated color outside the semantic game palette.
- **Don't** add drop shadows, glows or lifted cards to HUD panels.
- **Don't** use teal, crimson, red, amber or blue as decoration, section color or branding.
- **Don't** bold the serif or set numbers and controls in it.
- **Don't** add playful bounce, confetti or celebratory motion; victory and defeat are stated, not performed.
- **Don't** reuse circles, diamonds or dashed outlines for non-game UI; they mean unit, effect and projection.
- **Don't** reach for modern-fantasy or sci-fi ornament; the register is Bronze Age and scriptural.

---
name: Obsidian Arcade
colors:
  surface: '#051424'
  surface-dim: '#051424'
  surface-bright: '#2c3a4c'
  surface-container-lowest: '#010f1f'
  surface-container-low: '#0d1c2d'
  surface-container: '#122131'
  surface-container-high: '#1c2b3c'
  surface-container-highest: '#273647'
  on-surface: '#d4e4fa'
  on-surface-variant: '#c2c6d6'
  inverse-surface: '#d4e4fa'
  inverse-on-surface: '#233143'
  outline: '#8c909f'
  outline-variant: '#424754'
  surface-tint: '#adc6ff'
  primary: '#adc6ff'
  on-primary: '#002e6a'
  primary-container: '#4d8eff'
  on-primary-container: '#00285d'
  inverse-primary: '#005ac2'
  secondary: '#c0c1ff'
  on-secondary: '#1000a9'
  secondary-container: '#3131c0'
  on-secondary-container: '#b0b2ff'
  tertiary: '#4edea3'
  on-tertiary: '#003824'
  tertiary-container: '#00a572'
  on-tertiary-container: '#00311f'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#e1e0ff'
  secondary-fixed-dim: '#c0c1ff'
  on-secondary-fixed: '#07006c'
  on-secondary-fixed-variant: '#2f2ebe'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#051424'
  on-background: '#d4e4fa'
  surface-variant: '#273647'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 56px
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  title-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.05em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-mobile: 0.5rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style
This design system defines a nocturnal, high-focus gaming sanctuary built around daily deduction puzzles, cognitive challenges, and wordcraft mechanics. The aesthetic merges tactile arcade clarity with sleek, dark-mode minimalism. Interfaces evoke the calm intensity of late-night puzzle solving: focused, distraction-free, yet rewarding and electrifying upon victory.

Key visual principles:
- **Luminous Energy on Obsidian:** Deep midnight voids provide infinite depth, letting vibrant electric blue, indigo, and game-state accents pop with radiant clarity.
- **Micro-Reward Feedback:** Every solved letter, flipped tile, and active streak feels tactile, punchy, and alive through high-contrast status feedback.
- **Ergonomic Softness:** Fully rounded pill contours counterbalance the rigorous mental geometry of puzzle matrices, making intense brain games feel approachable and fluid.

## Colors
The color architecture relies on a multi-tier midnight base to establish layered hierarchy without harsh light bleed:

- **Base Surfaces:** Canvas default `#0b0f17` (Deep Obsidian) paired with subtle background layer `#0f131c` (Midnight Void).
- **Container Tiers:** Structural game cards and modules use `#131b2e` (Deep Navy), scaling up to interactive or active elevated surfaces at `#1e2638`.
- **Primary & Secondary Accents:** `#3b82f6` (Electric Blue) commands primary actions, active inputs, and focal markers; `#6366f1` (Indigo) drives secondary selections, game mode identifiers, and subtle gradient shifts.
- **Game State Accents:**
  - **Success / Solved:** `#10b981` (Emerald Green) signals completed daily challenges, correct placements, and victory states.
  - **Streak / Momentum:** `#f59e0b` (Amber Orange) highlights win counters, fire meters, and daily completion cadences.
  - **Neutral / Text:** `#ffffff` for high-impact headings and primary labels; `#94a3b8` (Slate Gray) for metadata, instructions, and secondary copy; `#334155` for inactive tile outlines and grid borders.

## Typography
Plus Jakarta Sans drives the entire reading experience. Its geometric yet softly rounded aperture structure mirrors the system's rounded shapes while maintaining maximum legibility at small sizes during rapid keyboard play.

Rules for typographic hierarchy:
- **Game Headers & Scores:** Use `display-lg` and `headline-lg` with tight tracking (`-0.02em` to `-0.03em`) and heavy weights (`700` or `800`) to evoke a punchy, arcade scoreboard presence.
- **Puzzle Tiles & Grid Characters:** Letters inside puzzle matrices utilize uppercase `headline-md` or `headline-sm` with tight vertical centering.
- **Micro-Labels & Streaks:** Use uppercase `label-sm` with `0.05em` letter spacing for badge overlays, category tags, and timer readouts.
- **Readability Rules:** Never drop below `11px`. Secondary body text (`#94a3b8`) must always sit on surfaces `#131b2e` or darker to preserve AA contrast compliance.

## Layout & Spacing
The layout relies on a centered fluid system bounded by comfortable maximum widths to maintain thumb-reach ergonomics on mobile and focused scanning on desktop.

- **Desktop (1024px+):** Max-width puzzle containers span 680px for standard game boards and up to 1120px for multi-column dashboards. 12-column grid with `gutter: 1rem` and `margin: 2rem`.
- **Tablet (640px - 1023px):** Fluid 8-column layout with centered game modules and floating stat panels.
- **Mobile (<640px):** Single-column layout pinned to viewport height, utilizing `gutter-mobile: 0.5rem` and `margin-mobile: 1rem` to maximize keyboard and tile visibility above virtual inputs.
- **Puzzle Matrices:** Tile grids use fixed, compact spacing (`space-xs` to `space-sm`) between keys and cells to keep the interactive board unified and prevent tap misfires.

## Elevation & Depth
Depth is created through tonal layering and luminous colored glows rather than traditional black drop shadows, maintaining vibrancy across deep dark backgrounds.

- **Surface Tier 0 (Background):** `#0b0f17` with subtle ambient gradient shifts into `#0f131c`.
- **Surface Tier 1 (Cards & Trays):** `#131b2e` bounded by a thin, low-contrast stroke (`1px solid rgba(148, 163, 184, 0.1)`).
- **Surface Tier 2 (Interactive Floating Elements & Modals):** `#1e2638` with an ambient glow tinted to the primary color: `0 8px 24px -4px rgba(59, 130, 246, 0.25)`.
- **State Flares:**
  - Solved tiles cast an emerald bloom: `0 0 16px rgba(16, 185, 129, 0.35)`.
  - Active streaks cast an amber aura: `0 0 16px rgba(245, 158, 11, 0.3)`.
  - Focused keyboard keys emit a crisp electric halo: `0 0 0 2px #3b82f6`.

## Shapes
The shape language uses ultra-soft, fully rounded pill radii (`roundedness: 3`) across UI touchpoints to contrast against rigid grid lines:

- **Buttons, Badges, & Chips:** Always full pill (`9999px`), ensuring tactile comfort and inviting interaction.
- **Containers & Stat Cards:** High corner smoothing using `rounded-xl` (3rem / 48px) on desktop and `rounded-lg` (2rem / 32px) on mobile viewports.
- **Puzzle Tiles & Virtual Keys:** Subtly softened squircle or pill-adjacent profiles (`0.75rem` to `1rem`) so characters remain legible while adhering to the overall fluid architecture.

## Components

### Buttons
- **Primary Action:** Solid `#3b82f6` fill, pill radius, bold white text, with dynamic elevation glow `0 4px 16px rgba(59, 130, 246, 0.4)` on hover.
- **Secondary Action:** Transparent fill with dark navy container `#1e2638`, `1px solid rgba(148, 163, 184, 0.2)` stroke, and `#ffffff` label.
- **Game State Button (Victory/Share):** Vibrant `#10b981` pill button paired with an emerald shadow glow.

### Chips & Stat Badges
- **Streak Pill:** `#1e2638` background, pill radius, containing a `#f59e0b` streak fire icon, `#ffffff` counter, and uppercase `label-sm` formatting.
- **Category Filter Chips:** Pill shape with `space-xs` padding; selected state fills with gradient `#3b82f6` to `#6366f1`, unselected sits on `#131b2e`.

### Puzzle Grid Cells & Keyboard
- **Empty / Inactive Tile:** `#0f131c` fill with a `1.5px solid #1e2638` border.
- **Active / Entering Tile:** `#131b2e` fill, electric blue border (`#3b82f6`), and high-contrast white glyph with subtle scale bounce.
- **Confirmed Correct (Solved):** `#10b981` solid fill, crisp white letter, and emerald glow.
- **Confirmed Present (Misplaced):** `#f59e0b` solid fill, dark or crisp white letter.
- **Virtual Keycaps:** High-durability pill-rounded keys styled with `#1e2638` surface, active pressed state shifting to `#3b82f6`.

### Cards & Game Hub Modules
- Container background `#131b2e`, border radius `rounded-xl`, subtle border `1px solid rgba(255, 255, 255, 0.06)`. Internal padding scales from `space-md` on mobile to `space-lg` on desktop. Includes high-contrast title, preview grid, and progress completion ring.

### Input Fields
- Dark navy pill capsules (`#131b2e`) with `#94a3b8` placeholder text. Transitions to a full `#3b82f6` outline halo with `0 0 12px rgba(59, 130, 246, 0.25)` when active.

### Checkboxes & Radio Toggles
- Custom pill-style toggle switches featuring an indigo-to-blue track when active, with smooth spring-physics thumb motion.
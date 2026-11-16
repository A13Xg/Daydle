---
name: Daydle Zest
colors:
  surface: '#f9f9ff'
  surface-dim: '#cfdaf7'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f1f3ff'
  surface-container: '#e9edff'
  surface-container-high: '#e0e8ff'
  surface-container-highest: '#d8e2ff'
  on-surface: '#101b31'
  on-surface-variant: '#434655'
  inverse-surface: '#253047'
  inverse-on-surface: '#edf0ff'
  outline: '#737687'
  outline-variant: '#c3c5d8'
  surface-tint: '#0050e3'
  primary: '#004ddb'
  on-primary: '#ffffff'
  primary-container: '#2966ff'
  on-primary-container: '#fcf9ff'
  inverse-primary: '#b5c4ff'
  secondary: '#9e4223'
  on-secondary: '#ffffff'
  secondary-container: '#fb8964'
  on-secondary-container: '#722205'
  tertiary: '#00656d'
  on-tertiary: '#ffffff'
  tertiary-container: '#008089'
  on-tertiary-container: '#effdff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dce1ff'
  primary-fixed-dim: '#b5c4ff'
  on-primary-fixed: '#00164e'
  on-primary-fixed-variant: '#003bae'
  secondary-fixed: '#ffdbd0'
  secondary-fixed-dim: '#ffb59e'
  on-secondary-fixed: '#3a0b00'
  on-secondary-fixed-variant: '#7e2b0e'
  tertiary-fixed: '#83f3ff'
  tertiary-fixed-dim: '#57d8e4'
  on-tertiary-fixed: '#002022'
  on-tertiary-fixed-variant: '#004f55'
  background: '#f9f9ff'
  on-background: '#101b31'
  surface-variant: '#d8e2ff'
typography:
  display-lg:
    fontFamily: Bricolage Grotesque
    fontSize: 40px
    fontWeight: '800'
    lineHeight: 44px
    letterSpacing: -0.03em
  display-lg-mobile:
    fontFamily: Bricolage Grotesque
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 36px
    letterSpacing: -0.025em
  display-md:
    fontFamily: Bricolage Grotesque
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Bricolage Grotesque
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Bricolage Grotesque
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 24px
  title-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '700'
    lineHeight: 20px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 10px
    fontWeight: '800'
    lineHeight: 12px
    letterSpacing: 0.04em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-mobile: 0.75rem
  margin: 1.25rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system delivers an energetic, gamified, and deeply inviting aesthetic tailored for daily-game discovery, score streak tracking, and friendly competition. It fuses the tactile playfulness of wellness/gamified apps like Finch and Duolingo with modern, crisp interface mechanics.

### Emotional Signature
- **Joyful & Motivating:** Every interaction feels celebratory—streaks pop, badges feel earned, and daily resets are treated like fresh starts rather than chores.
- **Approachable & Non-Intimidating:** Soft, generous tap targets, friendly microcopy framing, and punchy typography eliminate computational fatigue from statistics and rankings.
- **Tactile & Snackable:** Buttons push back with springy resistance, cards feature substantial physical presence, and game badges simulate tangible tokens.

### Visual Style
- **Playful Neo-Tactile:** Defined by soft volumetric surfaces (`Surface 2` on `Surface`), crisp structural borders (`Line`), thick rounded corners (pill caps and pill forms), and buoyant high-contrast action triggers.
- **Game Grid Motifs:** Tile-like containers, clean badge pills, and modular card decks mirroring Wordle, crosswords, and logic puzzle matrices.

## Colors

The palette balances athletic punch with playful clarity, anchoring daily routines through electric primary actions, warm celebration tones, and analytical clarity.

### Palette Architecture
- **Primary (`#2966FF`):** The primary engine. Used for core interactive states, primary CTAs, active streak days, and major discovery anchors.
- **Primary Soft (`#DDE9FF`):** Tinted bedding for selected game filters, pill badges, and active tab containers.
- **Secondary (`#FF8C67`):** High-delight coral/orange reserved for daily streaks, flame counters, leader victory pods, and celebratory notifications.
- **Tertiary (`#00AAB6`):** Vibrant teal deployed selectively for data visualization, category tags, distribution curves, and puzzle difficulty markers.
- **Neutral Canvas:**
  - `Background` (`#F2F7FF`): Crisp sky-tinted neutral floor that avoids hospital-grade white glare while maintaining vibrancy.
  - `Surface` (`#FDFEFF`): Bright foreground elevation for actionable cards, game lists, and floating modals.
  - `Surface 2` (`#E6EEFF`): Grounded secondary wells for score inputs, matrix tiles, and recessed stat trays.
  - `Line` (`#D5DDEC`): Subtle, crisp boundary definitions that keep rounded components distinct without visual clutter.
- **Text & Feedback Hierarchies:**
  - `Ink` (`#162137`): Deep navy-charcoal for maximum legibility and personality across display and body text.
  - `Ink 2` (`#565F70`): Calibrated secondary slate for metadata, timestamps, and game authors.
  - `Inverse` (`#142958`): Dark accent floor for high-contrast tooltips, toast notifications, and night-shift stat highlights.
  - Status trio: `Success` (`#217B44`) for solved puzzles/wins; `Warning` (`#AB6C00`) for closing daily windows; `Danger` (`#BE423F`) for streak breaks and resets.

## Typography

Typography drives the energetic balance between charismatic expressiveness and high-density statistical utility.

### Role Division
- **Display & Headings (Bricolage Grotesque):** Expressive, punchy, and condensed with distinctive idiosyncratic curves. Used for daily score totals, streak numbers, game title headers, and celebration dialogs. Tight tracking maintains structural heft.
- **Body, UI & Meta (Plus Jakarta Sans):** Balanced geometric humanist grotesque with open counters and rounded apexes. Handles friend lists, timing countdowns, rulesets, and dense stat tables without visual noise.

### Typographic Rules
- Numerals in score tables and match tallies should always prioritize `font-variant-numeric: tabular-nums` to preserve grid alignment.
- Titles and stat callouts above `headline-md` use sentence case with tight letter spacing for maximum punch. Never use all-caps for full sentences.

## Layout & Spacing

The layout is built mobile-first around rapid single-thumb navigation, supporting continuous scrolling through daily game feeds and seamless horizontal swiping for scoreboards.

### Layout Mechanics
- **Mobile Foundation (<640px):** Single-column fluid view anchored by a fixed or floating bottom navigation capsule. Canvas margins sit at `margin-mobile` (16px), allowing cards to maximize viewport real estate while maintaining an inset profile.
- **Tablet / Desktop Expansion (≥640px & ≥1024px):** Max container width capped at `680px` for discovery feeds to maintain app-like intimacy, or dynamically expanding to an asymmetric 12-column grid (`8 cols` for game/stat feed, `4 cols` for persistent friend leaderboards and streak dials) on desktop viewports.
- **Grid Gutters:** Grid columns adhere strictly to an 8-point spatial rhythm using `space-sm` (8px), `space-md` (16px), and `space-xl` (32px).
- **Rhythm Rules:** Interactive button heights remain uniform across devices at a comfortable 48px to 52px for fat-finger tapping in rapid mobile play.

## Elevation & Depth

Visual hierarchy does not use diffuse realistic shadows or cold corporate elevation; it is grounded in physical layering, surface differentiation, and subtle base strokes.

### Tonal Elevation System
- **Layer 0 (Canvas):** `Background` (`#F2F7FF`) acts as the natural bottom-most baseline.
- **Layer 1 (Card & Section):** `Surface` (`#FDFEFF`) resting with a 1px solid perimeter of `Line` (`#D5DDEC`) and a subtle downward lift: `box-shadow: 0px 4px 0px 0px #D5DDEC`. This gives elements a physical, pressable toy block feel.
- **Layer 2 (Recessed Beds & Inputs):** `Surface 2` (`#E6EEFF`) indented with an inset border or smooth transition, creating containers for stats, game grids, and badge cases.
- **Layer 3 (Overlays & Dialogs):** Modals use crisp white surfaces combined with a warm backdrop wash (`#162137` at 40% opacity) and a soft ambient drop shadow: `0 12px 32px -4px rgba(22, 33, 55, 0.12)`.

### Tactile Depth
Primary buttons and interactive cards utilize a "press-down" feedback state: upon active touch, the 3px to 4px bottom offset collapses to `0px` with a slight `translateY(3px)`, reinforcing tangible feedback.

## Shapes

Shapes in this design system are exaggerated, organic, and friendly. Sharp 90-degree corners are avoided across all main interfaces to maintain the warm, gamified aesthetic.

### Corner Token Applications
- **Pill Shells (`rounded-full`):** Filter chips, action buttons, category tags, streak counters, and avatar status pods.
- **Large Enclosures (`rounded-2xl` / 1.5rem to 2rem):** Game cards, daily summary modules, and leaderboard rows.
- **Extra Large Enclosures (`rounded-3xl` / 2rem to 2.5rem):** Bottom navigation docks, modal drawers, and completion stat carousels.
- **Game Matrix Blocks:** Micro-tiles within custom Daydle result-sharing retain rounded corners of 6px to 8px to mimic physical game tiles without blurring grid lines.

## Components

### Buttons
- **Primary CTA:** Chunk pill (`height: 48px`, `border-radius: 9999px`) filled with `Primary` (`#2966FF`), text in `On Primary` (`#FFFFFF`, `label-lg`). Includes a tactile bottom edge: `box-shadow: 0 4px 0 #1948B8`. Active state compresses shadow and shifts text down by 2px.
- **Secondary / Streak Button:** Pill container with `Secondary` (`#FF8C67`) or `Primary Soft` (`#DDE9FF`) with `Primary` text for low-friction secondary actions like "View Archive" or "Remind Friends".
- **Ghost / Utility:** Transparent fill, `Ink 2` label, converting to `Surface 2` background on press.

### Chips & Filters
- **Platform/Game Tag Chips:** Small pills (`height: 32px`, `padding: 0 12px`). Inactive: `Surface` background with 1px `Line` border and `Ink 2` text. Active: `Primary Soft` background with `Primary` border and `Primary` bold text.
- **Streak & Metric Badges:** Pill with flame or puzzle emoji, set on `Secondary` tint (`#FFF0EB`) with `#D4552D` text for quick visual digestion.

### Cards & Game Tiles
- **Daily Game Launcher Card:** High-contrast card with `Surface` background, 1.5rem (`rounded-2xl`) radius, 1.5px solid `Line` border, and a bottom tactile edge (`box-shadow: 0 4px 0 #D5DDEC`). Features game icon/art, game title (`headline-md`), category pill tag, completion state indicator (green check circle or "Play Today" trigger), and friend activity mini-avatars.
- **Score Summary Card:** Elevated card featuring recessed `Surface 2` statistic wells displaying score distribution, current streak, and personal best.

### Lists & Leaderboards
- **Friend Standings List:** Spaced row format (`gap: 8px`). Each friend entry is an elongated pill-card (`rounded-xl` or `rounded-full`) with rank indicator (1st, 2nd, 3rd using bronze/silver/gold tokens or clean punchy numbering), avatar, friend name (`title-sm`), score/attempt pill, and share button.

### Form Inputs & Checkboxes
- **Search & Game Input:** Chunky fields with `Surface 2` background, `border: 2px solid transparent`, focusing to `border-color: Primary` and `Surface` fill. `border-radius: 1rem`.
- **Score Matrix Checkbox / Radio:** 24px rounded-md square/circle with thick 2px `Line` frame, animating to `Primary` with a crisp white check icon on select.

### Specialized Game Components
- **Streak Ring Tracker:** Concentric SVG progress circles in `Primary` and `Secondary` showing completion of daily routines (e.g., 4/5 games played today).
- **Result Matrix Share Drawer:** Bottom sheet with modular copyable grid text, native clipboard export button, and high-impact visual representation of the day's games.
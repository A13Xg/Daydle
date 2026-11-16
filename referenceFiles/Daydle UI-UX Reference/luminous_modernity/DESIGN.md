---
name: Luminous Modernity
colors:
  surface: '#0f131c'
  surface-dim: '#0f131c'
  surface-bright: '#353942'
  surface-container-lowest: '#0a0e16'
  surface-container-low: '#181c24'
  surface-container: '#1c2028'
  surface-container-high: '#262a33'
  surface-container-highest: '#31353e'
  on-surface: '#dfe2ee'
  on-surface-variant: '#c2c6d6'
  inverse-surface: '#dfe2ee'
  inverse-on-surface: '#2c3039'
  outline: '#8c909f'
  outline-variant: '#424754'
  surface-tint: '#adc6ff'
  primary: '#adc6ff'
  on-primary: '#002e6a'
  primary-container: '#4d8eff'
  on-primary-container: '#00285d'
  inverse-primary: '#005ac2'
  secondary: '#a4c9ff'
  on-secondary: '#00315d'
  secondary-container: '#0267b8'
  on-secondary-container: '#d6e5ff'
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
  secondary-fixed: '#d4e3ff'
  secondary-fixed-dim: '#a4c9ff'
  on-secondary-fixed: '#001c39'
  on-secondary-fixed-variant: '#004883'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#0f131c'
  on-background: '#dfe2ee'
  surface-variant: '#31353e'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 3.5rem
    fontWeight: '600'
    lineHeight: 4rem
    letterSpacing: -0.03em
  display-lg-mobile:
    fontFamily: Geist
    fontSize: 2.25rem
    fontWeight: '600'
    lineHeight: 2.75rem
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Geist
    fontSize: 2rem
    fontWeight: '600'
    lineHeight: 2.5rem
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 1.5rem
    fontWeight: '600'
    lineHeight: 2rem
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Geist
    fontSize: 1.5rem
    fontWeight: '500'
    lineHeight: 2rem
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Geist
    fontSize: 1.25rem
    fontWeight: '500'
    lineHeight: 1.75rem
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Geist
    fontSize: 1.125rem
    fontWeight: '400'
    lineHeight: 1.75rem
    letterSpacing: -0.005em
  body-md:
    fontFamily: Geist
    fontSize: 0.9375rem
    fontWeight: '400'
    lineHeight: 1.5rem
    letterSpacing: '0'
  body-sm:
    fontFamily: Geist
    fontSize: 0.8125rem
    fontWeight: '400'
    lineHeight: 1.25rem
    letterSpacing: '0'
  label-md:
    fontFamily: Geist
    fontSize: 0.875rem
    fontWeight: '500'
    lineHeight: 1.25rem
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Geist
    fontSize: 0.75rem
    fontWeight: '500'
    lineHeight: 1rem
    letterSpacing: 0.02em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style
The design system establishes a focused, high-precision visual environment tailored for modern digital experiences, analytical tools, and high-performance software. The aesthetic balances crisp utilitarian geometry with refined surface atmosphere, avoiding decorative noise or nostalgic idiosyncrasies.

- **Brand Tone:** Precise, forward-looking, calm, and intellectually rigorous.
- **Design Style:** Clean Modern Minimalism fused with Deep Surface Layering. It uses dark, layered architectural planes, sharp micro-borders, and luminous accents to direct attention without overwhelming the user.
- **Emotional Intent:** To instill clarity, competence, and friction-free focus during complex operations.

## Colors
The palette is built around an obsidian-to-midnight substrate punctuated by high-clarity optical blues and precise informational indicators.

- **Base Canvas (`#0B0F17`):** The foundational substrate for maximum depth and power efficiency.
- **Surface Elevation 1 (`#131B2E`):** Default card background, table header row, and nested panel container.
- **Surface Elevation 2 (`#1A233A`):** Interactive resting states, hovered controls, elevated modal sheets, and floating toolbars.
- **Primary Accent (`#3B82F6`):** Vibrant blue reserved for key call-to-actions, active navigation markers, selection states, and focus rings.
- **Secondary Accent (`#60A5FA`):** Used for micro-interactions, subtle active highlights, text links, and secondary indicators.
- **Tertiary Accent (`#10B981`):** Functional indicator reserved strictly for positive delta, verified states, and system success notifications.
- **Neutral Boundaries & Text:** Borders leverage translucent cool whites (`rgba(255, 255, 255, 0.08)` to `rgba(255, 255, 255, 0.14)`), while text transitions from bright crisp white (`#F8FAFC`) to muted slate (`#94A3B8`).

## Typography
Typography relies on the modern, precision-engineered geometric grotesque **Geist**. It eschews humanist quirks and condensed stylings in favor of monolinear stroke rhythm, razor-sharp counters, and exceptional low-pixel legibility.

- **Hierarchical Discipline:** Headers utilize tighter letter-spacing to form dense, commanding visual anchors. Body text retains a neutral tracking profile with generous proportional line heights for prolonged reading comfort.
- **Numbers & Metrics:** Tabular numerals should be enabled (`font-variant-numeric: tabular-nums`) across all data displays, tables, and financial/metric widgets to ensure consistent column alignment.
- **Uppercase Usage:** Reserved exclusively for sub-labels, badge descriptors, and table column headers at the `label-sm` scale, paired with slight letter spacing (`0.04em`).

## Layout & Spacing
The layout model employs a fluid 12-column responsive grid anchored to an 8pt base spacing rhythm (with a 4pt sub-unit for compact internal component padding).

- **Desktop (1200px+):** 12-column fluid grid, `2rem` outer page margins, `1.5rem` gutters. Content containers cap at a max-width of 1440px to preserve visual cohesion.
- **Tablet (768px - 1199px):** 8-column fluid grid, `1.5rem` outer page margins, `1rem` gutters. Sidebars collapse to rail navigation or bottom tab-bars.
- **Mobile (< 768px):** 4-column fluid grid, `1rem` outer page margins, `1rem` gutters. Multi-column metric groups reflow to single-column or horizontal scroll strips.
- **Padding Discipline:** Internal component spacing follows strict pairs: compact controls use `space-xs` vertically by `space-sm` horizontally; standard interactive elements use `space-sm` by `space-md`.

## Elevation & Depth
Depth in this dark mode environment avoids murky black drop shadows, relying instead on surface color shifting, crisp structural borders, and translucent luminous backdrops.

- **Tonal Stepping:** Elevation is communicated through surface brightness rather than physical projection. The base canvas sits at `#0B0F17`, intermediate cards and panels step up to `#131B2E`, and dynamic layers (dropdowns, popovers, elevated hover cards) rise to `#1A233A`.
- **Subtle Borders:** Every container, card, and floating menu employs a 1px border rendered in `rgba(255, 255, 255, 0.08)`. Hovered or active states shift the border to `rgba(59, 130, 246, 0.40)`.
- **Ambient Glow:** Floating components (modals, active tooltips) introduce an ultra-subtle tinted shadow: `0 12px 32px -4px rgba(11, 15, 23, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.10)`. When primary elements demand focus, an ambient blue halo (`0 0 20px rgba(59, 130, 246, 0.15)`) may be applied.

## Shapes
The shape language uses a modern pill styling paradigm for all standalone interactive targets (buttons, search inputs, badges, chips), balanced against structured geometric rectangles with controlled corners for macroscopic containers (cards, dialogs, drawers).

- **Pill Primitives:** Buttons, inputs, search boxes, segmented controls, and chips carry a full pill silhouette (`rounded-full` or tokens scaling to `9999px`).
- **Structured Framing:** Cards, modal dialogs, and large structural panels utilize a disciplined corner radius (`rounded-lg` at 1rem / 16px, or `rounded-xl` at 1.5rem / 24px) to retain structural authority and grid alignment.

## Components

### Buttons
- **Primary:** Full pill radius, solid `#3B82F6` background, `#FFFFFF` text, font weight 500 (`label-md`). Hover transitions smoothly to `#2563EB` with subtle micro-scale acceleration.
- **Secondary / Outline:** Full pill radius, transparent background, 1px border `rgba(255, 255, 255, 0.14)`, `#F8FAFC` text. Hover shifts background to `#1A233A` and border to `rgba(255, 255, 255, 0.25)`.
- **Ghost:** Full pill radius, zero border, `#94A3B8` text. Hover shifts background to `rgba(255, 255, 255, 0.05)` and text to `#F8FAFC`.

### Chips & Badges
- Pill-shaped geometry with vertical padding `space-xs` and horizontal padding `space-sm`.
- Status chips leverage a low-opacity color tint (e.g., `#3B82F6` at 15% opacity) accompanied by a 1px border of matching hue and high-legibility foreground text. Include a 6px circular indicator dot for real-time states.

### Input Fields
- Enclosed in a pill radius, surface `#131B2E`, with a 1px border `rgba(255, 255, 255, 0.10)`.
- Height calibrated to 40px (compact) or 48px (standard), with `1rem` horizontal inner padding.
- **Focus State:** 1px border transition to `#3B82F6` alongside an outer glow ring: `0 0 0 3px rgba(59, 130, 246, 0.20)`. Placeholder text rests at `#64748B`.

### Checkboxes & Radio Buttons
- 18px dimensions with crisp 1px borders in `rgba(255, 255, 255, 0.20)`. Checkboxes carry a 4px corner radius; radio buttons are fully circular.
- Selected state fills with `#3B82F6` displaying an inner white checkmark or center pip, accompanied by a 2px halo transition on press.

### Cards
- Standard surface background of `#131B2E` with a 1px perimeter border `rgba(255, 255, 255, 0.08)` and corner radius of `1rem`.
- Padding set consistently to `space-lg` (24px).
- **Interactive Cards:** Hover states gently illuminate the surface to `#1A233A` and shift the border to `rgba(59, 130, 246, 0.35)`.

### Lists & Data Rows
- Zero default container margins, separated by hairline dividers `rgba(255, 255, 255, 0.06)`.
- Hovering over a list row triggers an instantaneous `#1A233A` background wash with pill-shaped selection indicators on the leading edge.

### Segmented Controls & Tabs
- Contained inside an outer pill track styled in `#0B0F17` with a 1px border.
- Active segment is an elevated pill in `#1A233A` with a crisp border `rgba(255, 255, 255, 0.10)` and bright white text, creating a tactile sliding-dock effect.
---
name: Kerala Transit Companion
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#3e4947'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#6e7977'
  outline-variant: '#bdc9c6'
  surface-tint: '#006a63'
  primary: '#005c55'
  on-primary: '#ffffff'
  primary-container: '#0f766e'
  on-primary-container: '#a3faef'
  inverse-primary: '#80d5cb'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#7d4200'
  on-tertiary: '#ffffff'
  tertiary-container: '#a15600'
  on-tertiary-container: '#ffe6d5'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#9cf2e8'
  primary-fixed-dim: '#80d5cb'
  on-primary-fixed: '#00201d'
  on-primary-fixed-variant: '#00504a'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#ffdcc3'
  tertiary-fixed-dim: '#ffb77d'
  on-tertiary-fixed: '#2f1500'
  on-tertiary-fixed-variant: '#6e3900'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-xl:
    fontFamily: Noto Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Noto Sans
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Noto Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Noto Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  title-lg:
    fontFamily: Noto Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
  title-md:
    fontFamily: Noto Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Noto Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Noto Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Noto Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Noto Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Noto Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Noto Sans
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-mobile: 0.75rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

The design system establishes a high-reliability, hyper-accessible transit aesthetic crafted specifically for commuters across Kerala's multimodal transit network—spanning KSRTC ordinary/swift buses, Kochi Water Metro, Kochi Metro rail, private stage carriers, and Indian Railways suburban links.

The brand personality is **utilitarian, dependable, grounded, and reassuringly prompt**. It addresses varied environmental constraints: glaring tropical sunlight at open bus shelters, erratic mobile network coverage across ghat and coastal routes, one-handed operation inside crowded coaches, and diverse multilingual literacy across generations.

The visual direction combines **Functional Modernism with Subtly Tinted Tactility**:
- Crisp, unembellished information hierarchy optimized for glances under 2 seconds.
- High color contrast meeting strict WCAG 2.1 AAA thresholds for core legibility.
- Expressive South Indian transit iconography paired with immediate multimodal route schematics.
- Grounded slate and deep lush backdrops evoking the state's lush canopy and backwaters without relying on decorative clichés.

## Colors

The palette draws directly from Kerala’s geography and civic infrastructure while prioritizing optical hierarchy under outdoor conditions:

- **Primary (`#0F766E`, Emerald Teal)**: Anchors key actions, header navigation bands, active route polylines, and confirmed booking states. Paired with a vibrant emerald accent (`#059669`) for positive validation, platform arrivals, and on-time statuses.
- **Secondary (`#0F172A`, Deep Navy Slate)**: Delivers absolute contrast for titles, micro-copy, heavy iconography, and nocturnal wayfinding panels. A lighter secondary slate (`#1E293B`) supports secondary containers and prominent card headlines.
- **Tertiary (`#D97706`, Warm Amber / Marigold)**: Reserved for fare tags, real-time vehicle GPS pulses, delay warnings, platform change notifications, and urgent service alerts. Complemented by `#F59E0B` for non-critical live pings.
- **Neutrals & Surfaces**: Clean daylight readability via `#FFFFFF` (elevated cards), `#F8FAFC` (canvas background), and crisp `#E2E8F0` / `#CBD5E1` (structural divider borders).
- **Transit Status Accents**:
  - *Live GPS Tracking*: `#059669` (Signal Green) with subtle breathing rings.
  - *Offline / Cached*: `#475569` (Slate Outline) indicating low/no connectivity fallback.
  - *Crowding / Standee Index*: Low (`#059669`), Moderate (`#D97706`), High/Crush (`#DC2626`).

## Typography

The type system prioritizes universal multilingual rendering across English, Malayalam (മലയാളം), Tamil (தமிழ்), and Hindi (हिंदी). 

- **Font Family Execution**: Google `Noto Sans` operates as the primary global family alongside its native regional cuts (`Noto Sans Malayalam`, `Noto Sans Tamil`, `Noto Sans Devanagari`). When system fallbacks trigger, `Inter` sustains Latin micro-typography.
- **Vertical Metrix & Conjuncts**: Malayalam and Indic scripts feature complex subscript conjuncts (ചില്ലക്ഷരങ്ങൾ / കൂട്ടക്ഷരങ്ങൾ) requiring 10–15% more vertical line clearance than pure Latin text. Line heights are intentionally relaxed to prevent overlapping diacritics.
- **Numerals**: Platform bay allocations, live arrival times, and Indian Rupee values (`₹`) maintain tabular sizing (`font-variant-numeric: tabular-nums`) to ensure vertical alignment in stop-by-stop transit timetables.

## Layout & Spacing

A mobile-first fluid layout system engineered around one-thumb reach zones and physical transit constraints:

- **Thumb Zone Rule**: Critical search inputs, multimodal mode switches, and live refresh buttons anchor within the lower 40% of the mobile viewport.
- **Grid Structure**:
  - *Mobile (< 640px)*: 4-column fluid layout with `0.75rem` (12px) gutters and `1rem` (16px) margins. All touch targets strictly observe a minimum dimension of `48px x 48px`.
  - *Tablet (641px - 1024px)*: 8-column fluid layout with `1rem` gutters; navigation shifts to an adaptive rail or anchored split panel (itinerary left, interactive map right).
  - *Desktop (> 1024px)*: Max container width constrained to `1200px` across 12 columns with `2rem` margins, avoiding stretched transit boards.
- **Touch Target Integrity**: Form inputs, transit filter pills, and timetable expansion triggers maintain at least `48px` physical tap area with an explicit `8px` non-interactive buffer between adjacent actionable elements.

## Elevation & Depth

Visual depth is conveyed through **crisp architectural borders paired with soft ambient diffusion**, preventing visual mud in harsh sunlight:

- **Level 0 (Canvas Surface)**: `#F8FAFC` base background. Flat, zero elevation.
- **Level 1 (Card & Timetable Tiles)**: Crisp `#FFFFFF` surface bounded by a continuous `1px` stroke in `#E2E8F0`. Shadow: `0 1px 3px rgba(15, 23, 42, 0.05), 0 1px 2px rgba(15, 23, 42, 0.03)`.
- **Level 2 (Interactive Floating Modules & Sticky Banners)**: `#FFFFFF` with `1px` `#CBD5E1`. Shadow: `0 4px 12px -2px rgba(15, 23, 42, 0.08), 0 2px 6px -1px rgba(15, 23, 42, 0.04)`. Used for bottom navigation bars, floating quick-search, and GPS status chips.
- **Level 3 (Modal Sheets & Route Drawer Panels)**: Bottom-sheet drawers with backdrop blur (`backdrop-filter: blur(8px)`) overlaying the route map. Shadow: `0 20px 25px -5px rgba(15, 23, 42, 0.15)`.
- **Contrast Integrity**: Never rely on drop shadows alone to define card boundaries. A sharp `1px` border is mandatory on all light surfaces to withstand low-quality mobile LCDs operating at low brightness.

## Shapes

The interface employs a balanced **Rounded (`2`)** geometric identity:
- Base inputs, buttons, and status alerts maintain an `8px` (`0.5rem`) corner radius.
- Cards, timetable containers, and map overlay banners use `16px` (`1rem`, `rounded-lg`).
- Modal sheets, interactive bottom drawers, and key action capsules utilize `24px` (`1.5rem`, `rounded-xl`).
- Micro-badges, transit pill tags (e.g., "KSRTC Fast Passenger", "Water Metro", "Platform 3B"), and live indicator dots adopt continuous full-capsule (`rounded-full`) geometry.

## Components

### Buttons & Interactive Controls
- **Primary CTA**: Solid `#0F766E` with `#FFFFFF` text. Minimum height `48px`. Active state triggers `#0D5E58` with subtle inset scaling (`transform: scale(0.98)`).
- **Secondary CTA**: Neutral slate stroke (`1.5px` solid `#CBD5E1`) over transparent or `#FFFFFF` background with `#0F172A` text.
- **Tertiary Amber Action**: `#D97706` fill with bold white copy, reserved exclusively for booking checkout, fare confirmation, and instant SOS/report actions.

### Multimodal Transport Badges
- **KSRTC / Bus**: Crimson/Amber badge with high-contrast bus icon (`#DC2626` or `#D97706`).
- **Kochi Metro Rail**: Cyan/Teal capsule (`#0284C7` or `#0F766E`).
- **Water Metro (Ferry)**: Deep Cerulean (`#0369A1`) badge with wave icon.
- **Suburban Rail**: Solid Slate (`#1E293B`) badge.
- Badges must feature localized station/stop identifiers with bilingual English + Malayalam typography stacked or inline.

### Transit Progress Lines (Schematics)
- Continuous vertical or horizontal `3px` solid stroke connecting transit nodes.
- **Passed Stops**: Muted `#CBD5E1` line with hollow dots.
- **Current Position**: Pulsing dual-ring circle in `#059669` (Live) or `#D97706` (Delayed).
- **Upcoming Stops**: Solid `#0F766E` line with solid node bullets.
- **Interchange / Transfer Hubs**: Concentric dual-stroke target symbol with multimodal transfer icons.

### Status Indicators & Offline Pings
- **Live Estimated**: `#059669` pill with animated pulsing dot and text: `Live • 4 mins`.
- **Cached / Offline**: Neutral `#475569` badge with cloud-off icon and relative sync indicator: `Cached (12m ago)`.
- **Delay Warning**: `#FEF3C7` background with `#92400E` border and `#B45309` typography.

### Form Inputs & Search Fields
- Station lookup inputs feature `48px` minimum height, leading transit-type icons, trailing geolocation triggers, `#F8FAFC` background resting, and a crisp `#0F766E` `2px` focus outline.

### Journey & Itinerary Cards
- Card container with white `#FFFFFF` surface, `1px` `#E2E8F0` border, `16px` padding, displaying departure/arrival timestamps, transfer counts, total fare (in ₹), and walking segments clearly delineated by dotted progress bridges.
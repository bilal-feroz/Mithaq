# MITHAQ Gate — Design System

**Visual concept: Obsidian Glass Security**

MITHAQ Gate must feel like a premium authorization instrument — the intersection of a
top-tier security company, a luxury digital-identity studio, and an award-winning
product team. Every surface should read as *engineered*, not decorated. The interface
is a sequence of calm obsidian layers; authorization states are the only moments of
color, which makes them unmistakable.

The metaphor: a **policy passport** examined on a dark inspection table under soft
directional light. Glass layers hold information at different depths; the decision
is always the brightest object in the room.

---

## 1. Material hierarchy

Glass is the material language, executed in four disciplined levels. Never invent a
fifth. Never nest glass more than two levels deep.

### Level 1 — Application shell (`the room`)
- Background `#07090d` (never pure black), blue-graphite tint.
- Soft radial illumination behind key sections (`.atmosphere`), fixed, non-scrolling.
- SVG turbulence grain at ~2.5% opacity over everything (`.grain`).
- Faint 72px geometric grid at ~2% opacity in hero regions only.
- Optional slow CSS light drift (90s cycle), paused for `prefers-reduced-motion`.

### Level 2 — Primary panels (`GlassPanel`)
- `background: var(--surface-glass)` (rgba(17,23,32,0.68)).
- `backdrop-filter: blur(18px) saturate(140%)`.
- 1px translucent border `var(--border-glass)`.
- Inner top-edge highlight: 1px inset gradient from `var(--highlight-glass)` to transparent.
- Exterior shadow: `0 24px 48px -24px rgba(0,0,0,0.55)` — deep but diffused.
- Radius `--radius-panel` (20px).

### Level 3 — Elevated decision surfaces (`GlassDecision`, `GlassDialog`)
- `background: var(--surface-glass-strong)` (rgba(18,24,34,0.86)).
- `backdrop-filter: blur(28px) saturate(160%)`.
- Brighter perimeter `var(--border-glass-strong)` plus a status-tinted outer glow
  (`StatusHalo`) at ≤ 22% alpha.
- Entrance: 320ms rise + light sweep (a 1200ms one-shot specular pass).
- Reserved for: APPROVED, BLOCKED, amendment approval, revocation confirm,
  verification status. Nothing else earns Level 3.

### Level 4 — Compact controls (`inputs, chips, segments, buttons`)
- Minimal or no blur. `background: var(--surface-glass-subtle)` or solid `--background-elevated`.
- Direct 1px borders, strong text contrast, crisp 10–12px radii.
- Never independently blur a form field when it sits on Level 2 glass.

**Rule of depth:** shell → panel → control is the standard stack. A dialog floats
above all three. If a design wants glass-on-glass-on-glass, flatten it.

---

## 2. Color tokens

Defined in `src/app/globals.css` under `@theme` / `:root`. Use tokens only — no ad-hoc hex.

### Neutral foundation
```css
--background:            #07090d;
--background-elevated:   #0b0f15;
--surface-glass:         rgba(17, 23, 32, 0.68);
--surface-glass-strong:  rgba(18, 24, 34, 0.86);
--surface-glass-subtle:  rgba(255, 255, 255, 0.035);

--border-glass:          rgba(255, 255, 255, 0.11);
--border-glass-strong:   rgba(255, 255, 255, 0.18);
--highlight-glass:       rgba(255, 255, 255, 0.14);

--text-primary:          #f4f6f8;
--text-secondary:        #a9b2bf;
--text-muted:            #737d8b;
```

### Status colors (disciplined accents — never page backgrounds)
```css
--approved:        #63d8a4;   --approved-soft:      rgba(99, 216, 164, 0.14);
--blocked:         #ff6b72;   --blocked-soft:       rgba(255, 107, 114, 0.14);
--warning:         #e6b45f;   --warning-soft:       rgba(230, 180, 95, 0.14);
--informational:   #7ea9ff;   --informational-soft: rgba(126, 169, 255, 0.14);
```

### Metallic accent
```css
--metal:      #c8d2de;  /* brushed silver for wordmark, seals, key iconography */
--metal-dim:  #8b95a3;
```

Usage discipline:
- Default UI is graphite / silver / desaturated blue-black.
- Status color appears in: badge text+icon, halo glow, 3px clause rail, meter fill.
- Status soft variant appears only inside chips/badges, never as a panel wash
  larger than a chip.
- Revoked = `--blocked` family plus a struck seal icon; expired/superseded = `--warning`.

---

## 3. Typography

Loaded via `next/font` with `display: swap`, subset latin + arabic.

| Role | Face | Notes |
|---|---|---|
| Display / decisions | **Manrope** (700–800) | tight tracking (-0.02em to -0.04em), used for `REQUEST APPROVED`, page titles |
| UI / body | **IBM Plex Sans** (400/500/600) | high legibility, security-document character |
| Arabic | **IBM Plex Sans Arabic** | harmonious with Plex; applied via `font-family` fallback chain and `[lang="ar"]` |
| Data / forensic | **IBM Plex Mono** (400/500) | hashes, reason codes, token ids, timestamps, version numbers |

Hierarchy:
- **Hero decision**: 40–56px Manrope 800, uppercase, tracked slightly tight; one per screen.
- **Page heading**: 28–32px Manrope 700 + one-line `--text-secondary` subtitle.
- **Panel heading**: 15–17px semibold, sentence case.
- **Metadata label**: 11px uppercase, +0.08em tracking, `--text-muted`, used sparingly.
- **Body**: 14–15px / 1.6 `--text-secondary`, key values `--text-primary`.
- **Forensic values**: 12–13px Plex Mono.
- Arabic copy: `dir="rtl"`, right-aligned, `line-height ≥ 1.7`, never letter-spaced.

Never: tiny grey text as decoration, more than two faces per surface, uppercase body copy.

---

## 4. Spacing, radius, shadow

**Spacing scale** (multiples of 4): 4, 8, 12, 16, 20, 24, 32, 40, 56, 80.
Panels pad 24–32. Page gutters 24 (mobile) / 40 (laptop) / 56+ (desktop).
Sections separate by 40–56. Minimum 30% negative space at hero moments.

**Radii**: `--radius-control: 10px`, `--radius-card: 14px`, `--radius-panel: 20px`,
`--radius-pill: 999px`. Never mix radii within one component.

**Shadows**:
```css
--shadow-panel:  0 24px 48px -24px rgba(0, 0, 0, 0.55);
--shadow-raised: 0 32px 64px -28px rgba(0, 0, 0, 0.65);
--shadow-halo-approved: 0 0 60px -12px rgba(99, 216, 164, 0.22);
--shadow-halo-blocked:  0 0 60px -12px rgba(255, 107, 114, 0.22);
```
Halos only accompany Level 3 surfaces.

---

## 5. Motion

Framer Motion (`motion/react`). Motion communicates **state and causality**, nothing else.

**Durations**: micro (hover/press) 120–160ms · state change 240–320ms ·
decision reveal 400–600ms · light sweep 1200ms one-shot · atmosphere ≥ 60s.

**Easing**: standard `cubic-bezier(0.2, 0.8, 0.2, 1)`; decision reveal
`cubic-bezier(0.16, 1, 0.3, 1)`; exits `ease-in` 160ms.

**Choreography**:
- Page entry: heading → primary panel → secondary panels, 40–60ms stagger, 8px rise.
- Decision reveal: halo fades in → badge scales 0.96→1 → clause rows stagger 30ms.
- Token mint: MINTED → CONSUMED as a crossfade + mono counter.
- Version transition: v1 chip slides left/dims to `superseded`, v2 rises with sweep.
- Revocation: desaturate passport, red seal stamps at 0.98→1 scale — 400ms, once.

Prohibited: idle floating, spring overshoot > 1.02, per-line text animation,
anything longer than 600ms on the demo path, animating `backdrop-filter` or `filter: blur()`.
All non-essential motion collapses to opacity fades under `prefers-reduced-motion`.

---

## 6. Grid & composition

- Max content width 1200px (verifier: 760px single column) with generous side gutters.
- Desktop shell: compact 232px left rail (wordmark, nav, role switcher, provider badge)
  + main column. Rail is Level 2 glass, full height.
- The Generation Gate: request form is secondary (left, 5/12); the decision surface
  dominates (right, 7/12). On mobile, decision renders first.
- Owner Console: one large policy passport (7/12) + usage panel (5/12), then
  amendment inbox + audit timeline; danger zone isolated at the end, full width.
- Asymmetry is deliberate; equal-weight card grids are prohibited.
- Every screen has exactly one focal point.

Breakpoints: 390 / 768 / 1024 / 1280 / 1440. Screenshot-priority at 1440×900 and 1920×1080.

---

## 7. Accessibility constraints

- WCAG AA contrast on every glass surface — text sits on ≥ 0.68-alpha dark glass;
  if contrast is doubtful, raise surface opacity, never lower text lightness.
- Status = icon + text label + color (never color alone): ✓/✕/⚠/⏱ + wording.
- Full keyboard support; visible 2px `--informational` focus ring offset 2px.
- Dialogs: Radix (focus trap, esc, aria). Forms: labels bound with `htmlFor`,
  errors linked via `aria-describedby`.
- Clause list is a semantic `<ul>`; each row announces "passed"/"failed" in text.
- Live decision changes announced via `aria-live="polite"` region.
- Audio players have accessible names. Touch targets ≥ 44px.
- `prefers-reduced-motion` collapses all choreography to fades; atmosphere freezes.
- Arabic content rendered with `dir="rtl"` and `lang="ar"`.

---

## 8. Arabic / RTL constraints

- Any user-provided Arabic text (consent statement, scripts) renders in
  IBM Plex Sans Arabic with `dir="rtl"`, right-aligned, in its own block.
- Never mix RTL text inline with LTR forensic data; stack them.
- Numerals inside Arabic blocks use Western digits for hash/date consistency.
- Chip labels stay LTR (they are normalized enum values), but Arabic previews
  are first-class, not an afterthought.

---

## 9. Component rules

Reusable primitives in `src/components/glass/` — one place for glass recipes.
**Never paste a glass class string ad hoc.**

| Component | Level | Purpose |
|---|---|---|
| `GlassPanel` | 2 | primary surface, optional heading slot |
| `GlassCard` | 2 (compact) | sub-surface inside layouts, 14px radius |
| `GlassDialog` | 3 | Radix dialog wrapper with sweep entrance |
| `StatusHalo` | 3 aura | status-tinted glow wrapper for decision surfaces |
| `DecisionBadge` | — | APPROVED / BLOCKED / REVOKED hero badge, icon + label |
| `ClauseResultRow` | 4 | ✓/✕ row: clause, code (mono), explanation, expected/received |
| `PolicyChip` | 4 | normalized term chip: label + value, optional status tint |
| `MetricGlass` | 2 compact | single stat: label, value, meter |
| `TimelineEvent` | 4 | audit event: hash-linked, mono timestamp |
| `SecurityLabel` | 4 | 11px uppercase micro-label with icon |
| `PrimaryAction` | 4 | high-contrast silver-on-light action |
| `DangerAction` | 4 | blocked-tinted destructive action |
| `RoleSwitcher` | 4 | persona segmented control, always visible |
| `ProviderBadge` | 4 | "Demo provider" indicator when mock mode active |

Rules:
- A component owns its glass recipe; screens compose components.
- Buttons: one `PrimaryAction` per surface. Secondary = quiet outline. Danger is never primary.
- Chips wrap; they never truncate a policy term.
- Icons: lucide, 16–20px, `stroke-width` 1.75, always paired with text in status contexts.

---

## 10. What not to do

- ❌ Transparent grey rectangles with 4px blur pretending to be glass.
- ❌ The same 60px blur on nav, cards, chips, and footer.
- ❌ Purple→cyan gradients, neon outlines, lens flares, random orbs.
- ❌ Solid green/red full-screen decision cards — luminosity is controlled, not shouted.
- ❌ Twelve equal cards in a grid ("admin template syndrome").
- ❌ White 2px borders around everything.
- ❌ Text below 4.5:1 contrast because "it looks sleek".
- ❌ Floating/bouncing idle animations; springy overshoot.
- ❌ Toasts as the primary decision surface.
- ❌ Blurring form fields individually on top of panel glass.
- ❌ Claiming biometric verification — the recording step is a **Dynamic consent challenge**.
- ❌ The word "immutable" — the audit chain is **tamper-evident within the application audit model**.

---

## 11. Screen focal points (quality gate)

| Screen | The one focal point |
|---|---|
| Consent Studio | the natural-language → structured **policy passport** transformation |
| Generation Gate | the **decision surface** (APPROVED / BLOCKED) |
| Amendment review | the **current → proposed** comparison panel |
| Owner Console | the **policy passport** with live status |
| Public Verifier | the **verification status** seal |

Before a screen ships, answer the ten questions in the visual quality gate
(one focal point, layered glass, readable text, non-color state cues, grid
alignment, intentional spacing, negative space, custom look, purposeful motion,
screenshot strength). Any "no" → fix before moving on.

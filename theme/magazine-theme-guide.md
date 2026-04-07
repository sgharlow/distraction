# Distraction Index — Magazine Theme Implementation Guide

## Overview

This document contains everything needed to retheme distractionindex.org from its current design to a "Magazine Editorial" aesthetic. The site is built with Next.js 14 and deployed on Vercel. Apply these changes across all pages, not just the dashboard.

---

## 1. Design Tokens & Color System

### Primary Palette

```css
:root {
  /* Background */
  --di-bg-page: #FAF8F4;
  --di-bg-surface: #F0EDE6;
  --di-bg-card: #FFFFFF;
  --di-bg-footer: #F0EDE6;

  /* Text */
  --di-text-primary: #1A1A1A;
  --di-text-secondary: #666666;
  --di-text-tertiary: #888888;
  --di-text-muted: #AAAAAA;
  --di-text-quiet: #CCCCCC;

  /* Semantic: Damage (List A / Constitutional Threats) */
  --di-damage: #8B2020;
  --di-damage-light: #F0E0DC;

  /* Semantic: Distraction (List B / Media Hype) */
  --di-distraction: #3D5A80;
  --di-distraction-light: #E8E0F0;

  /* Semantic: Smokescreen */
  --di-smokescreen: #8B4513;
  --di-smokescreen-light: #F0EDE6;

  /* Semantic: Positive / Live */
  --di-positive: #2A5A2A;
  --di-positive-light: #E0EDDF;

  /* Semantic: Balanced */
  --di-balanced-bg: #EEEEEE;
  --di-balanced-text: #888888;

  /* Borders & Dividers */
  --di-border-light: #EEEEEE;
  --di-border-medium: #DDDDDD;
  --di-border-heavy: #1A1A1A;
  --di-border-section: #1A1A1A; /* double-rule divider */

  /* Accents */
  --di-accent-black: #1A1A1A;
  --di-accent-white: #FAF8F4;
}
```

### Dark Mode Override

If you add dark mode support later, here is the inverted palette:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --di-bg-page: #141210;
    --di-bg-surface: #1E1C18;
    --di-bg-card: #1A1816;
    --di-text-primary: #E8E4DC;
    --di-text-secondary: #A09888;
    --di-text-tertiary: #7A7268;
    --di-text-muted: #5A5248;
    --di-damage: #D4605A;
    --di-damage-light: #2A1A18;
    --di-distraction: #7BA0C4;
    --di-distraction-light: #1A1830;
    --di-smokescreen: #C48040;
    --di-smokescreen-light: #241A10;
    --di-positive: #5A9A5A;
    --di-positive-light: #1A2418;
    --di-balanced-bg: #2A2826;
    --di-balanced-text: #7A7268;
    --di-border-light: #2A2826;
    --di-border-medium: #3A3630;
    --di-border-heavy: #E8E4DC;
    --di-border-section: #E8E4DC;
    --di-accent-black: #E8E4DC;
    --di-accent-white: #141210;
  }
}
```

---

## 2. Typography

### Font Stack

```css
/* Headline / editorial font — serif */
--di-font-headline: Palatino, 'Palatino Linotype', Georgia, serif;

/* UI / metadata / labels — sans-serif */
--di-font-ui: Helvetica, Arial, sans-serif;
```

**Do NOT load any web fonts.** Palatino and Helvetica are system fonts with universal availability. This keeps page weight at zero for typography and avoids FOIT/FOUT.

### Type Scale

| Element | Font | Size | Weight | Color | Letter-spacing | Text-transform |
|---------|------|------|--------|-------|----------------|----------------|
| Week number (hero "66") | Headline | 36px | 700 | primary | -2px | none |
| Pull quote | Headline | 26px | 700 | primary | -0.5px | none |
| Key story title | Headline | 16px | 700 | primary | 0 | none |
| Index row title | Headline | 12px | 600 | primary | 0 | none |
| Body text | Headline | 12-13px | 400 | secondary | 0 | none |
| Section header | UI | 9px | 600 | varies (semantic) | 2px | uppercase |
| Stat number | UI | 16px | 700 | primary | 0 | none |
| Stat label | UI | 9px | 400 | tertiary | 0.5px | uppercase |
| Score badge | UI | 10px | 700 | semantic | 0 | none |
| Tag badge | UI | 9px | 400 | varies | 0 | uppercase |
| Nav link | UI | 10px | 400 | tertiary | 0 | none |
| Active nav link | UI | 10px | 600 | primary | 0 | none |
| Meta line (date, source count) | UI | 9px | 400 | muted | 0 | none |

---

## 3. Layout Structure

### Page-Level

```
Background: var(--di-bg-page)
Max-width: 900px (content), centered
Padding: 20px horizontal on mobile, 32px on desktop
```

### Section Hierarchy (top to bottom)

```
1. Navigation bar
2. Week selector row
3. Hero section (pull-quote + sidebar stats)
4. "Look at this" / "They want you to look at" panel
5. Key stories (double-rule divider, 2-column)
6. Smokescreen pair callout
7. Full index sections:
   a. Real damage (constitutional threats)
   b. Distractions (manufactured outrage)
   c. Noise floor (low impact)
8. Subscribe CTA
9. Footer
```

---

## 4. Component Specifications

### 4.1 Navigation Bar

```
Layout: flex, space-between, baseline-aligned
Left: Week number (36px serif bold) + "The Distraction Index" (14px UI bold)
Right: Nav links (10px UI), active link is bold + primary color
Bottom border: 1px solid var(--di-border-medium)
Padding-bottom: 10px
Margin-bottom: 14px
```

### 4.2 Week Selector

```
Layout: flex row, center-aligned
Elements: ◀ arrow | "Mar 29 – Apr 4, 2026" (12px UI bold) | "Week 66" (10px UI muted) | LIVE badge | ▶ arrow
LIVE badge: 9px UI bold, padding 2px 6px, border-radius 3px, bg var(--di-positive), color white
Quick-jump buttons (This Week, Last Week, Inauguration): 10px UI, muted, inline
Share buttons: right-aligned, 10px UI
```

### 4.3 Hero Section (Pull Quote + Sidebar)

```
Layout: CSS Grid, grid-template-columns: 2fr 1fr, gap 16px
```

**Left column — Pull Quote:**
```
Font: Headline, 26px, weight 700, line-height 1.15, letter-spacing -0.5px
Format: "While they talked about [TOPIC], Congress quietly [ACTION]."
Emphasized words: color var(--di-damage), wrapped in <em>
Below quote: 12px secondary body text, line-height 1.5
```

**The pull-quote text is auto-generated from the smokescreen pair data each week.** Template:

```
"While they talked about {distraction_event.short_name},
{damage_event.short_description}."
```

**Right column — Sidebar Stats:**
```
Border-left: 2px solid var(--di-accent-black)
Padding-left: 12px
Header: "BY THE NUMBERS" — 9px UI, letter-spacing 2px, uppercase, muted
Each stat row:
  Left: number (16px UI bold) + label (9px UI uppercase muted)
  Right: delta value, colored (positive = var(--di-positive), negative = var(--di-damage))
```

### 4.4 "Look at this" / "They want you to look at"

```
Container: bg var(--di-bg-surface), border-radius 6px, padding 10px 12px
Layout: 2-column grid, gap 12px
Left header: "LOOK AT THIS" — 8px UI bold, letter-spacing 2px, uppercase, color var(--di-positive)
Right header: "THEY WANT YOU TO LOOK AT" — same style, color var(--di-damage)
Content: 11px headline font, line-height 1.4
Secondary items: color var(--di-text-tertiary)
```

### 4.5 Key Stories (Top Damage + Top Distraction)

```
Divider above: border-top 3px double var(--di-border-section)
Padding-top: 12px
Layout: 2-column grid, gap 14px
```

**Each story card:**
```
Header: 8px UI bold, letter-spacing 2.5px, uppercase
  - Damage: "TOP DAMAGE · A: {score}" in var(--di-damage)
  - Distraction: "TOP DISTRACTION · B: {score}" in var(--di-distraction)
Title: 16px headline, weight 700, line-height 1.25
Body: 11px headline, color secondary, line-height 1.4
Score row: flex, gap 6px
  - Active score: 10px UI bold, semantic color
  - Inactive score: 10px UI, muted
  - Source count: 9px UI, color var(--di-text-muted)
```

### 4.6 Smokescreen Pair

```
Container: bg var(--di-bg-surface), border-radius 6px, padding 10px 12px
Layout: flex row, center-aligned, flex-wrap: wrap, gap 6px
Elements:
  "SMOKESCREEN" label: 9px UI bold, uppercase, letter-spacing 1px, color var(--di-smokescreen)
  Distraction name: 12px headline bold
  "is obscuring": 11px headline italic, color var(--di-damage)
  Damage name: 12px headline bold
  SI badge: 10px UI bold, padding 2px 8px, border-radius 3px, bg var(--di-accent-black), color var(--di-accent-white)
```

### 4.7 Full Index Section Headers

```
Layout: flex, space-between, baseline-aligned
Bottom border: 2px solid var(--di-border-heavy)
Padding-bottom: 4px
Margin-bottom: 8px
Text: 9px UI bold, letter-spacing 2px, uppercase
Color per section:
  Real damage: var(--di-damage)
  Distractions: var(--di-distraction)
  Noise floor: var(--di-text-tertiary)
```

### 4.8 Index Event Rows

```
Layout: flex row, baseline-aligned, gap 6px
Padding: 4px 0
Border-bottom: 1px solid var(--di-border-light)
```

**Row elements (left to right):**
```
1. Row number: 10px UI, color muted, min-width 14px
2. Event content (flex: 1):
   - Title: 12px headline, weight 600 for Real Damage rows, 400 for others
   - Meta: 9px UI, color muted ("2026-03-29 · 1 src")
3. Tag badge:
   - UNDERCOVERED: bg var(--di-damage-light), color var(--di-damage)
   - DISTRACTION: bg var(--di-distraction-light), color var(--di-distraction)
   - BALANCED: bg var(--di-balanced-bg), color var(--di-balanced-text)
   - Style: 9px UI, padding 1px 5px, border-radius 2px
4. A score: 10px UI, bold + colored if A > 50, muted otherwise
5. B score: 10px UI, bold + colored if B > 50, muted otherwise
```

**Score coloring logic:**
```javascript
// A score (constitutional damage)
color: event.scoreA > 50 ? 'var(--di-damage)' : 'var(--di-text-muted)'
fontWeight: event.scoreA > 50 ? 700 : 400

// B score (media hype)
color: event.scoreB > 50 ? 'var(--di-distraction)' : 'var(--di-text-muted)'
fontWeight: event.scoreB > 50 ? 700 : 400
```

### 4.9 Noise Floor Rows (simplified)

```
Same flex layout as index rows but:
- Title: 11px headline, color var(--di-text-tertiary)
- No score badges
- No tag badges
- Row number: color var(--di-text-quiet)
```

### 4.10 Subscribe CTA

```
Container: bg var(--di-bg-surface), border-radius 6px, padding 14px, text-align center
Header: "WEEKLY BRIEFING" — 9px UI, letter-spacing 2px, uppercase, muted
Body: 12px headline, secondary color
Input: bg white, border 1px solid var(--di-border-medium), border-radius 3px, 11px UI
Button: bg var(--di-accent-black), color var(--di-accent-white), border-radius 3px, 11px UI bold
```

### 4.11 Footer

```
Border-top: 1px solid var(--di-border-medium)
Padding-top: 8px
Text-align: center
Font: 10px UI, color muted
Link text: color var(--di-accent-black)
Content: "Free · Open source · Ad-free · Ko-fi · GitHub Sponsors"
```

---

## 5. Tailwind CSS Configuration

If the project uses Tailwind, extend the config:

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        di: {
          page: '#FAF8F4',
          surface: '#F0EDE6',
          card: '#FFFFFF',
          damage: '#8B2020',
          'damage-light': '#F0E0DC',
          distraction: '#3D5A80',
          'distraction-light': '#E8E0F0',
          smokescreen: '#8B4513',
          positive: '#2A5A2A',
          'positive-light': '#E0EDDF',
          balanced: '#EEEEEE',
          'balanced-text': '#888888',
          'border-light': '#EEEEEE',
          'border-med': '#DDDDDD',
          'border-heavy': '#1A1A1A',
          'text-primary': '#1A1A1A',
          'text-secondary': '#666666',
          'text-tertiary': '#888888',
          'text-muted': '#AAAAAA',
          'text-quiet': '#CCCCCC',
        }
      },
      fontFamily: {
        headline: ['Palatino', 'Palatino Linotype', 'Georgia', 'serif'],
        ui: ['Helvetica', 'Arial', 'sans-serif'],
      },
      letterSpacing: {
        'section': '2px',
        'label': '0.5px',
      },
      borderWidth: {
        '3': '3px',
      }
    }
  }
}
```

---

## 6. CSS Stylesheet (Global)

Add this to your global CSS file (e.g., `globals.css` or `app/globals.css`):

```css
/* ============================
   MAGAZINE THEME — GLOBAL CSS
   ============================ */

/* CSS Custom Properties */
:root {
  --di-bg-page: #FAF8F4;
  --di-bg-surface: #F0EDE6;
  --di-bg-card: #FFFFFF;
  --di-text-primary: #1A1A1A;
  --di-text-secondary: #666666;
  --di-text-tertiary: #888888;
  --di-text-muted: #AAAAAA;
  --di-text-quiet: #CCCCCC;
  --di-damage: #8B2020;
  --di-damage-light: #F0E0DC;
  --di-distraction: #3D5A80;
  --di-distraction-light: #E8E0F0;
  --di-smokescreen: #8B4513;
  --di-positive: #2A5A2A;
  --di-positive-light: #E0EDDF;
  --di-balanced-bg: #EEEEEE;
  --di-balanced-text: #888888;
  --di-border-light: #EEEEEE;
  --di-border-medium: #DDDDDD;
  --di-border-heavy: #1A1A1A;
  --di-font-headline: Palatino, 'Palatino Linotype', Georgia, serif;
  --di-font-ui: Helvetica, Arial, sans-serif;
}

/* Base */
body {
  background-color: var(--di-bg-page);
  color: var(--di-text-primary);
  font-family: var(--di-font-headline);
  line-height: 1.5;
}

/* ---- NAVIGATION ---- */
.di-nav {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  border-bottom: 1px solid var(--di-border-medium);
  padding-bottom: 10px;
  margin-bottom: 14px;
}

.di-nav-brand {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.di-nav-week-number {
  font-family: var(--di-font-headline);
  font-size: 36px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -2px;
}

.di-nav-title {
  font-family: var(--di-font-ui);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.3px;
}

.di-nav-links {
  display: flex;
  gap: 10px;
  font-family: var(--di-font-ui);
  font-size: 10px;
  color: var(--di-text-tertiary);
}

.di-nav-links a {
  color: var(--di-text-tertiary);
  text-decoration: none;
}

.di-nav-links a:hover {
  color: var(--di-text-primary);
}

.di-nav-links a.active {
  color: var(--di-text-primary);
  font-weight: 600;
}

/* ---- WEEK SELECTOR ---- */
.di-week-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  font-family: var(--di-font-ui);
}

.di-week-date {
  font-size: 12px;
  font-weight: 600;
}

.di-week-number-label {
  font-size: 10px;
  color: var(--di-text-tertiary);
}

.di-live-badge {
  font-size: 9px;
  padding: 2px 6px;
  border-radius: 3px;
  background: var(--di-positive);
  color: #FFFFFF;
  font-weight: 600;
  font-family: var(--di-font-ui);
}

.di-week-arrow {
  color: var(--di-text-tertiary);
  cursor: pointer;
  font-size: 13px;
  background: none;
  border: none;
  padding: 4px;
}

.di-week-arrow:hover {
  color: var(--di-text-primary);
}

/* ---- HERO: PULL QUOTE + SIDEBAR ---- */
.di-hero {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 16px;
  margin-bottom: 18px;
}

.di-pull-quote {
  font-family: var(--di-font-headline);
  font-size: 26px;
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.5px;
  margin-bottom: 10px;
}

.di-pull-quote em {
  color: var(--di-damage);
  font-style: italic;
}

.di-hero-body {
  font-size: 12px;
  color: var(--di-text-secondary);
  line-height: 1.5;
}

.di-sidebar-stats {
  border-left: 2px solid var(--di-border-heavy);
  padding-left: 12px;
}

.di-sidebar-header {
  font-family: var(--di-font-ui);
  font-size: 9px;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--di-text-tertiary);
  margin-bottom: 8px;
}

.di-stat-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 6px;
}

.di-stat-value {
  font-family: var(--di-font-ui);
  font-size: 16px;
  font-weight: 700;
}

.di-stat-label {
  font-family: var(--di-font-ui);
  font-size: 9px;
  color: var(--di-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-left: 4px;
}

.di-stat-delta {
  font-family: var(--di-font-ui);
  font-size: 10px;
}

.di-stat-delta.positive { color: var(--di-positive); }
.di-stat-delta.negative { color: var(--di-damage); }

/* ---- LOOK AT THIS PANEL ---- */
.di-look-panel {
  background: var(--di-bg-surface);
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 14px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.di-look-header {
  font-family: var(--di-font-ui);
  font-size: 8px;
  letter-spacing: 2px;
  text-transform: uppercase;
  font-weight: 600;
  margin-bottom: 3px;
}

.di-look-header.real { color: var(--di-positive); }
.di-look-header.distraction { color: var(--di-damage); }

.di-look-item {
  font-size: 11px;
  line-height: 1.4;
}

.di-look-item.secondary {
  color: var(--di-text-tertiary);
  margin-top: 2px;
}

/* ---- KEY STORIES (2-col under double rule) ---- */
.di-key-stories {
  border-top: 3px double var(--di-border-section);
  padding-top: 12px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 16px;
}

.di-story-header {
  font-family: var(--di-font-ui);
  font-size: 8px;
  letter-spacing: 2.5px;
  text-transform: uppercase;
  font-weight: 600;
  margin-bottom: 6px;
}

.di-story-header.damage { color: var(--di-damage); }
.di-story-header.distraction { color: var(--di-distraction); }

.di-story-title {
  font-family: var(--di-font-headline);
  font-size: 16px;
  font-weight: 700;
  line-height: 1.25;
  margin-bottom: 5px;
}

.di-story-body {
  font-size: 11px;
  color: var(--di-text-secondary);
  line-height: 1.4;
}

.di-story-scores {
  display: flex;
  gap: 6px;
  margin-top: 6px;
  font-family: var(--di-font-ui);
}

.di-score-active {
  font-size: 10px;
  font-weight: 700;
}

.di-score-active.damage { color: var(--di-damage); }
.di-score-active.distraction { color: var(--di-distraction); }

.di-score-inactive {
  font-size: 10px;
  color: var(--di-text-tertiary);
}

.di-source-count {
  font-size: 9px;
  color: var(--di-text-muted);
}

/* ---- SMOKESCREEN PAIR ---- */
.di-smokescreen-pair {
  background: var(--di-bg-surface);
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 12px;
}

.di-smokescreen-label {
  font-family: var(--di-font-ui);
  font-size: 9px;
  font-weight: 600;
  color: var(--di-smokescreen);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.di-smokescreen-event {
  font-weight: 700;
}

.di-smokescreen-obscuring {
  color: var(--di-damage);
  font-style: italic;
  font-size: 11px;
}

.di-si-badge {
  font-family: var(--di-font-ui);
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 3px;
  background: var(--di-text-primary);
  color: var(--di-bg-page);
}

/* ---- INDEX SECTION HEADERS ---- */
.di-section-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  border-bottom: 2px solid var(--di-border-heavy);
  padding-bottom: 4px;
  margin-bottom: 8px;
}

.di-section-title {
  font-family: var(--di-font-ui);
  font-size: 9px;
  letter-spacing: 2px;
  text-transform: uppercase;
  font-weight: 600;
}

.di-section-title.damage { color: var(--di-damage); }
.di-section-title.distraction { color: var(--di-distraction); }
.di-section-title.noise { color: var(--di-text-tertiary); }

/* ---- INDEX EVENT ROWS ---- */
.di-event-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 4px 0;
  border-bottom: 1px solid var(--di-border-light);
}

.di-event-number {
  font-family: var(--di-font-ui);
  font-size: 10px;
  color: var(--di-text-muted);
  min-width: 14px;
}

.di-event-content {
  flex: 1;
}

.di-event-title {
  font-family: var(--di-font-headline);
  font-size: 12px;
  line-height: 1.3;
}

.di-event-title.emphasis {
  font-weight: 600;
}

.di-event-meta {
  font-family: var(--di-font-ui);
  font-size: 9px;
  color: var(--di-text-muted);
}

/* Tag badges */
.di-tag {
  font-family: var(--di-font-ui);
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 2px;
  white-space: nowrap;
}

.di-tag.undercovered {
  background: var(--di-damage-light);
  color: var(--di-damage);
}

.di-tag.distraction {
  background: var(--di-distraction-light);
  color: var(--di-distraction);
}

.di-tag.balanced {
  background: var(--di-balanced-bg);
  color: var(--di-balanced-text);
}

.di-tag.mixed {
  background: var(--di-balanced-bg);
  color: var(--di-balanced-text);
}

/* Score display in rows */
.di-row-score {
  font-family: var(--di-font-ui);
  font-size: 10px;
  white-space: nowrap;
}

.di-row-score.highlight-a {
  font-weight: 700;
  color: var(--di-damage);
}

.di-row-score.highlight-b {
  font-weight: 700;
  color: var(--di-distraction);
}

.di-row-score.dim {
  color: var(--di-text-muted);
}

/* ---- NOISE FLOOR (simplified rows) ---- */
.di-noise-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 3px 0;
  border-bottom: 1px solid var(--di-border-light);
}

.di-noise-number {
  font-family: var(--di-font-ui);
  font-size: 10px;
  color: var(--di-text-quiet);
  min-width: 14px;
}

.di-noise-title {
  font-family: var(--di-font-headline);
  font-size: 11px;
  color: var(--di-text-tertiary);
}

/* ---- SUBSCRIBE CTA ---- */
.di-subscribe {
  background: var(--di-bg-surface);
  border-radius: 6px;
  padding: 14px;
  text-align: center;
  margin-bottom: 10px;
}

.di-subscribe-header {
  font-family: var(--di-font-ui);
  font-size: 9px;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--di-text-tertiary);
  margin-bottom: 4px;
}

.di-subscribe-body {
  font-size: 12px;
  color: var(--di-text-secondary);
  margin-bottom: 8px;
}

.di-subscribe-form {
  display: flex;
  gap: 6px;
  justify-content: center;
}

.di-subscribe-input {
  font-family: var(--di-font-ui);
  background: var(--di-bg-card);
  border: 1px solid var(--di-border-medium);
  border-radius: 3px;
  padding: 5px 12px;
  font-size: 11px;
  color: var(--di-text-muted);
  width: 200px;
}

.di-subscribe-button {
  font-family: var(--di-font-ui);
  background: var(--di-text-primary);
  color: var(--di-bg-page);
  border: none;
  border-radius: 3px;
  padding: 5px 14px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

.di-subscribe-button:hover {
  opacity: 0.85;
}

/* ---- FOOTER ---- */
.di-footer {
  text-align: center;
  padding-top: 8px;
  border-top: 1px solid var(--di-border-medium);
  font-family: var(--di-font-ui);
  font-size: 10px;
  color: var(--di-text-muted);
}

.di-footer a {
  color: var(--di-text-primary);
  text-decoration: none;
}

.di-footer a:hover {
  text-decoration: underline;
}

/* ---- RESPONSIVE ---- */
@media (max-width: 768px) {
  .di-hero {
    grid-template-columns: 1fr;
  }

  .di-sidebar-stats {
    border-left: none;
    border-top: 2px solid var(--di-border-heavy);
    padding-left: 0;
    padding-top: 12px;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .di-key-stories {
    grid-template-columns: 1fr;
  }

  .di-look-panel {
    grid-template-columns: 1fr;
  }

  .di-pull-quote {
    font-size: 22px;
  }

  .di-nav {
    flex-direction: column;
    gap: 8px;
  }

  .di-nav-links {
    flex-wrap: wrap;
    gap: 8px;
  }

  .di-event-row {
    flex-wrap: wrap;
  }

  .di-smokescreen-pair {
    font-size: 11px;
  }
}
```

---

## 7. Key Design Principles to Preserve

1. **The pull-quote IS the homepage.** It should be the first thing a visitor reads. It replaces the current stat cards as the visual anchor.

2. **Serif for content, sans-serif for chrome.** All event titles, body text, and editorial content use Palatino. All labels, badges, nav, meta, and numbers use Helvetica.

3. **Double-rule dividers** (`border-top: 3px double`) separate major sections. Single-rule (`1px solid`) separates rows. Two-pixel solid (`2px solid`) separates index section headers from their content.

4. **Score emphasis is conditional.** Only highlight a score (bold + color) when it exceeds 50. Low scores should be muted. This creates an instant visual scan — your eye is drawn to the numbers that matter.

5. **Section colors are semantic and consistent:**
   - Red/maroon (`#8B2020`) = constitutional damage, real threats, List A
   - Blue/navy (`#3D5A80`) = media hype, distractions, List B
   - Brown (`#8B4513`) = smokescreen-specific content
   - Green (`#2A5A2A`) = positive indicators, "look at this", live status

6. **Tag badges** use light-tinted backgrounds with matching text. Never use solid/filled badges.

7. **No rounded corners > 6px.** This is a newspaper, not an app. Subtle rounding only.

8. **No shadows, no gradients, no blur.** Visual hierarchy comes from typography, color, and borders only.

---

## 8. Pages to Update

Apply this theme to ALL pages:
- `/week/current` (dashboard) — primary focus, all components above
- `/week/[date]` (historical weeks) — same as dashboard
- `/undercovered` — use section header + event row components
- `/smokescreen` — use smokescreen pair component + event rows
- `/timeline` — use section headers, adapt for chronological layout
- `/topic` and `/topic/[slug]` — use event row components
- `/search` — use event row components for results
- `/event/[id]` — single event detail, use story card component expanded
- `/methodology` — editorial body text styling
- `/corrections` — editorial body text styling
- `/about` — editorial body text styling
- `/blog` and `/blog/[slug]` — editorial body text + pull-quote for featured
- `/contact` — form styling matching subscribe CTA
- `/support` — editorial body text + CTA buttons
- `/privacy` — editorial body text styling

---

## 9. Migration Checklist

- [ ] Add CSS custom properties to globals.css
- [ ] Update tailwind.config.js with extended theme (if using Tailwind)
- [ ] Update body/html base styles (background, font-family)
- [ ] Refactor navigation component to magazine layout
- [ ] Refactor week selector component
- [ ] Build pull-quote hero component (auto-generated from smokescreen data)
- [ ] Build sidebar stats component
- [ ] Refactor "Look at this" / "They want you to look at" panel
- [ ] Build key stories 2-column component with double-rule divider
- [ ] Build smokescreen pair inline component
- [ ] Refactor index section headers
- [ ] Refactor event row components with conditional score highlighting
- [ ] Simplify noise floor rows
- [ ] Update subscribe CTA styling
- [ ] Update footer styling
- [ ] Apply editorial body text styling to content pages
- [ ] Test responsive breakpoints (mobile: stack to single column)
- [ ] Remove all existing shadows, gradients, and rounded corners > 6px
- [ ] Verify all font stacks render correctly (Palatino fallback chain)
- [ ] Test with actual week data to verify pull-quote generation

# Claude Code Prompt: Apply Magazine Theme to distractionindex.org

Use the following prompt in Claude Code from the root of your distractionindex.org repository. Make sure `magazine-theme-guide.md` is in the repo root (or adjust the path).

---

## Prompt

```
Read the file magazine-theme-guide.md — it contains a complete design specification for rethemeing this Next.js site from its current look to a "Magazine Editorial" aesthetic.

Your job is to apply this theme across the entire site. Here is the approach:

1. FIRST, explore the codebase structure. Find:
   - The global CSS file (likely app/globals.css or styles/globals.css)
   - The tailwind.config.js (if Tailwind is used)
   - The layout component(s) (app/layout.tsx or similar)
   - The main dashboard page component (likely app/week/[date]/page.tsx or similar)
   - All shared UI components (nav, event rows, score badges, stat cards, etc.)

2. SECOND, add the CSS custom properties and base styles from the guide to the global CSS file. Do NOT remove existing CSS yet — add the new tokens first.

3. THIRD, update tailwind.config.js with the extended color/font/spacing tokens from section 5 of the guide.

4. FOURTH, refactor components one section at a time, following the exact specifications in the guide. Work in this order:
   a. Navigation bar (serif week number + sans-serif title + nav links)
   b. Week selector row
   c. Hero section — build the pull-quote component that auto-generates text from the smokescreen pair data. The template is: "While they talked about {distraction_event}, {damage_event_description}."
   d. Sidebar stats (inside the hero grid)
   e. "Look at this" / "They want you to look at" panel
   f. Key stories section (double-rule divider, 2-column grid)
   g. Smokescreen pair inline callout
   h. Index section headers (Real Damage, Distractions, Noise Floor)
   i. Event row components — implement conditional score highlighting (bold + color only when score > 50)
   j. Noise floor simplified rows
   k. Subscribe CTA
   l. Footer

5. FIFTH, apply the editorial body text styling (Palatino, secondary color, 13px, line-height 1.5) to content pages: /methodology, /corrections, /about, /blog, /contact, /support, /privacy.

6. SIXTH, remove any old CSS that is no longer referenced. Clean up unused Tailwind classes.

7. SEVENTH, test the responsive breakpoints. On mobile (< 768px):
   - Hero grid stacks to single column
   - Sidebar stats becomes a 3-column grid with top border instead of left border  
   - Key stories stacks to single column
   - Nav links wrap

Key design rules to follow strictly:
- Serif font (Palatino) for ALL content text (titles, body, quotes)
- Sans-serif font (Helvetica) for ALL UI chrome (labels, badges, nav, numbers, meta)
- No border-radius > 6px anywhere
- No box-shadows, no gradients, no blur effects
- Score colors are CONDITIONAL: bold + semantic color only when score > 50, muted otherwise
- Section dividers: 3px double for major sections, 2px solid for section headers, 1px solid for rows
- Background is #FAF8F4 (warm off-white), NOT pure white

Do each section as a separate commit so I can review incrementally. After each component change, verify it still builds with `npm run build` or `next build`.
```

---

## Tips for Running This

1. **Place the guide file** in your repo root:
   ```bash
   cp magazine-theme-guide.md ~/code/distractionindex/
   ```

2. **Run Claude Code** from the repo root:
   ```bash
   cd ~/code/distractionindex
   claude
   ```

3. **Paste the prompt above** and let it explore the codebase first.

4. **If the site uses a component library** (shadcn, Radix, etc.), tell Claude Code:
   ```
   This project uses [shadcn/ui | Radix | custom components]. 
   Adapt the magazine theme to work with the existing component abstractions 
   rather than replacing them entirely.
   ```

5. **If you want to preserve dark mode**, add:
   ```
   Also implement the dark mode color overrides from section 1 of the guide 
   using @media (prefers-color-scheme: dark) on the :root custom properties.
   ```

6. **For incremental review**, you can break it into phases:
   ```
   Phase 1: Just do steps 1-3 (tokens, config, base styles). Commit.
   Phase 2: Just do the navigation and hero. Commit.
   Phase 3: Just do the index sections. Commit.
   Phase 4: Everything else. Commit.
   ```

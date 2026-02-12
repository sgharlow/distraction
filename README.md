# The Distraction Index

A civic intelligence platform that publishes a **Weekly Distraction Index** — a frozen, immutable weekly snapshot scoring democratic damage vs. manufactured distractions during the Trump administration.

**Live at [distractionindex.org](https://distractionindex.org)**

## How It Works

Every political event gets **two scores**:

- **Score A (Constitutional Damage)** — Measures real governance harm using 7 weighted drivers, severity multipliers, and mechanism/scope modifiers.
- **Score B (Distraction/Hype)** — Measures media hype and strategic distraction using a two-layer model with intentionality testing.

Events are classified into:
- **List A** (Real Damage) — High A-score, dominance margin >= +10
- **List B** (Distractions) — High B-score, dominance margin <= -10
- **List C** (Noise) — Low-salience events failing the noise gate

The **Smokescreen Index** pairs high-B distractions with high-A damage events to surface when media spectacle may be covering for substantive harm.

## Weekly Editions

Weeks run Sunday-Saturday (ET). The current week updates live; past weeks freeze permanently. No data is ever changed after a week closes. Post-freeze corrections are append-only.

## Tech Stack

- **Frontend**: Next.js 16 + React 19 + Tailwind CSS v4
- **Database**: Supabase (PostgreSQL, `distraction` schema)
- **AI Scoring**: Claude API (Haiku for clustering, Sonnet for scoring)
- **News Sources**: GDELT + GNews + Google News RSS
- **Hosting**: Vercel with cron jobs for automated ingestion

## Development

```bash
npm install          # Install dependencies
npm run dev          # Start dev server at localhost:3000
npm run build        # Production build
npm run test         # Run 180 tests across 18 files
npm run lint         # ESLint
```

## Pipeline

The ingestion pipeline runs automatically every 4 hours:

1. **Ingest** (`:00`) — Fetches articles from 3 news sources, deduplicates, stores
2. **Process** (`:05`) — Clusters articles into events (Claude Haiku), scores events (Claude Sonnet), runs smokescreen pairing
3. **Freeze** (Sunday 5am UTC) — Freezes previous week, creates new week snapshot

## Documentation

- `CLAUDE.md` — Developer guidance for Claude Code
- `PLAN.md` — Implementation plan with phases and architecture
- `distraction-index-spec-v2.2.md` — Complete product specification (algorithms, data model, UI)

## Data

- 59+ weeks of historical data (Dec 29, 2024 - present)
- 1,500+ scored events
- 11,800+ ingested articles
- 210+ smokescreen pairs identified

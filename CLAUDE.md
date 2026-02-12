# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**The Distraction Index** (`distractionindex.org`) is a civic intelligence platform that publishes a Weekly Distraction Index — a frozen, immutable weekly snapshot scoring democratic damage vs. manufactured distractions during the Trump administration. The current specification is **v2.2**.

## Build & Development

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Run test suite (vitest)
npm run test:watch   # Run tests in watch mode
```

Test suite: 180 tests across 18 files using Vitest + React Testing Library. Tests cover scoring algorithms, classification logic, smokescreen pairing, week utilities, dedup, and UI components.

## Tech Stack

- **Frontend**: Next.js 16 (App Router) + React 19 + Tailwind CSS v4
- **Backend**: Next.js API routes + Vercel serverless functions
- **Database**: Supabase (PostgreSQL) with `distraction` schema (not `public`)
- **Auth**: Supabase Auth with `@supabase/ssr` (cookie-based sessions)
- **AI Scoring**: Claude API — Haiku 4.5 for clustering, Sonnet 4.5 for dual scoring
- **News Data**: GDELT (free) + GNews (free tier) + Google News RSS
- **Hosting**: Vercel (deployed at `distraction-two.vercel.app`, domain `distractionindex.org`)
- **Analytics**: Vercel Analytics

## Project Structure

```
src/
  app/                     # Next.js App Router pages
    page.tsx               # Redirects to /week/current
    layout.tsx             # Root layout (dark theme, Geist fonts, Analytics)
    loading.tsx            # Root loading skeleton
    error.tsx              # Root error boundary
    not-found.tsx          # Custom 404 page
    robots.ts              # Dynamic robots.txt
    sitemap.ts             # Dynamic sitemap from DB
    globals.css            # Design tokens and Tailwind theme
    week/[weekId]/         # Week dashboard (main view)
    event/[eventId]/       # Event detail page
    methodology/           # Algorithm transparency
    corrections/           # Post-freeze corrections
    search/                # Full-text search
    smokescreen/           # Smokescreen pair analysis
    undercovered/          # Undercovered high-damage events
    timeline/              # Cross-week timeline
    topic/                 # Topic index
    topic/[tag]/           # Events by topic tag
    admin/                 # Protected admin routes
      login/               # Login page + server actions
      events/              # Event list + editor
      weeks/               # Week list + editor
      queue/               # Scoring review queue
      pipeline/            # Pipeline monitor
    api/ingest/            # Cron: fetch + store articles (no Claude calls)
    api/process/           # Cron: cluster + score events (Claude API)
    api/freeze/            # Cron: weekly freeze job
    api/score/             # Score/re-score an event
    api/admin/             # Admin API routes (7 endpoints)
    api/v1/                # Public API (weeks, events)
  lib/
    types.ts               # TypeScript types matching DB schema
    weeks.ts               # Week utilities (Sunday-start, ET timezone)
    utils.ts               # General utilities
    claude.ts              # Claude API client (Haiku + Sonnet)
    admin-auth.ts          # Admin auth helper (getAdminUser)
    supabase/              # client.ts, server.ts, admin.ts
    scoring/               # A-score, B-score, classify, smokescreen, prompts, service
    ingestion/             # GDELT, GNews, Google News, clustering, dedup, pipeline
    data/                  # Data query functions (events, weeks, timeline, topics)
  components/              # 17 React components (EventCard, DualScore, TopNav, etc.)
supabase/migrations/       # SQL migrations (001-003)
scripts/                   # Backfill, data quality, manual operations
tests/                     # 18 test files (vitest)
```

## Pipeline Architecture (Split for Vercel 60s limit)

The pipeline is split into two separate cron jobs:

1. **`/api/ingest`** (every 4h at :00) — Fetch articles from all sources, dedup, store. No Claude API calls. Completes in ~2-15s.
2. **`/api/process`** (every 4h at :05) — Cluster unassigned articles into events (Claude Haiku), score new events (Claude Sonnet, max 2/run), run smokescreen pairing. Completes in ~30-55s.
3. **`/api/freeze`** (Sunday 5am UTC) — Freeze previous week, create new week snapshot.

## Core Data Model — Events ≠ Articles

**Events** (what happened) are scored independently from **Articles** (who covered it). Every event gets BOTH an A-score and B-score. List placement uses a dominance margin (±10).

## Dual Scoring System

- **Score A (Constitutional Damage)**: 7 weighted drivers (0-5) × severity multipliers × mechanism/scope modifiers. Formula in `src/lib/scoring/a-score.ts`.
- **Score B (Distraction/Hype)**: Layer 1 hype (55%) + Layer 2 strategic (45%, modulated by intentionality 0-15). Formula in `src/lib/scoring/b-score.ts`.
- **Classification**: `src/lib/scoring/classify.ts` — List A/B/C based on dominance margin.
- **Smokescreen Index**: `src/lib/scoring/smokescreen.ts` — pairs high-B with high-A events.
- **Prompts**: `src/lib/scoring/prompts.ts` — versioned Claude prompt templates.

## Database

Schema in `distraction` schema (not `public`). REST API needs `Content-Profile: distraction` and `Accept-Profile: distraction` headers.

Migrations in `supabase/migrations/`:
- `001_initial_schema.sql` — Tables: `weekly_snapshots`, `events`, `articles`, `score_changes`, `smokescreen_pairs`, `community_flags`, `pipeline_runs`
- `002_rls_policies.sql` — Public read, admin/service_role write
- `003_functions.sql` — `freeze_week()`, `ensure_current_week()`, `compute_week_stats()`, `auto_freeze_events()`, `create_week_snapshot()`

## Admin Interface

Protected by Supabase Auth (middleware at `src/middleware.ts`). Single admin account.

- **Auth**: Cookie-based sessions via `@supabase/ssr`. Admin API routes check `getUser()`, writes use `createAdminClient()` (service role, bypasses RLS).
- **Pages**: Dashboard, Events (list + editor), Weeks (list + editor), Review Queue, Pipeline Monitor.
- **Pipeline Monitor**: Shows ingest + process runs, "Ingest Now" and "Process Now" buttons.

## Weekly Snapshot Model

Weeks run **Sunday 00:00 ET → Saturday 23:59 ET**. First week: Dec 29, 2024. Current week is live; past weeks freeze permanently. Events freeze after 48h or at week close. Post-freeze corrections are append-only.

## Key Constants

- Week ID format: `"YYYY-MM-DD"` (the Sunday start date)
- All week logic: `src/lib/weeks.ts`
- Design tokens in `src/app/globals.css`: `--color-damage`, `--color-distraction`, `--color-noise`, `--color-mixed`, `--color-action`, etc.

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=        # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY=       # Supabase service role key (server-only)
ANTHROPIC_API_KEY=               # Claude API key
CRON_SECRET=                     # Vercel cron auth token
NEXT_PUBLIC_SITE_URL=            # Production URL (https://distraction-two.vercel.app)
```

## Reference Files

- `distraction-index-spec-v2.2.md` — Complete product specification (source of truth for algorithms)
- `distraction-index-v2.2.jsx` — Original prototype component (reference for UI/UX)
- `PLAN.md` — Full implementation plan with phases, architecture, and timeline

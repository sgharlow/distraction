# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**The Distraction Index** (`distractionindex.org`) is a civic intelligence platform that publishes a Weekly Distraction Index — a frozen, immutable weekly snapshot scoring democratic damage vs. manufactured distractions during the Trump administration. The current specification is **v2.2**.

## Build & Development

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
```

No test suite yet — planned for Phase 8.

## Tech Stack

- **Frontend**: Next.js 15 (App Router) + React 19 + Tailwind CSS v4
- **Backend**: Next.js API routes + Vercel serverless functions
- **Database**: Supabase (PostgreSQL + pgvector + Auth + Edge Functions)
- **AI Scoring**: Claude API — Haiku 4.5 for triage, Sonnet 4.5 for dual scoring
- **News Data**: GDELT (free) + GNews (free tier) + Google News RSS
- **Hosting**: Vercel
- **Cron**: Vercel Cron (ingest every 4h, weekly freeze Sunday)

## Project Structure

```
src/
  app/                     # Next.js App Router pages
    page.tsx               # Redirects to /week/current
    week/[weekId]/         # Week dashboard (main view)
    methodology/           # Algorithm transparency
    corrections/           # Post-freeze corrections
    admin/                 # Protected admin routes (Phase 6)
    api/ingest/            # Cron: news ingestion pipeline
    api/freeze/            # Cron: weekly freeze job
    api/score/             # Score/re-score an event
  lib/
    types.ts               # TypeScript types matching DB schema
    weeks.ts               # Week utilities (Sunday-start, ET timezone)
    supabase/              # client.ts, server.ts, admin.ts
    scoring/               # A-score, B-score, classify, smokescreen, prompts
    ingestion/             # GDELT, GNews, Google News, clustering (Phase 3)
  components/              # React components (Phase 5)
supabase/migrations/       # SQL migrations (run in order)
scripts/                   # Backfill and manual operations
```

## Core Data Model — Events ≠ Articles

**Events** (what happened) are scored independently from **Articles** (who covered it). Every event gets BOTH an A-score and B-score. List placement uses a dominance margin (±10).

## Dual Scoring System

- **Score A (Constitutional Damage)**: 7 weighted drivers (0-5) × severity multipliers × mechanism/scope modifiers. Formula in `src/lib/scoring/a-score.ts`.
- **Score B (Distraction/Hype)**: Layer 1 hype (55%) + Layer 2 strategic (45%, modulated by intentionality 0-15). Formula in `src/lib/scoring/b-score.ts`.
- **Classification**: `src/lib/scoring/classify.ts` — List A/B/C/Mixed based on dominance margin.
- **Smokescreen Index**: `src/lib/scoring/smokescreen.ts` — pairs high-B with high-A events.
- **Prompts**: `src/lib/scoring/prompts.ts` — versioned Claude prompt templates.

## Database

Schema defined in `supabase/migrations/`:
- `001_initial_schema.sql` — Tables: `weekly_snapshots`, `events`, `articles`, `score_changes`, `smokescreen_pairs`, `community_flags`, `pipeline_runs`
- `002_rls_policies.sql` — Public read, admin/service_role write
- `003_functions.sql` — `freeze_week()`, `ensure_current_week()`, `compute_week_stats()`, `auto_freeze_events()`, `create_week_snapshot()`

## Weekly Snapshot Model

Weeks run **Sunday 00:00 ET → Saturday 23:59 ET**. First week: Dec 29, 2024. Current week is live; past weeks freeze permanently. Events freeze after 48h or at week close. Post-freeze corrections are append-only.

## Key Constants

- Week ID format: `"YYYY-MM-DD"` (the Sunday start date)
- All week logic: `src/lib/weeks.ts`
- Design tokens in `src/app/globals.css`: `--color-damage`, `--color-distraction`, `--color-noise`, `--color-mixed`, `--color-action`, etc.

## Reference Files

- `distraction-index-spec-v2.2.md` — Complete product specification (source of truth for algorithms)
- `distraction-index-v2.2.jsx` — Original prototype component (reference for UI/UX)
- `PLAN.md` — Full implementation plan with phases, architecture, and timeline

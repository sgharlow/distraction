# The Distraction Index — Full Implementation Plan

## Executive Summary

Build and launch a fully automated civic intelligence platform that publishes weekly scored snapshots of democratic damage vs. manufactured distractions. The system ingests news automatically, uses Claude AI to identify events/score them, populates 58+ weeks of historical data from archives, and serves a public-facing website with a private admin interface for editorial overrides.

**Solo project. ~$200/mo total budget ($100 APIs + $100 infrastructure).**

> **STATUS (Feb 2026): ALL PHASES COMPLETE. Site live at [distractionindex.org](https://distractionindex.org).** 59 weeks backfilled, pipeline running, admin interface operational.

---

## 1. Architecture & Stack

### Why We're Simplifying the Spec

The v2.2 spec was designed for a team with a larger budget (Redis, Meilisearch, AWS Lambda, Cloudflare, Python workers). For a solo project at $200/mo, we consolidate:

| Spec Component | Actual Choice | Rationale |
|---|---|---|
| Next.js 14 + React | **Next.js 16 (App Router)** | Latest stable, RSC, server actions |
| Tailwind CSS | **Tailwind CSS v4** | Same as spec |
| PostgreSQL + pgvector | **Supabase (Postgres + pgvector)** | Managed, includes auth, edge functions, cron |
| Redis | **Skip → Vercel ISR + Supabase cache** | Not needed at this scale; ISR handles caching |
| Meilisearch | **Skip → Postgres full-text search** | `tsvector` + GIN indexes are sufficient for this data volume |
| Python workers | **Supabase Edge Functions + Vercel serverless** | No separate Python infra to manage |
| Claude API (Sonnet) | **Claude Haiku 4.5 (triage) + Sonnet 4.5 (scoring)** | Haiku for cheap first-pass; Sonnet for final dual-score |
| NewsAPI + multiple sources | **GDELT (free) + GNews (free tier) + Google News RSS** | Covers both historical and daily with $0 data cost |
| Vercel + AWS Lambda | **Vercel only** | Serverless functions + cron handle everything |
| Cloudflare | **Vercel's built-in DDoS + rate limiting** | Sufficient for launch; add Cloudflare later if needed |

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        VERCEL (Hosting)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │  Next.js App  │  │  API Routes  │  │  Cron Jobs (Vercel)   │ │
│  │  (Public UI)  │  │  /api/...    │  │  - Daily ingest (4h)  │ │
│  │  ISR/SSG      │  │  - Admin     │  │  - Weekly freeze      │ │
│  │  + RSC        │  │  - Scoring   │  │  - Score refresh      │ │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬───────────┘ │
└─────────┼─────────────────┼───────────────────────┼─────────────┘
          │                 │                       │
          ▼                 ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SUPABASE (Backend)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │  PostgreSQL   │  │  Auth        │  │  Edge Functions       │ │
│  │  + pgvector   │  │  (Admin SSO) │  │  (Heavy processing)   │ │
│  │  + FTS        │  │              │  │                       │ │
│  └──────────────┘  └──────────────┘  └───────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
          ▲                                         │
          │                                         ▼
┌─────────────────────┐                 ┌───────────────────────┐
│  EXTERNAL APIs       │                 │  Claude API            │
│  - GDELT (free)      │                 │  - Haiku: triage       │
│  - GNews (free tier) │                 │  - Sonnet: dual-score  │
│  - Google News RSS   │                 │  - Embeddings          │
└─────────────────────┘                 └───────────────────────┘
```

### Monthly Cost Estimate

| Service | Tier | Cost |
|---|---|---|
| Vercel | Pro | $20/mo |
| Supabase | Pro | $25/mo |
| Domain | .org | ~$12/yr → $1/mo |
| **Infrastructure subtotal** | | **~$46/mo** |
| Claude API (daily ops) | Haiku + Sonnet | ~$40-60/mo |
| GNews | Free tier (100 req/day) | $0 |
| GDELT | Free | $0 |
| **API subtotal** | | **~$40-60/mo** |
| **Total** | | **~$86-106/mo** |

Historical backfill is a one-time cost of ~$15-30 in Claude API usage.

---

## 2. Domain & Branding

Suggested domain names — verify and register at Porkbun or Cloudflare Registrar:

**Top picks (all likely available as of Feb 2026):**
- `distractionindex.org` — Matches the project name exactly. .org signals nonprofit/civic mission.
- `distractionindex.com` — .com version if you prefer broader appeal.
- `distractionwatch.org` — Clean, memorable, civic tone.

**Also likely available:**
- `thedistractionindex.com` / `thedistractionindex.org`
- `democracywatch.app`
- `distractionindex.app`
- `distractionreport.com` / `distractionreport.org`
- `democraticdistraction.com`
- `watchdemocracy.org`
- `distractionwatch.com`

**TAKEN — do not use:**
- `democracywatch.org` — Active site (Canadian org)
- `constitutionwatch.com` — Registered (parked)
- `constitutionwatch.org` — Active site

**Recommendation:** `distractionindex.org` — it matches the project name, .org carries civic credibility, and it appears available. Verify at [ICANN Lookup](https://lookup.icann.org/) before purchasing.

**Register early** — even before the site is built. ~$10-15/year on Porkbun or Cloudflare Registrar.

---

## 3. Project Structure

```
distraction/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Root layout with nav
│   │   ├── page.tsx                  # Redirects to /week/current
│   │   ├── week/
│   │   │   ├── [weekId]/
│   │   │   │   ├── page.tsx          # Week dashboard (3-column)
│   │   │   │   ├── list/[list]/page.tsx
│   │   │   │   ├── undercovered/page.tsx
│   │   │   │   ├── smokescreen/page.tsx
│   │   │   │   └── event/[eventId]/page.tsx
│   │   ├── timeline/page.tsx
│   │   ├── topic/[tag]/page.tsx
│   │   ├── methodology/page.tsx
│   │   ├── corrections/page.tsx
│   │   ├── admin/                    # Protected admin routes
│   │   │   ├── layout.tsx            # Auth guard
│   │   │   ├── page.tsx              # Admin dashboard
│   │   │   ├── events/page.tsx       # Event CRUD
│   │   │   ├── events/[id]/page.tsx  # Event editor
│   │   │   ├── weeks/page.tsx        # Week management
│   │   │   ├── scoring/page.tsx      # Score review queue
│   │   │   ├── pipeline/page.tsx     # Ingestion status
│   │   │   └── backfill/page.tsx     # Historical backfill controls
│   │   └── api/
│   │       ├── ingest/route.ts       # Triggered by cron: fetch + cluster
│   │       ├── score/route.ts        # Score an event via Claude
│   │       ├── freeze/route.ts       # Weekly freeze job
│   │       ├── admin/                # Admin CRUD endpoints
│   │       └── public/               # Public API (future)
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts             # Browser client
│   │   │   ├── server.ts             # Server client
│   │   │   └── admin.ts              # Service role client
│   │   ├── scoring/
│   │   │   ├── a-score.ts            # Constitutional Damage formula
│   │   │   ├── b-score.ts            # Distraction/Hype formula
│   │   │   ├── classify.ts           # List classification logic
│   │   │   ├── smokescreen.ts        # Smokescreen Index calculation
│   │   │   └── prompts.ts            # Claude prompt templates
│   │   ├── ingestion/
│   │   │   ├── gdelt.ts              # GDELT API client
│   │   │   ├── gnews.ts              # GNews API client
│   │   │   ├── google-news.ts        # Google News RSS parser
│   │   │   ├── cluster.ts            # Article → Event clustering
│   │   │   └── backfill.ts           # Historical backfill orchestrator
│   │   ├── weeks.ts                  # Week utilities (from prototype)
│   │   └── types.ts                  # TypeScript types matching DB schema
│   └── components/
│       ├── week-selector.tsx
│       ├── event-card.tsx
│       ├── dual-score.tsx
│       ├── score-breakdown.tsx
│       ├── smokescreen-map.tsx
│       ├── attention-budget.tsx
│       └── admin/                    # Admin-specific components
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql    # Tables from spec
│   │   ├── 002_rls_policies.sql      # Row-level security
│   │   ├── 003_functions.sql         # Freeze job, aggregation functions
│   │   └── 004_indexes.sql           # FTS + performance indexes
│   └── seed.sql                      # Optional seed data
├── scripts/
│   ├── backfill.ts                   # Run historical backfill
│   ├── freeze-week.ts                # Manual week freeze
│   └── score-event.ts                # Manual single-event scoring
├── vercel.json                       # Cron config
├── tailwind.config.ts
├── next.config.ts
├── package.json
├── .env.local                        # API keys (never committed)
└── CLAUDE.md
```

---

## 4. Implementation Phases

### Phase 0 — Project Scaffolding (Day 1-2) ✅ COMPLETE

**Goal:** Repo initialized, deployed to Vercel, Supabase connected, empty site live.

- [ ] Register domain
- [ ] `npx create-next-app@latest distraction --typescript --tailwind --app --src-dir`
- [ ] Install dependencies: `@supabase/supabase-js`, `@supabase/ssr`, `@anthropic-ai/sdk`, `rss-parser`, `date-fns`, `date-fns-tz`
- [ ] Create Supabase project (Pro plan, US East region for ET timezone alignment)
- [ ] Configure Supabase Auth (email/password for admin — just your account)
- [ ] Set up environment variables in `.env.local` and Vercel:
  ```
  NEXT_PUBLIC_SUPABASE_URL=
  NEXT_PUBLIC_SUPABASE_ANON_KEY=
  SUPABASE_SERVICE_ROLE_KEY=
  ANTHROPIC_API_KEY=
  GNEWS_API_KEY=
  CRON_SECRET=           # Vercel cron auth
  ```
- [ ] Deploy to Vercel, connect domain
- [ ] Verify empty site loads at domain

### Phase 1 — Database Schema (Day 2-3) ✅ COMPLETE

**Goal:** Full schema from spec deployed to Supabase with RLS policies.

Migration `001_initial_schema.sql`:
- `weekly_snapshots` table (exactly as spec Section 4)
- `events` table with dual scores, mechanism, scope, all fields
- `articles` table
- `score_changes` audit log
- `smokescreen_pairs` table
- `community_flags` table
- All indexes from spec (week-based queries)
- Full-text search index: `ALTER TABLE events ADD COLUMN fts tsvector GENERATED ALWAYS AS (to_tsvector('english', title || ' ' || summary)) STORED; CREATE INDEX idx_events_fts ON events USING GIN(fts);`

Migration `002_rls_policies.sql`:
- Public read access to all tables (no user accounts needed to view)
- Write access restricted to `service_role` (API routes use service key)
- Admin write access via authenticated user check

Migration `003_functions.sql`:
- `freeze_week(week_id TEXT)` — Postgres function that:
  1. Sets `weekly_snapshots.status = 'frozen'`, `frozen_at = now()`
  2. Freezes all unfrozen events in that week
  3. Computes and stores aggregate metrics
  4. Returns summary
- `ensure_current_week()` — Creates this week's snapshot if it doesn't exist
- `compute_week_stats(week_id TEXT)` — Recalculates aggregate stats for live week

### Phase 2 — Scoring Engine (Day 3-6) ✅ COMPLETE

**Goal:** Given an event description and source articles, produce dual A+B scores via Claude API.

This is the core intelligence of the system. Two separate scoring passes:

#### 2a. Event Identification Prompt (Haiku 4.5)

Input: A batch of article headlines + summaries from the same time window.
Output: Clustered events with preliminary classification.

```
System: You are a political event classifier for The Distraction Index.
Given a batch of recent US political news articles, identify distinct
EVENTS (not articles). Multiple articles about the same underlying
action = one event.

For each event, output JSON:
{
  "title": "...",
  "event_date": "YYYY-MM-DD",
  "summary": "2-3 sentence factual summary",
  "mechanism_of_harm": "policy_change|enforcement_action|...|null",
  "scope": "federal|multi_state|...",
  "affected_population": "narrow|moderate|broad",
  "actors": ["..."],
  "institution": "...",
  "topic_tags": ["..."],
  "preliminary_list": "A|B|C",
  "article_urls": ["...urls that cover this event..."]
}
```

#### 2b. Dual Scoring Prompt (Sonnet 4.5)

Input: An identified event with its summary, mechanism, scope, and source articles.
Output: Full A-score + B-score breakdown.

```
System: You are the scoring engine for The Distraction Index v2.2.
Score this political event on BOTH the Constitutional Damage scale (A)
and the Distraction/Hype scale (B). Follow the exact formulas below.

[Include full scoring rubric from spec sections 5 and 6]

Output JSON:
{
  "a_score": {
    "drivers": { "election": 0-5, "rule_of_law": 0-5, ... },
    "severity": { "durability": 0.8-1.3, "reversibility": 0.8-1.3, "precedent": 0.8-1.3 },
    "mechanism_modifier": 0.90-1.15,
    "scope_modifier": 0.90-1.10,
    "base": ...,
    "final": ...
  },
  "b_score": {
    "layer1": { "outrage_bait": 0-5, "meme_ability": 0-5, "novelty": 0-5, "media_friendliness": 0-5 },
    "layer2": { "mismatch": 0-5, "timing": 0-5, "narrative_pivot": 0-5, "pattern_match": 0-5 },
    "intentionality": { "indicators": [...], "total": 0-15 },
    "final": ...
  },
  "primary_list": "A|B|C",
  "is_mixed": true|false,
  "noise_flag": true|false,
  "noise_reason_codes": [],
  "confidence": 0.0-1.0,
  "score_rationale": "...",
  "action_item": "...",
  "factual_claims": [{"claim": "...", "source": "...", "verified": true|false}]
}
```

#### 2c. Smokescreen Pairing (runs after scoring)

After events in a week are scored, a separate pass identifies B→A pairings:
- Find all B-events with `intentionality_score >= 4`
- Find all A-events with `a_score >= 40`
- Check temporal overlap (within same week or ±1 day)
- Estimate displacement (MVP: Claude estimates 0-1 confidence; Phase 2: measured from article volume)
- Compute SI = `(B × A / 100) × (0.7 + 0.3 × displacement_confidence)`

#### Implementation Notes

- Store prompt templates in `src/lib/scoring/prompts.ts` — version them so scoring is reproducible
- Log every Claude API call to `score_changes` with the prompt version
- Retry failed API calls with exponential backoff (max 3 retries)
- Validate output JSON schema before storing — reject and re-prompt if malformed
- Cost per event: ~$0.005 Haiku triage + ~$0.02 Sonnet scoring = ~$0.025/event

### Phase 3 — News Ingestion Pipeline (Day 6-9) ✅ COMPLETE

**Goal:** Automated pipeline that fetches articles, clusters them into events, and queues for scoring.

#### 3a. Data Sources

**GDELT (Primary — free, comprehensive, historical)**
- Global Database of Events, Language, and Tone
- REST API: `https://api.gdeltproject.org/api/v2/doc/doc?query=...&format=json`
- Filter: `sourcelang:english domain:.com theme:TAX_FNCACT` (political/government themes)
- Returns: URLs, titles, tone scores, dates, source domains
- Rate limit: Generous, no key needed
- Historical: Full archive back to 2015+
- **Use for:** Both daily ingestion AND historical backfill

**GNews (Secondary — free tier, 100 req/day)**
- REST API with `apikey` param
- Search: `q=trump+administration+OR+executive+order+OR+DOJ&lang=en&country=us`
- Returns: Title, description, URL, source, published date
- Free tier: 100 requests/day, 10 articles/request
- **Use for:** Daily supplemental ingestion, catching stories GDELT may miss

**Google News RSS (Tertiary — free, no key)**
- Parse RSS feed: `https://news.google.com/rss/search?q=...&hl=en-US&gl=US&ceid=US:en`
- No rate limit documented, be respectful (~1 req/min)
- **Use for:** Additional signal, cross-referencing

#### 3b. Ingestion Flow (runs every 4 hours via Vercel Cron)

```
1. FETCH ARTICLES
   ├── GDELT: query last 6 hours of US political news
   ├── GNews: query latest articles (up to 10 queries = 100 articles)
   └── Google News RSS: parse feed for new items

2. DEDUPLICATE
   ├── URL exact match against existing articles table
   └── Headline similarity check (Levenshtein > 0.85 = skip)

3. CLUSTER INTO EVENTS (Claude Haiku)
   ├── Batch new articles (up to 50 at a time)
   ├── Send to Haiku with existing week's events for context
   ├── Haiku returns: new events OR assigns to existing events
   └── New events created with status "pending_score"

4. SCORE NEW EVENTS (Claude Sonnet)
   ├── For each new event: full dual-score prompt
   ├── Validate output schema
   ├── Store scores + components
   └── Run smokescreen pairing for the week

5. STORE
   ├── Insert articles → articles table
   ├── Insert/update events → events table
   ├── Log score changes → score_changes table
   ├── Recompute week stats → weekly_snapshots table
   └── Trigger ISR revalidation for affected week pages
```

#### 3c. Vercel Cron Configuration

```json
// vercel.json (ACTUAL — pipeline split into ingest + process)
{
  "crons": [
    {
      "path": "/api/ingest",
      "schedule": "0 */4 * * *"
    },
    {
      "path": "/api/process",
      "schedule": "5 */4 * * *"
    },
    {
      "path": "/api/freeze",
      "schedule": "0 5 * * 0"
    }
  ]
}
```

- Ingest: Every 4 hours at :00 — fetch + dedup + store articles only (no Claude calls, ~2-15s)
- Process: Every 4 hours at :05 — cluster + score + smokescreen pair (Claude API, ~30-55s)
- Freeze: Sunday 05:00 UTC

> **Note:** Pipeline was split into two phases because the monolithic version couldn't complete within Vercel's 60s function timeout. Each phase runs independently within its own 60s budget.

### Phase 4 — Historical Backfill (Day 9-14) ✅ COMPLETE

**Goal:** Populate all 58+ weeks from Jan 1, 2025 through the current week with AI-identified and AI-scored events.

This is a one-time batch job. It runs as a local script (not on Vercel) to avoid timeout limits.

#### 4a. Strategy

Process one week at a time, oldest first. For each week:

1. **Query GDELT archive** for that week's date range
   - Search terms: `trump OR "executive order" OR DOJ OR "white house" OR congress OR "supreme court"` filtered to US English sources
   - Pull top 200-500 articles per week by tone/relevance
2. **Query Google News archive** for the same date range (supplemental)
3. **Send article batch to Claude Haiku** — identify 10-25 distinct events
4. **Score each event with Claude Sonnet** — full dual A+B scoring
5. **Run smokescreen pairing** for the week
6. **Compute week aggregate stats**
7. **Mark week as frozen** (since it's historical)
8. **Sleep 5 seconds** between weeks to stay within rate limits

#### 4b. Backfill Script

```
scripts/backfill.ts

Usage: npx tsx scripts/backfill.ts [--start 2025-01-01] [--end 2026-02-08] [--week 2025-01-05]

Features:
- Resumable: tracks last completed week in a local state file
- Dry-run mode: shows what would be created without API calls
- Rate limiting: built-in delays between API calls
- Progress logging: week X/58, events found, cost estimate
- Error handling: retries failed weeks, logs errors, continues
```

#### 4c. Cost Estimate for Backfill

```
58 weeks × ~18 events/week = ~1,044 events
Per event: ~$0.025 (Haiku triage + Sonnet score)
Per week clustering: ~$0.01 (Haiku batch)
Total: ~1,044 × $0.025 + 58 × $0.01 = ~$26 + $0.58 = ~$27

Plus article fetching overhead: ~$3-5 in additional Haiku calls
Total estimated backfill cost: ~$30
```

#### 4d. Quality Control

After backfill completes:
- Spot-check 5-6 random weeks in the admin UI
- Check that well-known events are captured (Inauguration, major EOs, etc.)
- Verify scores are in reasonable ranges
- Verify smokescreen pairings make sense
- Can re-score individual events from admin if needed

### Phase 5 — Public Website (Day 10-18) ✅ COMPLETE

**Goal:** The full public-facing site matching the spec's wireframes.

Build in this order (each builds on the last):

#### 5a. Layout & Navigation (Day 10-11)
- Root layout with dark theme (matching prototype: `#050510` background)
- Top bar: title, nav tabs (Dashboard, Undercovered, Smokescreen, Methodology)
- Week selector component (◀/▶, calendar picker, quick links, keyboard nav)
- Status indicator (LIVE vs FROZEN)
- Mobile responsive at every step

#### 5b. Week Dashboard — Main View (Day 11-13)
- Three-column layout: List A (Real Damage), List B (Distractions), List C (Noise)
- Event cards with dual scores, attention budget, mechanism badges
- "LOOK AT THIS" / "THEY WANT YOU TO LOOK AT" narrative strips
- Week stats bar (event counts, averages, source count)
- Smokescreen alert banner (when SI > 50 in current week)
- Frozen week summary banner
- Empty state for weeks without data
- ISR with 5-minute revalidation for current week, static for frozen weeks

#### 5c. Event Detail Page (Day 13-15)
- Full score sheet ("Why This Score")
- A-score driver breakdown with bar charts
- B-score layer 1 + layer 2 breakdown
- Severity multipliers display
- Mechanism + scope badges
- Smokescreen connections (covers for / covered by)
- Score history timeline
- Action item ("If You Only Do One Thing")
- Source list
- Correction notices (if any)

#### 5d. Special Views (Day 15-17)
- **Undercovered**: Events with attention_budget < -30, sorted by severity
- **Smokescreen Map**: Visual B→A pairings with SI scores and displacement confidence
- **Methodology**: Full algorithmic transparency page (from spec section 5-8)
- **Corrections**: List of all post-freeze corrections across all weeks

#### 5e. Search & Cross-Week Views (Day 17-18)
- Full-text search across all events (Postgres FTS)
- Timeline view: week-over-week A/B score trends
- Topic pages: events tagged with same topic across weeks
- SEO: Open Graph tags, structured data, sitemap.xml

#### Styling Approach
- Tailwind CSS with a custom dark theme matching the prototype
- Design tokens: `damage-red (#DC2626)`, `distraction-amber (#D97706)`, `noise-gray (#6B7280)`, `mixed-purple (#818CF8)`, `action-green (#059669)`
- Mobile-first, single-column on small screens → three-column on desktop
- Minimal JS — use RSC where possible, client components only for interactivity (week selector, modals, search)

### Phase 6 — Admin Interface (Day 18-23) ✅ COMPLETE

**Goal:** Private admin UI for editorial control. Protected by Supabase Auth (your account only).

#### 6a. Auth Setup
- Supabase Auth with email/password (single admin account)
- Middleware in `src/middleware.ts` — protect all `/admin/*` routes
- No public registration — create your account directly in Supabase dashboard

#### 6b. Admin Dashboard
- Pipeline health: last ingest time, articles/events in queue, errors
- Current week summary: events pending review, low-confidence scores
- Quick actions: trigger manual ingest, re-score event, freeze week

#### 6c. Event Management
- **Event list**: Filterable by week, list, score range, confidence, frozen status
- **Event editor**:
  - Edit title, summary, action item
  - Override any score component (driver values, severity multipliers, etc.)
  - Recalculate derived scores after override
  - Change list classification manually
  - Add/remove articles from event
  - Add correction notice (for frozen events)
  - View full audit trail from score_changes
- **Bulk actions**: Re-score selected events, move to different list

#### 6d. Week Management
- List all weeks with status, event counts, aggregate stats
- Manual freeze/unfreeze (for live weeks)
- Edit weekly editorial summary
- Set editor's pick event
- Trigger aggregate recomputation

#### 6e. Scoring Queue
- Events with `confidence < 0.7` flagged for review
- Events with `is_mixed = true` flagged for list decision
- One-click approve / edit / re-score

#### 6f. Pipeline Monitor
- Last 50 ingestion runs with status, article count, new events
- Error log with retry button
- Manual "Ingest Now" button
- Backfill progress tracker (for initial historical load)

### Phase 7 — Daily Operations Pipeline (Day 23-26) ✅ COMPLETE

**Goal:** The system runs autonomously day-to-day with minimal intervention.

#### 7a. Every 4 Hours — Phase 1: Ingest (Vercel Cron → `/api/ingest`)

```
1. Authenticate cron request (CRON_SECRET header)
2. Clean up stale 'running' pipeline records (>2 min old)
3. Determine current live week (create if needed)
4. Fetch articles from GDELT + GNews + Google News RSS (all in parallel, 10s timeouts)
5. Deduplicate against existing articles
6. Store new articles in DB
7. Auto-freeze events older than 48h
8. Log run results to pipeline_runs table
```

#### 7a-2. Every 4 Hours + 5min — Phase 2: Process (Vercel Cron → `/api/process`)

```
1. Authenticate cron request (CRON_SECRET header)
2. Get unassigned articles (no event_id) for current week (max 50)
3. Cluster articles into events via Claude Haiku
4. Create new events, link articles
5. Score events via Claude Sonnet (max 2 per run, time-budgeted)
6. Run smokescreen pairing for current week
7. Recompute week aggregate stats
8. Log run results to pipeline_runs table
```

> **Architecture note:** Pipeline was split into two phases because the monolithic version exceeded Vercel's 60s function timeout. Ingest (no Claude calls) completes in ~2-15s. Process (Claude API) completes in ~30-55s.

#### 7b. Weekly Freeze (Vercel Cron → `/api/freeze`, Sunday ~midnight ET)

```
1. Get the week that just ended (previous Sunday-Saturday)
2. Call freeze_week() Postgres function:
   a. Set status = 'frozen', frozen_at = now()
   b. Freeze all unfrozen events
   c. Compute final aggregate metrics
   d. Generate weekly summary via Claude (optional — or write manually in admin)
3. Create new weekly_snapshot for the new week
4. Log freeze results
```

#### 7c. Event Auto-Freeze (checked during each ingest)

```
For each event in the current live week:
  If event.created_at + 48h < now() AND NOT event.score_frozen:
    Set score_frozen = true, frozen_at = now()
    Log to score_changes
```

#### 7d. Error Handling & Alerting

- All pipeline errors logged to a `pipeline_errors` table
- Admin dashboard shows error count badge
- If 3+ consecutive ingest failures: store a flag that shows warning in admin
- Manual retry available from admin UI
- Future: email/webhook alerts (keep simple for now)

### Phase 8 — Testing & Launch Prep (Day 26-30) ✅ COMPLETE

#### 8a. Testing Strategy

- **Unit tests** (Vitest): 180 tests across 18 files covering scoring formulas, week utilities, classification logic, date calculations, dedup, and UI components.

#### 8b. Pre-Launch Checklist

- [x] All 59 historical weeks populated and spot-checked (1,525+ events, 11,800+ articles)
- [x] Current week ingesting automatically every 4 hours (split pipeline: ingest + process)
- [x] Weekly freeze job configured (Sunday 5am UTC via Vercel Cron)
- [x] Admin interface functional: auth, event editor, week editor, review queue, pipeline monitor
- [x] Methodology page complete and matches actual algorithm
- [x] Mobile responsive on all views (hamburger nav, column stacking)
- [x] SEO basics: title tags, OG meta, dynamic sitemap, robots.txt
- [x] Error monitoring: Vercel Analytics integrated
- [x] Domain pointed and HTTPS working (distractionindex.org)
- [x] Favicon and branding (dark theme, design tokens)

#### 8c. Launch

- Soft launch: Feb 2026
- Public launch: pending

---

## 5. Data Flow Summary

### Daily (automated)

```
News Sources (GDELT/GNews/RSS)
       │
       ▼
  [Fetch Articles]  ← Vercel Cron every 4h
       │
       ▼
  [Deduplicate]
       │
       ▼
  [Cluster into Events]  ← Claude Haiku
       │
       ▼
  [Score Events]  ← Claude Sonnet (A + B dual score)
       │
       ▼
  [Smokescreen Pairing]  ← Algorithm + Claude
       │
       ▼
  [Store in Supabase]
       │
       ▼
  [Revalidate Pages]  ← Vercel ISR
       │
       ▼
  Public site updated
```

### Weekly (automated)

```
Saturday 23:59 ET
       │
       ▼
  [Freeze Week]  ← Vercel Cron
       │
       ├── Lock all events
       ├── Compute final aggregates
       ├── Generate summary (optional AI)
       └── Create new week snapshot
       │
       ▼
  New live week begins
```

### Editorial (manual, as-needed)

```
Admin reviews dashboard
       │
       ├── Low-confidence events → review & adjust scores
       ├── Mixed events → confirm list placement
       ├── Missing events → manually create + score
       ├── Score overrides → edit drivers/multipliers, auto-recalculate
       ├── Weekly summary → write editorial for frozen week
       └── Corrections → append notice to frozen events
```

---

## 6. Timeline Summary

| Days | Phase | Deliverable | Status |
|------|-------|------------|--------|
| 1-2 | **Phase 0**: Scaffolding | Repo, Vercel, Supabase, empty site live | ✅ |
| 2-3 | **Phase 1**: Database | Full schema deployed, RLS, functions | ✅ |
| 3-6 | **Phase 2**: Scoring Engine | Claude prompts, A+B scoring, smokescreen | ✅ |
| 6-9 | **Phase 3**: Ingestion Pipeline | GDELT/GNews/RSS fetch, clustering, queue | ✅ |
| 9-14 | **Phase 4**: Historical Backfill | 59 weeks populated, spot-checked | ✅ |
| 10-18 | **Phase 5**: Public Website | Full UI with 8 public pages + components | ✅ |
| 18-23 | **Phase 6**: Admin Interface | Event editor, score review, pipeline monitor | ✅ |
| 23-26 | **Phase 7**: Daily Operations | Split pipeline (ingest + process), crons, auto-freeze | ✅ |
| 26-30 | **Phase 8**: Testing & Launch | 180 tests, QA, soft launch | ✅ |

**All phases complete.** Site live at [distractionindex.org](https://distractionindex.org).

---

## 7. Key Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Claude scoring inconsistency | Events scored differently on re-run | Pin prompt versions; log all scores; never re-score frozen events |
| GDELT missing events | Gaps in coverage | Cross-reference GNews + Google News RSS; admin can manually add |
| Historical backfill quality | Bad scores in early weeks nobody checks | Spot-check 10% of weeks; build "re-score week" admin tool |
| API cost overrun | Exceed $100/mo API budget | Monitor usage daily; use Haiku aggressively; batch calls; cache |
| Vercel Cron timeout (60s on Pro) | Ingest doesn't finish | Process in chunks; use Supabase Edge Functions for heavy work |
| Supabase 8GB limit (Pro) | Database fills up | Monitor size; articles table is largest — prune old article content, keep URLs |
| Single point of failure (you) | Pipeline breaks while traveling | Build robust error handling; pipeline auto-recovers on next cron |

---

## 8. Future Enhancements (Post-Launch)

Not in scope for v1, but designed to be easy to add:

- **Public API** (`/api/v1/weeks`, `/api/v1/weeks/{week}/events`) — the data model supports this natively
- **Newsletter** — weekly "What Actually Mattered" email generated from frozen week data
- **Community flagging** — rate-limited suggestions from readers (live weeks only)
- **Cloudflare** — add as CDN/WAF if traffic demands it
- **Redis** — add for leaderboard caching if DB queries get slow
- **Mobile app** — the API-first design supports this
- **Donation/Patreon integration** — the spec's sustainability model

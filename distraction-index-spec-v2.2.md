# 🔍 The Distraction Index — v2.2
## Website Design & Scoring Algorithm Specification

**Concept**: A civic intelligence platform that publishes a **Weekly Distraction Index** — a frozen, immutable snapshot of each week's democratic damage, manufactured distractions, and political noise. Each week (Sunday–Saturday) gets its own scored edition, building a permanent historical record of the Trump administration's actions and the media's coverage of them. The current week updates live; past weeks are locked forever.

---

## 1. THE WEEKLY DISTRACTION INDEX

### 1.1 Core Concept

The site is organized around **calendar weeks**, not a rolling feed. Each week produces its own edition of The Distraction Index:

```
Week 1:   Dec 29, 2024 – Jan 4, 2025   (first available week)
Week 2:   Jan 5 – Jan 11, 2025
Week 3:   Jan 12 – Jan 18, 2025
...
Week 58:  Feb 2 – Feb 8, 2026          ← CURRENT WEEK (live, updating)
```

**Rules:**
- Weeks always run **Sunday 00:00 ET → Saturday 23:59 ET**
- The first available week contains **January 1, 2025** (starts Sun Dec 29, 2024)
- The **current week** is live and updates as events are scored throughout the week
- At the end of Saturday 23:59 ET, the current week **freezes permanently** — no further changes
- Past weeks are **immutable** — they are the permanent historical record
- The site always defaults to the **current week** on first load

### 1.2 Week Identification

Each week is identified by its **start date** (the Sunday):

```
week_id:     "2026-W06"              (ISO week-ish, but Sunday-start)
week_start:  "2026-02-02"           (Sunday)
week_end:    "2026-02-08"           (Saturday)
display:     "Feb 2 – Feb 8, 2026"
status:      "live" | "frozen"
```

### 1.3 Event-to-Week Assignment

Events belong to the week of their `event_date`. Articles belong to the week of their `published_at`. An event can only exist in one week.

**Edge cases:**
- If an event spans the week boundary (e.g., starts Friday, major development Monday), the **new development becomes a new event** in the new week with a `related_event_id` linking to the prior week's event
- Ongoing situations (e.g., "DOJ voter roll lawsuits" that persist for months) get new events only when **new material developments** occur — a new filing, a new ruling, a new state sued. The original event stays frozen in its original week.

### 1.4 Week-Level Aggregate Metrics

Each weekly snapshot includes computed aggregate stats:

```
Weekly Summary Stats:
  total_events:           23
  list_a_count:           8
  list_b_count:           6
  list_c_count:           9
  avg_a_score:            68.4
  avg_b_score:            71.2
  max_smokescreen_index:  94.4
  top_smokescreen_pair:   "Obama Video → Nationalize Elections"
  week_attention_budget:  avg(all attention_budgets)  — is the week distraction-heavy?
  total_sources:          147
  primary_doc_count:      12
```

### 1.5 What Replaces Temporal Decay

The v2.1 temporal decay model (`effective_score = base_score × e^(-λ × days)`) was designed for a rolling leaderboard. With weekly snapshots, it changes:

- **Within a week**: No temporal decay. All events from Sunday–Saturday are ranked equally by raw score. A Monday event and a Friday event compete on the same footing within that week.
- **Across weeks**: Each week is its own sealed unit. Past weeks don't "decay" — they're permanent history. The homepage always shows the current week.
- **The timeline/topic views** still show cross-week trends, but those are analytical views, not decay-based rankings.

This is simpler and more honest than exponential decay. The tradeoff: a massive Monday event won't decay by Friday. But that's actually correct — within a 7-day window, the relative importance of events shouldn't change. The weekly boundary does the work that decay was doing before.

---

## 2. CORE ARCHITECTURE: Events ≠ Articles

The foundational data model separates **Events** (what happened) from **Articles** (who covered it). This prevents the same underlying action from being scored 18 times when 18 outlets cover it.

**Every Event gets BOTH an A-score and a B-score.** List placement is determined by score dominance with a stability margin — but both scores are always visible.

---

## 3. LIST CLASSIFICATION LOGIC

### 3.1 Dominance Margin (prevents "bucket thrash")

```
D = A_score - B_score

List A:  A ≥ 25 AND D ≥ +10     (clear A-dominant)
List B:  B ≥ 25 AND D ≤ -10     (clear B-dominant)
Mixed:   Both ≥ 25 AND |D| < 10  (goes to higher-score list with MIXED badge)
Noise:   Passes Noise Gate       (Section 7)
Low-sal: A < 25 AND B < 25 AND NOT noise  (visible but never in Top 20)
```

### 3.2 Dual-Score Display

Every event card shows BOTH scores, dominant one emphasized:
```
┌──────────────────────────────────────────────────┐
│  Nationalize Elections Call                       │
│  🔴 A: 100.0  ·  🟡 B: 22.0                     │  ← Clear A
│                                                  │
│  Racist Obama AI Video                           │
│  🔴 A: 38.0   ·  🟡 B: 97.3                     │  ← Clear B, but A visible
│                                                  │
│  Armed Arrest of Don Lemon          ⚡ MIXED     │
│  🔴 A: 52.0   ·  🟡 B: 58.5                     │  ← Mixed badge
└──────────────────────────────────────────────────┘
```

### 3.3 Attention Budget (derived metric)

```
attention_budget = B_score - A_score

Large positive (+30 or more):  "Probable distraction"
Large negative (-30 or more):  "Undercovered damage"
Near zero with high scores:    "Mixed signal"
```

---

## 4. DATA MODEL

```sql
-- ═══════════════════════════════════════════════════
-- WEEKLY SNAPSHOTS (the primary organizing unit)
-- ═══════════════════════════════════════════════════
CREATE TABLE weekly_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    week_id TEXT UNIQUE NOT NULL,          -- '2026-W06'
    week_start DATE NOT NULL,              -- Sunday
    week_end DATE NOT NULL,                -- Saturday
    status TEXT NOT NULL DEFAULT 'live'     -- 'live' or 'frozen'
        CHECK (status IN ('live', 'frozen')),
    frozen_at TIMESTAMPTZ,                 -- When the week was sealed
    
    -- Aggregate metrics (computed at freeze, updated live for current week)
    total_events INT DEFAULT 0,
    list_a_count INT DEFAULT 0,
    list_b_count INT DEFAULT 0,
    list_c_count INT DEFAULT 0,
    avg_a_score FLOAT,
    avg_b_score FLOAT,
    max_smokescreen_index FLOAT,
    top_smokescreen_pair TEXT,             -- "Event B → Event A"
    week_attention_budget FLOAT,           -- Avg attention budget across all events
    total_sources INT DEFAULT 0,
    primary_doc_count INT DEFAULT 0,
    
    -- Weekly editorial summary (written by editors at freeze)
    weekly_summary TEXT,                   -- "What Actually Mattered This Week"
    editors_pick_event_id UUID,            -- The single most important event
    
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════
-- EVENTS (scoped to a week)
-- ═══════════════════════════════════════════════════
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    week_id TEXT NOT NULL REFERENCES weekly_snapshots(week_id),
    title TEXT NOT NULL,
    event_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    
    -- Cross-week linkage (for ongoing situations)
    related_event_id UUID REFERENCES events(id),  -- Prior week's event if continuation
    
    -- ── Actors & Context ──
    actors TEXT[],
    institution TEXT,
    topic_tags TEXT[],
    primary_docs TEXT[],
    
    -- ── Mechanism & Scope ──
    mechanism_of_harm TEXT CHECK (mechanism_of_harm IN (
        'policy_change', 'enforcement_action', 'personnel_capture',
        'resource_reallocation', 'election_admin_change', 'judicial_legal_action',
        'norm_erosion_only', 'information_operation'
    )),
    mechanism_secondary TEXT,
    scope TEXT CHECK (scope IN (
        'federal', 'multi_state', 'single_state', 'local', 'international'
    )),
    affected_population TEXT CHECK (affected_population IN (
        'narrow', 'moderate', 'broad'
    )),
    
    -- ── Summary Content ──
    summary TEXT NOT NULL,
    factual_claims JSONB,
    score_rationale TEXT,
    action_item TEXT,
    
    -- ── DUAL SCORES ──
    a_score FLOAT,
    a_components JSONB,
    a_severity_multiplier FLOAT DEFAULT 1.0,
    
    b_score FLOAT,
    b_layer1_hype JSONB,
    b_layer2_distraction JSONB,
    b_intentionality_score INT,
    
    -- ── Derived Metrics ──
    attention_budget FLOAT GENERATED ALWAYS AS (b_score - a_score) STORED,
    dominance_margin FLOAT GENERATED ALWAYS AS (a_score - b_score) STORED,
    
    -- ── Classification ──
    primary_list CHAR(1) CHECK (primary_list IN ('A', 'B', 'C')),
    is_mixed BOOLEAN DEFAULT FALSE,
    noise_flag BOOLEAN DEFAULT FALSE,
    noise_reason_codes TEXT[],
    
    -- ── Media Metrics ──
    article_count_24h INT DEFAULT 0,
    media_volume FLOAT,
    search_attention FLOAT,
    
    -- ── Confidence & Review ──
    confidence FLOAT,
    human_reviewed BOOLEAN DEFAULT FALSE,
    
    -- ── Versioning ──
    score_version INT DEFAULT 1,
    score_frozen BOOLEAN DEFAULT FALSE,
    frozen_at TIMESTAMPTZ,
    frozen_by TEXT,
    
    -- ── Search ──
    embedding vector(1536)
);

-- ═══════════════════════════════════════════════════
-- ARTICLES (linked to events)
-- ═══════════════════════════════════════════════════
CREATE TABLE articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id),
    week_id TEXT NOT NULL REFERENCES weekly_snapshots(week_id),
    
    url TEXT UNIQUE NOT NULL,
    publisher TEXT,
    published_at TIMESTAMPTZ NOT NULL,
    headline TEXT,
    
    source_type TEXT CHECK (source_type IN (
        'wire', 'national', 'regional', 'opinion', 'blog', 'primary_doc'
    )),
    is_independent BOOLEAN DEFAULT TRUE,
    publisher_reach TEXT CHECK (publisher_reach IN ('major', 'mid', 'niche')),
    stance TEXT,
    extracted_claims JSONB,
    
    ingested_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════
-- SCORE CHANGE LOG
-- ═══════════════════════════════════════════════════
CREATE TABLE score_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id),
    week_id TEXT NOT NULL REFERENCES weekly_snapshots(week_id),
    changed_at TIMESTAMPTZ DEFAULT now(),
    changed_by TEXT NOT NULL,
    change_type TEXT NOT NULL,
    old_a_score FLOAT,
    new_a_score FLOAT,
    old_b_score FLOAT,
    new_b_score FLOAT,
    old_list CHAR(1),
    new_list CHAR(1),
    reason TEXT NOT NULL,
    version_before INT,
    version_after INT
);

-- ═══════════════════════════════════════════════════
-- SMOKESCREEN PAIRS (scoped to weeks)
-- ═══════════════════════════════════════════════════
CREATE TABLE smokescreen_pairs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    week_id TEXT NOT NULL REFERENCES weekly_snapshots(week_id),
    distraction_event_id UUID REFERENCES events(id),
    damage_event_id UUID REFERENCES events(id),
    smokescreen_index FLOAT NOT NULL,
    time_delta_hours FLOAT,
    a_coverage_share_before FLOAT,
    a_coverage_share_after FLOAT,
    displacement_delta FLOAT,
    displacement_confidence FLOAT,
    evidence_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════
-- COMMUNITY FLAGS
-- ═══════════════════════════════════════════════════
CREATE TABLE community_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id),
    week_id TEXT NOT NULL,
    suggested_list CHAR(1),
    reason TEXT NOT NULL,
    source_evidence TEXT,
    upvotes INTEGER DEFAULT 0,
    flagged_by_ip_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════
-- INDEXES for week-based queries
-- ═══════════════════════════════════════════════════
CREATE INDEX idx_events_week ON events(week_id);
CREATE INDEX idx_events_week_list ON events(week_id, primary_list);
CREATE INDEX idx_articles_week ON articles(week_id);
CREATE INDEX idx_smokescreen_week ON smokescreen_pairs(week_id);
CREATE INDEX idx_weekly_snapshots_status ON weekly_snapshots(status);
```

---

## 5. SCORING MODEL A — Constitutional Damage Score (CDS)

**Goal:** Score *governance harm*, not "how bad the headline feels."

### 5.1 Seven Weighted Drivers (each scored 0-5)

| # | Driver | Weight | Description |
|---|--------|--------|-------------|
| 1 | **Election integrity & transfer of power** | 0.22 | Voter suppression, ballot seizures, election machinery control |
| 2 | **Rule of law / due process** | 0.18 | Weaponized prosecution, selective enforcement, pardon abuse |
| 3 | **Separation of powers / authoritarian consolidation** | 0.16 | Ignoring courts, Congress bypass, unitary executive overreach |
| 4 | **Civil rights / equal protection** | 0.14 | Censorship, retaliation, press intimidation |
| 5 | **Institutional capture** | 0.14 | Loyalist installs, agency purges, weaponization |
| 6 | **Corruption / self-dealing** | 0.10 | Emoluments, patronage, personal enrichment |
| 7 | **Violence / intimidation enabling** | 0.06 | Militia encouragement, chilling effects |

### 5.2 Severity Multipliers (each 0.8–1.3)

| Multiplier | Low (0.8) | Medium (1.0) | High (1.3) |
|-----------|-----------|-------------|------------|
| **Durability** | Temporary executive action | Multi-year effect | Structural/permanent |
| **Reversibility** | Easily reversed | Requires legislation | Constitutional amendment or irreversible |
| **Precedent-setting** | One-off | Normalizes a tactic | Reusable authoritarian playbook |

### 5.3 Mechanism & Scope Modifier

**Mechanism of harm:**
| Mechanism | Modifier |
|-----------|----------|
| `election_admin_change` | 1.15 |
| `judicial_legal_action` | 1.10 |
| `enforcement_action` | 1.10 |
| `personnel_capture` | 1.05 |
| `policy_change` | 1.05 |
| `resource_reallocation` | 1.00 |
| `information_operation` | 0.95 |
| `norm_erosion_only` | 0.90 |

**Scope:**
| Scope | Modifier |
|-------|----------|
| `federal` + `broad` | 1.10 |
| `multi_state` + `broad` | 1.05 |
| `multi_state` + `moderate` | 1.00 |
| `single_state` + any | 0.95 |
| `local` + any | 0.90 |

### 5.4 Formula

```
base_A = 100 × Σ(weight_i × driver_i / 5)
severity_mult = avg(durability, reversibility, precedent)
mechanism_mult = mechanism_modifier × scope_modifier
A_score = min(100, base_A × severity_mult × mechanism_mult)
```

---

## 6. SCORING MODEL B — Distraction / Hype Score (DS)

### 6.1 Two-Layer Architecture

**Layer 1: Intrinsic Hype Potential (55%)**
| Dimension | Description |
|-----------|-------------|
| Outrage-bait | Racial/identity provocation, insults |
| Meme-ability | Short clip, easy share, visual shock |
| Novelty spike | Genuine newness vs. rehash |
| Media friendliness | Easy panel-discussion, low research cost |

**Layer 2: Strategic Distraction Likelihood (45%, modulated by intentionality)**
| Dimension | Description |
|-----------|-------------|
| Media-volume mismatch | Coverage >> governance substance (see 6.3) |
| Timing overlap | Dropped within 72hrs of higher-A event |
| Narrative pivot | Redirects from accountability topics |
| Repeat pattern match | Historical playbook match |

### 6.2 Intentionality Test

```
Indicators (each 0-3, total /15):
1. Timed within 48hrs of a List A action?
2. Targets known emotional trigger?
3. Pattern used before?
4. Off-hours posting?
5. WH rapidly pivoted?

>= 8: Full Layer 2 weight (0.45)
4-7:  Reduced (0.25)
< 4:  Minimal (0.10)
```

### 6.3 Operationalizing Media-Volume Mismatch

```
media_volume = log(1 + article_count_24h × source_diversity × reach_weight)
governance_substance = has_primary_docs×3 + mechanism_weight + institution_weight
mismatch_ratio = clamp(0, 1, media_volume / (1 + governance_substance))
```

MVP: LLM estimates mismatch 0-5. Phase 2: formula above.

### 6.4 Formula

```
hype = avg(outrage_bait, meme_ability, novelty, media_friendliness) / 5
distraction = avg(mismatch, timing, narrative_pivot, pattern_match) / 5
intent_weight = {0.45 if intent>=8, 0.25 if 4-7, 0.10 if <4}
B_score = 100 × (0.55 × hype + intent_weight × distraction)
```

---

## 7. THE NOISE GATE (List C)

**Flag as Noise if ALL are true:**
- `A_score < 25`
- `mechanism_of_harm` is `norm_erosion_only` or NULL
- No institutional lever pulled
- Mostly status-seeking, grievance, or spectacle
- No credible downstream mechanism

**Noise reason codes:** `vanity`, `credit-grab`, `stale-reshare`, `spectacle`, `feud`

---

## 8. SMOKESCREEN INDEX (with Displacement Test)

### 8.1 Pairing Rules
- Events within same week (or ±1 day at week boundaries)
- B-event `intentionality_score >= 4`
- A-event `A_score >= 40`
- One B-event can pair with multiple A-events

### 8.2 Displacement Test

```
a_share_before = A's % of coverage in 12h before B spiked
a_share_after  = A's % of coverage in 12h after B spiked
displacement_delta = a_share_before - a_share_after

Confidence:
  delta > 0.20:  high (0.9)
  0.10-0.20:     medium (0.6)
  0.05-0.10:     low (0.3)
  < 0.05:        none (0.0) — DON'T pair
```

### 8.3 Formula

```
raw_SI = B_score × A_score / 100
SI = raw_SI × (0.7 + 0.3 × displacement_confidence)

🔴 SI > 50:  CRITICAL
🟡 SI 25-50: SIGNIFICANT
🟢 SI < 25:  LOW
```

---

## 9. WEEKLY LIFECYCLE & EDITORIAL WORKFLOW

### 9.1 Week Lifecycle

```
WEEK OPENS (Sunday 00:00 ET)
    │
    │  Status: "live"
    │  Events can be created, scored, updated
    │  Current week view updates in real-time
    │
    ├── Mon-Fri: Events accumulate, scores refine
    │   Individual events freeze after 48h (score_frozen)
    │   But the WEEK remains live for new events
    │
    ├── Saturday: Final day of the week
    │   Last chance to add events, adjust scores
    │
    ▼
WEEK CLOSES (Saturday 23:59 ET)
    │
    │  Automatic weekly freeze job runs:
    │  1. Set weekly_snapshots.status = 'frozen'
    │  2. Set weekly_snapshots.frozen_at = now()
    │  3. Compute & store aggregate metrics
    │  4. Freeze any still-unfrozen events
    │  5. Generate weekly summary stats
    │
    ▼
FROZEN (permanent)
    │  No changes to events, scores, or rankings
    │  The weekly edition is the historical record
    │  Corrections: visible correction notice only, original scores preserved
    │
    ▼
NEW WEEK OPENS (next Sunday 00:00 ET)
    │  Fresh weekly_snapshot created
    │  Ongoing situations get NEW events with related_event_id links
```

### 9.2 Event Score Lifecycle (within a live week)

```
INITIAL (auto-scored by LLM)
    ├─ confidence >= 0.7 → Published to live week
    ├─ confidence < 0.7  → Review queue
    ▼
LIVE (updatable for 48h or until week freezes, whichever comes first)
    ▼
EVENT FROZEN (48h elapsed OR week closed)
    Post-freeze changes: correction notice only, logged
```

### 9.3 Human-Readable Score Sheet

Every event includes a "Why This Score" section:
```
SCORE SHEET — Nationalize Elections Call
────────────────────────────────────────
Week: Feb 2–8, 2026 (Week 58)
Mechanism: election_admin_change (1.15×)
Scope: multi_state + broad (1.05×)
Evidence: 14 sources, 3 primary docs

Why A = 100: Coordinated assault on Article I Elections Clause...
Why B = 22: This IS the substance, not a distraction...
Attention Budget: -78 📉 SEVERELY UNDERCOVERED
```

### 9.4 Post-Freeze Corrections

If a material error is discovered after a week freezes:
- A **correction notice** is appended to the event (visible in UI)
- The **original scores are preserved** — they represent what was assessed that week
- The correction notes what would change and why
- This mirrors how newspapers handle corrections: the record stands, with a note

---

## 10. SOURCE CREDIBILITY

### 10.1 Publishing Thresholds

| Level | Requirement |
|-------|-------------|
| Minimum | ≥ 2 independent sources (OR primary doc exists) |
| Standard | ≥ 3 independent sources including 1 wire service |
| High confidence | ≥ 5 sources OR primary doc + 2 independent |

### 10.2 Source Quality Scoring

```
source_quality = Σ(wire×3 + primary_doc×4 + national×2 + regional×1 + opinion×0.5) / count
source_modifier = clamp(0.8, 1.2, 0.7 + source_quality × 0.1)
```

Display ideological spread as an indicator. Gate publishing on **independence + credibility**, not ideology.

---

## 11. DATA PIPELINE & AUTOMATION

### 11.1 Data Sources

| Source | Method | Purpose |
|--------|--------|---------|
| NewsAPI / GNews | REST API | Article aggregation |
| Truth Social RSS/scraper | Web scrape | Presidential post timing |
| Congressional Record | API | Legislation, votes, EOs |
| PACER / CourtListener | API | Lawsuits, court orders |
| Media Cloud | API | Media saturation metrics |
| Google Trends | API | Public attention measurement |
| Manual "Submit Link" | Web form | Community-sourced |

### 11.2 Multi-Signal Clustering

**Phase 1 (MVP):** Manual event creation. Articles linked manually.

**Phase 2 (Automated):**
```
Stage 1: Embed headline + lead paragraph; cosine > 0.75 → candidate
Stage 2: Re-rank: shared entities, shared doc URLs, time proximity, key phrases
Stage 3: Merge if entity_overlap > 0.6 AND time < 48h; shared doc → always merge
```

### 11.3 Weekly Processing Pipeline

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  News Ingestion  │───▶│  Assign to Week  │───▶│  Cluster into   │
│  (15min cycle)   │    │  (by event_date) │    │  Events         │
└─────────────────┘    └──────────────────┘    └────────┬────────┘
                                                        │
                       ┌──────────────────┐    ┌────────▼────────┐
                       │  Human Review    │◀───│  LLM Scorer     │
                       │  (conf < 0.7)    │    │  Dual A+B +     │
                       └──────────────────┘    │  mechanism/scope │
                                                └────────┬────────┘
                                                         │
                       ┌──────────────────┐    ┌─────────▼────────┐
                       │  Saturday 23:59  │◀───│  Live Week View  │
                       │  FREEZE JOB      │    │  (real-time)     │
                       │  - Lock all data  │    └──────────────────┘
                       │  - Compute aggs   │
                       │  - Archive        │
                       └──────────────────┘
```

---

## 12. WEBSITE ARCHITECTURE

### 12.1 Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | Next.js 14 + React | SSR, ISR |
| Styling | Tailwind CSS | Design system |
| Backend | Next.js API routes + Python workers | Unified + ML |
| Database | PostgreSQL + pgvector | Relational + vector |
| Cache | Redis | Leaderboards, rate limiting |
| AI | Claude API (Sonnet) | Classification |
| Search | Meilisearch | Full-text search |
| Hosting | Vercel + AWS Lambda | Scalable |
| CDN/Security | Cloudflare | DDoS, WAF |

### 12.2 URL Structure (week-aware)

All primary views are scoped to a week. The `{week}` parameter is the week start date or `current`:

```
/                                → Redirect to /week/current
/week/current                    → Current week dashboard (live, updating)
/week/2026-02-02                 → Week of Feb 2-8, 2026 (frozen if past)
/week/{week}/list/a              → Full List A for that week
/week/{week}/list/b              → Full List B for that week
/week/{week}/list/c              → Full List C for that week
/week/{week}/undercovered        → Undercovered high-damage events that week
/week/{week}/smokescreen         → Smokescreen map for that week
/week/{week}/event/{id}          → Event detail (score sheet, audit, action item)
/week/{week}/event/{id}/history  → Score change history

Cross-week views (not scoped to a single week):
/timeline                        → All weeks, chronological A/B overlay
/topic/{tag}                     → Topic trendlines across weeks
/methodology                     → Algorithm transparency
/corrections                     → All corrections across all weeks
/api/v1/weeks                    → List all weekly snapshots
/api/v1/weeks/{week}/events      → Events for a specific week
```

### 12.3 Week Selector UI

A persistent navigation element at the top of every page:

```
┌──────────────────────────────────────────────────────────────────┐
│  ◀ prev   ██ Week of Feb 2 – 8, 2026 ██   next ▶    📅         │
│           Week 58 · 🟢 LIVE (updates until Sat 11:59pm)         │
│                                                                  │
│  Quick: [This Week] [Last Week] [Jan 20-25, 2025: Inauguration] │
│         [Pick a date...]                                         │
└──────────────────────────────────────────────────────────────────┘
```

**Selector behaviors:**
- **◀ / ▶ arrows**: Navigate one week back/forward
- **📅 calendar icon**: Opens a date picker; selecting any date loads that date's week
- **Quick links**: Current week, last week, and notable bookmarked weeks (Inauguration, etc.)
- **Status indicator**: 🟢 LIVE for current week, 🔒 FROZEN for past weeks
- **Keyboard shortcuts**: `←` / `→` for week navigation

### 12.4 Homepage Layout (week-scoped)

```
┌──────────────────────────────────────────────────────────────────┐
│  ◀  ██ Week of Feb 2 – 8, 2026 ██  ▶  📅   🟢 LIVE             │
├──────────────────────────────────────────────────────────────────┤
│  ⚠️ SMOKESCREEN ALERT                                            │
│  "Obama Video (B:97) displacing Nationalize Elections (A:100)"   │
│  Smokescreen Index: 94.4 🔴 · Displacement: HIGH                │
├──────────────────────────────────────────────────────────────────┤
│  WEEK STATS: 23 events · A avg: 68.4 · B avg: 71.2 · 147 src  │
├──────────────────────────────────────────────────────────────────┤
│  👁️ LOOK AT THIS              │  🎭 THEY WANT YOU TO LOOK AT    │
│  (Top 5 List A)               │  (Top 5 List B)                 │
├───────────────────────────────┴─────────────────────────────────┤
│  ┌── 🔴 REAL DAMAGE ──┬── 🟡 DISTRACTIONS ──┬── ⚪ NOISE ─────┐ │
│  │  Top 20 by A_score  │  Top 20 by B_score  │  Top 20 volume │ │
│  │  For THIS WEEK      │  For THIS WEEK      │  For THIS WEEK │ │
│  └─────────────────────┴─────────────────────┴────────────────┘ │
│  Filters: institution │ topic │ mechanism │ date-within-week    │
└──────────────────────────────────────────────────────────────────┘
```

### 12.5 Frozen Week View

Past weeks show the same layout but with a frozen header and optional weekly editorial summary:

```
┌──────────────────────────────────────────────────────────────────┐
│  ◀  ██ Week of Jan 20 – 25, 2025 ██  ▶  📅   🔒 FROZEN         │
├──────────────────────────────────────────────────────────────────┤
│  📜 WHAT ACTUALLY MATTERED — INAUGURATION WEEK                   │
│  "The first week of the Trump administration saw 8 List A events│
│  with an average CDS of 72.3, dominated by executive orders     │
│  targeting immigration, DOJ independence, and Schedule F..."     │
│  — Editorial summary, frozen Jan 25, 2025                       │
├──────────────────────────────────────────────────────────────────┤
│  [Same 3-column layout, all data frozen]                        │
└──────────────────────────────────────────────────────────────────┘
```

---

## 13. LEGAL & OPERATIONAL HARDENING

### 13.1 Evidence Standard
"Scores are editorial assessments based on documented evidence. Factual claims require sourcing. Primary documents prioritized. Scores reflect governance impact assessment, not legal conclusions."

### 13.2 Correction Policy
- Post-freeze corrections: visible notice appended, original scores preserved
- Material corrections (>10pt change or list change) get a correction notice
- `/corrections` page lists all corrections across all weeks

### 13.3 Community Moderation
- Rate limiting (10 flags/day per IP hash)
- Brigading detection (>50 flags/hr → hold for review)
- Community flags are suggestions, not votes
- Flags only accepted during live weeks

### 13.4 Security
- Editor pseudonyms in public audit trail
- WAF + bot mitigation (Cloudflare)
- Regular backups + mirror capability
- No user accounts required to view

---

## 14. MONETIZATION & SUSTAINABILITY

| Revenue Stream | Notes |
|---------------|-------|
| **Donations** | Primary — Patreon/Open Collective |
| **API Access** | 100 calls/day free; paid tiers |
| **Newsletter** | Weekly "What Actually Mattered" digest (auto-generated from frozen week) |
| **Data Licensing** | Academic/research institutions |
| **No Ads** | Credibility requires ad-free |

---

## 15. IMPLEMENTATION PHASES

### Phase 1 — MVP (4-6 weeks)
- Manual event creation + Claude API dual-scoring
- Weekly snapshot model with week selector
- 3-column dashboard scoped to selected week
- Event detail with score sheet + rationale
- Mechanism/scope on every event
- Week freezes at Saturday 23:59 ET
- Current week = live; past weeks = immutable
- Methodology page
- Basic Smokescreen Index

### Phase 2 — Automation (6-10 weeks)
- Automated news ingestion + clustering
- Real-time scoring within live week
- Automated media volume metrics
- Displacement test with measured coverage
- Community flagging (live weeks only)
- Topic pages with cross-week trendlines
- Weekly summary auto-generation
- Attention Budget + /undercovered views

### Phase 3 — Scale (10-16 weeks)
- Public API (week-scoped endpoints)
- Newsletter automation from frozen week data
- Historical week comparison views
- Notable weeks bookmarking
- Mobile app
- Advanced clustering
- Researcher dashboard with week-range export

---

## 16. ACADEMIC REFERENCES

- "Distracting from the Epstein files? Media attention and short-run shifts in Trump's Truth Social posts" (arXiv:2511.11532)
- TIME: "Trump's Obama Video Was a Diversion, Not an Accident"

---

## CHANGELOG

### v2.1 → v2.2 Changes

| Change | Rationale |
|--------|-----------|
| **Weekly Distraction Index** as core organizing unit | Each week gets its own frozen, immutable edition. Builds permanent historical record. |
| **Week selector UI** with ◀/▶, calendar picker, quick links | Easy navigation from current week to any past week back to Jan 1, 2025 |
| **Sunday–Saturday calendar weeks** | Consistent 7-day windows, aligned with news cycles |
| **Current week = live; past weeks = frozen forever** | Once Saturday ends, the weekly edition is the permanent record |
| **`weekly_snapshots` table** with aggregate metrics | Week-level stats: event counts, avg scores, top smokescreen, weekly summary |
| **Week-scoped URLs** (`/week/{date}/...`) | All primary views scoped to a week; cross-week views for trends |
| **Temporal decay removed** | Replaced by weekly snapshotting. Within a week, all events ranked by raw score. |
| **Weekly freeze job** | Automatic Saturday 23:59 ET process: freeze data, compute aggregates, archive |
| **Cross-week event linking** (`related_event_id`) | Ongoing situations create new events each week with back-links |
| **Post-freeze corrections** as append-only notices | Original scores preserved; corrections noted separately (newspaper model) |
| **Weekly editorial summary** | "What Actually Mattered" written at freeze time |
| **Notable weeks bookmarking** | Quick links to Inauguration week, major event weeks |

### Prior Changes (v1 → v2 → v2.1)

| Version | Key Changes |
|---------|-------------|
| v2 | Event/Article separation, dual A+B scoring, 7 A-drivers, severity multipliers, two-layer B-score, noise gate, "If you only do one thing", topic pages |
| v2.1 | Dominance margin + Mixed badge, mechanism-of-harm + scope, formalized media-volume mismatch, displacement test, multi-signal clustering, score freeze + versioning + audit trail, independence + credibility gating, score rationale, legal hardening, attention budget + undercovered |

---

*The Distraction Index: a weekly civic intelligence report that helps Americans see through manufactured outrage and focus on the actions that actually threaten democratic institutions. Every week, preserved forever.*

# Item 11: DEV Community (dev.to) Article

**Submit at:** https://dev.to/new
**Account:** Sign up free via GitHub

---

## Article Title
Building a Transparent AI Pipeline: 59 Weeks of Automated Political Scoring with Claude API

## Tags
`opensource` `ai` `civictech` `nextjs`

## Cover Image
Use the OG image from distractionindex.org or a screenshot of the dual-axis dashboard

---

## Article Body (Markdown)

```markdown
I've been running an automated AI pipeline for over a year that ingests news articles, clusters them into political events, and scores each event on two independent axes. Here's how it works, what I learned, and why I made everything transparent.

## The Problem

Political events have two dimensions that are rarely measured together:
1. **How much institutional damage** does this cause? (democratic health)
2. **How much media attention** does it get? (distraction economics)

When these are wildly mismatched — high damage, low attention — something important is being missed. I built [The Distraction Index](https://distractionindex.org) to detect these gaps automatically.

## Architecture Overview

```
News Sources (GDELT + GNews + Google News RSS)
    ↓ every 4 hours
Ingestion Pipeline (/api/ingest)
    ↓ dedup + store
Clustering (Claude Haiku) → group articles into events
    ↓
Dual-Axis Scoring (Claude Sonnet) → Score A + Score B
    ↓
Weekly Freeze → immutable snapshot
```

**Tech stack:** Next.js 16 (App Router), Supabase (PostgreSQL), Claude API, Vercel

### Why Two Models?

Cost optimization was critical. Running everything through Sonnet would cost ~$300/month. Instead:

- **Claude Haiku** handles article clustering (~$0.25/1M tokens) — it groups articles by topic similarity
- **Claude Sonnet** handles scoring (~$3/1M tokens) — it evaluates institutional impact using structured prompts

Result: **~$30/month** for a production pipeline processing articles every 4 hours.

## The Dual Scoring System

### Score A: Constitutional Damage (0-100)

Seven weighted governance drivers, each scored 0-5:

| Driver | Weight | What it measures |
|--------|--------|-----------------|
| Judicial Independence | 0.18 | Court stacking, ruling defiance |
| Press Freedom | 0.15 | Journalist targeting, access restrictions |
| Voting Rights | 0.15 | Disenfranchisement, election interference |
| Environmental Policy | 0.12 | Regulatory rollbacks, enforcement gaps |
| Civil Liberties | 0.15 | Due process, privacy, free assembly |
| International Norms | 0.10 | Treaty violations, alliance damage |
| Fiscal Governance | 0.15 | Budget manipulation, oversight bypass |

Multiplied by severity modifiers (durability × reversibility × precedent) and mechanism/scope modifiers.

### Score B: Distraction/Hype (0-100)

Two-layer model:
- **Layer 1 (55%):** Raw media hype — volume, social amplification, cross-platform spread, emotional framing, celebrity involvement
- **Layer 2 (45%):** Strategic manipulation indicators — timing relative to damage events, coordinated messaging, deflection patterns

Layer 2 is modulated by an intentionality score (0-15). Low intentionality → Layer 2 weight drops to 10%.

### Classification

Events are classified by dominance margin:
- **Damage** (List A): Score A exceeds Score B by ≥10 points
- **Distraction** (List B): Score B exceeds Score A by ≥10 points
- **Noise** (List C): Neither dominates

## The Smokescreen Index

The most interesting feature: automatic pairing of high-distraction events with concurrent high-damage events.

When a B-dominant event (media spectacle) co-occurs with an A-dominant event (institutional harm) that received less coverage, the system flags it as a potential smokescreen.

**210+ pairs identified** across 59 weeks.

## Radical Transparency

Every scoring formula, weight, and AI prompt is published at [/methodology](https://distractionindex.org/methodology). This was a deliberate design choice — if you're scoring political events, your methodology must be auditable.

Key transparency features:
- **Immutable weekly snapshots** — once a week freezes, scores cannot be silently changed
- **Append-only corrections** — post-freeze corrections are timestamped and linked to the original
- **Published prompts** — the exact Claude prompts used for scoring are documented
- **Open source** — [full codebase on GitHub](https://github.com/sgharlow/distraction)

## What I Learned

### 1. Publishing your prompts is terrifying

When your prompt templates are public, anyone can argue with your framing. That's the point — but it requires thick skin and a willingness to iterate.

### 2. Immutability prevents model drift

Without frozen snapshots, you can't tell if score changes come from real-world changes or model updates. Immutability is essential for longitudinal analysis.

### 3. The two-axis approach reveals patterns

Single-dimension scoring (left/right, reliable/unreliable) misses the key insight: damage and distraction are independent variables. Some events are both. Some are neither.

### 4. Cost optimization matters for indie projects

The Haiku-for-clustering, Sonnet-for-scoring split keeps costs at ~$30/month. Without this, the project wouldn't be sustainable as a solo effort.

## The Numbers

After 59 weeks:
- **1,500+** scored events
- **11,800+** ingested articles
- **210+** smokescreen pairs
- **288** tests passing
- **1,071** pages indexed

## Try It

- **Live site:** [distractionindex.org](https://distractionindex.org)
- **Methodology:** [distractionindex.org/methodology](https://distractionindex.org/methodology)
- **Source code:** [github.com/sgharlow/distraction](https://github.com/sgharlow/distraction)

I'd love feedback on the scoring methodology. What would you weight differently? What blind spots do you see?
```

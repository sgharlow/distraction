# Distraction Index Growth Engine — Design Spec

> Date: 2026-03-16
> Author: Steve Harlow + Claude
> Status: Approved

## Goal
Build automated systems that turn each weekly data freeze into 8+ pieces of indexed, distributed content with zero human intervention. Drive organic traffic to distractionindex.org through SEO and content multiplication.

## Success Criteria (30-day)
- 500+ weekly visitors to distractionindex.org
- 59+ blog posts indexed in Google (one per frozen week)
- 100+ total followers/subscribers across platforms
- Automated weekly content cascade running without intervention

---

## Phase 1: SEO Foundation (One-Time Setup)

### 1A. Blog Route + Auto-Generated Posts
- **New route:** `/blog` (list) and `/blog/[slug]` (detail)
- **New DB table:** `blog_posts` (slug, title, body_markdown, week_id, published_at, meta_description, keywords)
- **Auto-generation:** After freeze, Claude Haiku generates 800-1200 word narrative from week data
- **JSON-LD:** `BlogPosting` schema on every blog page
- **Internal links:** Each post links to `/week/[id]` and referenced `/event/[id]` pages
- **SEO:** Each post targets long-tail keywords naturally derived from event titles

### 1B. Structured Data Completion
- Week pages: `Dataset` schema
- Topic pages: `CollectionPage` schema
- About page: `Organization` schema
- Blog pages: `BlogPosting` schema (covered in 1A)

### 1C. RSS Feed
- **Route:** `/feed.xml` — Atom feed from blog posts + weekly reports
- Enables automatic syndication and is required for Google News publisher registration

### 1D. Directory Submissions Script
- Node.js script that submits to civic tech directories using pre-drafted `marketing/` content
- Targets: AlternativeTo, Product Hunt, CivicTech directories, Dev.to, Hashnode
- Run once, generates permanent backlinks

### 1E. Backlog Generation
- Script that retroactively generates blog posts for all 59 frozen weeks
- Uses Claude Haiku (~$0.02/post = ~$1.20 total)
- Run once to create instant content library

---

## Phase 2: Automated Content Multiplication

### 2A. Freeze-Triggered Content Cascade
Enhance `/api/freeze` to trigger after successful freeze:
1. Auto-generate blog post (Claude Haiku)
2. Auto-publish Substack issue (Substack API or Playwright)
3. Queue social posts (weekly summary thread for all 4 platforms)
4. Update RSS feed (automatic via dynamic route)
5. Send email to DB subscribers (Resend API)
6. Ping Google to re-index sitemap

### 2B. Event-Driven Alerts
Enhance `/api/process` — after scoring, check for a_score > 80:
- Auto-post alert to Bluesky + Mastodon (API-based, works with lid closed)
- Template: "ALERT: [Event] scored [X]/100 for constitutional damage → [link]"
- Rate-limited to max 2 alerts per process cycle

### 2C. Automated Substack Publishing
- Script or API integration to publish weekly Substack from freeze data
- Uses same blog post content, formatted for email
- Triggered by freeze cascade

### 2D. Content Recycling for Daily Posts
Expand `content-variants.ts` with:
- Historical comparisons ("This week last year...")
- Evergreen stats from 59+ weeks of data
- Smokescreen pair archive spotlights
- Top 10 lists from cumulative data

---

## Architecture

```
Weekly Freeze (Sunday 5am UTC)
    │
    ├─→ freeze_week() in DB
    ├─→ generate_blog_post() → blog_posts table
    ├─→ publish_substack() → Substack API
    ├─→ queue_social_posts() → scheduler posts
    ├─→ send_subscriber_email() → Resend API
    └─→ ping_google_sitemap()

Process Cycle (every 4h)
    │
    ├─→ score events normally
    └─→ check for a_score > 80
         └─→ post_alert() → Bluesky + Mastodon API

Daily Scheduler (3x/day)
    │
    └─→ expanded content variants
         ├─→ Current week data
         ├─→ Historical comparisons
         ├─→ Evergreen stats
         └─→ Archive spotlights
```

## Implementation Order
1. Blog route + DB table (foundation for everything)
2. Backlog generation script (59 posts, immediate SEO value)
3. RSS feed (syndication + Google News)
4. Structured data completion (SEO boost)
5. Freeze cascade enhancement (ongoing automation)
6. Event-driven alerts (real-time engagement)
7. Content recycling variants (daily post quality)
8. Directory submissions (backlinks)

## Cost
- Claude Haiku for blog generation: ~$0.02/post, ~$1/month ongoing
- Total ongoing: ~$1/month (just API calls)
- One-time backlog: ~$1.20 for 59 posts

## Constraints
- No changes to existing API contracts
- No changes to Supabase schema migrations (use new migration)
- Blog posts stored in DB, not markdown files (dynamic, queryable)
- All automation must work unattended (no Playwright for critical paths)

# Item 3: Reddit Posts — 7 Tailored Submissions

---

## 1. r/dataisbeautiful

**Title:** [OC] 59 Weeks of U.S. Political Events Scored on Two Axes: Democratic Damage vs. Media Distraction

**Body:**
I've been building a scoring system that rates every major political event on two independent dimensions:

- **Score A (0-100):** Constitutional damage — weighted across 7 drivers (judicial independence, press freedom, voting rights, etc.)
- **Score B (0-100):** Distraction/hype — media amplification vs. strategic manipulation

The weekly data is at https://distractionindex.org. Each event gets both scores, then gets classified as Damage (A >> B), Distraction (B >> A), or Noise.

The most interesting part is the "Smokescreen Index" — it pairs high-distraction events with concurrent high-damage events that were undercovered. 210+ pairs identified across 59 weeks.

Methodology is fully transparent: https://distractionindex.org/methodology

Data source: GDELT + GNews + Google News RSS. AI scoring via Claude Haiku (clustering) and Sonnet (dual-axis scoring).

**Flair:** [OC]

---

## 2. r/OpenSource

**Title:** I built an open-source civic intelligence platform that scores political events on dual axes (damage vs. distraction)

**Body:**
**Repo:** https://github.com/sgharlow/distraction
**Live:** https://distractionindex.org

The Distraction Index is an open-source civic tech platform that publishes weekly scored snapshots of U.S. political events. Each event is scored on two independent axes — constitutional damage (A-score) and media distraction (B-score).

**Tech stack:**
- Next.js 16 + React 19 + Tailwind CSS v4
- Supabase (PostgreSQL)
- Claude API (Haiku for article clustering, Sonnet for dual-axis scoring)
- GDELT + GNews + Google News RSS for data ingestion
- Vercel hosting with automated cron pipeline

**Key features:**
- 59+ weeks of immutable historical data
- Full algorithmic transparency (/methodology page)
- Smokescreen detection (pairing distractions with undercovered damage)
- 220 tests, automated ingestion every 4 hours
- Frozen weeks are permanently immutable

Would love contributors, especially on the scoring methodology and data visualization side. Issues and PRs welcome.

---

## 3. r/civictech

**Title:** The Distraction Index: A transparent, algorithmically-scored weekly report on democratic damage vs. manufactured distractions

**Body:**
I've been working on a civic intelligence project for the past year and wanted to share it with this community.

**The Distraction Index** (https://distractionindex.org) publishes weekly frozen snapshots scoring every major U.S. political event on two dimensions — constitutional damage and media distraction. The goal is to help citizens distinguish between events causing real institutional harm and events engineered to dominate attention.

What makes it different from media bias charts:
- It scores **events**, not sources
- It uses **dual-axis** scoring (damage AND distraction independently)
- Every formula, weight, and driver is documented publicly
- Weeks are **immutably frozen** with append-only corrections
- It detects **smokescreen pairs** (when high-distraction events mask concurrent damage)

59 weeks of data, 1,500+ scored events, fully open source.

I'd love to hear from others working in civic tech about how this could be more useful — for educators, researchers, or citizens.

---

## 4. r/technology

**Title:** I built an AI that scores political events on two axes — democratic damage vs. media distraction — and publishes transparent weekly reports

**Body:**
The Distraction Index (https://distractionindex.org) uses AI to score every major political event on:

1. **Constitutional damage** (7 weighted drivers with severity multipliers)
2. **Media distraction** (two-layer model: hype metrics + strategic framing)

The pipeline ingests articles from 3 sources every 4 hours, clusters them into events using Claude Haiku, then scores each event using Claude Sonnet with a structured scoring prompt.

The scoring methodology is fully transparent — every weight, formula, and prompt is documented at /methodology.

59 weeks of immutable data. 1,500+ events. Open source.

The most interesting feature is the "Smokescreen Index" which automatically pairs high-distraction events with concurrent high-damage events that received less coverage.

---

## 5. r/Keep_Track

**Title:** The Distraction Index: 59 weeks of scored political events — tracking democratic damage vs. manufactured distractions

**Body:**
I've been building a tool that aligns with what this community does — tracking political actions and their consequences.

**The Distraction Index** (https://distractionindex.org) scores every major political event weekly on two axes:
- **Damage score:** Weighted assessment of harm to democratic institutions
- **Distraction score:** How much media hype vs. strategic manipulation an event generates

Each week is frozen permanently and becomes an immutable historical record. Post-freeze corrections are append-only and timestamped — nothing is silently changed.

Key pages:
- **/smokescreen** — When media spectacle masks real harm
- **/undercovered** — High-damage events with low media attention
- **/timeline** — Cross-week trends

59 weeks of data from Dec 2024 to present. 1,500+ scored events.

---

## 6. r/neutralpolitics

**Title:** Seeking feedback on a dual-axis scoring methodology for political events (democratic damage vs. media distraction)

**Body:**
I've been working on a project that attempts to score political events on two independent axes:

**Score A (Constitutional Damage)** measures institutional harm using 7 weighted drivers: judicial independence (weight 0.20), press freedom (0.15), voting rights (0.15), LGBTQ+ protections (0.10), reproductive rights (0.10), environmental harm (0.15), economic fairness (0.15). Each driver is scored 0-5, then severity multipliers (durability, reversibility, precedent) are applied.

**Score B (Distraction/Hype)** uses a two-layer model. Layer 1 (55% weight) measures raw media hype. Layer 2 (45%) measures strategic framing, modulated by an intentionality score (0-15).

The full methodology is at https://distractionindex.org/methodology.

**My question for this community:** What weaknesses do you see in this methodology? Are the driver weights reasonable? What am I missing?

I'm especially interested in critique from people across the political spectrum — the goal is transparent measurement, not advocacy.

---

## 7. r/datasets

**Title:** Dataset: 59 Weeks of Dual-Scored U.S. Political Events (Constitutional Damage + Media Distraction)

**Body:**
I'm sharing access to a structured dataset of U.S. political events scored weekly on two independent axes:

- **Score A (Constitutional Damage):** 0-100, based on 7 weighted drivers with severity multipliers
- **Score B (Distraction/Hype):** 0-100, two-layer model (media hype + strategic manipulation)

**Dataset includes:**
- 1,500+ scored events (Dec 2024 — present)
- 11,800+ ingested articles linked to events
- 210+ smokescreen pairs (distraction-damage correlations)
- Weekly aggregate statistics
- Full scoring breakdown per event

**Access via API:**
- `GET /api/v1/weeks` — All weekly snapshots
- `GET /api/v1/events?week=YYYY-MM-DD` — Events for a specific week

**Live explorer:** https://distractionindex.org

The scoring methodology is fully documented at /methodology. Data is frozen weekly and immutable.

Potential research uses: media framing analysis, agenda-setting studies, attention economics, democratic backsliding measurement.

Open source: https://github.com/sgharlow/distraction

---

## Posting Strategy

1. Post to r/dataisbeautiful first (highest visibility, include a visualization)
2. r/Keep_Track second (most aligned audience)
3. r/technology third (broad tech audience)
4. Space remaining posts 24-48 hours apart to avoid Reddit spam filters
5. Engage with every comment — Reddit rewards responsiveness

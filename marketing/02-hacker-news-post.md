# Item 2: Hacker News "Show HN" Post

## Submission URL
https://news.ycombinator.com/submit

## Title (max 80 chars)
Show HN: The Distraction Index – AI-scored weekly civic intelligence reports

## URL
https://distractionindex.org

## Text (paste into the text field — HN allows title+url OR title+text, not both. Use URL mode.)

Post this as a **top-level comment** immediately after submitting:

---

I built The Distraction Index — a weekly civic intelligence report that scores every major political event on two independent axes:

**Score A (Constitutional Damage):** 7 weighted drivers measuring actual harm to democratic institutions — judicial independence, press freedom, voting rights, etc. Each driver scored 0-5 with severity multipliers for durability and reversibility.

**Score B (Distraction/Hype):** Two-layer model measuring media amplification vs. strategic manipulation. Layer 1 captures raw hype volume; Layer 2 measures deliberate framing, modulated by an intentionality score (0-15).

Events are classified by dominance margin into Damage (A >> B), Distraction (B >> A), or Noise. A "Smokescreen Index" pairs high-distraction events with concurrent high-damage events that received less coverage.

The data:
- 59+ weeks of immutable historical snapshots (Dec 2024 — present)
- 1,500+ scored events, 11,800+ ingested articles
- 210+ identified smokescreen pairs
- Full algorithmic transparency at /methodology

Tech: Next.js 16, Supabase, Claude Haiku (article clustering) + Sonnet (dual-axis scoring), GDELT + GNews + Google News RSS for ingestion. Pipeline processes articles every 4 hours. Weeks freeze permanently every Sunday.

Key design decisions:
- Events and articles are modeled separately — what happened vs. who covered it
- Frozen weeks are immutable. Post-freeze corrections are append-only and timestamped
- All scoring formulas, weights, and prompts are documented publicly
- Open source: https://github.com/sgharlow/distraction

I'd love feedback on the scoring methodology and the dual-axis approach. What would you want scored differently?

---

## Best Posting Time
Tuesday-Thursday, 8:00-10:00 AM ET (peak HN traffic)

## Engagement Tips
- Respond to every comment in the first 2 hours
- If someone critiques the methodology, engage substantively — HN rewards transparency
- Don't be defensive about the political lens — emphasize algorithmic transparency

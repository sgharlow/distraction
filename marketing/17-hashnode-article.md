# Item 17: Hashnode Article

**Submit at:** https://hashnode.com/onboard (create blog, then publish)
**Account:** Free signup via GitHub

---

## Article Title
Why I Publish My AI Prompts: Lessons from 59 Weeks of Transparent Political Scoring

## Subtitle
Building trust in automated analysis by making everything auditable

## Tags
`ai` `transparency` `civic-tech` `open-source`

---

## Article Body (Markdown)

```markdown
When I tell people that my project publishes its AI prompts publicly, the first reaction is usually: "Won't people game it?"

Maybe. But after running [The Distraction Index](https://distractionindex.org) for 59 weeks — an automated system that scores political events using Claude's API — I've become convinced that prompt transparency isn't just nice-to-have. It's essential.

## What The Distraction Index Does

Every 4 hours, my pipeline:
1. Ingests articles from 3 news sources (GDELT, GNews, Google News RSS)
2. Clusters them into events using Claude Haiku
3. Scores each event on **two independent axes** using Claude Sonnet:
   - **Score A**: Constitutional damage (how much institutional harm)
   - **Score B**: Distraction/hype (how much media attention)
4. Publishes immutable weekly snapshots

When damage is high but attention is low, the system flags it. When a flashy distraction coincides with undercovered damage, it detects a "smokescreen."

## Why Transparency Matters

If you're scoring political events with AI, you have a credibility problem from day one. Everyone will assume your tool has a political bias. The only defense is making everything auditable:

### 1. Published Scoring Formulas
Every weight, every driver, every modifier is documented at [/methodology](https://distractionindex.org/methodology). If you disagree with a weight, you can point to the exact number and argue for a different one.

### 2. Published Prompt Templates
The exact prompts sent to Claude are documented. You can see how events are framed for the AI, what context is provided, and what structure is expected in the response.

### 3. Immutable Snapshots
Once a week freezes (every Sunday), scores are permanent. I cannot silently adjust historical data to fit a narrative. Post-freeze corrections exist but are append-only and timestamped.

### 4. Open Source
The [entire codebase](https://github.com/sgharlow/distraction) is public. You can fork it, run your own instance with different weights, or audit the pipeline end-to-end.

## The Challenges

### Can bad actors game a transparent system?

Theoretically, yes. If you know the exact prompt, you could craft events that score artificially high or low. In practice:
- The system scores **events**, not submissions — it ingests from news sources, not user input
- Scoring uses multiple independent metrics that are hard to simultaneously manipulate
- The dual-axis approach means gaming one score doesn't help with the other

### Model drift is real

Claude's behavior changes between model versions. Without immutable snapshots, you can't distinguish real-world changes from model changes. This is why immutability isn't optional — it's a core architectural requirement.

### Cost pressure vs. quality

Running everything through Sonnet would be ideal but expensive (~$300/month). The solution: use **Haiku for clustering** (high-volume, lower-stakes) and **Sonnet only for scoring** (lower-volume, higher-stakes). Total: ~$30/month.

## The Results

After 59 weeks:
- 1,500+ events scored
- 210+ smokescreen pairs detected
- Certain damage categories (judicial independence, environmental policy) are **systematically undercovered** regardless of which distraction dominates the news

## What I'd Do Differently

1. **Version your prompts from day one.** I started versioning too late and lost the ability to compare early vs. late prompt performance.
2. **Build the correction system before you need it.** Post-freeze corrections were an afterthought; they should have been in the original design.
3. **Invest in tests early.** 288 tests now, but the first 20 weeks had minimal coverage. Scoring algorithms need rigorous testing.

## Try It

- **Live:** [distractionindex.org](https://distractionindex.org)
- **Methodology:** [distractionindex.org/methodology](https://distractionindex.org/methodology)
- **GitHub:** [github.com/sgharlow/distraction](https://github.com/sgharlow/distraction)

What's your approach to AI transparency? I'd love to hear how others are handling this.
```

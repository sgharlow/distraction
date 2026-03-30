# How the Distraction Index Scoring Algorithm Works

**Target:** Blog post for distractionindex.org/blog or Dev.to cross-post
**SEO Target:** "political distraction tracker", "democracy scoring algorithm"
**Word Count Target:** 1,000-1,400 words

---

Every political event gets two scores. Not one. Two.

That's the core insight behind [The Distraction Index](https://distractionindex.org) — a civic data tool that has scored 1,500+ U.S. political events over 65 weeks. While most political trackers measure either "how bad is this?" or "how much attention is it getting?", we measure both. Independently. And the gap between those two numbers is where the real story lives.

Here's exactly how it works.

## The Dual-Scoring System

Every event that enters the Distraction Index pipeline gets evaluated on two independent axes:

**Score A — Constitutional Damage (0-100):** How much institutional harm does this event cause to democratic governance?

**Score B — Distraction/Hype (0-100):** How much media attention and public energy does this event consume?

An event can score high on both, low on both, or — critically — high on one and low on the other. That asymmetry is what we're looking for.

## Score A: Measuring Constitutional Damage

The A-score uses seven weighted drivers, each rated 0-5 by our AI analysis pipeline (powered by Claude Sonnet):

| Driver | Weight | What It Measures |
|--------|--------|-----------------|
| Rule of Law | 20% | Erosion of legal norms, judicial independence |
| Separation of Powers | 18% | Executive overreach, congressional bypass |
| Civil Liberties | 17% | Free press, assembly, speech, due process |
| Electoral Integrity | 15% | Voting access, election administration |
| Institutional Integrity | 13% | Agency independence, inspector generals |
| Federal-State Relations | 10% | Federalism balance, state sovereignty |
| Democratic Norms | 7% | Precedent-setting, norm violations |

The weighted sum produces a base score, then three severity multipliers adjust it:

- **Durability:** How long will the effects last?
- **Reversibility:** Can this be undone by a future administration?
- **Precedent:** Does this set a dangerous new precedent?

Finally, a mechanism modifier accounts for *how* the harm occurs — executive orders, legislation, judicial rulings, and administrative actions each carry different weight. Federal-scope events affecting broad populations get amplified; local events get dampened.

The result: a score from 0-100 where higher means more constitutional damage. This week, "Congress Extends Federal Oversight of DC Government Through 2029" scored 72.2/100 — high damage, driven by separation of powers and federal-state relations drivers.

## Score B: Measuring Distraction and Hype

The B-score has two layers:

**Layer 1 — Intrinsic Hype Potential (55% of final score):**
- Outrage bait factor (0-5)
- Meme-ability (0-5)
- Novelty factor (0-5)
- Media friendliness (0-5)

**Layer 2 — Strategic Distraction Likelihood (up to 45%):**
- Coverage mismatch (are outlets covering this instead of higher-damage events?)
- Timing coincidence (did this drop when something bigger was happening?)
- Narrative pivot (does this shift the conversation away from accountability?)
- Pattern match (does this fit known distraction patterns?)

Here's the critical nuance: Layer 2's weight is modulated by an **intentionality score** (0-15). If intentionality is high (>= 8), Layer 2 gets its full 45% weight. If intentionality is low (< 4), Layer 2 drops to just 10% weight. This prevents the system from crying "deliberate distraction!" when something is genuinely just viral.

This week, "Trump Threatens Iran with Military Action Over Strait of Hormuz" scored 82.3/100 on the B-score — high hype, driven by outrage bait and media friendliness — but only 25.3/100 on constitutional damage.

## Classification: Lists A, B, and C

Once both scores are calculated, events get classified:

- **List A (High Damage):** A-score >= 25 AND dominance margin (A minus B) >= +10
- **List B (High Distraction):** B-score >= 25 AND dominance margin <= -10
- **List C (Mixed):** Both scores >= 25 but dominance margin between -10 and +10
- **Low Salience:** Both scores below 25

The ±10 dominance margin prevents borderline events from flip-flopping between lists. An event needs to clearly dominate on one axis to be classified.

## Smokescreen Detection: Where the Magic Happens

The most powerful feature is smokescreen detection — algorithmically identifying when high-distraction events are covering for high-damage events that get buried.

The Smokescreen Index pairs a List B event (high distraction) with a List A event (high damage) using three factors:

1. **Raw Smokescreen Index:** `B_score × A_score / 100` — higher when both the distraction and the damage are severe
2. **Displacement Confidence:** How much did the distraction event actually displace coverage of the damage event? Measured by coverage delta (> 20% = high confidence, 10-20% = medium, 5-10% = low, < 5% = don't pair)
3. **Final SI:** `raw_SI × (0.7 + 0.3 × displacement_confidence)` — weights raw pairing by actual displacement

This week, the system detected 15 smokescreen pairs. The top one: while CNN's segment on Trump and anti-semitism allegations dominated attention, the California sheriff seizing 500,000+ ballots while running for governor scored 100/100 constitutional damage with far less coverage.

## The Pipeline: Fully Automated, Fully Transparent

Every 4 hours, the pipeline:
1. **Ingests** articles from GDELT, GNews, and Google News RSS
2. **Clusters** articles into events using Claude Haiku (fast, cheap)
3. **Scores** each new event using Claude Sonnet (accurate, thorough)
4. **Pairs** smokescreen candidates
5. **Publishes** to the live dashboard

Every Sunday at 5 AM UTC, the week **freezes**. Scores become immutable. No edits, no revisions, no spin. Post-freeze corrections are append-only and timestamped.

## Why Two Scores Instead of One?

A single "danger score" would hide the most important signal: the gap between what matters and what gets attention.

Consider two events:
- **Event X:** A-score 85, B-score 20 (high damage, low coverage)
- **Event Y:** A-score 15, B-score 90 (low damage, massive coverage)

A single combined score might rate them similarly. But they're fundamentally different problems. Event X is the one you should know about. Event Y is the one consuming your attention. The Distraction Index exists to make that gap visible.

Over 65 weeks of data, the pattern is consistent: the average A-score across all events is significantly higher than the average B-score would predict for adequate coverage. High-damage events systematically get less attention than they deserve.

## Open Source, Open Data

Every weight, every formula, every prompt template is published. The [methodology page](https://distractionindex.org/methodology) documents the complete algorithm. The [codebase](https://github.com/sgharlow/distraction) is open source. If you disagree with a weight, you can fork it and run your own instance.

Democracy needs data, not just opinions. The Distraction Index is our attempt to provide it.

---

*The Distraction Index publishes weekly at [distractionindex.org](https://distractionindex.org). Subscribe at [distractionindex.substack.com](https://distractionindex.substack.com) for weekly analysis.*

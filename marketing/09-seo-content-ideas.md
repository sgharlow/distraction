# Item 9: SEO Blog Content Ideas

These articles should be published on the site (create an /insights or /blog section).

---

## Article 1: "The 10 Most Undercovered Democratic Events of 2025"

**Target keywords:** undercovered political events 2025, democratic damage 2025, media coverage gaps

**Outline:**
1. Introduction — What does "undercovered" mean? (High A-score, low media attention)
2. Methodology — How we measure coverage vs. impact
3. The 10 events (pulled from your /undercovered data):
   - For each: What happened, A-score breakdown, why it matters, how much coverage it got vs. comparable events
4. What pattern emerges — are certain types of damage systematically undercovered?
5. Conclusion with CTA to explore the full dataset

**Word count:** 2,000-3,000 words
**Internal links:** /undercovered, /methodology, specific /event/ pages

---

## Article 2: "Smokescreen Index: 210+ Times Media Spectacle Masked Real Harm"

**Target keywords:** smokescreen politics, media distraction from real issues, manufactured distractions

**Outline:**
1. What is a smokescreen in politics?
2. How we detect smokescreens algorithmically (pairing methodology)
3. The worst smokescreen pairs of 2025 (top 10)
4. Patterns: What types of distractions are most effective?
5. What citizens can do — media literacy recommendations

**Word count:** 2,500-3,000 words
**Internal links:** /smokescreen, specific pairs, /methodology

---

## Article 3: "How We Score Democratic Damage: Full Algorithm Transparency"

**Target keywords:** political scoring algorithm, democratic damage measurement, transparent civic technology

**Outline:**
1. Why transparency matters in political analysis tools
2. Score A deep dive — each of the 7 drivers explained with examples
3. Score B deep dive — the two-layer distraction model
4. How events are classified (Damage, Distraction, Noise)
5. Known limitations and how we address them
6. How to critique the methodology (encourage engagement)

**Word count:** 3,000-4,000 words
**Internal links:** /methodology (this extends it into a narrative form)

---

## Article 4: "Why We Made Our Political Analysis AI Prompts Public"

**Target keywords:** AI transparency, LLM prompts public, responsible AI civic tech

**Outline:**
1. The black box problem in AI-powered analysis
2. Why we publish our Claude prompts
3. What the prompts look like (show actual snippets)
4. How prompt transparency builds trust
5. Challenges: Can bad actors game a transparent system?
6. Our answer: immutability and audit trails

**Word count:** 1,500-2,000 words
**Target audience:** AI/tech community (good for HN/Reddit cross-posting)

---

## Article 5: "59 Weeks of Data: What We've Learned About Attention and Democracy"

**Target keywords:** media attention democracy, political attention economics, democratic backsliding data

**Outline:**
1. The attention economy applied to democratic governance
2. Key patterns from 59 weeks:
   - Which damage categories are most consistently undercovered?
   - Which distraction patterns repeat?
   - Seasonal patterns in smokescreens?
3. The "attention budget" concept — when B-score > A-score at scale
4. What this means for democratic health
5. Call to action — subscribe, contribute, share

**Word count:** 2,000-2,500 words

---

## Technical SEO Additions (Code Changes)

### JSON-LD for Event Pages (NewsArticle schema)
Add to `src/app/event/[eventId]/page.tsx`:

```typescript
// Inside the page component, add:
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'NewsArticle',
  headline: event.title,
  datePublished: event.created_at,
  dateModified: event.updated_at,
  description: event.summary,
  publisher: {
    '@type': 'Organization',
    name: 'The Distraction Index',
    url: 'https://distractionindex.org',
  },
  mainEntityOfPage: `https://distractionindex.org/event/${eventId}`,
};

// In the JSX:
<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
```

### JSON-LD for Week Pages (DataCatalog schema)
Add to `src/app/week/[weekId]/page.tsx`

### News Sitemap
Consider adding a Google News-specific sitemap with `<news:news>` tags for recent events (last 48 hours). This helps Google News discovery.

---

## Implementation Priority

1. **Article 1** (Undercovered) — Most shareable, unique content angle
2. **Article 4** (AI Prompts) — Best for tech audience, HN-friendly
3. **Article 2** (Smokescreen) — Strong concept, high search potential
4. **Article 5** (59 Weeks) — Good for end-of-year / milestone posts
5. **Article 3** (Algorithm) — Reference content, long-tail SEO

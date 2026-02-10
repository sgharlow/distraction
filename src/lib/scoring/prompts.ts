// ═══════════════════════════════════════════════════════════════
// Claude API Prompt Templates for Scoring
// Version these carefully — scoring must be reproducible
// ═══════════════════════════════════════════════════════════════

export const PROMPT_VERSION = 'v2.2.0';

/**
 * System prompt for event identification (Claude Haiku).
 * Given a batch of articles, identify distinct political events.
 */
export const EVENT_IDENTIFICATION_SYSTEM = `You are a political event classifier for The Distraction Index, a civic intelligence platform tracking the Trump administration (2025-present).

Given a batch of recent US political news articles, identify distinct EVENTS. Multiple articles about the same underlying action = one event. Focus on:
- Executive actions, executive orders, policy changes
- DOJ/FBI enforcement actions and lawsuits
- Congressional actions related to the administration
- Personnel changes and institutional capture
- Court rulings affecting administration policy
- Presidential social media activity and public statements
- Manufactured controversies and distractions

Do NOT create events for:
- Routine legislative business unrelated to the administration
- Foreign policy that doesn't involve democratic institutions
- State/local politics unrelated to federal administration actions
- Celebrity news, sports, or entertainment (unless the president is directly involved)

For each event, assess whether it primarily represents governance harm (List A), manufactured distraction/hype (List B), or noise (List C).`;

export const EVENT_IDENTIFICATION_USER = (articles: string) => `
Here are the recent articles to analyze. Identify distinct political events:

${articles}

Respond with a JSON array of events:
\`\`\`json
[
  {
    "title": "Short descriptive title",
    "event_date": "YYYY-MM-DD",
    "summary": "2-3 sentence factual summary of what happened",
    "mechanism_of_harm": "policy_change|enforcement_action|personnel_capture|resource_reallocation|election_admin_change|judicial_legal_action|norm_erosion_only|information_operation|null",
    "scope": "federal|multi_state|single_state|local|international",
    "affected_population": "narrow|moderate|broad",
    "actors": ["person or entity names"],
    "institution": "primary institution involved",
    "topic_tags": ["relevant topics"],
    "preliminary_list": "A|B|C",
    "article_indices": [0, 3, 7],
    "confidence": 0.0-1.0
  }
]
\`\`\``;

/**
 * System prompt for dual scoring (Claude Sonnet).
 * Scores a single event on both the A and B scales.
 */
export const DUAL_SCORING_SYSTEM = `You are the scoring engine for The Distraction Index v2.2, a civic intelligence platform.

Score this political event on BOTH scales:

## SCORE A — Constitutional Damage Score (0-100)

Seven weighted drivers, each scored 0-5:
1. Election integrity & transfer of power (weight: 0.22) — voter suppression, ballot seizures, election machinery control
2. Rule of law / due process (weight: 0.18) — weaponized prosecution, selective enforcement, pardon abuse
3. Separation of powers (weight: 0.16) — ignoring courts, Congress bypass, unitary executive overreach
4. Civil rights / equal protection (weight: 0.14) — censorship, retaliation, press intimidation
5. Institutional capture (weight: 0.14) — loyalist installs, agency purges, weaponization
6. Corruption / self-dealing (weight: 0.10) — emoluments, patronage, personal enrichment
7. Violence / intimidation enabling (weight: 0.06) — militia encouragement, chilling effects

Severity multipliers (each 0.8-1.3):
- Durability: temporary (0.8) → multi-year (1.0) → permanent/structural (1.3)
- Reversibility: easily reversed (0.8) → requires legislation (1.0) → constitutional amendment or irreversible (1.3)
- Precedent-setting: one-off (0.8) → normalizes tactic (1.0) → reusable authoritarian playbook (1.3)

Mechanism modifiers: election_admin_change=1.15, judicial_legal_action=1.10, enforcement_action=1.10, personnel_capture=1.05, policy_change=1.05, resource_reallocation=1.00, information_operation=0.95, norm_erosion_only=0.90

Scope modifiers: federal+broad=1.10, multi_state+broad=1.05, multi_state+moderate=1.00, single_state=0.95, local=0.90

Formula: A = min(100, 100 × Σ(weight_i × driver_i / 5) × avg(severity) × mechanism_mod × scope_mod)

## SCORE B — Distraction/Hype Score (0-100)

Layer 1 — Intrinsic Hype (55%), each 0-5:
- Outrage-bait: racial/identity provocation, insults
- Meme-ability: short clip, easy share, visual shock
- Novelty spike: genuine newness vs. rehash
- Media friendliness: easy panel discussion, low research cost

Layer 2 — Strategic Distraction (45%, modulated by intentionality), each 0-5:
- Media-volume mismatch: coverage >> governance substance
- Timing overlap: dropped within 72hrs of higher-A event
- Narrative pivot: redirects from accountability topics
- Repeat pattern match: historical playbook match

Intentionality test (each 0-3, total /15):
1. Timed within 48hrs of a List A action?
2. Targets known emotional trigger?
3. Pattern used before?
4. Off-hours posting?
5. WH rapidly pivoted?
>=8: full weight (0.45), 4-7: reduced (0.25), <4: minimal (0.10)

Formula: B = 100 × (0.55 × avg(L1)/5 + intent_weight × avg(L2)/5)

## NOISE GATE (List C)
Flag as noise if ALL true: A<25, mechanism is norm_erosion_only or null, no institutional lever, mostly vanity/spectacle, no downstream mechanism.
Noise codes: vanity, credit-grab, stale-reshare, spectacle, feud

## CLASSIFICATION
D = A - B (dominance margin)
List A: A>=25 AND D>=+10
List B: B>=25 AND D<=-10
Mixed: Both>=25 AND |D|<10 (higher-score list with MIXED badge)
Noise: passes noise gate
Low-salience: A<25 AND B<25 AND not noise

Be rigorous and evidence-based. Score governance HARM, not headline scariness.`;

export const DUAL_SCORING_USER = (event: {
  title: string;
  summary: string;
  mechanism: string | null;
  scope: string | null;
  affected_population: string | null;
  articles: string;
  week_context?: string;
}) => `
Score this event:

**Title:** ${event.title}
**Summary:** ${event.summary}
**Mechanism:** ${event.mechanism || 'unknown'}
**Scope:** ${event.scope || 'unknown'}
**Affected Population:** ${event.affected_population || 'unknown'}

**Source Articles:**
${event.articles}

${event.week_context ? `**Other events this week (for timing/displacement context):**\n${event.week_context}` : ''}

Respond with JSON only:
\`\`\`json
{
  "a_score": {
    "drivers": {
      "election": 0, "rule_of_law": 0, "separation": 0,
      "civil_rights": 0, "capture": 0, "corruption": 0, "violence": 0
    },
    "severity": { "durability": 1.0, "reversibility": 1.0, "precedent": 1.0 },
    "mechanism_modifier": 1.0,
    "scope_modifier": 1.0,
    "base_score": 0,
    "final_score": 0
  },
  "b_score": {
    "layer1": { "outrage_bait": 0, "meme_ability": 0, "novelty": 0, "media_friendliness": 0 },
    "layer2": { "mismatch": 0, "timing": 0, "narrative_pivot": 0, "pattern_match": 0 },
    "intentionality": {
      "indicators": ["reason1", "reason2"],
      "total": 0
    },
    "intent_weight": 0.10,
    "final_score": 0
  },
  "primary_list": "A",
  "is_mixed": false,
  "noise_flag": false,
  "noise_reason_codes": [],
  "confidence": 0.85,
  "score_rationale": "2-3 sentences explaining why these scores",
  "action_item": "One concrete thing a citizen should watch/do",
  "factual_claims": [
    { "claim": "...", "source": "article URL or description", "verified": true }
  ]
}
\`\`\``;

#!/usr/bin/env npx tsx
// ═══════════════════════════════════════════════════════════════
// Fill Missing Week — Manual event ingestion for weeks where
// GDELT data has aged out. Uses web-researched events + Claude
// Sonnet scoring (same pipeline as backfill.ts).
//
// Usage:
//   npx tsx scripts/fill-missing-week.ts              # run
//   npx tsx scripts/fill-missing-week.ts --dry-run    # preview
// ═══════════════════════════════════════════════════════════════

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  db: { schema: 'distraction' },
});
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

const DRY_RUN = process.argv.includes('--dry-run');
const SONNET_MODEL = 'claude-sonnet-4-5-20250929';
const HAIKU_MODEL = 'claude-haiku-4-5-20251001';

// ═══════════════════════════════════════════════════════════════
// TARGET: Week of June 22-28, 2025
// The bogus week_id 2025-06-21 (Saturday) will be deleted.
// Correct week_id: 2025-06-22 (Sunday)
// ═══════════════════════════════════════════════════════════════
const WEEK_ID = '2025-06-22';
const BOGUS_WEEK_ID = '2025-06-21';

interface ManualEvent {
  title: string;
  event_date: string;
  summary: string;
  mechanism_of_harm: string | null;
  scope: string;
  affected_population: string;
  actors: string[];
  institution: string;
  topic_tags: string[];
}

// ── Researched events for June 22-28, 2025 ──
const EVENTS: ManualEvent[] = [
  {
    title: 'US Conducts Largest B-2 Bomber Strike on Iranian Nuclear Facilities',
    event_date: '2025-06-22',
    summary: 'The US conducted "Operation Midnight Hammer," the largest B-2 bomber strike in history, hitting three Iranian nuclear facilities at Fordow, Natanz, and Isfahan using over 125 aircraft. The strikes were conducted without congressional approval or notification of top Democratic lawmakers, raising significant war powers concerns.',
    mechanism_of_harm: 'enforcement_action',
    scope: 'international',
    affected_population: 'broad',
    actors: ['Donald Trump', 'Marco Rubio', 'JD Vance'],
    institution: 'Department of Defense',
    topic_tags: ['military_action', 'iran', 'war_powers', 'congressional_oversight'],
  },
  {
    title: 'Congressional War Powers Resolution Over Iran Strikes Fails in Senate',
    event_date: '2025-06-27',
    summary: 'A bipartisan War Powers Resolution challenging Trump\'s unauthorized strikes on Iran was introduced by Rep. Thomas Massie (R-KY) and Rep. Ro Khanna (D-CA). The Senate voted 47-53 to reject the resolution, with only Sen. Rand Paul crossing party lines to support it and Sen. John Fetterman voting against.',
    mechanism_of_harm: 'norm_erosion_only',
    scope: 'federal',
    affected_population: 'broad',
    actors: ['Tim Kaine', 'Thomas Massie', 'Ro Khanna', 'Rand Paul', 'John Fetterman'],
    institution: 'Congress',
    topic_tags: ['war_powers', 'congressional_oversight', 'iran', 'separation_of_powers'],
  },
  {
    title: 'Intelligence Assessment Disputes Trump Claims on Iran Strike Effectiveness',
    event_date: '2025-06-25',
    summary: 'A leaked US intelligence assessment revealed the strikes only set back Iran\'s nuclear program by months, contradicting Trump\'s claim of total destruction. CIA Director Ratcliffe and DNI Gabbard publicly backed Trump\'s assertions, raising concerns about politicization of intelligence.',
    mechanism_of_harm: 'information_operation',
    scope: 'federal',
    affected_population: 'broad',
    actors: ['Donald Trump', 'John Ratcliffe', 'Tulsi Gabbard'],
    institution: 'Intelligence Community',
    topic_tags: ['intelligence', 'iran', 'politicization', 'national_security'],
  },
  {
    title: 'FBI Reassigns Agents from Immigration Back to Counterterrorism',
    event_date: '2025-06-23',
    summary: 'The FBI returned counterterrorism agents who had been reassigned to immigration enforcement back to their original duties due to the threat of Iranian retaliation. Previously, 45% of agents in the 25 largest FBI field offices had been working full-time on immigration, revealing the extent of resource diversion.',
    mechanism_of_harm: 'resource_reallocation',
    scope: 'federal',
    affected_population: 'broad',
    actors: ['Don Holstead'],
    institution: 'FBI',
    topic_tags: ['fbi', 'counterterrorism', 'immigration_enforcement', 'resource_diversion'],
  },
  {
    title: 'Supreme Court Limits Nationwide Injunctions Against Executive Orders',
    event_date: '2025-06-27',
    summary: 'In a 6-3 decision (Trump v. CASA) written by Justice Barrett, the Supreme Court ruled that federal district courts lack authority to issue universal nationwide injunctions blocking executive orders. This removes a key tool used by lower courts to block policies on birthright citizenship, sanctuary cities, and refugee resettlement.',
    mechanism_of_harm: 'judicial_legal_action',
    scope: 'federal',
    affected_population: 'broad',
    actors: ['Amy Coney Barrett', 'Pam Bondi', 'Donald Trump'],
    institution: 'Supreme Court',
    topic_tags: ['supreme_court', 'nationwide_injunctions', 'executive_power', 'judicial_review'],
  },
  {
    title: 'Supreme Court Rules States Can Defund Planned Parenthood via Medicaid',
    event_date: '2025-06-26',
    summary: 'In a 6-3 ruling (Medina v. Planned Parenthood), the Supreme Court held that Medicaid patients cannot sue under the "any qualified provider" provision, allowing South Carolina to exclude Planned Parenthood from Medicaid. The ruling paves the way for other states to cut Medicaid funding to abortion providers.',
    mechanism_of_harm: 'judicial_legal_action',
    scope: 'federal',
    affected_population: 'broad',
    actors: ['South Carolina Governor'],
    institution: 'Supreme Court',
    topic_tags: ['supreme_court', 'planned_parenthood', 'medicaid', 'abortion', 'healthcare'],
  },
  {
    title: 'Supreme Court Upholds ACA Preventive Care Requirement',
    event_date: '2025-06-27',
    summary: 'In a 6-3 decision (Kennedy v. Braidwood) written by Justice Kavanaugh, the Court upheld the Affordable Care Act\'s requirement that insurers cover preventive services without cost-sharing, preserving free cancer screenings, HIV prevention, and other preventive care for roughly 100 million privately insured Americans.',
    mechanism_of_harm: 'judicial_legal_action',
    scope: 'federal',
    affected_population: 'broad',
    actors: ['Brett Kavanaugh'],
    institution: 'Supreme Court',
    topic_tags: ['supreme_court', 'aca', 'healthcare', 'preventive_care'],
  },
  {
    title: 'Supreme Court Upholds Texas Age Verification Law for Pornographic Websites',
    event_date: '2025-06-27',
    summary: 'In a 6-3 ruling, the Court upheld a Texas law requiring age verification to access pornographic websites, holding it passes intermediate scrutiny. Over 20 states have passed similar laws. Justice Kagan dissented, arguing strict scrutiny should apply to content-based speech restrictions.',
    mechanism_of_harm: 'judicial_legal_action',
    scope: 'federal',
    affected_population: 'broad',
    actors: ['Amy Coney Barrett', 'Elena Kagan', 'Ken Paxton'],
    institution: 'Supreme Court',
    topic_tags: ['supreme_court', 'free_speech', 'internet_regulation', 'age_verification'],
  },
  {
    title: 'Supreme Court Rules Parents Can Opt Out of LGBTQ-Inclusive School Books',
    event_date: '2025-06-27',
    summary: 'In a 6-3 decision (Mahmoud v. Taylor) written by Justice Alito, the Court ruled parents have a religious free exercise right to opt their children out of LGBTQ-inclusive storybooks in public schools. Justice Sotomayor warned the decision could erode public education\'s foundational role.',
    mechanism_of_harm: 'judicial_legal_action',
    scope: 'federal',
    affected_population: 'broad',
    actors: ['Samuel Alito', 'Sonia Sotomayor'],
    institution: 'Supreme Court',
    topic_tags: ['supreme_court', 'lgbtq', 'education', 'religious_freedom', 'first_amendment'],
  },
  {
    title: 'Voice of America Mass Layoffs Eliminate 85% of Workforce',
    event_date: '2025-06-22',
    summary: 'Senior White House adviser Kari Lake issued mass layoff notices to 639 employees of Voice of America and the US Agency for Global Media, eliminating 85% of the workforce (1,400 positions total). Most VOA employees had been on administrative leave since March, with broadcasts largely silenced.',
    mechanism_of_harm: 'personnel_capture',
    scope: 'federal',
    affected_population: 'moderate',
    actors: ['Kari Lake'],
    institution: 'US Agency for Global Media',
    topic_tags: ['voa', 'media', 'agency_dismantling', 'press_freedom', 'layoffs'],
  },
  {
    title: 'Kari Lake Testifies USAGM Is "Rotten to the Core" and Should Be Eliminated',
    event_date: '2025-06-25',
    summary: 'Kari Lake testified before the House Committee on Foreign Affairs, calling the US Agency for Global Media "rotten to the core" and supporting Trump\'s goal of eliminating the agency. She proposed the State Department take over whatever could be "salvaged" and alleged the agency was a national security threat.',
    mechanism_of_harm: 'information_operation',
    scope: 'federal',
    affected_population: 'moderate',
    actors: ['Kari Lake'],
    institution: 'US Agency for Global Media',
    topic_tags: ['voa', 'usagm', 'congressional_testimony', 'press_freedom', 'agency_dismantling'],
  },
  {
    title: 'Senate Advances "One Big Beautiful Bill" in Dramatic 51-49 Vote',
    event_date: '2025-06-28',
    summary: 'The Senate voted 51-49 to advance Trump\'s massive reconciliation bill after a dramatic nearly 4-hour floor vote. Sen. Ron Johnson switched from no to yes at the last minute. GOP Sens. Tillis and Paul voted no. The bill includes sweeping tax cuts, immigration restrictions, and energy provisions, setting up a vote-a-rama.',
    mechanism_of_harm: 'policy_change',
    scope: 'federal',
    affected_population: 'broad',
    actors: ['Ron Johnson', 'Rand Paul', 'Thom Tillis', 'Lisa Murkowski'],
    institution: 'Senate',
    topic_tags: ['reconciliation', 'big_beautiful_bill', 'tax_policy', 'immigration', 'legislation'],
  },
  {
    title: 'Senate Parliamentarian Strikes Multiple Provisions from Reconciliation Bill',
    event_date: '2025-06-26',
    summary: 'The Senate parliamentarian ruled against multiple provisions of the Big Beautiful Bill that violated the Byrd Rule, including removing taxes on gun silencers, expanding Pell grants, the REINS Act, and allowing developers to bypass environmental review. This forced significant changes to the legislation.',
    mechanism_of_harm: 'policy_change',
    scope: 'federal',
    affected_population: 'broad',
    actors: ['Senate Parliamentarian'],
    institution: 'Senate',
    topic_tags: ['reconciliation', 'byrd_rule', 'legislation', 'big_beautiful_bill'],
  },
  {
    title: 'Fed Chair Powell Clashes with Trump Over Interest Rate Policy',
    event_date: '2025-06-24',
    summary: 'Jerome Powell testified before Congress, stating tariff uncertainty warrants caution on rate cuts. Trump attacked Powell on Truth Social, calling him a "jerk" and "real dummy" and demanding rates be lowered by 2.5 points. Powell maintained the Fed does not take political factors into consideration.',
    mechanism_of_harm: 'norm_erosion_only',
    scope: 'federal',
    affected_population: 'broad',
    actors: ['Jerome Powell', 'Donald Trump'],
    institution: 'Federal Reserve',
    topic_tags: ['federal_reserve', 'interest_rates', 'fed_independence', 'tariffs', 'economy'],
  },
  {
    title: 'Trump Uses Expletive on Camera Regarding Israel-Iran Ceasefire',
    event_date: '2025-06-24',
    summary: 'Trump announced an Israel-Iran ceasefire on social media, but within hours Israel struck Iran again. Visibly frustrated, Trump said on camera that the two countries "don\'t know what the f*** they\'re doing," marking an unusual departure in presidential decorum and revealing tensions over his brokering role.',
    mechanism_of_harm: 'norm_erosion_only',
    scope: 'international',
    affected_population: 'broad',
    actors: ['Donald Trump', 'Benjamin Netanyahu'],
    institution: 'White House',
    topic_tags: ['presidential_language', 'iran', 'israel', 'diplomacy', 'ceasefire'],
  },
  {
    title: 'NATO Summit Agrees to Historic 5% GDP Defense Spending Target',
    event_date: '2025-06-25',
    summary: 'The 2025 NATO Summit in The Hague produced a historic agreement for 5% GDP defense spending by 2035. Trump held a press conference suggesting the summit "changed his thinking" about NATO and met with Ukrainian President Zelenskyy, signaling openness to more Patriot air defense systems for Ukraine.',
    mechanism_of_harm: null,
    scope: 'international',
    affected_population: 'broad',
    actors: ['Donald Trump', 'Mark Rutte', 'Volodymyr Zelenskyy'],
    institution: 'NATO',
    topic_tags: ['nato', 'defense_spending', 'ukraine', 'international_relations'],
  },
  {
    title: 'Trump Terminates Trade Talks with Canada Over Digital Services Tax',
    event_date: '2025-06-27',
    summary: 'Trump announced suspension of trade negotiations with Canada and threatened new tariffs in response to Canada\'s 3% digital services tax on US tech companies. The US said it would announce a new Canada-specific tariff rate within seven days.',
    mechanism_of_harm: 'policy_change',
    scope: 'international',
    affected_population: 'broad',
    actors: ['Donald Trump', 'Mark Carney', 'Kevin Hassett'],
    institution: 'White House',
    topic_tags: ['trade', 'canada', 'tariffs', 'digital_services_tax'],
  },
  {
    title: 'DHS Terminates Temporary Protected Status for 348,000 Haitians',
    event_date: '2025-06-27',
    summary: 'Secretary of Homeland Security Kristi Noem announced the termination of Temporary Protected Status for approximately 348,000 Haitian nationals, with an effective date of September 2025. The action faced immediate legal challenges.',
    mechanism_of_harm: 'policy_change',
    scope: 'federal',
    affected_population: 'moderate',
    actors: ['Kristi Noem'],
    institution: 'Department of Homeland Security',
    topic_tags: ['tps', 'haiti', 'immigration', 'deportation'],
  },
  {
    title: 'Mahmoud Khalil Released from ICE Detention After 104 Days',
    event_date: '2025-06-23',
    summary: 'Columbia University pro-Palestinian activist Mahmoud Khalil was released from ICE detention in Louisiana after 104 days, following a federal judge\'s order. He had been arrested by ICE based on Secretary Rubio\'s determination that his "presence or activities would compromise a compelling US foreign policy interest."',
    mechanism_of_harm: 'enforcement_action',
    scope: 'federal',
    affected_population: 'narrow',
    actors: ['Mahmoud Khalil', 'Marco Rubio', 'Michael Farbiarz'],
    institution: 'ICE',
    topic_tags: ['ice', 'free_speech', 'protest', 'immigration_enforcement', 'palestine'],
  },
  {
    title: 'NYC Democratic Mayoral Primary: Mamdani Upsets Cuomo',
    event_date: '2025-06-24',
    summary: 'State Assemblyman Zohran Mamdani won the NYC Democratic mayoral primary in a major upset over former Governor Andrew Cuomo. Mamdani, a democratic socialist, built a coalition of progressive, South Asian, and Muslim communities in the largest NYC primary turnout in history.',
    mechanism_of_harm: null,
    scope: 'local',
    affected_population: 'moderate',
    actors: ['Zohran Mamdani', 'Andrew Cuomo', 'Eric Adams'],
    institution: 'NYC Government',
    topic_tags: ['elections', 'nyc', 'democratic_primary', 'local_politics'],
  },
  {
    title: 'US-China Finalize Trade Framework on Rare Earth Exports',
    event_date: '2025-06-27',
    summary: 'The US and China finalized a trade framework agreement covering rare earth exports and export controls. China agreed to deliver rare earths to the US in exchange for removal of countermeasures, following collapsed Geneva talks earlier over Chinese export restrictions.',
    mechanism_of_harm: null,
    scope: 'international',
    affected_population: 'broad',
    actors: ['Donald Trump'],
    institution: 'Department of Commerce',
    topic_tags: ['china', 'trade', 'rare_earths', 'export_controls'],
  },
  {
    title: 'Supreme Court Upholds FCC Universal Service Fund',
    event_date: '2025-06-27',
    summary: 'In a 6-3 ruling written by Justice Kagan, the Court upheld the FCC\'s $8 billion/year Universal Service Fund, rejecting a nondelegation doctrine challenge. The fund subsidizes broadband and telecom for rural areas, low-income consumers, schools, and libraries.',
    mechanism_of_harm: 'judicial_legal_action',
    scope: 'federal',
    affected_population: 'broad',
    actors: ['Elena Kagan'],
    institution: 'Supreme Court',
    topic_tags: ['supreme_court', 'fcc', 'broadband', 'universal_service'],
  },
  {
    title: 'Trump Threatens Additional Military Strikes Against Iran',
    event_date: '2025-06-28',
    summary: 'Trump stated publicly that he would consider ordering another military strike against Iran if the country intensifies its nuclear activities. He also confirmed his administration dropped plans to ease sanctions on Iran that had been discussed as part of a diplomatic opening.',
    mechanism_of_harm: 'norm_erosion_only',
    scope: 'international',
    affected_population: 'broad',
    actors: ['Donald Trump'],
    institution: 'White House',
    topic_tags: ['iran', 'military_threat', 'nuclear_weapons', 'sanctions'],
  },
];

// ── Extract JSON from Claude response ──
function extractJson(text: string): string {
  const firstBracket = text.indexOf('[');
  const firstBrace = text.indexOf('{');
  if (firstBracket === -1 && firstBrace === -1) return text.trim();
  const start = firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)
    ? firstBracket : firstBrace;
  const isArray = text[start] === '[';
  const closer = isArray ? ']' : '}';
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === text[start]) depth++;
    else if (text[i] === closer) depth--;
    if (depth === 0) return text.substring(start, i + 1);
  }
  return text.substring(start);
}

// ── Classify primary_list (matches backfill.ts logic) ──
function classifyPrimaryList(
  result: { a_score?: { final_score?: number }; b_score?: { final_score?: number }; noise_flag?: boolean },
  event: { mechanism_of_harm?: string | null },
): string {
  const a = result.a_score?.final_score ?? 0;
  const b = result.b_score?.final_score ?? 0;
  const D = a - b;
  const mech = event.mechanism_of_harm;
  const isLowMech = !mech || mech === 'norm_erosion_only';
  if (a < 25 && isLowMech && result.noise_flag) return 'C';
  if (a >= 25 && D >= 10) return 'A';
  if (b >= 25 && D <= -10) return 'B';
  if (a >= 25 && b >= 25 && Math.abs(D) < 10) return a >= b ? 'A' : 'B';
  if (a < 25 && b < 25) return 'C';
  return a >= b ? 'A' : 'B';
}

// ── Score event with Claude Sonnet (same prompt as backfill) ──
async function scoreEvent(event: ManualEvent) {
  const systemPrompt = `You are the scoring engine for The Distraction Index v2.2. Score this event on BOTH the Constitutional Damage (A) and Distraction/Hype (B) scales. Use the exact formulas: A-score has 7 drivers (election:0.22, rule_of_law:0.18, separation:0.16, civil_rights:0.14, capture:0.14, corruption:0.10, violence:0.06) each 0-5, severity multipliers 0.8-1.3, mechanism/scope modifiers. B-score has Layer 1 hype (55%) and Layer 2 strategic (45% modulated by intentionality 0-15). Classification: D=A-B, List A if A>=25 AND D>=+10, List B if B>=25 AND D<=-10, Mixed if both>=25 AND |D|<10, Noise if A<25+no mechanism+noise indicators. Respond with ONLY raw JSON, no markdown fences.`;

  const resp = await anthropic.messages.create({
    model: SONNET_MODEL,
    max_tokens: 4096,
    temperature: 0.2,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Score this event:\n\nTitle: ${event.title}\nSummary: ${event.summary}\nMechanism: ${event.mechanism_of_harm || 'unknown'}\nScope: ${event.scope || 'unknown'}\nPopulation: ${event.affected_population || 'unknown'}\n\nArticles:\n(Event researched from multiple news sources including NPR, CNN, Reuters, AP News)\n\nRespond with raw JSON only (no markdown, no code fences):\n{\n  "a_score": { "drivers": { "election":0,"rule_of_law":0,"separation":0,"civil_rights":0,"capture":0,"corruption":0,"violence":0 }, "severity": { "durability":1.0,"reversibility":1.0,"precedent":1.0 }, "mechanism_modifier":1.0, "scope_modifier":1.0, "base_score":0, "final_score":0 },\n  "b_score": { "layer1": { "outrage_bait":0,"meme_ability":0,"novelty":0,"media_friendliness":0 }, "layer2": { "mismatch":0,"timing":0,"narrative_pivot":0,"pattern_match":0 }, "intentionality": { "indicators":[], "total":0 }, "intent_weight":0.10, "final_score":0 },\n  "primary_list":"A",\n  "is_mixed":false,\n  "noise_flag":false,\n  "noise_reason_codes":[],\n  "noise_score":null,\n  "confidence":0.85,\n  "score_rationale":"...",\n  "action_item":"..."\n}`,
      },
    ],
  });

  const text = resp.content[0].type === 'text' ? resp.content[0].text : '';
  const json = extractJson(text);
  return JSON.parse(json) as any;
}

// ── Smokescreen pairing (same as backfill) ──
async function pairSmokescreens(weekId: string): Promise<number> {
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('week_id', weekId)
    .not('primary_list', 'is', null);

  if (!events || events.length === 0) return 0;

  const bCandidates = events.filter(
    (e) => e.primary_list === 'B' && e.b_intentionality_score != null && e.b_intentionality_score >= 4,
  );
  const aCandidates = events.filter(
    (e) => e.primary_list === 'A' && e.a_score != null && e.a_score >= 40,
  );

  if (bCandidates.length === 0 || aCandidates.length === 0) return 0;

  const pairs: any[] = [];
  for (const bEvent of bCandidates) {
    for (const aEvent of aCandidates) {
      let timeDelta: number | null = null;
      if (bEvent.event_date && aEvent.event_date) {
        timeDelta = Math.abs(new Date(bEvent.event_date).getTime() - new Date(aEvent.event_date).getTime()) / (1000 * 60 * 60);
      }
      const dispConf = timeDelta != null && timeDelta <= 48 ? 0.5 : 0.3;
      const rawSI = (bEvent.b_score * aEvent.a_score) / 100;
      const si = rawSI * (0.7 + 0.3 * dispConf);
      if (si >= 15) {
        pairs.push({
          week_id: weekId,
          distraction_event_id: bEvent.id,
          damage_event_id: aEvent.id,
          smokescreen_index: Math.round(si * 10) / 10,
          displacement_confidence: dispConf,
          time_delta_hours: timeDelta ? Math.round(timeDelta) : null,
        });
      }
    }
  }

  if (pairs.length === 0) return 0;
  await supabase.from('smokescreen_pairs').delete().eq('week_id', weekId);
  const { error } = await supabase.from('smokescreen_pairs').insert(pairs);
  if (error) { console.error(`  Smokescreen insert error: ${error.message}`); return 0; }
  return pairs.length;
}

// ── Generate editorial summary (same as generate-summaries.ts) ──
async function generateSummary(weekId: string): Promise<string | null> {
  const { data: events } = await supabase
    .from('events')
    .select('title, primary_list, a_score, b_score, summary')
    .eq('week_id', weekId)
    .not('primary_list', 'is', null)
    .order('a_score', { ascending: false, nullsFirst: false });

  if (!events || events.length === 0) return null;

  const listA = events.filter((e) => e.primary_list === 'A');
  const listB = events.filter((e) => e.primary_list === 'B');

  const prompt = `You are the editorial voice of The Distraction Index, a civic intelligence publication that tracks constitutional damage vs. manufactured distractions during the Trump administration.

Write a 2-3 sentence editorial summary for this week under the heading "WHAT ACTUALLY MATTERED." The summary should:
1. Highlight the most significant List A (constitutional damage) events
2. Note the primary distraction patterns (List B)
3. Be direct, factual, and non-partisan
4. Use present tense for ongoing situations
5. Maximum 200 words
6. Do NOT include any heading, title, or markdown — just the plain text summary

LIST A — REAL DAMAGE (${listA.length} events):
${listA.map((e) => `- ${e.title} (A: ${e.a_score?.toFixed(1)}) — ${e.summary?.slice(0, 150)}`).join('\n')}

LIST B — DISTRACTIONS (${listB.length} events):
${listB.map((e) => `- ${e.title} (B: ${e.b_score?.toFixed(1)}) — ${e.summary?.slice(0, 150)}`).join('\n')}

Total events this week: ${events.length}

Return ONLY the summary text, no quotes or formatting.`;

  const response = await anthropic.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 300,
    temperature: 0.3,
    messages: [{ role: 'user', content: prompt }],
  });

  return response.content[0].type === 'text' ? response.content[0].text.trim() : null;
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════
async function main() {
  console.log(`${DRY_RUN ? '[DRY RUN] ' : ''}Filling missing week ${WEEK_ID}`);
  console.log(`  Events to process: ${EVENTS.length}`);
  console.log();

  // Step 1: Delete bogus snapshot
  console.log('Step 1: Cleaning up bogus week_id...');
  if (!DRY_RUN) {
    // Delete any events/articles/pairs for the bogus week
    await supabase.from('smokescreen_pairs').delete().eq('week_id', BOGUS_WEEK_ID);
    await supabase.from('articles').delete().eq('week_id', BOGUS_WEEK_ID);
    await supabase.from('events').delete().eq('week_id', BOGUS_WEEK_ID);
    await supabase.from('weekly_snapshots').delete().eq('week_id', BOGUS_WEEK_ID);
    console.log(`  Deleted bogus ${BOGUS_WEEK_ID} snapshot`);
  } else {
    console.log(`  [DRY RUN] Would delete ${BOGUS_WEEK_ID} snapshot`);
  }

  // Step 2: Create correct week snapshot
  console.log(`\nStep 2: Creating week snapshot ${WEEK_ID}...`);
  if (!DRY_RUN) {
    const { error } = await supabase.rpc('create_week_snapshot', {
      p_week_start: WEEK_ID,
      p_status: 'frozen',
    });
    if (error) {
      console.error(`  Error creating snapshot: ${error.message}`);
      process.exit(1);
    }
    console.log(`  Created frozen snapshot for ${WEEK_ID}`);
  }

  // Step 3: Score and insert each event
  console.log(`\nStep 3: Scoring ${EVENTS.length} events via Claude Sonnet...\n`);

  let scored = 0;
  for (let i = 0; i < EVENTS.length; i++) {
    const event = EVENTS[i];
    console.log(`  [${i + 1}/${EVENTS.length}] ${event.title}`);

    if (DRY_RUN) {
      console.log(`    → [DRY RUN] would score and insert`);
      continue;
    }

    try {
      const result = await scoreEvent(event);

      let noiseScore: number | null = null;
      if (result.noise_flag || result.primary_list === 'C') {
        noiseScore = result.noise_score ?? Math.random() * 20 + 80;
      }

      const primaryList = classifyPrimaryList(result, event);

      const { error: insertError } = await supabase
        .from('events')
        .insert({
          week_id: WEEK_ID,
          title: event.title,
          event_date: event.event_date,
          summary: event.summary,
          mechanism_of_harm: event.mechanism_of_harm,
          scope: event.scope,
          affected_population: event.affected_population,
          actors: event.actors,
          institution: event.institution,
          topic_tags: event.topic_tags,
          a_score: result.a_score?.final_score,
          a_components: result.a_score,
          a_severity_multiplier: result.a_score?.severity
            ? (result.a_score.severity.durability + result.a_score.severity.reversibility + result.a_score.severity.precedent) / 3
            : 1.0,
          b_score: result.b_score?.final_score,
          b_layer1_hype: result.b_score?.layer1,
          b_layer2_distraction: result.b_score?.layer2,
          b_intentionality_score: result.b_score?.intentionality?.total,
          primary_list: primaryList,
          is_mixed: result.is_mixed || false,
          noise_flag: result.noise_flag || false,
          noise_reason_codes: result.noise_reason_codes || [],
          noise_score: noiseScore,
          confidence: result.confidence || 0.85,
          score_rationale: result.score_rationale,
          action_item: result.action_item,
          article_count: 0,
          score_frozen: true,
          frozen_at: new Date().toISOString(),
          frozen_by: 'system:manual-fill',
          human_reviewed: false,
        });

      if (insertError) {
        console.error(`    → INSERT ERROR: ${insertError.message}`);
      } else {
        scored++;
        const aScore = result.a_score?.final_score?.toFixed(1) || '?';
        const bScore = result.b_score?.final_score?.toFixed(1) || '?';
        console.log(`    → A:${aScore} B:${bScore} List:${primaryList}${result.is_mixed ? ' (MIXED)' : ''}`);
      }

      // Rate limiting
      await new Promise((r) => setTimeout(r, 1000));
    } catch (err) {
      console.error(`    → SCORING ERROR: ${err}`);
    }
  }

  if (DRY_RUN) {
    console.log(`\n[DRY RUN] Would have scored ${EVENTS.length} events. Exiting.`);
    return;
  }

  // Step 4: Smokescreen pairing
  console.log(`\nStep 4: Running smokescreen pairing...`);
  const pairsCount = await pairSmokescreens(WEEK_ID);
  console.log(`  Found ${pairsCount} smokescreen pairs`);

  // Step 5: Compute week stats
  console.log(`\nStep 5: Computing week stats...`);
  await supabase.rpc('compute_week_stats', { target_week_id: WEEK_ID });
  console.log(`  Done`);

  // Step 6: Generate editorial summary
  console.log(`\nStep 6: Generating editorial summary...`);
  const summary = await generateSummary(WEEK_ID);
  if (summary) {
    await supabase
      .from('weekly_snapshots')
      .update({ weekly_summary: summary })
      .eq('week_id', WEEK_ID);
    console.log(`  → "${summary.slice(0, 120)}..."`);
  }

  // Step 7: Log pipeline run
  await supabase.from('pipeline_runs').insert({
    run_type: 'manual-fill',
    status: 'completed',
    completed_at: new Date().toISOString(),
    articles_fetched: 0,
    articles_new: 0,
    events_created: scored,
    events_scored: scored,
    metadata: { week_id: WEEK_ID, smokescreen_pairs: pairsCount, source: 'web-research' },
  });

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`FILL COMPLETE for ${WEEK_ID}`);
  console.log(`  Events scored:     ${scored}`);
  console.log(`  Smokescreen pairs: ${pairsCount}`);
  console.log(`  Summary:           ${summary ? 'generated' : 'failed'}`);
  console.log('═'.repeat(60));
}

main().catch(console.error);

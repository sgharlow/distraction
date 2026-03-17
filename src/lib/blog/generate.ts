import { callHaiku, extractJSON } from '@/lib/claude';

export interface GeneratedBlogPost {
  title: string;
  meta_description: string;
  body_markdown: string;
  keywords: string[];
}

const SYSTEM_PROMPT = `You are a civic intelligence analyst writing for The Distraction Index — a weekly report that scores U.S. political events on two axes: constitutional damage (A-score) and distraction/hype (B-score).

Write an engaging, factual blog post analyzing this week's data. Your audience is politically engaged citizens who want to understand what's actually happening vs. what's dominating headlines.

Respond with JSON only:
{
  "title": "Compelling headline with the week's most striking finding",
  "meta_description": "150 char SEO description",
  "body_markdown": "800-1200 word markdown article with ## headers",
  "keywords": ["5-8 relevant SEO keywords"]
}

Guidelines:
- Lead with the most striking data point (highest damage score, biggest smokescreen gap)
- Use specific numbers and event names
- Explain what the scores mean for democracy in plain language
- End with a link to the full interactive report
- No partisan language — let the data speak
- Use ## for section headers, **bold** for emphasis, bullet lists for data`;

export async function generateBlogPost(weekData: {
  weekId: string;
  weekNumber: number;
  totalEvents: number;
  listA: Array<{ title: string; a_score: number; b_score: number }>;
  listB: Array<{ title: string; a_score: number; b_score: number }>;
  smokescreenCount: number;
  avgDamage: number;
  avgDistraction: number;
}): Promise<GeneratedBlogPost & { tokens: number; model: string }> {
  const userPrompt = `Generate a blog post for Week ${weekData.weekNumber} (${weekData.weekId}).

Data summary:
- ${weekData.totalEvents} events scored
- ${weekData.listA.length} high-damage events (List A)
- ${weekData.listB.length} high-distraction events (List B)
- ${weekData.smokescreenCount} smokescreen pairs detected
- Average damage: ${weekData.avgDamage.toFixed(1)}/100
- Average distraction: ${weekData.avgDistraction.toFixed(1)}/100

Top damage events:
${weekData.listA.slice(0, 5).map(e => `- "${e.title}" — Damage: ${e.a_score.toFixed(1)}, Distraction: ${e.b_score.toFixed(1)}`).join('\n')}

Top distraction events:
${weekData.listB.slice(0, 5).map(e => `- "${e.title}" — Distraction: ${e.b_score.toFixed(1)}, Damage: ${e.a_score.toFixed(1)}`).join('\n')}

Full report URL: https://distractionindex.org/week/${weekData.weekId}`;

  const response = await callHaiku(SYSTEM_PROMPT, userPrompt, 2048);
  const parsed = extractJSON<GeneratedBlogPost>(response.text);

  return {
    ...parsed,
    tokens: response.input_tokens + response.output_tokens,
    model: response.model,
  };
}

// ═══════════════════════════════════════════════════════════════
// Article → Event Clustering via Claude Haiku
// Takes a batch of articles and identifies distinct political events
// ═══════════════════════════════════════════════════════════════

import { callHaiku, extractJSON } from '@/lib/claude';
import { EVENT_IDENTIFICATION_SYSTEM, EVENT_IDENTIFICATION_USER } from '@/lib/scoring/prompts';
import type { ArticleInput, IdentifiedEvent } from './types';

const MAX_ARTICLES_PER_BATCH = 50;

/**
 * Format articles into a string for the Claude prompt.
 */
function formatArticlesForPrompt(articles: ArticleInput[]): string {
  return articles
    .map(
      (a, i) =>
        `[${i}] "${a.headline}" — ${a.publisher} (${a.published_at.slice(0, 10)})${a.summary ? `\n    ${a.summary}` : ''}`,
    )
    .join('\n');
}

/**
 * Cluster a batch of articles into distinct political events using Claude Haiku.
 *
 * @param articles - Deduplicated articles from ingestion
 * @param existingEventTitles - Titles of events already in this week (for context)
 * @returns Array of identified events with article index references
 */
export async function clusterArticlesIntoEvents(
  articles: ArticleInput[],
  existingEventTitles: string[] = [],
): Promise<{ events: IdentifiedEvent[]; tokens: { input: number; output: number } }> {
  if (articles.length === 0) {
    return { events: [], tokens: { input: 0, output: 0 } };
  }

  // Process in batches if too many articles
  const batches: ArticleInput[][] = [];
  for (let i = 0; i < articles.length; i += MAX_ARTICLES_PER_BATCH) {
    batches.push(articles.slice(i, i + MAX_ARTICLES_PER_BATCH));
  }

  const allEvents: IdentifiedEvent[] = [];
  let totalInput = 0;
  let totalOutput = 0;

  for (const batch of batches) {
    const articleText = formatArticlesForPrompt(batch);

    // Add context about existing events if available
    let userPrompt = EVENT_IDENTIFICATION_USER(articleText);
    if (existingEventTitles.length > 0) {
      userPrompt += `\n\nIMPORTANT — Events already tracked this week. You MUST assign articles to these existing events if they cover the same underlying action. Only create a new event if it is genuinely distinct:\n${existingEventTitles.map((t) => `- ${t}`).join('\n')}`;
    }

    const response = await callHaiku(EVENT_IDENTIFICATION_SYSTEM, userPrompt, 4096);

    totalInput += response.input_tokens;
    totalOutput += response.output_tokens;

    try {
      const events = extractJSON<IdentifiedEvent[]>(response.text);

      // Validate and normalize
      for (const event of events) {
        if (!event.title || !event.summary || !event.event_date) continue;
        if (!event.article_indices || event.article_indices.length === 0) continue;

        // Adjust article indices for batches offset
        const batchOffset = batches.indexOf(batch) * MAX_ARTICLES_PER_BATCH;
        event.article_indices = event.article_indices.map((i) => i + batchOffset);

        allEvents.push(event);
      }
    } catch (err) {
      console.error('Failed to parse event identification response:', err);
      console.error('Response text:', response.text.slice(0, 500));
    }
  }

  return { events: allEvents, tokens: { input: totalInput, output: totalOutput } };
}

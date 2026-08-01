// ═══════════════════════════════════════════════════════════════
// Claude API Client — Thin wrapper over Anthropic SDK
// Uses Haiku 4.5 for cheap triage, Sonnet 5 for accurate scoring
// ═══════════════════════════════════════════════════════════════

import Anthropic from '@anthropic-ai/sdk';

const HAIKU_MODEL = 'claude-haiku-4-5';
const SONNET_MODEL = 'claude-sonnet-5';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }
  return client;
}

interface ClaudeResponse {
  text: string;
  input_tokens: number;
  output_tokens: number;
  model: string;
  // Surfaced so callers can fail LOUD on truncation. Sonnet 5's adaptive
  // thinking shares the output budget with the answer, so a too-small max_tokens
  // truncates the JSON mid-string and JSON.parse throws opaquely — callers check
  // this for `'max_tokens'` and throw a diagnosable error instead.
  stop_reason: string | null;
}

async function callClaude(params: {
  model: string;
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<ClaudeResponse> {
  const anthropic = getClient();
  const { model, system, user, maxTokens = 4096, temperature } = params;

  // NOTE: Sonnet 5 (and the whole Opus-5/Sonnet-5 generation) REJECTS the
  // `temperature` parameter with HTTP 400. Haiku 4.5 still accepts it. So we
  // only send `temperature` when a caller explicitly opts in — callHaiku does,
  // callSonnet does not.
  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    ...(temperature !== undefined ? { temperature } : {}),
    system,
    messages: [{ role: 'user', content: user }],
  });

  // Sonnet 5 (adaptive extended thinking) returns a `thinking` block as
  // content[0] and the answer in a later `text` block. Reading content[0]
  // blindly yields '' on any thinking response and breaks JSON.parse — so
  // select the first text block wherever it is.
  const textBlock = response.content.find((b) => b.type === 'text');
  const text = textBlock && textBlock.type === 'text' ? textBlock.text : '';

  return {
    text,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    model,
    stop_reason: response.stop_reason,
  };
}

/**
 * Call Claude Haiku for fast, cheap operations (event identification, triage).
 */
export async function callHaiku(system: string, user: string, maxTokens?: number): Promise<ClaudeResponse> {
  return callClaude({ model: HAIKU_MODEL, system, user, maxTokens, temperature: 0.2 });
}

/**
 * Call Claude Sonnet for accurate scoring operations.
 */
export async function callSonnet(system: string, user: string, maxTokens?: number): Promise<ClaudeResponse> {
  return callClaude({ model: SONNET_MODEL, system, user, maxTokens });
}

/**
 * Extract JSON from a Claude response that may contain markdown fences.
 */
export function extractJSON<T>(text: string): T {
  // Try to find JSON in markdown code fence
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  const jsonStr = fenceMatch ? fenceMatch[1].trim() : text.trim();
  return JSON.parse(jsonStr) as T;
}

// ═══════════════════════════════════════════════════════════════
// Claude API Client — Thin wrapper over Anthropic SDK
// Uses Haiku for cheap triage, Sonnet for accurate scoring
// ═══════════════════════════════════════════════════════════════

import Anthropic from '@anthropic-ai/sdk';

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const SONNET_MODEL = 'claude-sonnet-4-5-20250929';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }
  return client;
}

export interface ClaudeResponse {
  text: string;
  input_tokens: number;
  output_tokens: number;
  model: string;
}

async function callClaude(params: {
  model: string;
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<ClaudeResponse> {
  const anthropic = getClient();
  const { model, system, user, maxTokens = 4096, temperature = 0.2 } = params;

  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const text =
    response.content[0].type === 'text' ? response.content[0].text : '';

  return {
    text,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    model,
  };
}

/**
 * Call Claude Haiku for fast, cheap operations (event identification, triage).
 */
export async function callHaiku(system: string, user: string, maxTokens?: number): Promise<ClaudeResponse> {
  return callClaude({ model: HAIKU_MODEL, system, user, maxTokens });
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

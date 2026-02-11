import { describe, it, expect } from 'vitest';
import {
  PROMPT_VERSION,
  EVENT_IDENTIFICATION_SYSTEM,
  EVENT_IDENTIFICATION_USER,
  DUAL_SCORING_SYSTEM,
  DUAL_SCORING_USER,
} from '@/lib/scoring/prompts';

describe('PROMPT_VERSION', () => {
  it('is a non-empty version string', () => {
    expect(PROMPT_VERSION).toBeTruthy();
    expect(PROMPT_VERSION).toMatch(/^v\d+\.\d+/);
  });
});

describe('EVENT_IDENTIFICATION_SYSTEM', () => {
  it('is a non-empty string', () => {
    expect(EVENT_IDENTIFICATION_SYSTEM.length).toBeGreaterThan(100);
  });

  it('mentions political event classification', () => {
    expect(EVENT_IDENTIFICATION_SYSTEM).toContain('political event');
  });
});

describe('EVENT_IDENTIFICATION_USER', () => {
  it('is a function that produces a prompt with article text', () => {
    const result = EVENT_IDENTIFICATION_USER('Article 1: Something happened');
    expect(result).toContain('Article 1: Something happened');
    expect(result).toContain('JSON');
  });
});

describe('DUAL_SCORING_SYSTEM', () => {
  it('is a non-empty string describing dual scoring', () => {
    expect(DUAL_SCORING_SYSTEM.length).toBeGreaterThan(200);
    expect(DUAL_SCORING_SYSTEM).toContain('SCORE A');
    expect(DUAL_SCORING_SYSTEM).toContain('SCORE B');
  });

  it('mentions all A-score drivers', () => {
    expect(DUAL_SCORING_SYSTEM).toContain('Election integrity');
    expect(DUAL_SCORING_SYSTEM).toContain('Rule of law');
    expect(DUAL_SCORING_SYSTEM).toContain('Separation of powers');
    expect(DUAL_SCORING_SYSTEM).toContain('Civil rights');
    expect(DUAL_SCORING_SYSTEM).toContain('Institutional capture');
    expect(DUAL_SCORING_SYSTEM).toContain('Corruption');
    expect(DUAL_SCORING_SYSTEM).toContain('Violence');
  });

  it('mentions the noise gate', () => {
    expect(DUAL_SCORING_SYSTEM).toContain('NOISE GATE');
  });
});

describe('DUAL_SCORING_USER', () => {
  it('generates prompt with event details', () => {
    const prompt = DUAL_SCORING_USER({
      title: 'Test Event',
      summary: 'Something happened',
      mechanism: 'policy_change',
      scope: 'federal',
      affected_population: 'broad',
      articles: '1. Headline one',
    });
    expect(prompt).toContain('Test Event');
    expect(prompt).toContain('Something happened');
    expect(prompt).toContain('policy_change');
    expect(prompt).toContain('federal');
  });

  it('includes week context when provided', () => {
    const prompt = DUAL_SCORING_USER({
      title: 'Test',
      summary: 'Test',
      mechanism: null,
      scope: null,
      affected_population: null,
      articles: '',
      week_context: 'Other event 1\nOther event 2',
    });
    expect(prompt).toContain('Other event 1');
  });

  it('omits week context section when not provided', () => {
    const prompt = DUAL_SCORING_USER({
      title: 'Test',
      summary: 'Test',
      mechanism: null,
      scope: null,
      affected_population: null,
      articles: '',
    });
    expect(prompt).not.toContain('Other events this week');
  });
});

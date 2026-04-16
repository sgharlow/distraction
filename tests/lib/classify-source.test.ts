import { describe, it, expect } from 'vitest';
import { classifySource } from '@/lib/ingestion/classify-source';

describe('classifySource', () => {
  // Wire services
  it('classifies reuters.com as wire', () => {
    expect(classifySource('https://www.reuters.com/article/123', null)).toBe('wire');
  });

  it('classifies apnews.com as wire', () => {
    expect(classifySource('https://apnews.com/article/xyz', null)).toBe('wire');
  });

  it('classifies upi.com as wire', () => {
    expect(classifySource('https://upi.com/story/abc', null)).toBe('wire');
  });

  it('classifies afp.com as wire', () => {
    expect(classifySource('https://afp.com/en/article', null)).toBe('wire');
  });

  // National outlets
  it('classifies nytimes.com as national', () => {
    expect(classifySource('https://www.nytimes.com/2026/01/01/politics/story.html', null)).toBe('national');
  });

  it('classifies washingtonpost.com as national', () => {
    expect(classifySource('https://www.washingtonpost.com/politics/2026/01/01/story/', null)).toBe('national');
  });

  it('classifies cnn.com as national', () => {
    expect(classifySource('https://www.cnn.com/2026/01/01/politics/story/index.html', null)).toBe('national');
  });

  it('classifies foxnews.com as national', () => {
    expect(classifySource('https://www.foxnews.com/politics/story', null)).toBe('national');
  });

  it('classifies politico.com as national', () => {
    expect(classifySource('https://www.politico.com/news/2026/01/01/story', null)).toBe('national');
  });

  it('classifies npr.org as national', () => {
    expect(classifySource('https://www.npr.org/2026/01/01/story', null)).toBe('national');
  });

  it('classifies bbc.com as national', () => {
    expect(classifySource('https://www.bbc.com/news/world-us-canada-12345', null)).toBe('national');
  });

  it('classifies bbc.co.uk as national', () => {
    expect(classifySource('https://www.bbc.co.uk/news/12345', null)).toBe('national');
  });

  // Primary documents
  it('classifies .gov domains as primary_doc', () => {
    expect(classifySource('https://www.whitehouse.gov/briefing/statement', null)).toBe('primary_doc');
  });

  it('classifies congress.gov as primary_doc', () => {
    expect(classifySource('https://www.congress.gov/bill/117th-congress/hr-1234', null)).toBe('primary_doc');
  });

  it('classifies supremecourt.gov as primary_doc', () => {
    expect(classifySource('https://www.supremecourt.gov/opinions/22pdf/123.pdf', null)).toBe('primary_doc');
  });

  it('classifies federalregister.gov as primary_doc', () => {
    expect(classifySource('https://www.federalregister.gov/documents/2026/01/01/eo', null)).toBe('primary_doc');
  });

  it('classifies courtlistener.com as primary_doc', () => {
    expect(classifySource('https://www.courtlistener.com/docket/123/', null)).toBe('primary_doc');
  });

  it('classifies law.cornell.edu as primary_doc', () => {
    expect(classifySource('https://www.law.cornell.edu/uscode/text/18/1001', null)).toBe('primary_doc');
  });

  // Unknown / unrecognized
  it('returns null for unrecognized domains', () => {
    expect(classifySource('https://www.randomnewsblog.com/article', null)).toBeNull();
  });

  it('returns null for local news not in the lists', () => {
    expect(classifySource('https://www.denverpost.com/2026/01/01/story', null)).toBeNull();
  });

  // Invalid URLs
  it('returns null for invalid URLs', () => {
    expect(classifySource('not-a-url', null)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(classifySource('', null)).toBeNull();
  });

  // www stripping
  it('strips www prefix for matching', () => {
    expect(classifySource('https://www.reuters.com/article', null)).toBe('wire');
    expect(classifySource('https://reuters.com/article', null)).toBe('wire');
  });

  // Priority: primary_doc patterns are checked before wire/national
  it('classifies .gov domains even with other subdomain patterns', () => {
    expect(classifySource('https://data.census.gov/dataset', null)).toBe('primary_doc');
  });
});

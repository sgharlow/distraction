/**
 * Directory submission tool for The Distraction Index.
 *
 * Reads pre-drafted marketing content from marketing/ files and either:
 *   - Submits via API (Dev.to) if credentials are configured
 *   - Outputs ready-to-paste content and submission URLs for manual platforms
 *
 * Usage:
 *   npx tsx scripts/submit-directories.ts              # Submit where possible, guide the rest
 *   npx tsx scripts/submit-directories.ts --dry-run    # Preview all actions without submitting
 *
 * Environment:
 *   DEV_TO_API_KEY   — Dev.to API key (optional; skips API submission if missing)
 *   HASHNODE_TOKEN   — Hashnode personal access token (optional; future use)
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync, existsSync } from 'fs';

config({ path: resolve(__dirname, '../.env.local') });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlatformResult {
  platform: string;
  method: 'api' | 'manual';
  status: 'submitted' | 'skipped' | 'error' | 'manual-required';
  url: string;
  message: string;
  content?: {
    title?: string;
    description?: string;
    body?: string;
    tags?: string[];
    extras?: Record<string, string>;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DRY_RUN = process.argv.includes('--dry-run');
const MARKETING_DIR = resolve(__dirname, '../marketing');

function readMarketingFile(filename: string): string | null {
  const filepath = resolve(MARKETING_DIR, filename);
  if (!existsSync(filepath)) {
    return null;
  }
  // Normalize CRLF -> LF so regex patterns work consistently
  return readFileSync(filepath, 'utf-8').replace(/\r\n/g, '\n');
}

/** Extract the inner markdown from a fenced code block (```markdown ... ```) */
function extractMarkdownBody(raw: string): string {
  // The markdown body is wrapped in ```markdown\n ... \n```
  // It may contain nested code blocks (e.g., architecture diagrams).
  // Strategy: find the opening ```markdown, then scan lines tracking
  // fence depth. A line matching ```<lang> opens a fence; a bare ```
  // either closes an open nested fence or (at depth 0) is our outer close.
  const startMarker = '```markdown\n';
  const startIdx = raw.indexOf(startMarker);
  if (startIdx === -1) return '';
  const bodyStart = startIdx + startMarker.length;

  const lines = raw.slice(bodyStart).split('\n');
  let depth = 0;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (/^```\w+/.test(trimmed)) {
      // Opening fence with a language specifier (```python, ```js, etc.)
      depth++;
    } else if (trimmed === '```') {
      if (depth > 0) {
        // Closes a nested fence
        depth--;
      } else {
        // At depth 0, this toggles: if a previous bare ``` opened an
        // un-languaged block, this closes it. Otherwise this is the
        // outer closing fence. Use a simple toggle via depth going negative.
        // Actually — bare ``` at depth 0 could be either opening or closing
        // a nested un-languaged block. We can't distinguish syntactically,
        // so we look ahead: if there's another bare ``` later, this is
        // an opening fence. If there's none (or only the outer close),
        // this is our outer close.
        const remaining = lines.slice(i + 1);
        const nextBare = remaining.findIndex(l => l.trim() === '```');
        if (nextBare === -1) {
          // No more ``` lines — this must be the outer close
          return lines.slice(0, i).join('\n').trim();
        }
        // There's at least one more bare ``` — check if there's an even
        // number remaining (meaning this one opens a pair).
        let bareCount = 0;
        for (const rl of remaining) {
          if (rl.trim() === '```') bareCount++;
        }
        if (bareCount % 2 === 0) {
          // Even remaining bare fences: this one opens a nested block
          // that pairs with the next, and the rest form further pairs
          // or end with the outer close. Mark as nested open.
          depth++;
        } else {
          // Odd remaining: the remaining fences pair off evenly,
          // which means this one is the outer close.
          return lines.slice(0, i).join('\n').trim();
        }
      }
    }
  }
  // If we never found the closing fence, return everything
  return raw.slice(bodyStart).trim();
}

/** Extract a value after a markdown heading/field pattern like "## Article Title\n<value>" */
function extractField(raw: string, heading: string): string {
  const regex = new RegExp(`##\\s*${heading}\\s*\\n+(.+)`, 'i');
  const match = raw.match(regex);
  return match ? match[1].trim() : '';
}

/** Extract tags from a line like "`tag1` `tag2` `tag3`" */
function extractTags(raw: string, heading: string): string[] {
  const regex = new RegExp(`##\\s*${heading}\\s*\\n+(.+)`, 'i');
  const match = raw.match(regex);
  if (!match) return [];
  return match[1].match(/`([^`]+)`/g)?.map(t => t.replace(/`/g, '')) || [];
}

function separator(): string {
  return '─'.repeat(70);
}

// ---------------------------------------------------------------------------
// Platform handlers
// ---------------------------------------------------------------------------

async function handleDevTo(raw: string): Promise<PlatformResult> {
  const title = extractField(raw, 'Article Title');
  const tags = extractTags(raw, 'Tags');
  const body = extractMarkdownBody(raw);
  const apiKey = process.env.DEV_TO_API_KEY;

  if (!title || !body) {
    return {
      platform: 'Dev.to',
      method: 'api',
      status: 'error',
      url: 'https://dev.to/new',
      message: 'Could not parse title or body from marketing/11-devto-article.md',
    };
  }

  if (!apiKey) {
    return {
      platform: 'Dev.to',
      method: 'manual',
      status: 'manual-required',
      url: 'https://dev.to/new',
      message: 'No DEV_TO_API_KEY found. Manual submission required.',
      content: { title, body, tags },
    };
  }

  if (DRY_RUN) {
    return {
      platform: 'Dev.to',
      method: 'api',
      status: 'skipped',
      url: 'https://dev.to/new',
      message: '[DRY RUN] Would submit via API: POST https://dev.to/api/articles',
      content: { title, body, tags },
    };
  }

  // Actual API submission
  try {
    const res = await fetch('https://dev.to/api/articles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        article: {
          title,
          published: false, // create as draft — review before publishing
          body_markdown: body,
          tags: tags.slice(0, 4), // Dev.to max 4 tags
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        platform: 'Dev.to',
        method: 'api',
        status: 'error',
        url: 'https://dev.to/new',
        message: `API error ${res.status}: ${errText}`,
      };
    }

    const data = await res.json();
    return {
      platform: 'Dev.to',
      method: 'api',
      status: 'submitted',
      url: data.url || 'https://dev.to/dashboard',
      message: `Article created as DRAFT: ${data.url || data.id}`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      platform: 'Dev.to',
      method: 'api',
      status: 'error',
      url: 'https://dev.to/new',
      message: `Fetch error: ${msg}`,
    };
  }
}

async function handleProductHunt(raw: string): Promise<PlatformResult> {
  // Product Hunt section is the first section in the file
  const tagline = raw.match(/### Tagline.*\n(.+)/)?.[1]?.trim() || '';
  const descMatch = raw.match(/### Description\n([\s\S]*?)(?=\n###)/);
  const description = descMatch ? descMatch[1].trim() : '';
  const firstCommentMatch = raw.match(/### First Comment.*\n([\s\S]*?)(?=\n###)/);
  const firstComment = firstCommentMatch ? firstCommentMatch[1].trim() : '';
  const topics = raw.match(/### Topics\n(.+)/)?.[1]?.trim() || '';

  return {
    platform: 'Product Hunt',
    method: 'manual',
    status: 'manual-required',
    url: 'https://www.producthunt.com/posts/new',
    message: 'Product Hunt requires manual submission through their web UI.',
    content: {
      title: 'The Distraction Index',
      description,
      tags: topics.split(',').map(t => t.trim()),
      extras: {
        tagline,
        firstComment,
      },
    },
  };
}

async function handleBetaList(raw: string): Promise<PlatformResult> {
  const section = raw.match(/## BetaList[\s\S]*?(?=\n---|\n## (?!BetaList)|$)/)?.[0] || '';
  const tagline = section.match(/### Tagline\n(.+)/)?.[1]?.trim() || '';
  const descMatch = section.match(/### Description\n([\s\S]*?)(?=\n###|\n---|$)/);
  const description = descMatch ? descMatch[1].trim() : '';

  return {
    platform: 'BetaList',
    method: 'manual',
    status: 'manual-required',
    url: 'https://betalist.com/submit',
    message: 'BetaList requires manual form submission.',
    content: {
      title: 'The Distraction Index',
      description,
      extras: { tagline },
    },
  };
}

async function handleIndieHackers(raw: string): Promise<PlatformResult> {
  const section = raw.match(/## Indie Hackers[\s\S]*?(?=\n---|\n## (?!Indie)|$)/)?.[0] || '';
  const title = section.match(/### Title\n(.+)/)?.[1]?.trim() || '';
  const bodyMatch = section.match(/### Body\n([\s\S]*?)(?=\n---|\n## |$)/);
  const body = bodyMatch ? bodyMatch[1].trim() : '';

  return {
    platform: 'Indie Hackers',
    method: 'manual',
    status: 'manual-required',
    url: 'https://www.indiehackers.com/',
    message: 'Indie Hackers requires manual post through their web UI.',
    content: { title, body },
  };
}

async function handleItsLaunched(raw: string): Promise<PlatformResult> {
  const section = raw.match(/## ItsLaunched[\s\S]*?(?=\n---|\n## (?!ItsLaunched)|$)/)?.[0] || '';
  const descMatch = section.match(/### One-line description\n(.+)/);
  const description = descMatch ? descMatch[1].trim() : '';
  const category = section.match(/### Category\n(.+)/)?.[1]?.trim() || '';

  return {
    platform: 'ItsLaunched.com',
    method: 'manual',
    status: 'manual-required',
    url: 'https://itslaunched.com',
    message: 'ItsLaunched requires manual submission through their site.',
    content: {
      title: 'The Distraction Index',
      description,
      extras: { category },
    },
  };
}

async function handleAlternativeTo(raw: string): Promise<PlatformResult> {
  const description = raw.match(/## Description\n([\s\S]*?)(?=\n## )/)?.[1]?.trim() || '';
  const tagsSection = raw.match(/## Tags \/ Categories\n([\s\S]*?)(?=\n## )/)?.[0] || '';
  const tags = tagsSection.match(/^- (.+)/gm)?.map(t => t.replace(/^- /, '')) || [];
  const altSection = raw.match(/## Listed as Alternative To\n([\s\S]*?)(?=\n## )/)?.[0] || '';
  const alternatives = altSection.match(/\*\*(.+?)\*\*/g)?.map(t => t.replace(/\*\*/g, '')) || [];
  const differentiators = raw.match(/## Key Differentiators[\s\S]*$/)?.[0]?.trim() || '';

  return {
    platform: 'AlternativeTo',
    method: 'manual',
    status: 'manual-required',
    url: 'https://alternativeto.net/manage/new/',
    message: 'AlternativeTo requires manual form submission with screenshots.',
    content: {
      title: 'The Distraction Index',
      description,
      tags,
      extras: {
        alternatives: alternatives.join(', '),
        differentiators,
      },
    },
  };
}

async function handleCivicTechGuide(raw: string): Promise<PlatformResult> {
  const oneLiner = raw.match(/## One-Sentence Description\n(.+)/)?.[1]?.trim() || '';
  const descMatch = raw.match(/## Longer Description\n([\s\S]*?)(?=\n## )/);
  const description = descMatch ? descMatch[1].trim() : '';
  const catSection = raw.match(/## Category\n([\s\S]*?)(?=\n## )/)?.[0] || '';
  const categories = catSection.match(/^- (.+)/gm)?.map(t => t.replace(/^- /, '')) || [];
  const techMatch = raw.match(/## Technologies Used\n(.+)/);
  const technologies = techMatch ? techMatch[1].trim() : '';

  return {
    platform: 'Civic Tech Field Guide',
    method: 'manual',
    status: 'manual-required',
    url: 'https://civictech.guide/submit-listing/',
    message: 'Civic Tech Guide requires manual form submission (no account needed).',
    content: {
      title: 'The Distraction Index',
      description: `${oneLiner}\n\n${description}`,
      tags: categories,
      extras: {
        sourceCodeUrl: 'https://github.com/sgharlow/distraction',
        technologies,
        location: 'United States',
        status: 'Active / Production',
      },
    },
  };
}

async function handleHashnode(raw: string): Promise<PlatformResult> {
  const title = extractField(raw, 'Article Title');
  const subtitle = raw.match(/## Subtitle\n(.+)/)?.[1]?.trim() || '';
  const tags = extractTags(raw, 'Tags');
  const body = extractMarkdownBody(raw);

  // Hashnode has a GraphQL API, but it requires publication setup.
  // For now, treat as manual with content ready to paste.
  return {
    platform: 'Hashnode',
    method: 'manual',
    status: 'manual-required',
    url: 'https://hashnode.com/draft/new',
    message: 'Hashnode requires manual article creation (sign in via GitHub, then paste content).',
    content: {
      title,
      description: subtitle,
      body,
      tags,
    },
  };
}

// ---------------------------------------------------------------------------
// Platform registry
// ---------------------------------------------------------------------------

interface PlatformEntry {
  name: string;
  file: string;
  handler: (raw: string) => Promise<PlatformResult>;
  /** Some files contain multiple platforms; list sub-handlers */
  subPlatforms?: {
    name: string;
    handler: (raw: string) => Promise<PlatformResult>;
  }[];
}

const PLATFORMS: PlatformEntry[] = [
  {
    name: 'Product Hunt',
    file: '08-product-hunt-listing.md',
    handler: handleProductHunt,
    subPlatforms: [
      { name: 'BetaList', handler: handleBetaList },
      { name: 'Indie Hackers', handler: handleIndieHackers },
      { name: 'ItsLaunched.com', handler: handleItsLaunched },
    ],
  },
  {
    name: 'Dev.to',
    file: '11-devto-article.md',
    handler: handleDevTo,
  },
  {
    name: 'AlternativeTo',
    file: '12-alternativeto-listing.md',
    handler: handleAlternativeTo,
  },
  {
    name: 'Civic Tech Field Guide',
    file: '13-civictech-directory.md',
    handler: handleCivicTechGuide,
  },
  {
    name: 'Hashnode',
    file: '17-hashnode-article.md',
    handler: handleHashnode,
  },
];

// ---------------------------------------------------------------------------
// Output formatting
// ---------------------------------------------------------------------------

function printResult(result: PlatformResult): void {
  const statusIcon =
    result.status === 'submitted' ? '[DONE]' :
    result.status === 'skipped' ? '[SKIP]' :
    result.status === 'error' ? '[ERR!]' :
    '[TODO]';

  console.log(`\n${separator()}`);
  console.log(`${statusIcon}  ${result.platform}`);
  console.log(`       URL: ${result.url}`);
  console.log(`    Method: ${result.method}`);
  console.log(`   Message: ${result.message}`);

  if (result.content) {
    if (result.content.title) {
      console.log(`\n  Title: ${result.content.title}`);
    }
    if (result.content.tags && result.content.tags.length > 0) {
      console.log(`  Tags: ${result.content.tags.join(', ')}`);
    }
    if (result.content.description) {
      console.log(`\n  Description (first 300 chars):`);
      console.log(`  ${result.content.description.slice(0, 300).replace(/\n/g, '\n  ')}${result.content.description.length > 300 ? '...' : ''}`);
    }
    if (result.content.body) {
      const lines = result.content.body.split('\n');
      console.log(`\n  Body: ${lines.length} lines (${result.content.body.length} chars)`);
      console.log(`  Preview:`);
      lines.slice(0, 5).forEach(line => console.log(`    ${line}`));
      if (lines.length > 5) console.log(`    ... (${lines.length - 5} more lines)`);
    }
    if (result.content.extras) {
      console.log(`\n  Additional fields:`);
      for (const [key, value] of Object.entries(result.content.extras)) {
        const preview = value.length > 120 ? value.slice(0, 120) + '...' : value;
        console.log(`    ${key}: ${preview}`);
      }
    }
  }
}

function printChecklist(results: PlatformResult[]): void {
  console.log(`\n${'='.repeat(70)}`);
  console.log('SUBMISSION CHECKLIST');
  console.log(`${'='.repeat(70)}\n`);

  const submitted = results.filter(r => r.status === 'submitted');
  const manual = results.filter(r => r.status === 'manual-required');
  const skipped = results.filter(r => r.status === 'skipped');
  const errors = results.filter(r => r.status === 'error');

  if (submitted.length > 0) {
    console.log(`API-submitted (${submitted.length}):`);
    submitted.forEach(r => console.log(`  [x] ${r.platform} - ${r.message}`));
    console.log();
  }

  if (skipped.length > 0) {
    console.log(`Skipped / dry-run (${skipped.length}):`);
    skipped.forEach(r => console.log(`  [-] ${r.platform} - ${r.message}`));
    console.log();
  }

  if (manual.length > 0) {
    console.log(`Manual action needed (${manual.length}):`);
    manual.forEach(r => console.log(`  [ ] ${r.platform} -> ${r.url}`));
    console.log();
  }

  if (errors.length > 0) {
    console.log(`Errors (${errors.length}):`);
    errors.forEach(r => console.log(`  [!] ${r.platform} - ${r.message}`));
    console.log();
  }

  console.log(`Total: ${results.length} platforms | ${submitted.length} submitted | ${manual.length} manual | ${skipped.length} skipped | ${errors.length} errors`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`\nDistraction Index — Directory Submission Tool`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no submissions will be made)' : 'LIVE'}`);
  console.log(`Marketing dir: ${MARKETING_DIR}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  if (!existsSync(MARKETING_DIR)) {
    console.error(`\nError: marketing/ directory not found at ${MARKETING_DIR}`);
    console.error('Ensure the marketing content files are present locally.');
    process.exit(1);
  }

  const results: PlatformResult[] = [];

  for (const platform of PLATFORMS) {
    const raw = readMarketingFile(platform.file);

    if (!raw) {
      results.push({
        platform: platform.name,
        method: 'manual',
        status: 'error',
        url: '',
        message: `File not found: marketing/${platform.file}`,
      });
      continue;
    }

    // Process main platform
    const result = await platform.handler(raw);
    results.push(result);
    printResult(result);

    // Process sub-platforms from the same file
    if (platform.subPlatforms) {
      for (const sub of platform.subPlatforms) {
        const subResult = await sub.handler(raw);
        results.push(subResult);
        printResult(subResult);
      }
    }
  }

  printChecklist(results);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

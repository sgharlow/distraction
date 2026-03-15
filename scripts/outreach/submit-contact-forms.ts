/**
 * Automated contact form submission using Playwright.
 * Submits the Distraction Index pitch to organizations via their web contact forms.
 *
 * Setup:
 *   npx playwright install chromium
 *
 * Usage:
 *   npx tsx scripts/outreach/submit-contact-forms.ts [--dry-run] [--target="Org Name"]
 *
 * Each target defines:
 *   - URL of the contact form
 *   - CSS selectors for form fields
 *   - Pre-fill values
 *   - Custom pitch angle
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { getCurrentWeekSummary } from './week-summary';

config({ path: resolve(__dirname, '../../.env.local') });

const SUBMISSION_LOG = resolve(__dirname, 'form-submissions.json');

interface FormTarget {
  organization: string;
  url: string;
  fields: {
    name?: { selector: string; value: string };
    email?: { selector: string; value: string };
    subject?: { selector: string; value: string };
    message?: { selector: string };  // value generated from week data
    category?: { selector: string; value: string };  // dropdown
  };
  submitSelector: string;
  pitchAngle: string;
  notes?: string;
}

interface SubmissionRecord {
  organization: string;
  url: string;
  submittedAt: string;
  status: 'submitted' | 'failed';
  error?: string;
}

// Contact form targets for constitutional protection organizations
// Selectors are best-effort — may need adjustment if forms change
const FORM_TARGETS: FormTarget[] = [
  {
    organization: 'Democracy Now!',
    url: 'https://www.democracynow.org/contact',
    fields: {
      name: { selector: 'input[name="name"], #name, input[placeholder*="name" i]', value: 'Steve' },
      email: { selector: 'input[name="email"], #email, input[type="email"]', value: '' },
      subject: { selector: 'input[name="subject"], #subject', value: 'Story Idea: Weekly data tracking democratic damage vs. distractions' },
      message: { selector: 'textarea[name="message"], #message, textarea' },
      category: { selector: 'select[name="category"], #category, select', value: 'Story Ideas' },
    },
    submitSelector: 'button[type="submit"], input[type="submit"], button:has-text("Send"), button:has-text("Submit")',
    pitchAngle: 'As an independent news institution, your audience would benefit from data showing which democratic damage events are being systematically buried under manufactured distractions.',
  },
  {
    organization: 'Brian Tyler Cohen',
    url: 'https://www.briantylercohen.com/',
    fields: {
      name: { selector: 'input[name="name"], #name, input[placeholder*="name" i]', value: 'Steve' },
      email: { selector: 'input[name="email"], #email, input[type="email"]', value: '' },
      message: { selector: 'textarea[name="message"], #message, textarea' },
    },
    submitSelector: 'button[type="submit"], input[type="submit"]',
    pitchAngle: 'Your "Democracy Watch" segment with Marc Elias is the single best thematic match for the Distraction Index — we quantify exactly what Democracy Watch covers qualitatively.',
  },
  {
    organization: 'Glenn Kirschner',
    url: 'https://glennkirschner.com/',
    fields: {
      name: { selector: 'input[name="name"], #name, input[placeholder*="name" i]', value: 'Steve' },
      email: { selector: 'input[name="email"], #email, input[type="email"]', value: '' },
      message: { selector: 'textarea[name="message"], #message, textarea' },
    },
    submitSelector: 'button[type="submit"], input[type="submit"]',
    pitchAngle: 'As a former 30-year federal prosecutor focused on justice, the Distraction Index tracks exactly when justice is being sidelined by manufactured distractions.',
  },
  {
    organization: 'The Lincoln Project',
    url: 'https://lincolnproject.us/contact-lp/',
    fields: {
      name: { selector: 'input[name="name"], #name, input[placeholder*="name" i]', value: 'Steve' },
      email: { selector: 'input[name="email"], #email, input[type="email"]', value: '' },
      message: { selector: 'textarea[name="message"], #message, textarea' },
    },
    submitSelector: 'button[type="submit"], input[type="submit"]',
    pitchAngle: 'The Distraction Index provides concrete data for your rapid-response campaigns — quantified evidence of when democratic damage is being hidden behind manufactured controversies.',
  },
  {
    organization: 'Adam Kinzinger / Country First',
    url: 'https://www.country1st.com/contact',
    fields: {
      name: { selector: 'input[name="name"], #name, input[placeholder*="name" i]', value: 'Steve' },
      email: { selector: 'input[name="email"], #email, input[type="email"]', value: '' },
      message: { selector: 'textarea[name="message"], #message, textarea' },
    },
    submitSelector: 'button[type="submit"], input[type="submit"]',
    pitchAngle: 'Country First\'s civic education mission aligns perfectly — the Distraction Index gives citizens a bipartisan, data-driven way to see through political noise.',
  },
  {
    organization: 'Rick Wilson',
    url: 'https://www.therickwilson.com/contact/',
    fields: {
      name: { selector: 'input[name="name"], #name, input[placeholder*="name" i]', value: 'Steve' },
      email: { selector: 'input[name="email"], #email, input[type="email"]', value: '' },
      message: { selector: 'textarea[name="message"], #message, textarea' },
    },
    submitSelector: 'button[type="submit"], input[type="submit"]',
    pitchAngle: 'Your anti-authoritarian commentary would be strengthened by data quantifying how constitutional damage events are systematically buried under manufactured spectacle.',
  },
  {
    organization: 'David Pakman',
    url: 'https://davidpakman.com/contact/',
    fields: {
      name: { selector: 'input[name="name"], #name, input[placeholder*="name" i]', value: 'Steve' },
      email: { selector: 'input[name="email"], #email, input[type="email"]', value: '' },
      subject: { selector: 'input[name="subject"], #subject', value: 'Civic data tool: weekly distraction vs. damage scoring' },
      message: { selector: 'textarea[name="message"], #message, textarea' },
    },
    submitSelector: 'button[type="submit"], input[type="submit"]',
    pitchAngle: 'Your data-driven, analytical approach makes the Distraction Index a natural fit — we provide the quantified framework your audience can use to cut through political noise.',
  },
  {
    organization: 'Crooked Media',
    url: 'https://crooked.com/contact/',
    fields: {
      name: { selector: 'input[name="name"], #name, input[placeholder*="name" i]', value: 'Steve' },
      email: { selector: 'input[name="email"], #email, input[type="email"]', value: '' },
      subject: { selector: 'input[name="subject"], #subject', value: 'Civic data tool for Strict Scrutiny / Pod Save America' },
      message: { selector: 'textarea[name="message"], #message, textarea' },
    },
    submitSelector: 'button[type="submit"], input[type="submit"]',
    pitchAngle: 'Strict Scrutiny covers constitutional law — the Distraction Index quantifies exactly which constitutional damage events are being buried. A natural data source for your coverage.',
  },
];

function loadSubmissionLog(): SubmissionRecord[] {
  if (!existsSync(SUBMISSION_LOG)) return [];
  return JSON.parse(readFileSync(SUBMISSION_LOG, 'utf-8'));
}

function saveSubmissionLog(log: SubmissionRecord[]): void {
  writeFileSync(SUBMISSION_LOG, JSON.stringify(log, null, 2));
}

async function submitForm(
  target: FormTarget,
  messageBody: string,
  senderEmail: string,
  dryRun: boolean
): Promise<boolean> {
  if (dryRun) {
    console.log(`  [DRY RUN] Would submit form at: ${target.url}`);
    console.log(`  Message preview: ${messageBody.substring(0, 150)}...`);
    return true;
  }

  // Dynamic import to avoid requiring playwright when not using this script
  const { chromium } = await import('playwright');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log(`  Navigating to ${target.url}...`);
    await page.goto(target.url, { waitUntil: 'networkidle', timeout: 30000 });

    // Fill name
    if (target.fields.name) {
      const nameEl = await page.$(target.fields.name.selector);
      if (nameEl) {
        await nameEl.fill(target.fields.name.value);
        console.log('  Filled: name');
      }
    }

    // Fill email
    if (target.fields.email) {
      const emailEl = await page.$(target.fields.email.selector);
      if (emailEl) {
        await emailEl.fill(senderEmail);
        console.log('  Filled: email');
      }
    }

    // Fill subject
    if (target.fields.subject) {
      const subjectEl = await page.$(target.fields.subject.selector);
      if (subjectEl) {
        await subjectEl.fill(target.fields.subject.value);
        console.log('  Filled: subject');
      }
    }

    // Select category if present
    if (target.fields.category) {
      const catEl = await page.$(target.fields.category.selector);
      if (catEl) {
        await catEl.selectOption({ label: target.fields.category.value });
        console.log(`  Selected category: ${target.fields.category.value}`);
      }
    }

    // Fill message
    if (target.fields.message) {
      const msgEl = await page.$(target.fields.message.selector);
      if (msgEl) {
        await msgEl.fill(messageBody);
        console.log('  Filled: message');
      }
    }

    // Take screenshot before submitting for verification
    const screenshotPath = resolve(__dirname, `screenshots/${target.organization.replace(/[^a-z0-9]/gi, '-')}.png`);
    const { mkdirSync } = await import('fs');
    mkdirSync(resolve(__dirname, 'screenshots'), { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`  Screenshot saved: ${screenshotPath}`);

    // Submit the form
    const submitBtn = await page.$(target.submitSelector);
    if (submitBtn) {
      await submitBtn.click();
      console.log('  Form submitted!');

      // Wait for navigation or confirmation
      await page.waitForTimeout(3000);

      // Take post-submit screenshot
      const afterPath = resolve(__dirname, `screenshots/${target.organization.replace(/[^a-z0-9]/gi, '-')}-after.png`);
      await page.screenshot({ path: afterPath, fullPage: true });
      console.log(`  Post-submit screenshot: ${afterPath}`);
    } else {
      console.log('  WARNING: Submit button not found. Screenshot saved for manual review.');
      return false;
    }

    return true;
  } catch (err: any) {
    console.error(`  Form submission error: ${err.message}`);
    return false;
  } finally {
    await browser.close();
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const targetArg = process.argv.find(a => a.startsWith('--target='));
  const targetFilter = targetArg?.split('=')[1];

  const senderEmail = process.env.OUTREACH_FROM_EMAIL || '';
  if (!senderEmail && !dryRun) {
    console.error('Set OUTREACH_FROM_EMAIL in .env.local');
    process.exit(1);
  }

  console.log('Fetching current week summary...');
  const summary = await getCurrentWeekSummary();

  const submissionLog = loadSubmissionLog();

  // Filter targets
  let targets = FORM_TARGETS;
  if (targetFilter) {
    targets = targets.filter(t =>
      t.organization.toLowerCase().includes(targetFilter.toLowerCase())
    );
  }

  // Skip already-submitted (in last 30 days)
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  targets = targets.filter(t => {
    const recent = submissionLog.find(
      s => s.organization === t.organization &&
        s.status === 'submitted' &&
        new Date(s.submittedAt).getTime() > thirtyDaysAgo
    );
    if (recent) {
      console.log(`Skipping ${t.organization} — already submitted on ${recent.submittedAt}`);
    }
    return !recent;
  });

  if (targets.length === 0) {
    console.log('\nNo forms to submit. All targets were recently submitted or filtered out.');
    return;
  }

  console.log(`\nSubmitting to ${targets.length} contact forms...\n`);

  let submitted = 0;
  let failed = 0;

  for (const target of targets) {
    console.log(`\n[${target.organization}]`);

    // Generate message with fresh data
    const topDamage = summary.topDamage
      ? `This week's highest constitutional damage event: "${summary.topDamage.title}" (${summary.topDamage.scoreA}/100).`
      : '';
    const topDistraction = summary.topDistraction
      ? `Top distraction: "${summary.topDistraction.title}" (${summary.topDistraction.scoreB}/100).`
      : '';

    const message = [
      `Hi,`,
      ``,
      `I built The Distraction Index (distractionindex.org) — a civic data tool that scores democratic damage vs. manufactured distractions each week. Every event gets a dual score: how much constitutional damage it causes and how much it serves as a distraction.`,
      ``,
      `${topDamage} ${topDistraction}${summary.smokescreenPairs > 0 ? ` We detected ${summary.smokescreenPairs} smokescreen pairs this week.` : ''}`,
      ``,
      target.pitchAngle,
      ``,
      `Full report: https://distractionindex.org/week/${summary.weekId}`,
      `Methodology: https://distractionindex.org/methodology`,
      ``,
      `Would love to hear your thoughts.`,
      ``,
      `Best,`,
      `Steve`,
      `distractionindex.org`,
    ].join('\n');

    const ok = await submitForm(target, message, senderEmail, dryRun);

    if (ok) {
      submitted++;
    } else {
      failed++;
    }

    if (!dryRun) {
      submissionLog.push({
        organization: target.organization,
        url: target.url,
        submittedAt: new Date().toISOString(),
        status: ok ? 'submitted' : 'failed',
      });
    }

    // Be polite — wait between submissions
    if (!dryRun) await new Promise(r => setTimeout(r, 5000));
  }

  if (!dryRun) saveSubmissionLog(submissionLog);

  console.log(`\n=== Form submissions complete ===`);
  console.log(`Submitted: ${submitted}, Failed: ${failed}, Total: ${targets.length}`);
  if (dryRun) console.log('(DRY RUN — no forms were actually submitted)');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

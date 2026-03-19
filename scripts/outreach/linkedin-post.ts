/**
 * Post to LinkedIn Company Page via Playwright.
 * LinkedIn API requires verified app (weeks), so we use browser automation.
 *
 * NOTE: LinkedIn requires phone app challenge on each new login session.
 * This script works best when run manually or when the browser session
 * is still active from a recent login.
 *
 * Usage:
 *   npx tsx scripts/outreach/linkedin-post.ts [--dry-run] [--slot morning|midday|evening]
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { generatePost, type PostSlot } from './content-variants';

config({ path: resolve(__dirname, '../../.env.local') });

async function postToLinkedIn(text: string, dryRun: boolean): Promise<boolean> {
  if (dryRun) {
    console.log('[DRY RUN] Would post to LinkedIn Company Page:');
    console.log(text);
    return true;
  }

  const companyId = process.env.LINKEDIN_COMPANY_ID;
  const email = process.env.LINKEDIN_EMAIL;
  if (!companyId || !email) {
    console.error('Missing LINKEDIN_COMPANY_ID or LINKEDIN_EMAIL in .env.local');
    return false;
  }

  const { chromium } = await import('playwright');
  // Use persistent context to keep LinkedIn session alive across runs
  const userDataDir = resolve(__dirname, '.linkedin-session');
  const context = await chromium.launchPersistentContext(userDataDir, { headless: false });
  const page = context.pages()[0] || await context.newPage();

  try {
    // Navigate to company post page
    await page.goto(
      `https://www.linkedin.com/company/${companyId}/admin/page-posts/published?share=true&shareActorType=ORGANIZATION&shareOrganizationActor=urn%3Ali%3Afsd_company%3A${companyId}`,
      { waitUntil: 'networkidle', timeout: 30000 }
    );
    await page.waitForTimeout(3000);

    // Check if we need to log in
    const loginCheck = page.getByRole('textbox', { name: /email|phone/i });
    const isLoginPage = await loginCheck.isVisible().catch(() => false);

    if (isLoginPage) {
      console.log('  LinkedIn session expired — need manual login.');
      console.log('  Please log in and approve the app challenge on your phone.');
      console.log('  The persistent session will be saved for future runs.');
      // Wait for user to log in manually (headless: false so they can see the browser)
      await page.waitForURL('**/company/**', { timeout: 120000 });
      await page.waitForTimeout(3000);
    }

    // Look for the share/post dialog or composer
    const shareBox = page.getByRole('textbox').first();
    await shareBox.waitFor({ state: 'visible', timeout: 15000 });
    await shareBox.fill(text);
    await page.waitForTimeout(1000);

    // Click Post button
    const postBtn = page.getByRole('button', { name: /post/i }).last();
    await postBtn.click();
    await page.waitForTimeout(3000);

    console.log('Posted to LinkedIn Company Page successfully');
    return true;
  } catch (err: any) {
    console.error('LinkedIn post error:', err.message);
    return false;
  } finally {
    await context.close();
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const slotArg = process.argv.find(a => a.startsWith('--slot='));
  const slot = (slotArg?.split('=')[1] || 'midday') as PostSlot;

  console.log('Generating post content...');
  const post = await generatePost(slot);

  // LinkedIn prefers slightly more professional framing
  const linkedInText = post.text + '\n\n#DistractionIndex #Democracy #CivicTech #ConstitutionalLaw #GovTech';

  console.log(`\n--- LinkedIn post (${post.variant}) ---`);
  console.log(linkedInText);
  console.log(`--- ${linkedInText.length} chars ---\n`);

  const ok = await postToLinkedIn(linkedInText, dryRun);
  if (!ok) process.exit(1);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

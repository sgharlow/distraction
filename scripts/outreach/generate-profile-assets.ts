/**
 * Generate social media profile assets for all 4 platforms.
 * Creates banner images and outputs bio text.
 *
 * Usage: npx tsx scripts/outreach/generate-profile-assets.ts
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';

const ASSETS_DIR = resolve(__dirname, 'profile-assets');

// Ensure output directory exists
if (!existsSync(ASSETS_DIR)) mkdirSync(ASSETS_DIR, { recursive: true });

// ============================================================
// BIO TEXT FOR EACH PLATFORM
// ============================================================

const bios = {
  threads: {
    maxChars: 150,
    text: `Tracking democratic damage vs. manufactured distractions. Weekly scores. Open source. See through the noise.\ndistractionindex.org`,
  },
  bluesky: {
    maxChars: 256,
    text: `The Distraction Index — weekly civic intelligence scoring U.S. political events on two axes: constitutional damage vs. media hype.\n\n59+ weeks · 1,500+ events · Open source\n🔴 A-Score: Real damage  🟠 B-Score: Manufactured noise\n\ndistractionindex.org`,
  },
  mastodon: {
    maxChars: 500,
    text: `The Distraction Index publishes a frozen, immutable weekly record of U.S. political events scored on two independent axes:\n\n🔴 A-Score: Constitutional damage (governance harm, reversibility, precedent)\n🟠 B-Score: Distraction/Hype (media amplification, strategic manipulation)\n\nWhen damage is high but coverage is low, that's a red flag.\n\n59+ weeks of data · 1,500+ scored events · 210+ smokescreen pairs detected\n\nIndependent · Ad-free · Open source\nCreated by @sgharlow`,
  },
  linkedin: {
    text: `The Distraction Index is an independent civic intelligence platform that publishes a weekly, frozen record of U.S. political events scored on two axes: constitutional damage and media hype.\n\nEvery week since December 2024, we've tracked, clustered, and scored political events using transparent, auditable algorithms — then frozen the results permanently. No silent edits. No editorial spin.\n\nOur dual scoring system measures:\n• A-Score (Constitutional Damage): 7 weighted governance drivers with severity multipliers\n• B-Score (Distraction/Hype): Media amplification + strategic manipulation analysis\n\nWhen an event scores high for damage but low for coverage, our Smokescreen Index flags it.\n\n59+ weeks · 1,500+ scored events · 11,800+ articles analyzed · Fully open source\n\ndistractionindex.org | github.com/sgharlow/distraction`,
  },
};

// ============================================================
// BANNER IMAGE HTML TEMPLATES
// ============================================================

function createBannerHTML(width: number, height: number, variant: 'standard' | 'wide' | 'linkedin'): string {
  const isWide = variant === 'linkedin';
  const titleSize = isWide ? 28 : 56;
  const taglineSize = isWide ? 14 : 26;
  const scoreSize = isWide ? 11 : 18;
  const footerSize = isWide ? 10 : 16;
  const padding = isWide ? '20px 40px' : '80px 80px';
  const gap = isWide ? 24 : 40;
  const scoreGap = isWide ? 20 : 40;

  return `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
  body {
    width: ${width}px;
    height: ${height}px;
    background: #050510;
    font-family: 'Inter', system-ui, sans-serif;
    display: flex;
    flex-direction: column;
    justify-content: ${isWide ? 'center' : 'space-between'};
    padding: ${padding};
    overflow: hidden;
  }
  .brand {
    font-size: ${isWide ? 10 : 16}px;
    font-weight: 800;
    color: #818CF8;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    margin-bottom: ${isWide ? 6 : 12}px;
  }
  .title {
    font-size: ${titleSize}px;
    font-weight: 800;
    color: #F3F4F6;
    line-height: 1.15;
    margin-bottom: ${isWide ? 6 : 14}px;
  }
  .tagline {
    font-size: ${taglineSize}px;
    color: #9CA3AF;
    line-height: 1.4;
    margin-bottom: ${gap}px;
  }
  .scores {
    display: flex;
    gap: ${scoreGap}px;
    margin-bottom: ${isWide ? 8 : 20}px;
  }
  .score-item {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .score-dot {
    width: ${isWide ? 8 : 14}px;
    height: ${isWide ? 8 : 14}px;
    border-radius: 2px;
  }
  .score-dot.damage { background: #DC2626; }
  .score-dot.distraction { background: #D97706; }
  .score-label {
    font-size: ${scoreSize}px;
    font-weight: 700;
    letter-spacing: 0.1em;
  }
  .score-label.damage { color: #DC2626; }
  .score-label.distraction { color: #D97706; }
  .stats {
    display: flex;
    gap: ${isWide ? 16 : 28}px;
    margin-bottom: ${isWide ? 8 : 16}px;
  }
  .stat {
    display: flex;
    align-items: baseline;
    gap: 4px;
  }
  .stat-number {
    font-size: ${isWide ? 16 : 36}px;
    font-weight: 800;
    color: #F3F4F6;
  }
  .stat-label {
    font-size: ${isWide ? 9 : 16}px;
    color: #838B98;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .footer-left {
    font-size: ${footerSize}px;
    color: #838B98;
  }
  .footer-right {
    font-size: ${footerSize}px;
    color: #838B98;
  }
  .divider {
    width: 100%;
    height: 1px;
    background: linear-gradient(to right, #DC2626, #D97706, #818CF8);
    margin: ${isWide ? 8 : 20}px 0;
    opacity: 0.6;
  }
</style>
</head>
<body>
  <div class="brand">DISTRACTIONINDEX.ORG</div>
  <div class="title">The Distraction Index</div>
  <div class="tagline">Weekly civic intelligence: tracking democratic damage<br>vs. manufactured distractions.</div>
  <div class="divider"></div>
  <div class="scores">
    <div class="score-item">
      <div class="score-dot damage"></div>
      <div class="score-label damage">A-SCORE: CONSTITUTIONAL DAMAGE</div>
    </div>
    <div class="score-item">
      <div class="score-dot distraction"></div>
      <div class="score-label distraction">B-SCORE: DISTRACTION / HYPE</div>
    </div>
  </div>
  <div class="stats">
    <div class="stat">
      <div class="stat-number">59+</div>
      <div class="stat-label">weeks</div>
    </div>
    <div class="stat">
      <div class="stat-number">1,500+</div>
      <div class="stat-label">events scored</div>
    </div>
    <div class="stat">
      <div class="stat-number">210+</div>
      <div class="stat-label">smokescreens</div>
    </div>
  </div>
  <div class="footer">
    <div class="footer-left">Independent · Open Source · Immutable Weekly Records</div>
    <div class="footer-right">Since December 2024</div>
  </div>
</body>
</html>`;
}

function createAvatarHTML(): string {
  return `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@700;800&display=swap');
  body {
    width: 400px;
    height: 400px;
    background: #050510;
    font-family: 'Inter', system-ui, sans-serif;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  .icon {
    display: flex;
    gap: 3px;
    align-items: flex-end;
    margin-bottom: 4px;
  }
  .bar {
    width: 16px;
    border-radius: 3px 3px 0 0;
  }
  .bar1 { height: 32px; background: #DC2626; }
  .bar2 { height: 52px; background: #D97706; }
  .bar3 { height: 72px; background: #818CF8; }
  .bar4 { height: 48px; background: #059669; }
  .title {
    font-size: 36px;
    font-weight: 800;
    color: #F3F4F6;
    text-align: center;
    line-height: 1.1;
  }
  .subtitle {
    font-size: 14px;
    font-weight: 700;
    color: #818CF8;
    letter-spacing: 0.15em;
    text-transform: uppercase;
  }
  .gradient-line {
    width: 120px;
    height: 3px;
    background: linear-gradient(to right, #DC2626, #D97706, #818CF8);
    border-radius: 2px;
  }
</style>
</head>
<body>
  <div class="container">
    <div class="icon">
      <div class="bar bar1"></div>
      <div class="bar bar2"></div>
      <div class="bar bar3"></div>
      <div class="bar bar4"></div>
    </div>
    <div class="gradient-line"></div>
    <div class="title">Distraction<br>Index</div>
    <div class="subtitle">distractionindex.org</div>
  </div>
</body>
</html>`;
}

async function generateImages() {
  console.log('Generating profile assets...\n');

  const browser = await chromium.launch({ headless: true });

  const specs = [
    { name: 'avatar-400x400', html: createAvatarHTML(), width: 400, height: 400 },
    { name: 'banner-bluesky-3000x1000', html: createBannerHTML(3000, 1000, 'standard'), width: 3000, height: 1000 },
    { name: 'banner-mastodon-1500x500', html: createBannerHTML(1500, 500, 'standard'), width: 1500, height: 500 },
    { name: 'banner-linkedin-1584x396', html: createBannerHTML(1584, 396, 'linkedin'), width: 1584, height: 396 },
    { name: 'banner-threads-1500x500', html: createBannerHTML(1500, 500, 'standard'), width: 1500, height: 500 },
  ];

  for (const spec of specs) {
    const page = await browser.newPage({ viewport: { width: spec.width, height: spec.height } });
    await page.setContent(spec.html);
    await page.waitForTimeout(1000); // Wait for font loading

    const path = resolve(ASSETS_DIR, `${spec.name}.png`);
    await page.screenshot({ path, type: 'png' });
    await page.close();
    console.log(`  ✓ ${spec.name}.png (${spec.width}x${spec.height})`);
  }

  await browser.close();

  // Output bio text
  console.log('\n=== BIO TEXT ===\n');

  for (const [platform, bio] of Object.entries(bios)) {
    const charInfo = 'maxChars' in bio ? ` (${bio.text.length}/${bio.maxChars} chars)` : '';
    console.log(`--- ${platform.toUpperCase()}${charInfo} ---`);
    console.log(bio.text);
    console.log();
  }

  // Save bios to a text file for easy copy-paste
  let bioFile = '# Social Media Profile Bios\n# Generated for The Distraction Index\n# Copy-paste these into each platform\n\n';
  for (const [platform, bio] of Object.entries(bios)) {
    const charInfo = 'maxChars' in bio ? ` (${bio.text.length}/${bio.maxChars} chars)` : '';
    bioFile += `## ${platform.toUpperCase()}${charInfo}\n\n${bio.text}\n\n---\n\n`;
  }
  writeFileSync(resolve(ASSETS_DIR, 'bios.md'), bioFile);
  console.log('Bios saved to profile-assets/bios.md');

  // Platform-specific instructions
  console.log('\n=== SETUP INSTRUCTIONS ===\n');

  console.log('THREADS (@distractionindex):');
  console.log('  1. Upload avatar-400x400.png as profile picture');
  console.log('  2. Set bio text from bios.md');
  console.log('  3. Follow these 10 accounts for civic/democracy content:');
  console.log('     @acabornestein, @rebeccasolnit, @propublica, @brennancenter,');
  console.log('     @mabornestein, @nikole.hannah.jones, @washingtonpost,');
  console.log('     @nytimes, @theatlantic, @guardian');
  console.log();

  console.log('BLUESKY (@sgharlow.bsky.social):');
  console.log('  1. Go to Settings > Edit Profile');
  console.log('  2. Set display name: "The Distraction Index"');
  console.log('  3. Upload avatar-400x400.png as avatar');
  console.log('  4. Upload banner-bluesky-3000x1000.png as banner');
  console.log('  5. Set bio text from bios.md');
  console.log();

  console.log('MASTODON (@sgharlow@mastodon.social):');
  console.log('  1. Go to Preferences > Profile');
  console.log('  2. Set display name: "The Distraction Index"');
  console.log('  3. Upload avatar-400x400.png as avatar');
  console.log('  4. Upload banner-mastodon-1500x500.png as header');
  console.log('  5. Set bio text from bios.md');
  console.log('  6. Add profile metadata:');
  console.log('     Website: https://distractionindex.org');
  console.log('     GitHub: https://github.com/sgharlow/distraction');
  console.log('     Methodology: https://distractionindex.org/methodology');
  console.log('     Weekly Report: https://distractionindex.org/week/current');
  console.log();

  console.log('LINKEDIN (The Distraction Index):');
  console.log('  1. Go to Company Page > Edit Page');
  console.log('  2. Upload banner-linkedin-1584x396.png as cover image');
  console.log('  3. Update About/Description with bio text from bios.md');
  console.log('  4. Set tagline: "Weekly civic intelligence: democratic damage vs. manufactured distractions"');
  console.log('  5. Set website: https://distractionindex.org');
  console.log('  6. Industry: Civic & Social Organization or Technology/Information');
  console.log();

  console.log(`All images saved to: ${ASSETS_DIR}`);
}

generateImages().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

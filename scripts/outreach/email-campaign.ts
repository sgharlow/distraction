/**
 * Automated email follow-up campaign using Resend API.
 *
 * Reads outreach-contacts.csv, identifies contacts that were emailed
 * but haven't responded, and sends personalized follow-ups with
 * fresh data from the current week.
 *
 * Setup:
 *   1. Sign up at resend.com (free: 100 emails/day, 3000/month)
 *   2. Verify your sending domain OR use onboarding@resend.dev for testing
 *   3. Add to .env.local:
 *      RESEND_API_KEY=re_xxxxxxxxxxxx
 *      OUTREACH_FROM_EMAIL=shariq@distractionindex.org (or your verified domain)
 *      OUTREACH_FROM_NAME=Steve - Distraction Index
 *
 * Usage:
 *   npx tsx scripts/outreach/email-campaign.ts [--dry-run] [--target "Organization Name"]
 *   npx tsx scripts/outreach/email-campaign.ts --new-targets  (email constitutional orgs)
 *   npx tsx scripts/outreach/email-campaign.ts --followup     (follow up non-responders)
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { getCurrentWeekSummary, formatEmailPitch } from './week-summary';

config({ path: resolve(__dirname, '../../.env.local') });

const CONTACTS_CSV = resolve(__dirname, '../../outreach-contacts.csv');
const SENT_LOG = resolve(__dirname, 'email-sent-log.json');

interface Contact {
  name: string;
  organization: string;
  email: string;
  status: string;
  contactMethod: string;
  notes: string;
}

interface SentRecord {
  email: string;
  sentAt: string;
  type: 'initial' | 'followup-1' | 'followup-2' | 'followup-3';
  subject: string;
}

function loadContacts(): Contact[] {
  const csv = readFileSync(CONTACTS_CSV, 'utf-8');
  const lines = csv.trim().split('\n');
  const contacts: Contact[] = [];

  for (let i = 1; i < lines.length; i++) {
    // Simple CSV parse (handles quoted fields)
    const fields = parseCSVLine(lines[i]);
    if (fields.length >= 5 && fields[2]) {
      contacts.push({
        name: fields[0],
        organization: fields[1],
        email: fields[2],
        status: fields[3],
        contactMethod: fields[4],
        notes: fields[5] || '',
      });
    }
  }

  return contacts;
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function loadSentLog(): SentRecord[] {
  if (!existsSync(SENT_LOG)) return [];
  return JSON.parse(readFileSync(SENT_LOG, 'utf-8'));
}

function saveSentLog(log: SentRecord[]): void {
  writeFileSync(SENT_LOG, JSON.stringify(log, null, 2));
}

function getFollowUpContacts(contacts: Contact[], sentLog: SentRecord[]): Contact[] {
  const now = Date.now();
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

  return contacts.filter(c => {
    if (!c.email || c.status === 'BOUNCED') return false;
    if (!c.status.startsWith('EMAILED')) return false;

    // Check how many follow-ups already sent
    const sentToThis = sentLog.filter(s => s.email === c.email);
    const followUps = sentToThis.filter(s => s.type.startsWith('followup'));

    // Max 3 follow-ups
    if (followUps.length >= 3) return false;

    // Enforce 7-day minimum wait since last email to this contact
    const lastSent = sentToThis.reduce((latest, s) => {
      const t = new Date(s.sentAt).getTime();
      return t > latest ? t : latest;
    }, 0);
    if (lastSent > 0 && (now - lastSent) < SEVEN_DAYS_MS) return false;

    return true;
  });
}

function getNextFollowUpType(email: string, sentLog: SentRecord[]): 'followup-1' | 'followup-2' | 'followup-3' {
  const sent = sentLog.filter(s => s.email === email && s.type.startsWith('followup'));
  if (sent.length === 0) return 'followup-1';
  if (sent.length === 1) return 'followup-2';
  return 'followup-3';
}

function getFocusLine(org: string, notes: string): string {
  // Customize pitch angle based on organization type
  const lower = (org + ' ' + notes).toLowerCase();

  if (lower.includes('legal') || lower.includes('law') || lower.includes('court') || lower.includes('justice'))
    return 'Your legal analysis coverage would benefit from quantified data showing when high-damage constitutional events are being buried under media noise.';

  if (lower.includes('democracy') || lower.includes('voting') || lower.includes('civic'))
    return 'Your democracy protection work aligns directly with our mission — the data shows which democratic damage events are being deliberately obscured.';

  if (lower.includes('investigat') || lower.includes('journalist') || lower.includes('press') || lower.includes('news'))
    return 'As an investigative outlet, you could use this data to identify stories that are being systematically undercovered while distraction events dominate.';

  if (lower.includes('ethic') || lower.includes('accountab') || lower.includes('oversight') || lower.includes('transparen'))
    return 'Your accountability work is strengthened by data showing which government actions are being shielded from public scrutiny by manufactured distractions.';

  if (lower.includes('podcast') || lower.includes('youtube') || lower.includes('show'))
    return 'The weekly index gives your audience a data-driven framework to cut through the noise and focus on what actually matters.';

  return 'This data directly supports your mission by quantifying which democratic damage events are being obscured by manufactured distractions.';
}

async function sendEmail(
  to: string,
  subject: string,
  body: string,
  dryRun: boolean
): Promise<boolean> {
  if (dryRun) {
    console.log(`  [DRY RUN] Would send to: ${to}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Body preview: ${body.substring(0, 150)}...`);
    return true;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.OUTREACH_FROM_EMAIL || 'onboarding@resend.dev';
  const fromName = process.env.OUTREACH_FROM_NAME || 'Distraction Index';

  if (!apiKey) {
    throw new Error('Missing RESEND_API_KEY in .env.local. Sign up at resend.com');
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject,
      text: body,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`  Failed to send to ${to}: ${res.status} ${err}`);
    return false;
  }

  console.log(`  Sent to: ${to}`);
  return true;
}

// New constitutional protection organizations not in the current outreach list
const CONSTITUTIONAL_TARGETS: Contact[] = [
  { name: 'Press', organization: 'ACLU', email: 'media@aclu.org', status: 'NEW', contactMethod: 'Email', notes: 'Civil liberties. Constitutional rights defense.' },
  { name: 'Press', organization: 'Constitutional Accountability Center', email: 'info@theusconstitution.org', status: 'NEW', contactMethod: 'Email', notes: 'Constitutional law think tank.' },
  { name: 'Press', organization: 'Campaign Legal Center', email: 'info@campaignlegalcenter.org', status: 'NEW', contactMethod: 'Email', notes: 'Election law, voting rights, government ethics.' },
  { name: 'Press', organization: 'Free Press', email: 'info@freepress.net', status: 'NEW', contactMethod: 'Email', notes: 'Media and internet freedom. First Amendment.' },
  { name: 'Press', organization: 'PEN America', email: 'press@pen.org', status: 'NEW', contactMethod: 'Email', notes: 'Free expression. Press freedom.' },
  { name: 'Press', organization: 'Reporters Committee for Freedom of the Press', email: 'info@rcfp.org', status: 'NEW', contactMethod: 'Email', notes: 'Press freedom legal defense. First Amendment.' },
  { name: 'Press', organization: 'Stand Up America', email: 'press@standupamerica.com', status: 'NEW', contactMethod: 'Email', notes: 'Grassroots democracy org. 2M+ community.' },
  { name: 'Press', organization: 'People For the American Way', email: 'media@pfaw.org', status: 'NEW', contactMethod: 'Email', notes: 'Constitutional values. Anti-extremism.' },
  { name: 'Press', organization: 'Alliance for Justice', email: 'alliance@afj.org', status: 'NEW', contactMethod: 'Email', notes: 'Judicial nominations. Constitutional advocacy.' },
  { name: 'Press', organization: 'Fix the Court', email: 'info@fixthecourt.com', status: 'NEW', contactMethod: 'Email', notes: 'SCOTUS transparency and accountability.' },
  { name: 'Tips', organization: 'Common Dreams', email: 'newsroom@commondreams.org', status: 'NEW', contactMethod: 'Email', notes: 'Progressive news. Democracy coverage.' },
  { name: 'Tips', organization: 'Truthout', email: 'editor@truthout.org', status: 'NEW', contactMethod: 'Email', notes: 'Independent investigative news.' },
  { name: 'Press', organization: 'The American Prospect', email: 'editors@prospect.org', status: 'NEW', contactMethod: 'Email', notes: 'Progressive policy journalism.' },
  { name: 'Press', organization: 'Center for American Progress', email: 'press@americanprogress.org', status: 'NEW', contactMethod: 'Email', notes: 'Progressive policy think tank.' },
  { name: 'Contact', organization: 'Balls and Strikes', email: 'info@ballsandstrikes.org', status: 'NEW', contactMethod: 'Email', notes: 'Courts/judiciary newsletter. Legal accountability.' },
  { name: 'Press', organization: 'MoveOn', email: 'press@moveon.org', status: 'NEW', contactMethod: 'Email', notes: 'Civic engagement. 10M+ members.' },
  { name: 'Press', organization: 'Demand Progress', email: 'info@demandprogress.org', status: 'NEW', contactMethod: 'Email', notes: 'Civil liberties. Government accountability.' },
  { name: 'Press', organization: 'Defend Democracy Project', email: 'info@defenddemocracy.press', status: 'NEW', contactMethod: 'Email', notes: 'Multi-channel democracy defense.' },
  { name: 'Press', organization: 'National Constitution Center', email: 'media@constitutioncenter.org', status: 'NEW', contactMethod: 'Email', notes: 'Nonpartisan constitutional education.' },
  { name: 'Press', organization: 'Verified Voting', email: 'info@verifiedvoting.org', status: 'NEW', contactMethod: 'Email', notes: 'Election integrity. Voting systems.' },
];

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const followUp = process.argv.includes('--followup');
  const newTargets = process.argv.includes('--new-targets');
  const targetArg = process.argv.find(a => a.startsWith('--target='));
  const targetFilter = targetArg?.split('=')[1];

  console.log('Fetching current week summary...');
  const summary = await getCurrentWeekSummary();

  const sentLog = loadSentLog();
  let contacts: Contact[];
  let emailType: 'initial' | 'followup-1' | 'followup-2' | 'followup-3';

  if (newTargets) {
    // Send initial emails to new constitutional protection orgs
    contacts = CONSTITUTIONAL_TARGETS.filter(c => {
      const alreadySent = sentLog.some(s => s.email === c.email);
      return !alreadySent;
    });
    emailType = 'initial';
    console.log(`\nNew constitutional protection targets: ${contacts.length} orgs`);
  } else if (followUp) {
    // Follow up ALL contacts that haven't responded: CSV + constitutional targets
    const csvContacts = loadContacts();
    // Include constitutional targets that were previously emailed (tracked in sent log)
    const sentEmails = new Set(sentLog.map(s => s.email));
    const emailedConstitutionalTargets = CONSTITUTIONAL_TARGETS
      .filter(c => sentEmails.has(c.email))
      .map(c => ({ ...c, status: 'EMAILED' }));
    const allContacts = [...csvContacts, ...emailedConstitutionalTargets];
    contacts = getFollowUpContacts(allContacts, sentLog);
    emailType = 'followup-1'; // Will be refined per-contact below
    console.log(`\nFollowup targets: ${contacts.length} contacts (${csvContacts.length} CSV + ${emailedConstitutionalTargets.length} constitutional orgs)`);
  } else if (targetFilter) {
    const allContacts = [...loadContacts(), ...CONSTITUTIONAL_TARGETS];
    contacts = allContacts.filter(c =>
      c.organization.toLowerCase().includes(targetFilter.toLowerCase())
    );
    emailType = 'initial';
    console.log(`\nFiltered targets matching "${targetFilter}": ${contacts.length}`);
  } else {
    console.log('\nUsage:');
    console.log('  --new-targets   Email new constitutional protection orgs');
    console.log('  --followup      Follow up non-responders from original batch');
    console.log('  --target="Org"  Email a specific organization');
    console.log('  --dry-run       Preview without sending');
    return;
  }

  if (contacts.length === 0) {
    console.log('No contacts to email. All caught up!');
    return;
  }

  let sent = 0;
  let failed = 0;

  for (const contact of contacts) {
    const actualType = followUp
      ? getNextFollowUpType(contact.email, sentLog)
      : emailType;

    const focusLine = getFocusLine(contact.organization, contact.notes);
    const body = formatEmailPitch(summary, contact.name, focusLine);

    const subject = actualType === 'initial'
      ? `Civic data tool for ${contact.organization}: The Distraction Index`
      : `Following up: Distraction Index data for ${contact.organization}`;

    console.log(`\n[${actualType}] ${contact.organization} (${contact.email})`);

    const ok = await sendEmail(contact.email, subject, body, dryRun);

    if (ok) {
      sent++;
      if (!dryRun) {
        sentLog.push({
          email: contact.email,
          sentAt: new Date().toISOString(),
          type: actualType,
          subject,
        });
      }
    } else {
      failed++;
    }

    // Rate limit: 2 emails per second (Resend free tier allows 10/s but be polite)
    if (!dryRun) await new Promise(r => setTimeout(r, 500));
  }

  if (!dryRun) saveSentLog(sentLog);

  console.log(`\n=== Campaign complete ===`);
  console.log(`Sent: ${sent}, Failed: ${failed}, Total: ${contacts.length}`);
  if (dryRun) console.log('(DRY RUN — no emails were actually sent)');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

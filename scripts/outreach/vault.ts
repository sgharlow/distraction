/**
 * Encrypted secrets vault for outreach credentials.
 *
 * Stores credentials encrypted with AES-256-GCM in `.secrets.enc` (safe to commit).
 * Decrypts to `.env.local` entries on demand.
 *
 * Usage:
 *   npx tsx scripts/outreach/vault.ts init              # Create vault with master password
 *   npx tsx scripts/outreach/vault.ts set KEY value      # Add/update a secret
 *   npx tsx scripts/outreach/vault.ts get KEY            # Retrieve a secret
 *   npx tsx scripts/outreach/vault.ts list               # List all stored keys
 *   npx tsx scripts/outreach/vault.ts sync               # Write all secrets to .env.local
 *   npx tsx scripts/outreach/vault.ts export             # Print all as KEY=VALUE (for piping)
 *   npx tsx scripts/outreach/vault.ts status             # Check which outreach creds are configured
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const VAULT_FILE = path.resolve(__dirname, '../../.secrets.enc');
const ENV_FILE = path.resolve(__dirname, '../../.env.local');
const ALGORITHM = 'aes-256-gcm';
const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

// All outreach-related env vars
const OUTREACH_KEYS = [
  { key: 'BLUESKY_HANDLE', description: 'Bluesky handle (e.g., distractionindex.bsky.social)', required: true },
  { key: 'BLUESKY_APP_PASSWORD', description: 'Bluesky app password', required: true },
  { key: 'MASTODON_INSTANCE', description: 'Mastodon instance URL (e.g., https://mastodon.social)', required: true },
  { key: 'MASTODON_ACCESS_TOKEN', description: 'Mastodon API access token', required: true },
  { key: 'RESEND_API_KEY', description: 'Resend.com API key for email', required: true },
  { key: 'OUTREACH_FROM_EMAIL', description: 'Sender email for outreach', required: true },
  { key: 'OUTREACH_FROM_NAME', description: 'Sender name for outreach', required: false },
  { key: 'REDDIT_USERNAME', description: 'Reddit username', required: false },
  { key: 'REDDIT_PASSWORD', description: 'Reddit password', required: false },
];

function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, 'sha512');
}

function encrypt(data: string, password: string): Buffer {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = deriveKey(password, salt);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Format: salt (32) + iv (16) + tag (16) + encrypted data
  return Buffer.concat([salt, iv, tag, encrypted]);
}

function decrypt(buffer: Buffer, password: string): string {
  const salt = buffer.subarray(0, SALT_LENGTH);
  const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = buffer.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

  const key = deriveKey(password, salt);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return decipher.update(encrypted) + decipher.final('utf8');
}

function loadVault(password: string): Record<string, string> {
  if (!fs.existsSync(VAULT_FILE)) return {};
  const buffer = fs.readFileSync(VAULT_FILE);
  const json = decrypt(buffer, password);
  return JSON.parse(json);
}

function saveVault(secrets: Record<string, string>, password: string): void {
  const json = JSON.stringify(secrets, null, 2);
  const encrypted = encrypt(json, password);
  fs.writeFileSync(VAULT_FILE, encrypted);
}

function prompt(question: string, hidden = false): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    if (hidden) {
      // For password input, disable echo
      process.stdout.write(question);
      const stdin = process.stdin;
      const wasRaw = stdin.isRaw;
      if (stdin.setRawMode) stdin.setRawMode(true);

      let input = '';
      const onData = (ch: Buffer) => {
        const c = ch.toString();
        if (c === '\n' || c === '\r') {
          if (stdin.setRawMode) stdin.setRawMode(wasRaw ?? false);
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          rl.close();
          resolve(input);
        } else if (c === '\u007f' || c === '\b') {
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else if (c === '\u0003') {
          process.exit(0);
        } else {
          input += c;
          process.stdout.write('*');
        }
      };
      stdin.on('data', onData);
      stdin.resume();
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

async function getPassword(confirm = false): Promise<string> {
  const pw = await prompt('Vault master password: ', true);
  if (!pw) {
    console.error('Password cannot be empty.');
    process.exit(1);
  }
  if (confirm) {
    const pw2 = await prompt('Confirm password: ', true);
    if (pw !== pw2) {
      console.error('Passwords do not match.');
      process.exit(1);
    }
  }
  return pw;
}

async function cmdInit() {
  if (fs.existsSync(VAULT_FILE)) {
    const overwrite = await prompt('Vault already exists. Overwrite? (yes/no): ');
    if (overwrite !== 'yes') {
      console.log('Aborted.');
      return;
    }
  }

  console.log('Creating encrypted secrets vault...');
  console.log('Choose a master password. You\'ll need this to access credentials.\n');

  const password = await getPassword(true);
  saveVault({}, password);

  console.log(`\nVault created: ${VAULT_FILE}`);
  console.log('This file is safe to commit — it\'s AES-256-GCM encrypted.');
  console.log('\nNext: use "vault.ts set KEY value" to add credentials.');
}

async function cmdSet(key: string, value?: string) {
  if (!key) {
    console.error('Usage: vault.ts set KEY [value]');
    process.exit(1);
  }

  const password = await getPassword();

  let secrets: Record<string, string>;
  try {
    secrets = loadVault(password);
  } catch {
    console.error('Wrong password or corrupted vault.');
    process.exit(1);
  }

  if (!value) {
    value = await prompt(`Value for ${key}: `, true);
  }

  secrets[key] = value!;
  saveVault(secrets, password);
  console.log(`Set ${key} (${value!.length} chars)`);
}

async function cmdGet(key: string) {
  if (!key) {
    console.error('Usage: vault.ts get KEY');
    process.exit(1);
  }

  const password = await getPassword();

  let secrets: Record<string, string>;
  try {
    secrets = loadVault(password);
  } catch {
    console.error('Wrong password or corrupted vault.');
    process.exit(1);
  }

  if (key in secrets) {
    console.log(secrets[key]);
  } else {
    console.error(`Key not found: ${key}`);
    process.exit(1);
  }
}

async function cmdList() {
  const password = await getPassword();

  let secrets: Record<string, string>;
  try {
    secrets = loadVault(password);
  } catch {
    console.error('Wrong password or corrupted vault.');
    process.exit(1);
  }

  const keys = Object.keys(secrets);
  if (keys.length === 0) {
    console.log('Vault is empty.');
    return;
  }

  console.log(`\nVault contains ${keys.length} secrets:\n`);
  for (const k of keys) {
    const masked = secrets[k].substring(0, 4) + '...' + secrets[k].substring(secrets[k].length - 4);
    console.log(`  ${k.padEnd(30)} ${masked}`);
  }
}

async function cmdSync() {
  const password = await getPassword();

  let secrets: Record<string, string>;
  try {
    secrets = loadVault(password);
  } catch {
    console.error('Wrong password or corrupted vault.');
    process.exit(1);
  }

  if (Object.keys(secrets).length === 0) {
    console.log('Vault is empty. Nothing to sync.');
    return;
  }

  // Read existing .env.local
  let envContent = '';
  if (fs.existsSync(ENV_FILE)) {
    envContent = fs.readFileSync(ENV_FILE, 'utf-8');
  }

  const envLines = envContent.split('\n');
  const existingKeys = new Set<string>();

  // Parse existing keys
  for (const line of envLines) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=/);
    if (match) existingKeys.add(match[1]);
  }

  // Add/update secrets
  let added = 0;
  let updated = 0;

  for (const [key, value] of Object.entries(secrets)) {
    if (existingKeys.has(key)) {
      // Update existing line
      const regex = new RegExp(`^${key}=.*$`, 'm');
      envContent = envContent.replace(regex, `${key}=${value}`);
      updated++;
    } else {
      // Append new line
      if (!envContent.endsWith('\n') && envContent.length > 0) envContent += '\n';
      envContent += `${key}=${value}\n`;
      added++;
    }
  }

  fs.writeFileSync(ENV_FILE, envContent);
  console.log(`Synced to .env.local: ${added} added, ${updated} updated.`);
}

async function cmdExport() {
  const password = await getPassword();

  let secrets: Record<string, string>;
  try {
    secrets = loadVault(password);
  } catch {
    console.error('Wrong password or corrupted vault.');
    process.exit(1);
  }

  for (const [key, value] of Object.entries(secrets)) {
    console.log(`${key}=${value}`);
  }
}

async function cmdStatus() {
  // Check which outreach credentials are configured in .env.local
  let envContent = '';
  if (fs.existsSync(ENV_FILE)) {
    envContent = fs.readFileSync(ENV_FILE, 'utf-8');
  }

  const envVars: Record<string, string> = {};
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match) envVars[match[1]] = match[2];
  }

  console.log('\n=== Outreach Credential Status ===\n');

  let configured = 0;
  let missing = 0;

  for (const { key, description, required } of OUTREACH_KEYS) {
    const value = envVars[key];
    const status = value
      ? `\x1b[32mCONFIGURED\x1b[0m (${value.substring(0, 3)}...)`
      : required
        ? `\x1b[31mMISSING\x1b[0m`
        : `\x1b[33mOPTIONAL\x1b[0m`;

    console.log(`  ${status.padEnd(40)} ${key}`);
    console.log(`  ${''.padEnd(30)} ${description}`);
    console.log('');

    if (value) configured++;
    else if (required) missing++;
  }

  console.log(`Configured: ${configured}/${OUTREACH_KEYS.length}`);
  if (missing > 0) console.log(`Missing (required): ${missing}`);

  // Also check vault status
  console.log('');
  if (fs.existsSync(VAULT_FILE)) {
    const stats = fs.statSync(VAULT_FILE);
    console.log(`Vault: ${VAULT_FILE}`);
    console.log(`  Size: ${stats.size} bytes, Modified: ${stats.mtime.toISOString().split('T')[0]}`);
  } else {
    console.log('Vault: Not initialized. Run "vault.ts init" to create.');
  }
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);

  switch (cmd) {
    case 'init':
      await cmdInit();
      break;
    case 'set':
      await cmdSet(args[0], args[1]);
      break;
    case 'get':
      await cmdGet(args[0]);
      break;
    case 'list':
      await cmdList();
      break;
    case 'sync':
      await cmdSync();
      break;
    case 'export':
      await cmdExport();
      break;
    case 'status':
      await cmdStatus();
      break;
    default:
      console.log('Encrypted Secrets Vault for Outreach Credentials\n');
      console.log('Commands:');
      console.log('  init                  Create new vault with master password');
      console.log('  set KEY [value]       Store a secret (prompts for value if omitted)');
      console.log('  get KEY               Retrieve a secret');
      console.log('  list                  List all stored keys (values masked)');
      console.log('  sync                  Write all secrets to .env.local');
      console.log('  export                Print all as KEY=VALUE');
      console.log('  status                Check which outreach creds are configured');
      console.log('\nExamples:');
      console.log('  npx tsx scripts/outreach/vault.ts init');
      console.log('  npx tsx scripts/outreach/vault.ts set BLUESKY_HANDLE distractionindex.bsky.social');
      console.log('  npx tsx scripts/outreach/vault.ts set BLUESKY_APP_PASSWORD');
      console.log('  npx tsx scripts/outreach/vault.ts sync');
      console.log('  npx tsx scripts/outreach/vault.ts status');
      break;
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

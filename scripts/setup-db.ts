#!/usr/bin/env npx tsx
// ═══════════════════════════════════════════════════════════════
// Database Setup Script
// Runs all migrations against the configured Supabase instance.
//
// Usage:
//   npx tsx scripts/setup-db.ts
//   npx tsx scripts/setup-db.ts --dry-run
//
// Requires .env.local with SUPABASE keys.
// ═══════════════════════════════════════════════════════════════

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE environment variables in .env.local');
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const MIGRATIONS_DIR = path.join(__dirname, '..', 'supabase', 'migrations');

async function runMigration(filename: string, sql: string) {
  console.log(`\n── Running: ${filename} ──`);

  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would execute ${sql.length} chars of SQL`);
    return;
  }

  // Split on semicolons for statement-level execution, but be careful with
  // function bodies that contain semicolons inside $$ blocks
  // Use Supabase's rpc to run raw SQL via pg function
  const { error } = await supabase.rpc('exec_sql', { sql_text: sql });

  if (error) {
    // If exec_sql doesn't exist, try a different approach
    if (error.message.includes('exec_sql')) {
      console.log('  Note: exec_sql function not available. Run this SQL manually in the Supabase SQL editor:');
      console.log(`  File: supabase/migrations/${filename}`);
      console.log(`  Size: ${sql.length} characters`);
      return;
    }
    console.error(`  ERROR: ${error.message}`);
    throw error;
  }

  console.log(`  ✓ Success`);
}

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   Database Setup — Migration Runner       ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`Supabase: ${SUPABASE_URL}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`);

  // Read migration files in order
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration files:`);
  files.forEach((f) => console.log(`  - ${f}`));

  // Check if tables already exist
  const { data: tables } = await supabase
    .from('weekly_snapshots')
    .select('week_id')
    .limit(1);

  if (tables !== null) {
    console.log(
      '\n⚠️  Tables appear to already exist. Migrations may fail on CREATE TABLE statements.',
    );
    console.log('   If re-running, you may need to drop tables first or use IF NOT EXISTS.\n');
  }

  console.log('\n══════════════════════════════════════════');
  console.log('IMPORTANT: Run these migrations in the Supabase SQL Editor');
  console.log('══════════════════════════════════════════');
  console.log('\n1. Go to your Supabase project dashboard');
  console.log('2. Click "SQL Editor" in the left sidebar');
  console.log('3. Run each migration file in order:\n');

  for (const file of files) {
    const sqlPath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log(`   ${file} (${sql.length} chars)`);
  }

  console.log('\n   Copy/paste each file content into the SQL Editor and click "Run".');
  console.log('   Run them in numeric order (001, 002, 003).');

  // Verify connectivity
  console.log('\n── Connectivity Test ──');
  const { error } = await supabase.from('weekly_snapshots').select('week_id').limit(1);
  if (error && error.message.includes('does not exist')) {
    console.log('  Database tables not yet created (expected before migration)');
  } else if (error) {
    console.log(`  Connection error: ${error.message}`);
  } else {
    console.log('  ✓ Connected to Supabase successfully');
    console.log('  ✓ Tables already exist');
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});

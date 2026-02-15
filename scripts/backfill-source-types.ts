/**
 * Backfill Source Types Script
 *
 * Classifies existing articles by domain into source_type categories
 * (wire, national, primary_doc) using the classify-source utility.
 *
 * Usage:
 *   npx tsx scripts/backfill-source-types.ts              # dry-run (default)
 *   npx tsx scripts/backfill-source-types.ts --execute     # actually update
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';
import { classifySource } from '../src/lib/ingestion/classify-source';

const __dirname_resolved = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
dotenv.config({ path: path.resolve(__dirname_resolved, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: Missing environment variables.');
  console.error('  NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'SET' : 'MISSING');
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'SET' : 'MISSING');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'distraction' },
});

const EXECUTE = process.argv.includes('--execute');
const BATCH_SIZE = 500;

async function main() {
  console.log(`\nBackfill Source Types — ${EXECUTE ? 'EXECUTE' : 'DRY RUN'}\n`);

  // Count articles needing classification
  const { count: totalNull } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .is('source_type', null);

  console.log(`Articles with source_type = NULL: ${totalNull ?? 'unknown'}`);

  if (!totalNull || totalNull === 0) {
    console.log('Nothing to backfill.');
    return;
  }

  const stats = { wire: 0, national: 0, primary_doc: 0, unknown: 0, total: 0 };
  let offset = 0;

  while (offset < totalNull) {
    const { data: articles, error } = await supabase
      .from('articles')
      .select('id, url, publisher')
      .is('source_type', null)
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error(`Fetch error at offset ${offset}: ${error.message}`);
      break;
    }
    if (!articles || articles.length === 0) break;

    for (const article of articles) {
      const sourceType = classifySource(article.url, article.publisher);
      stats.total++;

      if (sourceType) {
        stats[sourceType as keyof typeof stats] =
          (stats[sourceType as keyof typeof stats] as number) + 1;

        if (EXECUTE) {
          const { error: updateError } = await supabase
            .from('articles')
            .update({ source_type: sourceType })
            .eq('id', article.id);

          if (updateError) {
            console.error(`Update error for ${article.id}: ${updateError.message}`);
          }
        }
      } else {
        stats.unknown++;
      }
    }

    offset += articles.length;
    process.stdout.write(`\r  Processed ${stats.total} / ${totalNull} articles...`);
  }

  console.log('\n');
  console.log('Classification Results:');
  console.log(`  wire:        ${stats.wire}`);
  console.log(`  national:    ${stats.national}`);
  console.log(`  primary_doc: ${stats.primary_doc}`);
  console.log(`  unknown:     ${stats.unknown}`);
  console.log(`  total:       ${stats.total}`);

  if (!EXECUTE) {
    console.log('\nDry run complete. Run with --execute to apply changes.');
  } else {
    console.log('\nBackfill complete. Run recompute-stats.ts to update weekly snapshots.');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

/**
 * Merge Duplicate Events Script
 *
 * Finds events within the same week that have similar titles (using token-overlap
 * similarity) and merges them by reassigning articles and deleting the duplicate.
 *
 * Usage:
 *   npx tsx scripts/merge-duplicate-events.ts              # dry-run (default)
 *   npx tsx scripts/merge-duplicate-events.ts --execute     # actually merge
 *   npx tsx scripts/merge-duplicate-events.ts --threshold 0.6  # custom threshold
 */

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname_resolved = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
dotenv.config({ path: path.resolve(__dirname_resolved, "..", ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("ERROR: Missing environment variables.");
  console.error("  NEXT_PUBLIC_SUPABASE_URL:", supabaseUrl ? "SET" : "MISSING");
  console.error("  SUPABASE_SERVICE_ROLE_KEY:", supabaseKey ? "SET" : "MISSING");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: "distraction" },
});

// --- Token-overlap similarity (same algorithm as src/lib/ingestion/similarity.ts) ---

function tokenSimilarity(a: string, b: string): number {
  const la = a.toLowerCase().trim();
  const lb = b.toLowerCase().trim();
  if (la === lb) return 1;
  if (la.length === 0 || lb.length === 0) return 0;

  const tokensA = new Set(la.split(/\s+/).filter((t) => t.length > 2));
  const tokensB = new Set(lb.split(/\s+/).filter((t) => t.length > 2));

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let overlap = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) overlap++;
  }

  return overlap / Math.max(tokensA.size, tokensB.size);
}

// --- Types ---

interface EventRow {
  id: string;
  week_id: string;
  title: string;
  a_score: number | null;
  b_score: number | null;
  confidence: number | null;
  article_count: number;
  score_frozen: boolean;
  primary_list: string | null;
  is_mixed: boolean;
  created_at: string;
}

interface DuplicateGroup {
  weekId: string;
  winner: EventRow;
  losers: EventRow[];
  similarity: number;
  frozenEvents: number;
}

// --- CLI args ---

const args = process.argv.slice(2);
const execute = args.includes("--execute");
const thresholdArg = args.find((a) => a.startsWith("--threshold"));
const thresholdIdx = args.indexOf("--threshold");
const threshold = thresholdIdx >= 0 && args[thresholdIdx + 1]
  ? parseFloat(args[thresholdIdx + 1])
  : 0.65;

// --- Main ---

async function main() {
  console.log("=".repeat(60));
  console.log("  Duplicate Event Merger");
  console.log("=".repeat(60));
  console.log(`  Mode:      ${execute ? "EXECUTE (will modify data)" : "DRY RUN (read-only)"}`);
  console.log(`  Threshold: ${threshold}`);
  console.log(`  Timestamp: ${new Date().toISOString()}`);
  console.log("");

  // 1. Fetch all events grouped by week
  const { data: allEvents, error: eventsErr } = await supabase
    .from("events")
    .select("id, week_id, title, a_score, b_score, confidence, article_count, score_frozen, primary_list, is_mixed, created_at")
    .not("primary_list", "is", null)
    .order("week_id", { ascending: true });

  if (eventsErr) {
    console.error("ERROR fetching events:", eventsErr.message);
    process.exit(1);
  }

  if (!allEvents || allEvents.length === 0) {
    console.log("No events found.");
    return;
  }

  console.log(`  Total events scanned: ${allEvents.length}`);

  // Group by week
  const byWeek = new Map<string, EventRow[]>();
  for (const ev of allEvents) {
    const list = byWeek.get(ev.week_id) || [];
    list.push(ev);
    byWeek.set(ev.week_id, list);
  }

  console.log(`  Weeks with events: ${byWeek.size}`);
  console.log("");

  // 2. Find duplicates within each week
  const duplicateGroups: DuplicateGroup[] = [];
  const consumed = new Set<string>(); // event IDs already assigned to a group

  for (const [weekId, events] of byWeek) {
    for (let i = 0; i < events.length; i++) {
      if (consumed.has(events[i].id)) continue;

      const group: EventRow[] = [events[i]];

      for (let j = i + 1; j < events.length; j++) {
        if (consumed.has(events[j].id)) continue;

        const sim = tokenSimilarity(events[i].title, events[j].title);
        if (sim >= threshold) {
          group.push(events[j]);
          consumed.add(events[j].id);
        }
      }

      if (group.length > 1) {
        consumed.add(events[i].id);

        // Pick winner: highest confidence, then highest article_count, then earliest created
        group.sort((a, b) => {
          const confDiff = (b.confidence ?? 0) - (a.confidence ?? 0);
          if (confDiff !== 0) return confDiff;
          const artDiff = b.article_count - a.article_count;
          if (artDiff !== 0) return artDiff;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });

        const winner = group[0];
        const losers = group.slice(1);
        const maxSim = Math.max(
          ...losers.map((l) => tokenSimilarity(winner.title, l.title))
        );
        const frozenCount = group.filter((e) => e.score_frozen).length;

        duplicateGroups.push({
          weekId,
          winner,
          losers,
          similarity: maxSim,
          frozenEvents: frozenCount,
        });
      }
    }
  }

  // 3. Report
  if (duplicateGroups.length === 0) {
    console.log("No duplicate events found.");
    return;
  }

  const totalLosers = duplicateGroups.reduce((sum, g) => sum + g.losers.length, 0);
  const frozenGroups = duplicateGroups.filter((g) => g.frozenEvents > 0);
  const unfrozenGroups = duplicateGroups.filter((g) => g.frozenEvents === 0);

  console.log("=".repeat(60));
  console.log("  DUPLICATE GROUPS FOUND");
  console.log("=".repeat(60));
  console.log(`  Total groups:        ${duplicateGroups.length}`);
  console.log(`  Events to remove:    ${totalLosers}`);
  console.log(`  Groups with frozen:  ${frozenGroups.length}`);
  console.log(`  Groups unfrozen:     ${unfrozenGroups.length}`);
  console.log("");

  // Per-week summary
  const weekSummary = new Map<string, { groups: number; losers: number }>();
  for (const g of duplicateGroups) {
    const ws = weekSummary.get(g.weekId) || { groups: 0, losers: 0 };
    ws.groups++;
    ws.losers += g.losers.length;
    weekSummary.set(g.weekId, ws);
  }

  console.log("--- By Week ---");
  for (const [weekId, ws] of Array.from(weekSummary.entries()).sort()) {
    console.log(`  ${weekId}: ${ws.groups} groups, ${ws.losers} duplicates to remove`);
  }
  console.log("");

  // Detailed per-group
  console.log("--- Detailed Duplicate Groups ---");
  for (const g of duplicateGroups) {
    const frozenTag = g.frozenEvents > 0 ? " [FROZEN]" : "";
    console.log(`\n  Week ${g.weekId}${frozenTag} (similarity: ${(g.similarity * 100).toFixed(0)}%):`);
    console.log(`    KEEP:   "${g.winner.title}"`);
    console.log(`            id=${g.winner.id}  A=${g.winner.a_score?.toFixed(1) ?? "—"}  B=${g.winner.b_score?.toFixed(1) ?? "—"}  articles=${g.winner.article_count}  conf=${g.winner.confidence?.toFixed(2) ?? "—"}  frozen=${g.winner.score_frozen}`);
    for (const l of g.losers) {
      console.log(`    DELETE: "${l.title}"`);
      console.log(`            id=${l.id}  A=${l.a_score?.toFixed(1) ?? "—"}  B=${l.b_score?.toFixed(1) ?? "—"}  articles=${l.article_count}  conf=${l.confidence?.toFixed(2) ?? "—"}  frozen=${l.score_frozen}`);
    }
  }

  // 4. Execute if requested
  if (!execute) {
    console.log("\n" + "=".repeat(60));
    console.log("  DRY RUN COMPLETE — no changes made");
    console.log("  Run with --execute to apply merges");
    console.log("=".repeat(60));
    return;
  }

  console.log("\n" + "=".repeat(60));
  console.log("  EXECUTING MERGES");
  console.log("=".repeat(60));

  let merged = 0;
  let articlesMoved = 0;
  let errors = 0;
  const affectedWeeks = new Set<string>();

  for (const g of duplicateGroups) {
    for (const loser of g.losers) {
      try {
        // Reassign articles from loser to winner
        const { data: movedArticles, error: moveErr } = await supabase
          .from("articles")
          .update({ event_id: g.winner.id })
          .eq("event_id", loser.id)
          .select("id");

        if (moveErr) {
          console.error(`  ERROR moving articles from ${loser.id}: ${moveErr.message}`);
          errors++;
          continue;
        }

        const movedCount = movedArticles?.length ?? 0;
        articlesMoved += movedCount;

        // Delete the loser event (cascades to score_changes, smokescreen_pairs, community_flags)
        const { error: deleteErr } = await supabase
          .from("events")
          .delete()
          .eq("id", loser.id);

        if (deleteErr) {
          console.error(`  ERROR deleting event ${loser.id}: ${deleteErr.message}`);
          errors++;
          continue;
        }

        merged++;
        affectedWeeks.add(g.weekId);
        console.log(`  Merged "${loser.title}" -> "${g.winner.title}" (${movedCount} articles moved)`);
      } catch (err) {
        console.error(`  ERROR processing ${loser.id}: ${err}`);
        errors++;
      }
    }

    // Update winner's article_count
    const { count: newArticleCount } = await supabase
      .from("articles")
      .select("*", { count: "exact", head: true })
      .eq("event_id", g.winner.id);

    if (newArticleCount != null) {
      await supabase
        .from("events")
        .update({ article_count: newArticleCount })
        .eq("id", g.winner.id);
    }
  }

  // Recompute week stats for affected weeks
  console.log("\n--- Recomputing week stats ---");
  for (const weekId of affectedWeeks) {
    const { error: statsErr } = await supabase.rpc("compute_week_stats", {
      target_week_id: weekId,
    });
    if (statsErr) {
      console.error(`  ERROR recomputing stats for ${weekId}: ${statsErr.message}`);
    } else {
      console.log(`  Recomputed stats for ${weekId}`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("  EXECUTION COMPLETE");
  console.log("=".repeat(60));
  console.log(`  Events merged:     ${merged}`);
  console.log(`  Articles moved:    ${articlesMoved}`);
  console.log(`  Errors:            ${errors}`);
  console.log(`  Weeks affected:    ${affectedWeeks.size}`);
  console.log("");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

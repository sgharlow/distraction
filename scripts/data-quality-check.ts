/**
 * Data Quality Check Script for Distraction Index
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

function printHeader(title: string) {
  console.log("\n" + "=".repeat(60));
  console.log("  " + title);
  console.log("=".repeat(60));
}

function printSubHeader(title: string) {
  console.log("\n--- " + title + " ---");
}

async function main() {
  console.log("Distraction Index -- Data Quality Report");
  console.log("Supabase URL: " + supabaseUrl);
  console.log("Timestamp: " + new Date().toISOString());

  printHeader("1. EVENTS");

  const { count: eventsCount, error: eventsErr } = await supabase
    .from("events")
    .select("*", { count: "exact", head: true });

  if (eventsErr) {
    console.error("  ERROR querying events:", eventsErr.message);
  } else {
    console.log("  Total events: " + eventsCount);
  }

  printSubHeader("Events by primary_list value");

  const { data: allEvents, error: listErr } = await supabase
    .from("events")
    .select("primary_list");

  if (listErr) {
    console.error("  ERROR querying primary_list:", listErr.message);
  } else if (allEvents) {
    const listCounts: Record<string, number> = {};
    for (const ev of allEvents) {
      const val = ev.primary_list ?? "(null)";
      listCounts[val] = (listCounts[val] || 0) + 1;
    }
    const sorted = Object.entries(listCounts).sort((a, b) => b[1] - a[1]);
    for (const [val, count] of sorted) {
      console.log("  \"" + val + "\" => " + count);
    }
    const lowerMap: Record<string, string[]> = {};
    for (const val of Object.keys(listCounts)) {
      const lower = val.toLowerCase();
      if (!lowerMap[lower]) lowerMap[lower] = [];
      lowerMap[lower].push(val);
    }
    const casingIssues = Object.entries(lowerMap).filter(([, vals]) => vals.length > 1);
    if (casingIssues.length > 0) {
      console.log("\n  *** CASING ISSUES DETECTED ***");
      for (const [lower, vals] of casingIssues) {
        console.log("  \"" + lower + "\" has variants: " + vals.map((v: string) => "\"" + v + "\"").join(", "));
      }
    } else {
      console.log("\n  No casing issues detected.");
    }
  }

  printSubHeader("Events with a_score > 100");
  const { data: highA, error: highAErr } = await supabase
    .from("events").select("id, title, a_score").gt("a_score", 100);
  if (highAErr) {
    console.error("  ERROR:", highAErr.message);
  } else {
    console.log("  Count: " + (highA?.length ?? 0));
    if (highA && highA.length > 0) {
      for (const ev of highA.slice(0, 10)) {
        console.log("    id=" + ev.id + "  a_score=" + ev.a_score + "  title=\"" + ev.title + "\"");
      }
      if (highA.length > 10) console.log("    ... and " + (highA.length - 10) + " more");
    }
  }

  printSubHeader("Events with b_score > 100");
  const { data: highB, error: highBErr } = await supabase
    .from("events").select("id, title, b_score").gt("b_score", 100);
  if (highBErr) {
    console.error("  ERROR:", highBErr.message);
  } else {
    console.log("  Count: " + (highB?.length ?? 0));
    if (highB && highB.length > 0) {
      for (const ev of highB.slice(0, 10)) {
        console.log("    id=" + ev.id + "  b_score=" + ev.b_score + "  title=\"" + ev.title + "\"");
      }
      if (highB.length > 10) console.log("    ... and " + (highB.length - 10) + " more");
    }
  }

  printHeader("2. ARTICLES");
  const { count: articlesCount, error: articlesErr } = await supabase
    .from("articles").select("*", { count: "exact", head: true });
  if (articlesErr) { console.error("  ERROR:", articlesErr.message); }
  else { console.log("  Total articles: " + articlesCount); }

  printHeader("3. SMOKESCREEN PAIRS");
  const { count: smokescreenCount, error: smokescreenErr } = await supabase
    .from("smokescreen_pairs").select("*", { count: "exact", head: true });
  if (smokescreenErr) { console.error("  ERROR:", smokescreenErr.message); }
  else { console.log("  Total smokescreen_pairs: " + smokescreenCount); }

  printHeader("4. WEEKLY SNAPSHOTS");
  const { count: snapshotsCount, error: snapshotsErr } = await supabase
    .from("weekly_snapshots").select("*", { count: "exact", head: true });
  if (snapshotsErr) { console.error("  ERROR:", snapshotsErr.message); }
  else { console.log("  Total weekly_snapshots: " + snapshotsCount); }

  printSubHeader("Snapshots with event counts per week");
  const { data: snapshots, error: snapListErr } = await supabase
    .from("weekly_snapshots")
    .select("week_id, status, distraction_index, total_events, list_a_count, list_b_count, list_c_count")
    .order("week_id", { ascending: true });
  if (snapListErr) {
    console.error("  ERROR:", snapListErr.message);
  } else if (snapshots && snapshots.length > 0) {
    console.log("  " + "week_id".padEnd(14) + "status".padEnd(12) + "DI".padStart(6) + "total".padStart(7) + "A".padStart(5) + "B".padStart(5) + "C".padStart(5));
    console.log("  " + "-".repeat(54));
    const lowEventWeeks: string[] = [];
    for (const s of snapshots) {
      const total = s.total_events ?? 0;
      console.log("  " + (s.week_id ?? "").padEnd(14) + (s.status ?? "").padEnd(12) + String(s.distraction_index ?? "-").padStart(6) + String(total).padStart(7) + String(s.list_a_count ?? "-").padStart(5) + String(s.list_b_count ?? "-").padStart(5) + String(s.list_c_count ?? "-").padStart(5));
      if (total < 5 && total >= 0) lowEventWeeks.push(s.week_id);
    }
    if (lowEventWeeks.length > 0) {
      console.log("\n  *** WARNING: Weeks with fewer than 5 events: " + lowEventWeeks.join(", "));
    } else {
      console.log("\n  All weeks have 5+ events.");
    }
  } else {
    console.log("  No weekly_snapshots found.");
  }

  printSubHeader("Event counts per week_id (from events table)");
  const { data: eventWeeks, error: ewErr } = await supabase.from("events").select("week_id");
  if (ewErr) {
    console.error("  ERROR:", ewErr.message);
  } else if (eventWeeks) {
    const weekCounts: Record<string, number> = {};
    for (const ev of eventWeeks) { const wk = ev.week_id ?? "(null)"; weekCounts[wk] = (weekCounts[wk] || 0) + 1; }
    const sortedWeeks = Object.entries(weekCounts).sort((a, b) => a[0].localeCompare(b[0]));
    for (const [wk, count] of sortedWeeks) {
      const flag = count < 5 ? " *** LOW" : "";
      console.log("  " + wk + ": " + count + " events" + flag);
    }
  }

  printHeader("5. WEEK ID SUNDAY VALIDATION");
  const allWeekIds = new Set<string>();
  if (eventWeeks) { for (const ev of eventWeeks) { if (ev.week_id) allWeekIds.add(ev.week_id); } }
  if (snapshots) { for (const s of snapshots) { if (s.week_id) allWeekIds.add(s.week_id); } }
  const nonSundays: string[] = [];
  const invalidDates: string[] = [];
  const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  for (const wid of Array.from(allWeekIds).sort()) {
    const d = new Date(wid + "T00:00:00Z");
    if (isNaN(d.getTime())) { invalidDates.push(wid); continue; }
    if (d.getUTCDay() !== 0) { nonSundays.push(wid + " (" + dayNames[d.getUTCDay()] + ")"); }
  }
  console.log("  Total distinct week_ids: " + allWeekIds.size);
  if (invalidDates.length > 0) console.log("  *** INVALID DATE FORMAT: " + invalidDates.join(", "));
  if (nonSundays.length > 0) {
    console.log("  *** NON-SUNDAY week_ids (" + nonSundays.length + "):");
    for (const ns of nonSundays) console.log("    " + ns);
  } else {
    console.log("  All week_ids are Sundays.");
  }

  printHeader("SUMMARY");
  console.log("  Events:            " + (eventsCount ?? "ERROR"));
  console.log("  Articles:          " + (articlesCount ?? "ERROR"));
  console.log("  Smokescreen pairs: " + (smokescreenCount ?? "ERROR"));
  console.log("  Weekly snapshots:  " + (snapshotsCount ?? "ERROR"));
  console.log("  Distinct week_ids: " + allWeekIds.size);
  console.log("  Non-Sunday weeks:  " + nonSundays.length);
  console.log("  a_score > 100:     " + (highA?.length ?? "ERROR"));
  console.log("  b_score > 100:     " + (highB?.length ?? "ERROR"));
  console.log("");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

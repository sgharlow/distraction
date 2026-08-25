# Monetize-or-Civic Decision Brief (gate due 2026-08-31)

**Prepared 2026-07-24** for the `monetize-or-civic` gate in PROJECT.yaml (ratified 7-01).
**Owner: Steve. One selection + a monthly cost ceiling closes the gate.**
**Kill line (already ratified):** no decision by 2026-09-30 → daily ingestion cadence + maintenance mode.

## Current run-rate (derived from architecture, 2026-07-24)

The stack is deliberately cheap; the only metered variable cost is the Claude API.

| Component | Basis | Est. monthly |
|---|---|---|
| Vercel hosting + crons | distraction-two.vercel.app; 3 cron routes (ingest 4-hourly ~15s, process 4-hourly ~55s, weekly freeze) — inside Hobby/Pro limits | $0 (Hobby) or existing Pro seat |
| Supabase | Single project, `distraction` schema, modest row volume | $0 (free tier) or $25 (Pro) |
| GNews API | Free tier key | $0 |
| Claude API — clustering | Haiku 4.5, 6 process-runs/day, small batches | ~$1–3 |
| Claude API — scoring | Sonnet 4.5, **hard-capped at 2 events/run** = ≤12 scorings/day | ~$3–8 |
| **Total** | | **~$5–15/mo at current caps** (verify: Anthropic console usage page + Vercel/Supabase dashboards for the exact invoice figures — this table is architecture-derived, not billing-derived) |

Key structural fact: the Sonnet max-2-per-run cap means Claude spend is bounded by design,
not by traffic. Cost risk is essentially flat unless the caps are raised.

## Options

| # | Model | What it means | Monthly ceiling proposal |
|---|---|---|---|
| A (recommended) | **Deliberate free-civic with a cost cap** | Ratify the site as a civic/portfolio property. No billing code (consistent with the demand-gate rule — `wtp_evidence: none`, and building billing before a demand signal is exactly what the 7-05 retrospective bans). Keep current caps; alert if Claude spend > cap. | $25/mo |
| B | **Premium API tier** | Sell the scored-events data as an API. Requires: a real prospect first (demand gate!), auth/keys/billing build, support surface. No such prospect exists today. | n/a until a demand signal exists |
| C | **Pro subscription** | Paywall depth features (history, alerts). Same demand-gate objection as B, plus consumer willingness-to-pay for news-meta content is notoriously weak. | n/a until a demand signal exists |
| D | **Sunset** | Tear down crons, freeze the site static. Saves ~$5–15/mo; loses a live, automated, zero-maintenance portfolio piece and its SEO. | $0 |

## Why A is recommended

B and C both fail the binding demand-gate rule: no arms-length demand signal exists, so the only
in-scope monetization work would be *one channel test* (e.g., a "want API access?" capture link on
the site) — which can be added under Option A anyway for ~zero cost. A converts the gate's open
question into a ratified, capped, honest answer; if the capture link ever produces a real prospect,
the gate can be reopened with evidence in hand.

## What closes the gate

Append to PROJECT.yaml's gate: `met: <date>  # DECISION: <option> — ceiling $<N>/mo (Steve)`.
If A: optionally add the API-interest capture link as the standing channel test.

## Where to record the ruling

`RULED <date>: <option>, ceiling $<N>/mo — <initials>` appended to this file + the PROJECT.yaml
gate edit above.

---

# RULED 2026-08-24: Option A — deliberate free-civic, ceiling $25/mo — SH

Ratified by Steve 2026-08-24, seven days ahead of the 08-31 due date. Recorded in
`PROJECT.yaml → gates[monetize-or-civic].decision`. **B and C are refused, not deferred**, on the
demand-gate rule. Implemented the same day by taking the ratified kill path EARLY:

| Change | From | To |
|---|---|---|
| `vercel.json` `/api/ingest` | `0 */4 * * *` | `0 4 * * *` (daily 04:00 UTC) |
| `vercel.json` `/api/process` | `5 */4 * * *` | `5 4 * * *` (daily 04:05 UTC) |
| `DEFAULT_STALENESS_THRESHOLD_HOURS` | `10` | `30` |

`/api/freeze` (weekly, Sun 05:00 UTC) and `/api/monitor` (daily 12:00 UTC) are unchanged; ingest
and process still complete an hour before the weekly freeze, preserving that ordering.

**Why the threshold moved in the same commit.** It is not cosmetic. At 10h a daily-cadence
pipeline is stale by definition: `/api/health` would have returned a permanent 503 and
`/api/monitor` would have mailed a dead-man's-switch alert every day. That is how the monitor
which caught the 3-week July 2026 outage gets muted. Recorded in `known_fragility`.

**Reversal** (single commit, no data migration): restore both cron schedules and the threshold
constant together, redeploy.

## Addendum — evidence gathered 2026-08-24

Two things this brief did not have on 2026-07-24:

- **Substack: 2 free subscribers, 0 post reads** (June 2026 digest, received 07-03; 100% of
  subscribers via `org.joinmastodon.android`). No July or August digest exists. This is the only
  measurement of the "newsletter subscribers" clause that `ladder: customer-used` rests on, and it
  is 8 weeks stale.
- **Supabase org `pnqfcetsvplvqvttdoaf` ("Personal") exceeded its plan quota** (notice 08-21);
  Fair Use Policy applies **2026-09-21**. distraction shares project `qwmiqowetejzroxckibu` with
  scopeshield. The 4-hourly write volume was the most plausible driver, which makes the cadence cut
  the fix for the quota as well as the gate — and it lands a month before the Fair Use date, where
  drifting to the 09-30 kill line would have landed nine days after it.

**Correction to the run-rate table above:** it remains accurate. An 08-24 re-read of the code
briefly suggested Sonnet scoring was an uncapped 6×/day cost driver; it is not. The
`max 2 events/run` cap documented in this table and in the repo's CLAUDE.md is real, so Claude
spend was already bounded by design and the cadence cut reduces an already-small number. The
cadence decision rests on the Supabase quota and the gate, not on Claude spend.

## Open measurement gaps — close these before citing this ruling as settled

The ruling is deliberately reversible because two inputs were never measured:

1. **distractionindex.org traffic** — never recorded into `PROJECT.yaml`. GA emails monthly
   digests that contain no figures. If traffic is substantial, revisit the cadence.
2. **Current Substack numbers** — June's 2/0 is the only datapoint and it is stale.

Neither blocks the ruling: both would argue for *more* investment, and the cap can be raised
without unwinding anything. Also unverified: which project drives the Supabase org overage
(needs the usage dashboard).

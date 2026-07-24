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

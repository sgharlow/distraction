# Item 20: Lobsters (lobste.rs) Submission

**Submit at:** https://lobste.rs (after receiving invite)
**Account:** Invite-only — requires invitation from existing member

---

## How to Get an Invite
1. Visit https://lobste.rs/about — the community requires invitations
2. Find active members via GitHub/Twitter who might invite you
3. Alternatively, if someone else submits your project first, comment and ask for an invite
4. Build reputation through commenting before submitting your own content

---

## Submission Details

### Title
Show Lobsters: AI-scored civic intelligence with full prompt transparency — 59 weeks of data

### URL
https://distractionindex.org

### Tags
`ai` `show` `compsci` `culture`

---

## First Comment (post immediately after submission)

I built The Distraction Index to answer a specific question: when political events cause real institutional damage but receive minimal media coverage, can we detect that systematically?

The approach: score every event on two independent axes using Claude's API.

**Score A (Constitutional Damage):** 7 weighted governance drivers × severity multipliers. Measures institutional harm — judicial independence, press freedom, voting rights, etc.

**Score B (Distraction/Hype):** Two-layer model. Layer 1 measures raw media amplification. Layer 2 measures strategic manipulation indicators, modulated by an intentionality score (0-15).

The interesting architectural decisions:

1. **Events ≠ Articles.** The system separates what happened from who covered it. Articles are clustered into events before scoring.

2. **Immutable snapshots.** Each week freezes permanently on Sunday. Corrections are append-only. This prevents silent model drift from corrupting historical analysis.

3. **Cost optimization.** Claude Haiku for clustering (~$0.25/1M tokens), Sonnet only for scoring (~$3/1M tokens). Total: ~$30/month for a production pipeline.

4. **Published prompts.** Every scoring prompt is documented at /methodology. If the system has a bias, you can trace it to a specific weight or framing choice.

After 59 weeks: 1,500+ events, 210+ smokescreen pairs, 288 tests, fully open source.

Source: https://github.com/sgharlow/distraction

What's the most interesting failure mode you'd expect from this kind of system? I'm curious what edge cases the community would flag.

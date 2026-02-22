# Item 14: Slashdot Story Submission

**Submit at:** https://slashdot.org/submit
**Account:** Free signup required

---

## Story Title
Open Source Tool Identifies 210+ Times Media Spectacle Masked Democratic Damage Using Dual-Axis AI Scoring

## Department
from the attention-economy dept.

## URL
https://distractionindex.org

## Topic
News / Politics / AI / Open Source

---

## Story Text

An independent developer has been running an automated AI pipeline for 59 weeks that scores U.S. political events on two independent axes: constitutional damage and media distraction. The Distraction Index ([distractionindex.org](https://distractionindex.org)) uses Claude Haiku for article clustering and Claude Sonnet for dual-axis scoring, processing articles from GDELT, GNews, and Google News RSS every four hours.

The core insight: political events that cause the most democratic harm often aren't the ones getting the most coverage. After scoring 1,500+ events, the system has identified 210+ "smokescreen" pairings where high-distraction events coincided with high-damage events that received disproportionately low coverage. Certain categories — particularly judicial independence and environmental policy — are systematically undercovered regardless of which distraction is dominating the news cycle.

The twist: every scoring formula, weight, and AI prompt is [published publicly](https://distractionindex.org/methodology). Weekly snapshots are immutable and corrections are append-only. The entire codebase is [open source](https://github.com/sgharlow/distraction) with 288 tests.

The technical stack runs at approximately $30/month using Haiku for high-volume clustering and Sonnet only for the scoring step that requires deeper reasoning — a cost optimization that keeps AI-powered civic tools accessible to independent developers.

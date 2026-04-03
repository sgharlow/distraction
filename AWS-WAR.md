# AWS Well-Architected Review: The Distraction Index

**Date**: 2026-04-03 (Post-Remediation Re-Review)
**URL**: https://distractionindex.org
**Stack**: Next.js 16.2.2 + Supabase (PostgreSQL) + Claude API (Haiku/Sonnet), Vercel
**Purpose**: Civic intelligence platform — automated news ingestion, AI scoring, weekly frozen reports

---

## Post-Remediation Status: PASS with caveats

All 3 criticals and 5 highs verified fixed. 0 npm production vulnerabilities. 2 new HIGH items (minor).

### Verification

| Previous Finding | Status | Evidence |
|---|---|---|
| CRIT: XSS via unsanitized blog markdown | FIXED | `sanitize-html` applied before dangerouslySetInnerHTML with explicit tag/attr allowlists |
| CRIT: No security headers | FIXED | Full CSP, HSTS (2yr preload), X-Frame-Options DENY, nosniff, Permissions-Policy |
| CRIT: Next.js 16.1.6 CVEs | FIXED | Upgraded to 16.2.2 |
| HIGH: Open redirect in admin login | FIXED | `actions.ts:11` validates next starts with '/admin' |
| HIGH: .secrets.enc not gitignored | FIXED | `.gitignore:82` includes `.secrets.enc` |
| HIGH: No rate limiting | FIXED | Upstash Redis with in-memory fallback, 5 req/min |
| HIGH: npm vulns | FIXED | 0 production vulnerabilities |
| HIGH: No error monitoring | FIXED | Sentry fully integrated (client, server, edge configs) |

### Remaining Findings

| Severity | Pillar | Finding | Detail |
|----------|--------|---------|--------|
| Accepted | Security | CSP allows `unsafe-eval` in script-src | Required by Next.js/Turbopack. Mitigated by other CSP directives. |
| Minor | Security | `@types/sanitize-html` in dependencies instead of devDependencies | Move to devDependencies |

### npm Audit
```
found 0 vulnerabilities (production)
```

# Coverage Gate — Opportunity

## Current state

- 370 tests pass (`npx vitest run`).
- 82 tests were added recently for zero-coverage paths.
- `vitest.config.*` has **no** `coverage.thresholds` block — there is no floor preventing future PRs from shipping less-covered code.
- `@vitest/coverage-v8` is **not installed** (`npx vitest run --coverage` fails with "MISSING DEPENDENCY").

## Why this matters

The 82 new zero-coverage tests were real work. Without a coverage gate, the next refactor that deletes some of the newly-covered code quietly drops coverage back to where it was — and nobody notices until someone runs coverage manually again months later.

## The ratchet (2-step)

1. **Install the provider:** `npm i -D @vitest/coverage-v8`.
2. **Measure + set floor:** run `npx vitest run --coverage`, note the statement/branch/function/line percentages, then add to `vitest.config.ts`:

   ```ts
   test: {
     // …existing config…
     coverage: {
       provider: 'v8',
       reporter: ['text', 'html'],
       thresholds: {
         // Set to (measured - 2%) as the initial ratchet.
         // Subsequent PRs can raise these toward the 80% / 70% / 80% / 80% target.
         statements: XX,
         branches: XX,
         functions: XX,
         lines: XX,
       },
     },
   },
   ```

3. **Wire into CI:** ensure the CI workflow runs `npm run test:coverage` (not `npm test`) so the thresholds are actually enforced. If CI currently runs `vitest run` without `--coverage`, the thresholds never fire.

## Why not done autonomously this session

Setting thresholds without measured numbers either (a) breaks CI on first run if set too high, or (b) is useless if set too low. Running coverage requires installing a new dev dep, which is scope beyond the original "ratchet existing floor" task. Better to pause here with an explicit TODO than to guess or install deps unilaterally.

Estimated time to complete: 20-30 min.

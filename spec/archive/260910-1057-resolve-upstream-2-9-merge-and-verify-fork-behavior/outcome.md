# Outcome: Resolve upstream 2.9 merge and verify fork behavior

Work item: `260910-1057-resolve-upstream-2-9-merge-and-verify-fork-behavior`
Disposition: completed
Date: 2026-11-07

## Delivered scope

- The upstream 2.9.0 merge was resolved and committed as `af83729c` ("Merge upstream v2.9.0 while preserving fork customizations").
- Fork customizations were kept: Firecrawl URL precedence and optional self-hosted auth, `/web-tools` Firecrawl configuration, `MAX_QUESTIONS = 15`, the root `pi.extensions` manifest, and the guarded `prepare` script.

## Deviations from plan

- None recorded. This outcome was written retroactively when the user asked to archive all active specs; the item had stayed active after the merge commit.

## Verification summary

See `verification.md`. Focused review attempt 3 passed; the full suite, Biome, TypeScript, and the decision-code check passed.

## Retained, reverted, or transferred work

- Retained: the merge commit `af83729c`. A later sync to v2.15.0 is archived as `261025-0741-merge-upstream-v2-15-0-and-verify-fork-behavior`.

## Residual risks

- Live Firecrawl reverse-proxy, TLS, DNS, and auth behavior was not tested (out of scope).
- `npm ci` reported audit findings in the upstream lockfile; not remediated.

## Follow-up work items

- None.

## Source references

- `plan.md`, `verification.md`, commit `af83729c`.

## Wiki updates

- `wiki/workflows/upstream-sync.md` covers the sync procedure.

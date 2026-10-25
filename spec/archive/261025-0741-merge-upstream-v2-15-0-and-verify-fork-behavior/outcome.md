# Outcome: Merge upstream v2.15.0 and verify fork behavior

Work item: `261025-0741-merge-upstream-v2-15-0-and-verify-fork-behavior`
Disposition: completed
Date: 2026-10-25

## Delivered scope

- Upstream `v2.15.0` (`ce6d3530`) is merged with `--no-ff --no-commit` on `sync/upstream-v2.15.0`, which was created from `main` at `ba1d25f8`. All 8 conflicts are resolved and the full merge is staged with explicit paths. The merge commit has not been created yet.
- Every fork customization is kept:
  - Firecrawl URL precedence, the Cloud key rule, and optional auth for self-hosted endpoints.
  - The `/web-tools` Firecrawl configuration and its exports.
  - `MAX_QUESTIONS = 15` everywhere.
  - The root `pi.extensions` manifest and the guarded `prepare` script.
- Upstream features are kept: `.ts` specifiers, `fallbackEnvVar`/`YDC_API_KEY`, the shared `isProviderConfigured` helper, and the #204 schema refresh.
- Provider visibility: Firecrawl with only an API key stays configured and visible. SearXNG and Ollama keep upstream's rule that only an explicit URL counts. Regression tests cover both cases.
- `.rpiv` architecture guidance, `docs/configuration.md`, and `docs/providers.md` now match the retained behavior.

## Deviations from plan

- D07 (direct amendment authorized by the user): the local merge commit is created by the Gamemaster commit phase after Implement and Dream. That commit includes this item's archive, `spec/index.md`, and the Dream wiki files.
- D08 (source-truth correction, Gamemaster option B): the Design assumed SearXNG and Ollama have no API-key env var, but they declare `SEARXNG_API_KEY` and `OLLAMA_API_KEY`. D03 is therefore narrowed so only Firecrawl counts a resolved key.
- `docs/providers.md` was edited because its "Picker markers" paragraph contradicted D08. The plan allows that.

## Verification summary

See `verification.md`.
- All Verification plan steps 1-8 passed:
  - `npm ci` succeeded and the lockfile is unchanged.
  - `ts-specifiers`, `host-provided-deps`, `file-sizes`, and `decision-codes` checks passed.
  - `npm test`: 7080 passed. `test:outside-coverage` passed.
  - Biome, `tsc`, `build:site`, and `npm run check` (no fixes) passed.
  - Manifest and `prepare` checks passed, and the stale-limit grep found nothing.
  - The staging boundary holds.
  - The Pi 1.1.0 smoke test passed.
- A mutation check confirmed the new tests catch both an upstream-only rule and a generic key rule.
- The independent contract-quality review returned PASS with no findings, after 0 retries.

## Retained, reverted, or transferred work

- Retained: every resolution and edit is staged on `sync/upstream-v2.15.0` with `MERGE_HEAD` in progress. Nothing was reverted.
- Fast-forwarding `main`, pushing, opening a PR, and publishing are left for separate approval.

## Residual risks

- The smoke test ran on host Pi 1.1.0, while the dev target is 1.4.0. The automated suite ran against the 1.4.0 dev dependency.
- `npm ci` skipped 6 install scripts (allowScripts). No check depended on them.
- No live Firecrawl, SearXNG, or Ollama calls were made (D06).
- The upstream pre-commit hook will rerun `check:file-sizes` and `npm run check` at commit time. Both passed here.

## Follow-up work items

- Create the merge commit (Gamemaster commit phase, per D07).
- Optionally fast-forward `main` and push, which needs separate approval.
- Optionally merge `upstream/main` beyond `v2.15.0` (3 commits) in a future item.

## Source references

- `plan.md` (D01-D08), `verification.md`.
- `packages/rpiv-web-tools/web-tools.ts` (`isProviderConfigured`) and `packages/rpiv-web-tools/index.test.ts` (#204 block).
- `packages/rpiv-web-tools/providers/{searxng,ollama,firecrawl}.ts` (META `envVar`).

## Wiki updates

- Pending Dream: record the v2.15.0 sync and the Firecrawl-only key-counting rule for provider visibility.

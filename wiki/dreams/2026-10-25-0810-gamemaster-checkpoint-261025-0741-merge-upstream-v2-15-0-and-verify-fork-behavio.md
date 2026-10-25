---
schema_version: 1
episode_id: "2026-10-25-0810-gamemaster-checkpoint-261025-0741-merge-upstream-v2-15-0-and-verify-fork-behavio"
timestamp: "2026-10-25T08:10:14+01:00"
summary: "Upstream rpiv-mono v2.15.0 is merged (staged, not yet committed) on sync/upstream-v2.15.0, with all fork customizations kept and Firecrawl-only key counting for provider visibility."
kind: "gamemaster-checkpoint"
status: "shipped"
work_item: "261025-0741-merge-upstream-v2-15-0-and-verify-fork-behavior"
current: "direct"
---

# Gamemaster checkpoint: 261025-0741-merge-upstream-v2-15-0-and-verify-fork-behavior/direct

Date: 2026-10-25
Work item: 261025-0741-merge-upstream-v2-15-0-and-verify-fork-behavior
Status: shipped
In one line: Upstream rpiv-mono v2.15.0 is merged (staged, not yet committed) on sync/upstream-v2.15.0, with all fork customizations kept and Firecrawl-only key counting for provider visibility.

## Goal

Bring the fork up to upstream release v2.15.0 (ce6d3530) on a local sync branch, keep every fork customization, and prove with automated checks and a local Pi smoke test that both root-exposed extensions still load and behave correctly.

## How we approached it

1. Applied the user-selected direct amendment D07 first. Gamemaster's commit phase, not Implement, creates the local merge commit, and that commit includes the archive, spec/index.md, and the Dream wiki files.
2. Created sync/upstream-v2.15.0 from main ba1d25f8 and ran `git merge --no-ff --no-commit v2.15.0`. The unmerged paths were exactly the 8 that planning predicted with `git merge-tree`.
3. Resolved each conflict as the upstream file plus the fork delta. Most conflicts came from upstream's switch from `.js` to `.ts` import specifiers. Others were the `fallbackEnvVar` comment, the env-var table in docs/configuration.md, and the shared `isProviderConfigured` hasKey.
4. Found a source-truth conflict while implementing D03 (see Key decisions), asked Gamemaster, and recorded D08.
5. Ran lockfile-exact `npm ci`, the full verification plan, a fork-retention set comparison, a mutation check of the new tests, and a Pi 1.1.0 smoke test in tmux.
6. An independent contract-quality review passed. Archived the item with outcome.md after a passing preflight and terminal approval.
7. Dream found no wiki/index.md. The user approved (via Gamemaster) a minimal bootstrap index with only the generic Dream routes before this run.

## Key decisions

- **D08 narrows D03 to Firecrawl**: the plan assumed SearXNG and Ollama had no API-key env var, but their META declares SEARXNG_API_KEY and OLLAMA_API_KEY. Gamemaster chose option B: only Firecrawl counts a resolved key. Rejected option A, a generic key rule, because it would make key-only SearXNG/Ollama visible against the Design intent.
- **Firecrawl check mechanism**: compare `meta.name === FIRECRAWL_PROVIDER_META.name` inside the shared helper rather than adding a metadata framework.
- **Docs**: edited the "Picker markers" paragraph in docs/providers.md because it contradicted D08.
- **Test comment**: worded without parenthesized decision codes because of check:decision-codes.

## What did not work

- **Piping pi through tee in tmux**: the TUI rendered nothing. Run pi directly in the tmux pane.
- **Confirming tool registration via /export or a slash command**: /export fails for in-memory sessions and there is no tools list. A throwaway /tmp probe extension using `pi.getAllTools()` worked.
- **Scripted edit with precomputed offsets**: it corrupted web-tools.ts once. Repaired immediately, and later checks covered the file.

## Current state and where we left off

- Shipped and verified:
  - Merge fully staged on sync/upstream-v2.15.0 (755 paths, MERGE_HEAD ce6d3530, HEAD ba1d25f8). No unmerged paths.
  - Item archived as completed at spec/archive/261025-0741-merge-upstream-v2-15-0-and-verify-fork-behavior/.
- Pending:
  - The Gamemaster Git Commit phase creates the merge commit.
  - Fast-forwarding main, pushing, PRs, and publishing need separate approval.
  - Prior item 260910-1057 is still `planned` and untouched.

## Source of truth

- spec/archive/261025-0741-merge-upstream-v2-15-0-and-verify-fork-behavior/plan.md: contract, D01-D08.
- spec/archive/261025-0741-merge-upstream-v2-15-0-and-verify-fork-behavior/verification.md: commands, results, and review verdict.
- spec/archive/261025-0741-merge-upstream-v2-15-0-and-verify-fork-behavior/outcome.md: delivered scope and residual risks.
- packages/rpiv-web-tools/web-tools.ts: `isProviderConfigured`.
- packages/rpiv-web-tools/index.test.ts: the #204 block regression tests.

## Verification

- Done:
  - `npm ci` succeeded and the lockfile is unchanged.
  - check:ts-specifiers, check:host-provided-deps, check:file-sizes, and check:decision-codes passed.
  - npm test passed 7080. test:outside-coverage passed.
  - biome, tsc, build:site, and npm run check passed.
  - Manifest, prepare, and stale-limit checks passed, and the staging boundary holds.
  - The fork-retention set comparison passed, and the mutation check confirmed the tests catch both wrong rules.
  - Pi smoke: both extensions loaded, /web-tools --show rendered, and all three tools are registered.
  - Contract-quality review: PASS, 0 retries.
- Not verified yet:
  - The smoke ran on Pi 1.1.0, not 1.4.0.
  - No live Firecrawl, SearXNG, or Ollama calls were made.
  - npm skipped 6 install scripts (allowScripts).

## Open questions, blockers, next safe action

- Open/blocked: none.
- Next safe action: the Gamemaster Git Commit phase creates the local merge commit on sync/upstream-v2.15.0. The upstream pre-commit hook will rerun the checks.

## Dynamic knowledge trail

- wiki/workflows/upstream-sync.md: Topic-specific dynamic knowledge, new page.

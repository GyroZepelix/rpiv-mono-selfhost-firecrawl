# Verification: Merge upstream v2.15.0 and verify fork behavior

Work item: `261025-0741-merge-upstream-v2-15-0-and-verify-fork-behavior`
Date: 2026-10-25

## Environment

- Mode: direct. Assurance: medium (inherited from `plan.md`).
- Branch `sync/upstream-v2.15.0` created from `main` at `ba1d25f8`. Ran `git merge --no-ff --no-commit v2.15.0`. `MERGE_HEAD` = `ce6d3530`. Merge base = `5dcad51c`.
- Node v26.8.2, npm 11.19.1. After `npm ci`, `@earendil-works/pi-coding-agent` in `node_modules` is 1.4.0. Global `pi --version` is 1.1.0 (not upgraded).
- The merge commit has not been created (D07: the Gamemaster commit phase creates it). Nothing was pushed and `main` was not fast-forwarded.

## Commands and checks

| Check | Result | Evidence |
| --- | --- | --- |
| T01 `git rev-parse MERGE_HEAD`; `git diff --name-only --diff-filter=U` | Pass | `ce6d3530`. Exactly the 8 unmerged paths listed in plan Context. |
| Step 1 unmerged / markers / `git diff --check` / `git diff --cached --check` | Pass | No unmerged paths, no markers, both checks exit 0. |
| Step 2 `npm ci` | Pass (exit 0) | npm warned that 6 install scripts were not run (allowScripts: esbuild, sharp, fsevents, protobufjs, @google/genai). No check depended on them. |
| Step 2 `git diff --quiet -- package-lock.json` | Pass | Lockfile unchanged. |
| Step 2 `check:ts-specifiers` / `check:host-provided-deps` / `check:file-sizes` | Pass | 723 files scanned. `check:file-sizes` reports "1 new under cap", which is informational and not a failure. |
| Step 3 focused vitest (6 files) | Pass | 362 passed. After the new regression tests, `packages/rpiv-web-tools` reports 369 passed. |
| Step 4 `npm test` | Pass | 7080 passed. |
| Step 4 `npm run test:outside-coverage` | Pass | 2 passed. |
| Step 4 `npx biome check --error-on-warnings .` | Pass | 751 files. 3 infos in upstream `rpiv-pi` tests, unrelated. |
| Step 4 `npx tsc --noEmit -p tsconfig.base.json` | Pass | 725 non-`node_modules` files in the program. |
| Step 4 `check:decision-codes` / `build:site` | Pass | 401 files scanned. Site built 83 pages. |
| Pre-commit parity `npm run check` (writes) | Pass | No fixes applied. Worktree unchanged outside `spec/`. |
| Step 5 root manifest and guarded `prepare` | Pass | `pi.extensions` lists exactly the two entry points. `env -i` husky line exits 0. |
| Step 6 stale-limit grep | Pass | No matches. `MAX_QUESTIONS = 15` in `tool/types.ts`. |
| Step 7 staging boundary | Pass | 755 staged paths, no `UU`. Every staged path is in the `5dcad51c..v2.15.0` upstream delta (one rename pair is upstream's `agents.test.ts` -> `agents-sync.test.ts`). No `spec/` or `wiki/` staged. Staged with explicit `git add -- <paths>`. |
| Fork-delta retention | Pass | The fork's file set `5dcad51c..ba1d25f8` (26 files) equals the set of files still differing from `v2.15.0`. A line-level scan shows every fork-added line present (`.js`->`.ts` normalised), except the intentional conflict and D08 replacements in `web-tools.ts`, `architecture.md`, and `docs/providers.md`. |
| D03/D08 mutation check | Pass | With Firecrawl key-counting removed, 2 tests fail. With the generic key rule for all `baseUrlEnvVar` providers (option A), the new SearXNG/Ollama test fails. Restored and confirmed byte-identical (`cmp`). |
| Step 8 Pi smoke (`pi --no-extensions -e . --no-session`, Pi 1.1.0, in tmux) | Pass | Startup lists `[Extensions] rpiv-ask-user-question, rpiv-web-tools`, with no load errors. `/web-tools --show` rendered read-only: keys masked, Firecrawl URL shown with source. A throwaway read-only probe extension (`/tmp/v215/probe.ts`, outside the repo) recorded `getAllTools`/`getActiveTools` = `web_search`, `web_fetch`, `ask_user_question`. No prompt was sent to a model, and `web_search`/`web_fetch` were never invoked. |

## Requirement coverage

| Requirement | Evidence | Status |
| --- | --- | --- |
| Branch plus `--no-ff --no-commit` merge of `v2.15.0`, with no rebase, reset, or restart | T01 evidence | Met |
| Firecrawl URL precedence, Cloud key rule, self-hosted optional auth | Fork `firecrawl.ts` logic retained (only the import block conflicted). Existing firecrawl tests pass. | Met |
| `/web-tools` Firecrawl configure/meta exports | `providers/index.ts` exports `configureFirecrawl`, `FIRECRAWL_API_URL_ENV_VAR`, `FIRECRAWL_DEFAULT_URL` with `.ts` specifiers | Met |
| Shared `isProviderConfigured`, extended per D03 and narrowed by D08 | `web-tools.ts`: `hasKey = (p) => isProviderConfigured(p, current)`. The `baseUrlEnvVar` branch counts an explicit env or config URL, and a resolved key for Firecrawl only. New tests in `index.test.ts` (#204 block) cover a key-only Firecrawl from config or env (in the schema and marked `(configured)`), and key-only SearXNG/Ollama (not offered, not marked). | Met |
| `MAX_QUESTIONS = 15` everywhere | Constant retained. Test imports use `MAX_QUESTIONS` via `.ts`. Stale-limit grep is clean. Site and skill text unchanged from the fork. | Met |
| Root manifest and guarded `prepare`; other upstream root changes kept | `git diff v2.15.0 -- package.json` shows only the `pi` block and `prepare` | Met |
| Upstream baseline, `.ts` specifiers, `fallbackEnvVar` kept | `types.ts` comment carries both lines. `configuration.md` keeps `YDC_API_KEY` and the `FIRECRAWL_API_URL` row. `check:ts-specifiers` passes. | Met |
| Docs and guidance consistent with retained behavior | `architecture.md` (key-chain paragraph merged, `isProviderConfigured` rule updated), `docs/configuration.md`, `docs/providers.md` "Picker markers" (D08) | Met |
| Lockfile-exact `npm ci` only | `npm ci` exit 0, lockfile unchanged | Met |
| Explicit staging, no `spec/` or `wiki/` | Step 7 | Met |

## Decisions recorded during implementation

- D07 (direct amendment, user-authorized): the local merge commit is created later by the Gamemaster commit phase. Implement did not commit.
- D08 (source-truth correction, Gamemaster option B): `searxng.ts` and `ollama.ts` declare `envVar` `SEARXNG_API_KEY` and `OLLAMA_API_KEY`, which contradicts the Design premise. D03 is narrowed so that only Firecrawl counts a resolved key. SearXNG and Ollama keep upstream's URL-only rule.
- A test comment avoids parenthesized decision codes, per `scripts/check-no-decision-codes.mjs`.

## Review findings

- Contract-quality review (medium, direct completion; independent read-only `flash-reviewer`, session `contract-review-v215`): **PASS**, no blocking or non-blocking findings. Coverage included all 8 conflict resolutions, the D08 helper and tests, the `docs/providers.md` edit, the fork customizations (manifest, `prepare`, `MAX_QUESTIONS`, site tagline, skill batching text), and the staging boundary. Retries: 0.
- Residual uncertainty the reviewer noted matches the Unverified areas below.

## Failures and skipped checks

- No required check failed.
- The first `/export` attempt during the smoke test failed ("Cannot export in-memory session to HTML"). It was replaced by the probe extension, so this is not a product failure.
- `/web-tools --show` read the user's real web-tools config through the documented legacy `~/.config` fallback, because the temporary `XDG_CONFIG_HOME` was empty. It was read-only: keys were masked and no file was written.

## Unverified areas

- Smoke ran on Pi 1.1.0, not on the dev target 1.4.0. Automated tests ran against the 1.4.0 dev dependency.
- No live Firecrawl, SearXNG, or Ollama calls were made (per D06).
- Pi itself displayed host update notices at startup. That is outside the extensions.

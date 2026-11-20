# Verification: Anthropic web search provider for rpiv-web-tools

Work item: `261120-2305-anthropic-web-search-provider-for-rpiv-web-tools`
Date: 2026-11-20

Assurance: medium (inherited from `plan.md`). Mode: direct (T01 to T04).

## Environment

- macOS. Node from the repository toolchain. Repository dev dependency is Pi 1.4.0; the user's installed Pi is 1.5.2 (`/Users/dgjalic/.bun/bin/pi`); `@gotgenes/pi-anthropic-auth` 3.6.0.
- Starting boundary: `HEAD` 8cad0133b08958add5971a1cd93da654c5aa0cf4 with nothing staged. The only dirty paths at the start were this item's planning artifacts (`spec/index.md`, `spec/backlog.md`, `spec/active/<id>/`).
- Changed paths:
  - Source: `packages/rpiv-web-tools/providers/anthropic.ts` (new), `providers/types.ts`, `providers/factory.ts`, `providers/index.ts`, `providers/config.ts`, `web-tools.ts`.
  - Tests: `providers/anthropic.test.ts` (new), `web-tools.anthropic.test.ts` (new), `providers/config.test.ts`, `index.test.ts`. The `index.test.ts` changes add `Anthropic` to the picker-order list and an `ANTHROPIC_API_KEY` reset.
  - Docs: package `README.md`, `docs/providers.md`, `docs/configuration.md`, `docs/tools.md`, `.rpiv/guidance/packages/rpiv-web-tools/architecture.md`, `wiki/workflows/upstream-sync.md`, `wiki/log.md`.

## Commands and checks

| Check | Result | Evidence |
| --- | --- | --- |
| `npx vitest run packages/rpiv-web-tools` (baseline, before changes) | Pass | 7 files, 369 tests |
| `npx vitest run packages/rpiv-web-tools/providers/anthropic.test.ts` | Pass | 22 tests |
| `npx vitest run packages/rpiv-web-tools` (after T02 and again after T03) | Pass | 9 files, 410 tests |
| `npm test` | Pass | 312 files, 7137 tests |
| `npx tsc --noEmit -p tsconfig.base.json` | Pass | exit 0 |
| `npx biome check --error-on-warnings .` (no `--write`) | Pass | exit 0; 3 infos in `packages/rpiv-pi` were already there |
| `npm run check:ts-specifiers` / `check:host-provided-deps` / `check:decision-codes` | Pass | all report OK |
| T04 live check (approved by the user, run once) | Pass | see below |

T04 live check:

- Setup: a temporary `XDG_CONFIG_HOME` holding a 0600 copy of the user's config with `provider: "anthropic"`, `fallbackProvider: "firecrawl"`, and `fetchProvider: "firecrawl"`.
- Command: `pi -p --no-session --no-extensions --no-skills --no-context-files --no-mcp -e <pi-anthropic-auth> -e ./packages/rpiv-web-tools/index.ts --tools web_search,web_fetch --mode json "<one search, then fetch the first result>"`. No `--model` flag was passed.
- Process: `pi` exited 0. The final assistant message ended with `stopReason: "stop"`.
- `web_search`:
  - No tool error. `details.backend` was `anthropic`, there was no `fallbackFrom`, and `resultCount` was 3.
  - An answer was present (1296 characters), and all 3 results had non-empty snippets.
  - Sources: the npm package page for `@earendil-works/pi-coding-agent`, the GitHub release `v1.5.2`, and the `pi.dev` changelog.
  - The output contained no "extra usage" or HTTP 400 text.
- `web_fetch` on the first result:
  - No tool error. `contentType` was `text/markdown`, which identifies Firecrawl, the only markdown-returning provider configured.
  - The page title was "Just a moment...": Firecrawl scraped npm's Cloudflare challenge page. The served-by-Firecrawl criterion is met, but the page content itself is a challenge page.
- Cleanup: the temporary directory and the JSON output were deleted. The real config is unchanged (`provider: firecrawl`). No credentials were printed or recorded.

## Requirement coverage

| Requirement | Evidence | Status |
| --- | --- | --- |
| R1 results, answer, dedupe, cap, rendering | `anthropic.test.ts` (registry and API-key parsing, cap, answer without sources); `web-tools.anthropic.test.ts` (answer above the list, empty envelope); T04 | Pass |
| R2 auth order, no OAuth by direct fetch | `anthropic.test.ts`: login wins, a failed login falls back to the key, an `sk-ant-oat` key never reaches fetch, headers are exactly three, missing-credentials error; T04 had no 400 | Pass |
| R3 model preference and override | `anthropic.test.ts`: preference list, configured known model, unknown id override, blank model ignored, key-path model | Pass |
| R4 tool type, `max_uses`, prompt | `anthropic.test.ts`: `web_search_20250305`, default 3, bounded 1 to 10, prompt names the count | Pass |
| R5 failures throw | `anthropic.test.ts`: HTTP error with the key redacted, tool error inside HTTP 200, refusal without sources, registry error, abort, invalid body | Pass |
| R6 config keys | `config.test.ts`: the new keys round-trip and invalid values drop per field | Pass |
| R7 search fallback | `web-tools.anthropic.test.ts`: fallback once with a note and `fallbackFrom`; none on zero results, abort, override, or same-as-default; both-fail message; unknown fallback | Pass |
| R8 `fetchProvider` | `web-tools.anthropic.test.ts`: Firecrawl while Anthropic is the search provider, unchanged behavior when unset, unknown name throws; T04 fetch served by Firecrawl | Pass |
| R9 enum visibility | `web-tools.anthropic.test.ts`: listed when active, the fallback, or keyed, and hidden otherwise | Pass |
| R10 picker and `--show` | `web-tools.anthropic.test.ts`: Enter keeps or leaves the key unset; typed key saved; `--show` lines | Pass |
| R11 lean | no new tools, commands, or dependencies; `check:host-provided-deps` OK; no `@earendil-works/pi-ai` import | Pass |
| R12 docs and keep-list | README, `providers.md`, `configuration.md`, architecture guidance, upstream-sync keep-list (plus `tools.md`) | Pass (manual read-through) |

## Review findings

- Focused review after T02 (independent `flash-reviewer`): PASS, with no blocking or non-blocking findings. 0 retries.
- Final contract-quality review over T01 to T04: PASS. 0 retries.
  - Non-blocking: `withAnthropicSearchTool` leaves Pi's `system` text untouched. This is harmless because the request carries only the search prompt and the search tool. Not changed.

## Failures and skipped checks

- No check failures.
- Deviation: `docs/tools.md` (not named in R12) was also updated so its result envelope, error enum, and fetch dispatch text stay accurate. This is a documentation-only change.

## Unverified areas

- The live run drove the conversation with `anthropic/claude-opus-5-5`; Pi chose this rather than the user's `openai-codex` default. Searching from a non-Claude chat model is covered only by unit tests through the registry seam.
- The API-key path is verified only with stubbed `fetch`.
- No fixed request timeout was added. Configurable timeouts are out of scope, and other providers also only forward the caller's signal.

# Outcome: Anthropic web search provider for rpiv-web-tools

Work item: `261120-2305-anthropic-web-search-provider-for-rpiv-web-tools`
Disposition: completed
Date: 2026-11-20

## Delivered scope

Requirements R1 to R12 were delivered as planned, in tasks T01 to T04.

- **Provider**: new `packages/rpiv-web-tools/providers/anthropic.ts`.
  - It searches through Pi's Anthropic login via `modelRegistry.streamSimple()` first. `onPayload` replaces the tools with exactly `web_search_20250305`, and `onProviderStreamEvent` captures the search and citation blocks.
  - When there is no login, it falls back to a plain `x-api-key` request. An OAuth token is never sent by direct `fetch()`.
  - Model preference is fixed: `claude-haiku-5-5`, then `claude-sonnet-5-5`, unless `anthropic.model` overrides it.
  - `max_uses` defaults to 3 and is bounded 1 to 10.
  - Failures throw.
- **Contracts**: `SearchResponse.answer` and an optional `SearchContext` argument on `SearchProvider.search`.
- **Config**: `fallbackProvider`, `fetchProvider`, and `anthropic.{model,maxUses}`.
- **Orchestrator**:
  - `searchWithFallback` runs the fallback once, only when the default provider fails. The result carries a visible note and `details.fallbackFrom`.
  - `instantiateFetchProvider` sends `web_fetch` to `fetchProvider` when it is set.
  - `web_search` shows the `**Answer:**` above the result list.
  - The per-call `provider` enum lists `anthropic` when it is active, the configured fallback, or keyed.
  - The `/web-tools` picker has an optional-key Anthropic entry, and `--show` gains three lines.
- **Docs**: package `README.md`, `docs/providers.md`, `docs/configuration.md`, the architecture guidance, and the upstream-sync keep-list.

## Deviations from plan

- `docs/tools.md` was also updated (documentation only). Without the update, its result envelope, error enum, and fetch dispatch text would have gone stale.
- The T04 live run did not use the user's `openai-codex` default chat model. Pi resolved the chat model to `anthropic/claude-opus-5-5`. Searching from a non-Claude chat model is therefore covered by unit tests only.

## Verification summary

Evidence is in [verification.md](./verification.md).

- `npx vitest run packages/rpiv-web-tools`: 410/410 passed. `npm test`: 7137/7137 passed.
- `tsc`, `biome --error-on-warnings`, `check:ts-specifiers`, `check:host-provided-deps`, and `check:decision-codes` all pass.
- T04 live check on Pi 1.5.2 with pi-anthropic-auth 3.6.0:
  - `web_search` ran with `backend: anthropic`, returned an answer and 3 sources, and had no `fallbackFrom`. There was no 400 and no "extra usage" error.
  - `web_fetch` was served by Firecrawl.
- Focused review after T02: PASS. Final contract-quality review: PASS. 0 retries.

## Retained, reverted, or transferred work

All changes are retained in the working tree, uncommitted. Nothing was reverted or transferred.

## Residual risks

- Searching from a non-Claude chat model is verified only by unit tests, because the live run's chat model resolved to `anthropic/claude-opus-5-5`.
- The API-key path is verified only against stubbed `fetch`.
- No request timeout was added. A hung Anthropic request waits for the caller's abort.
- The fetched npm page in the live run came back through Firecrawl as a Cloudflare challenge page ("Just a moment..."). Fetch routing worked, but that page's content was not useful.

## Follow-up work items

None.

## Source references

- [plan.md](./plan.md), [verification.md](./verification.md), [discovery.md](./discovery.md), [handoff.md](./handoff.md)
- Reference implementation: `../pi-web-access/anthropic-search.ts`, outside this repository.

## Wiki updates

- `wiki/workflows/upstream-sync.md`: added the Anthropic provider keep-list entry.
- `wiki/log.md`: added an entry for that keep-list update.
- Stale-status sweep (`measure-wiki-quality.py --stale-status`): 0 hits, so no fixes were needed.

---
schema_version: 1
episode_id: "2026-11-20-2347-gamemaster-checkpoint-261120-2305-anthropic-web-search-provider-for-rpiv-web-too"
timestamp: "2026-11-20T23:47:30+01:00"
summary: "rpiv-web-tools gained a fork-only Anthropic web search provider (Pi login first, API key second), a once-only search fallback, and a separate fetchProvider; verified by tests, two passing reviews, and one live search, then archived as completed (uncommitted)."
kind: "gamemaster-checkpoint"
status: "shipped"
work_item: "261120-2305-anthropic-web-search-provider-for-rpiv-web-tools"
current: "direct"
topics: ["rpiv-web-tools","anthropic-search"]
---

# Gamemaster checkpoint: 261120-2305-anthropic-web-search-provider-for-rpiv-web-tools/direct

Date: 2026-11-20
Work item: 261120-2305-anthropic-web-search-provider-for-rpiv-web-tools
Status: shipped
In one line: rpiv-web-tools gained a fork-only Anthropic web search provider (Pi login first, API key second), a once-only search fallback, and a separate fetchProvider; verified by tests, two passing reviews, and one live search, then archived as completed (uncommitted).

## Goal

Make Anthropic's server-side web search, billed to the user's Claude subscription through Pi's login, the everyday `web_search` backend in `rpiv-web-tools`. Also add a simple fallback provider and keep `web_fetch` on the user's self-hosted Firecrawl. The work came from a handoff after the larger pi-web-access fork was shelved.

## How we approached it

1. Implement ran in direct mode at medium assurance from the canonical plan (T01 to T04). It adapted `../pi-web-access/anthropic-search.ts` to this package's provider interface and rewrote its node:test cases for vitest.
2. T01: added `providers/anthropic.ts`.
   - The login path goes through `modelRegistry.streamSimple()`. `onPayload` replaces the tools with exactly `web_search_20250305`, and `onProviderStreamEvent` captures the search and citation blocks.
   - The API-key path uses a plain `x-api-key` request and rejects `sk-ant-oat` tokens before any request.
   - A parser shared by both paths builds the results and the answer.
   - The tests use a fake registry that replays recorded stream events.
3. T02: added `SearchResponse.answer` and a `SearchContext` argument, the new config keys, `searchWithFallback`, `instantiateFetchProvider`, the enum rule, and the picker and `--show` changes. Orchestrator tests are in `web-tools.anthropic.test.ts`.
4. A focused review after T02 returned PASS.
5. T03: updated the package docs and the architecture guidance, added the upstream-sync keep-list entry, and appended a `wiki/log.md` entry.
6. T04: ran one live check, with explicit approval, using a temporary 0600 `XDG_CONFIG_HOME` copy of the user's config. The final contract-quality review then returned PASS.
7. With terminal approval, wrote outcome.md and archived the item.

## Key decisions

- **No `@earendil-works/pi-ai` import** - chose to derive registry types from `pi-coding-agent` and leave reasoning unset, because the plan (D9) avoids a new peer declaration; rejected the reference's `clampThinkingLevel`.
- **No fixed request timeout** - chose to forward only the caller's signal like other providers, because configurable timeouts were out of scope.
- **Anthropic-only fallback visibility in the enum** - chose to list `anthropic` when it is the configured fallback without generalizing to other providers, because a generalized rule would re-advertise unconfigured providers (#204).
- **`docs/tools.md` updated too** - chose a documentation-only addition beyond R12 so the result envelope and fetch dispatch text stay accurate.

## What did not work

- **Live check from a non-Claude chat model** - running without `--model` resolved to `anthropic/claude-opus-5-5` instead of the user's `openai-codex` default, so that path was not exercised live; a future live check should pass `--model` explicitly.
- **Live fetch content** - Firecrawl scraped npm's Cloudflare challenge page for the npmjs.com result; routing was proven but the content was not useful.

## Current state and where we left off

- Shipped/verified: all source, tests, docs, and wiki changes are in the working tree, uncommitted. The item is archived at `spec/archive/261120-2305-anthropic-web-search-provider-for-rpiv-web-tools/` with `status: completed`.
- Pending: Gamemaster's Git checkpoint (staging and commit), which is not done here.

## Source of truth

- `spec/archive/261120-2305-anthropic-web-search-provider-for-rpiv-web-tools/plan.md`: canonical contract (R1 to R12, D1 to D10).
- `spec/archive/261120-2305-anthropic-web-search-provider-for-rpiv-web-tools/verification.md`: checks, live-check observations, and requirement coverage.
- `spec/archive/261120-2305-anthropic-web-search-provider-for-rpiv-web-tools/outcome.md`: delivered scope, deviations, and residual risks.
- `packages/rpiv-web-tools/providers/anthropic.ts` and `packages/rpiv-web-tools/web-tools.ts`: the implementation.
- `.rpiv/guidance/packages/rpiv-web-tools/architecture.md`: the provider contract as repository guidance.

## Verification

- Done:
  - `npx vitest run packages/rpiv-web-tools` 410/410 and `npm test` 7137/7137 passed.
  - `tsc`, biome, and the ts-specifiers, host-provided-deps and decision-codes checks pass.
  - T04 live check: backend `anthropic`, an answer and 3 sources, no fallback, and no 400 or "extra usage" error. `web_fetch` was served by Firecrawl.
- Not verified yet: the API-key path against the real API; search driven by a non-Claude chat model.
- Remaining gate violations: none.

## Open questions, blockers, next safe action

- Open/blocked: none.
- Next safe action: Gamemaster reviews `git status` and creates the user-controlled Git checkpoint for the package, spec archive, and wiki changes.

## Dynamic knowledge trail

- `wiki/observations.md`: Observation (two live-check findings).

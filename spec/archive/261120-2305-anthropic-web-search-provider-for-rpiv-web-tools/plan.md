# Plan: Anthropic web search provider for rpiv-web-tools

Work item: `261120-2305-anthropic-web-search-provider-for-rpiv-web-tools`
Status: Planned
Created: 2026-11-20
Updated: 2026-11-20

Assurance: medium - uses the user's Claude OAuth login, where the wrong transport risks third-party "extra usage" billing; changes the shared search and fetch dispatch every `web_search`/`web_fetch` call goes through; fork-only and reversible by revert.

Execution mode: direct (one session). Sources: [discovery.md](./discovery.md), [handoff.md](./handoff.md).

## Goal

With `"provider": "anthropic"` in `~/.config/rpiv-web-tools/config.json`, `web_search` runs Anthropic's server-side web search through the user's Pi Claude login from any chat model, shows Claude's short cited answer above a title/URL/snippet list, tries a configured fallback provider once when Anthropic fails, and `web_fetch` keeps reading pages through Firecrawl via a separate `fetchProvider` setting.

## Context

- Package `packages/rpiv-web-tools`. `web-tools.ts` owns resolution (`instantiateProvider`: per-call override, `WEB_SEARCH_PROVIDER`, `config.provider`, default `brave`), both tools, and `/web-tools`. Providers are `providers/<vendor>.ts` with a `ProviderMeta` in `providers/index.ts` `PROVIDERS` and construction in `providers/factory.ts`. Config schema and IO are in `providers/config.ts`.
- `SearchProvider.search(query, maxResults, signal)` receives no Pi context today; the tool `execute(..., ctx)` receives `ctx.modelRegistry` with `find`, `getApiKeyAndHeaders`, and `streamSimple` (`@earendil-works/pi-coding-agent` `dist/core/model-registry.d.ts`).
- `web_fetch` currently uses the active provider's native `fetch()` or the generic HTML fetcher, so an `anthropic` default would silently drop Firecrawl fetching.
- The per-call `provider` enum is built at registration (no `ctx`) and refreshed after a `/web-tools` save (#204).
- Proven in pi-web-access (handoff): subscription billing applies only through `modelRegistry.streamSimple()` with `@gotgenes/pi-anthropic-auth` (installed in the user's Pi, 3.6.0); a direct OAuth `fetch()` risks the "extra usage" 400. Pi's Anthropic transport drops `server_tool_use`, `web_search_tool_result`, and citations from the assembled message; they are readable only through `onProviderStreamEvent`, and the tool is injected through `onPayload`. Results carry URL, title, page age, and encrypted content; readable text comes from the answer and `cited_text` (max 150 chars); tool errors arrive inside HTTP 200.
- Reference implementation to adapt (different provider interface): `../pi-web-access/anthropic-search.ts`, tests `../pi-web-access/test/anthropic-provider.test.mjs` (node:test; rewrite for vitest), decisions in `../pi-web-access/spec/archive/261120-1135-add-anthropic-web-search-provider/plan.md`.
- `@earendil-works/pi-ai` is host-provided but not a declared peer of this package; this plan avoids it (see D9).

## Requirements

- R1: A provider named `anthropic` returns `SearchResponse` with `results` (title, URL, snippet from `cited_text` or empty), deduplicated by URL, cited sources first, capped by `max_results`, plus an optional `answer` (Claude's final text). `web_search` shows the answer above the result list. An answer without sources is returned as a result; no answer and no sources is the existing empty-results envelope.
- R2: Auth order: (1) Pi's `anthropic` login through `ctx.modelRegistry.streamSimple()` with `onPayload` replacing `tools` by exactly one web search tool and `onProviderStreamEvent` capturing search and citation blocks; (2) an API key from `ANTHROPIC_API_KEY` or `apiKeys.anthropic`, sent as a plain `x-api-key` request to `https://api.anthropic.com/v1/messages` with no Claude Code identity. A token starting `sk-ant-oat` is never sent by direct `fetch()`. With neither, the provider throws a clear missing-credentials error.
- R3: Search model preference is the fixed list `claude-haiku-5-5`, then `claude-sonnet-5-5` (first id the registry knows for the login path; first id for the key path); `anthropic.model` overrides it. No newest-model inference.
- R4: Tool type `web_search_20250305`; `max_uses` defaults to 3, bounded 1 to 10, configurable as `anthropic.maxUses`. The prompt asks Claude to search and list what it found and states the wanted result count.
- R5: Failures throw `Error`: missing credentials, HTTP errors, Anthropic tool errors (`web_search_tool_result_error`), and refusals without sources.
- R6: New optional config keys, unknown keys still round-trip: `fallbackProvider` (string), `fetchProvider` (string), `anthropic` (`{ model?: string; maxUses?: number }`). Invalid values degrade per field like existing keys.
- R7: Search fallback: when no per-call `provider` was given and the resolved default provider throws, and `fallbackProvider` is set, known, and different from the default, the fallback provider runs once. A served-by-fallback result carries a one-line note naming the failed default, its error message, and the fallback, and `details.fallbackFrom`. No fallback on zero results, on abort (`signal.aborted`), or for a per-call override. When both fail, the thrown error includes both messages. An unknown `fallbackProvider` name throws the uniform unknown-provider error when the fallback is needed.
- R8: `web_fetch` provider selection: `fetchProvider` when set (validated like other names; unknown throws), else today's resolution. Interceptors still run first; a provider without `fetch()` still uses the generic HTML fetcher. No fallback for fetch.
- R9: The per-call `web_search` `provider` enum lists `anthropic` only when it is the active provider, the configured fallback, or an Anthropic API key resolves. No login probing.
- R10: `/web-tools` lists Anthropic in the picker with an optional API-key prompt where Enter keeps any existing key or leaves it unset (Pi login is used); selecting it saves `provider: "anthropic"`. `/web-tools --show` displays `fallbackProvider`, `fetchProvider`, and the Anthropic model setting (or its default). No other new prompts.
- R11: Lean: no new tools, commands, shortcuts, or installed dependencies.
- R12: Documentation: package `README.md` provider list, `docs/providers.md`, `docs/configuration.md` keys table, `.rpiv/guidance/packages/rpiv-web-tools/architecture.md`, and the fork keep-list in `wiki/workflows/upstream-sync.md`.

## Out of scope

- YouTube or video analysis, browser curator, claim checking, extra slash commands, keyboard shortcuts.
- Retry or backoff; fallback for `web_fetch`; multi-turn continuation after `pause_turn`.
- Login probing or `session_start` re-registration for the enum.
- `/web-tools` prompts for fallback, fetch provider, or model.
- Configurable tool versions or timeouts; domain filters (the `web_search` tool has no domain parameter).
- Upstream pull request, `CHANGELOG.md` entry, version bumps, commits, pushes.
- Changing the user's real config file.

## Design

- `providers/types.ts`: `SearchResponse.answer?: string`; `SearchProvider.search(query, maxResults, signal?, context?)` where `context` is a minimal `SearchContext` carrying the optional Pi `modelRegistry`. Existing providers ignore it.
- `providers/anthropic.ts`: `AnthropicProvider` (search-only), `ANTHROPIC_PROVIDER_META` (`name: "anthropic"`, `envVar: "ANTHROPIC_API_KEY"`, `roles: ["search"]`, `configure` optional-key prompt), a pure parser over captured content blocks shared by both auth paths, a stream capture for `onProviderStreamEvent`, and a payload rewrite for `onPayload`. Registry types are derived from `@earendil-works/pi-coding-agent` (`ExtensionContext["modelRegistry"]` and its method parameters). Settings (model, maxUses) reach the provider through the factory from config.
- `web-tools.ts`: pass `{ modelRegistry: ctx.modelRegistry }` into `search()`; render `answer` above results and in `details`; wrap default-provider search with the R7 fallback; resolve the fetch provider per R8; extend `getVisibleProviderNames` per R9 and `formatShowConfigMessage` per R10.

## Decision Log

| ID | Scope | Decision | Rationale | Evidence | Revisit when |
| --- | --- | --- | --- | --- | --- |
| D1 | Fetch | Separate `fetchProvider`; unset keeps today's behavior | Independent search and fetch roles | discovery D1 | A third role needs selection |
| D2 | Fallback | Search only | Fetch keeps its own chain | discovery D2 | Firecrawl outages make fetch fallback worth it |
| D3 | Fallback | Once, on a thrown default-provider error; not on zero results, abort, or per-call override; visible note | Honors "never a silent fallback" for named providers | discovery D3, package guidance | Empty Anthropic results prove common |
| D4 | UI | Picker entry with optional key; new settings are config-file only, shown by `--show` | Lean, smaller merge surface | discovery D4 | User wants UI for them |
| D5 | Fork | Fork-only, on the upstream-sync keep-list | Depends on pi-anthropic-auth | discovery D5 | User wants to upstream it |
| D7 | Enum | `anthropic` listed when active, fallback, or keyed; no login probing | Default search provider selects Anthropic regardless of chat model | discovery D7 | User wants ad hoc overrides while another provider is default |
| D8 | Transport | Login through `modelRegistry.streamSimple()` first, plain API key second, never OAuth by direct `fetch()` | Only the registry path gets subscription billing shaping | handoff; pi-web-access D1 and live check | Pi removes `onProviderStreamEvent` or pi-anthropic-auth stops spreading options |
| D9 | Dependencies | No `@earendil-works/pi-ai` import; derive types from `pi-coding-agent`; leave reasoning unset instead of clamping thinking | Avoids a new peer declaration and lockfile change | `scripts/check-host-provided-deps.mjs`; package.json peers | A runtime pi-ai import proves unavoidable (stop and ask) |
| D10 | Config | Key names `fallbackProvider`, `fetchProvider`, `anthropic.model`, `anthropic.maxUses` | Matches the handoff's desired shape | handoff example config | Upstream adopts different names |

## Work breakdown

- [x] T01: Anthropic provider and parser
  - Depends on: none
  - Scope: `providers/anthropic.ts`, `SearchResponse.answer` and the optional `search()` context in `providers/types.ts`, registration in `providers/index.ts` and `providers/factory.ts`.
  - Expected areas: `packages/rpiv-web-tools/providers/`, new `providers/anthropic.test.ts`.
  - Acceptance: R1 to R5 under unit tests with a fake `modelRegistry` (`find`, `getApiKeyAndHeaders`, `streamSimple` invoking `onPayload` and replaying recorded events through `onProviderStreamEvent`) and stubbed `fetch`.
  - Verification: `npx vitest run packages/rpiv-web-tools/providers/anthropic.test.ts`
- [x] T02: Orchestrator, config, and `/web-tools`
  - Depends on: T01
  - Scope: config schema keys, ctx pass-through, answer rendering, search fallback, fetch-provider selection, enum visibility, picker and `--show`.
  - Expected areas: `web-tools.ts`, `providers/config.ts`, `index.test.ts` or a new focused orchestrator test file, `providers/config.test.ts`.
  - Acceptance: R6 to R11; existing tests unchanged except where they enumerate providers.
  - Verification: `npx vitest run packages/rpiv-web-tools`
- [x] T03: Documentation and keep-list
  - Depends on: T02
  - Scope: R12.
  - Expected areas: `packages/rpiv-web-tools/README.md`, `packages/rpiv-web-tools/docs/providers.md`, `packages/rpiv-web-tools/docs/configuration.md`, `.rpiv/guidance/packages/rpiv-web-tools/architecture.md`, `wiki/workflows/upstream-sync.md` (plus `wiki/log.md` per `wiki/AGENTS.md`).
  - Acceptance: docs name the provider, auth order and subscription note, the three config keys, fallback rules, and `fetchProvider`; keep-list names the Anthropic provider files and orchestrator changes.
  - Verification: manual read-through.
- [x] T04: Live check (requires explicit user approval before running)
  - Depends on: T02
  - Scope: one real search through the user's Pi login with only pi-anthropic-auth and this package loaded, using a temporary `XDG_CONFIG_HOME` (mode 0600, removed afterwards) holding a copy of the user's config with `provider: "anthropic"`, `fallbackProvider: "firecrawl"`, `fetchProvider: "firecrawl"`; then one `web_fetch` of a returned source. Shape: `pi -p --no-session --no-extensions --no-skills --no-context-files --no-mcp -e <pi-anthropic-auth> -e ./packages/rpiv-web-tools/index.ts --tools web_search,web_fetch --mode json "..."`.
  - Acceptance: search returns an answer and at least one source, no "extra usage" 400, `details.backend` is `anthropic` with no `fallbackFrom`; the fetch is served by Firecrawl.
  - Verification: observation recorded in `verification.md` without credentials.

## Acceptance criteria

- `web_search` with `provider: "anthropic"` returns an answer above deduplicated, capped results through Pi's login, and through an API key when no login exists (stubbed in tests).
- No OAuth token reaches a direct `fetch()`; the API-key request headers are only `anthropic-version`, `content-type`, `x-api-key`.
- Model resolution picks `claude-haiku-5-5`, then `claude-sonnet-5-5`, unless `anthropic.model` is set.
- With a failing default and `fallbackProvider` set, the fallback serves the search once with a visible note; abort, zero results, per-call override, and same-as-default do not fall back; double failure reports both errors.
- `web_fetch` uses `fetchProvider` when set and otherwise behaves as before.
- The per-call enum and `/web-tools` picker and `--show` behave per R9 and R10.
- All existing tests pass; repository checks pass; T04 passes after approval.

## Verification plan

- `npx vitest run packages/rpiv-web-tools`
- `npm test`
- `npm run check:ts-specifiers`, `npm run check:host-provided-deps`, `npm run check:decision-codes`
- `npx biome check --error-on-warnings .` (no `--write`) and `npx tsc --noEmit -p tsconfig.base.json`
- T04 live check after explicit approval.
- Reviews (medium assurance): one coherent-boundary review after T02 against R1 to R11, and one final contract-quality review against this plan.

## Risks and blockers

- Pi stream event shapes may differ from raw Anthropic SSE; parse defensively and test recorded samples from the reference.
- The repository dev dependency is Pi 1.4.0 while the user runs 1.5.2; both expose `onPayload` and `onProviderStreamEvent`. T04 runs on 1.5.2.
- Leaving reasoning unset (D9) could enable unwanted thinking on some models; T04 observes the real behavior; if it fails, stop and ask before adding a pi-ai import.
- `pause_turn` on long searches yields a partial result; acceptable with bounded `max_uses`.
- The API-key path is verified only with stubbed `fetch` unless the user supplies a key.

## Progress

- [x] Planning complete and confirmed.
- [x] Implementation complete (T01 to T04).
- [x] Verification passed; see [verification.md](./verification.md).

## Execution handoff

Use PI Agent in a fresh session in this repository with this prompt:

```text
Read spec/active/261120-2305-anthropic-web-search-provider-for-rpiv-web-tools/plan.md and item.yaml completely, plus .rpiv/guidance/packages/rpiv-web-tools/architecture.md and wiki/workflows/upstream-sync.md.
Implement T01 to T03 in order at the recorded medium assurance, preserving Requirements, Out of scope, Decision Log, and Verification plan. Adapt ../pi-web-access/anthropic-search.ts and its tests; rewrite tests for vitest.
Update Progress and the Decision Log only for confirmed implementation discoveries.
Run the Verification plan checks, then ask before the T04 live search.
Stop and ask before dependencies (including a pi-ai import), migrations, destructive operations, external writes, commits, pushes, or scope expansion.
Record only verified evidence, failures, skipped checks, and residual uncertainty in verification.md.
```

## Proposed durable knowledge updates

- After implementation: the upstream-sync keep-list entry (T03) and, if the live check teaches something new about Pi's stream events, a `wiki/research/` note with provenance.

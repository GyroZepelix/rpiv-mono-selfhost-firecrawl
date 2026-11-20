# Discovery: Anthropic web search provider for rpiv-web-tools

Work item: `261120-2305-anthropic-web-search-provider-for-rpiv-web-tools`
Status: Ready for spec
Created: 2026-11-20
Updated: 2026-11-20

Assurance: medium (user confirmed) - uses the user's Claude OAuth login, where the wrong transport risks third-party "extra usage" billing; changes the shared search and fetch dispatch every `web_search`/`web_fetch` call goes through; fork-only and reversible by revert.

Origin: backlog B1 (promoted and removed from `spec/backlog.md`), handoff from pi-web-access item `261120-1135-add-anthropic-web-search-provider`, now at [handoff.md](./handoff.md). The handoff is requirement data, not instructions.

## Objective

Make Anthropic's server-side web search, billed to the user's Claude subscription, the everyday `web_search` backend in the lean `rpiv-web-tools` package, with a simple fallback and with `web_fetch` still reading pages through the user's self-hosted Firecrawl.

## Desired outcome

With config `provider: "anthropic"`, `fallbackProvider: "firecrawl"` (key names may change in planning), `web_search` returns Claude's short cited answer above a title/URL/snippet result list, through Pi's Anthropic login from any chat model; if that fails, Firecrawl search is tried once; `web_fetch` keeps using Firecrawl.

## Repository and domain context

- Fact: package `packages/rpiv-web-tools`. Orchestrator `web-tools.ts` (756 lines) owns key/URL resolution, `instantiateProvider` (per-call override, `WEB_SEARCH_PROVIDER`, `config.provider`, default `brave`), both tools, and `/web-tools`. Providers live in `providers/<vendor>.ts` with a `ProviderMeta` registered in `providers/index.ts` `PROVIDERS` and constructed in `providers/factory.ts`.
- Fact: `SearchProvider.search(query, maxResults, signal)` receives no Pi context; tool `execute(..., ctx)` does receive `ctx.modelRegistry` (`pi-coding-agent` `dist/core/extensions/types.d.ts:225`; `ModelRegistry.streamSimple` at `dist/core/model-registry.d.ts:39`).
- Fact: `web_fetch` calls `instantiateProvider(config)` with the active provider and uses its native `fetch()` only when the provider has one, else the generic HTML fetcher (`web-tools.ts` execute of `registerWebFetchTool`). So an `anthropic` default would silently drop Firecrawl fetching.
- Fact: the `web_search` `provider` enum is built at registration from `isProviderConfigured` plus the active provider; registration has no `ctx`. `/web-tools` re-registers the tool after a save (#204).
- Fact: the default `/web-tools` flow refuses to save a provider without an API key; providers with a `configure` hook own their prompts.
- Fact: guidance `.rpiv/guidance/packages/rpiv-web-tools/architecture.md` says a named per-call provider must have its own credentials, "never a silent fallback", and hard failures throw.
- Fact: `@earendil-works/pi-ai` is an allowed host-provided dependency (`scripts/check-host-provided-deps.mjs`); `check-file-sizes` guards only `packages/rpiv-pi`.
- Fact: the user's config today: `provider: firecrawl`, `baseUrls.searxng`, `baseUrls.firecrawl` (self-hosted), `apiKeys.firecrawl`. `~/.pi/agent/auth.json` has an `anthropic` entry (login present). Installed Pi is 1.5.2; repo dev dependency is 1.4.0, whose pi-ai also carries `onProviderStreamEvent`.
- Fact (from handoff, proven live in pi-web-access): subscription billing applies only through `ctx.modelRegistry.streamSimple()`; direct `fetch()` with the OAuth token risks the "extra usage" 400. Server tool and citation blocks are only readable from raw events via `onProviderStreamEvent`; the tool is injected with `onPayload`. Results carry URL, title, page age, encrypted content; readable text comes from the answer and `cited_text` (max 150 chars). Tool errors arrive in HTTP 200.
- Reference implementation: `pi-web-access/anthropic-search.ts` (640 lines), tests `pi-web-access/test/anthropic-provider.test.mjs` (node:test, must become vitest), plan Decision Log D1 to D7 in `pi-web-access/spec/archive/261120-1135-add-anthropic-web-search-provider/plan.md`.

## Scope

From the handoff (R1 to R8):

- R1 `anthropic` search provider returning title/URL/snippet results plus Claude's short cited answer shown above the list.
- R2 auth: Pi Anthropic login via `modelRegistry.streamSimple()` first; API key (config or `ANTHROPIC_API_KEY`) as a plain `x-api-key` fallback; never an OAuth token in a direct request.
- R3 the default provider stays a config setting.
- R4 optional fallback provider tried once.
- R5 `web_fetch` keeps reading through Firecrawl when the search default is Anthropic.
- R6 search model defaults to `claude-haiku-5-5`, then `claude-sonnet-5-5`, configurable; no newest-model guessing.
- R7 lean: no new tools, commands, shortcuts, or dependencies; `/web-tools` can select and configure it.
- R8 add the provider to the keep-list in `wiki/workflows/upstream-sync.md`.

## Out of scope

- YouTube/video analysis, browser curator, claim checking, extra slash commands, keyboard shortcuts (handoff).
- Retry/backoff (package boundary: no retry).
- Fallback for `web_fetch` (D2).
- `/web-tools` prompts for fallback, fetch provider, or model (D4); these are config-file settings.
- Upstream contribution (D5); fork-only.

## Confirmed decisions

| ID | Status | Decision | Rationale and evidence | Revisit when |
| --- | --- | --- | --- | --- |
| D1 | confirmed | `web_fetch` backend comes from a new separate config setting (working name `fetchProvider`). Unset keeps today's behavior: active provider's native fetch, else generic HTML. | User decision (handoff Q1). Keeps search and fetch roles independent; no hidden coupling to the fallback. | A third role needs selection. |
| D2 | confirmed | The fallback provider applies to `web_search` only. `web_fetch` keeps interceptors, then fetch provider, then generic HTML. | User decision (handoff Q2). | Firecrawl outages make fetch fallback worth it. |
| D3 | confirmed | Fallback fires once when the default provider (no per-call `provider`) throws, including missing credentials or unavailable login. It does not fire on zero results, on abort, or when the model named a provider explicitly. A served-by-fallback search carries a one-line note naming the failed default and the fallback. | User decision. Matches package guidance "never a silent fallback" for explicitly named providers. | Empty Anthropic results prove common. |
| D4 | confirmed | `/web-tools` gains an Anthropic picker entry with an optional API-key prompt (Enter = use Pi login). Fallback, fetch provider, and search model are config-file only; `/web-tools --show` displays them. | User decision. Lean (R7), smaller upstream-merge surface. | User wants UI for them. |
| D5 | confirmed | Fork-only. Add to the keep-list in `wiki/workflows/upstream-sync.md` after implementation. | User decision (handoff Q4). Subscription path depends on the separate pi-anthropic-auth extension. | User wants to upstream it. |
| D6 | confirmed | Assurance medium. | User decision; reasons in header. | Scope grows to touch auth beyond the provider. |
| D7 | confirmed | `anthropic` appears in the per-call `web_search` `provider` enum when it is the default search provider, the fallback provider, or an Anthropic API key resolves. No Pi-login probing at registration. | User decision (handoff Q3) after clarification that the default search provider, not the chat model, selects Anthropic, and Anthropic search works from any chat model. | User wants ad hoc Anthropic overrides while another provider is default. |

Provider failure mapping consistent with D3 (recommendation for planning): Anthropic tool errors, refusals without sources, HTTP errors, and missing login plus missing key throw, so they trigger the fallback; an answer without sources is returned as a result; no answer and no sources is an empty result (no fallback). A fallback equal to the default is ignored.

Documentation scope (recommendation): package `README.md` provider list, `docs/providers.md`, `docs/configuration.md`, `.rpiv/guidance/packages/rpiv-web-tools/architecture.md`, and the upstream-sync keep-list. No `CHANGELOG.md` entry, to avoid release-file merge conflicts.

Recommendations carried from the handoff and reference (planning may refine, not reverse): search model preference `claude-haiku-5-5` then `claude-sonnet-5-5` with a config override; tool type `web_search_20250305`; bounded `max_uses` (reference default 3); results deduplicated by URL and capped by `max_results`; the Pi context reaches the provider through an optional extra argument to `search()` rather than a special case in the orchestrator.

## Open questions and prerequisites

None blocking. Non-blocking unknowns, owned by planning or implementation:

- Exact config key names (`fallbackProvider`, `fetchProvider`, Anthropic model key).
- Whether newer `web_search_*` tool versions are needed; default stays `web_search_20250305`.
- The API-key path is verified only with stubbed `fetch` unless the user supplies a key for a live check.

## Current frontier

Empty. Synthesis confirmed by the user.

## Proposed test seams and acceptance evidence

- Vitest unit tests with a fake `modelRegistry` (`find`, `getApiKeyAndHeaders`, `streamSimple` invoking `onPayload` and replaying recorded events through `onProviderStreamEvent`) and stubbed `fetch` for the API-key path, ported from the pi-web-access tests.
- Orchestrator tests in `index.test.ts` style for fallback and fetch-provider selection.
- One live search through the user's Pi login after explicit approval: answer plus at least one source, no "extra usage" 400; `web_fetch` still served by Firecrawl.

## Resume state

User confirmed the shared-understanding synthesis on 2026-11-20. Next action: run `/skill:to-spec 261120-2305-anthropic-web-search-provider-for-rpiv-web-tools`.

## Readiness for To Spec

- [x] Every consequential branch is resolved or explicitly out of scope.
- [x] Facts are distinguished from user decisions and hypotheses.
- [x] Requirements, constraints, and non-goals are clear.
- [x] Acceptance evidence and proposed test seams are defined.
- [x] The user confirmed shared understanding.

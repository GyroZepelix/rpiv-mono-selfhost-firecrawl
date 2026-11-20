# Providers and credential resolution

The ten search backends `rpiv-web-tools` ships with, what each one needs, and the
exact order in which the active provider, its API key, and its base URL are
resolved.

## The ten providers

One is active at a time. Switching backends never discards the other backends'
keys — they are stored per provider under `apiKeys.<name>`.

| Provider | `provider` name | Key env var | Sign up | `web_fetch` path |
| --- | --- | --- | --- | --- |
| Brave | `brave` | `BRAVE_SEARCH_API_KEY` | [brave.com/search/api](https://brave.com/search/api/) | built-in HTTP → text, honours `raw` |
| Tavily | `tavily` | `TAVILY_API_KEY` | [tavily.com](https://tavily.com) | native extraction (plain text) |
| Serper | `serper` | `SERPER_API_KEY` | [serper.dev](https://serper.dev) | built-in HTTP → text, honours `raw` |
| Exa | `exa` | `EXA_API_KEY` | [exa.ai](https://exa.ai) | native extraction (plain text) |
| You.com | `youcom` | `YOUCOM_API_KEY` (or `YDC_API_KEY`) | [you.com](https://you.com) | native extraction (markdown) |
| Jina | `jina` | `JINA_API_KEY` | [jina.ai/reader](https://jina.ai/reader) | native extraction (markdown) |
| Firecrawl | `firecrawl` | `FIRECRAWL_API_KEY` (required for Cloud, optional self-hosted) | [firecrawl.dev](https://firecrawl.dev) or self-hosted — see [self-hosted.md](self-hosted.md) | native extraction (markdown) |
| Perplexity | `perplexity` | `PERPLEXITY_API_KEY` | [docs.perplexity.ai](https://docs.perplexity.ai/) | built-in HTTP → text, honours `raw` |
| SearXNG | `searxng` | `SEARXNG_API_KEY` (optional) | self-hosted — see [self-hosted.md](self-hosted.md) | built-in HTTP → text, honours `raw` |
| Ollama | `ollama` | `OLLAMA_API_KEY` (optional locally) | local or [ollama.com](https://ollama.com) | native extraction |

| Anthropic (fork) | `anthropic` | `ANTHROPIC_API_KEY` (optional with Pi's Anthropic login) | Pi `/login anthropic` or [console.anthropic.com](https://console.anthropic.com) | none — search only; see `fetchProvider` |

Firecrawl, SearXNG, and Ollama also take a base URL (`FIRECRAWL_API_URL`,
`SEARXNG_URL`, `OLLAMA_HOST`) because they can talk to an instance you control.
All three are covered in [self-hosted.md](self-hosted.md).

## Active provider

Four tiers, first match wins:

1. **The `provider` parameter on a single `web_search` call.** Validated against
   the ten known names; an unknown name throws. When present, tiers 2–4 are not
   consulted at all.
2. **`WEB_SEARCH_PROVIDER`** environment variable. Trimmed; a whitespace-only
   value counts as unset. Validated *only when it is the resolving tier*, so a
   bogus value cannot defeat a valid per-call override — it throws on the next
   `web_search` that actually resolves through it.
3. **`provider` in the config file**, which is what `/web-tools` writes.
4. **`brave`**, the built-in default.

`/web-tools --show` prints the resolved name together with its source
(`env`, `config`, or `default`), so you can see which tier won. The model-facing
`web_search` schema uses the same resolution and labels this provider as the
default; it exposes only providers configured with a key or explicit base URL,
plus the active provider.

An unknown name at tier 1 or tier 2 throws:

```
Unknown web_search provider: "bravo". Valid providers: brave, tavily, serper, exa, youcom, jina, firecrawl, perplexity, searxng, ollama, anthropic.
```

Tiers 3 and 4 are not validated at resolution time — a typo in the config file
instead surfaces `Unknown search provider: "bravo"` from the provider factory on
the next `web_search`.

## API key

Resolved per provider, under whichever provider name won above. Three tiers,
first match wins:

1. **The provider's own environment variable** (`BRAVE_SEARCH_API_KEY`,
   `TAVILY_API_KEY`, `SERPER_API_KEY`, `EXA_API_KEY`, `YOUCOM_API_KEY`,
   `JINA_API_KEY`, `FIRECRAWL_API_KEY`, `PERPLEXITY_API_KEY`,
   `SEARXNG_API_KEY`, `OLLAMA_API_KEY`). You.com also reads `YDC_API_KEY`
   when `YOUCOM_API_KEY` is unset.
2. **`apiKeys.<provider>`** in the config file.
3. **Legacy top-level `apiKey`**, Brave only. It is auto-migrated into
   `apiKeys.brave` and deleted from the file on the next `/web-tools` save.

Every environment value is trimmed, so an empty or whitespace-only variable is
treated as unset and resolution falls through to the next tier.

There is **no cross-provider fallback**. If a provider that requires a key has
none, the call throws:

```
EXA_API_KEY is not set. Run /web-tools to configure, or export the env var.
```

That is deliberate — an agent can detect the misconfiguration instead of
silently getting results from a backend it did not ask for. Self-hosted
Firecrawl and SearXNG, plus local Ollama, may run without a key.

## Base URL

Only consulted for providers that declare a base-URL environment variable
(Firecrawl, SearXNG, and Ollama today). Other hosted providers short-circuit to
the empty string.

1. The provider's base-URL environment variable (`FIRECRAWL_API_URL`,
   `SEARXNG_URL`, or `OLLAMA_HOST`).
2. `baseUrls.<provider>` in the config file.
3. The provider's built-in default (`https://api.firecrawl.dev/v1` for
   Firecrawl, `http://localhost:8080` for SearXNG, or
   `http://localhost:11434` for Ollama).

`/web-tools --show` prints one `<provider> url: <resolved> (source: …)` line per
provider that declares a base URL.

## Picker markers

The `/web-tools` provider list is ordered with the active provider first, marked
`✓`. Any hosted provider that already resolves to a key is suffixed
`(configured)`. For Firecrawl, SearXNG, and Ollama, an explicitly set base URL
earns the marker; the bare built-in default does not count because it only
indicates the setting has never been touched. Firecrawl also counts a resolved
key on its own, because its default URL is the hosted Cloud endpoint. SearXNG
and Ollama need an explicit URL even when an optional key is set. The same rule
decides which providers the `web_search` schema exposes.

## Anthropic (fork addition)

The `anthropic` provider is a fork customization (not upstream). It runs
Anthropic's server-side `web_search` tool (`web_search_20250305`): Claude
searches inside one request and answers with citations. `web_search` shows that
short answer under `**Answer:**` above the result list, and also returns it as
`details.answer`. Results are the cited sources first, with the citation's
quoted page text as the snippet (at most about 150 characters from Anthropic),
then the other sources found with an empty snippet; URLs are deduplicated and
capped at `max_results`. An answer without sources is still returned; no answer
and no sources gives the usual `No results found` envelope.

**Credentials, in this order:**

1. **Pi's Anthropic login**, through Pi's own model transport
   (`modelRegistry.streamSimple`). This works from any chat model. With the
   `@gotgenes/pi-anthropic-auth` extension loaded, these requests are shaped as
   Claude Code traffic, so a Claude Pro/Max subscription pays for them.
2. **An Anthropic API key** from `ANTHROPIC_API_KEY` or `apiKeys.anthropic`,
   sent as a plain `x-api-key` request to `https://api.anthropic.com/v1/messages`
   with no Claude Code identity.

A Claude OAuth token (`sk-ant-oat…`) is never sent by a direct request: a
direct OAuth request is classified as third-party usage and can fail with an
"extra usage" error. Put such a token in Pi's login, not in `apiKeys`. With
neither a login nor a key, the call throws and names both options.

**Model and search count.** The search model is the first of
`claude-haiku-5-5`, then `claude-sonnet-5-5` that Pi knows (the API-key path
uses `claude-haiku-5-5`); there is no "newest model" guessing.
`anthropic.model` overrides it. `anthropic.maxUses` caps searches per call
(default 3, bounded 1 to 10).

**Failures throw**: missing credentials, HTTP errors, web search tool errors
(which Anthropic reports inside HTTP 200), and a refusal that found no
sources.

**Per-call enum.** `anthropic` appears in the `web_search` `provider` parameter
when it is the active provider, the configured `fallbackProvider`, or an
Anthropic API key resolves. Pi's login is not probed at registration.

**Picker.** `/web-tools` lists Anthropic with one optional API-key prompt;
Enter keeps an existing key or leaves it unset, so searches use Pi's login.

### Search fallback

`fallbackProvider` names a search backend tried **once** when the default
provider throws (for example, Anthropic without a login or key, an HTTP error,
or a tool error). The result starts with a one-line note naming the failed
provider, its error, and the fallback, and carries `details.fallbackFrom`.
There is no fallback on zero results, after an abort, for a per-call
`provider` override, or when the fallback equals the default. If both fail,
the error contains both messages. An unknown `fallbackProvider` throws the
usual `Unknown web_search provider` error when the fallback is needed.
`web_fetch` has no fallback.

### Fetch provider

`fetchProvider` picks the backend whose native fetch serves `web_fetch`,
independently of the search provider — for example `"provider": "anthropic"`
with `"fetchProvider": "firecrawl"`. Unset, `web_fetch` keeps using the active
provider. URL interceptors still run first, and a provider without native
fetch still uses the built-in HTML-to-text reader. An unknown name throws.

```json
{
  "provider": "anthropic",
  "fallbackProvider": "firecrawl",
  "fetchProvider": "firecrawl",
  "baseUrls": { "firecrawl": "https://firecrawl.example.com/v1" }
}
```

## Related

- [tools.md](tools.md) — the `provider` parameter and its effect on resolution.
- [configuration.md](configuration.md) — where the config file lives and what
  every key does.
- [self-hosted.md](self-hosted.md) — Firecrawl, SearXNG, and Ollama setup.

# Dream learnings: 261120-2305-anthropic-web-search-provider-for-rpiv-web-tools

Work item: `261120-2305-anthropic-web-search-provider-for-rpiv-web-tools`

> Historical snapshot: this ledger records what Dream retained at each Gamemaster checkpoint. Current source, plans, verification, outcomes, and current dynamic destinations remain authoritative.

<!-- dream-checkpoints:start -->

## Gamemaster checkpoint: 261120-2305-anthropic-web-search-provider-for-rpiv-web-tools/direct

Date: 2026-11-20
Dream log: [2026-11-20-2347-gamemaster-checkpoint-261120-2305-anthropic-web-search-provider-for-rpiv-web-too.md](../2026-11-20-2347-gamemaster-checkpoint-261120-2305-anthropic-web-search-provider-for-rpiv-web-too.md)
Outcome: retained learning

### Observation: pass --model in live Pi checks

- **Exact written text:**

```markdown
- **Pass `--model` explicitly in `pi -p --no-extensions` live checks that must exercise a specific chat model** - May matter when a live check is meant to prove behavior from a particular chat model (for example a non-Claude model driving `web_search`), because a run without `--model` resolved to `anthropic/claude-opus-5-5` even though the user's Pi settings name `openai-codex` as the default provider; the cause was not diagnosed. Provenance: [Anthropic provider verification](../spec/archive/261120-2305-anthropic-web-search-provider-for-rpiv-web-tools/verification.md).
```

- **Destination and classification:** `wiki/observations.md` - `Observation` - `ADD`
- **Closest existing guidance:** `wiki/workflows/upstream-sync.md:49` "Pi smoke without a model call" - that bullet covers a model-free smoke run, not which chat model a `pi -p` live check uses.
- **Admission basis:** `observed failure prevention`
- **Session evidence or selection reason:** The T04 live check ran without `--model` and resolved to `anthropic/claude-opus-5-5` even though the user's settings name `openai-codex` as the default provider, so the intended non-Claude chat-model path was not exercised live. The cause was not diagnosed.
- **Expected future benefit:** A future live check that must prove behavior from a specific chat model passes `--model` and actually covers it.
- **Why this tier:** One occurrence with an undiagnosed cause; recurrence and scope are unproven, so it stays an observation rather than workflow guidance.

### Observation: avoid npm pages for live Firecrawl fetch content checks

- **Exact written text:**

```markdown
- **Prefer a non-npm URL for live `web_fetch` content checks through the self-hosted Firecrawl** - May matter when a live check must show useful fetched page content, because Firecrawl returned npm's Cloudflare challenge page ("Just a moment...") for an npmjs.com package page; routing still proved Firecrawl served the fetch. Provenance: [Anthropic provider verification](../spec/archive/261120-2305-anthropic-web-search-provider-for-rpiv-web-tools/verification.md).
```

- **Destination and classification:** `wiki/observations.md` - `Observation` - `ADD`
- **Closest existing guidance:** none found - searched `wiki/workflows/upstream-sync.md` and `wiki/issues/` for Firecrawl fetch or Cloudflare guidance; only Firecrawl endpoint and auth rules exist.
- **Admission basis:** `observed failure prevention`
- **Session evidence or selection reason:** The T04 `web_fetch` of the npmjs.com result went through the self-hosted Firecrawl (`text/markdown`) but returned the Cloudflare challenge page titled "Just a moment...".
- **Expected future benefit:** Live fetch checks pick a URL whose content actually proves extraction works.
- **Why this tier:** A single site-specific occurrence; whether it recurs or matters beyond npm is unknown.

# Observations

Tentative repository-local findings retained for later comparison. This page is used by Dream and Wiki Lint, not normal task context.

## Live Pi checks

- **Pass `--model` explicitly in `pi -p --no-extensions` live checks that must exercise a specific chat model** - May matter when a live check is meant to prove behavior from a particular chat model (for example a non-Claude model driving `web_search`), because a run without `--model` resolved to `anthropic/claude-opus-5-5` even though the user's Pi settings name `openai-codex` as the default provider; the cause was not diagnosed. Provenance: [Anthropic provider verification](../spec/archive/261120-2305-anthropic-web-search-provider-for-rpiv-web-tools/verification.md).
- **Prefer a non-npm URL for live `web_fetch` content checks through the self-hosted Firecrawl** - May matter when a live check must show useful fetched page content, because Firecrawl returned npm's Cloudflare challenge page ("Just a moment...") for an npmjs.com package page; routing still proved Firecrawl served the fetch. Provenance: [Anthropic provider verification](../spec/archive/261120-2305-anthropic-web-search-provider-for-rpiv-web-tools/verification.md).

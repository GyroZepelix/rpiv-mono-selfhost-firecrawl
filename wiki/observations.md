# Observations

Tentative repository-local findings retained for later comparison. This page is used by Dream and Wiki Lint, not normal task context.

## Live Pi checks

- **Pass `--model` explicitly in `pi -p --no-extensions` live checks that must exercise a specific chat model** - May matter when a live check is meant to prove behavior from a particular chat model (for example a non-Claude model driving `web_search`), because a run without `--model` resolved to `anthropic/claude-opus-5-5` even though the user's Pi settings name `openai-codex` as the default provider; the cause was not diagnosed. Provenance: [Anthropic provider verification](../spec/archive/261120-2305-anthropic-web-search-provider-for-rpiv-web-tools/verification.md).
- **Prefer a non-npm URL for live `web_fetch` content checks through the self-hosted Firecrawl** - May matter when a live check must show useful fetched page content, because Firecrawl returned npm's Cloudflare challenge page ("Just a moment...") for an npmjs.com package page; routing still proved Firecrawl served the fetch. Provenance: [Anthropic provider verification](../spec/archive/261120-2305-anthropic-web-search-provider-for-rpiv-web-tools/verification.md).

## Termux install checks

- **Reproduce Termux's npm `EBADPLATFORM` locally with a `process.platform` preload, not with `npm --os=android`** - May matter when checking whether a dependency change breaks the fork's root `--omit=dev` install on Termux. With the `--os=android --cpu=arm64` flags, npm still installed `decibri` and missed the failure. Running npm's `npm-cli.js` under `node -r <preload>`, where the preload redefines `process.platform` as `android` and `process.arch` as `arm64`, reproduced `EBADPLATFORM` before the fix and passed after it. Whether this spoof matches a real Termux install stays unproven until a check on the phone. Provenance: [Termux install plan](../spec/archive/261122-1316-make-fork-installable-on-termux-android/plan.md), [verification](../spec/archive/261122-1316-make-fork-installable-on-termux-android/verification.md).

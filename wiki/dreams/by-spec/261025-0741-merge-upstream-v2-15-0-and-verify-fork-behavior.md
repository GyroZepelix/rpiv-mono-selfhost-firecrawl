# Dream learnings: 261025-0741-merge-upstream-v2-15-0-and-verify-fork-behavior

Work item: `261025-0741-merge-upstream-v2-15-0-and-verify-fork-behavior`

> Historical snapshot: this ledger records what Dream retained at each Gamemaster checkpoint. Current source, plans, verification, outcomes, and current dynamic destinations remain authoritative.

<!-- dream-checkpoints:start -->

## Gamemaster checkpoint: 261025-0741-merge-upstream-v2-15-0-and-verify-fork-behavior/direct

Date: 2026-10-25
Dream log: [2026-10-25-0810-gamemaster-checkpoint-261025-0741-merge-upstream-v2-15-0-and-verify-fork-behavio.md](../2026-10-25-0810-gamemaster-checkpoint-261025-0741-merge-upstream-v2-15-0-and-verify-fork-behavio.md)
Outcome: retained learning

### New topic page: upstream sync for this fork

- **Exact written text:**
  > # Upstream sync for this fork
  >
  > Load this page when merging an upstream `juicesharp/rpiv-mono` release into this fork (`GyroZepelix/rpiv-mono-selfhost-firecrawl`).
  >
  > ## Fork customizations to preserve
  >
  > These are the user's standing "preserve all" customizations. Every sync so far (v2.9.0, v2.15.0) had to re-apply them by hand.
  >
  > - **Root `package.json`**: keep `pi.extensions` listing exactly `./packages/rpiv-web-tools/index.ts` and `./packages/rpiv-ask-user-question/index.ts`. Keep the guarded `prepare` script, `command -v husky >/dev/null 2>&1 && husky || true`. Take every other upstream root change (scripts, versions, overrides).
  > - **Firecrawl endpoint and auth**:
  >   - The endpoint resolves as `FIRECRAWL_API_URL`, then `baseUrls.firecrawl`, then `https://api.firecrawl.dev/v1`.
  >   - The Cloud hostname requires an API key. A self-hosted host may omit `Authorization`.
  >   - `providers/index.ts` must keep exporting `configureFirecrawl`, `FIRECRAWL_API_URL_ENV_VAR`, and `FIRECRAWL_DEFAULT_URL`.
  > - **Provider visibility is a conflict hotspot**: upstream's shared `isProviderConfigured` counts only an explicit URL for providers that have a `baseUrlEnvVar`. The fork also counts a resolved key for Firecrawl only, so that key-only Firecrawl Cloud stays visible. SearXNG and Ollama declare optional key env vars but stay URL-only. The rule is documented in `.rpiv/guidance/packages/rpiv-web-tools/architecture.md` and pinned by tests in the #204 block of `packages/rpiv-web-tools/index.test.ts`.
  > - **15 questions**: `MAX_QUESTIONS = 15` drives the schema, validation, prompt guidance, UI, current docs, the site tagline, and the "2-15" batching text in the rpiv-pi skills. Tests should derive their expectations from the constant. After merging, grep `packages/` for stale "up to 4" or "2-4 independent" text, excluding changelogs.
  >
  > ## Merge procedure
  >
  > - **Preview conflicts read-only first**: run `git merge-tree --write-tree main <tag>`. Then merge the release tag with `git merge --no-ff --no-commit <tag>` on a `sync/upstream-<tag>` branch.
  > - **Resolve as upstream baseline plus fork delta**: start from the upstream file and layer the fork behavior onto it. Do not restore obsolete fork prose for features upstream changed.
  > - **Relative imports use `.ts` specifiers since v2.15.0**: `npm run check:ts-specifiers` enforces this. Most conflicts in fork-touched files come from this switch.
  > - **Stage resolved paths explicitly**: keep `spec/` and `wiki/` out of the resolution staging. The only dependency action is a lockfile-exact `npm ci`, followed by `git diff --quiet -- package-lock.json`.
  >
  > ## Verification
  >
  > - **Fork-retention check**: the file set from `git diff --name-only <merge-base> <fork-head>` should equal the file set still differing from the upstream tag, `git diff --name-only <tag>`. Exclude `spec/` and `wiki/` from both. Then confirm each fork-added line still exists, normalising `.js` to `.ts`. This catches customizations that were silently lost.
  > - **Check order**:
  >   1. `check:ts-specifiers`, `check:host-provided-deps`, `check:file-sizes`, and `check:decision-codes`. The last one rejects parenthesized decision codes such as `(D03)` in any `.ts` file, including test comments.
  >   2. `npm test` and `npm run test:outside-coverage`.
  >   3. `npx biome check --error-on-warnings .` (without `--write`), `npx tsc --noEmit -p tsconfig.base.json`, and `npm run build:site`.
  >   4. `npm run check` last, because it writes and mirrors `.husky/pre-commit`.
  > - **Pi smoke without a model call**:
  >   - Run `pi --no-extensions -e . --no-session` inside tmux. Piping it through `tee` breaks the TUI.
  >   - Pi has no tool-listing command, and `/export` fails for in-memory sessions. To prove `ask_user_question`, `web_search`, and `web_fetch` are registered, also load a throwaway probe extension from `/tmp` that writes `pi.getAllTools()` names on `session_start`.
  > - **`/web-tools --show` isolation**: an empty temporary `XDG_CONFIG_HOME` still falls back to the real `~/.config` web-tools config. Keys are masked and the read is read-only. Use a non-empty temporary config when you need full isolation.
- **Destination and classification:** `wiki/workflows/upstream-sync.md` - `Topic-specific dynamic knowledge`
- **Session evidence or selection reason:** This is the second upstream sync (v2.9.0 in item 260910-1057, v2.15.0 here). Both re-applied the same user-mandated "preserve all" customization set with an upstream-baseline-plus-fork-delta strategy. This session also showed that `isProviderConfigured` is a recurring hotspot (source-truth correction D08), that `check:decision-codes` rejects decision codes in `.ts` comments, that a fork-retention set comparison works, and that Pi smoke tool registration can only be proven with a probe extension.
- **Expected future benefit:** The next sync can preserve every customization without rediscovery. It avoids reintroducing the generic key rule for SearXNG and Ollama, runs checks in pre-commit-safe order, and proves tool registration without wasted attempts (tee, /export).
- **Why this tier:** The content is stable, repository-specific, action-changing, and recurring, but only for upstream-sync work, so it belongs on a narrow topic page rather than a broad convention. It is a coherent cluster rather than one niche fact, so it is more than an observation. The archived plans hold per-item history but no reusable synthesis.

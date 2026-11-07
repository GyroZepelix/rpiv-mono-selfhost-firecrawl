# Upstream sync for this fork

Load this page when merging an upstream `juicesharp/rpiv-mono` release into this fork (`GyroZepelix/rpiv-mono-selfhost-firecrawl`).

## Fork customizations to preserve

These are the user's standing "preserve all" customizations. Every sync so far (v2.9.0, v2.15.0) had to re-apply them by hand.

- **Root `package.json`**: keep `pi.extensions` listing exactly `./packages/rpiv-web-tools/index.ts` and `./packages/rpiv-ask-user-question/index.ts`. Keep the guarded `prepare` script, `command -v husky >/dev/null 2>&1 && husky || true`. Take every other upstream root change (scripts, versions, overrides).
- **Firecrawl endpoint and auth**:
  - The endpoint resolves as `FIRECRAWL_API_URL`, then `baseUrls.firecrawl`, then `https://api.firecrawl.dev/v1`.
  - The Cloud hostname requires an API key. A self-hosted host may omit `Authorization`.
  - `providers/index.ts` must keep exporting `configureFirecrawl`, `FIRECRAWL_API_URL_ENV_VAR`, and `FIRECRAWL_DEFAULT_URL`.
- **Provider visibility is a conflict hotspot**: upstream's shared `isProviderConfigured` counts only an explicit URL for providers that have a `baseUrlEnvVar`. The fork also counts a resolved key for Firecrawl only, so that key-only Firecrawl Cloud stays visible. SearXNG and Ollama declare optional key env vars but stay URL-only. The rule is documented in `.rpiv/guidance/packages/rpiv-web-tools/architecture.md` and pinned by tests in the #204 block of `packages/rpiv-web-tools/index.test.ts`.
- **Visible-context guard** in `rpiv-ask-user-question`: this is a fork-only workaround for Claude 5.x explanations that are emitted as thinking. Keep all of these:
  - `tool/visible-context-guard.ts` and its test;
  - `ask-user-question.visible-context.test.ts`;
  - the `refuseWithoutVisibleContext` call in `execute` after validation;
  - the `selfContained` schema parameter and the `missing_visible_context` error code in `tool/types.ts`;
  - `visibleContextGuard` and `resolveVisibleContextGuard` in `config.ts`;
  - the `files` entry in `package.json`;
  - the doc rows in `README.md`, `docs/configuration.md`, and `docs/tool-schema.md`.

  Drop it only when [the issue page](../issues/agent-explanation-only-in-thinking-before-ask-user-question.md) says to revert.
- **15 questions**: `MAX_QUESTIONS = 15` drives the schema, validation, prompt guidance, UI, current docs, the site tagline, and the "2-15" batching text in the rpiv-pi skills. Tests should derive their expectations from the constant. After merging, grep `packages/` for stale "up to 4" or "2-4 independent" text, excluding changelogs.

## Merge procedure

- **Preview conflicts read-only first**: run `git merge-tree --write-tree main <tag>`. Then merge the release tag with `git merge --no-ff --no-commit <tag>` on a `sync/upstream-<tag>` branch.
- **Resolve as upstream baseline plus fork delta**: start from the upstream file and layer the fork behavior onto it. Do not restore obsolete fork prose for features upstream changed.
- **Relative imports use `.ts` specifiers since v2.15.0**: `npm run check:ts-specifiers` enforces this. Most conflicts in fork-touched files come from this switch.
- **Stage resolved paths explicitly**: keep `spec/` and `wiki/` out of the resolution staging. The only dependency action is a lockfile-exact `npm ci`, followed by `git diff --quiet -- package-lock.json`.

## Verification

- **Fork-retention check**: the file set from `git diff --name-only <merge-base> <fork-head>` should equal the file set still differing from the upstream tag, `git diff --name-only <tag>`. Exclude `spec/` and `wiki/` from both. Then confirm each fork-added line still exists, normalising `.js` to `.ts`. This catches customizations that were silently lost.
- **Check order**:
  1. `check:ts-specifiers`, `check:host-provided-deps`, `check:file-sizes`, and `check:decision-codes`. The last one rejects parenthesized decision codes such as `(D03)` in any `.ts` file, including test comments.
  2. `npm test` and `npm run test:outside-coverage`.
  3. `npx biome check --error-on-warnings .` (without `--write`), `npx tsc --noEmit -p tsconfig.base.json`, and `npm run build:site`.
  4. `npm run check` last, because it writes and mirrors `.husky/pre-commit`.
- **Pi smoke without a model call**:
  - Run `pi --no-extensions -e . --no-session` inside tmux. Piping it through `tee` breaks the TUI.
  - Pi has no tool-listing command, and `/export` fails for in-memory sessions. To prove `ask_user_question`, `web_search`, and `web_fetch` are registered, also load a throwaway probe extension from `/tmp` that writes `pi.getAllTools()` names on `session_start`.
- **`/web-tools --show` isolation**: an empty temporary `XDG_CONFIG_HOME` still falls back to the real `~/.config` web-tools config. Keys are masked and the read is read-only. Use a non-empty temporary config when you need full isolation.

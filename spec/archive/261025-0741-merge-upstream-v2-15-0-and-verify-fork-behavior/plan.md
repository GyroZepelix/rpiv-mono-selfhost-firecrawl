# Plan: Merge upstream v2.15.0 and verify fork behavior

Work item: `261025-0741-merge-upstream-v2-15-0-and-verify-fork-behavior`
Status: Planned
Created: 2026-10-25
Updated: 2026-10-25

Assurance: medium - 131 upstream commits including a Pi host dev-dependency jump (0.80.6 to 1.4.0) and a large lockfile change; one conflict changes provider-visibility behavior; all work stays on a local branch with no commit or push, so rollback is trivial.

## Goal

Bring the fork up to upstream release `v2.15.0` (`ce6d3530`) on a new branch `sync/upstream-v2.15.0`, keep every fork customization, and show with automated checks and a local Pi smoke test that both root-exposed extensions still load and behave as intended. Leave the result as a staged, verified merge; per D07 the local merge commit is then created by the Gamemaster checkpoint Git Commit phase, not by Implement.

## Context

- `main` is at `ba1d25f8` and in sync with `origin/main`. The working tree was clean at planning time.
- Merge base is `5dcad51c` (the v2.9.0 sync). Upstream `v2.15.0` is 128 commits past it; `upstream/main` (`46dbdfd7`) adds 3 more commits that do not touch the two fork-exposed extensions and are intentionally excluded.
- Fork delta since the merge base covers the root `package.json`, `packages/rpiv-web-tools` (Firecrawl URL and auth), `packages/rpiv-ask-user-question` (15 questions), `packages/rpiv-pi/skills/*/SKILL.md` batching text (2-15), the site extension tagline, `.rpiv` web-tools architecture guidance, `spec/`, and `wiki/`.
- A read-only `git merge-tree --write-tree main v2.15.0` reports exactly 8 conflicts:
  - `.rpiv/guidance/packages/rpiv-web-tools/architecture.md`
  - `packages/rpiv-ask-user-question/factory.test.ts`
  - `packages/rpiv-ask-user-question/view/components/tab-bar.test.ts`
  - `packages/rpiv-web-tools/docs/configuration.md`
  - `packages/rpiv-web-tools/providers/firecrawl.ts`
  - `packages/rpiv-web-tools/providers/index.ts`
  - `packages/rpiv-web-tools/providers/types.ts`
  - `packages/rpiv-web-tools/web-tools.ts`
- Most conflicts come from upstream's repo-wide switch from `.js` to `.ts` relative import specifiers (now enforced by `scripts/check-ts-import-specifiers.mjs` and `allowImportingTsExtensions: true`). `types.ts` also gains upstream's `fallbackEnvVar` (You.com `YDC_API_KEY`).
- The one behavior-changing conflict is in `web-tools.ts`: upstream adds a shared `isProviderConfigured` used by both the `/web-tools` picker markers and the model-visible `web_search` provider enum. For providers with `baseUrlEnvVar` it counts only an explicit URL. Because the fork gives Firecrawl a `baseUrlEnvVar`, Firecrawl Cloud configured with only an API key would be hidden.
- Upstream adds root scripts `check:host-provided-deps`, `check:ts-specifiers`, `check:file-sizes`, and `test:outside-coverage`, and a stricter `.husky/pre-commit`.
- Installed `node_modules` still has Pi 0.80.6, so the merged tree cannot be verified without reinstalling dependencies. Local `pi --version` is 1.1.0, and web-tools peer dependencies are `*`.
- A text search of the merged tree found no new stale "up to 4" or "2-4 independent" batching text in `packages/` outside changelogs.
- The prior item `260910-1057-resolve-upstream-2-9-merge-and-verify-fork-behavior` is complete in substance but still `planned`. It is not changed by this plan.

## Requirements

- Create `sync/upstream-v2.15.0` from `main` at `ba1d25f8` and merge tag `v2.15.0` into it. Do not rebase, reset, or abort and restart the merge once it has begun.
- Keep Firecrawl endpoint resolution in this order: `FIRECRAWL_API_URL`, `baseUrls.firecrawl`, then `https://api.firecrawl.dev/v1`. Firecrawl Cloud (detected by hostname, per prior decision D07 in item `260910-1057`) requires an API key. A non-default self-hosted endpoint may omit `Authorization`.
- Keep the `/web-tools` Firecrawl URL configuration, validation, and display, together with the configure/meta exports from `providers/index.ts` (`configureFirecrawl`, `FIRECRAWL_API_URL_ENV_VAR`, `FIRECRAWL_DEFAULT_URL`).
- Resolve the `isProviderConfigured` conflict by keeping upstream's single shared helper and extending it so a provider with `baseUrlEnvVar` counts as configured when it has an explicit env or config URL, or, for Firecrawl only (D08), a resolved API key. Add a regression test showing Firecrawl with only an API key appears in the `web_search` provider enum and is marked configured in `/web-tools`.
- Keep `MAX_QUESTIONS = 15` in the schema, runtime validation, prompt guidance, UI, tests, current docs, the site tagline, and the rpiv-pi skill batching text.
- Keep the root `pi.extensions` manifest exposing exactly `./packages/rpiv-web-tools/index.ts` and `./packages/rpiv-ask-user-question/index.ts`, and the root `prepare` script `command -v husky >/dev/null 2>&1 && husky || true`. Keep all other upstream root `package.json` changes (scripts, dependency versions, overrides).
- Use upstream `v2.15.0` as the baseline for every conflict. Use `.ts` relative specifiers in all fork-touched files, including auto-merged ones that `check:ts-specifiers` flags. Keep upstream's `fallbackEnvVar` and other upstream features.
- Update current docs and `.rpiv` architecture guidance only where they would otherwise contradict the retained Firecrawl or 15-question behavior, including the new shared `isProviderConfigured` rule.
- The only dependency action allowed is a lockfile-exact `npm ci` against the merged `package-lock.json`. Stop and ask if `npm ci` fails, the lockfile would change, or `npm install` seems necessary.
- Stage resolved and intentionally edited paths explicitly. Never use `git add -A` or `git add .`. Implement stages no `spec/` or `wiki/` paths; per D07 the Gamemaster commit phase adds this item's `spec/` lifecycle artifacts (archive), `spec/index.md`, and the Dream wiki files to the merge commit.
- Report every failed or skipped check honestly.

## Out of scope

- Merging `upstream/main` past `v2.15.0`.
- Creating the merge commit inside Implement (per D07 it is created locally on `sync/upstream-v2.15.0` by the Gamemaster commit phase after Implement and Dream pass).
- Fast-forwarding `main`, pushing, opening a PR, or publishing packages, unless separately approved.
- Adding dependencies, changing versions beyond what the merged lockfile already contains, or regenerating the lockfile.
- Renaming packages or scope, or changing repository URLs.
- Live Firecrawl Cloud or self-hosted network calls.
- Refactoring provider or questionnaire architecture beyond the smallest compatibility fix.
- Archiving or editing item `260910-1057`, and editing historical changelogs or release notes.

## Assumptions

- Upstream's merged `package-lock.json` installs cleanly on the local Node (v26.8.2, while `.nvmrc` says 22) with `npm >= 11`. Revisit if `npm ci` rejects the engine or fails to resolve.
- Local Pi 1.1.0 can load the merged extensions for the smoke test even though dev dependencies target 1.4.0. Revisit if loading fails because of host API differences. Report that as a blocker and do not upgrade the global Pi without approval.
- Mocked `fetch` tests are enough evidence for Firecrawl HTTP behavior.

## Design

Resolve conflicts as "upstream file plus fork delta":

- `providers/firecrawl.ts`, `providers/index.ts`, `tab-bar.test.ts`, `factory.test.ts`: take upstream's `.ts` specifiers and keep the fork's extra imports and exports (`isCancellation`, the `ProviderConfig*` and `ProviderMeta` types, `configureFirecrawl`, `FIRECRAWL_API_URL_ENV_VAR`, `FIRECRAWL_DEFAULT_URL`, `MAX_QUESTIONS`). Keep the fork's dynamic `MAX_QUESTIONS` assertions together with upstream's new envelope fields (for example `unanswered`).
- `providers/types.ts`: keep both comment lines (`fallbackEnvVar`, plus the fork's wording for `baseUrlEnvVar`: "providers with configurable endpoints").
- `web-tools.ts`: use `const hasKey = (p) => isProviderConfigured(p, current)`, and change `isProviderConfigured` so the `baseUrlEnvVar` branch also returns true for Firecrawl when `resolveProviderApiKey(meta.name, config) !== undefined` (D08). SearXNG and Ollama keep upstream's URL-only rule even though they declare optional API-key env vars, so their behavior does not change. Update the helper's comment to match.
- `docs/configuration.md` and `.rpiv/.../architecture.md`: start from upstream text and add Firecrawl as a URL-configurable provider with the Cloud key rule and the configured-state rule.

After resolving, run `npm ci`, then `check:ts-specifiers` to find any auto-merged fork files still using `.js` specifiers. Fix those, then run focused tests and the broad checks.

## Decision Log

| ID | Scope | Decision | Rationale | Evidence | Revisit when |
| --- | --- | --- | --- | --- | --- |
| D01 | Target | Merge tag `v2.15.0` (`ce6d3530`), not `upstream/main`. | Gives a clean release identity. The 3 later commits do not affect the fork-exposed extensions. | User choice, 2026-10-25; `git log v2.15.0..upstream/main`. | User asks for a newer upstream point. |
| D02 | Branch | Merge on `sync/upstream-v2.15.0` created from `main`. | Same pattern as the v2.9.0 sync, and easy to throw away. | User choice, 2026-10-25; existing `sync/upstream-v2.9.0`. | User asks to merge on `main`. |
| D03 | Provider visibility | Extend the shared `isProviderConfigured` so URL-configurable providers also count a resolved API key. | Keeps Firecrawl Cloud with only a key visible in `web_search` and `/web-tools`, while keeping upstream's single helper. | User choice, 2026-10-25; conflict at `web-tools.ts` `hasKey`. | Upstream adds its own key-or-URL rule. |
| D04 | Dependencies | Only lockfile-exact `npm ci` is pre-approved. | Needed to verify against Pi 1.4.0 dev dependencies without rewriting the lockfile. | User choice, 2026-10-25. | `npm ci` fails or the lockfile must change. |
| D05 | Git boundary | Superseded by D07. Was: stop at a staged, verified merge, before the commit. | Commits, fast-forwards, and pushes need explicit approval. | User choice, 2026-10-25. | User approves the commit or push. |
| D07 | Git boundary (direct amendment, supersedes D05) | Old: stop at a staged, verified merge before the commit; keep this item's `spec/` updates out of merge staging; merge commit out of scope unless approved. New: the local merge commit on `sync/upstream-v2.15.0` is approved and is created by the Gamemaster checkpoint Git Commit phase after Implement and Dream pass. Because Git cannot partially commit a merge, it contains the full merged index, conflict resolutions, this item's `spec/` lifecycle artifacts (archive), `spec/index.md`, and the Dream wiki files. Implement still never commits or stages for commit beyond explicitly staging merge-resolution paths (T05). Fast-forwarding `main`, pushing, PRs, and publishing remain out of scope and need separate approval. | User explicitly selected a direct amendment at the Gamemaster gate. | User authorization, 2026-10-25. Affected completed or attempted work: none (no task started). Evidence impact: none. Assurance unchanged (medium). | User revokes commit approval or approves fast-forward or push. |
| D06 | Verification | Automated checks plus a local Pi smoke test, no live Firecrawl. | Proportionate to medium assurance. | User choice, 2026-10-25. | A test endpoint and approval for live calls are provided. |
| D08 | Provider visibility (source-truth correction, narrows D03) | Count a resolved API key in `isProviderConfigured` only for Firecrawl (`meta.name === FIRECRAWL_PROVIDER_META.name`); SearXNG and Ollama keep upstream v2.15.0's URL-only rule. | Source contradicts the Design premise "SearXNG and Ollama have no API-key env var": `searxng.ts` META declares `envVar: SEARXNG_API_KEY` and `ollama.ts` declares `envVar: OLLAMA_API_KEY` (optional Bearer keys, localhost defaults). Applying D03's generic rule would make key-only SearXNG/Ollama visible, contradicting the Design intent that their behavior does not change. D03's purpose (key-only Firecrawl Cloud visible) is preserved. | Implement T03 finding; Gamemaster decision (option B), 2026-10-25. Affected work: T03 in progress only; no completed evidence affected. | Upstream adds its own key-or-URL rule, or the user wants key-only SearXNG/Ollama visible. |

## Work breakdown

- [x] T01: Start the merge on a sync branch
  - Depends on: none
  - Scope: Confirm a clean tree and `main` at `ba1d25f8`, create `sync/upstream-v2.15.0`, then run `git merge --no-ff --no-commit v2.15.0`.
  - Expected areas: Git branch, index, worktree.
  - Acceptance: `MERGE_HEAD` is `ce6d3530`, and the unmerged paths are exactly the 8 listed in Context (explain any difference before proceeding).
  - Verification: `git status --short --branch`; `git rev-parse MERGE_HEAD`; `git diff --name-only --diff-filter=U`.

- [x] T02: Resolve the ask-user-question conflicts
  - Depends on: T01
  - Scope: `factory.test.ts` and `tab-bar.test.ts` per Design.
  - Expected areas: those two files, and `tool/types.ts` only if needed.
  - Acceptance: no markers, `.ts` specifiers, 15-question assertions kept, upstream's new behavior assertions kept.
  - Verification: focused questionnaire tests (Verification plan step 3).

- [x] T03: Resolve the web-tools conflicts, including provider visibility
  - Depends on: T01
  - Scope: `providers/firecrawl.ts`, `providers/index.ts`, `providers/types.ts`, `web-tools.ts`, `docs/configuration.md`, `.rpiv/guidance/packages/rpiv-web-tools/architecture.md`. Add the D03 regression test in `packages/rpiv-web-tools/index.test.ts`.
  - Expected areas: the paths above. Touch `docs/providers.md` and `docs/self-hosted.md` only if they contradict retained behavior.
  - Acceptance: Firecrawl URL precedence, Cloud key rule, and self-hosted optional auth are intact. Firecrawl with only an API key is configured and visible. SearXNG and Ollama visibility is unchanged. You.com `YDC_API_KEY` fallback is intact.
  - Verification: focused web-tools tests (Verification plan step 3).

- [x] T04: Install dependencies and fix specifier fallout
  - Depends on: T02, T03
  - Scope: run `npm ci`, confirm `package-lock.json` is unchanged, run `check:ts-specifiers`, and convert flagged `.js` specifiers in fork-touched files to `.ts`.
  - Expected areas: `node_modules` (untracked) and fork-touched `.ts` files under the two packages.
  - Acceptance: `npm ci` exits 0, `git diff --quiet -- package-lock.json` holds, and `check:ts-specifiers` exits 0.
  - Verification: Verification plan step 2.

- [x] T05: Run full verification and stage
  - Depends on: T04
  - Scope: run all Verification plan steps, make bounded fixes for any merge-caused failures and rerun, then stage resolved and edited paths explicitly.
  - Expected areas: Git index, plus merge-related fixes only.
  - Acceptance: every check exits 0, no unmerged paths, and staging is limited to merge content plus resolutions.
  - Verification: Verification plan steps 1 to 7.

- [x] T06: Smoke-test in Pi and hand off
  - Depends on: T05
  - Scope: run the local Pi smoke test, update Progress, record `verification.md` evidence, and report status for handoff to Dream and the D07 Gamemaster commit phase (no commit by Implement).
  - Acceptance: both extensions load, `/web-tools --show` opens, `ask_user_question` is available, and no network call is made to Firecrawl.
  - Verification: Verification plan step 8.

## Acceptance criteria

- `sync/upstream-v2.15.0` holds a fully resolved, staged merge of `v2.15.0` with no unmerged paths or conflict markers.
- All fork customizations listed in Requirements are present in code, tests, manifest, and current docs.
- Firecrawl with only an API key is configured and visible. Self-hosted Firecrawl with only a URL is configured. SearXNG and Ollama with only the default URL, or with only an API key and the default URL, are not configured (D08).
- `npm ci` succeeds and leaves `package-lock.json` unchanged.
- Every command in the Verification plan exits 0, and the Pi smoke test passes.
- Implement has made no commit, and no fast-forward, push, lockfile rewrite, live endpoint call, or unrelated cleanup has happened (the D07 local merge commit is created afterward by the Gamemaster commit phase).

## Testing decisions and seams

- Firecrawl and provider visibility are tested through mocked `fetch` and the existing `index.test.ts` extension harness (provider enum and `/web-tools` markers).
- Questionnaire limits rest on the shared `MAX_QUESTIONS` constant, and assertions derive from it.
- Biome runs without `--write` to avoid touching unrelated merged files. Use `npm run check` only after the individual checks pass, because it writes.

## Verification plan

1. Check marker hygiene:

   ```sh
   git diff --name-only --diff-filter=U
   git grep -n -E '^(<<<<<<<|=======|>>>>>>>)( |$)' -- ':!spec/**'
   git diff --check
   ```

   Pass: the first two commands print nothing, and the last exits 0.

2. Check dependencies and specifiers:

   ```sh
   npm ci
   git diff --quiet -- package-lock.json
   npm run check:ts-specifiers
   npm run check:host-provided-deps
   npm run check:file-sizes
   ```

3. Run focused tests:

   ```sh
   npx vitest run \
     packages/rpiv-ask-user-question/factory.test.ts \
     packages/rpiv-ask-user-question/tool/types.test.ts \
     packages/rpiv-ask-user-question/ask-user-question.execute.test.ts \
     packages/rpiv-ask-user-question/view/components/tab-bar.test.ts \
     packages/rpiv-web-tools/index.test.ts \
     packages/rpiv-web-tools/providers/config.test.ts
   ```

4. Run broad checks:

   ```sh
   npm test
   npm run test:outside-coverage
   npx biome check --error-on-warnings .
   npx tsc --noEmit -p tsconfig.base.json
   npm run check:decision-codes
   npm run build:site
   ```

5. Check the root manifest and the guarded Husky script:

   ```sh
   node -e 'const p=require("./package.json");console.log(JSON.stringify(p.pi),p.scripts.prepare)'
   env -i PATH=/usr/bin:/bin /bin/sh -c 'command -v husky >/dev/null 2>&1 && husky || true'
   ```

   Pass: exactly the two extension entry points, the guarded prepare script, and exit 0.

6. Search for stale limit text:

   ```sh
   git grep -n -E 'up to (4|four) (questions|per call)|1-4 questions|2-4 independent|more than 4 questions' -- packages ':!**/CHANGELOG.md'
   ```

   Pass: no matches that describe the `ask_user_question` limit.

7. Check staging boundaries:

   ```sh
   git diff --cached --name-status
   git diff --cached -- spec
   git status --short --branch
   ```

   Pass: no `UU` entries, every staged path is attributable to the merge or its resolution, and Implement has staged no `spec/` or `wiki/` paths (those are added by the D07 Gamemaster commit phase).

8. Smoke-test in Pi: run `pi --no-extensions -e . --no-session` from the repo root. Confirm there are no extension-load errors, `/web-tools --show` opens read-only, and `ask_user_question` is available. Then exit. Do not configure a provider or call `web_search` or `web_fetch`.

## Risks and blockers

- Pi host API changes from 0.80 to 1.4 may break fork code that auto-merged cleanly. Mitigation: run focused tests and `tsc` before the full suite, and limit fixes to the failing seam.
- Auto-merged fork files may keep `.js` specifiers. Mitigation: `check:ts-specifiers` is a required gate.
- `npm ci` may fail on local Node 26 while `.nvmrc` says 22. Mitigation: stop and report. Do not switch to `npm install`.
- Local Pi 1.1.0 is older than the dev target 1.4.0. Mitigation: report smoke-test failures caused by the host version separately from automated results.
- The new upstream `pre-commit` runs `check:file-sizes` and `npm run check` (which writes). Mitigation: pass both before handing off to the D07 Gamemaster commit phase.

## Progress

- [x] Planning complete and confirmed.
- [x] Implementation complete (T01-T06); merge staged on `sync/upstream-v2.15.0`, not committed (D07).
- [x] Verification passed; contract-quality review PASS. See `verification.md`.

## Execution handoff

Use PI Agent in a fresh session with this prompt:

```text
Read spec/active/261025-0741-merge-upstream-v2-15-0-and-verify-fork-behavior/plan.md and item.yaml completely, plus applicable AGENTS.md files.
Apply the recorded medium assurance level. Implement T01-T06 in order, preserving Requirements, Out of scope, and the Decision Log.
Merge tag v2.15.0 on sync/upstream-v2.15.0. Never rebase, reset, or restart the merge. Stage paths explicitly.
Only lockfile-exact npm ci is pre-approved. Stop if it fails or the lockfile would change.
Run every Verification plan step. Record only verified evidence, failures, and skipped checks in Progress and verification.md.
Do not create the merge commit (D07: the Gamemaster commit phase does that after Implement and Dream). Stop before fast-forwarding main, pushing, further dependencies, live network calls, or scope expansion.
```

## Notes

- No external web research was needed. The merge target is the fetched `v2.15.0` tag, and all conflict analysis came from a read-only `git merge-tree`.
- Root `coverage/` is gitignored and unaffected.

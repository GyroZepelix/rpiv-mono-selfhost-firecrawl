# Plan: Resolve upstream 2.9 merge and verify fork behavior

Work item: `260910-1057-resolve-upstream-2-9-merge-and-verify-fork-behavior`
Status: Planned
Created: 2026-09-10
Updated: 2026-09-10

## Goal

Resolve the in-progress merge of `juicesharp/rpiv-mono` 2.9.0 into the fork branch `sync/upstream-v2.9.0`, retain every confirmed fork customization, and establish through focused, repository-wide, and local Pi smoke checks that the merged two-extension plugin still loads and behaves as intended.

## Context

- The merge is already in progress with fork `HEAD` at `0fab3ec` and `MERGE_HEAD` at upstream `5dcad51`.
- Git reports three unresolved paths:
  - `packages/rpiv-ask-user-question/README.md`
  - `packages/rpiv-ask-user-question/factory.test.ts`
  - `packages/rpiv-web-tools/README.md`
- The non-conflicting merge result already retains the fork's root `pi.extensions` manifest, guarded Husky `prepare` script, `MAX_QUESTIONS = 15`, and Firecrawl base-URL implementation and tests.
- Relative to `MERGE_HEAD`, the fork-specific delta is limited to root `package.json` and eleven files under `packages/rpiv-ask-user-question` and `packages/rpiv-web-tools`. Newly added upstream documentation currently contains statements that contradict those retained customizations.
- Protocol files and this work item were created during the merge. They are planning artifacts, not part of the upstream merge resolution, and must not be swept into merge staging with a broad `git add -A`.

## Requirements

- Continue the current merge. Do not abort it, restart it, reset either side, or discard already merged upstream changes.
- Preserve configurable Firecrawl endpoint resolution in this order: `FIRECRAWL_API_URL`, `baseUrls.firecrawl`, then `https://api.firecrawl.dev/v1`.
- Preserve Firecrawl Cloud's API-key requirement while allowing a non-default self-hosted Firecrawl endpoint to omit `Authorization` when no key is configured.
- Preserve `/web-tools` Firecrawl configuration, URL validation, URL display, and current provider metadata integration.
- Preserve `MAX_QUESTIONS = 15` across TypeBox schema limits, runtime validation, prompt guidance, UI behavior, and tests.
- Preserve the root Pi manifest exposing `./packages/rpiv-web-tools/index.ts` and `./packages/rpiv-ask-user-question/index.ts`.
- Preserve the production-safe root `prepare` script: `command -v husky >/dev/null 2>&1 && husky || true`.
- Resolve documentation conflicts from the upstream 2.9.0 version as the structural baseline, adding only accurate fork-specific behavior and limits. Do not restore obsolete fork documentation for removed or changed upstream features.
- Keep current package documentation, site extension metadata, and `.rpiv` architecture guidance consistent with the retained 15-question and self-hosted Firecrawl behavior.
- Resolve and stage source conflict paths explicitly. Do not stage `spec/` through a broad add operation.
- Preserve unrelated upstream changes and unrelated user changes.
- Report every failed or skipped verification honestly. Do not declare the merge working while required checks fail.

## Out of scope

- Adding dependencies, changing dependency versions beyond the already staged upstream merge, or regenerating the lockfile without a demonstrated merge-related need.
- Renaming packages, changing the `@juicesharp` package scope, changing repository URLs throughout the monorepo, or preparing an npm release.
- Modifying unrelated packages, generated assets, historical changelogs, historical release notes, or unrelated prose that happens to use the phrase "four questions."
- Contacting Firecrawl Cloud or a live self-hosted Firecrawl endpoint.
- Refactoring provider architecture, questionnaire architecture, or test infrastructure beyond the smallest compatibility fixes required by the merge.
- Committing the merge, pushing a branch, opening a pull request, publishing packages, or changing production/user configuration without separate approval.

## Assumptions

- The root package is intentionally a Git-installable Pi package exposing exactly the web-tools and ask-user-question extensions. Revisit if the desired distribution unit is an individual workspace package rather than the repository root.
- Existing mock-based Firecrawl tests are sufficient for HTTP behavior because the confirmed verification scope excludes a live endpoint. Revisit if deployment-specific reverse-proxy, TLS, or authentication behavior must be certified.
- The upstream 2.9.0 README and documentation organization should remain authoritative for structure and current feature descriptions. Fork prose is retained only where it documents behavior that still exists.
- Existing dependencies are already available in the checkout. If focused tests cannot start due solely to missing installed dependencies, obtain approval before any dependency installation that could rewrite the lockfile.
- The planning protocol under `spec/` remains outside merge staging unless the user separately chooses to commit it.

## Design

Use the upstream 2.9.0 side as the baseline for both conflicted READMEs because it reflects the current package architecture, host behavior, commands, and documentation layout. Integrate the fork's limit and Firecrawl differences into that baseline rather than concatenating old and new documents.

For `factory.test.ts`, retain the fork's dynamic `MAX_QUESTIONS` fixture and expectations (`A1` through `A15`) while keeping upstream's current response-envelope assertions. Static four-answer expectations are incompatible with both the generated fixture and the confirmed 15-question contract.

Treat the non-conflicting auto-merge as provisional until focused tests pass. Review the retained Firecrawl path as one vertical seam: provider metadata and exports, base-URL resolver, factory construction, command configuration, and mock tests. Review the questionnaire path similarly: constant, schema, validator, guidance, long-tab UI tests, and public documentation.

Documentation reconciliation should update only current behavioral references:

- Ask-user-question: merged package README, `docs/tool-schema.md`, and the site extension tagline.
- Web-tools: merged package README, `docs/providers.md`, `docs/configuration.md`, `docs/self-hosted.md`, and `.rpiv/guidance/packages/rpiv-web-tools/architecture.md`.

After resolving the three conflicts and any directly required compatibility failures, stage only the explicitly resolved or intentionally edited tracked files. Run focused tests first, then repository-wide checks, then the local Pi load smoke test. Leave the index ready for a merge commit, but request approval before committing.

## Decision Log

| ID | Scope | Decision | Rationale | Evidence | Revisit when |
| --- | --- | --- | --- | --- | --- |
| D01 | Fork behavior | Preserve all four customization groups: Firecrawl, 15 questions, root exports, and guarded Husky setup. | The user explicitly selected "Preserve all." | Confirmed understanding gate, 2026-09-10. | The user explicitly removes a customization. |
| D02 | Conflict strategy | Use upstream 2.9.0 documents and architecture as the baseline, then layer retained fork behavior onto them. | Avoids reintroducing obsolete v1.17-era descriptions while keeping custom behavior documented. | Conflict contents and current upstream package structure. | Upstream documentation proves incompatible with retained behavior. |
| D03 | Questionnaire test conflict | Keep dynamic assertions derived from `MAX_QUESTIONS`, not upstream's static four-item expectation. | The merged fixture generates `A1` through `A15`; dynamic assertions encode the intended invariant. | `packages/rpiv-ask-user-question/factory.test.ts` around the unresolved block. | The maximum becomes configurable rather than constant. |
| D04 | Verification boundary | Use automated tests and local Pi load smoke testing without a live Firecrawl call. | The user selected automated and smoke verification. | Clarification response, 2026-09-10. | A reachable test endpoint and explicit live-test approval are provided. |
| D05 | Git boundary | Resolve and stage the merge, but stop before merge commit or push. | Commits and external writes require explicit approval. | Repository operating guidelines and confirmed understanding. | The user explicitly approves commit or push. |
| D06 | Planning artifacts | Exclude `spec/` from merge staging. | The protocol was bootstrapped during the merge and is not upstream conflict content. | Current worktree and bootstrap history. | The user explicitly requests committing planning infrastructure. |
| D07 | Firecrawl Cloud identity | Classify Firecrawl Cloud by parsed, lowercased hostname after removing a terminal DNS dot, not by raw URL equality. | Equivalent Cloud URLs with an explicit default port or terminal-dot FQDN must not bypass the key requirement. | Independent focused review findings and regression matrix in `packages/rpiv-web-tools/index.test.ts`. | Firecrawl publishes additional official Cloud hostnames. |
| D08 | Commit contents | Include the completed `spec/` protocol and work-item evidence in the merge commit. | After implementation and review, the user explicitly selected "Include spec too" at the commit-scope gate. | Git-commit scope decision, 2026-09-10. | A later commit split is explicitly requested before commit creation. |

## Work breakdown

- [x] T01: Reconfirm and bound the active merge state
  - Depends on: none
  - Scope: Record `HEAD`, `MERGE_HEAD`, unresolved paths, and fork-specific delta before editing. Confirm only the three known paths are unmerged and no unexpected user edits appeared after planning.
  - Expected areas: Git index and worktree status only.
  - Acceptance: Merge heads remain `0fab3ec` and `5dcad51` or any difference is explained before proceeding; unresolved paths are understood; `spec/` remains untracked or otherwise excluded from merge staging.
  - Verification: `git status --short --branch`; `git diff --name-only --diff-filter=U`; `git ls-files -u`.

- [x] T02: Resolve the 15-question conflict against upstream questionnaire behavior
  - Depends on: T01
  - Scope: Resolve `factory.test.ts` with dynamic 15-question assertions, resolve the package README from the upstream baseline, and reconcile current limit references without altering unrelated four-question workflow prose.
  - Expected areas: `packages/rpiv-ask-user-question/README.md`, `packages/rpiv-ask-user-question/factory.test.ts`, `packages/rpiv-ask-user-question/docs/tool-schema.md`, `packages/rpiv-site/src/content/extensions/rpiv-ask-user-question.md`; inspect but change only if required: `tool/types.ts`, `tool/types.test.ts`, `ask-user-question.execute.test.ts`, `view/components/tab-bar.test.ts`.
  - Acceptance: No conflict markers remain; all public limit statements say 15 where they describe `ask_user_question`; generated and runtime limit behavior remains 15; current upstream host/UI behavior remains documented.
  - Verification: `git diff --check`; targeted text search for stale `up to four`, `1-4 questions`, and `more than 4` references in current ask-user-question docs; focused questionnaire tests from the Verification plan.

- [x] T03: Resolve and reconcile self-hosted Firecrawl with the upstream provider architecture
  - Depends on: T01
  - Scope: Resolve the web-tools README from the upstream baseline, inspect the auto-merged Firecrawl vertical seam, fix only compatibility issues, and update current provider/configuration/self-hosted architecture documentation.
  - Expected areas: `packages/rpiv-web-tools/README.md`, `packages/rpiv-web-tools/providers/firecrawl.ts`, `packages/rpiv-web-tools/providers/factory.ts`, `packages/rpiv-web-tools/providers/index.ts`, `packages/rpiv-web-tools/providers/config.ts`, `packages/rpiv-web-tools/web-tools.ts`, `packages/rpiv-web-tools/index.test.ts`, `packages/rpiv-web-tools/docs/providers.md`, `packages/rpiv-web-tools/docs/configuration.md`, `packages/rpiv-web-tools/docs/self-hosted.md`, `.rpiv/guidance/packages/rpiv-web-tools/architecture.md`.
  - Acceptance: Firecrawl participates in metadata-driven base-URL resolution and `/web-tools` configuration; Cloud requires a key; self-hosted endpoints may omit it; docs no longer claim only SearXNG and Ollama support base URLs or self-hosting.
  - Verification: Focused web-tools tests from the Verification plan and text searches for stale two-provider/base-URL claims.

- [x] T04: Verify root Git-package compatibility and stage only intended merge resolutions
  - Depends on: T02, T03
  - Scope: Confirm the root manifest still exposes exactly the two intended extension entry points and the guarded Husky command remains intact. Stage conflicted and intentionally edited tracked files individually, never with `git add -A` or `git add .`.
  - Expected areas: `package.json`, Git index, resolved tracked paths.
  - Acceptance: Root manifest and prepare command match Requirements; `git diff --name-only --diff-filter=U` is empty; `spec/` is not staged; the index contains only the upstream merge plus intended resolution changes.
  - Verification: `git diff --name-only --diff-filter=U`; `git diff --cached --name-status`; `git diff --cached -- spec`; `git status --short --branch`; no-Husky shell check from the Verification plan.

- [x] T05: Run focused and repository-wide automated verification
  - Depends on: T04
  - Scope: Run the exact focused tests, full test suite, formatting/lint check, TypeScript check, decision-code check, and site build. Diagnose merge-caused failures and make only bounded fixes in the relevant seams, rerunning the smallest failed check before broad checks.
  - Expected areas: Test execution and only merge-related source/test/doc paths if a failure requires correction.
  - Acceptance: Every required automated check exits zero. Any environment-only blocker is reported with evidence and remains an explicit blocker rather than being waived silently.
  - Verification: Commands under Verification plan.

- [x] T06: Smoke-load the merged root plugin in Pi and prepare the approval handoff
  - Depends on: T05
  - Scope: Launch Pi with normal extension discovery disabled and this repository loaded explicitly; verify both root extension entry points load and `/web-tools --show` opens without contacting Firecrawl. Exit without changing user configuration. Summarize status and request approval before a merge commit.
  - Expected areas: Local Pi process and read-only command/UI observation; no persistent user config changes.
  - Acceptance: Pi starts without extension-load errors, exposes the web-tools command and ask-user-question tool through the root package, and no live Firecrawl request occurs. Worktree/index status is reported before the commit gate.
  - Verification: Manual smoke procedure under Verification plan; final `git status --short --branch`.

## Acceptance criteria

- Git reports no unmerged paths or conflict markers in tracked source and documentation.
- Upstream 2.9.0 changes remain present, with no reset or broad replacement by the old fork side.
- All four confirmed fork customization groups remain represented in code, tests, manifests, and current documentation.
- Focused Firecrawl tests prove env/config/default URL precedence, hosted key enforcement, optional self-hosted auth, `/search` and `/scrape` routing, interactive configuration, and URL validation.
- Focused questionnaire tests prove the schema accepts 15, rejects 16, executes and submits a 15-question flow, preserves partial cancellation behavior, and renders the maximum-tab case.
- The root package exposes both extension entry points and its Husky prepare command succeeds when `husky` is unavailable.
- Full tests, Biome, TypeScript, decision-code validation, and site build pass.
- The root package loads in a local Pi smoke session without extension initialization errors, and `/web-tools --show` is available without a live Firecrawl request.
- `spec/` is not accidentally staged with the merge resolution.
- No merge commit, push, publication, live endpoint call, dependency addition, or unrelated cleanup occurs without approval.

## Testing decisions and seams

- Firecrawl remains tested through mocked `fetch`, which gives deterministic coverage of endpoint selection, headers, response normalization, and errors without service credentials.
- Questionnaire coverage is split across schema/runtime tests and the real TUI factory driver. The existing `MAX_QUESTIONS` constant is the shared seam, so assertions should derive from it where practical.
- Documentation searches are bounded to current package docs, current site extension metadata, and architecture guidance. Historical release prose and unrelated workflow authoring language are intentionally excluded.
- Run focused tests before the full suite to shorten diagnosis. A focused failure must be fixed and rerun before proceeding.
- Biome and TypeScript are invoked separately in non-writing mode rather than using `npm run check`, whose `--write` behavior could modify unrelated merged files.
- The Pi smoke test checks package discovery and extension initialization. It does not certify a remote Firecrawl deployment.

## Verification plan

1. Confirm merge resolution and marker hygiene:

   ```sh
   git diff --name-only --diff-filter=U
   git grep -n -E '^(<<<<<<<|=======|>>>>>>>)' -- ':!spec/**'
   git diff --check
   ```

   Pass condition: the unresolved-path and conflict-marker commands produce no matches, and `git diff --check` exits zero.

2. Run focused questionnaire and Firecrawl tests:

   ```sh
   npm test -- \
     packages/rpiv-ask-user-question/factory.test.ts \
     packages/rpiv-ask-user-question/tool/types.test.ts \
     packages/rpiv-ask-user-question/ask-user-question.execute.test.ts \
     packages/rpiv-ask-user-question/view/components/tab-bar.test.ts \
     packages/rpiv-web-tools/index.test.ts \
     packages/rpiv-web-tools/providers/config.test.ts
   ```

   Pass condition: all selected Vitest files pass with no unhandled errors.

3. Run repository-wide automated checks:

   ```sh
   npm test
   npx biome check --error-on-warnings .
   npx tsc --noEmit -p tsconfig.base.json
   npm run check:decision-codes
   npm run build:site
   ```

   Pass condition: every command exits zero. If a command is unavailable because existing dependencies are missing, stop and request approval before an install that may affect the lockfile.

4. Exercise the guarded no-Husky branch directly:

   ```sh
   env -i PATH=/usr/bin:/bin /bin/sh -c 'command -v husky >/dev/null 2>&1 && husky || true'
   ```

   Pass condition: exit status is zero with no Husky executable available.

5. Confirm staging boundaries:

   ```sh
   git diff --cached -- spec
   git diff --cached --name-status
   git status --short --branch
   ```

   Pass condition: no `spec/` content is staged, no `UU` entries remain, and all staged paths are attributable to the upstream merge or confirmed resolution work.

6. Perform a local interactive Pi smoke test from the repository root:

   ```sh
   pi --no-extensions -e . --no-session
   ```

   In the temporary session, verify startup reports no extension-load error, confirm `/web-tools --show` is registered and opens its read-only display, confirm `ask_user_question` is present in the available tool surface, then exit. Do not select/configure a provider and do not issue `web_search` or `web_fetch`.

   Pass condition: both root-manifest extensions load, the read-only command is available, and no persistent config or network call is made.

7. Before any merge commit, report the final checks and request explicit approval. After approval, the implementation agent may create the merge commit. A push requires a separate explicit approval.

## Risks and blockers

- The merge spans hundreds of upstream commits. Mitigation: use upstream documents as baseline, inspect the narrow fork delta, and run the full suite after focused checks.
- Firecrawl code auto-merged despite substantial provider refactoring. A syntactically clean merge can still wire metadata, base URL, or credentials incorrectly. Mitigation: inspect the whole vertical seam and retain the existing mock coverage for each resolution tier and auth case.
- Fifteen tabs stress layout and navigation paths designed upstream around four. Mitigation: retain maximum-question factory and tab-bar tests and run the full questionnaire suite.
- Upstream documentation says only SearXNG and Ollama are self-hosted/base-URL providers. Leaving it untouched would make the fork behavior undiscoverable and architecture guidance false. Mitigation: update only current docs and guidance that define provider capability.
- A broad `git add` during an active merge could stage the newly bootstrapped planning protocol. Mitigation: add tracked resolution paths explicitly and verify `git diff --cached -- spec` is empty.
- `npx` can attempt package downloads when local binaries are absent. Mitigation: require existing local binaries; if unavailable, stop before network-backed dependency installation.
- The local Pi smoke test may encounter globally installed duplicate packages or user configuration. Mitigation: use `--no-extensions -e . --no-session`, avoid provider configuration, and report any host-specific blocker separately from automated test results.
- Completing the Git merge requires a commit, but commit and push are outside current approval. Mitigation: leave a verified, staged, commit-ready merge and ask explicitly.

## Progress

- [x] Planning protocol version 1 bootstrapped and validated.
- [x] Requirements clarified and shared understanding confirmed.
- [x] Planning complete.
- [x] Implementation started at `HEAD` `0fab3ec`.
- [x] Merge conflicts resolved and intended tracked paths staged; `spec/` stayed unstaged through implementation review and was then explicitly approved for inclusion in the merge commit.
- [x] User-approved lockfile-exact dependency refresh completed; `package-lock.json` remained unchanged.
- [x] Required automated checks and local Pi smoke test passed.
- [x] Two blocking review rounds were corrected; final independent focused review passed with no findings.
- [x] Direct implementation contract complete and ready for a user-controlled Git checkpoint.

## Execution handoff

Use PI Agent in a fresh session with this prompt:

```text
Read spec/active/260910-1057-resolve-upstream-2-9-merge-and-verify-fork-behavior/plan.md and the adjacent item.yaml completely.
Implement one confirmed task at a time while preserving Requirements, Out of scope, Decision Log, Risks, and Verification plan.
Continue the existing merge. Do not abort, reset, or restart it.
Update Progress and add a confirmed Decision Log entry when implementation discoveries change the approach.
Use explicit git add paths and keep spec/ out of merge staging.
Run focused checks during work and every required verification before reporting completion.
Stop and ask before dependencies, migrations, destructive operations, external writes, commits, pushes, production actions, or scope expansion.
Preserve failures, skipped checks, deviations, and unverified areas instead of claiming completion.
```

## Proposed durable knowledge updates

- Update `.rpiv/guidance/packages/rpiv-web-tools/architecture.md` during implementation so current architecture truth lists Firecrawl alongside providers with metadata-driven base-URL configuration and documents its hosted-versus-self-hosted key rule.
- No repository wiki exists, so no wiki update is proposed.

## Notes

- Repository evidence used: current merge index/worktree, `package.json`, current provider and questionnaire source/tests/docs, and commit identities `0fab3ec` and `5dcad51`.
- External repository references are recorded in `item.yaml`; no additional web research was required because the integration target is already present in `MERGE_HEAD` and the source tree is authoritative for this merge.
- The planning protocol files added under `spec/` are the only files created by Quick Plan. No implementation source path was modified.

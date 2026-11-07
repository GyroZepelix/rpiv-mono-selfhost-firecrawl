# Verification: ask_user_question visible-context guard

Work item: `261107-1756-ask-user-question-visible-context-guard`
Date: 2026-11-07

## Environment

macOS (Apple M5 Pro), repo `~/Documents/1-Projects/10-software-development/50-pi-extensions/rpiv-mono-selfhost-firecrawl` on `main` at `f9ff6969`, plus uncommitted changes. The installed copy under `~/.pi/agent/git/` was not touched.

## Commands and checks

| Check | Result | Evidence |
| --- | --- | --- |
| `npx vitest run packages/rpiv-ask-user-question` | pass | 45 files, 894 tests (rerun after biome formatting) |
| `npm test` | pass | 310 files, 7098 tests |
| `npm run test:outside-coverage` | pass | 1 file, 2 tests |
| `npm run check:ts-specifiers` | pass | 726 files scanned |
| `npm run check:file-sizes` | pass | 204 files within ratchet, 1 new under cap (baseline not updated) |
| `npm run check:decision-codes` | pass | 401 files scanned |
| `npm run check:host-provided-deps` | pass | 16 manifests, 741 source files |
| `npx biome check --error-on-warnings .` | pass | 0 errors; 3 infos in untouched `rpiv-pi` test files, the same with the changes stashed |
| `npx tsc --noEmit -p tsconfig.base.json` | pass | exit 0 |
| `git diff --check` | pass | no whitespace errors |
| Markdown links and fences in changed wiki, docs, and plan | pass | relative links resolve, fences balanced |

## Requirement coverage

| Requirement | Evidence | Status |
| --- | --- | --- |
| R1 guard rule | `tool/visible-context-guard.test.ts` (thinking-only refused, text allowed, whitespace and `minChars`); `ask-user-question.visible-context.test.ts` (execute-level refusal) | pass |
| R2 `selfContained` | unit and execute tests: honored by default, refused when `honorSelfContained: false`, `false` never excuses | pass |
| R3 refusal result | execute test: `error: "missing_visible_context"`, text contains "NOT shown", `ui.custom` not called, no `pi.events.emit`; hint omitted when not honored | pass |
| R4 config | `config.test.ts` `resolveVisibleContextGuard`: defaults, valid values, per-key fallback, `minChars` 0 and 0.5 rejected; execute tests read real config files under the test HOME | pass |
| R5 fail open | execute tests: empty branch and a throwing `getBranch` both show the questionnaire; unit test: unknown id never refuses | pass |
| R6 unchanged behavior | the full existing suite passes unchanged (existing tests use an empty branch, so the guard fails open) | pass |
| R7 docs | `README.md`, `docs/configuration.md` (table and `visibleContextGuard` section), `docs/tool-schema.md` (parameter and error row) | pass |
| R8 wiki | issue page rewritten (cause, evidence, workaround, revert); upstream-sync customization bullet; index section; log entry | pass |
| Schema independent of config (G5) | execute test asserts `QuestionParamsSchema` keys are always `questions, selfContained`; the schema is a module constant | pass |

## Failures and skipped checks

- `npm run check` was not run, because it writes and mirrors `.husky/pre-commit`. Its component checks above were run individually.
- No manual pi smoke run (low assurance, per the plan).

## Unverified areas

- Live behavior with a real Claude 5.x model in pi. Not exercised until the change reaches the installed copy (needs commit, push, and `pi update`, which the user does).
- Whether models overuse `selfContained`. `honorSelfContained: false` is the mitigation.

# Verification: Resolve upstream 2.9 merge and verify fork behavior

Work item: `260910-1057-resolve-upstream-2-9-merge-and-verify-fork-behavior`
Date: 2026-09-10

## Environment

- Mode: direct
- Starting and current `HEAD`: `0fab3ecc567232877ee83cb9886f7b1d47a09bf0`
- `MERGE_HEAD`: `5dcad51c670d71996fc109386a649670a690d417`
- Branch: `sync/upstream-v2.9.0`
- Node.js: `v26.5.0`
- npm: `11.17.0`
- Vitest after dependency refresh: `4.1.10`
- Merge remains intentionally uncommitted.

## Changed paths

Bounded fork-preservation and conflict-resolution paths changed relative to upstream:

- `.rpiv/guidance/packages/rpiv-web-tools/architecture.md`
- `package.json` (pre-existing fork manifest and guarded prepare script retained)
- `packages/rpiv-ask-user-question/README.md`
- `packages/rpiv-ask-user-question/docs/tool-schema.md`
- `packages/rpiv-ask-user-question/factory.test.ts`
- `packages/rpiv-ask-user-question/tool/types.ts`
- `packages/rpiv-ask-user-question/tool/types.test.ts`
- `packages/rpiv-ask-user-question/view/components/tab-bar.test.ts`
- `packages/rpiv-site/src/content/extensions/rpiv-ask-user-question.md`
- `packages/rpiv-web-tools/README.md`
- `packages/rpiv-web-tools/docs/configuration.md`
- `packages/rpiv-web-tools/docs/providers.md`
- `packages/rpiv-web-tools/docs/self-hosted.md`
- `packages/rpiv-web-tools/index.test.ts`
- `packages/rpiv-web-tools/providers/factory.ts`
- `packages/rpiv-web-tools/providers/firecrawl.ts`
- `packages/rpiv-web-tools/providers/index.ts`
- `packages/rpiv-web-tools/providers/types.ts`
- `packages/rpiv-web-tools/web-tools.ts`

The planning protocol remained untracked and unstaged through implementation and focused review. At the later commit-scope gate, the user explicitly approved including `spec/` in the merge commit.

## Commands and checks

| Check | Result | Evidence |
| --- | --- | --- |
| Resolve planned item | PASS | Helper resolved the requested active item with status `planned`. |
| Confirm Git/merge checkpoints | PASS | `HEAD` and `MERGE_HEAD` match the plan; the three planned conflicts were the only unmerged paths. |
| Dependency refresh | PASS | User approved `npm ci`; 714 packages installed and `package-lock.json` Git hash remained `f7a1e43f5333e0ca2324fbeb49f427698622078d`. |
| Initial focused test attempt | BLOCKED, RESOLVED | Existing stale `node_modules` lacked `@earendil-works/pi-ai/compat`; no tests collected. Resolved by the approved lockfile-exact `npm ci`. |
| Focused questionnaire/web-tools tests | PASS | Six test files passed initially; final independent reviewer rerun passed 6 files and 351 tests after both Cloud-URL regressions were added. |
| Corrected Firecrawl focused tests | PASS | `index.test.ts` and `providers/config.test.ts`: 2 files, 240 tests. |
| Full test suite, final run | PASS | 268 files, 6,621 tests. Expected negative-fixture stderr from `reconcile-lint` appeared while its tests passed. |
| Biome whole repository | PASS | 676 files checked, no warnings/errors; three informational suggestions in upstream `built-in-workflows.test.ts`. |
| Biome corrected paths | PASS | `firecrawl.ts` and `index.test.ts` checked with no fixes. |
| TypeScript | PASS | `npx tsc --noEmit -p tsconfig.base.json` exited zero after each behavioral correction. |
| Decision-code check | PASS | `npm run check:decision-codes`: 351 TypeScript files, no prohibited citations. |
| Site build | PASS | Astro built 79 pages. |
| No-Husky path | PASS | Exact guarded shell body exited zero under `env -i PATH=/usr/bin:/bin`. |
| Conflict/index hygiene | PASS | `git ls-files -u`, unresolved-path query, tracked conflict-marker query, and unstaged-diff query are empty. |
| Staging boundary | PASS | `git diff --cached -- spec` was empty throughout implementation review. The later git-commit workflow staged `spec/` explicitly after user approval. |
| Root manifest | PASS | Exactly the required web-tools and ask-user-question extension paths remain; guarded prepare command is exact. |
| Pi root-package smoke | PASS | Offline RPC host loaded `-e .`; local `/web-tools --show` registered from the repository and returned read-only configuration with no `extension_error` or web request. |

## Requirement coverage

| Requirement | Evidence | Status |
| --- | --- | --- |
| Continue current merge without abort/reset | Checkpoints unchanged and upstream merge index retained | PASS |
| Resolve all three conflicts from upstream structural baselines | No unmerged entries/markers; current READMEs use upstream 2.9 structure | PASS |
| Preserve 15 questions | Constant, schema/runtime checks, max-flow and tab tests, README/tool-schema/site copy; focused and full tests | PASS |
| Preserve Firecrawl URL precedence | Existing env/config/default mock cases pass | PASS |
| Require keys for Firecrawl Cloud | Cloud host is detected after URL parsing, default-port normalization, and terminal DNS-dot normalization; regression matrix passes | PASS |
| Allow unkeyed self-hosted Firecrawl | Different-host mock requests omit Authorization and use `/search`/`/scrape`; tests pass | PASS |
| Preserve `/web-tools` configuration/display | Provider metadata/config callback, marker semantics, and `--show` tests plus Pi smoke pass | PASS |
| Preserve root extension exports | Manifest assertion and Pi root-package load pass | PASS |
| Preserve production-safe Husky setup | Manifest assertion, `npm ci` prepare execution, and no-Husky shell check pass | PASS |
| Keep current docs/guidance accurate | Package READMEs/docs, site tagline, and architecture guidance reconciled; site build passes | PASS |
| Avoid live Firecrawl and unrelated writes | All Firecrawl HTTP checks used mocked fetch; smoke used only read-only `--show`; no commit/push | PASS |
| Keep `spec/` from accidental merge staging | It remained unstaged through implementation review, then was explicitly approved and staged during the commit workflow | PASS |

## Review findings

### Focused review attempt 1: BLOCK, resolved

- Raw string equality for Firecrawl Cloud detection allowed the equivalent explicit-default-port URL to bypass key enforcement.
  - Resolution: parse the URL and classify Cloud by normalized hostname; add explicit-port regression coverage.
- Provider marker documentation omitted that a key alone marks a provider configured.
  - Resolution: update `docs/providers.md` to describe key-or-explicit-URL behavior.
- Evidence file was stale after the approved dependency refresh.
  - Resolution: preserve the initial failure while updating this artifact with subsequent checks.

### Focused review attempt 2: BLOCK, resolved

- Terminal-dot FQDN `api.firecrawl.dev.` remained DNS-equivalent to Cloud but did not match the normalized hostname.
  - Resolution: remove one terminal DNS dot before comparison and add a regression case.
- Architecture guidance still described exact-default-URL classification.
  - Resolution: document normalized Cloud-hostname classification.
- Plan and verification progress were stale.
  - Resolution: update both living artifacts while keeping `spec/` unstaged.

### Focused review attempt 3: PASS

- Coverage: complete 19-file staged fork delta against `MERGE_HEAD`, relevant Firecrawl and questionnaire callers/tests/docs, root manifest, merge/index state, `spec/AGENTS.md`, plan, verification evidence, and every scoped acceptance criterion.
- Blocking findings: none.
- Non-blocking findings: none.
- Reviewer-observed checks: focused six-file suite (351 tests), full suite (6,621 tests), whole-repository Biome, TypeScript, decision-code check, Git hygiene, root manifest, and no-Husky shell path all passed. The reviewer also confirmed the three cached whitespace findings are upstream-only.
- Uncertainty: live deployment-specific Firecrawl networking, TLS, DNS, and proxy behavior remains intentionally outside scope.

## Failures and skipped checks

- The first focused test attempt failed before collection because the pre-merge installed dependency tree was stale. This was resolved after explicit approval with `npm ci` and all required checks subsequently passed.
- `npm ci` reported 34 audit findings (1 low, 25 moderate, 7 high, 1 critical) in the upstream lockfile. No `npm audit fix` was run because dependency remediation is outside this work item's scope.
- `git diff --cached --check` reports blank-line-at-EOF issues in three upstream-only merge inputs outside the bounded fork delta: `.rpiv/guidance/packages/rpiv-voice/view/components/architecture.md:68`, `packages/rpiv-pi/extensions/rpiv-core/built-ins/__fixtures__/run-3212-cite-check-routing.json:40`, and `packages/rpiv-pi/skills/grade/SKILL.md:165`. The plan's required unstaged `git diff --check` passes. These unrelated upstream files were not modified.
- No live Firecrawl endpoint was tested, by explicit scope decision.
- No merge commit or push was performed, by approval gate.

## Unverified areas

- Deployment-specific Firecrawl reverse-proxy, TLS, DNS, and authentication behavior remains unverified because no live endpoint was in scope.

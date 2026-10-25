# Wiki Log

## [2026-10-25] dream | Upstream v2.15.0 sync checkpoint

- Trigger: `/dream` run after "Gamemaster checkpoint: 261025-0741-merge-upstream-v2-15-0-and-verify-fork-behavior/direct".
- Inputs:
  - The current conversation.
  - `spec/archive/261025-0741-merge-upstream-v2-15-0-and-verify-fork-behavior/` (plan, verification, outcome) and `spec/active/260910-1057-resolve-upstream-2-9-merge-and-verify-fork-behavior/plan.md`.
  - `packages/rpiv-web-tools/web-tools.ts`, `packages/rpiv-web-tools/index.test.ts`, and `.rpiv/guidance/packages/rpiv-web-tools/architecture.md`.
- Wiki pages changed:
  - `wiki/index.md`: bootstrapped with the generic Dream routes, with user approval via Gamemaster, and given a workflows route.
  - `wiki/workflows/upstream-sync.md`: new page.
  - `wiki/dreams/MEMORY.md`: new file.
  - `wiki/log.md`: new file.
  - `wiki/dreams/<episode>.md` and `wiki/dreams/episodes.jsonl`.
  - `wiki/dreams/by-spec/261025-0741-merge-upstream-v2-15-0-and-verify-fork-behavior.md`.
- Verification: re-read the changed files, checked relative links, ran the memory safety scan and the MEMORY token budget check, and ran `git diff --check`.
- Notes:
  - The wiki previously had no `index.md`, `log.md`, or `dreams/`.
  - Merge-commit state, session commands, and per-item history stay in the episode and the archived spec.

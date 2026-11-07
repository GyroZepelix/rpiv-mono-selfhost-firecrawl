# Outcome: ask_user_question visible-context guard

Work item: `261107-1756-ask-user-question-visible-context-guard`
Disposition: completed
Date: 2026-11-07

## Delivered scope

- `tool/visible-context-guard.ts` and its wiring in `ask-user-question.ts`: refuses an `ask_user_question` call whose own assistant message has fewer than `minChars` visible text characters, returning `error: "missing_visible_context"`. Fails open when the calling message cannot be found.
- Config `visibleContextGuard` (`enabled`, `minChars`) in `~/.config/rpiv-ask-user-question/config.json`. Committed in `f519ed4f` and `6cd1f049`.

## Deviations from plan

- After live use, the guard proved counterproductive: a refused model retried about three times, kept emitting its explanation as thinking, was refused again, and then stopped using the tool. On user request (2026-11-07):
  - `visibleContextGuard.enabled` now defaults to `false` (the plan had it on by default).
  - The `selfContained` schema parameter and the `honorSelfContained` setting were removed. The tool schema is back to `{ questions }`.
  - The fifth default prompt guideline, `VISIBLE_CONTEXT_GUIDELINE`, was removed. Defaults are back to four guidelines.

## Verification summary

See `verification.md` for the original evidence. After the 2026-11-07 changes: `npx vitest run packages/rpiv-ask-user-question` passed (45 files, 892 tests), and `npm run check` (Biome, `tsc`, specifier and host-dependency checks) passed with no fixes.

## Retained, reverted, or transferred work

- Retained: the guard itself, opt-in with `{ "visibleContextGuard": { "enabled": true } }`.
- Reverted: `selfContained`, `honorSelfContained`, `VISIBLE_CONTEXT_GUIDELINE`, and the on-by-default setting.

## Residual risks

- With the guard off, the original symptom (explanation shown only as thinking before `ask_user_question`) is unmitigated in this extension.
- Removing `selfContained` changes the tool schema, costing one prompt-cache miss per resumed session.

## Follow-up work items

- None. Revisit if Pi supports `display: "updates"` or Anthropic changes progress-update behavior.

## Source references

- `packages/rpiv-ask-user-question/tool/visible-context-guard.ts`, `config.ts`, `ask-user-question.ts`, `tool/types.ts`.
- `plan.md`, `verification.md`.

## Wiki updates

- `wiki/issues/agent-explanation-only-in-thinking-before-ask-user-question.md` and `wiki/workflows/upstream-sync.md` record the new default and the removals.

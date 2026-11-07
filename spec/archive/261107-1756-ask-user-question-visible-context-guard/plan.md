# Plan: ask_user_question visible-context guard

Work item: `261107-1756-ask-user-question-visible-context-guard`
Status: Planned
Created: 2026-11-07
Updated: 2026-11-07

Assurance: low - one package, local and reversible; follows the existing config loader, tool-result error envelope, and unit-test patterns; the guard fails open whenever it cannot find the calling message. User-confirmed.

## Goal

`ask_user_question` refuses a call whose own assistant message carries no visible text, and tells the model to write its explanation as visible text and call again. This is a fork-only workaround for Claude 5.x models (Opus 5.5, Sonnet 5.5, Fable 5/5.1, Mythos 5.1) that sometimes emit the user-facing explanation before a tool call as a "progress update" `thinking` block instead of a `text` block. Pi requests `display: "summarized"`, so the explanation reaches the user only as a reworded thinking summary or not at all, while the model believes it was delivered. The guard is configurable and on by default, so it can be turned off once Anthropic or Pi changes this behavior.

## Context

- Root cause (verified 2026-11-07):
  - Anthropic documents progress-update thinking blocks: "a note ... written for the person watching the agent", returned as its own `thinking` block immediately before the `tool_use`; under `display: "summarized"` it is "not distinguishable from a reasoning block", and the full note is passed back to the model on the next request.
  - pi-ai sends `thinking: {type: "adaptive", display: options.thinkingDisplay ?? "summarized"}` and pi-coding-agent never sets `thinkingDisplay`.
- Evidence: session `~/.pi/agent/sessions/--Users-dgjalic-Documents-1-Projects-10-software-development-50-pi-extensions-audio-processing-noting-pipeline--/2026-11-06T17-40-36-485Z_01a1b1f2-b805-7028-8098-77f5e0133396.jsonl`, model `claude-opus-5-5`.
  - Lines 56, 94, 98: content is `thinking, thinking, toolCall(ask_user_question)` with no `text`. The second thinking block holds the intended reply.
  - Lines 29 and 82: `thinking, text, toolCall` with 3521 and 2723 text characters, delivered correctly.
  - The earlier occurrence is recorded in `wiki/issues/agent-explanation-only-in-thinking-before-ask-user-question.md`.
- Prior art: Claude Code #97504 uses a PreToolUse hook that refuses `AskUserQuestion` when no visible text was written; after a refusal the model writes the context as text, which "has always arrived". Claude Code #96288 shows that long pre-tool text goes into thinking. VS Code #342814 and t3code #18355 are the same client gap; t3code fixed it in PR #18364.
- Current source:
  - `packages/rpiv-ask-user-question/ask-user-question.ts` `registerAskUserQuestionTool` runs, in order: `normalizeQuestionParams`, the `ctx.hasUI` check, `validateQuestionnaire`, then the UI paths.
  - `config.ts` `loadConfig()` reads `~/.config/rpiv-ask-user-question/config.json` via `loadJsonConfigWithLegacyFallback` and has per-key resolvers (`resolveCollapseKey`, `resolveNotesKey`).
  - `tool/types.ts` defines `QuestionParamsSchema = Type.Object({ questions })` and the `QuestionnaireError` union.
  - Session entries are `{type: "message", message: {role, content}}`; assistant content blocks are `text`, `thinking`, and `toolCall` (with `id`).
  - Pi docs: `ctx.sessionManager.getBranch()` returns the current branch, synchronized through the current assistant message before tool hooks run.
- Prompt caching: the tool schema is part of the cached prompt prefix. It must stay identical regardless of config, so toggling the guard never invalidates the cache. Adding the parameter causes one cache miss only when a session first loads the new schema.

## Requirements

- R1 Guard: in `execute`, after `validateQuestionnaire` succeeds and before any questionnaire opens or prompt event is emitted, locate the assistant message in `ctx.sessionManager.getBranch()` whose `content` has a `toolCall` block with `id === toolCallId`. The call is refused when all of the following hold:
  - the guard is enabled;
  - the message is found;
  - the trimmed text of its `text` blocks, summed, is shorter than `minChars`;
  - the call is not excused by `selfContained` (R2).
- R2 Bypass parameter: `QuestionParamsSchema` gains an optional `selfContained: boolean` with a static description: set true only when you deliberately wrote no explanation before this call and every question is fully understandable on its own. When `selfContained === true` and `honorSelfContained` is true, the guard allows the call. The schema and its description never depend on config.
- R3 Refusal result:
  - Returned through the existing `buildToolResult(message, { answers: [], cancelled: true, error: "missing_visible_context" })`.
  - Add `"missing_visible_context"` to `QuestionnaireError`.
  - No UI is shown, no `rpiv:ask-user:prompt` or blocked event is emitted, and no answer channel is opened.
  - The message states that the user never saw the questions, that the call's message had no visible text so any explanation was not delivered (it may have been emitted as thinking), and that the model must write the context as visible text in its reply and call `ask_user_question` again.
  - The sentence about `selfContained: true` appears only when `honorSelfContained` is true.
- R4 Config: `AskUserQuestionConfig` gains `visibleContextGuard?: { enabled?: boolean; minChars?: number; honorSelfContained?: boolean }`. Defaults: `enabled: true`, `minChars: 1`, `honorSelfContained: true`. A resolver returns the effective values. A wrong type, or a `minChars` that is not an integer >= 1, falls back to the default for that key, silently, like the other keys. Config is read per call, so changes apply without a restart, like `collapseKey`.
- R5 Fail open: if `ctx.sessionManager` is absent, `getBranch` throws, or no matching message is found, the call proceeds unchanged.
- R6 Unchanged behavior: with the guard disabled, or with visible text present, every existing path (no UI, validation errors, TUI, RPC, external answers, envelopes) behaves exactly as today. `normalizeQuestionParams` and `prepareArguments` keep `selfContained` intact.
- R7 Docs: `docs/configuration.md` (settings table plus a `visibleContextGuard` section stating it is a fork workaround and how to turn it off) and `docs/tool-schema.md` (the `selfContained` parameter and the `missing_visible_context` error row). Update the README only if it lists config keys or parameters.
- R8 Wiki:
  - Update `wiki/issues/agent-explanation-only-in-thinking-before-ask-user-question.md`: status changes to workaround implemented; record the confirmed root cause with sources, the 2026-11-07 evidence, the config switch, and the revert condition (Anthropic stops emitting user-facing text as thinking, or Pi supports `display: "updates"` and renders progress updates as visible text).
  - Add the guard to "Fork customizations to preserve" in `wiki/workflows/upstream-sync.md`.
  - Update the entry in `wiki/index.md`.
  - Append a `wiki/log.md` entry.

- R9 Structural prompt rule (added 2026-11-07 after live tests): `DEFAULT_PROMPT_GUIDELINES` gains a fifth entry, `VISIBLE_CONTEXT_GUIDELINE`. It tells the model to send context longer than a few sentences as a reply without any tool call and to ask in the next turn. Short context may stay in the same reply. The docs count changes to 5 built-in guidelines, and the configuration doc and wiki describe the rule.

## Out of scope

- Changing Pi, pi-ai, or the thinking `display` mode (A3), filing upstream issues (A4), and any change to the installed copy under `~/.pi/agent/git/`.
- Guarding tools other than `ask_user_question`, and a Stop or continuation hook that re-asks automatically.
- Model-specific gating: the guard applies to every model, which is harmless for models that write text normally.
- `CHANGELOG.md` entries, version bumps, commits, and pushes.

## Design

```text
execute(toolCallId, params, ..., ctx)
  typed = normalizeQuestionParams(params)
  if !ctx.hasUI -> no_ui (unchanged)
  validation -> errors (unchanged)
  guard = resolveVisibleContextGuard(loadConfig())        // config.ts
  if checkVisibleContext(ctx, toolCallId, typed, guard) is "refuse"   // tool/visible-context-guard.ts
       -> buildToolResult(missingVisibleContextMessage(guard), {..., error: "missing_visible_context"})
  ...existing flow
```

- `tool/visible-context-guard.ts` holds pure functions:
  - `findCallingMessage(branch, toolCallId)`
  - `visibleTextLength(message)`
  - `shouldRefuse({ branch, toolCallId, selfContained, guard })`, returning a boolean
  - the message builder
- It reads `ctx.sessionManager` only through a small adapter in `execute` that fails open.

## Decision Log

| ID | Scope | Decision | Rationale | Evidence | Revisit when |
| --- | --- | --- | --- | --- | --- |
| G1 | rule | The calling message itself must contain visible text (not "any text since the last user message") | Catches all three lost explanations in the 2026-11-07 log and passes both good calls; short lead-ins earlier in the turn would let the #97504 rule miss line 56 | Session log lines 29, 36-56, 82, 94, 98 | False refusals become frequent |
| G2 | threshold | `minChars` default 1 | Every observed failure had zero text | Same log, 2026-10-25 wiki evidence | Slips with a short lead-in plus a lost explanation are observed |
| G3 | default | Guard on by default; `enabled: false` reverts | Workaround should work without config; easy revert | User decision | Anthropic or Pi changes the behavior |
| G4 | bypass | Optional `selfContained` flag, honored unless `honorSelfContained: false` | Saves a retry for self-contained questions; a model whose explanation slipped believes it wrote one, so it has no reason to set the flag; the config switch stops abuse | User decision | Models set the flag habitually |
| G5 | caching | Schema and description static, independent of config | Tool definitions lead the cached prefix; config toggles must not invalidate the cache | Anthropic prompt-cache prefix order | - |
| G6 | placement | Check after validation, before prompt events and UI | A refused call must not notify listeners or open an answer channel; validation errors stay first so the model fixes both in one retry | `ask-user-question.ts` execute order | - |
| G7 | guidance | Put the structural rule in the tool's default guidelines, not in the user's appended system prompt | It is coupled to the guard and reverts with it; it applies wherever the tool is active; `guidance.promptGuidelines` can override it. A static string, so it costs one cache miss when it first loads | Live tests: session lines 247 and 257 slipped and were refused, line 253 (short text) arrived; user decision | Guard reverted |

## Work breakdown

- [x] T01: Guard module, config, schema, and execute wiring (R1-R6)
  - Expected areas: `packages/rpiv-ask-user-question/tool/visible-context-guard.ts` (new), `config.ts`, `tool/types.ts`, `ask-user-question.ts`, and tests (`tool/visible-context-guard.test.ts` new, `config.test.ts`, `ask-user-question.execute.test.ts`).
  - Acceptance: unit tests prove each of the following:
    - refusal for `thinking, thinking, toolCall`;
    - allowed with a text block;
    - allowed with whitespace-only text only when `minChars` permits (whitespace never counts);
    - `selfContained` honored, and ignored when `honorSelfContained: false`;
    - disabled guard allows;
    - message not found, missing `sessionManager`, or a throwing `getBranch` all allow;
    - refusal opens no UI and emits no prompt event;
    - config fallbacks for wrong types and invalid `minChars`;
    - the refusal text omits the `selfContained` hint when it is not honored.
  - Verification: `npx vitest run packages/rpiv-ask-user-question`.
- [x] T02: Docs and wiki (R7, R8)
- [x] T03: Structural prompt guideline (R9)
  - Expected areas: `ask-user-question.ts`, `ask-user-question.guidance.test.ts`, `README.md`, `docs/configuration.md`, wiki issue page and upstream-sync.
  - Verification: `npx vitest run packages/rpiv-ask-user-question`, biome, tsc.
  - Depends on: T01
  - Expected areas: `packages/rpiv-ask-user-question/docs/configuration.md`, `docs/tool-schema.md`, README if applicable, `wiki/issues/...`, `wiki/workflows/upstream-sync.md`, `wiki/index.md`, `wiki/log.md`.
  - Acceptance: docs match the implemented keys, defaults, and error code; wiki states the workaround, the evidence, how to disable it, and the revert condition; links resolve.
  - Verification: re-read changed files, check relative links, `git diff --check`.

## Acceptance criteria

- With default config, a call whose message has no text block returns `error: "missing_visible_context"` and the instructive text, with no UI and no prompt event.
- The same call with a text block, with `selfContained: true` (honored), or with `visibleContextGuard.enabled: false` shows the questionnaire exactly as before.
- The tool schema is identical for every config value.
- Docs and wiki describe the workaround, the config, and the revert condition.

## Verification plan

- `npx vitest run packages/rpiv-ask-user-question`
- `npm test`
- `npm run check:ts-specifiers && npm run check:file-sizes && npm run check:decision-codes && npm run check:host-provided-deps` (decision codes like `(G1)` must not appear in any `.ts` file)
- `npx biome check --error-on-warnings .` and `npx tsc --noEmit -p tsconfig.base.json`
- `git diff --check`

## Risks and blockers

- False refusals for genuinely self-contained questions cost one retry. Mitigated by `selfContained`.
- Repeated slips can loop. The refusal text tells the model it may instead send the context as a reply without any tool call. Accepted for the low-assurance scope.
- An upstream sync may drop the fork change. Mitigated by the upstream-sync wiki entry.

## Progress

- [x] Planning complete and confirmed.
- [x] Implementation complete (T01, T02), uncommitted in the working tree.
- [x] Verification run; see [verification.md](./verification.md).

## Execution handoff

Use PI Agent in a fresh session with this prompt:

```text
Read spec/active/261107-1756-ask-user-question-visible-context-guard/plan.md and item.yaml completely, plus wiki/workflows/upstream-sync.md.
Implement T01 then T02 with low assurance, preserving Requirements, Out of scope, and the Decision Log.
Run the Verification plan and record only verified evidence in verification.md.
Do not touch ~/.pi/agent/git/, and stop before commits, pushes, dependency changes, or scope expansion.
```

## Proposed durable knowledge updates

- The wiki updates are part of T02 (R8).

# Issue: agent explanation only in thinking before ask_user_question

- Status: **Workaround implemented** (fork only) in spec item `261107-1756-ask-user-question-visible-context-guard`. Root cause confirmed on 2026-11-07.
- First noticed: 2026-10-25. Seen again: 2026-11-07.
- Component suspected by the agent both times: `packages/rpiv-ask-user-question` (the question box). It was wrong both times.
- Actual cause: model behavior (Claude 5.x progress updates) combined with Pi's thinking display mode. Details under Root cause.

## Symptom

The agent writes an explanation, findings, or links for the user and calls `ask_user_question` in the same reply. The user sees only the question box. The agent believes the explanation was delivered. When the user asks where it is, the agent blames the question box for hiding it, which is wrong.

## Root cause

- Anthropic documents "progress updates" on Claude Fable 5/5.1, Mythos 5.1, Opus 5.5, and Sonnet 5.5. A progress update is a note written for the person watching the agent. It comes back as its own `thinking` block, directly before the `tool_use` block it introduces. Source: [Anthropic thinking docs, progress updates](https://platform.claude.com/docs/en/build-with-claude/thinking#progress-updates).
- Under `display: "summarized"`, a progress update is only a summary and "not distinguishable from a reasoning block". The full note is passed back to the model on the next request, which is why the model is sure the user read it.
- Pi requests `display: "summarized"` and offers no setting for it. pi-ai sends `thinking: {type: "adaptive", display: options.thinkingDisplay ?? "summarized"}`, and pi-coding-agent never sets `thinkingDisplay` (checked in installed pi 1.5.0, `pi-ai/dist/api/anthropic-messages.js`).
- The plugin receives a normal tool call and does not hide any text.

## Evidence

- 2026-10-25: session `~/.pi/agent/sessions/--Users-dgjalic-Documents-1-Projects-12-devops-home-server-management--/2026-10-25T09-35-57-819Z_01a1726a-b37b-7561-9ce3-6671d5134477.jsonl` (`claude-opus-5-5`). Lines 129, 141, and 145 have thinking blocks followed by `ask_user_question` and no text block. Line 157 repeats the wrong "the box hides text" diagnosis.
- 2026-11-07: session `~/.pi/agent/sessions/--Users-dgjalic-Documents-1-Projects-10-software-development-50-pi-extensions-audio-processing-noting-pipeline--/2026-11-06T17-40-36-485Z_01a1b1f2-b805-7028-8098-77f5e0133396.jsonl` (`claude-opus-5-5`).
  - Lines 56, 94, and 98 are `thinking, thinking, toolCall(ask_user_question)`. Each second thinking block is a first-person summary of the intended reply, such as "Your answers are recorded in the dossier ... all linked above".
  - Lines 29 and 82 are `thinking, text, toolCall`, with 3521 and 2723 characters of text, and were delivered correctly.
- Other projects report the same problem:
  - [Claude Code #97504](https://github.com/anthropics/claude-code/issues/97504) (open). It found the shape in 8.5% of replies that contain a tool call, and reports that prompt instructions do not help because the model believes it wrote the text. Its workaround is a hook that refuses `AskUserQuestion` without visible text.
  - [Claude Code #96288](https://github.com/anthropics/claude-code/issues/96288): long pre-tool text is generated inside thinking, but is emitted when it is the last act of the turn.
  - [VS Code #342814](https://github.com/microsoft/vscode/issues/342814): `display: "summarized"` is hardcoded there too.
  - [t3code #18355](https://github.com/pingdotgg/t3code/issues/18355), fixed in PR #18364.

## Workaround in this fork

The `visibleContextGuard` in `packages/rpiv-ask-user-question` works as follows:

- `tool/visible-context-guard.ts`, wired into `execute` after validation in `ask-user-question.ts`, finds the assistant message holding the call in `ctx.sessionManager.getBranch()`.
- If that message has fewer than `minChars` characters of visible text, no questionnaire is shown. The model gets `error: "missing_visible_context"` and is told to write the context as visible text and call again.
- An optional `selfContained: true` parameter excuses calls where the model deliberately wrote no explanation.
- If the message is not found or the branch cannot be read, the call proceeds (fails open).
- Config lives in `~/.config/rpiv-ask-user-question/config.json`. Defaults: `{ "visibleContextGuard": { "enabled": true, "minChars": 1, "honorSelfContained": true } }`. Documented in `packages/rpiv-ask-user-question/docs/configuration.md`.
- A fifth default prompt guideline (`VISIBLE_CONTEXT_GUIDELINE` in `ask-user-question.ts`) tells the model to send context longer than a few sentences as a reply without any tool call, and to ask in the next turn. Live tests on 2026-11-07 showed why: a short text block before the call arrived (session line 253), while both long explanations slipped into thinking and were refused (lines 247 and 257).
- The tool schema does not depend on config, so toggling the guard never invalidates the prompt cache. Adding `selfContained` caused one cache miss per resumed session when the new schema first loaded.

## When to revert

Set `visibleContextGuard.enabled` to `false`, or remove the fork change, when either of these holds:

- Anthropic stops emitting user-facing text as thinking blocks before tool calls (watch Claude Code #97504).
- Pi supports `display: "updates"` (beta header `thinking-display-updates-2026-08-18`) and renders progress updates as visible text.

Remove `selfContained` from the schema and `VISIBLE_CONTEXT_GUIDELINE` from the default guidelines only together with the guard.

## Agent lesson

Before claiming that something was shown to the user, check the session JSONL for a `text` block. Never blame the UI without that check.

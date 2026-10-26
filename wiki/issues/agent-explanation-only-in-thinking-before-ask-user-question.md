# Noticed issue: agent explanation only in thinking before ask_user_question

- Status: **Informational only.** No fix is decided. The operator is monitoring agent behavior and will decide later whether a fix is needed.
- First noticed: 2026-10-25.
- Component suspected by the agent: `packages/rpiv-ask-user-question` (the question box).
- Component actually at fault: the model's output, not the plugin (see Analysis).

## Symptom

During a session, the agent said it had told the user something (file paths and line numbers), but the user never saw it. The user asked again twice. The agent then decided that the `ask_user_question` box was hiding its text. It dropped the question box and replied in plain text, which worked.

## Evidence

Session log: `~/.pi/agent/sessions/--Users-dgjalic-Documents-1-Projects-12-devops-home-server-management--/2026-10-25T09-35-57-819Z_01a1726a-b37b-7561-9ce3-6671d5134477.jsonl` (model `claude-opus-5-5`). Line numbers below are JSONL lines.

| Line | Assistant content blocks | Visible text to user |
| --- | --- | --- |
| 139 | thinking, text, `ask_user_question` | Yes. The user replied to this text at line 140, so the box did not hide it. |
| 141 | thinking, thinking, `ask_user_question` | No. The second thinking block reads like a reply ("I found both ... config files ... I've paused here awaiting your decision"). |
| 143 | thinking, short text, `bash` | One lead-in line only. The paths were only in the tool result. |
| 145 | thinking, thinking, `ask_user_question` | No. The thinking says "I've also given you SSH/dashboard paths", but no text block exists. |
| 147 | thinking, text (no question box) | Yes. Resolved the confusion. |

Other occurrences in the same session:

- Line 129: the blocker explanation exists only in thinking, followed directly by `ask_user_question`.
- Line 157: the agent reasons "since the box hides text", repeating its own wrong diagnosis.
- Across the session, 18 assistant turns are `thinking,toolCall` and 6 are `thinking,thinking,toolCall` with no text block. Not all of these needed user-facing text, but the pattern is most harmful before `ask_user_question`.

## Analysis

- Verified: thinking blocks carry provider signatures, so the provider returned them as thinking. Pi stored them faithfully, and the plugin received a normal tool call. Nothing indicates the plugin removed or hid text.
- Verified: the agent never checked which content blocks it had emitted before blaming the UI.
- Inference: the model sometimes writes its user-facing answer inside thinking and then goes straight to a tool call, believing it has answered. Going directly from reasoning to `ask_user_question` seems to make this more likely.
- Unverified: whether thinking summarization or display settings make this more frequent.
- The operator's prompt addendum already says "Put explanations in your visible reply, never only in thinking or inside a question". The model did not follow it in these turns.

## Fix options (not decided)

- Prompt rule: before calling `ask_user_question`, the same message must contain a text block with every fact the user needs. Never claim something was said unless it is in a text block.
- Plugin guard in `packages/rpiv-ask-user-question`: warn or return an error when the current assistant message has thinking and an `ask_user_question` call but no text block. Needs review: whether the extension API exposes the in-progress assistant message.
- Prompt rule: tool output may be collapsed in the UI, so restate key results (paths, values) in visible text.

## Monitoring notes

When this recurs, record the session file, JSONL line numbers, model, and whether `ask_user_question` was involved. That evidence will show whether a fix is worth it.

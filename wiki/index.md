# Wiki Index

Start here. Maintenance rules live in [AGENTS.md](AGENTS.md).

## Workflows

- [workflows/upstream-sync.md](workflows/upstream-sync.md): how to merge an upstream rpiv-mono release into this fork. Covers the fork customizations to keep, the conflict strategy, and the verification checks.

## Noticed issues

Informational records the operator is monitoring. No fix is decided.

- [issues/agent-explanation-only-in-thinking-before-ask-user-question.md](issues/agent-explanation-only-in-thinking-before-ask-user-question.md): the agent put its answer only in thinking before calling `ask_user_question`, then wrongly blamed the question box for hiding it.

## Dream history

- Episode catalog: [dreams/episodes.jsonl](dreams/episodes.jsonl). It holds one metadata line per immutable session log in `wiki/dreams/`. Load a narrative only when you need to recall that session.
- Per-spec checkpoint ledgers: `wiki/dreams/by-spec/<item-id>.md`. Each is an append-only history of Gamemaster checkpoints for one spec item. It is historical, not current guidance.
- Workflow retrospectives: `wiki/dreams/retrospectives/<item-id>.md`. Each is append-only evidence about the planning and lifecycle workflow for one spec item.

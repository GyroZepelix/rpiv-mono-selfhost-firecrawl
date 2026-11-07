/**
 * Visible-context guard (fork workaround). Claude 5.x models sometimes emit the
 * explanation they meant for the user as a "progress update" `thinking` block
 * right before a tool call instead of a `text` block. Under Pi's
 * `display: "summarized"` thinking mode that explanation never reaches the user
 * as text, yet the model believes it was delivered. The guard refuses an
 * `ask_user_question` call whose own assistant message carries no visible text,
 * so the model rewrites the context as text and calls again.
 *
 * Pure functions over session branch entries; the caller reads the branch and
 * fails open when it cannot. See wiki/issues/agent-explanation-only-in-thinking-before-ask-user-question.md.
 */

export interface VisibleContextGuardSettings {
	enabled: boolean;
	/** Minimum summed length of the trimmed text blocks in the calling message. */
	minChars: number;
}

type ContentBlock = { type?: unknown; text?: unknown; id?: unknown };
type AssistantMessage = { role: "assistant"; content: ContentBlock[] };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function asAssistantMessage(entry: unknown): AssistantMessage | undefined {
	if (!isRecord(entry) || entry.type !== "message") return undefined;
	const message = entry.message;
	if (!isRecord(message) || message.role !== "assistant" || !Array.isArray(message.content)) return undefined;
	return message as AssistantMessage;
}

/** The assistant message whose content holds the `toolCall` block with this id, newest first. */
export function findCallingMessage(branch: readonly unknown[], toolCallId: string): AssistantMessage | undefined {
	for (let i = branch.length - 1; i >= 0; i--) {
		const message = asAssistantMessage(branch[i]);
		if (!message) continue;
		if (message.content.some((b) => isRecord(b) && b.type === "toolCall" && b.id === toolCallId)) return message;
	}
	return undefined;
}

/** Summed length of the trimmed `text` blocks; whitespace-only text counts as zero. */
export function visibleTextLength(message: AssistantMessage): number {
	let total = 0;
	for (const block of message.content) {
		if (isRecord(block) && block.type === "text" && typeof block.text === "string") total += block.text.trim().length;
	}
	return total;
}

export interface GuardInput {
	branch: readonly unknown[];
	toolCallId: string;
	settings: VisibleContextGuardSettings;
}

/** True when the call must be refused. A calling message that cannot be found never refuses. */
export function shouldRefuse({ branch, toolCallId, settings }: GuardInput): boolean {
	if (!settings.enabled) return false;
	const message = findCallingMessage(branch, toolCallId);
	if (!message) return false;
	return visibleTextLength(message) < settings.minChars;
}

/** Model-facing refusal text. */
export function missingVisibleContextMessage(): string {
	return [
		"Error: the questions were NOT shown to the user. The assistant message that called ask_user_question contains no visible text, so any explanation, findings, or recommendations you meant to give the user were not delivered (they were likely emitted as a thinking block, which the user does not see as your reply).",
		"Write the context the user needs (findings, explanation, your recommendation) as visible text in your reply, then call ask_user_question again in that same reply. If this keeps happening, send the context as a reply without any tool call and ask the questions after the user responds.",
	].join("\n");
}

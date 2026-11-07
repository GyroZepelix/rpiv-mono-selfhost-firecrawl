import { describe, expect, it } from "vitest";
import {
	findCallingMessage,
	missingVisibleContextMessage,
	shouldRefuse,
	type VisibleContextGuardSettings,
	visibleTextLength,
} from "./visible-context-guard.ts";

const ON: VisibleContextGuardSettings = { enabled: true, minChars: 1, honorSelfContained: true };

function assistant(content: unknown[]) {
	return { type: "message", id: "e", message: { role: "assistant", content } };
}
const thinking = (text = "I summarised the options above.") => ({ type: "thinking", thinking: text });
const call = (id = "tc") => ({ type: "toolCall", id, name: "ask_user_question", arguments: {} });
const text = (t: string) => ({ type: "text", text: t });

describe("findCallingMessage", () => {
	it("finds the assistant message holding the tool call id", () => {
		const target = assistant([thinking(), call("tc")]);
		const branch = [
			assistant([text("earlier"), call("other")]),
			{ type: "message", message: { role: "user" } },
			target,
		];
		expect(findCallingMessage(branch, "tc")).toBe(target.message);
	});

	it("returns undefined when no message holds the id or entries are malformed", () => {
		expect(findCallingMessage([assistant([call("x")]), null, 3, { type: "custom" }], "tc")).toBeUndefined();
		expect(findCallingMessage([], "tc")).toBeUndefined();
	});
});

describe("visibleTextLength", () => {
	it("sums trimmed text blocks and ignores thinking and whitespace", () => {
		const m = findCallingMessage([assistant([thinking(), text("  ab "), text("\n\n"), text("c"), call()])], "tc");
		expect(m && visibleTextLength(m)).toBe(3);
	});
});

describe("shouldRefuse", () => {
	const slipped = [assistant([thinking(), thinking(), call()])];
	const explained = [assistant([thinking(), text("Here is what I found."), call()])];

	it("refuses a thinking-only message (the observed failure shape)", () => {
		expect(shouldRefuse({ branch: slipped, toolCallId: "tc", selfContained: undefined, settings: ON })).toBe(true);
	});

	it("allows a message with visible text", () => {
		expect(shouldRefuse({ branch: explained, toolCallId: "tc", selfContained: undefined, settings: ON })).toBe(false);
	});

	it("refuses whitespace-only text and honors a higher minChars", () => {
		const blank = [assistant([text("   "), call()])];
		expect(shouldRefuse({ branch: blank, toolCallId: "tc", selfContained: undefined, settings: ON })).toBe(true);
		const short = [assistant([text("Ok."), call()])];
		const strict = { ...ON, minChars: 10 };
		expect(shouldRefuse({ branch: short, toolCallId: "tc", selfContained: undefined, settings: strict })).toBe(true);
	});

	it("honors selfContained only when configured to", () => {
		expect(shouldRefuse({ branch: slipped, toolCallId: "tc", selfContained: true, settings: ON })).toBe(false);
		const ignore = { ...ON, honorSelfContained: false };
		expect(shouldRefuse({ branch: slipped, toolCallId: "tc", selfContained: true, settings: ignore })).toBe(true);
		expect(shouldRefuse({ branch: slipped, toolCallId: "tc", selfContained: false, settings: ON })).toBe(true);
	});

	it("never refuses when disabled or when the calling message is not found", () => {
		const off = { ...ON, enabled: false };
		expect(shouldRefuse({ branch: slipped, toolCallId: "tc", selfContained: undefined, settings: off })).toBe(false);
		expect(shouldRefuse({ branch: slipped, toolCallId: "missing", selfContained: undefined, settings: ON })).toBe(
			false,
		);
	});
});

describe("missingVisibleContextMessage", () => {
	it("tells the model the questions were not shown and to write visible text", () => {
		const msg = missingVisibleContextMessage(ON);
		expect(msg).toContain("NOT shown");
		expect(msg).toContain("visible text");
		expect(msg).toContain("selfContained: true");
	});

	it("omits the selfContained hint when the flag is not honored", () => {
		expect(missingVisibleContextMessage({ honorSelfContained: false })).not.toContain("selfContained");
	});
});

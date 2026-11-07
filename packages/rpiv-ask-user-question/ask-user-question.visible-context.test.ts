import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createMockCtx, createMockPi } from "@juicesharp/rpiv-test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerAskUserQuestionTool } from "./ask-user-question.ts";
import { QuestionParamsSchema } from "./tool/types.ts";

// Same test-HOME config location config.test.ts uses (resolved by setup.ts).
const configDir = join(process.env.HOME ?? "", ".config", "rpiv-ask-user-question");
const configPath = join(configDir, "config.json");
function writeConfig(value: unknown): void {
	mkdirSync(configDir, { recursive: true });
	writeFileSync(configPath, JSON.stringify(value));
}

const PARAMS = { questions: [{ question: "Which?", header: "Pick", options: [{ label: "A" }, { label: "B" }] }] };

function assistant(content: unknown[]) {
	return { type: "message", id: "a1", parentId: null, timestamp: "t", message: { role: "assistant", content } };
}
const SLIPPED = [assistant([{ type: "thinking", thinking: "x" }, { type: "thinking", thinking: "y" }, call()])];
const EXPLAINED = [assistant([{ type: "text", text: "Findings: ..." }, call()])];
function call() {
	return { type: "toolCall", id: "tc", name: "ask_user_question", arguments: PARAMS };
}

function setup(branch: unknown[], getBranch?: () => unknown[]) {
	const emit = vi.fn();
	const { pi, captured } = createMockPi({ events: { emit, on: vi.fn(() => () => {}) } });
	registerAskUserQuestionTool(pi);
	const tool = captured.tools.get("ask_user_question")!;
	const custom = vi.fn(async () => ({ answers: [], cancelled: true }));
	const ctx = createMockCtx({ hasUI: true, branch: branch as never, ui: { custom } as never });
	if (getBranch) (ctx.sessionManager as unknown as { getBranch: () => unknown[] }).getBranch = getBranch;
	const run = (params: unknown = PARAMS) =>
		tool.execute?.("tc", params as never, undefined as never, undefined as never, ctx as never);
	return { run, custom, emit };
}

afterEach(() => {
	if (existsSync(configPath)) rmSync(configPath);
});

describe("ask_user_question visible-context guard", () => {
	it("refuses a call whose message has no visible text: no UI, no prompt event", async () => {
		const { run, custom, emit } = setup(SLIPPED);
		const r = await run();
		expect(r?.details).toMatchObject({ answers: [], cancelled: true, error: "missing_visible_context" });
		expect(r?.content[0]).toMatchObject({ text: expect.stringContaining("NOT shown") });
		expect(custom).not.toHaveBeenCalled();
		expect(emit).not.toHaveBeenCalled();
	});

	it("shows the questionnaire when the message has visible text", async () => {
		const { run, custom } = setup(EXPLAINED);
		await run();
		expect(custom).toHaveBeenCalled();
	});

	it("allows selfContained: true by default and refuses it when honorSelfContained is false", async () => {
		const allowed = setup(SLIPPED);
		await allowed.run({ ...PARAMS, selfContained: true });
		expect(allowed.custom).toHaveBeenCalled();

		writeConfig({ visibleContextGuard: { honorSelfContained: false } });
		const refused = setup(SLIPPED);
		const r = await refused.run({ ...PARAMS, selfContained: true });
		expect(r?.details).toMatchObject({ error: "missing_visible_context" });
		expect(r?.content[0]).not.toMatchObject({ text: expect.stringContaining("selfContained") });
	});

	it("is off when visibleContextGuard.enabled is false", async () => {
		writeConfig({ visibleContextGuard: { enabled: false } });
		const { run, custom } = setup(SLIPPED);
		await run();
		expect(custom).toHaveBeenCalled();
	});

	it("fails open when the calling message is not found or the branch cannot be read", async () => {
		const missing = setup([]);
		await missing.run();
		expect(missing.custom).toHaveBeenCalled();

		const throwing = setup([], () => {
			throw new Error("boom");
		});
		await throwing.run();
		expect(throwing.custom).toHaveBeenCalled();
	});

	it("keeps the tool schema independent of config (selfContained is always declared)", () => {
		expect(Object.keys(QuestionParamsSchema.properties)).toEqual(["questions", "selfContained"]);
	});
});

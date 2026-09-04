import { describe, expect, it } from "vitest";
import { type ArtifactHandle, fs } from "../../handle.js";
import type { BranchEntry } from "../../transcript.js";
import { textScanCollector } from "./text-scan.js";

const asst = (text: string): BranchEntry => ({
	type: "message",
	message: { role: "assistant", content: [{ type: "text", text }] },
});

const asstTool = (parts: unknown[]): BranchEntry =>
	({ type: "message", message: { role: "assistant", content: parts } }) as BranchEntry;

const ctxOf = (branch: BranchEntry[], skill = "build") => ({
	cwd: "/tmp",
	runId: "test",
	stageIndex: 0,
	state: {} as never,
	branch,
	branchOffset: undefined,
	snapshot: undefined,
	skill,
});

describe("textScanCollector", () => {
	it("emits a single primary artifact via toHandle on match", async () => {
		const c = textScanCollector({ pattern: /outputs\/[\w.-]+\.md/g, toHandle: fs, noun: "path" });
		expect(await c.collect(ctxOf([asst("done — see outputs/run-1.md for the result")]) as never)).toEqual({
			kind: "ok",
			artifacts: [{ handle: { kind: "fs", path: "outputs/run-1.md" }, role: "primary" }],
		});
	});

	it("is fatal with the noun-templated message on miss", async () => {
		const c = textScanCollector({ pattern: /outputs\/[\w.-]+\.md/g, toHandle: fs, noun: "path" });
		const result = await c.collect(ctxOf([asst("nothing here")]) as never);
		expect(result.kind).toBe("fatal");
		expect((result as { message: string }).message).toMatch(/build finished without producing a path matching/);
	});

	it("honours a custom toHandle (url)", async () => {
		const url = (href: string): ArtifactHandle => ({ kind: "url", href });
		const c = textScanCollector({ pattern: /https:\/\/[\w.]+/g, toHandle: url, noun: "URL" });
		expect(await c.collect(ctxOf([asst("deployed at https://example.com")]) as never)).toEqual({
			kind: "ok",
			artifacts: [{ handle: { kind: "url", href: "https://example.com" }, role: "primary" }],
		});
	});

	it("an assistant-text hit still wins when tool arguments also match (text-present path unchanged)", async () => {
		const branch = [
			asstTool([
				{ type: "tool_use", name: "write", input: { path: "outputs/from-tool.md" } },
				{ type: "text", text: "wrote outputs/from-text.md" },
			]),
		];
		const c = textScanCollector({ pattern: /outputs\/[\w.-]+\.md/g, toHandle: fs, noun: "path" });
		expect(await c.collect(ctxOf(branch) as never)).toEqual({
			kind: "ok",
			artifacts: [{ handle: { kind: "fs", path: "outputs/from-text.md" }, role: "primary" }],
		});
	});

	it("a tool-argument-only hit (a write-shaped use whose input value matches) collects through the same handle constructor", async () => {
		const branch = [asstTool([{ type: "tool_use", name: "write", input: { path: "outputs/only-in-tool.md" } }])];
		const c = textScanCollector({ pattern: /outputs\/[\w.-]+\.md/g, toHandle: fs, noun: "path" });
		expect(await c.collect(ctxOf(branch) as never)).toEqual({
			kind: "ok",
			artifacts: [{ handle: { kind: "fs", path: "outputs/only-in-tool.md" }, role: "primary" }],
		});
	});

	it("the fatal names BOTH scanned surfaces when neither hits", async () => {
		const branch = [asstTool([{ type: "tool_use", name: "write", input: { path: "elsewhere/x.txt" } }])];
		const c = textScanCollector({ pattern: /outputs\/[\w.-]+\.md/g, toHandle: fs, noun: "path" });
		const result = await c.collect(ctxOf(branch) as never);
		expect(result.kind).toBe("fatal");
		expect((result as { message: string }).message).toMatch(/scanned assistant text and tool-call arguments/);
	});
});

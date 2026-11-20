// Fork: orchestrator behavior around the Anthropic provider — answer
// rendering, the once-only search fallback, fetch-provider selection, the
// per-call provider enum, and /web-tools.

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { configPath } from "@juicesharp/rpiv-config";
import { createMockCtx, createMockPi, stubFetch } from "@juicesharp/rpiv-test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import registerWebTools from "./index.ts";

const CONFIG_PATH = configPath("rpiv-web-tools");
const MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const BRAVE_URL = "api.search.brave.com";

const ENV_VARS = [
	"ANTHROPIC_API_KEY",
	"BRAVE_SEARCH_API_KEY",
	"TAVILY_API_KEY",
	"FIRECRAWL_API_KEY",
	"FIRECRAWL_API_URL",
	"WEB_SEARCH_PROVIDER",
];

beforeEach(() => {
	for (const name of ENV_VARS) delete process.env[name];
	rmSync(CONFIG_PATH, { force: true });
});

function writeConfig(contents: unknown) {
	mkdirSync(dirname(CONFIG_PATH), { recursive: true });
	writeFileSync(CONFIG_PATH, JSON.stringify(contents), "utf-8");
}

function register() {
	const { pi, captured } = createMockPi();
	registerWebTools(pi);
	return captured;
}

type Captured = ReturnType<typeof register>;
type ToolResult = { content: Array<{ type: string; text: string }>; details: Record<string, unknown> };

async function runSearch(
	captured: Captured,
	params: Record<string, unknown>,
	ctx: unknown = createMockCtx(),
	signal?: AbortSignal,
): Promise<ToolResult> {
	const tool = captured.tools.get("web_search");
	return (await tool?.execute?.(
		"tc",
		params as never,
		signal as never,
		undefined as never,
		ctx as never,
	)) as unknown as ToolResult;
}

async function runFetch(captured: Captured, url: string): Promise<ToolResult> {
	const tool = captured.tools.get("web_fetch");
	return (await tool?.execute?.(
		"tc",
		{ url } as never,
		undefined as never,
		undefined as never,
		createMockCtx(),
	)) as unknown as ToolResult;
}

function providerEnum(captured: Captured): string[] {
	const params = captured.tools.get("web_search")?.parameters as unknown as {
		properties: { provider: { anyOf: Array<{ const: string }> } };
	};
	return params.properties.provider.anyOf.map((e) => e.const);
}

const anthropicBody = {
	stop_reason: "end_turn",
	content: [
		{
			type: "web_search_tool_result",
			content: [
				{ type: "web_search_result", url: "https://a.example/one", title: "One" },
				{ type: "web_search_result", url: "https://b.example/two", title: "Two" },
			],
		},
		{
			type: "text",
			text: "Two says hello.",
			citations: [{ url: "https://b.example/two", cited_text: "Two says hello." }],
		},
	],
};

const braveBody = { web: { results: [{ title: "Brave hit", url: "https://brave.example", description: "brave ok" }] } };

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), { status });
}

describe("web_search — Anthropic answer rendering", () => {
	it("shows Claude's answer above the result list and records it in details", async () => {
		writeConfig({ provider: "anthropic", apiKeys: { anthropic: "sk-ant-api03-k" } });
		stubFetch([{ match: (u) => u === MESSAGES_URL, response: () => json(anthropicBody) }]);
		const result = await runSearch(register(), { query: "pi release" });
		const text = result.content[0].text;
		expect(text).toMatch(/^\*\*Search results for "pi release":\*\*\n\n\*\*Answer:\*\*\nTwo says hello\.\n\n1\. /);
		expect(text.indexOf("Two says hello.")).toBeLessThan(text.indexOf("https://b.example/two"));
		expect(result.details).toMatchObject({
			backend: "anthropic",
			resultCount: 2,
			answer: "Two says hello.",
		});
		expect(result.details.fallbackFrom).toBeUndefined();
	});

	it("passes the tool ctx's model registry to the provider (login path, no direct fetch)", async () => {
		writeConfig({ provider: "anthropic" });
		const fetchStub = stubFetch([]);
		const streamSimple = vi.fn((_model: unknown, _context: unknown, options: Record<string, never>) => ({
			result: async () => {
				const onEvent = options.onProviderStreamEvent as (e: unknown) => void;
				onEvent({ type: "content_block_start", index: 0, content_block: { type: "text", text: "Hi." } });
				return { role: "assistant", stopReason: "stop", content: [{ type: "text", text: "Hi." }] };
			},
		}));
		const ctx = {
			...createMockCtx(),
			modelRegistry: {
				find: (provider: string, id: string) => (provider === "anthropic" ? { provider, id } : undefined),
				getApiKeyAndHeaders: async () => ({ ok: true, apiKey: "sk-ant-oat01-login" }),
				streamSimple,
			},
		};
		const result = await runSearch(register(), { query: "q" }, ctx);
		expect(streamSimple).toHaveBeenCalledTimes(1);
		expect(fetchStub.calls).toEqual([]);
		// An answer without sources is a result, not the empty envelope.
		expect(result.content[0].text).toContain("**Answer:**\nHi.");
		expect(result.details).toMatchObject({ backend: "anthropic", resultCount: 0, answer: "Hi." });
	});

	it("returns the empty envelope when Anthropic finds nothing and has no answer", async () => {
		writeConfig({ provider: "anthropic", apiKeys: { anthropic: "sk-ant-api03-k" }, fallbackProvider: "brave" });
		process.env.BRAVE_SEARCH_API_KEY = "brave-key";
		const stub = stubFetch([
			{ match: (u) => u === MESSAGES_URL, response: () => json({ stop_reason: "end_turn", content: [] }) },
		]);
		const result = await runSearch(register(), { query: "nothing" });
		expect(result.content[0].text).toBe('No results found for "nothing".');
		expect(result.details).toEqual({ query: "nothing", backend: "anthropic", resultCount: 0 });
		// Zero results never trigger the fallback.
		expect(stub.calls.map((c) => c.url)).toEqual([MESSAGES_URL]);
	});
});

describe("web_search — fallback provider", () => {
	it("serves a failing default from the fallback once, with a visible note", async () => {
		writeConfig({ provider: "anthropic", fallbackProvider: "brave", apiKeys: { brave: "brave-key" } });
		const stub = stubFetch([{ match: (u) => u.includes(BRAVE_URL), response: () => json(braveBody) }]);
		const result = await runSearch(register(), { query: "q" });
		expect(stub.calls).toHaveLength(1);
		const text = result.content[0].text;
		expect(text).toMatch(
			/^Note: anthropic search failed \(Anthropic search needs Pi's Anthropic login or an API key\..*\); results are from fallback provider brave\.\n\n\*\*Search results/,
		);
		expect(text).toContain("Brave hit");
		expect(result.details).toMatchObject({ backend: "brave", fallbackFrom: "anthropic", resultCount: 1 });
	});

	it("keeps the note on an empty fallback result", async () => {
		writeConfig({ provider: "anthropic", fallbackProvider: "brave", apiKeys: { brave: "brave-key" } });
		stubFetch([{ match: (u) => u.includes(BRAVE_URL), response: () => json({ web: { results: [] } }) }]);
		const result = await runSearch(register(), { query: "q" });
		expect(result.content[0].text).toMatch(/^Note: anthropic search failed .*\n\nNo results found for "q"\.$/s);
		expect(result.details).toEqual({ query: "q", backend: "brave", resultCount: 0, fallbackFrom: "anthropic" });
	});

	it("reports both errors when the fallback also fails", async () => {
		writeConfig({ provider: "anthropic", fallbackProvider: "brave" });
		stubFetch([]);
		await expect(runSearch(register(), { query: "q" })).rejects.toThrow(
			/^anthropic search failed: Anthropic search needs .*; fallback brave also failed: BRAVE_SEARCH_API_KEY is not set/,
		);
	});

	it("does not fall back for a per-call provider override", async () => {
		writeConfig({
			provider: "tavily",
			fallbackProvider: "brave",
			apiKeys: { brave: "brave-key", anthropic: "sk-ant-api03-k" },
		});
		const stub = stubFetch([
			{ match: (u) => u === MESSAGES_URL, response: () => json({ error: "boom" }, 500) },
			{ match: (u) => u.includes(BRAVE_URL), response: () => json(braveBody) },
		]);
		await expect(runSearch(register(), { query: "q", provider: "anthropic" })).rejects.toThrow(
			/^Anthropic API error 500/,
		);
		expect(stub.calls.map((c) => c.url)).toEqual([MESSAGES_URL]);
	});

	it("does not fall back after an abort", async () => {
		writeConfig({ provider: "anthropic", fallbackProvider: "brave", apiKeys: { brave: "brave-key" } });
		const stub = stubFetch([{ match: (u) => u.includes(BRAVE_URL), response: () => json(braveBody) }]);
		const controller = new AbortController();
		controller.abort();
		await expect(runSearch(register(), { query: "q" }, createMockCtx(), controller.signal)).rejects.toThrow(
			/Anthropic search needs/,
		);
		expect(stub.calls).toEqual([]);
	});

	it("ignores a fallback equal to the default and an unset fallback", async () => {
		writeConfig({ provider: "anthropic", fallbackProvider: " anthropic " });
		stubFetch([]);
		await expect(runSearch(register(), { query: "q" })).rejects.toThrow(/^Anthropic search needs/);
		writeConfig({ provider: "anthropic" });
		await expect(runSearch(register(), { query: "q" })).rejects.toThrow(/^Anthropic search needs/);
	});

	it("throws the uniform unknown-provider error for an unknown fallback only when it is needed", async () => {
		writeConfig({ provider: "brave", fallbackProvider: "bogus", apiKeys: { brave: "brave-key" } });
		stubFetch([{ match: (u) => u.includes(BRAVE_URL), response: () => json(braveBody) }]);
		const ok = await runSearch(register(), { query: "q" });
		expect(ok.details.backend).toBe("brave");

		writeConfig({ provider: "anthropic", fallbackProvider: "bogus" });
		await expect(runSearch(register(), { query: "q" })).rejects.toThrow(/Unknown web_search provider: "bogus"/);
	});
});

describe("web_fetch — fetchProvider selection", () => {
	const firecrawlScrape = {
		match: (u: string) => u === "http://firecrawl.local/v1/scrape",
		response: () => json({ success: true, data: { markdown: "scraped", metadata: { title: "T" } } }),
	};

	it("uses fetchProvider's native fetch while Anthropic is the search provider", async () => {
		writeConfig({
			provider: "anthropic",
			fetchProvider: "firecrawl",
			baseUrls: { firecrawl: "http://firecrawl.local/v1" },
		});
		const stub = stubFetch([firecrawlScrape]);
		const result = await runFetch(register(), "https://example.com/page");
		expect(stub.calls.map((c) => c.url)).toEqual(["http://firecrawl.local/v1/scrape"]);
		expect(result.content[0].text).toContain("scraped");
	});

	it("keeps today's behavior when fetchProvider is unset (search-only active → generic HTML)", async () => {
		writeConfig({ provider: "anthropic", baseUrls: { firecrawl: "http://firecrawl.local/v1" } });
		const stub = stubFetch([
			{
				match: (u) => u === "https://example.com/page",
				response: () =>
					new Response("<html><title>Page</title><body>generic</body></html>", {
						status: 200,
						headers: { "content-type": "text/html" },
					}),
			},
		]);
		const result = await runFetch(register(), "https://example.com/page");
		expect(stub.calls.map((c) => c.url)).toEqual(["https://example.com/page"]);
		expect(result.content[0].text).toContain("generic");
	});

	it("rejects an unknown fetchProvider with the uniform error", async () => {
		writeConfig({ provider: "firecrawl", fetchProvider: "bogus" });
		stubFetch([]);
		await expect(runFetch(register(), "https://example.com/page")).rejects.toThrow(
			/Unknown web_search provider: "bogus"/,
		);
	});
});

describe("web_search provider enum — Anthropic visibility", () => {
	it("is hidden without selection or key", () => {
		writeConfig({ provider: "brave", apiKeys: { brave: "k" } });
		expect(providerEnum(register())).toEqual(["brave"]);
	});

	it("is listed when active, when the configured fallback, or when a key resolves", () => {
		writeConfig({ provider: "anthropic" });
		expect(providerEnum(register())).toEqual(["anthropic"]);

		writeConfig({ provider: "brave", apiKeys: { brave: "k" }, fallbackProvider: "anthropic" });
		expect(providerEnum(register())).toEqual(["brave", "anthropic"]);

		writeConfig({ provider: "brave", apiKeys: { brave: "k" } });
		process.env.ANTHROPIC_API_KEY = "sk-ant-api03-env";
		expect(providerEnum(register())).toEqual(["brave", "anthropic"]);
	});
});

describe("/web-tools — Anthropic", () => {
	it("--show displays fallback, fetch provider, and the Anthropic model setting", async () => {
		const captured = register();
		const ctx = createMockCtx({ hasUI: true });
		await captured.commands.get("web-tools")?.handler("--show", ctx as never);
		let msg = (ctx.ui.notify as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
		expect(msg).toContain("  fallback provider: (not set)");
		expect(msg).toContain("  fetch provider: (not set) (uses active provider)");
		expect(msg).toContain("  anthropic model: claude-haiku-5-5, then claude-sonnet-5-5 (source: default)");
		expect(msg).toContain("  anthropic: (not set)");

		writeConfig({
			provider: "anthropic",
			fallbackProvider: "firecrawl",
			fetchProvider: "firecrawl",
			anthropic: { model: "claude-sonnet-5-5" },
		});
		await captured.commands.get("web-tools")?.handler("--show", ctx as never);
		msg = (ctx.ui.notify as ReturnType<typeof vi.fn>).mock.calls[1][0] as string;
		expect(msg).toContain("  active provider: anthropic (source: config)");
		expect(msg).toContain("  fallback provider: firecrawl");
		expect(msg).toContain("  fetch provider: firecrawl");
		expect(msg).toContain("  anthropic model: claude-sonnet-5-5 (source: config)");
	});

	it("Enter at the optional key prompt selects Anthropic without storing a key", async () => {
		writeConfig({ provider: "firecrawl", otherField: "keep" });
		const captured = register();
		const ctx = createMockCtx({ hasUI: true });
		(ctx.ui.select as ReturnType<typeof vi.fn>).mockResolvedValueOnce("Anthropic");
		(ctx.ui.input as ReturnType<typeof vi.fn>).mockResolvedValueOnce("");
		await captured.commands.get("web-tools")?.handler("", ctx as never);
		const saved = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
		expect(saved).toEqual({ provider: "anthropic", otherField: "keep" });
		// The re-registered schema now offers anthropic.
		expect(providerEnum(captured)).toContain("anthropic");
	});

	it("a typed key is saved, and Enter later keeps it", async () => {
		const captured = register();
		const ctx = createMockCtx({ hasUI: true });
		(ctx.ui.select as ReturnType<typeof vi.fn>).mockResolvedValueOnce("Anthropic").mockResolvedValueOnce("Anthropic");
		(ctx.ui.input as ReturnType<typeof vi.fn>).mockResolvedValueOnce("sk-ant-api03-typed").mockResolvedValueOnce("");
		await captured.commands.get("web-tools")?.handler("", ctx as never);
		await captured.commands.get("web-tools")?.handler("", ctx as never);
		const saved = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
		expect(saved).toEqual({ provider: "anthropic", apiKeys: { anthropic: "sk-ant-api03-typed" } });
	});
});

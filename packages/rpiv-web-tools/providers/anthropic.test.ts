import { stubFetch } from "@juicesharp/rpiv-test-utils";
import { describe, expect, it, vi } from "vitest";
import {
	ANTHROPIC_PROVIDER_META,
	AnthropicProvider,
	configureAnthropic,
	parseAnthropicSearchMessage,
	resolveAnthropicMaxUses,
} from "./anthropic.ts";
import { createSearchProvider } from "./factory.ts";
import type { SearchContext } from "./types.ts";

const MESSAGES_URL = "https://api.anthropic.com/v1/messages";

// Raw Anthropic SSE events as Pi's transport hands them to
// onProviderStreamEvent: a preamble, one search, the search results, and a
// cited answer split into adjacent text blocks.
const searchEvents: unknown[] = [
	{ type: "message_start", message: { id: "msg_1", model: "claude-haiku-5-5", usage: { input_tokens: 10 } } },
	{ type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
	{ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "I'll search." } },
	{ type: "content_block_stop", index: 0 },
	{
		type: "content_block_start",
		index: 1,
		content_block: { type: "server_tool_use", id: "srv_1", name: "web_search", input: {} },
	},
	{
		type: "content_block_delta",
		index: 1,
		delta: { type: "input_json_delta", partial_json: '{"query": "pi release"}' },
	},
	{ type: "content_block_stop", index: 1 },
	{
		type: "content_block_start",
		index: 2,
		content_block: {
			type: "web_search_tool_result",
			tool_use_id: "srv_1",
			content: [
				{ type: "web_search_result", url: "https://a.example/one", title: "One", page_age: "2 days ago" },
				{ type: "web_search_result", url: "https://b.example/two", title: "Two", encrypted_content: "enc-2" },
				{ type: "web_search_result", url: "https://c.example/three", title: "Three" },
				{ type: "web_search_result", url: "https://a.example/one", title: "Duplicate" },
			],
		},
	},
	{ type: "content_block_stop", index: 2 },
	{ type: "content_block_start", index: 3, content_block: { type: "text", text: "", citations: [] } },
	{
		type: "content_block_delta",
		index: 3,
		delta: {
			type: "citations_delta",
			citation: {
				type: "web_search_result_location",
				url: "https://b.example/two",
				title: "Two (cited)",
				cited_text: "Two  says\nhello.",
			},
		},
	},
	{ type: "content_block_delta", index: 3, delta: { type: "text_delta", text: "Two says hello." } },
	{ type: "content_block_stop", index: 3 },
	{ type: "content_block_start", index: 4, content_block: { type: "text", text: "" } },
	{ type: "content_block_delta", index: 4, delta: { type: "text_delta", text: " And more." } },
	{ type: "content_block_stop", index: 4 },
	{ type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 50 } },
	{ type: "message_stop" },
];

const searchResult = {
	role: "assistant",
	stopReason: "stop",
	content: [
		{ type: "text", text: "I'll search." },
		{ type: "text", text: "Two says hello." },
		{ type: "text", text: " And more." },
	],
};

// The same answer as a non-streaming Messages API response.
const apiBody = {
	stop_reason: "end_turn",
	content: [
		{ type: "text", text: "I'll search." },
		{ type: "server_tool_use", id: "srv_1", name: "web_search", input: { query: "pi release" } },
		{
			type: "web_search_tool_result",
			tool_use_id: "srv_1",
			content: [
				{ type: "web_search_result", url: "https://a.example/one", title: "One" },
				{ type: "web_search_result", url: "https://b.example/two", title: "Two" },
			],
		},
		{
			type: "text",
			text: "Two says hello.",
			citations: [{ url: "https://b.example/two", title: "Two", cited_text: "Two says hello." }],
		},
	],
};

function toolErrorBody(code: string) {
	return {
		stop_reason: "end_turn",
		content: [
			{ type: "server_tool_use", id: "srv_1", name: "web_search", input: { query: "q" } },
			{
				type: "web_search_tool_result",
				tool_use_id: "srv_1",
				content: { type: "web_search_tool_result_error", error_code: code },
			},
			{ type: "text", text: "The search failed." },
		],
	};
}

interface StreamCall {
	model: string;
	payload: Record<string, unknown>;
	prompt: string;
	options: Record<string, unknown>;
}

/**
 * A fake Pi model registry. streamSimple runs the caller's onPayload against a
 * Pi-built payload and replays raw provider events through
 * onProviderStreamEvent, as Pi's Anthropic transport does.
 */
function fakeRegistry({
	known = ["claude-haiku-5-5", "claude-sonnet-5-5"],
	auth = { ok: true, apiKey: "sk-ant-oat01-registry-token" } as Record<string, unknown>,
	events = searchEvents,
	result = searchResult as Record<string, unknown>,
} = {}) {
	const streams: StreamCall[] = [];
	const registry = {
		find: vi.fn((provider: string, id: string) =>
			provider === "anthropic" && known.includes(id)
				? { provider, id, name: id, api: "anthropic-messages", reasoning: false }
				: undefined,
		),
		getApiKeyAndHeaders: vi.fn(async () => auth),
		streamSimple: vi.fn(
			(
				model: { id: string },
				context: { messages: Array<{ content: Array<{ text: string }> }> },
				options: Record<string, (...args: unknown[]) => unknown>,
			) => ({
				result: async () => {
					const built = {
						model: model.id,
						max_tokens: options.maxTokens,
						messages: [{ role: "user", content: context.messages[0].content }],
						system: [{ type: "text", text: "pi system" }],
						tools: [{ name: "read", input_schema: {} }],
						tool_choice: { type: "auto" },
					};
					const replaced = (await options.onPayload?.(built, model)) as Record<string, unknown>;
					for (const event of events) await options.onProviderStreamEvent?.(event, model);
					streams.push({
						model: model.id,
						payload: replaced,
						prompt: context.messages[0].content[0].text,
						options: options as unknown as Record<string, unknown>,
					});
					return result;
				},
			}),
		),
	};
	const context = { modelRegistry: registry } as unknown as SearchContext;
	return { registry, context, streams };
}

function failingFetch() {
	return stubFetch([
		{
			match: () => true,
			response: () => {
				throw new Error("must not reach the network");
			},
		},
	]);
}

describe("AnthropicProvider — login path through Pi's model registry", () => {
	it("sends exactly the web search tool and parses captured search events", async () => {
		const fetchStub = failingFetch();
		const { context, streams } = fakeRegistry();
		const provider = new AnthropicProvider({ apiKey: "sk-ant-api03-should-not-be-used" });

		const response = await provider.search("pi release", 4, undefined, context);

		expect(fetchStub.calls).toEqual([]);
		expect(streams).toHaveLength(1);
		const [stream] = streams;
		expect(stream.model).toBe("claude-haiku-5-5");
		expect(stream.options.cacheRetention).toBe("none");
		expect(stream.options.reasoning).toBeUndefined();
		// Pi's client tools and forced tool choice are replaced by exactly one server tool.
		expect(stream.payload.tools).toEqual([{ type: "web_search_20250305", name: "web_search", max_uses: 3 }]);
		expect("tool_choice" in stream.payload).toBe(false);
		expect(stream.payload.system).toEqual([{ type: "text", text: "pi system" }]);
		expect(stream.prompt).toMatch(/list what you found/);
		expect(stream.prompt).toMatch(/about 4 distinct sources/);
		expect(stream.prompt).toMatch(/Query: pi release$/);

		expect(response.query).toBe("pi release");
		expect(response.answer).toBe("I'll search.\n\nTwo says hello. And more.");
		// Cited sources first with quoted page text; other results follow without a snippet; URLs dedupe.
		expect(response.results).toEqual([
			{ title: "Two", url: "https://b.example/two", snippet: "Two says hello." },
			{ title: "One", url: "https://a.example/one", snippet: "" },
			{ title: "Three", url: "https://c.example/three", snippet: "" },
		]);
	});

	it("caps results at maxResults and bounds max_uses to 1..10", async () => {
		failingFetch();
		const { context, streams } = fakeRegistry();
		const response = await new AnthropicProvider({ maxUses: 50 }).search("q", 2, undefined, context);
		expect(response.results.map((r) => r.url)).toEqual(["https://b.example/two", "https://a.example/one"]);
		await new AnthropicProvider({ maxUses: 0 }).search("q", 2, undefined, context);
		await new AnthropicProvider({ maxUses: 5 }).search("q", 2, undefined, context);
		expect(streams.map((s) => (s.payload.tools as Array<{ max_uses: number }>)[0].max_uses)).toEqual([10, 1, 5]);
		expect(resolveAnthropicMaxUses(undefined)).toBe(3);
		expect(resolveAnthropicMaxUses(Number.NaN)).toBe(3);
		expect(resolveAnthropicMaxUses(4.7)).toBe(4);
	});

	it("walks the fixed model preference list and honors a configured model", async () => {
		const sonnetOnly = fakeRegistry({ known: ["claude-sonnet-5-5", "claude-opus-5"] });
		await new AnthropicProvider().search("q", 5, undefined, sonnetOnly.context);
		await new AnthropicProvider({ model: "  claude-opus-5  " }).search("q", 5, undefined, sonnetOnly.context);
		await new AnthropicProvider({ model: "claude-future-6" }).search("q", 5, undefined, sonnetOnly.context);
		await new AnthropicProvider({ model: "   " }).search("q", 5, undefined, sonnetOnly.context);
		expect(sonnetOnly.streams.map((s) => s.model)).toEqual([
			"claude-sonnet-5-5",
			"claude-opus-5",
			"claude-future-6",
			"claude-sonnet-5-5",
		]);
	});

	it("passes the caller's abort signal and throws when the stream was aborted", async () => {
		const { context, streams } = fakeRegistry({ result: { role: "assistant", stopReason: "aborted", content: [] } });
		const controller = new AbortController();
		await expect(new AnthropicProvider().search("q", 5, controller.signal, context)).rejects.toThrow(/aborted/);
		expect(streams[0].options.signal).toBe(controller.signal);
	});

	it("surfaces a registry error as an HTTP-style error", async () => {
		const { context } = fakeRegistry({
			events: [],
			result: {
				role: "assistant",
				stopReason: "error",
				errorMessage: '529 {"type":"overloaded_error"}',
				content: [],
			},
		});
		await expect(new AnthropicProvider().search("q", 5, undefined, context)).rejects.toThrow(
			/^Anthropic API error 529: /,
		);
		const other = fakeRegistry({ events: [], result: { role: "assistant", stopReason: "error", content: [] } });
		await expect(new AnthropicProvider().search("q", 5, undefined, other.context)).rejects.toThrow(
			"Anthropic request failed: unknown error",
		);
	});

	it("rejects a refusal without sources and keeps sources found before a refusal", async () => {
		const refusalStop = {
			type: "message_delta",
			delta: { stop_reason: "refusal", stop_details: { category: "cyber", explanation: "Not allowed." } },
		};
		const refused = { role: "assistant", stopReason: "error", errorMessage: "Not allowed.", content: [] };
		const noSources = fakeRegistry({ events: [refusalStop], result: refused });
		await expect(new AnthropicProvider().search("q", 5, undefined, noSources.context)).rejects.toThrow(
			"Anthropic search refused: Claude declined the search (cyber): Not allowed.",
		);

		const withSources = fakeRegistry({ events: [...searchEvents.slice(4, 9), refusalStop], result: refused });
		const response = await new AnthropicProvider().search("q", 5, undefined, withSources.context);
		expect(response.answer).toMatch(/declined the search .* sources it found before declining follow/);
		expect(response.results.map((r) => r.url)).toEqual([
			"https://a.example/one",
			"https://b.example/two",
			"https://c.example/three",
		]);
	});

	it("uses Pi's assembled text when the stream carried no text blocks", async () => {
		const { context } = fakeRegistry({
			events: [{ type: "message_delta", delta: { stop_reason: "end_turn" } }],
			result: { role: "assistant", stopReason: "stop", content: [{ type: "text", text: "Just an answer." }] },
		});
		const response = await new AnthropicProvider().search("q", 5, undefined, context);
		expect(response).toEqual({ query: "q", results: [], answer: "Just an answer." });
	});
});

describe("AnthropicProvider — API-key path", () => {
	function stubMessages(body: unknown, status = 200) {
		return stubFetch([
			{
				match: (url) => url === MESSAGES_URL,
				response: () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status }),
			},
		]);
	}

	it("posts a plain Messages request with only x-api-key, version, and content type", async () => {
		const stub = stubMessages(apiBody);
		const response = await new AnthropicProvider({ apiKey: "sk-ant-api03-config-key" }).search("pi release", 5);

		expect(stub.calls).toHaveLength(1);
		const init = stub.calls[0].init as RequestInit;
		expect(stub.calls[0].url).toBe(MESSAGES_URL);
		expect(init.method).toBe("POST");
		const headers = init.headers as Record<string, string>;
		expect(Object.keys(headers).sort()).toEqual(["anthropic-version", "content-type", "x-api-key"]);
		expect(headers["x-api-key"]).toBe("sk-ant-api03-config-key");
		const body = JSON.parse(init.body as string);
		expect(Object.keys(body).sort()).toEqual(["max_tokens", "messages", "model", "tools"]);
		expect(body.model).toBe("claude-haiku-5-5");
		expect(body.tools).toEqual([{ type: "web_search_20250305", name: "web_search", max_uses: 3 }]);
		expect(response.answer).toBe("I'll search.\n\nTwo says hello.");
		expect(response.results).toEqual([
			{ title: "Two", url: "https://b.example/two", snippet: "Two says hello." },
			{ title: "One", url: "https://a.example/one", snippet: "" },
		]);
	});

	it("uses the configured model on the key path", async () => {
		const stub = stubMessages(apiBody);
		await new AnthropicProvider({ apiKey: "sk-ant-api03-k", model: "claude-sonnet-5-5" }).search("q", 5);
		expect(JSON.parse(stub.calls[0].init?.body as string).model).toBe("claude-sonnet-5-5");
	});

	it("prefers Pi's login over a key, and falls back to the key without the login token", async () => {
		const fetchStub = failingFetch();
		const loggedIn = fakeRegistry();
		await new AnthropicProvider({ apiKey: "sk-ant-api03-config-key" }).search("q", 5, undefined, loggedIn.context);
		expect(loggedIn.streams).toHaveLength(1);
		expect(fetchStub.calls).toEqual([]);

		const stub = stubMessages(apiBody);
		const loggedOut = fakeRegistry({ auth: { ok: false, error: "not signed in" } });
		await new AnthropicProvider({ apiKey: "sk-ant-api03-config-key" }).search("q", 5, undefined, loggedOut.context);
		expect(loggedOut.streams).toHaveLength(0);
		const headers = stub.calls[0].init?.headers as Record<string, string>;
		expect(headers["x-api-key"]).toBe("sk-ant-api03-config-key");
		expect(headers.authorization).toBeUndefined();
		expect(JSON.stringify(stub.calls[0].init)).not.toMatch(/sk-ant-oat/);
	});

	it("treats a throwing registry lookup as no login", async () => {
		const stub = stubMessages(apiBody);
		const { registry, context, streams } = fakeRegistry();
		registry.find.mockImplementation(() => {
			throw new Error("registry broken");
		});
		await new AnthropicProvider({ apiKey: "sk-ant-api03-k" }).search("q", 5, undefined, context);
		expect(streams).toHaveLength(0);
		expect(stub.calls).toHaveLength(1);
	});

	it("never sends an OAuth token by direct fetch", async () => {
		const fetchStub = failingFetch();
		const error = await new AnthropicProvider({ apiKey: "sk-ant-oat01-secret-oauth" })
			.search("q", 5)
			.catch((err: Error) => err);
		expect(fetchStub.calls).toEqual([]);
		expect((error as Error).message).toMatch(/OAuth token/);
		expect((error as Error).message).toMatch(/\/login anthropic/);
		expect((error as Error).message).not.toMatch(/secret-oauth/);
	});

	it("explains every credential source when neither login nor key exists", async () => {
		const fetchStub = failingFetch();
		const { context } = fakeRegistry({ auth: { ok: false, error: "no auth" } });
		const error = (await new AnthropicProvider().search("q", 5, undefined, context).catch((err) => err)) as Error;
		expect(fetchStub.calls).toEqual([]);
		expect(error.message).toMatch(/\/login anthropic/);
		expect(error.message).toMatch(/ANTHROPIC_API_KEY/);
		expect(error.message).toMatch(/apiKeys\.anthropic/);
		await expect(new AnthropicProvider().search("q", 5)).rejects.toThrow(/\/login anthropic/);
	});

	it("throws HTTP errors with the API key redacted", async () => {
		stubMessages("denied for sk-ant-api03-secret", 401);
		const error = (await new AnthropicProvider({ apiKey: "sk-ant-api03-secret" })
			.search("q", 5)
			.catch((err) => err)) as Error;
		expect(error.message).toMatch(/^Anthropic API error 401: /);
		expect(error.message).not.toMatch(/sk-ant-api03-secret/);
	});

	it("throws on a body without content", async () => {
		stubMessages({ type: "message" });
		await expect(new AnthropicProvider({ apiKey: "sk-ant-api03-k" }).search("q", 5)).rejects.toThrow(
			/missing content/,
		);
	});

	it("throws a web search tool error that arrives inside HTTP 200", async () => {
		stubMessages(toolErrorBody("too_many_requests"));
		await expect(new AnthropicProvider({ apiKey: "sk-ant-api03-k" }).search("q", 5)).rejects.toThrow(
			"Anthropic web search tool error: too_many_requests",
		);
	});

	it("returns no sources and no answer as an empty response", async () => {
		stubMessages({ stop_reason: "end_turn", content: [] });
		const response = await new AnthropicProvider({ apiKey: "sk-ant-api03-k" }).search("q", 5);
		expect(response).toEqual({ query: "q", results: [] });
	});
});

describe("parseAnthropicSearchMessage", () => {
	it("returns an answer without sources as a successful response", () => {
		const response = parseAnthropicSearchMessage("q", { content: [{ type: "text", text: "  Only text.  " }] }, 5);
		expect(response).toEqual({ query: "q", results: [], answer: "Only text." });
	});

	it("keeps results when a later search errored, fills empty snippets, and truncates long cited text", () => {
		const long = "x".repeat(400);
		const response = parseAnthropicSearchMessage(
			"q",
			{
				content: [
					"not a block",
					{ type: "web_search_tool_result", content: [{ type: "web_search_result", url: "https://a.example" }] },
					{ type: "web_search_tool_result", content: { type: "web_search_tool_result_error" } },
					{
						type: "text",
						text: "A.",
						citations: [
							{ url: "https://a.example" },
							{ url: "https://a.example", cited_text: long },
							{ url: "https://new.example", title: "New", cited_text: "fresh" },
							{ title: "no url" },
						],
					},
				],
			},
			5,
		);
		expect(response.results).toEqual([
			{ title: "https://a.example", url: "https://a.example", snippet: `${"x".repeat(297)}...` },
			{ title: "New", url: "https://new.example", snippet: "fresh" },
		]);
	});

	it("names an unknown tool error code and a bare refusal", () => {
		expect(() =>
			parseAnthropicSearchMessage("q", { content: [{ type: "web_search_tool_result", content: {} }] }, 5),
		).toThrow("Anthropic web search tool error: unknown_error");
		expect(() => parseAnthropicSearchMessage("q", { content: [], stop_reason: "refusal" }, 5)).toThrow(
			"Anthropic search refused: Claude declined the search.",
		);
	});
});

describe("Anthropic registration and /web-tools prompt", () => {
	it("builds an AnthropicProvider with settings through the factory", async () => {
		const provider = createSearchProvider(
			"anthropic",
			{ apiKey: "sk-ant-api03-k" },
			{ anthropic: { model: "claude-sonnet-5-5", maxUses: 2 } },
		);
		expect(provider).toBeInstanceOf(AnthropicProvider);
		expect("fetch" in provider).toBe(false);
		const stub = stubFetch([
			{ match: (url) => url === MESSAGES_URL, response: () => new Response(JSON.stringify(apiBody)) },
		]);
		await provider.search("q", 5);
		const body = JSON.parse(stub.calls[0].init?.body as string);
		expect(body.model).toBe("claude-sonnet-5-5");
		expect(body.tools[0].max_uses).toBe(2);
	});

	it("declares a search-only META with an optional-key configure prompt", async () => {
		expect(ANTHROPIC_PROVIDER_META).toMatchObject({
			name: "anthropic",
			label: "Anthropic",
			envVar: "ANTHROPIC_API_KEY",
			roles: ["search"],
		});
		const ui = { input: vi.fn() };
		ui.input.mockResolvedValueOnce("");
		expect(await ANTHROPIC_PROVIDER_META.configure?.(ui, {})).toEqual({ apiKey: null });
		expect(ui.input.mock.calls[0][1]).toMatch(/Pi's Anthropic login/);
		ui.input.mockResolvedValueOnce("  sk-ant-api03-new  ");
		expect(await configureAnthropic(ui, { apiKey: "sk-ant-api03-old" })).toEqual({ apiKey: "sk-ant-api03-new" });
		expect(ui.input.mock.calls[1][1]).toMatch(/keep current \(sk-a\.\.\.-old\)/);
		ui.input.mockResolvedValueOnce(undefined);
		expect(await configureAnthropic(ui, {})).toBeNull();
	});
});

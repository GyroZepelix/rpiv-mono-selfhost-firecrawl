/**
 * Anthropic provider — Claude's server-side `web_search` tool. Claude runs the
 * searches inside one Messages request and answers with citations; the
 * provider returns that short answer plus the cited and found sources.
 *
 * Two transports, in this order:
 *   1. Pi's model registry (`modelRegistry.streamSimple`) with Pi's `anthropic`
 *      login. This is the only path that may use the login: auth extensions
 *      such as @gotgenes/pi-anthropic-auth shape requests on this transport so
 *      Claude subscription use is billed as such. Pi's message assembly drops
 *      `server_tool_use`, `web_search_tool_result`, and citations, so the raw
 *      provider stream events are captured, and the tool itself is injected by
 *      rewriting the request payload.
 *   2. A plain `x-api-key` Messages request with ANTHROPIC_API_KEY or
 *      `apiKeys.anthropic`. No Claude Code identity, and never an OAuth token:
 *      an unshaped OAuth request is classified as third-party usage.
 *
 * Search-only: `web_fetch` reads pages through another provider.
 */

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
	isCancellation,
	type ProviderConfigChange,
	type ProviderConfigCurrent,
	type ProviderConfigUi,
	type ProviderMeta,
	type SearchContext,
	type SearchProvider,
	type SearchResponse,
	type SearchResult,
} from "./types.ts";

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const ANTHROPIC_REGISTRY_PROVIDER = "anthropic";
const WEB_SEARCH_TOOL_NAME = "web_search";
const WEB_SEARCH_TOOL_TYPE = "web_search_20250305";
const DEFAULT_MAX_USES = 3;
const MIN_MAX_USES = 1;
const MAX_MAX_USES = 10;
const MAX_TOKENS = 4096;
const OAUTH_TOKEN_PREFIX = "sk-ant-oat";
const SNIPPET_MAX_CHARS = 300;
const ERROR_TEXT_MAX_CHARS = 300;
const MASK_VISIBLE_CHARS = 4;

// A fixed preference list, not "newest model" inference: registry ordering
// does not reliably say which model is latest.
export const ANTHROPIC_SEARCH_MODELS = ["claude-haiku-5-5", "claude-sonnet-5-5"] as const;

export const ANTHROPIC_API_KEY_ENV_VAR = "ANTHROPIC_API_KEY";
export const ANTHROPIC_PROVIDER_META: ProviderMeta = {
	name: "anthropic",
	label: "Anthropic",
	envVar: ANTHROPIC_API_KEY_ENV_VAR,
	roles: ["search"],
	configure: (ui, current) => configureAnthropic(ui, current),
};

export interface AnthropicSearchSettings {
	model?: string;
	maxUses?: number;
}

export interface AnthropicProviderOptions extends AnthropicSearchSettings {
	apiKey?: string;
}

type Registry = ExtensionContext["modelRegistry"];
type RegistryModel = NonNullable<ReturnType<Registry["find"]>>;
type StreamContext = Parameters<Registry["streamSimple"]>[1];
type StreamOptions = NonNullable<Parameters<Registry["streamSimple"]>[2]>;

/** Configured `maxUses` bounded to 1..10; anything unusable falls back to the default. */
export function resolveAnthropicMaxUses(value: number | undefined): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_MAX_USES;
	return Math.min(Math.max(Math.floor(value), MIN_MAX_USES), MAX_MAX_USES);
}

function resolveModelOverride(value: string | undefined): string | undefined {
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | undefined {
	return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

// ---------------------------------------------------------------------------
// Request shape, shared by both transports
// ---------------------------------------------------------------------------

export function buildAnthropicSearchTool(maxUses: number): Record<string, unknown> {
	return { type: WEB_SEARCH_TOOL_TYPE, name: WEB_SEARCH_TOOL_NAME, max_uses: maxUses };
}

// The tool has no count parameter, so the wanted result count is in the prompt.
export function buildAnthropicSearchPrompt(query: string, maxResults: number): string {
	return (
		"Search the web for the query below, then list what you found: one line per source with a short factual summary of what it says. " +
		`Answer only from the search results. Aim for about ${maxResults} distinct sources.\n\nQuery: ${query}`
	);
}

// ---------------------------------------------------------------------------
// Response parsing, shared by both transports
// ---------------------------------------------------------------------------

export interface AnthropicMessageLike {
	content: unknown[];
	stop_reason?: unknown;
	stop_details?: unknown;
}

function cleanCitedText(text: string): string {
	const collapsed = text.replace(/\s+/g, " ").trim();
	return collapsed.length > SNIPPET_MAX_CHARS ? `${collapsed.slice(0, SNIPPET_MAX_CHARS - 3)}...` : collapsed;
}

function refusalMessage(stopDetails: unknown): string {
	const details = isRecord(stopDetails) ? stopDetails : undefined;
	const category = nonEmptyString(details?.category);
	const explanation = nonEmptyString(details?.explanation);
	return `Claude declined the search${category ? ` (${category})` : ""}${explanation ? `: ${explanation}` : "."}`;
}

/**
 * Turns Anthropic content blocks into a SearchResponse. Cited sources come
 * first with the citation's `cited_text` (quoted page text) as the snippet,
 * then the remaining search results with an empty snippet; URLs dedupe and
 * the list is capped at `maxResults`. `encrypted_content` is opaque and never
 * used. Tool errors and refusals without any source throw.
 */
export function parseAnthropicSearchMessage(
	query: string,
	message: AnthropicMessageLike,
	maxResults: number,
): SearchResponse {
	const toolErrors: string[] = [];
	const sources = new Map<string, string | undefined>();
	const citations: Array<{ url: string; title?: string; citedText?: string }> = [];
	let answer = "";
	let previousWasText = false;

	for (const block of message.content) {
		if (!isRecord(block)) continue;
		if (block.type !== "text") previousWasText = false;
		if (block.type === "web_search_tool_result") {
			const content = block.content;
			if (Array.isArray(content)) {
				for (const result of content) {
					if (!isRecord(result) || result.type !== "web_search_result") continue;
					const url = nonEmptyString(result.url);
					if (url && !sources.has(url)) sources.set(url, nonEmptyString(result.title));
				}
			} else if (isRecord(content)) {
				const code = nonEmptyString(content.error_code) ?? "unknown_error";
				if (!toolErrors.includes(code)) toolErrors.push(code);
			}
		} else if (block.type === "text") {
			const text = typeof block.text === "string" ? block.text : "";
			// Citations split continuous text into adjacent text blocks; break the
			// paragraph only where text resumes after a search block.
			if (text) {
				if (answer && !previousWasText) answer += "\n\n";
				answer += text;
			}
			previousWasText = true;
			if (Array.isArray(block.citations)) {
				for (const citation of block.citations) {
					if (!isRecord(citation)) continue;
					const url = nonEmptyString(citation.url);
					if (!url) continue;
					citations.push({
						url,
						title: nonEmptyString(citation.title),
						citedText: nonEmptyString(citation.cited_text),
					});
				}
			}
		}
	}

	const results: SearchResult[] = [];
	const byUrl = new Map<string, SearchResult>();
	for (const citation of citations) {
		const existing = byUrl.get(citation.url);
		if (existing) {
			if (!existing.snippet && citation.citedText) existing.snippet = cleanCitedText(citation.citedText);
			continue;
		}
		const result = {
			title: sources.get(citation.url) ?? citation.title ?? citation.url,
			url: citation.url,
			snippet: citation.citedText ? cleanCitedText(citation.citedText) : "",
		};
		byUrl.set(citation.url, result);
		results.push(result);
	}
	for (const [url, title] of sources) {
		if (byUrl.has(url)) continue;
		const result = { title: title ?? url, url, snippet: "" };
		byUrl.set(url, result);
		results.push(result);
	}

	if (message.stop_reason === "refusal") {
		// A declined answer is incomplete and is discarded; sources already found stay usable.
		const refusal = refusalMessage(message.stop_details);
		if (results.length === 0) throw new Error(`Anthropic search refused: ${refusal}`);
		answer = `${refusal} The sources it found before declining follow.`;
	} else if (results.length === 0 && toolErrors.length > 0) {
		throw new Error(`Anthropic web search tool error: ${toolErrors.join(", ")}`);
	}

	const trimmed = answer.trim();
	return {
		query,
		results: results.slice(0, maxResults),
		...(trimmed ? { answer: trimmed } : {}),
	};
}

// ---------------------------------------------------------------------------
// Registry transport: Pi's Anthropic login through streamSimple
// ---------------------------------------------------------------------------

interface CapturedBlock {
	type: string;
	text?: string;
	citations?: unknown[];
	content?: unknown;
}

/** Rebuilds Anthropic content blocks and the stop reason from raw stream events. */
export function createAnthropicStreamCapture() {
	const blocks = new Map<number, CapturedBlock>();
	const order: number[] = [];
	let stopReason: string | undefined;
	let stopDetails: unknown;

	function onEvent(event: unknown): void {
		if (!isRecord(event)) return;
		if (event.type === "content_block_start" && typeof event.index === "number" && isRecord(event.content_block)) {
			const start = event.content_block;
			const block: CapturedBlock = { type: typeof start.type === "string" ? start.type : "unknown" };
			if (block.type === "text") {
				block.text = typeof start.text === "string" ? start.text : "";
				block.citations = Array.isArray(start.citations) ? [...start.citations] : [];
			} else if (block.type === "web_search_tool_result") {
				block.content = start.content;
			}
			if (!blocks.has(event.index)) order.push(event.index);
			blocks.set(event.index, block);
		} else if (event.type === "content_block_delta" && typeof event.index === "number" && isRecord(event.delta)) {
			const block = blocks.get(event.index);
			const delta = event.delta;
			if (block?.type !== "text") return;
			if (delta.type === "text_delta" && typeof delta.text === "string") {
				block.text = (block.text ?? "") + delta.text;
			} else if (delta.type === "citations_delta" && delta.citation !== undefined) {
				block.citations?.push(delta.citation);
			}
		} else if (event.type === "message_delta" && isRecord(event.delta)) {
			if (typeof event.delta.stop_reason === "string") stopReason = event.delta.stop_reason;
			if (event.delta.stop_details !== undefined) stopDetails = event.delta.stop_details;
		}
	}

	// Pi's assembled text replaces the raw text when the block counts match;
	// the raw blocks keep the citations and the search-block layout.
	function message(assembledTexts: string[]): AnthropicMessageLike {
		const content: CapturedBlock[] = order.flatMap((index) => {
			const block = blocks.get(index);
			return block ? [{ ...block }] : [];
		});
		const textBlocks = content.filter((block) => block.type === "text");
		if (textBlocks.length === assembledTexts.length) {
			textBlocks.forEach((block, i) => {
				block.text = assembledTexts[i];
			});
		} else if (textBlocks.length === 0 && assembledTexts.length > 0) {
			content.push({ type: "text", text: assembledTexts.join(""), citations: [] });
		}
		return { content, stop_reason: stopReason, stop_details: stopDetails };
	}

	return {
		onEvent,
		message,
		get stopReason() {
			return stopReason;
		},
	};
}

/** Replaces Pi's tool list with exactly the web search tool and drops any forced tool choice. */
export function withAnthropicSearchTool(payload: unknown, tool: Record<string, unknown>): unknown {
	if (!isRecord(payload)) return undefined;
	const { tool_choice: _toolChoice, ...rest } = payload;
	return { ...rest, tools: [tool] };
}

function usableRegistry(context: SearchContext | undefined): Registry | undefined {
	const registry = context?.modelRegistry;
	return registry && typeof registry.find === "function" && typeof registry.streamSimple === "function"
		? registry
		: undefined;
}

function findRegistryModel(registry: Registry, id: string): RegistryModel | undefined {
	try {
		return registry.find(ANTHROPIC_REGISTRY_PROVIDER, id);
	} catch {
		return undefined;
	}
}

async function hasLogin(registry: Registry, model: RegistryModel): Promise<boolean> {
	try {
		const resolved = await registry.getApiKeyAndHeaders(model);
		return resolved.ok && !!resolved.apiKey;
	} catch {
		return false;
	}
}

/**
 * The model to search with through Pi's login, or undefined when Pi holds no
 * `anthropic` credentials. A configured model the registry knows is used as
 * is; an unknown configured id reuses the first authenticated preference
 * model's settings with the configured id.
 */
async function resolveRegistryModel(
	registry: Registry,
	override: string | undefined,
): Promise<RegistryModel | undefined> {
	const exact = override ? findRegistryModel(registry, override) : undefined;
	if (exact && (await hasLogin(registry, exact))) return exact;
	for (const id of ANTHROPIC_SEARCH_MODELS) {
		const model = findRegistryModel(registry, id);
		if (!model || !(await hasLogin(registry, model))) continue;
		return override && !exact ? ({ ...model, id: override, name: override } as RegistryModel) : model;
	}
	return undefined;
}

function registryErrorMessage(raw: string | undefined): string {
	const text = (raw ?? "").trim() || "unknown error";
	const status = text.match(/^(\d{3})\b/)?.[1];
	return status
		? `Anthropic API error ${status}: ${text.slice(0, ERROR_TEXT_MAX_CHARS)}`
		: `Anthropic request failed: ${text.slice(0, ERROR_TEXT_MAX_CHARS)}`;
}

function abortError(): Error {
	const error = new Error("Anthropic search aborted");
	error.name = "AbortError";
	return error;
}

// ---------------------------------------------------------------------------
// API-key transport helpers
// ---------------------------------------------------------------------------

function redact(text: string, secret: string): string {
	return secret ? text.split(secret).join("[redacted]") : text;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export class AnthropicProvider implements SearchProvider {
	readonly name = "anthropic";
	readonly label = "Anthropic";
	readonly envVar = ANTHROPIC_API_KEY_ENV_VAR;

	private readonly apiKey: string;
	private readonly model: string | undefined;
	private readonly maxUses: number;

	constructor(options: AnthropicProviderOptions = {}) {
		this.apiKey = options.apiKey?.trim() ?? "";
		this.model = resolveModelOverride(options.model);
		this.maxUses = resolveAnthropicMaxUses(options.maxUses);
	}

	async search(
		query: string,
		maxResults: number,
		signal?: AbortSignal,
		context?: SearchContext,
	): Promise<SearchResponse> {
		const registry = usableRegistry(context);
		const registryModel = registry ? await resolveRegistryModel(registry, this.model) : undefined;
		if (registry && registryModel) return this.searchViaRegistry(registry, registryModel, query, maxResults, signal);

		if (!this.apiKey) {
			throw new Error(
				"Anthropic search needs Pi's Anthropic login or an API key. Run /login anthropic in Pi, " +
					`or set ${ANTHROPIC_API_KEY_ENV_VAR} or apiKeys.anthropic (via /web-tools).`,
			);
		}
		if (this.apiKey.startsWith(OAUTH_TOKEN_PREFIX)) {
			throw new Error(
				`${ANTHROPIC_API_KEY_ENV_VAR} or apiKeys.anthropic holds a Claude OAuth token, which is never sent outside Pi's model registry. ` +
					"Run /login anthropic in Pi, or configure an Anthropic API key.",
			);
		}
		return this.searchViaApiKey(query, maxResults, signal);
	}

	private async searchViaRegistry(
		registry: Registry,
		model: RegistryModel,
		query: string,
		maxResults: number,
		signal: AbortSignal | undefined,
	): Promise<SearchResponse> {
		const tool = buildAnthropicSearchTool(this.maxUses);
		const capture = createAnthropicStreamCapture();
		const streamContext: StreamContext = {
			messages: [
				{
					role: "user",
					content: [{ type: "text", text: buildAnthropicSearchPrompt(query, maxResults) }],
					timestamp: Date.now(),
				},
			],
		};
		// Reasoning stays unset: Pi then disables thinking where the model allows it.
		const options: StreamOptions = {
			signal,
			maxTokens: MAX_TOKENS,
			cacheRetention: "none",
			onPayload: (payload: unknown) => withAnthropicSearchTool(payload, tool),
			onProviderStreamEvent: (event: unknown) => capture.onEvent(event),
		};
		const message = await registry.streamSimple(model, streamContext, options).result();

		if (message.stopReason === "aborted" || signal?.aborted) throw abortError();
		// A refusal arrives as Pi's "error" stop reason; the parser decides
		// whether the sources already found are usable.
		if (message.stopReason === "error" && capture.stopReason !== "refusal") {
			throw new Error(registryErrorMessage(message.errorMessage));
		}
		const assembledTexts = (Array.isArray(message.content) ? message.content : []).flatMap((part) =>
			part.type === "text" && typeof part.text === "string" ? [part.text] : [],
		);
		return parseAnthropicSearchMessage(query, capture.message(assembledTexts), maxResults);
	}

	private async searchViaApiKey(
		query: string,
		maxResults: number,
		signal: AbortSignal | undefined,
	): Promise<SearchResponse> {
		const res = await fetch(ANTHROPIC_MESSAGES_URL, {
			method: "POST",
			headers: {
				"x-api-key": this.apiKey,
				"anthropic-version": ANTHROPIC_VERSION,
				"content-type": "application/json",
			},
			body: JSON.stringify({
				model: this.model ?? ANTHROPIC_SEARCH_MODELS[0],
				max_tokens: MAX_TOKENS,
				messages: [{ role: "user", content: buildAnthropicSearchPrompt(query, maxResults) }],
				tools: [buildAnthropicSearchTool(this.maxUses)],
			}),
			signal,
		});

		if (!res.ok) {
			const text = redact(await res.text(), this.apiKey);
			throw new Error(`Anthropic API error ${res.status}: ${text.slice(0, ERROR_TEXT_MAX_CHARS)}`);
		}

		const body: unknown = await res.json();
		if (!isRecord(body) || !Array.isArray(body.content)) {
			throw new Error("Anthropic API returned an invalid response: missing content");
		}
		return parseAnthropicSearchMessage(
			query,
			{ content: body.content, stop_reason: body.stop_reason, stop_details: body.stop_details },
			maxResults,
		);
	}
}

// ---------------------------------------------------------------------------
// /web-tools helper — Anthropic branch
// ---------------------------------------------------------------------------

function maskKey(key: string): string {
	return `${key.slice(0, MASK_VISIBLE_CHARS)}...${key.slice(-MASK_VISIBLE_CHARS)}`;
}

// One optional prompt: Enter keeps an existing key or leaves it unset, in
// which case searches use Pi's Anthropic login. Returns `null` on cancel.
export async function configureAnthropic(
	ui: ProviderConfigUi,
	current: ProviderConfigCurrent,
): Promise<ProviderConfigChange | null> {
	const existing = current.apiKey?.trim();
	const input = await ui.input(
		"Anthropic API key (optional)",
		existing
			? `Press Enter to keep current (${maskKey(existing)}), or type new key`
			: "Press Enter to use Pi's Anthropic login, or type an API key",
	);
	if (isCancellation(input)) return null;
	return { apiKey: input.trim() || null };
}

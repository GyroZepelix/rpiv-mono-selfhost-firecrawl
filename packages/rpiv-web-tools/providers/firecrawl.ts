import {
	type FetchResponse,
	type FullProvider,
	isCancellation,
	type ProviderConfigChange,
	type ProviderConfigCurrent,
	type ProviderConfigUi,
	type ProviderMeta,
	type SearchResponse,
	type SearchResult,
} from "./types.js";

export const FIRECRAWL_API_KEY_ENV_VAR = "FIRECRAWL_API_KEY";
export const FIRECRAWL_API_URL_ENV_VAR = "FIRECRAWL_API_URL";
export const FIRECRAWL_DEFAULT_URL = "https://api.firecrawl.dev/v1";

// Number of leading + trailing characters preserved when masking an API key
// in the config prompt. Mirrors API_KEY_MASK_VISIBLE_CHARS in web-tools.ts.
const MASK_VISIBLE_CHARS = 4;

export const FIRECRAWL_PROVIDER_META: ProviderMeta = {
	name: "firecrawl",
	label: "Firecrawl",
	envVar: FIRECRAWL_API_KEY_ENV_VAR,
	baseUrlEnvVar: FIRECRAWL_API_URL_ENV_VAR,
	defaultBaseUrl: FIRECRAWL_DEFAULT_URL,
	roles: ["search", "fetch"],
	configure: (ui, current) => configureFirecrawl(ui, current),
};

interface FirecrawlSearchResult {
	title?: string;
	url?: string;
	description?: string;
}

interface FirecrawlSearchResponse {
	success?: boolean;
	data?: FirecrawlSearchResult[];
	error?: string;
}

interface FirecrawlScrapeResponse {
	success?: boolean;
	data?: {
		markdown?: string;
		html?: string;
		metadata?: {
			title?: string;
			description?: string;
			language?: string;
			statusCode?: number;
		};
	};
	error?: string;
}

function normalizeFirecrawlResults(results: FirecrawlSearchResult[]): SearchResult[] {
	return results.map((r) => ({
		title: r.title ?? "",
		url: r.url ?? "",
		snippet: r.description ?? "",
	}));
}

function stripTrailingSlashes(url: string): string {
	return url.replace(/\/+$/, "");
}

function assertHttpUrl(url: string): void {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		throw new Error(`${FIRECRAWL_API_URL_ENV_VAR} is not a valid URL (got: ${url})`);
	}
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		throw new Error(
			`${FIRECRAWL_API_URL_ENV_VAR} must use http:// or https:// (got: ${parsed.protocol.replace(":", "")}://)`,
		);
	}
}

interface FirecrawlProviderOptions {
	apiKey?: string;
	baseUrl: string;
}

export class FirecrawlProvider implements FullProvider {
	readonly name = FIRECRAWL_PROVIDER_META.name;
	readonly label = FIRECRAWL_PROVIDER_META.label;
	readonly envVar = FIRECRAWL_PROVIDER_META.envVar ?? FIRECRAWL_API_KEY_ENV_VAR;

	private readonly apiKey?: string;
	private readonly baseUrl: string;

	constructor(options: FirecrawlProviderOptions) {
		this.apiKey = options.apiKey?.trim() || undefined;
		const trimmed = stripTrailingSlashes(options.baseUrl?.trim() || FIRECRAWL_DEFAULT_URL);
		assertHttpUrl(trimmed);
		this.baseUrl = trimmed;
	}

	async search(query: string, maxResults: number, signal?: AbortSignal): Promise<SearchResponse> {
		this.requireApiKeyIfHosted();

		const res = await fetch(`${this.baseUrl}/search`, {
			method: "POST",
			headers: this.buildHeaders(),
			body: JSON.stringify({
				query,
				limit: maxResults,
			}),
			signal,
		});

		if (!res.ok) {
			const text = await res.text();
			throw new Error(`${this.label} Search API error (${res.status}): ${text}`);
		}

		const raw = (await res.json()) as FirecrawlSearchResponse;
		return { query, results: normalizeFirecrawlResults(raw.data ?? []) };
	}

	async fetch(url: string, _raw: boolean, signal?: AbortSignal): Promise<FetchResponse> {
		this.requireApiKeyIfHosted();

		const res = await fetch(`${this.baseUrl}/scrape`, {
			method: "POST",
			headers: this.buildHeaders(),
			body: JSON.stringify({
				url,
				formats: ["markdown"],
			}),
			signal,
		});

		if (!res.ok) {
			const text = await res.text();
			throw new Error(`${this.label} Fetch API error (${res.status}): ${text}`);
		}

		const raw = (await res.json()) as FirecrawlScrapeResponse;

		if (!raw.success) {
			throw new Error(`${this.label} Fetch API error: ${raw.error ?? "scrape failed"}`);
		}

		if (!raw.data?.markdown) {
			throw new Error(`${this.label} Fetch API error: no content returned for ${url}`);
		}

		return {
			text: raw.data.markdown,
			title: raw.data.metadata?.title || undefined,
			contentType: "text/markdown",
		};
	}

	private requireApiKeyIfHosted(): void {
		if (!this.apiKey && this.baseUrl === FIRECRAWL_DEFAULT_URL) {
			throw new Error(`${this.envVar} is not set. Run /web-tools to configure, or export the env var.`);
		}
	}

	private buildHeaders(): Record<string, string> {
		const headers: Record<string, string> = { "Content-Type": "application/json" };
		if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;
		return headers;
	}
}

// ---------------------------------------------------------------------------
// /web-tools helper
// ---------------------------------------------------------------------------

function maskKey(key: string): string {
	const head = key.slice(0, MASK_VISIBLE_CHARS);
	const tail = key.slice(-MASK_VISIBLE_CHARS);
	return `${head}...${tail}`;
}

async function promptForBaseUrl(ui: ProviderConfigUi, current: string | undefined): Promise<string | undefined> {
	const existing = current?.trim();
	const input = await ui.input(
		"Firecrawl API URL",
		existing
			? `Press Enter to keep current (${existing}), or type new URL`
			: `Press Enter for default (${FIRECRAWL_DEFAULT_URL}), or type self-hosted URL`,
	);
	if (isCancellation(input)) return undefined;
	return input.trim() || existing || FIRECRAWL_DEFAULT_URL;
}

async function promptForOptionalKey(
	ui: ProviderConfigUi,
	current: string | undefined,
): Promise<string | null | undefined> {
	const existing = current?.trim() || undefined;
	const input = await ui.input(
		"Firecrawl API key (required for Firecrawl Cloud, optional for self-hosted instances)",
		existing
			? `Press Enter to keep current (${maskKey(existing)}), or type new key`
			: "Press Enter to leave unset for self-hosted, or type a key",
	);
	if (isCancellation(input)) return undefined;
	return input.trim() || existing || null;
}

/**
 * Prompts the user for the Firecrawl API URL and optional API key.
 * Returns `null` if the user cancels at either prompt.
 */
export async function configureFirecrawl(
	ui: ProviderConfigUi,
	current: ProviderConfigCurrent,
): Promise<ProviderConfigChange | null> {
	const baseUrl = await promptForBaseUrl(ui, current.baseUrl);
	if (baseUrl === undefined) return null;

	const apiKey = await promptForOptionalKey(ui, current.apiKey);
	if (apiKey === undefined) return null;

	return { baseUrl, apiKey };
}

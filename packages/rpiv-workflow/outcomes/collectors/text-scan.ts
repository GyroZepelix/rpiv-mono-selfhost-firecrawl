/**
 * The neutral text-scan primitive — scan assistant text (reverse) for `pattern`,
 * then, on a miss, tool-call arguments (the agent's recorded actions), fatal
 * only when BOTH surfaces miss, single `role: "primary"` artifact via `toHandle`.
 * The shared body `transcriptPathCollector` and `urlCollector` share here
 * (byte-identical modulo the handle constructor + the "path"/"URL" noun). Build
 * domain-specific collectors by wrapping this + supplying a pattern + handle
 * constructor (`directoryPathCollector` already delegates this way to
 * `transcriptPathCollector`).
 *
 * Fatal when no match is found on either surface — produces stages that wire
 * this promise an output, and silently returning zero artifacts hides the
 * agent's failure mode behind a stale primary-artifact. The tool-argument
 * fallback exists because the actionable string can ride a write tool-call's
 * input (the recorded action) while the spoken announcement is mangled or
 * typo'd — the two surfaces disagree in BOTH directions, so the union of both
 * is the honest "what did the agent actually produce" scan.
 */

import type { ArtifactHandle } from "../../handle.js";
import type { ArtifactCollector } from "../../output-spec.js";
import { defineCollector } from "../../output-spec.js";
import { type BranchEntry, iterToolUses, lastMatchInBranch } from "../../transcript.js";

export interface TextScanCollectorOpts {
	/**
	 * Pattern to match against assistant text (and, on a text miss, tool-call
	 * argument values). REQUIRED — the framework has no default (layouts are
	 * project-specific). Use `g` to scan for all matches per block (helper takes
	 * the last); without `g`, only the first per block.
	 */
	pattern: RegExp;
	/** Constructs the artifact handle from the matched string (e.g. `fs`, `url`). */
	toHandle: (hit: string) => ArtifactHandle;
	/** Noun for the fatal-on-miss message ("path" / "URL"). */
	noun: string;
}

/** Last match of `pattern` against the branch's tool-use INPUT values — the
 *  fallback surface. Forward scan, last hit wins, mirroring the text scan's
 *  reverse-last-match semantics over the agent's recorded actions instead of
 *  its narration. */
function lastToolArgMatch(branch: BranchEntry[], pattern: RegExp, offsetStart?: number): string | undefined {
	let last: string | undefined;
	for (const use of iterToolUses(branch, offsetStart)) {
		for (const value of Object.values(use.input)) {
			if (typeof value !== "string") continue;
			const matches = value.match(pattern);
			if (matches !== null && matches.length > 0) last = matches[matches.length - 1];
		}
	}
	return last;
}

export function textScanCollector(opts: TextScanCollectorOpts): ArtifactCollector {
	const { pattern, toHandle, noun } = opts;
	return defineCollector({
		collect: (ctx) => {
			const hit =
				lastMatchInBranch(ctx.branch, pattern, ctx.branchOffset) ??
				lastToolArgMatch(ctx.branch, pattern, ctx.branchOffset);
			if (!hit) {
				return {
					kind: "fatal",
					message: `${ctx.skill} finished without producing a ${noun} matching ${pattern.source} (scanned assistant text and tool-call arguments)`,
				};
			}
			return { kind: "ok", artifacts: [{ handle: toHandle(hit), role: "primary" }] };
		},
	});
}

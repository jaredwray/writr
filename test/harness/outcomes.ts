import { Writr } from "../../src/writr.js";
import type { RenderOptions } from "../../src/types.js";
export type Outcome =
	| { kind: "success"; html: string }
	| { kind: "error"; category: "parse" };
/** Only a located MDX parser diagnostic is a parse rejection. Unknown errors escape. */
export function parseError(error: unknown, engine: "js" | "rust"): Outcome {
	const e = error as { message?: string; source?: string; ruleId?: string };
	const js =
		typeof e?.source === "string" &&
		/^(micromark-extension-mdx|mdast-util-mdx)/.test(e.source);
	const rust =
		typeof e?.message === "string" &&
		/^writr-rs: markdown parse error: /.test(e.message);
	if (engine === "js" ? js : rust) return { kind: "error", category: "parse" };
	throw error;
}
export function jsOutcome(
	input: string,
	options: RenderOptions = {},
	mode: "sync" | "validate" = "sync",
): Outcome {
	const writr = new Writr(input);
	let emitted: unknown;
	writr.on("error", (e) => {
		emitted = e;
	});
	try {
		if (mode === "validate") {
			const result = writr.validateSync(input, options);
			if (!result.valid) throw result.error;
			if (emitted !== undefined) throw emitted;
			return { kind: "success", html: "" };
		}
		const html = writr.renderSync({ ...options, caching: false });
		if (emitted !== undefined) throw emitted;
		return { kind: "success", html };
	} catch (error) {
		return parseError(error, "js");
	}
}
export async function jsAsyncOutcome(
	input: string,
	options: RenderOptions = {},
): Promise<Outcome> {
	const writr = new Writr(input);
	let emitted: unknown;
	writr.on("error", (e) => {
		emitted = e;
	});
	try {
		const html = await writr.render({ ...options, caching: false });
		if (emitted !== undefined) throw emitted;
		return { kind: "success", html };
	} catch (error) {
		return parseError(error, "js");
	}
}
export function outcomeEqual(actual: Outcome, expected: Outcome) {
	return JSON.stringify(actual) === JSON.stringify(expected);
}

/** Preserve JS diagnostics for reviewers without making error text a parity contract. */
export function jsErrorDetails(input: string, options: RenderOptions) {
	const writr = new Writr(input);
	let details: Record<string, unknown> | undefined;
	writr.on("error", (error) => {
		const e = error as Error & { source?: string; ruleId?: string };
		details = {
			name: e.name,
			message: e.message,
			source: e.source,
			ruleId: e.ruleId,
		};
	});
	writr.renderSync({ ...options, caching: false });
	if (!details)
		throw new Error("Declared rejection emitted no oracle diagnostic");
	return details;
}

export async function jsAsyncValidation(
	input: string,
	options: RenderOptions,
): Promise<Outcome> {
	const writr = new Writr(input);
	let emitted: unknown;
	writr.on("error", (e) => {
		emitted = e;
	});
	try {
		const result = await writr.validate(input, options);
		if (!result.valid) throw result.error;
		if (emitted !== undefined) throw emitted;
		return { kind: "success", html: "" };
	} catch (error) {
		return parseError(error, "js");
	}
}

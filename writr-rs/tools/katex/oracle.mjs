// The JavaScript oracle for writr-katex: the pinned katex@0.18.7 driven with
// exactly the call sequence rehype-katex@7.0.1 uses (writr registers the
// plugin without options). Used by gen-katex-fixtures.mjs and show.mjs; not
// meant to be run directly. Never fetches or upgrades dependencies.
import { importPinned } from "../pinned.mjs";

export const KATEX_VERSION = "0.18.7";

/**
 * The pinned katex@0.18.7 default export (`renderToString` etc.), from
 * dist/katex.mjs — the file rehype-katex's `import katex from 'katex'`
 * resolves to (exports["."].import), not the UMD `main` build.
 */
export async function loadKatex() {
	const { default: katex } = await importPinned(
		"katex",
		KATEX_VERSION,
		"dist/katex.mjs",
	);
	if (katex.version !== KATEX_VERSION) {
		throw new Error(`expected katex ${KATEX_VERSION}, loaded ${katex.version}`);
	}
	return katex;
}

/**
 * Render `value` the way rehype-katex@7.0.1 does (lib/index.js):
 * `renderToString` with `throwOnError: true`; on error retry with
 * `strict: 'ignore'` and `throwOnError: false` (a ParseError then renders as
 * KaTeX's own `katex-error` span, which is still `{html}`); if the retry
 * throws too, rehype-katex builds its own `katex-error` span whose title is
 * `String(firstError)` — returned here as `{error}`.
 *
 * KaTeX's console output is swallowed while rendering: strict-mode and
 * missing-metrics `console.warn`s, and what `\message`, `\errmessage` and
 * `\show` print (`console.log` / `console.error`). Returned strings are
 * well-formed UTF-16 (lone surrogates replaced by U+FFFD, e.g. from
 * `\char"D800` or a `\verb` delimited by half a surrogate pair), so their
 * UTF-8 bytes are unambiguous — the same bytes Node's UTF-8 encoder writes
 * for the raw string, so the hash does not depend on this step.
 *
 * @returns {{html: string} | {error: string}}
 */
export function renderLikeRehype(katex, value, displayMode) {
	const { log, warn, error: logError } = console;
	console.log = () => {};
	console.warn = () => {};
	console.error = () => {};
	try {
		try {
			return {
				html: katex
					.renderToString(value, { displayMode, throwOnError: true })
					.toWellFormed(),
			};
		} catch (error) {
			// rehype-katex reads `error.name.toLowerCase()` (its vfile message's
			// ruleId) before retrying. KaTeX only ever throws Error instances, but
			// mirror the read so a thrown non-Error would escape here just as it
			// escapes the plugin, instead of being retried.
			error.name.toLowerCase();
			try {
				return {
					html: katex
						.renderToString(value, {
							displayMode,
							strict: "ignore",
							throwOnError: false,
						})
						.toWellFormed(),
				};
			} catch {
				return { error: String(error).toWellFormed() };
			}
		}
	} finally {
		console.log = log;
		console.warn = warn;
		console.error = logError;
	}
}

const TWO_32 = 4294967296;

/**
 * FNV-1a 64-bit hash of the UTF-8 bytes of `text`, as 16 lowercase hex
 * digits (offset basis 0xcbf29ce484222325, prime 0x100000001b3).
 */
export function fnv1a64(text) {
	const bytes = Buffer.from(text, "utf8");
	// Split into 32-bit halves; prime = 2^40 + 0x1b3.
	let hi = 0xcbf29ce4;
	let lo = 0x84222325;
	for (let i = 0; i < bytes.length; i++) {
		lo = (lo ^ bytes[i]) >>> 0;
		const low = lo * 0x1b3;
		const carry = Math.floor(low / TWO_32);
		hi = (hi * 0x1b3 + carry + ((lo << 8) >>> 0)) % TWO_32;
		lo = low % TWO_32;
	}
	return hi.toString(16).padStart(8, "0") + lo.toString(16).padStart(8, "0");
}

/** UTF-8 byte length of `text`. */
export function utf8Length(text) {
	return Buffer.byteLength(text, "utf8");
}

/**
 * Oracle outcome for one `(tex, display)` pair in fixture form.
 *
 * @returns {{kind: "html" | "error", output: string, hash: string, len: number}}
 */
export function outcome(katex, tex, display) {
	const result = renderLikeRehype(katex, tex, display);
	const kind = "html" in result ? "html" : "error";
	const output = kind === "html" ? result.html : result.error;
	return { kind, output, hash: fnv1a64(output), len: utf8Length(output) };
}

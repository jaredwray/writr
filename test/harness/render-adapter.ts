import { Writr } from "../../src/writr.js";
import { normalize } from "./normalize.js";
import type { Profile } from "./profiles.js";

/**
 * A pluggable markdown rendering backend. The current JS engine implements
 * this for golden generation and the default check; a future native (Rust)
 * engine implements the same interface and is validated against the very same
 * JS-generated goldens — this is the migration safety net.
 */
export type RenderAdapter = {
	/** Stable engine identifier, e.g. `writr-js` or `writr-rust`. */
	name: string;
	/**
	 * Render `input` markdown under `profile` and return normalized HTML.
	 * Implementations must be deterministic and side-effect free.
	 */
	render(input: string, profile: Profile): Promise<string>;
};

/**
 * Adapter backed by the current in-repo Writr engine.
 *
 * Caching is forced off so every call is a true re-render. The profile's
 * options fully specify every feature flag, so merging over Writr's defaults
 * yields exactly the intended configuration.
 */
export class WritrJsAdapter implements RenderAdapter {
	public readonly name = "writr-js";

	public async render(input: string, profile: Profile): Promise<string> {
		const writr = new Writr(input);
		// Writr catches render exceptions and emits them via "error" while
		// returning "". Capture that signal so genuine failures surface as
		// thrown errors here — an empty result with NO emitted error is a
		// legitimate render (e.g. a raw-HTML-only document under rawHtml:false).
		let emitted: unknown;
		writr.on("error", (error) => {
			emitted = error;
		});
		const html = await writr.render({ ...profile.options, caching: false });
		throwIfEmitted(emitted);
		return normalize(html);
	}

	/** Synchronous render, used to assert sync/async parity during generation. */
	public renderSync(input: string, profile: Profile): string {
		const writr = new Writr(input);
		let emitted: unknown;
		writr.on("error", (error) => {
			emitted = error;
		});
		const html = writr.renderSync({ ...profile.options, caching: false });
		throwIfEmitted(emitted);
		return normalize(html);
	}
}

/** Re-throw an error captured from Writr's "error" event, if any. */
function throwIfEmitted(emitted: unknown): void {
	if (emitted !== undefined) {
		throw emitted instanceof Error ? emitted : new Error(String(emitted));
	}
}

/**
 * Select the active adapter from the `HARNESS_ENGINE` environment variable.
 * Defaults to the JS engine. A `writr-rust` adapter can be wired here when the
 * native engine lands.
 */
export function getAdapter(
	engine = process.env.HARNESS_ENGINE ?? "writr-js",
): RenderAdapter {
	switch (engine) {
		case "writr-js":
			return new WritrJsAdapter();
		default:
			throw new Error(
				`Unknown HARNESS_ENGINE "${engine}". Known engines: writr-js. ` +
					`Add a RenderAdapter implementation to register a new engine.`,
			);
	}
}

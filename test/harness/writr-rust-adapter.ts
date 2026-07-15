import { createRequire } from "node:module";
import { normalize } from "./normalize.js";
import type { Profile } from "./profiles.js";
import type { RenderAdapter } from "./render-adapter.js";

type WritrRsBinding = {
	render(input: string, options?: Record<string, boolean>): string;
	renderAsync(input: string, options?: Record<string, boolean>): Promise<string>;
	engineVersion(): string;
};

let binding: WritrRsBinding | undefined;

/** Load the native binding once (build with `pnpm build:rs` first). */
function loadBinding(): WritrRsBinding {
	if (!binding) {
		const require = createRequire(import.meta.url);
		binding = require("../../writr-rs/crates/writr-node/index.js") as WritrRsBinding;
	}
	return binding;
}

/**
 * Adapter backed by the writr-rs native engine.
 *
 * The engine is deterministic and uncached, so `caching` needs no explicit
 * handling. Errors thrown by the binding propagate — the same semantics as
 * `WritrJsAdapter`'s `throwIfEmitted`.
 */
export class WritrRustAdapter implements RenderAdapter {
	public readonly name = "writr-rust";

	public async render(input: string, profile: Profile): Promise<string> {
		const { render } = loadBinding();
		return normalize(render(input, { ...profile.options }));
	}
}

import { createRequire } from "node:module";
import { normalize } from "./normalize.js";
import type { Profile } from "./profiles.js";
import type { RenderAdapter } from "./render-adapter.js";

type WritrRsBinding = {
	render(input: string, options?: Record<string, boolean>): string;
	renderAsync(
		input: string,
		options?: Record<string, boolean>,
	): Promise<string>;
	engineVersion(): string;
};

let binding: WritrRsBinding | undefined;

/** Load the native binding once (build with `pnpm build:rs` first). */
export function loadBinding(): WritrRsBinding {
	if (!binding) {
		const require = createRequire(import.meta.url);
		binding =
			require("../../writr-rs/crates/writr-node/index.js") as WritrRsBinding;
	}
	return binding;
}

/**
 * Adapter backed by the writr-rs native engine.
 *
 * The harness explicitly disables bounded internal caches. Errors thrown by the binding propagate — the same semantics as
 * `WritrJsAdapter`'s `throwIfEmitted`.
 */
export class WritrRustAdapter implements RenderAdapter {
	public readonly name = "writr-rust";

	public async render(input: string, profile: Profile): Promise<string> {
		return normalize(await this.renderRaw(input, profile));
	}
	public renderRaw(input: string, profile: Profile): Promise<string> {
		return loadBinding().renderAsync(input, {
			...profile.options,
			caching: false,
		});
	}
	public renderRawSync(input: string, profile: Profile): string {
		return loadBinding().render(input, { ...profile.options, caching: false });
	}
}

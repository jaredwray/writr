import { CacheableMemory } from "cacheable";
import { Hashery } from "hashery";
import type { RenderOptions } from "./writr.js";

export class WritrCache {
	private readonly _store: CacheableMemory = new CacheableMemory();
	private readonly _hashStore: CacheableMemory = new CacheableMemory();
	private readonly _hash: Hashery = new Hashery();

	public get store(): CacheableMemory {
		return this._store;
	}

	public get hashStore(): CacheableMemory {
		return this._hashStore;
	}

	public get(markdown: string, options?: RenderOptions): string | undefined {
		const key = this.hash(markdown, options);
		return this._store.get<string>(key);
	}

	public set(markdown: string, value: string, options?: RenderOptions) {
		const key = this.hash(markdown, options);
		this._store.set(key, value);
	}

	public clear() {
		this._store.clear();
		this._hashStore.clear();
	}

	public hash(markdown: string, options?: RenderOptions): string {
		const sanitizedOptions = this.sanitizeOptions(options);
		const content = { markdown, options: sanitizedOptions };
		const key = JSON.stringify(content);
		const result = this._hashStore.get<string>(key);
		if (result) {
			return result;
		}

		const hash = this._hash.toHashSync(content);
		this._hashStore.set(key, hash);

		return hash;
	}

	/**
	 * Sanitizes render options to only include serializable properties for caching.
	 * This prevents issues with structuredClone when options contain Promises, functions, or circular references.
	 * @param {RenderOptions} [options] The render options to sanitize
	 * @returns {RenderOptions | undefined} A new object with only the known RenderOptions properties
	 */
	private sanitizeOptions(options?: RenderOptions): RenderOptions | undefined {
		if (!options) {
			return undefined;
		}

		// Only extract the known, serializable properties from RenderOptions
		const sanitized: RenderOptions = {};

		if (options.emoji !== undefined) {
			sanitized.emoji = options.emoji;
		}

		/* v8 ignore next -- @preserve */
		if (options.toc !== undefined) {
			sanitized.toc = options.toc;
		}

		if (options.slug !== undefined) {
			sanitized.slug = options.slug;
		}

		if (options.highlight !== undefined) {
			sanitized.highlight = options.highlight;
		}

		if (options.gfm !== undefined) {
			sanitized.gfm = options.gfm;
		}

		if (options.math !== undefined) {
			sanitized.math = options.math;
		}

		if (options.mdx !== undefined) {
			sanitized.mdx = options.mdx;
		}

		if (options.caching !== undefined) {
			sanitized.caching = options.caching;
		}

		return sanitized;
	}
}

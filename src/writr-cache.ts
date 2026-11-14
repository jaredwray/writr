import { createHash } from "node:crypto";
import { CacheableMemory } from "cacheable";
import type { RenderOptions } from "./types.js";

export class WritrCache {
	private readonly _store: CacheableMemory = new CacheableMemory();
	private readonly _hashStore: CacheableMemory = new CacheableMemory();

	public get store(): CacheableMemory {
		return this._store;
	}

	public get hashStore(): CacheableMemory {
		return this._hashStore;
	}

	public get(
		markdown: string,
		options?: RenderOptions,
		source?: string,
	): string | undefined {
		const key = this.hash(markdown, options, source);
		return this._store.get<string>(key);
	}

	public set(
		markdown: string,
		value: string,
		options?: RenderOptions,
		source?: string,
	) {
		const key = this.hash(markdown, options, source);
		this._store.set(key, value);
	}

	public clear() {
		this._store.clear();
		this._hashStore.clear();
	}

	/**
	 * Derive the cache identity for one render.
	 * @param {string} markdown The body the pipeline consumed.
	 * @param {RenderOptions} [options] The options the processor was built from.
	 * @param {string} [source] The document text the body was derived from.
	 * Omitted when it is identical to `markdown`.
	 * @returns {string} A SHA-256 digest over the identity.
	 *
	 * The identity includes the body (so a `beforeRender` substitution keys
	 * its own output) and, when it differs, the source document (so a plugin
	 * reading `writr.frontMatter` cannot replay output across a front-matter
	 * change that leaves the body identical).
	 */
	public hash(
		markdown: string,
		options?: RenderOptions,
		source?: string,
	): string {
		const sanitizedOptions = this.sanitizeOptions(options);
		const content =
			source === undefined || source === markdown
				? { markdown, options: sanitizedOptions }
				: { markdown, source, options: sanitizedOptions };
		const key = JSON.stringify(content);
		const result = this._hashStore.get<string>(key);
		if (result) {
			return result;
		}

		// A full-width digest: hashery's default synchronous provider is 32-bit
		// djb2, which is forgeable by a chosen document, so two different
		// documents (or two different bodies of one) could share an entry.
		const hash = createHash("sha256").update(key).digest("hex");
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

		// rawHtml changes the emitted HTML (it gates allowDangerousHtml and the
		// rehype-raw stage), so it must be part of the key. Omitting it let a
		// rawHtml:false render be answered with a rawHtml:true render's output.
		if (options.rawHtml !== undefined) {
			sanitized.rawHtml = options.rawHtml;
		}

		if (options.caching !== undefined) {
			sanitized.caching = options.caching;
		}

		return sanitized;
	}
}

import fs from "node:fs";
import { dirname } from "node:path";
import { Hookified } from "hookified";
import parse, { type HTMLReactParserOptions } from "html-react-parser";
import * as yaml from "js-yaml";
import type React from "react";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import remarkEmoji from "remark-emoji";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkMDX from "remark-mdx";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import remarkToc from "remark-toc";
import { unified } from "unified";
import { WritrCache } from "./writr-cache.js";

/**
 * Writr options.
 * @typedef {Object} WritrOptions
 * @property {RenderOptions} [renderOptions] - Default render options (default: undefined)
 * @property {boolean} [throwErrors] - Throw error (default: false)
 */
export type WritrOptions = {
	renderOptions?: RenderOptions; // Default render options (default: undefined)
	throwErrors?: boolean; // Throw error (default: false)
};

/**
 * Render options.
 * @typedef {Object} RenderOptions
 * @property {boolean} [emoji] - Emoji support (default: true)
 * @property {boolean} [toc] - Table of contents generation (default: true)
 * @property {boolean} [slug] - Slug generation (default: true)
 * @property {boolean} [highlight] - Code highlighting (default: true)
 * @property {boolean} [gfm] - Github flavor markdown (default: true)
 * @property {boolean} [math] - Math support (default: true)
 * @property {boolean} [mdx] - MDX support (default: true)
 * @property {boolean} [caching] - Caching (default: false)
 */
export type RenderOptions = {
	emoji?: boolean; // Emoji support (default: true)
	toc?: boolean; // Table of contents generation (default: true)
	slug?: boolean; // Slug generation (default: true)
	highlight?: boolean; // Code highlighting (default: true)
	gfm?: boolean; // Github flavor markdown (default: true)
	math?: boolean; // Math support (default: true)
	mdx?: boolean; // MDX support (default: true)
	caching?: boolean; // Caching (default: false)
};

/**
 * Validation result.
 * @typedef {Object} WritrValidateResult
 * @property {boolean} valid - Whether the markdown is valid
 * @property {Error} [error] - Error if validation failed
 */
export type WritrValidateResult = {
	valid: boolean;
	error?: Error;
};

export enum WritrHooks {
	beforeRender = "beforeRender",
	afterRender = "afterRender",
	saveToFile = "saveToFile",
	renderToFile = "renderToFile",
	loadFromFile = "loadFromFile",
}

export class Writr extends Hookified {
	public engine = unified()
		.use(remarkParse)
		.use(remarkGfm) // Use GitHub Flavored Markdown
		.use(remarkToc) // Add table of contents
		.use(remarkEmoji) // Add emoji support
		.use(remarkRehype) // Convert markdown to HTML
		.use(rehypeSlug) // Add slugs to headings in HTML
		.use(remarkMath) // Add math support
		.use(rehypeKatex) // Add math support
		.use(rehypeHighlight) // Apply syntax highlighting
		.use(remarkMDX) // Add MDX support
		.use(rehypeStringify); // Stringify HTML

	private readonly _options: WritrOptions = {
		throwErrors: false,
		renderOptions: {
			emoji: true,
			toc: true,
			slug: true,
			highlight: true,
			gfm: true,
			math: true,
			mdx: true,
			caching: false,
		},
	};

	private _content = "";

	private readonly _cache = new WritrCache();

	/**
	 * Initialize Writr. Accepts a string or options object.
	 * @param {string | WritrOptions} [arguments1] If you send in a string, it will be used as the markdown content. If you send in an object, it will be used as the options.
	 * @param {WritrOptions} [arguments2] This is if you send in the content in the first argument and also want to send in options.
	 *
	 * @example
	 * const writr = new Writr('Hello, world!', {caching: false});
	 */
	constructor(arguments1?: string | WritrOptions, arguments2?: WritrOptions) {
		super();
		if (typeof arguments1 === "string") {
			this._content = arguments1;
		} else if (arguments1) {
			this._options = this.mergeOptions(this._options, arguments1);
			if (this._options.renderOptions) {
				this.engine = this.createProcessor(this._options.renderOptions);
			}
		}

		if (arguments2) {
			this._options = this.mergeOptions(this._options, arguments2);
			if (this._options.renderOptions) {
				this.engine = this.createProcessor(this._options.renderOptions);
			}
		}
	}

	/**
	 * Get the options.
	 * @type {WritrOptions}
	 */
	public get options(): WritrOptions {
		return this._options;
	}

	/**
	 * Get the Content. This is the markdown content and front matter if it exists.
	 * @type {WritrOptions}
	 */
	public get content(): string {
		return this._content;
	}

	/**
	 * Set the Content. This is the markdown content and front matter if it exists.
	 * @type {WritrOptions}
	 */
	public set content(value: string) {
		this._content = value;
	}

	/**
	 * Get the cache.
	 * @type {WritrCache}
	 */
	public get cache(): WritrCache {
		return this._cache;
	}

	/**
	 * Get the front matter raw content.
	 * @type {string} The front matter content including the delimiters.
	 */
	public get frontMatterRaw(): string {
		// Is there front matter content?
		if (!this._content.trimStart().startsWith("---")) {
			return "";
		}

		const match = /^\s*(---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$))/.exec(
			this._content,
		);
		if (match) {
			return match[1];
		}

		return "";
	}

	/**
	 * Get the body content without the front matter.
	 * @type {string} The markdown content without the front matter.
	 */
	public get body(): string {
		const frontMatter = this.frontMatterRaw;
		if (frontMatter === "") {
			return this._content;
		}

		return this._content
			.slice(this._content.indexOf(frontMatter) + frontMatter.length)
			.trim();
	}

	/**
	 * Get the markdown content. This is an alias for the body property.
	 * @type {string} The markdown content.
	 */
	public get markdown(): string {
		return this.body;
	}

	/**
	 * Get the front matter content as an object.
	 * @type {Record<string, any>} The front matter content as an object.
	 */
	// biome-ignore lint/suspicious/noExplicitAny: expected
	public get frontMatter(): Record<string, any> {
		const frontMatter = this.frontMatterRaw;
		const match = /^---\s*([\s\S]*?)\s*---\s*/.exec(frontMatter);
		if (match) {
			try {
				// biome-ignore lint/suspicious/noExplicitAny: expected
				return yaml.load(match[1].trim()) as Record<string, any>;
				/* c8 ignore next 4 */
			} catch (error) {
				this.emit("error", error);
			}
		}

		return {};
	}

	/**
	 * Set the front matter content as an object.
	 * @type {Record<string, any>} The front matter content as an object.
	 */
	// biome-ignore lint/suspicious/noExplicitAny: expected
	public set frontMatter(data: Record<string, any>) {
		const frontMatter = this.frontMatterRaw;
		const yamlString = yaml.dump(data);
		const newFrontMatter = `---\n${yamlString}---\n`;
		this._content = this._content.replace(frontMatter, newFrontMatter);
	}

	/**
	 * Get the front matter value for a key.
	 * @param {string} key The key to get the value for.
	 * @returns {T} The value for the key.
	 */
	public getFrontMatterValue<T>(key: string): T {
		return this.frontMatter[key] as T;
	}

	/**
	 * Render the markdown content to HTML.
	 * @param {RenderOptions} [options] The render options.
	 * @returns {Promise<string>} The rendered HTML content.
	 */
	public async render(options?: RenderOptions): Promise<string> {
		try {
			let { engine } = this;
			if (options) {
				options = { ...this._options.renderOptions, ...options };
				engine = this.createProcessor(options);
			}

			const renderData = {
				content: this._content,
				body: this.body,
				options,
			};

			await this.hook(WritrHooks.beforeRender, renderData);

			const resultData = {
				result: "",
			};
			if (this.isCacheEnabled(renderData.options)) {
				const cached = this._cache.get(renderData.content, renderData.options);
				if (cached) {
					return cached;
				}
			}

			const file = await engine.process(renderData.body);
			resultData.result = String(file);
			if (this.isCacheEnabled(renderData.options)) {
				this._cache.set(
					renderData.content,
					resultData.result,
					renderData.options,
				);
			}

			await this.hook(WritrHooks.afterRender, resultData);

			return resultData.result;
		} catch (error) {
			throw new Error(`Failed to render markdown: ${(error as Error).message}`);
		}
	}

	/**
	 * Render the markdown content to HTML synchronously.
	 * @param {RenderOptions} [options] The render options.
	 * @returns {string} The rendered HTML content.
	 */
	public renderSync(options?: RenderOptions): string {
		try {
			let { engine } = this;
			if (options) {
				options = { ...this._options.renderOptions, ...options };
				engine = this.createProcessor(options);
			}

			const renderData = {
				content: this._content,
				body: this.body,
				options,
			};

			this.hook(WritrHooks.beforeRender, renderData);

			const resultData = {
				result: "",
			};
			if (this.isCacheEnabled(renderData.options)) {
				const cached = this._cache.get(renderData.content, renderData.options);
				if (cached) {
					return cached;
				}
			}

			const file = engine.processSync(renderData.body);
			resultData.result = String(file);
			if (this.isCacheEnabled(renderData.options)) {
				this._cache.set(
					renderData.content,
					resultData.result,
					renderData.options,
				);
			}

			this.hook(WritrHooks.afterRender, resultData);

			return resultData.result;
		} catch (error) {
			throw new Error(`Failed to render markdown: ${(error as Error).message}`);
		}
	}

	/**
	 * Validate the markdown content by attempting to render it.
	 * @param {string} [content] The markdown content to validate. If not provided, uses the current content.
	 * @param {RenderOptions} [options] The render options.
	 * @returns {Promise<WritrValidateResult>} An object with a valid boolean and optional error.
	 */
	public async validate(
		content?: string,
		options?: RenderOptions,
	): Promise<WritrValidateResult> {
		const originalContent = this._content;
		try {
			if (content !== undefined) {
				this._content = content;
			}

			let { engine } = this;
			if (options) {
				options = {
					...this._options.renderOptions,
					...options,
					caching: false,
				};
				engine = this.createProcessor(options);
			}

			await engine.run(engine.parse(this.body));

			if (content !== undefined) {
				this._content = originalContent;
			}

			return { valid: true };
		} catch (error) {
			if (content !== undefined) {
				this._content = originalContent;
			}
			return { valid: false, error: error as Error };
		}
	}

	/**
	 * Validate the markdown content by attempting to render it synchronously.
	 * @param {string} [content] The markdown content to validate. If not provided, uses the current content.
	 * @param {RenderOptions} [options] The render options.
	 * @returns {WritrValidateResult} An object with a valid boolean and optional error.
	 */
	public validateSync(
		content?: string,
		options?: RenderOptions,
	): WritrValidateResult {
		const originalContent = this._content;
		try {
			if (content !== undefined) {
				this._content = content;
			}

			let { engine } = this;
			if (options) {
				options = {
					...this._options.renderOptions,
					...options,
					caching: false,
				};
				engine = this.createProcessor(options);
			}

			engine.runSync(engine.parse(this.body));

			if (content !== undefined) {
				this._content = originalContent;
			}

			return { valid: true };
		} catch (error) {
			if (content !== undefined) {
				this._content = originalContent;
			}
			return { valid: false, error: error as Error };
		}
	}

	/**
	 * Render the markdown content and save it to a file. If the directory doesn't exist it will be created.
	 * @param {string} filePath The file path to save the rendered markdown content to.
	 * @param {RenderOptions} [options] the render options.
	 */
	public async renderToFile(
		filePath: string,
		options?: RenderOptions,
	): Promise<void> {
		try {
			const { writeFile, mkdir } = fs.promises;
			const directoryPath = dirname(filePath);
			const content = await this.render(options);
			await mkdir(directoryPath, { recursive: true });
			const data = {
				filePath,
				content,
			};
			await this.hook(WritrHooks.renderToFile, data);
			await writeFile(data.filePath, data.content);
			/* c8 ignore next 6 */
		} catch (error) {
			this.emit("error", error);
			if (this._options.throwErrors) {
				throw error;
			}
		}
	}

	/**
	 * Render the markdown content and save it to a file synchronously. If the directory doesn't exist it will be created.
	 * @param {string} filePath The file path to save the rendered markdown content to.
	 * @param {RenderOptions} [options] the render options.
	 */
	public renderToFileSync(filePath: string, options?: RenderOptions): void {
		try {
			const directoryPath = dirname(filePath);
			const content = this.renderSync(options);
			fs.mkdirSync(directoryPath, { recursive: true });
			const data = {
				filePath,
				content,
			};

			this.hook(WritrHooks.renderToFile, data);

			fs.writeFileSync(data.filePath, data.content);
			/* c8 ignore next 6 */
		} catch (error) {
			this.emit("error", error);
			if (this._options.throwErrors) {
				throw error;
			}
		}
	}

	/**
	 * Render the markdown content to React.
	 * @param {RenderOptions} [options] The render options.
	 * @param {HTMLReactParserOptions} [reactParseOptions] The HTML React parser options.
	 * @returns {Promise<string | React.JSX.Element | React.JSX.Element[]>} The rendered React content.
	 */
	public async renderReact(
		options?: RenderOptions,
		reactParseOptions?: HTMLReactParserOptions,
	): Promise<string | React.JSX.Element | React.JSX.Element[]> {
		const html = await this.render(options);

		return parse(html, reactParseOptions);
	}

	/**
	 * Render the markdown content to React synchronously.
	 * @param {RenderOptions} [options] The render options.
	 * @param {HTMLReactParserOptions} [reactParseOptions] The HTML React parser options.
	 * @returns {string | React.JSX.Element | React.JSX.Element[]} The rendered React content.
	 */
	public renderReactSync(
		options?: RenderOptions,
		reactParseOptions?: HTMLReactParserOptions,
	): string | React.JSX.Element | React.JSX.Element[] {
		const html = this.renderSync(options);
		return parse(html, reactParseOptions);
	}

	/**
	 * Load markdown content from a file.
	 * @param {string} filePath The file path to load the markdown content from.
	 * @returns {Promise<void>}
	 */
	public async loadFromFile(filePath: string): Promise<void> {
		try {
			const { readFile } = fs.promises;
			const data = {
				content: "",
			};
			data.content = await readFile(filePath, "utf8");

			await this.hook(WritrHooks.loadFromFile, data);
			this._content = data.content;
			/* c8 ignore next 6 */
		} catch (error) {
			this.emit("error", error);
			if (this._options.throwErrors) {
				throw error;
			}
		}
	}

	/**
	 * Load markdown content from a file synchronously.
	 * @param {string} filePath The file path to load the markdown content from.
	 * @returns {void}
	 */
	public loadFromFileSync(filePath: string): void {
		try {
			const data = {
				content: "",
			};
			data.content = fs.readFileSync(filePath, "utf8");

			this.hook(WritrHooks.loadFromFile, data);
			this._content = data.content;
			/* c8 ignore next 6 */
		} catch (error) {
			this.emit("error", error);
			if (this._options.throwErrors) {
				throw error;
			}
		}
	}

	/**
	 * Save the markdown content to a file. If the directory doesn't exist it will be created.
	 * @param {string} filePath The file path to save the markdown content to.
	 * @returns {Promise<void>}
	 */
	public async saveToFile(filePath: string): Promise<void> {
		try {
			const { writeFile, mkdir } = fs.promises;
			const directoryPath = dirname(filePath);
			await mkdir(directoryPath, { recursive: true });
			const data = {
				filePath,
				content: this._content,
			};
			await this.hook(WritrHooks.saveToFile, data);

			await writeFile(data.filePath, data.content);
			/* c8 ignore next 6 */
		} catch (error) {
			this.emit("error", error);
			if (this._options.throwErrors) {
				throw error;
			}
		}
	}

	/**
	 * Save the markdown content to a file synchronously. If the directory doesn't exist it will be created.
	 * @param {string} filePath The file path to save the markdown content to.
	 * @returns {void}
	 */
	public saveToFileSync(filePath: string): void {
		try {
			const directoryPath = dirname(filePath);
			fs.mkdirSync(directoryPath, { recursive: true });
			const data = {
				filePath,
				content: this._content,
			};

			this.hook(WritrHooks.saveToFile, data);

			fs.writeFileSync(data.filePath, data.content);
			/* c8 ignore next 6 */
		} catch (error) {
			this.emit("error", error);
			if (this._options.throwErrors) {
				throw error;
			}
		}
	}

	private isCacheEnabled(options?: RenderOptions): boolean {
		if (options?.caching !== undefined) {
			return options.caching;
		}

		return this._options?.renderOptions?.caching ?? false;
	}

	// biome-ignore lint/suspicious/noExplicitAny: expected unified processor
	private createProcessor(options: RenderOptions): any {
		const processor = unified().use(remarkParse);

		if (options.gfm) {
			processor.use(remarkGfm);
		}

		if (options.toc) {
			processor.use(remarkToc, { heading: "toc|table of contents" });
		}

		if (options.emoji) {
			processor.use(remarkEmoji);
		}

		processor.use(remarkRehype);

		if (options.slug) {
			processor.use(rehypeSlug);
		}

		if (options.highlight) {
			processor.use(rehypeHighlight);
		}

		if (options.math) {
			processor.use(remarkMath).use(rehypeKatex);
		}

		if (options.mdx) {
			processor.use(remarkMDX);
		}

		processor.use(rehypeStringify);

		return processor;
	}

	private mergeOptions(
		current: WritrOptions,
		options: WritrOptions,
	): WritrOptions {
		if (options.throwErrors !== undefined) {
			current.throwErrors = options.throwErrors;
		}

		if (options.renderOptions) {
			current.renderOptions ??= {};

			this.mergeRenderOptions(current.renderOptions, options.renderOptions);
		}

		return current;
	}

	private mergeRenderOptions(
		current: RenderOptions,
		options: RenderOptions,
	): RenderOptions {
		if (options.emoji !== undefined) {
			current.emoji = options.emoji;
		}

		if (options.toc !== undefined) {
			current.toc = options.toc;
		}

		if (options.slug !== undefined) {
			current.slug = options.slug;
		}

		if (options.highlight !== undefined) {
			current.highlight = options.highlight;
		}

		if (options.gfm !== undefined) {
			current.gfm = options.gfm;
		}

		if (options.math !== undefined) {
			current.math = options.math;
		}

		if (options.mdx !== undefined) {
			current.mdx = options.mdx;
		}

		if (options.caching !== undefined) {
			current.caching = options.caching;
		}

		return current;
	}
}

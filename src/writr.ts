import fs from 'node:fs';
import {dirname} from 'node:path';
import {unified} from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeSlug from 'rehype-slug';
import rehypeHighlight from 'rehype-highlight';
import rehypeStringify from 'rehype-stringify';
import remarkToc from 'remark-toc';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkEmoji from 'remark-emoji';
import remarkMDX from 'remark-mdx';
import type React from 'react';
import parse, {type HTMLReactParserOptions} from 'html-react-parser';
import * as yaml from 'js-yaml';
import {Hookified} from 'hookified';
import {WritrCache} from './writr-cache.js';

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

export enum WritrHooks {
	beforeRender = 'beforeRender',
	afterRender = 'afterRender',
	beforeSaveToFile = 'beforeSaveToFile',
	beforeRenderToFile = 'beforeRenderToFile',
	beforeLoadFromFile = 'beforeLoadFromFile',
	afterLoadFromFile = 'afterLoadFromFile',
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

	private _content = '';

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
		if (typeof arguments1 === 'string') {
			this._content = arguments1;
		} else if (arguments1) {
			this._options = this.mergeOptions(this._options, arguments1);
			if (this._options.renderOptions) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				this.engine = this.createProcessor(this._options.renderOptions);
			}
		}

		if (arguments2) {
			this._options = this.mergeOptions(this._options, arguments2);
			if (this._options.renderOptions) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
	get frontMatterRaw(): string {
		// Is there front matter content?
		if (!this._content.trimStart().startsWith('---')) {
			return '';
		}

		const start = this._content.indexOf('---\n');

		const end = this._content.indexOf('\n---\n', start + 4);
		if (end === -1) {
			return '';
		} // Return empty string if no ending delimiter is found

		return this._content.slice(start, end + 5); // Extract front matter including delimiters
	}

	/**
	 * Get the body content without the front matter.
	 * @type {string} The markdown content without the front matter.
	 */
	get body(): string {
		// Is there front matter content?
		if (this.frontMatterRaw === '') {
			return this._content;
		}

		const end = this._content.indexOf('\n---\n');

		// Return the content after the closing --- marker
		return this._content.slice(Math.max(0, end + 5)).trim();
	}

	/**
	 * Get the markdown content. This is an alias for the body property.
	 * @type {string} The markdown content.
	 */
	get markdown(): string {
		return this.body;
	}

	/**
	 * Get the front matter content as an object.
	 * @type {Record<string, any>} The front matter content as an object.
	 */
	get frontMatter(): Record<string, any> {
		const frontMatter = this.frontMatterRaw;
		const match = /^---\s*([\s\S]*?)\s*---\s*/.exec(frontMatter);
		if (match) {
			try {
				return yaml.load(match[1].trim()) as Record<string, any>;
			/* c8 ignore next 4 */
			} catch (error) {
				this.emit('error', error);
			}
		}

		return {};
	}

	/**
	 * Set the front matter content as an object.
	 * @type {Record<string, any>} The front matter content as an object.
	 */
	set frontMatter(data: Record<string, any>) {
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
	async render(options?: RenderOptions): Promise<string> {
		try {
			let {engine} = this;
			if (options) {
				options = {...this._options.renderOptions, ...options};
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				engine = this.createProcessor(options);
			}

			const renderData = {
				content: this._content,
				body: this.body,
				options,
			};

			await this.hook(WritrHooks.beforeRender, renderData);

			const resultData = {
				result: '',
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
				this._cache.set(renderData.content, resultData.result, renderData.options);
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
	renderSync(options?: RenderOptions): string {
		try {
			let {engine} = this;
			if (options) {
				options = {...this._options.renderOptions, ...options};
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				engine = this.createProcessor(options);
			}

			const renderData = {
				content: this._content,
				body: this.body,
				options,
			};

			// eslint-disable-next-line @typescript-eslint/no-floating-promises
			this.hook(WritrHooks.beforeRender, renderData);

			const resultData = {
				result: '',
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
				this._cache.set(renderData.content, resultData.result, renderData.options);
			}

			// eslint-disable-next-line @typescript-eslint/no-floating-promises
			this.hook(WritrHooks.afterRender, resultData);

			return resultData.result;
		} catch (error) {
			throw new Error(`Failed to render markdown: ${(error as Error).message}`);
		}
	}

	/**
	 * Render the markdown content and save it to a file. If the directory doesn't exist it will be created.
	 * @param {string} filePath The file path to save the rendered markdown content to.
	 * @param {RenderOptions} [options] the render options.
	 */
	async renderToFile(filePath: string, options?: RenderOptions): Promise<void> {
		try {
			const {writeFile, mkdir} = fs.promises;
			const directoryPath = dirname(filePath);
			const content = await this.render(options);
			await mkdir(directoryPath, {recursive: true});
			const data = {
				filePath,
				content,
			};
			await this.hook(WritrHooks.beforeRenderToFile, data);
			await writeFile(data.filePath, data.content);
		/* c8 ignore next 6 */
		} catch (error) {
			this.emit('error', error);
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
	renderToFileSync(filePath: string, options?: RenderOptions): void {
		try {
			const directoryPath = dirname(filePath);
			const content = this.renderSync(options);
			fs.mkdirSync(directoryPath, {recursive: true});
			const data = {
				filePath,
				content,
			};
			// eslint-disable-next-line @typescript-eslint/no-floating-promises
			this.hook(WritrHooks.beforeRenderToFile, data);

			fs.writeFileSync(data.filePath, data.content);
		/* c8 ignore next 6 */
		} catch (error) {
			this.emit('error', error);
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
	async renderReact(options?: RenderOptions, reactParseOptions?: HTMLReactParserOptions): Promise<string | React.JSX.Element | React.JSX.Element[]> {
		const html = await this.render(options);

		return parse(html, reactParseOptions);
	}

	/**
	 * Render the markdown content to React synchronously.
	 * @param {RenderOptions} [options] The render options.
	 * @param {HTMLReactParserOptions} [reactParseOptions] The HTML React parser options.
	 * @returns {string | React.JSX.Element | React.JSX.Element[]} The rendered React content.
	 */
	renderReactSync(options?: RenderOptions, reactParseOptions?: HTMLReactParserOptions): string | React.JSX.Element | React.JSX.Element[] {
		const html = this.renderSync(options);
		return parse(html, reactParseOptions);
	}

	/**
	 * Load markdown content from a file.
	 * @param {string} filePath The file path to load the markdown content from.
	 * @returns {Promise<void>}
	 */
	async loadFromFile(filePath: string): Promise<void> {
		const {readFile} = fs.promises;
		this._content = await readFile(filePath, 'utf8');
	}

	/**
	 * Load markdown content from a file synchronously.
	 * @param {string} filePath The file path to load the markdown content from.
	 * @returns {void}
	 */
	loadFromFileSync(filePath: string): void {
		this._content = fs.readFileSync(filePath, 'utf8');
	}

	/**
	 * Save the markdown content to a file. If the directory doesn't exist it will be created.
	 * @param {string} filePath The file path to save the markdown content to.
	 * @returns {Promise<void>}
	 */
	async saveToFile(filePath: string): Promise<void> {
		try {
			const {writeFile, mkdir} = fs.promises;
			const directoryPath = dirname(filePath);
			await mkdir(directoryPath, {recursive: true});
			const data = {
				filePath,
				content: this._content,
			};
			await this.hook(WritrHooks.beforeSaveToFile, data);

			await writeFile(data.filePath, data.content);
		/* c8 ignore next 6 */
		} catch (error) {
			this.emit('error', error);
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
	saveToFileSync(filePath: string): void {
		try {
			const directoryPath = dirname(filePath);
			fs.mkdirSync(directoryPath, {recursive: true});
			const data = {
				filePath,
				content: this._content,
			};
			// eslint-disable-next-line @typescript-eslint/no-floating-promises
			this.hook(WritrHooks.beforeSaveToFile, data);

			fs.writeFileSync(data.filePath, data.content);
		/* c8 ignore next 6 */
		} catch (error) {
			this.emit('error', error);
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

	private createProcessor(options: RenderOptions): any {
		const processor = unified().use(remarkParse);

		if (options.gfm) {
			processor.use(remarkGfm);
		}

		if (options.toc) {
			processor.use(remarkToc, {heading: 'toc|table of contents'});
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

	private mergeOptions(current: WritrOptions, options: WritrOptions): WritrOptions {
		if (options.throwErrors !== undefined) {
			current.throwErrors = options.throwErrors;
		}

		if (options.renderOptions) {
			current.renderOptions ??= {};

			this.mergeRenderOptions(current.renderOptions, options.renderOptions);
		}

		return current;
	}

	private mergeRenderOptions(current: RenderOptions, options: RenderOptions): RenderOptions {
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


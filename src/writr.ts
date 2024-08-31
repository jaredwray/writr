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
import {WritrCache} from './writr-cache.js';

type WritrOptions = {
	openai?: string; // Openai api key (default: undefined)
	renderOptions?: RenderOptions; // Default render options (default: undefined)
};

type RenderOptions = {
	emoji?: boolean; // Emoji support (default: true)
	toc?: boolean; // Table of contents generation (default: true)
	slug?: boolean; // Slug generation (default: true)
	highlight?: boolean; // Code highlighting (default: true)
	gfm?: boolean; // Github flavor markdown (default: true)
	math?: boolean; // Math support (default: true)
	mdx?: boolean; // MDX support (default: true)
	caching?: boolean; // Caching (default: true)
};

class Writr {
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
		openai: undefined,
		renderOptions: {
			emoji: true,
			toc: true,
			slug: true,
			highlight: true,
			gfm: true,
			math: true,
			mdx: true,
			caching: true,
		},
	};

	private _content = '';

	private readonly _cache = new WritrCache();

	constructor(arguments1?: string | WritrOptions, arguments2?: WritrOptions) {
		if (typeof arguments1 === 'string') {
			this._content = arguments1;
		} else if (arguments1) {
			this._options = {...this._options, ...arguments1};
			if (this._options.renderOptions) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				this.engine = this.createProcessor(this._options.renderOptions);
			}
		}

		if (arguments2) {
			this._options = {...this._options, ...arguments2};
			if (this._options.renderOptions) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				this.engine = this.createProcessor(this._options.renderOptions);
			}
		}
	}

	public get options(): WritrOptions {
		return this._options;
	}

	public get content(): string {
		return this._content;
	}

	public set content(value: string) {
		this._content = value;
	}

	public get cache(): WritrCache {
		return this._cache;
	}

	get frontMatterRaw(): string {
		return (/---\n[\s\S]*\n---\n/.exec(this._content))?.[0] ?? '';
	}

	get body(): string {
		return this._content.replace(/---\n[\s\S]*\n---\n/, '');
	}

	get markdown(): string {
		return this.body;
	}

	get frontMatter(): Record<string, any> {
		const frontMatter = this.frontMatterRaw;
		const match = /^---\s*([\s\S]*?)\s*---\s*/.exec(frontMatter);
		if (match) {
			return yaml.load(match[1].trim()) as Record<string, any>;
		}

		return {};
	}

	set frontMatter(data: Record<string, any>) {
		const frontMatter = this.frontMatterRaw;
		const yamlString = yaml.dump(data);
		const newFrontMatter = `---\n${yamlString}---\n`;
		this._content = this._content.replace(frontMatter, newFrontMatter);
	}

	public getFrontMatterValue<T>(key: string): T {
		return this.frontMatter[key] as T;
	}

	async render(options?: RenderOptions): Promise<string> {
		try {
			let result = '';
			if (this.isCacheEnabled(options)) {
				const cached = await this._cache.getMarkdown(this._content, options);
				if (cached) {
					return cached;
				}
			}

			let {engine} = this;
			if (options) {
				options = {...this._options.renderOptions, ...options};
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				engine = this.createProcessor(options);
			}

			const file = await engine.process(this.body);
			result = String(file);
			if (this.isCacheEnabled(options)) {
				await this._cache.setMarkdown(this._content, result, options);
			}

			return result;
		} catch (error) {
			throw new Error(`Failed to render markdown: ${(error as Error).message}`);
		}
	}

	renderSync(options?: RenderOptions): string {
		try {
			let result = '';
			if (this.isCacheEnabled(options)) {
				const cached = this._cache.getMarkdownSync(this._content, options);
				if (cached) {
					return cached;
				}
			}

			let {engine} = this;
			if (options) {
				options = {...this._options.renderOptions, ...options};
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				engine = this.createProcessor(options);
			}

			const file = engine.processSync(this.body);
			result = String(file);
			if (this.isCacheEnabled(options)) {
				this._cache.setMarkdownSync(this._content, result, options);
			}

			return result;
		} catch (error) {
			throw new Error(`Failed to render markdown: ${(error as Error).message}`);
		}
	}

	async renderReact(options?: RenderOptions, reactParseOptions?: HTMLReactParserOptions): Promise<string | React.JSX.Element | React.JSX.Element[]> {
		const html = await this.render(options);

		return parse(html, reactParseOptions);
	}

	renderReactSync(options?: RenderOptions, reactParseOptions?: HTMLReactParserOptions): string | React.JSX.Element | React.JSX.Element[] {
		const html = this.renderSync(options);
		return parse(html, reactParseOptions);
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
}

export {Writr, type WritrOptions, type RenderOptions};


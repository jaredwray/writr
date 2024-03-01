import {unified, Processor} from 'unified';
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
		},
	};

	constructor(options?: WritrOptions) {
		if (options) {
			this._options = {...this._options, ...options};
			if (this._options.renderOptions) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				this.engine = this.createProcessor(this._options.renderOptions);
			}
		}
	}

	public get options(): WritrOptions {
		return this._options;
	}

	async render(markdown: string, options?: RenderOptions): Promise<string> {
		try {
			let {engine} = this;
			if (options) {
				options = {...this._options.renderOptions, ...options};
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				engine = this.createProcessor(options);
			}

			const file = await engine.process(markdown);
			return String(file);
		} catch (error) {
			throw new Error(`Failed to render markdown: ${(error as Error).message}`);
		}
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

		processor.use(rehypeStringify);

		return processor;
	}
}

export {Writr, type WritrOptions, type RenderOptions};


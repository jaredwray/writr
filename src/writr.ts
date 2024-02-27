import {unified} from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeSlug from 'rehype-slug';
import rehypeHighlight from 'rehype-highlight';
import rehypeStringify from 'rehype-stringify';
import remarkToc from 'remark-toc';
import remarkGfm from 'remark-gfm';
import remarkEmoji from 'remark-emoji';

type WritrOptions = {
	openai?: string; // Openai api key (default: undefined)
	emoji?: boolean; // Emoji support (default: true)
	toc?: boolean; // Table of contents generation (default: true)
	slug?: boolean; // Slug generation (default: true)
	highlight?: boolean; // Code highlighting (default: true)
	gfm?: boolean; // Github flavor markdown (default: true)
};

class Writr {
	private readonly _options: WritrOptions = {
		openai: undefined,
		emoji: true,
		toc: true,
		slug: true,
		highlight: true,
		gfm: true,
	};

	private readonly processor = unified()
		.use(remarkParse)
		.use(remarkGfm) // Use GitHub Flavored Markdown
		.use(remarkToc, {heading: 'toc|table of contents'})
		.use(remarkEmoji)
		.use(remarkRehype) // Convert markdown to HTML
		.use(rehypeSlug) // Add slugs to headings in HTML
		.use(rehypeHighlight) // Apply syntax highlighting
		.use(rehypeStringify); // Stringify HTML

	constructor(options?: WritrOptions) {
		if (options) {
			this._options = {...this._options, ...options};
		}
	}

	public get options(): WritrOptions {
		return this._options;
	}

	async render(markdown: string): Promise<string> {
		try {
			const file = await this.processor.process(markdown);
			return String(file);
		} catch (error) {
			throw new Error(`Failed to render markdown: ${(error as Error).message}`);
		}
	}
}

export {Writr};


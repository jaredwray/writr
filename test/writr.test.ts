
import {it, describe, expect} from 'vitest';
import {Writr} from '../src/writr.js';

describe('writr', () => {
	it('should be able to initialize', () => {
		const writr = new Writr();
		expect(writr).toBeDefined();
	});

	it('should be able to set options', () => {
		const options = {
			renderOptions: {
				toc: false,
				slug: false,
				highlight: false,
				gfm: false,
				math: false,
				emoji: false,
			},
		};
		const writr = new Writr(options);
		expect(writr.options).toBeDefined();
		expect(writr.options.openai).toEqual(undefined);
		expect(writr.options.renderOptions).toBeInstanceOf(Object);
		expect(writr.options.renderOptions?.emoji).toEqual(false);
		expect(writr.options.renderOptions?.gfm).toEqual(false);
		expect(writr.options.renderOptions?.highlight).toEqual(false);
		expect(writr.options.renderOptions?.math).toEqual(false);
		expect(writr.options.renderOptions?.slug).toEqual(false);
		expect(writr.options.renderOptions?.toc).toEqual(false);
	});

	it('should be able to set options on emoji', () => {
		const options = {
			renderOptions: {
				emoji: true,
			},
		};
		const writr = new Writr(options);
		expect(writr.options.renderOptions?.emoji).toEqual(true);
	});
	it('should be able to set options on toc', () => {
		const options = {
			renderOptions: {
				toc: true,
			},
		};
		const writr = new Writr(options);
		expect(writr.options.renderOptions?.toc).toEqual(true);
	});
	it('should render a simple markdown example', async () => {
		const writr = new Writr();
		const result = await writr.render('# Hello World');
		expect(result).toEqual('<h1 id="hello-world">Hello World</h1>');
	});
	it('should render a simple markdown example with options - slug', async () => {
		const writr = new Writr();
		const options = {
			slug: false,
		};
		const result = await writr.render('# Hello World', options);
		expect(result).toEqual('<h1>Hello World</h1>');
	});
	it('should render a simple markdown example with options - emoji', async () => {
		const writr = new Writr();
		const options = {
			emoji: false,
		};
		const result = await writr.render('# Hello World :dog:', options);
		expect(result).toEqual('<h1 id="hello-world-dog">Hello World :dog:</h1>');
	});
	it('should render a simple markdown example with options - gfm', async () => {
		const writr = new Writr();
		const options = {
			gfm: false,
		};
		const result = await writr.render('# Hello World :dog:', options);
		expect(result).toEqual('<h1 id="hello-world-">Hello World 🐶</h1>');
	});
	it('should render a simple markdown example with options - toc', async () => {
		const writr = new Writr();
		const options = {
			toc: false,
		};
		const markdownString = '# Pluto\n\nPluto is a dwarf planet in the Kuiper belt.\n\n## Contents\n\n## History\n\n### Discovery\n\nIn the 1840s, Urbain Le Verrier used Newtonian mechanics to predict the\nposition of…';
		const resultToc = await writr.render(markdownString);
		expect(resultToc).contains('<li><a href="#discovery">Discovery</a></li>');
		const result = await writr.render(markdownString, options);
		expect(result).not.contain('<li><a href="#discovery">Discovery</a></li>');
	});
	it('should render a simple markdown example with options - code highlight', async () => {
		const writr = new Writr();
		const options = {
			highlight: false,
		};
		const markdownString = '# Code Example\n\nThis is an inline code example: `const x = 10;`\n\nAnd here is a multi-line code block:\n\n```javascript\nconst greet = () => {\n  console.log("Hello, world!");\n};\ngreet();\n```';
		const resultFull = await writr.render(markdownString);
		expect(resultFull).contains('<pre><code class="hljs language-javascript"><span class="hljs-keyword">const</span>');
		const result = await writr.render(markdownString, options);
		expect(result).contain('<pre><code class="language-javascript">const greet = () => {');
	});
	it('should throw an error on bad plugin or parsing', async () => {
		const writr = new Writr();
		const customPlugin = () => {
			throw new Error('Custom Plugin Error: Required configuration missing.');
		};

		writr.engine.use(customPlugin);
		try {
			await writr.render('# Hello World');
		} catch (error) {
			expect((error as Error).message).toEqual('Failed to render markdown: Custom Plugin Error: Required configuration missing.');
		}
	});
	it('should be able to do math', async () => {
		const writr = new Writr();
		const result = await writr.render('$$\n\\frac{1}{2}\n$$');
		expect(result).toContain('<span class="katex-display"><span class="katex"><span class="katex-mathml"><math xmlns="http://www.w3.org/1998/Math/MathML"');
	});
});

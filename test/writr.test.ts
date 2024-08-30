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

	it('should be able to set markdown', () => {
		const writr = new Writr('# Hello World');
		expect(writr.markdown).toEqual('# Hello World');
		expect(writr.renderSync()).toEqual('<h1 id="hello-world">Hello World</h1>');
		writr.markdown = '# Hello World\n\nThis is a test.';
		expect(writr.markdown).toEqual('# Hello World\n\nThis is a test.');
		expect(writr.renderSync()).toEqual('<h1 id="hello-world">Hello World</h1>\n<p>This is a test.</p>');
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
		const writr = new Writr('# Hello World');
		const result = await writr.render();
		expect(result).toEqual('<h1 id="hello-world">Hello World</h1>');
	});
	it('should render a simple markdown example via constructor with render options', async () => {
		const writr = new Writr('# Hello World');
		const result = await writr.render({
			emoji: false,
		});
		expect(result).toEqual('<h1 id="hello-world">Hello World</h1>');
	});

	it('should renderSync a simple markdown example', async () => {
		const writr = new Writr('# Hello World');
		const result = writr.renderSync();
		expect(result).toEqual('<h1 id="hello-world">Hello World</h1>');
	});
	it('should renderSync a simple markdown example via constructor', async () => {
		const writr = new Writr();
		writr.markdown = '# Hello World';
		const result = writr.renderSync({
			emoji: false,
		});
		expect(result).toEqual('<h1 id="hello-world">Hello World</h1>');
	});
	it('should render a simple markdown example with options - slug', async () => {
		const writr = new Writr('# Hello World', {
			renderOptions: {
				slug: false,
			},
		});
		const result = await writr.render();
		expect(result).toEqual('<h1>Hello World</h1>');
	});
	it('should renderSync a simple markdown example with options - emoji', async () => {
		const writr = new Writr('# Hello World :dog:');
		const options = {
			emoji: false,
		};
		const result = writr.renderSync(options);
		expect(result).toEqual('<h1 id="hello-world-dog">Hello World :dog:</h1>');
	});
	it('should render a simple markdown example with options - emoji', async () => {
		const writr = new Writr('# Hello World :dog:');
		const options = {
			emoji: false,
		};
		const result = await writr.render(options);
		expect(result).toEqual('<h1 id="hello-world-dog">Hello World :dog:</h1>');
	});
	it('should render a simple markdown example with options - gfm', async () => {
		const writr = new Writr('# Hello World :dog:');
		const options = {
			gfm: false,
		};
		const result = await writr.render(options);
		expect(result).toEqual('<h1 id="hello-world-">Hello World 🐶</h1>');
	});
	it('should render a simple markdown example with options - toc', async () => {
		const writr = new Writr();
		const options = {
			toc: false,
		};
		const markdownString = '# Pluto\n\nPluto is a dwarf planet in the Kuiper belt.\n\n## Contents\n\n## History\n\n### Discovery\n\nIn the 1840s, Urbain Le Verrier used Newtonian mechanics to predict the\nposition of…';
		writr.markdown = markdownString;
		const resultToc = await writr.render();
		expect(resultToc).contains('<li><a href="#discovery">Discovery</a></li>');
		const result = await writr.render(options);
		expect(result).not.contain('<li><a href="#discovery">Discovery</a></li>');
	});
	it('should render a simple markdown example with options - code highlight', async () => {
		const writr = new Writr();
		const options = {
			highlight: false,
		};
		const markdownString = '# Code Example\n\nThis is an inline code example: `const x = 10;`\n\nAnd here is a multi-line code block:\n\n```javascript\nconst greet = () => {\n  console.log("Hello, world!");\n};\ngreet();\n```';
		writr.markdown = markdownString;
		const resultFull = await writr.render();
		expect(resultFull).contains('<pre><code class="hljs language-javascript"><span class="hljs-keyword">const</span>');
		const result = await writr.render(options);
		expect(result).contain('<pre><code class="language-javascript">const greet = () => {');
	});
	it('should throw an error on bad plugin or parsing', async () => {
		const writr = new Writr('# Hello World');
		const customPlugin = () => {
			throw new Error('Custom Plugin Error: Required configuration missing.');
		};

		writr.engine.use(customPlugin);
		try {
			await writr.render();
		} catch (error) {
			expect((error as Error).message).toEqual('Failed to render markdown: Custom Plugin Error: Required configuration missing.');
		}
	});
	it('should throw an error on bad plugin or parsing on renderSync', () => {
		const writr = new Writr('# Hello World');
		const customPlugin = () => {
			throw new Error('Custom Plugin Error: Required configuration missing.');
		};

		writr.engine.use(customPlugin);
		try {
			writr.renderSync();
		} catch (error) {
			expect((error as Error).message).toEqual('Failed to render markdown: Custom Plugin Error: Required configuration missing.');
		}
	});
	it('should be able to do math', async () => {
		const writr = new Writr();
		writr.markdown = '$$\n\\frac{1}{2}\n$$';
		const result = await writr.render();
		expect(result).toContain('<span class="katex-display"><span class="katex"><span class="katex-mathml"><math xmlns="http://www.w3.org/1998/Math/MathML"');
	});
	it('should be able to render react components', async () => {
		const writr = new Writr();
		const markdownString = '## Hello World\n\n';
		writr.markdown = markdownString;
		const result = await writr.renderReact() as React.JSX.Element;
		expect(result.type).toEqual('h2');
	});
	it('should be able to render react components sync', async () => {
		const writr = new Writr();
		const markdownString = '## Hello World\n\n';
		writr.markdown = markdownString;
		const result = writr.renderReactSync() as React.JSX.Element;
		expect(result.type).toEqual('h2');
	});
});

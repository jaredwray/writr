
import {
	it, test, describe, expect,
} from 'vitest';
import {Writr} from '../src/writr.js';
import {productPageWithMarkdown, blogPostWithMarkdown, projectDocumentationWithMarkdown} from './content-fixtures.js';

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
		writr.content = '# Hello World\n\nThis is a test.';
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
		writr.content = '# Hello World';
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
		writr.content = markdownString;
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
		writr.content = markdownString;
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
		writr.content = '$$\n\\frac{1}{2}\n$$';
		const result = await writr.render();
		expect(result).toContain('<span class="katex-display"><span class="katex"><span class="katex-mathml"><math xmlns="http://www.w3.org/1998/Math/MathML"');
	});
	it('should be able to render react components', async () => {
		const writr = new Writr();
		const markdownString = '## Hello World\n\n';
		writr.content = markdownString;
		const result = await writr.renderReact() as React.JSX.Element;
		expect(result.type).toEqual('h2');
	});
	it('should be able to render react components sync', async () => {
		const writr = new Writr();
		const markdownString = '## Hello World\n\n';
		writr.content = markdownString;
		const result = writr.renderReactSync() as React.JSX.Element;
		expect(result.type).toEqual('h2');
	});

	it('should be able to get/set cache', async () => {
		const writr = new Writr();
		writr.cache.setMarkdownSync('# Hello World', '<h1>Hello World</h1>');
		expect(writr.cache.getMarkdownSync('# Hello World')).toEqual('<h1>Hello World</h1>');
	});

	it('should return a valid cached result', async () => {
		const writr = new Writr('# Hello World'); // By defualt cache is enabled
		const result = await writr.render();
		expect(result).toEqual('<h1 id="hello-world">Hello World</h1>');
		const hashKey = '59ed9b58b8baabd1c42379a22ae2bc004a45b95866dc028c57485039494413da';
		expect(await writr.cache.get(hashKey)).toEqual('<h1 id="hello-world">Hello World</h1>');
		const result2 = await writr.render();
		expect(result2).toEqual('<h1 id="hello-world">Hello World</h1>');
	});

	it('should return non cached result via options', async () => {
		const writr = new Writr('# Hello World'); // By defualt cache is enabled
		const result = await writr.render();
		expect(result).toEqual('<h1 id="hello-world">Hello World</h1>');
		const result2 = await writr.render({caching: false});
		expect(result2).toEqual('<h1 id="hello-world">Hello World</h1>');
	});

	it('should return a valid cached result', () => {
		const writr = new Writr('# Hello World'); // By defualt cache is enabled
		const result = writr.renderSync();
		expect(result).toEqual('<h1 id="hello-world">Hello World</h1>');
		const hashKey = '59ed9b58b8baabd1c42379a22ae2bc004a45b95866dc028c57485039494413da';
		expect(writr.cache.getSync(hashKey)).toEqual('<h1 id="hello-world">Hello World</h1>');
		const result2 = writr.renderSync();
		expect(result2).toEqual('<h1 id="hello-world">Hello World</h1>');
	});
});

describe('WritrFrontMatter', () => {
	test('should initialize with content and work from same object', () => {
		const writr = new Writr(productPageWithMarkdown);
		expect(writr.content).toBe(productPageWithMarkdown);
		const meta = writr.frontMatter;
		meta.title = 'New Title 123';
		writr.frontMatter = meta;
		expect(writr.content).to.contain('New Title 123');
	});

	test('should return the raw front matter', () => {
		const writr = new Writr(productPageWithMarkdown);
		expect(writr.frontMatterRaw).to.not.contain('## Description');
		expect(writr.frontMatterRaw).to.contain('title: "Super Comfortable Chair"');
	});

	test('should return blank object with no frontmatter', () => {
		const markdown = '## Description\nThis is a description';
		const writr = new Writr(markdown);
		expect(writr.frontMatterRaw).toBe('');
		expect(writr.frontMatter).toStrictEqual({});
	});

	test('should return the body without front matter', () => {
		const writr = new Writr(blogPostWithMarkdown);
		expect(writr.body).to.contain('# Introduction');
		expect(writr.body).to.contain('Using Async/Await makes your code cleaner and easier to understand by eliminating the need for complex callback chains or .then() methods.');
		expect(writr.body).to.not.contain('title: "Super Comfortable Chair"');
		expect(writr.body.split('\n').length).toBe(28);
		expect(writr.body.split('\n')).to.not.contain('---');
	});

	test('should return the front matter as an object', () => {
		const writr = new Writr(projectDocumentationWithMarkdown);
		const {frontMatter} = writr;
		expect(frontMatter).to.haveOwnProperty('title', 'Project Documentation');
	});

	test('should set the front matter', () => {
		const writr = new Writr(projectDocumentationWithMarkdown);
		const meta = writr.frontMatter;
		meta.title = 'New Title';
		if (!Array.isArray(meta.contributors)) {
			meta.contributors = [];
		}

		// eslint-disable-next-line @typescript-eslint/no-unsafe-call
		meta.contributors.push({name: 'Jane Doe', email: 'jane@doe.org'});
		writr.frontMatter = meta;
		expect(writr.frontMatter.title).toBe('New Title');
		expect(writr.content).to.contain('New Title');
		expect(writr.content).to.contain('jane@doe.org');
	});

	test('should return a value from the front matter', () => {
		const writr = new Writr(blogPostWithMarkdown);
		expect(writr.getFrontMatterValue<string>('title')).toBe('Understanding Async/Await in JavaScript');
		expect(writr.getFrontMatterValue<string>('author')).toBe('Jane Doe');
		expect(writr.getFrontMatterValue<boolean>('draft')).toBe(false);
		expect(writr.getFrontMatterValue<string[]>('tags')).toStrictEqual(['async', 'await', 'ES6']);
	});
});


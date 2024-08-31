import {describe, test, expect} from 'vitest';
import {WritrFrontMatter} from '../src/writr-frontmatter.js';
import {productPageWithMarkdown, blogPostWithMarkdown, projectDocumentationWithMarkdown} from './frontmatter-fixtures.js';

describe('WritrFrontMatter', () => {
	test('should initialize with content', () => {
		const frontMatter = new WritrFrontMatter(productPageWithMarkdown);
		expect(frontMatter.content).toBe(productPageWithMarkdown);
	});

	test('should initialize with content and work from same object', () => {
		const content = productPageWithMarkdown;
		const markdown = {content};
		const frontMatter = new WritrFrontMatter(markdown);
		expect(frontMatter.content).toBe(productPageWithMarkdown);
		const meta = frontMatter.metaData;
		meta.title = 'New Title 123';
		frontMatter.metaData = meta;
		expect(frontMatter.content).to.contain('New Title 123');
		expect(markdown.content).to.contain('New Title 123');
	});

	test('should return the raw front matter', () => {
		const frontMatter = new WritrFrontMatter(productPageWithMarkdown);
		expect(frontMatter.frontMatterRaw).to.not.contain('## Description');
		expect(frontMatter.frontMatterRaw).to.contain('title: "Super Comfortable Chair"');
	});

	test('should return blank object with no frontmatter', () => {
		const markdown = '## Description\nThis is a description';
		const frontMatter = new WritrFrontMatter(markdown);
		expect(frontMatter.frontMatterRaw).toBe('');
		expect(frontMatter.metaData).toStrictEqual({});
	});

	test('should return the body without front matter', () => {
		const frontMatter = new WritrFrontMatter(blogPostWithMarkdown);
		expect(frontMatter.body).to.contain('# Introduction');
		expect(frontMatter.body).to.contain('Using Async/Await makes your code cleaner and easier to understand by eliminating the need for complex callback chains or .then() methods.');
		expect(frontMatter.body).to.not.contain('title: "Super Comfortable Chair"');
		expect(frontMatter.body.split('\n').length).toBe(28);
		expect(frontMatter.body.split('\n')).to.not.contain('---');
	});

	test('should return the front matter as an object', () => {
		const frontMatter = new WritrFrontMatter(projectDocumentationWithMarkdown);
		const {metaData} = frontMatter;
		expect(metaData).to.haveOwnProperty('title', 'Project Documentation');
	});

	test('should set the front matter', () => {
		const frontMatter = new WritrFrontMatter(projectDocumentationWithMarkdown);
		const meta = frontMatter.metaData;
		meta.title = 'New Title';
		if (!Array.isArray(meta.contributors)) {
			meta.contributors = [];
		}

		// eslint-disable-next-line @typescript-eslint/no-unsafe-call
		meta.contributors.push({name: 'Jane Doe', email: 'jane@doe.org'});
		frontMatter.metaData = meta;
		expect(frontMatter.metaData.title).toBe('New Title');
		expect(frontMatter.content).to.contain('New Title');
		expect(frontMatter.content).to.contain('jane@doe.org');
	});

	test('should return a value from the front matter', () => {
		const frontMatter = new WritrFrontMatter(blogPostWithMarkdown);
		expect(frontMatter.getValue<string>('title')).toBe('Understanding Async/Await in JavaScript');
		expect(frontMatter.getValue<string>('author')).toBe('Jane Doe');
		expect(frontMatter.getValue<boolean>('draft')).toBe(false);
		expect(frontMatter.getValue<string[]>('tags')).toStrictEqual(['async', 'await', 'ES6']);
	});
});

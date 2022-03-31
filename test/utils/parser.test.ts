import {Parser} from "../../src/utils/parser";

describe('parser', () => {

	const parser = new Parser();

	it('should parse an html to markdown', () => {

		const html = `<h1>This is a title</h1>`;
		const result = parser.htmlToMd(html);

		expect(result).toBe('# This is a title');

	})

	it('should return empty string if not html is provided', () => {

		const html = ``;
		const result = parser.htmlToMd(html);

		expect(result).toBe('');

	})

	it('should return slug based on a string', () => {

		const title = 'Hello, this is a title!';
		const result = parser.slugify(title);

		expect(result).toBe('hello-this-is-a-title');

	})

	it('should return the header of a markdown file', () => {

		const headers = {
			title: 'Hello, this is a title!',
			slug: 'hello-this-is-a-title',
			date: '2020-01-01',
			categories: 'category 1, category2',
			tags: 'tag 1, tag 2'
		};
		const result = parser.generateMdHeaders(headers);

		const headersExpected = `---
title: Hello, this is a title!
url: hello-this-is-a-title
date: 2020-01-01
categories: category 1, category2
tags: tag 1, tag 2
---

`

		expect(result).toBe(headersExpected);

	})

});

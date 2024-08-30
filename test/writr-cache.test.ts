import {describe, it, expect} from 'vitest';
import {KeyvSqlite} from '@keyv/sqlite';
import {WritrCache} from '../src/writr-cache.js';

describe('writr-cache', () => {
	it('should be able to initialize', () => {
		const cache = new WritrCache();
		expect(cache).toBeDefined();
	});

	it('should be able to set markdown', async () => {
		const cache = new WritrCache();
		const markdown = '# Hello World';
		const value = '<h1 id="hello-world">Hello World</h1>';
		expect(await cache.setMarkdown(markdown, value)).toEqual(true);
		expect(await cache.getMarkdown(markdown)).toEqual(value);
	});

	it('should be able to set markdown sync', () => {
		const cache = new WritrCache();
		const markdown = '# Hello World';
		const value = '<h1 id="hello-world">Hello World</h1>';
		expect(cache.setMarkdownSync(markdown, value)).toEqual(true);
		expect(cache.getMarkdownSync(markdown)).toEqual(value);
	});

	it('should be able to set markdown with options', async () => {
		const cache = new WritrCache();
		const markdown = '# Hello World';
		const value = '<h1 id="hello-world">Hello World</h1>';
		const options = {toc: true};
		expect(await cache.setMarkdown(markdown, value, options)).toEqual(true);
		expect(await cache.getMarkdown(markdown, options)).toEqual(value);
	});

	it('should be able to set markdown sync with options', () => {
		const cache = new WritrCache();
		const markdown = '# Hello World';
		const value = '<h1 id="hello-world">Hello World</h1>';
		const options = {toc: true};
		expect(cache.setMarkdownSync(markdown, value, options)).toEqual(true);
		expect(cache.getMarkdownSync(markdown, options)).toEqual(value);
	});

	it('should be able to set markdown with options', async () => {
		const cache = new WritrCache();
		const markdown = '# Hello World';
		const value = '<h1 id="hello-world">Hello World</h1>';
		const options = {toc: true, emoji: true};
		expect(await cache.setMarkdown(markdown, value, options)).toEqual(true);
		expect(await cache.getMarkdown(markdown, options)).toEqual(value);
	});

	it('should be able to do hash caching', () => {
		const cache = new WritrCache();
		const markdown = '# Hello World';
		let options = {toc: true, emoji: true};
		const key = cache.hash(markdown, options);
		const key2 = cache.hash(markdown, options);
		expect(key).toEqual(key2);
		expect(cache.hashStore.has('{"markdown":"# Hello World","options":{"toc":true,"emoji":true}}')).toEqual(true);
		expect(cache.hashStore.size).toEqual(1);
		options = {toc: true, emoji: false};
		const key3 = cache.hash(markdown, options);
		expect(cache.hashStore.size).toEqual(2);
	});

	it('Get and Set the Cache', async () => {
		const cache = new WritrCache();
		expect(cache.markdownStore).toBeDefined();
		expect(cache.markdownStoreSync).toBeDefined();
	});

	it('should be able to clear the cache', async () => {
		const cache = new WritrCache();
		const markdown = '# Hello World';
		const value = '<h1 id="hello-world">Hello World</h1>';
		const options = {toc: true, emoji: true};
		expect(await cache.setMarkdown(markdown, value, options)).toEqual(true);
		expect(await cache.getMarkdown(markdown, options)).toEqual(value);
		await cache.clear();
		expect(await cache.getMarkdown(markdown, options)).toBeUndefined();
	});

	it('should set the storage adapter', () => {
		const cache = new WritrCache();
		cache.setStorageAdapter(new KeyvSqlite());
	});
});

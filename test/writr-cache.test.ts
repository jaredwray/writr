import {describe, it, expect} from 'vitest';
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
		cache.set(markdown, value);
		expect(cache.get(markdown)).toEqual(value);
	});

	it('should be able to set markdown sync', () => {
		const cache = new WritrCache();
		const markdown = '# Hello World';
		const value = '<h1 id="hello-world">Hello World</h1>';
		cache.set(markdown, value);
		expect(cache.get(markdown)).toEqual(value);
	});

	it('should be able to set markdown with options', async () => {
		const cache = new WritrCache();
		const markdown = '# Hello World';
		const value = '<h1 id="hello-world">Hello World</h1>';
		const options = {toc: true};
		cache.set(markdown, value, options);
		expect(cache.get(markdown, options)).toEqual(value);
	});

	it('should be able to set markdown sync with options', () => {
		const cache = new WritrCache();
		const markdown = '# Hello World';
		const value = '<h1 id="hello-world">Hello World</h1>';
		const options = {toc: true};
		cache.set(markdown, value, options);
		expect(cache.get(markdown, options)).toEqual(value);
	});

	it('should be able to set markdown with options', async () => {
		const cache = new WritrCache();
		const markdown = '# Hello World';
		const value = '<h1 id="hello-world">Hello World</h1>';
		const options = {toc: true, emoji: true};
		cache.set(markdown, value, options);
		cache.get(markdown, options);
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
		expect(cache.store).toBeDefined();
	});

	it('should be able to clear the cache', async () => {
		const cache = new WritrCache();
		const markdown = '# Hello World';
		const value = '<h1 id="hello-world">Hello World</h1>';
		const options = {toc: true, emoji: true};
		cache.set(markdown, value, options);
		cache.get(markdown, options);
		cache.clear();
		expect(cache.get(markdown, options)).toBeUndefined();
	});
});

import {
	test, describe, expect,
} from 'vitest';
import {Writr} from '../src/writr.js';

const testContentOne = `---
title: "Super Comfortable Chair"
product_id: "CHAIR12345"
price: 149.99
---

# Super Comfortable Chair
This is a super chair and amazing chair. It is very comfortable and you will love it.
`;

const testContentOneResult = `<h1 id="super-comfortable-chair">Super Comfortable Chair</h1>
<p>This is a super chair and amazing chair. It is very comfortable and you will love it.</p>`;

const options = {
	renderOptions: {
		caching: true,
	},
};

describe('Writr Async render with Caching', async () => {
	test('should render a template with caching', async () => {
		const writr = new Writr(testContentOne, options);
		const result = await writr.render();
		expect(result).toBe(testContentOneResult);
		expect(writr.cache).toBeDefined();
		expect(writr.cache.store.size).toBe(1);
		const result2 = await writr.render();
		expect(result2).toBe(testContentOneResult);
	});

	test('should sync render a template with caching', async () => {
		const writr = new Writr(testContentOne, options);
		const result = writr.renderSync();
		expect(result).toBe(testContentOneResult);
		expect(writr.cache).toBeDefined();
		expect(writr.cache.store.size).toBe(1);
		const result2 = writr.renderSync();
		expect(result2).toBe(testContentOneResult);
	});

	test('should render with async and then cache. Then render with sync via cache', async () => {
		const writr = new Writr(testContentOne, options);
		const result = await writr.render();
		expect(result).toBe(testContentOneResult);
		expect(writr.cache).toBeDefined();
		expect(writr.cache.store.size).toBe(1);
		const result2 = writr.renderSync();
		expect(result2).toBe(testContentOneResult);
	});
});
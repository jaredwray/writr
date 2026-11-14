import { describe, expect, it } from "vitest";
import { WritrCache } from "../src/writr-cache.js";

describe("writr-cache", () => {
	it("should be able to initialize", () => {
		const cache = new WritrCache();
		expect(cache).toBeDefined();
	});

	it("should be able to set markdown", async () => {
		const cache = new WritrCache();
		const markdown = "# Hello World";
		const value = '<h1 id="hello-world">Hello World</h1>';
		cache.set(markdown, value);
		expect(cache.get(markdown)).toEqual(value);
	});

	it("should be able to set markdown sync", () => {
		const cache = new WritrCache();
		const markdown = "# Hello World";
		const value = '<h1 id="hello-world">Hello World</h1>';
		cache.set(markdown, value);
		expect(cache.get(markdown)).toEqual(value);
	});

	it("should be able to set markdown with options", async () => {
		const cache = new WritrCache();
		const markdown = "# Hello World";
		const value = '<h1 id="hello-world">Hello World</h1>';
		const options = { toc: true };
		cache.set(markdown, value, options);
		expect(cache.get(markdown, options)).toEqual(value);
	});

	it("should be able to set markdown sync with options", () => {
		const cache = new WritrCache();
		const markdown = "# Hello World";
		const value = '<h1 id="hello-world">Hello World</h1>';
		const options = { toc: true };
		cache.set(markdown, value, options);
		expect(cache.get(markdown, options)).toEqual(value);
	});

	it("should be able to set markdown with toc and emoji options", async () => {
		const cache = new WritrCache();
		const markdown = "# Hello World";
		const value = '<h1 id="hello-world">Hello World</h1>';
		const options = { toc: true, emoji: true };
		cache.set(markdown, value, options);
		cache.get(markdown, options);
	});

	it("should be able to do hash caching", () => {
		const cache = new WritrCache();
		const markdown = "# Hello World";
		let options = { toc: true, emoji: true };
		const key = cache.hash(markdown, options);
		const key2 = cache.hash(markdown, options);
		expect(key).toEqual(key2);
		// The key should be based on the sanitized options (only known properties)
		const expectedKey =
			'{"markdown":"# Hello World","options":{"emoji":true,"toc":true}}';
		expect(cache.hashStore.has(expectedKey)).toEqual(true);
		expect(cache.hashStore.size).toEqual(1);
		options = { toc: true, emoji: false };
		cache.hash(markdown, options);
		expect(cache.hashStore.size).toEqual(2);
	});

	it("should include rawHtml in the cache key", () => {
		const cache = new WritrCache();
		const markdown = "# Hello World\n\n<script>alert(1)</script>";

		const withRawHtml = cache.hash(markdown, { rawHtml: true });
		const withoutRawHtml = cache.hash(markdown, { rawHtml: false });

		expect(withRawHtml).not.toEqual(withoutRawHtml);
	});

	it("should include rawHtml in the stored hash key", () => {
		const cache = new WritrCache();
		cache.hash("# Hello World", { rawHtml: true });

		expect(
			cache.hashStore.has(
				'{"markdown":"# Hello World","options":{"rawHtml":true}}',
			),
		).toEqual(true);
	});

	it("should include every RenderOptions field in the cache key", () => {
		const cache = new WritrCache();
		const markdown = "# Hello World";
		const baseline = cache.hash(markdown, {});

		// Guards the hand-maintained list in sanitizeOptions: a field that
		// changes output but is omitted from the key lets one option set answer
		// for another. Every RenderOptions key must move the hash.
		const fields = [
			"emoji",
			"toc",
			"slug",
			"highlight",
			"gfm",
			"math",
			"mdx",
			"rawHtml",
			"caching",
		] as const;

		for (const field of fields) {
			const key = cache.hash(markdown, { [field]: true });
			expect(key, `${field} is missing from the cache key`).not.toEqual(
				baseline,
			);
		}
	});

	it("should not collide on two different documents", () => {
		const cache = new WritrCache();
		const options = { gfm: true, caching: true };

		// A wide digest makes a chosen collision impractical; this pins the
		// property for two ordinary distinct documents.
		expect(cache.hash("# Document A", options)).not.toEqual(
			cache.hash("# Document B", options),
		);
	});

	it("Get and Set the Cache", async () => {
		const cache = new WritrCache();
		expect(cache.store).toBeDefined();
	});

	it("should be able to clear the cache", async () => {
		const cache = new WritrCache();
		const markdown = "# Hello World";
		const value = '<h1 id="hello-world">Hello World</h1>';
		const options = { toc: true, emoji: true };
		cache.set(markdown, value, options);
		cache.get(markdown, options);
		cache.clear();
		expect(cache.get(markdown, options)).toBeUndefined();
	});

	it("should handle options with Promises by sanitizing them", () => {
		const cache = new WritrCache();
		const markdown = "# Hello World";

		// Simulate options that contain a Promise (like React or unified plugins might)
		// biome-ignore lint/suspicious/noExplicitAny: Testing edge case with non-serializable values
		const optionsWithPromise: any = {
			toc: true,
			emoji: true,
			// This would normally cause structuredClone to fail
			customPlugin: Promise.resolve("test"),
		};

		// This should NOT throw because we sanitize options before hashing
		expect(() => {
			cache.hash(markdown, optionsWithPromise);
		}).not.toThrow();

		// Verify it works with get/set too
		const value = '<h1 id="hello-world">Hello World</h1>';
		expect(() => {
			cache.set(markdown, value, optionsWithPromise);
		}).not.toThrow();

		expect(() => {
			cache.get(markdown, optionsWithPromise);
		}).not.toThrow();
	});

	it("should handle options with functions by sanitizing them", () => {
		const cache = new WritrCache();
		const markdown = "# Hello World";

		// Simulate options that contain functions
		// biome-ignore lint/suspicious/noExplicitAny: Testing edge case with non-serializable values
		const optionsWithFunction: any = {
			toc: true,
			highlight: true,
			// This would normally cause structuredClone to fail
			customMethod: () => "test",
		};

		// This should NOT throw because we sanitize options before hashing
		expect(() => {
			cache.hash(markdown, optionsWithFunction);
		}).not.toThrow();
	});

	it("should handle options with circular references by sanitizing them", () => {
		const cache = new WritrCache();
		const markdown = "# Hello World";

		// Create circular reference (common in React components)
		// biome-ignore lint/suspicious/noExplicitAny: Testing edge case with circular references
		const circularObj: any = {
			toc: true,
			emoji: true,
		};
		circularObj.self = circularObj;

		// This should NOT throw because we sanitize options before hashing
		expect(() => {
			cache.hash(markdown, circularObj);
		}).not.toThrow();
	});

	it("should only use known RenderOptions properties for cache keys", () => {
		const cache = new WritrCache();
		const markdown = "# Hello World";

		// Two options with different extra properties but same known properties
		// biome-ignore lint/suspicious/noExplicitAny: Testing that extra properties are ignored
		const options1: any = {
			toc: true,
			emoji: true,
			extraProp1: "value1",
		};

		// biome-ignore lint/suspicious/noExplicitAny: Testing that extra properties are ignored
		const options2: any = {
			toc: true,
			emoji: true,
			extraProp2: "value2",
		};

		// Should produce the same hash because extra properties are ignored
		const hash1 = cache.hash(markdown, options1);
		const hash2 = cache.hash(markdown, options2);

		expect(hash1).toEqual(hash2);
	});
});

import { MockLanguageModelV3 } from "ai/test";
import { describe, expect, it, vi } from "vitest";
import type { WritrMetadata } from "../src/types.js";
import { Writr } from "../src/writr.js";
import { WritrAI } from "../src/writr-ai.js";
import { WritrAICache } from "../src/writr-ai-cache.js";
import {
	blogPostWithMarkdown,
	productPageWithMarkdown,
} from "./content-fixtures.js";

function createMockModel(jsonResponse: Record<string, unknown>) {
	return new MockLanguageModelV3({
		doGenerate: async () => ({
			content: [{ type: "text" as const, text: JSON.stringify(jsonResponse) }],
			finishReason: "stop" as const,
			usage: { inputTokens: 10, outputTokens: 20 },
			warnings: [],
		}),
	});
}

function createMockTextModel(textResponse: string) {
	return new MockLanguageModelV3({
		doGenerate: async () => ({
			content: [{ type: "text" as const, text: textResponse }],
			finishReason: "stop" as const,
			usage: { inputTokens: 10, outputTokens: 20 },
			warnings: [],
		}),
	});
}

describe("writr-ai-cache", () => {
	it("should initialize", () => {
		const cache = new WritrAICache();
		expect(cache).toBeDefined();
		expect(cache.store).toBeDefined();
		expect(cache.hashStore).toBeDefined();
	});

	it("should set and get values", () => {
		const cache = new WritrAICache();
		cache.set("testKey", "testContext", { foo: "bar" });
		const result = cache.get<{ foo: string }>("testKey", "testContext");
		expect(result).toEqual({ foo: "bar" });
	});

	it("should return undefined for missing values", () => {
		const cache = new WritrAICache();
		const result = cache.get("missing", "context");
		expect(result).toBeUndefined();
	});

	it("should produce consistent hashes", () => {
		const cache = new WritrAICache();
		const hash1 = cache.hash("key", "context");
		const hash2 = cache.hash("key", "context");
		expect(hash1).toEqual(hash2);
	});

	it("should clear the cache", () => {
		const cache = new WritrAICache();
		cache.set("key", "context", "value");
		expect(cache.get("key", "context")).toEqual("value");
		cache.clear();
		expect(cache.get("key", "context")).toBeUndefined();
	});
});

describe("writr-ai", () => {
	it("should initialize with required options", () => {
		const writr = new Writr("# Hello World");
		const model = createMockModel({});
		const ai = new WritrAI(writr, { model });
		expect(ai).toBeDefined();
		expect(ai.writr).toBe(writr);
		expect(ai.model).toBe(model);
		expect(ai.cache).toBeUndefined();
		expect(ai.prompts).toEqual({});
	});

	it("should initialize with cache enabled", () => {
		const writr = new Writr("# Hello World");
		const model = createMockModel({});
		const ai = new WritrAI(writr, { model, cache: true });
		expect(ai.cache).toBeInstanceOf(WritrAICache);
	});

	it("should initialize with custom prompts", () => {
		const writr = new Writr("# Hello World");
		const model = createMockModel({});
		const prompts = {
			metadata: "Custom metadata prompt",
			seo: "Custom SEO prompt",
			translation: "Custom translation prompt",
		};
		const ai = new WritrAI(writr, { model, prompts });
		expect(ai.prompts).toEqual(prompts);
	});

	describe("getMetadata", () => {
		it("should generate metadata with all fields", async () => {
			const writr = new Writr(productPageWithMarkdown);
			const model = createMockModel({
				title: "Super Comfortable Chair",
				tags: ["comfort", "ergonomic"],
				keywords: ["chair", "office chair"],
				description: "An ergonomic chair for home office use.",
				preview: "A comfortable chair for long sitting sessions.",
				summary: "The Super Comfortable Chair is designed for maximum comfort.",
				category: "product",
				topic: "furniture",
				audience: "home office workers",
				difficulty: "beginner",
			});

			const ai = new WritrAI(writr, { model });
			const metadata = await ai.getMetadata();

			expect(metadata.title).toBe("Super Comfortable Chair");
			expect(metadata.tags).toEqual(["comfort", "ergonomic"]);
			expect(metadata.keywords).toEqual(["chair", "office chair"]);
			expect(metadata.description).toBe(
				"An ergonomic chair for home office use.",
			);
			expect(metadata.wordCount).toBeTypeOf("number");
			expect(metadata.wordCount).toBeGreaterThan(0);
			expect(metadata.readingTime).toBeTypeOf("number");
			expect(metadata.readingTime).toBeGreaterThanOrEqual(1);
		});

		it("should generate only selected fields", async () => {
			const writr = new Writr(blogPostWithMarkdown);
			const model = createMockModel({
				title: "Understanding Async/Await in JavaScript",
				description: "A guide to async/await in JavaScript.",
			});

			const ai = new WritrAI(writr, { model });
			const metadata = await ai.getMetadata({
				title: true,
				description: true,
				tags: false,
				keywords: false,
				preview: false,
				summary: false,
				category: false,
				topic: false,
				audience: false,
				difficulty: false,
				readingTime: false,
				wordCount: false,
			});

			expect(metadata.title).toBe("Understanding Async/Await in JavaScript");
			expect(metadata.description).toBe(
				"A guide to async/await in JavaScript.",
			);
			expect(metadata.tags).toBeUndefined();
			expect(metadata.wordCount).toBeUndefined();
			expect(metadata.readingTime).toBeUndefined();
		});

		it("should use opt-in mode when any field is set to true", async () => {
			const writr = new Writr(blogPostWithMarkdown);
			const model = createMockModel({
				title: "Understanding Async/Await in JavaScript",
				description: "A guide to async/await in JavaScript.",
			});

			const ai = new WritrAI(writr, { model });
			const metadata = await ai.getMetadata({
				title: true,
				description: true,
			});

			expect(metadata.title).toBe("Understanding Async/Await in JavaScript");
			expect(metadata.description).toBe(
				"A guide to async/await in JavaScript.",
			);
			expect(metadata.tags).toBeUndefined();
			expect(metadata.keywords).toBeUndefined();
			expect(metadata.wordCount).toBeUndefined();
			expect(metadata.readingTime).toBeUndefined();
		});

		it("should generate only deterministic fields without AI call", async () => {
			const writr = new Writr(blogPostWithMarkdown);
			// Even though we provide a mock model, it shouldn't be called for
			// purely deterministic fields
			const model = createMockModel({});

			const ai = new WritrAI(writr, { model });
			const metadata = await ai.getMetadata({
				title: false,
				tags: false,
				keywords: false,
				description: false,
				preview: false,
				summary: false,
				category: false,
				topic: false,
				audience: false,
				difficulty: false,
				readingTime: true,
				wordCount: true,
			});

			expect(metadata.wordCount).toBeTypeOf("number");
			expect(metadata.readingTime).toBeTypeOf("number");
			expect(metadata.title).toBeUndefined();
		});

		it("should use cached metadata when cache is enabled", async () => {
			const writr = new Writr("# Hello World\n\nSome content here.");
			let callCount = 0;
			const model = new MockLanguageModelV3({
				doGenerate: async () => {
					callCount++;
					return {
						content: [
							{
								type: "text" as const,
								text: JSON.stringify({ title: "Hello World" }),
							},
						],
						finishReason: "stop" as const,
						usage: { inputTokens: 10, outputTokens: 20 },
						warnings: [],
					};
				},
			});

			const ai = new WritrAI(writr, { model, cache: true });

			const options = {
				title: true,
			};

			const result1 = await ai.getMetadata(options);
			const result2 = await ai.getMetadata(options);

			expect(result1.title).toBe("Hello World");
			expect(result2.title).toBe("Hello World");
			expect(callCount).toBe(1);
		});
	});

	describe("getSEO", () => {
		it("should generate SEO metadata with all fields", async () => {
			const writr = new Writr(productPageWithMarkdown);
			const model = createMockModel({
				slug: "super-comfortable-chair",
				canonical: "https://example.com/products/super-comfortable-chair",
				openGraph: {
					title: "Super Comfortable Chair",
					description: "An ergonomic chair for maximum comfort.",
					image: "https://example.com/images/chair.jpg",
				},
			});

			const ai = new WritrAI(writr, { model });
			const seo = await ai.getSEO();

			expect(seo.slug).toBe("super-comfortable-chair");
			expect(seo.canonical).toBe(
				"https://example.com/products/super-comfortable-chair",
			);
			expect(seo.openGraph?.title).toBe("Super Comfortable Chair");
			expect(seo.openGraph?.description).toBe(
				"An ergonomic chair for maximum comfort.",
			);
		});

		it("should use opt-in mode for SEO when any field is set to true", async () => {
			const writr = new Writr(blogPostWithMarkdown);
			const model = createMockModel({
				slug: "understanding-async-await",
			});

			const ai = new WritrAI(writr, { model });
			const seo = await ai.getSEO({
				slug: true,
			});

			expect(seo.slug).toBe("understanding-async-await");
			expect(seo.canonical).toBeUndefined();
			expect(seo.openGraph).toBeUndefined();
		});

		it("should generate only selected SEO fields", async () => {
			const writr = new Writr(blogPostWithMarkdown);
			const model = createMockModel({
				slug: "understanding-async-await",
			});

			const ai = new WritrAI(writr, { model });
			const seo = await ai.getSEO({
				slug: true,
				canonical: false,
				openGraph: false,
			});

			expect(seo.slug).toBe("understanding-async-await");
		});

		it("should use cached SEO when cache is enabled", async () => {
			const writr = new Writr("# Test Document");
			let callCount = 0;
			const model = new MockLanguageModelV3({
				doGenerate: async () => {
					callCount++;
					return {
						content: [
							{
								type: "text" as const,
								text: JSON.stringify({ slug: "test-document" }),
							},
						],
						finishReason: "stop" as const,
						usage: { inputTokens: 10, outputTokens: 20 },
						warnings: [],
					};
				},
			});

			const ai = new WritrAI(writr, { model, cache: true });
			const options = { slug: true };

			await ai.getSEO(options);
			await ai.getSEO(options);

			expect(callCount).toBe(1);
		});
	});

	describe("getTranslation", () => {
		it("should return a new Writr instance with translated content", async () => {
			const writr = new Writr("# Hello World\n\nThis is a test document.");
			const translatedContent =
				"# Hola Mundo\n\nEste es un documento de prueba.";
			const model = createMockTextModel(translatedContent);

			const ai = new WritrAI(writr, { model });
			const result = await ai.getTranslation({ to: "es" });

			expect(result).toBeInstanceOf(Writr);
			expect(result.body).toContain("Hola Mundo");
		});

		it("should use cached translations when cache is enabled", async () => {
			const writr = new Writr("# Hello World");
			let callCount = 0;
			const model = new MockLanguageModelV3({
				doGenerate: async () => {
					callCount++;
					return {
						content: [
							{
								type: "text" as const,
								text: "# Hola Mundo",
							},
						],
						finishReason: "stop" as const,
						usage: { inputTokens: 10, outputTokens: 20 },
						warnings: [],
					};
				},
			});

			const ai = new WritrAI(writr, { model, cache: true });
			const options = { to: "es" };

			await ai.getTranslation(options);
			await ai.getTranslation(options);

			expect(callCount).toBe(1);
		});

		it("should accept from and translateFrontMatter options", async () => {
			const writr = new Writr('---\ntitle: "Hello"\n---\n\n# Hello World');
			const translatedContent = '---\ntitle: "Hola"\n---\n\n# Hola Mundo';
			const model = createMockTextModel(translatedContent);

			const ai = new WritrAI(writr, { model });
			const result = await ai.getTranslation({
				to: "es",
				from: "en",
				translateFrontMatter: true,
			});

			expect(result).toBeInstanceOf(Writr);
		});
	});

	describe("applyMetadata", () => {
		it("should apply generated metadata to frontmatter", async () => {
			const writr = new Writr(
				"---\ntitle: Existing Title\n---\n\n# Content\n\nSome words here for word counting.",
			);
			const model = createMockModel({
				title: "Generated Title",
				description: "A document about content.",
				category: "docs",
			});

			const ai = new WritrAI(writr, { model });
			const result = await ai.applyMetadata({
				generate: {
					title: true,
					tags: false,
					keywords: false,
					description: true,
					preview: false,
					summary: false,
					category: true,
					topic: false,
					audience: false,
					difficulty: false,
					readingTime: true,
					wordCount: true,
				},
			});

			expect(result.writr).toBe(writr);
			expect(result.generated.description).toBe("A document about content.");
			expect(result.applied).toContain("description");
			expect(result.applied).toContain("category");
			expect(result.skipped).toContain("title");
			expect(result.overwritten).toEqual([]);

			// Verify frontmatter was updated
			expect(writr.frontMatter.description).toBe("A document about content.");
			expect(writr.frontMatter.title).toBe("Existing Title");
		});

		it("should overwrite existing fields when overwrite is true", async () => {
			const writr = new Writr(
				"---\ntitle: Old Title\ndescription: Old description\n---\n\n# Content",
			);
			const model = createMockModel({
				title: "New Title",
				description: "New description",
			});

			const ai = new WritrAI(writr, { model });
			const result = await ai.applyMetadata({
				overwrite: true,
				generate: {
					title: true,
					description: true,
					tags: false,
					keywords: false,
					preview: false,
					summary: false,
					category: false,
					topic: false,
					audience: false,
					difficulty: false,
					readingTime: false,
					wordCount: false,
				},
			});

			expect(result.overwritten).toContain("title");
			expect(result.overwritten).toContain("description");
			expect(writr.frontMatter.title).toBe("New Title");
		});

		it("should overwrite only specified fields when overwrite is an array", async () => {
			const writr = new Writr(
				"---\ntitle: Old Title\ndescription: Old description\n---\n\n# Content",
			);
			const model = createMockModel({
				title: "New Title",
				description: "New description",
			});

			const ai = new WritrAI(writr, { model });
			const result = await ai.applyMetadata({
				overwrite: ["title"],
				generate: {
					title: true,
					description: true,
					tags: false,
					keywords: false,
					preview: false,
					summary: false,
					category: false,
					topic: false,
					audience: false,
					difficulty: false,
					readingTime: false,
					wordCount: false,
				},
			});

			expect(result.overwritten).toContain("title");
			expect(result.skipped).toContain("description");
			expect(writr.frontMatter.title).toBe("New Title");
			expect(writr.frontMatter.description).toBe("Old description");
		});

		it("should use fieldMap to map metadata to custom frontmatter keys", async () => {
			const writr = new Writr("---\n---\n\n# Content\n\nSome text.");
			const model = createMockModel({
				description: "A test document.",
			});

			const ai = new WritrAI(writr, { model });
			const result = await ai.applyMetadata({
				fieldMap: { description: "meta_description" },
				generate: {
					title: false,
					tags: false,
					keywords: false,
					description: true,
					preview: false,
					summary: false,
					category: false,
					topic: false,
					audience: false,
					difficulty: false,
					readingTime: false,
					wordCount: false,
				},
			});

			expect(result.applied).toContain("description");
			expect(writr.frontMatter.meta_description).toBe("A test document.");
			expect(writr.frontMatter.description).toBeUndefined();
		});

		it("should skip keys where generated value is undefined", async () => {
			const writr = new Writr("---\n---\n\n# Content\n\nSome text.");
			const model = createMockModel({
				title: "Generated Title",
			});

			const ai = new WritrAI(writr, { model });

			// Spy on getMetadata to return an object with an explicit undefined key
			vi.spyOn(ai, "getMetadata").mockResolvedValue({
				title: "Generated Title",
				description: undefined,
			} as unknown as WritrMetadata);

			const result = await ai.applyMetadata({
				generate: {
					title: true,
					description: true,
					tags: false,
					keywords: false,
					preview: false,
					summary: false,
					category: false,
					topic: false,
					audience: false,
					difficulty: false,
					readingTime: false,
					wordCount: false,
				},
			});

			expect(result.applied).toContain("title");
			expect(result.applied).not.toContain("description");
			expect(result.skipped).not.toContain("description");
			expect(result.overwritten).not.toContain("description");
			expect(writr.frontMatter.title).toBe("Generated Title");
			expect(writr.frontMatter.description).toBeUndefined();
		});
	});
});

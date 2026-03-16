import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import dotenv from "dotenv";
import { describe, expect, it } from "vitest";
import { Writr } from "../src/writr.js";
import { WritrAI } from "../src/writr-ai.js";
import {
	blogPostWithMarkdown,
	productPageWithMarkdown,
} from "./content-fixtures.js";

dotenv.config();

const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
const hasGemini = Boolean(process.env.GEMINI_API_KEY);
const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);

describe.skipIf(!hasOpenAI)("writr-ai integration (OpenAI)", () => {
	const model = openai("gpt-4.1-mini");

	it("should generate metadata with all fields", async () => {
		const writr = new Writr(productPageWithMarkdown);
		const ai = new WritrAI(writr, { model });
		const metadata = await ai.getMetadata();

		expect(metadata.title).toBeTypeOf("string");
		expect(metadata.title?.length).toBeGreaterThan(0);
		expect(metadata.tags).toBeInstanceOf(Array);
		expect(metadata.tags?.length).toBeGreaterThan(0);
		expect(metadata.keywords).toBeInstanceOf(Array);
		expect(metadata.description).toBeTypeOf("string");
		expect(metadata.preview).toBeTypeOf("string");
		expect(metadata.summary).toBeTypeOf("string");
		expect(metadata.category).toBeTypeOf("string");
		expect(metadata.topic).toBeTypeOf("string");
		expect(metadata.audience).toBeTypeOf("string");
		expect(metadata.difficulty).toMatch(/^(beginner|intermediate|advanced)$/);
		expect(metadata.wordCount).toBeTypeOf("number");
		expect(metadata.wordCount).toBeGreaterThan(0);
		expect(metadata.readingTime).toBeTypeOf("number");
		expect(metadata.readingTime).toBeGreaterThanOrEqual(1);
	}, 30_000);

	it("should generate only selected metadata fields", async () => {
		const writr = new Writr(blogPostWithMarkdown);
		const ai = new WritrAI(writr, { model });
		const metadata = await ai.getMetadata({
			title: true,
			description: true,
		});

		expect(metadata.title).toBeTypeOf("string");
		expect(metadata.description).toBeTypeOf("string");
		expect(metadata.tags).toBeUndefined();
		expect(metadata.wordCount).toBeUndefined();
	}, 30_000);

	it("should generate SEO metadata", async () => {
		const writr = new Writr(blogPostWithMarkdown);
		const ai = new WritrAI(writr, { model });
		const seo = await ai.getSEO();

		expect(seo.slug).toBeTypeOf("string");
		expect(seo.slug?.length).toBeGreaterThan(0);
		expect(seo.canonical).toBeTypeOf("string");
		expect(seo.openGraph).toBeDefined();
		expect(seo.openGraph?.title).toBeTypeOf("string");
		expect(seo.openGraph?.description).toBeTypeOf("string");
	}, 30_000);

	it("should generate only selected SEO fields", async () => {
		const writr = new Writr(blogPostWithMarkdown);
		const ai = new WritrAI(writr, { model });
		const seo = await ai.getSEO({ slug: true });

		expect(seo.slug).toBeTypeOf("string");
		expect(seo.canonical).toBeUndefined();
		expect(seo.openGraph).toBeUndefined();
	}, 30_000);

	it("should translate content", async () => {
		const writr = new Writr("# Hello World\n\nThis is a simple test document.");
		const ai = new WritrAI(writr, { model });
		const translated = await ai.getTranslation({ to: "es", from: "en" });

		expect(translated).toBeInstanceOf(Writr);
		expect(translated.body).toBeTruthy();
		expect(translated.body).not.toContain("Hello World");
	}, 30_000);

	it("should apply metadata to frontmatter", async () => {
		const writr = new Writr(
			"---\ntitle: Keep This\n---\n\n# Some Document\n\nContent for metadata generation.",
		);
		const ai = new WritrAI(writr, { model });
		const result = await ai.applyMetadata({
			generate: { description: true, category: true },
		});

		expect(result.applied).toContain("description");
		expect(result.applied).toContain("category");
		expect(result.skipped).toContain("title");
		expect(writr.frontMatter.title).toBe("Keep This");
		expect(writr.frontMatter.description).toBeTypeOf("string");
	}, 30_000);

	it("should use cache to avoid duplicate calls", async () => {
		const writr = new Writr(blogPostWithMarkdown);
		const ai = new WritrAI(writr, { model, cache: true });
		const options = { title: true };

		const result1 = await ai.getMetadata(options);
		const result2 = await ai.getMetadata(options);

		expect(result1.title).toBe(result2.title);
	}, 30_000);
});

describe.skipIf(!hasGemini)("writr-ai integration (Google Gemini)", () => {
	const model = google("gemini-2.0-flash");

	it("should generate metadata with all fields", async () => {
		const writr = new Writr(productPageWithMarkdown);
		const ai = new WritrAI(writr, { model });
		const metadata = await ai.getMetadata();

		expect(metadata.title).toBeTypeOf("string");
		expect(metadata.title?.length).toBeGreaterThan(0);
		expect(metadata.tags).toBeInstanceOf(Array);
		expect(metadata.tags?.length).toBeGreaterThan(0);
		expect(metadata.keywords).toBeInstanceOf(Array);
		expect(metadata.description).toBeTypeOf("string");
		expect(metadata.preview).toBeTypeOf("string");
		expect(metadata.summary).toBeTypeOf("string");
		expect(metadata.category).toBeTypeOf("string");
		expect(metadata.topic).toBeTypeOf("string");
		expect(metadata.audience).toBeTypeOf("string");
		expect(metadata.difficulty).toMatch(/^(beginner|intermediate|advanced)$/);
		expect(metadata.wordCount).toBeTypeOf("number");
		expect(metadata.wordCount).toBeGreaterThan(0);
		expect(metadata.readingTime).toBeTypeOf("number");
		expect(metadata.readingTime).toBeGreaterThanOrEqual(1);
	}, 30_000);

	it("should generate only selected metadata fields", async () => {
		const writr = new Writr(blogPostWithMarkdown);
		const ai = new WritrAI(writr, { model });
		const metadata = await ai.getMetadata({
			title: true,
			description: true,
		});

		expect(metadata.title).toBeTypeOf("string");
		expect(metadata.description).toBeTypeOf("string");
		expect(metadata.tags).toBeUndefined();
		expect(metadata.wordCount).toBeUndefined();
	}, 30_000);

	it("should generate SEO metadata", async () => {
		const writr = new Writr(blogPostWithMarkdown);
		const ai = new WritrAI(writr, { model });
		const seo = await ai.getSEO();

		expect(seo.slug).toBeTypeOf("string");
		expect(seo.slug?.length).toBeGreaterThan(0);
		expect(seo.canonical).toBeTypeOf("string");
		expect(seo.openGraph).toBeDefined();
		expect(seo.openGraph?.title).toBeTypeOf("string");
		expect(seo.openGraph?.description).toBeTypeOf("string");
	}, 30_000);

	it("should generate only selected SEO fields", async () => {
		const writr = new Writr(blogPostWithMarkdown);
		const ai = new WritrAI(writr, { model });
		const seo = await ai.getSEO({ slug: true });

		expect(seo.slug).toBeTypeOf("string");
		expect(seo.canonical).toBeUndefined();
		expect(seo.openGraph).toBeUndefined();
	}, 30_000);

	it("should translate content", async () => {
		const writr = new Writr("# Hello World\n\nThis is a simple test document.");
		const ai = new WritrAI(writr, { model });
		const translated = await ai.getTranslation({ to: "es", from: "en" });

		expect(translated).toBeInstanceOf(Writr);
		expect(translated.body).toBeTruthy();
		expect(translated.body).not.toContain("Hello World");
	}, 30_000);

	it("should apply metadata to frontmatter", async () => {
		const writr = new Writr(
			"---\ntitle: Keep This\n---\n\n# Some Document\n\nContent for metadata generation.",
		);
		const ai = new WritrAI(writr, { model });
		const result = await ai.applyMetadata({
			generate: { description: true, category: true },
		});

		expect(result.applied).toContain("description");
		expect(result.applied).toContain("category");
		expect(result.skipped).toContain("title");
		expect(writr.frontMatter.title).toBe("Keep This");
		expect(writr.frontMatter.description).toBeTypeOf("string");
	}, 30_000);

	it("should use cache to avoid duplicate calls", async () => {
		const writr = new Writr(blogPostWithMarkdown);
		const ai = new WritrAI(writr, { model, cache: true });
		const options = { title: true };

		const result1 = await ai.getMetadata(options);
		const result2 = await ai.getMetadata(options);

		expect(result1.title).toBe(result2.title);
	}, 30_000);
});

describe.skipIf(!hasAnthropic)("writr-ai integration (Anthropic)", () => {
	const model = anthropic("claude-haiku-4-5-20251001");

	it("should generate metadata with all fields", async () => {
		const writr = new Writr(productPageWithMarkdown);
		const ai = new WritrAI(writr, { model });
		const metadata = await ai.getMetadata();

		expect(metadata.title).toBeTypeOf("string");
		expect(metadata.title?.length).toBeGreaterThan(0);
		expect(metadata.tags).toBeInstanceOf(Array);
		expect(metadata.tags?.length).toBeGreaterThan(0);
		expect(metadata.keywords).toBeInstanceOf(Array);
		expect(metadata.description).toBeTypeOf("string");
		expect(metadata.preview).toBeTypeOf("string");
		expect(metadata.summary).toBeTypeOf("string");
		expect(metadata.category).toBeTypeOf("string");
		expect(metadata.topic).toBeTypeOf("string");
		expect(metadata.audience).toBeTypeOf("string");
		expect(metadata.difficulty).toMatch(/^(beginner|intermediate|advanced)$/);
		expect(metadata.wordCount).toBeTypeOf("number");
		expect(metadata.wordCount).toBeGreaterThan(0);
		expect(metadata.readingTime).toBeTypeOf("number");
		expect(metadata.readingTime).toBeGreaterThanOrEqual(1);
	}, 30_000);

	it("should generate only selected metadata fields", async () => {
		const writr = new Writr(blogPostWithMarkdown);
		const ai = new WritrAI(writr, { model });
		const metadata = await ai.getMetadata({
			title: true,
			description: true,
		});

		expect(metadata.title).toBeTypeOf("string");
		expect(metadata.description).toBeTypeOf("string");
		expect(metadata.tags).toBeUndefined();
		expect(metadata.wordCount).toBeUndefined();
	}, 30_000);

	it("should generate SEO metadata", async () => {
		const writr = new Writr(blogPostWithMarkdown);
		const ai = new WritrAI(writr, { model });
		const seo = await ai.getSEO();

		expect(seo.slug).toBeTypeOf("string");
		expect(seo.slug?.length).toBeGreaterThan(0);
		expect(seo.canonical).toBeTypeOf("string");
		expect(seo.openGraph).toBeDefined();
		expect(seo.openGraph?.title).toBeTypeOf("string");
		expect(seo.openGraph?.description).toBeTypeOf("string");
	}, 30_000);

	it("should generate only selected SEO fields", async () => {
		const writr = new Writr(blogPostWithMarkdown);
		const ai = new WritrAI(writr, { model });
		const seo = await ai.getSEO({ slug: true });

		expect(seo.slug).toBeTypeOf("string");
		expect(seo.canonical).toBeUndefined();
		expect(seo.openGraph).toBeUndefined();
	}, 30_000);

	it("should translate content", async () => {
		const writr = new Writr("# Hello World\n\nThis is a simple test document.");
		const ai = new WritrAI(writr, { model });
		const translated = await ai.getTranslation({ to: "es", from: "en" });

		expect(translated).toBeInstanceOf(Writr);
		expect(translated.body).toBeTruthy();
		expect(translated.body).not.toContain("Hello World");
	}, 30_000);

	it("should apply metadata to frontmatter", async () => {
		const writr = new Writr(
			"---\ntitle: Keep This\n---\n\n# Some Document\n\nContent for metadata generation.",
		);
		const ai = new WritrAI(writr, { model });
		const result = await ai.applyMetadata({
			generate: { description: true, category: true },
		});

		expect(result.applied).toContain("description");
		expect(result.applied).toContain("category");
		expect(result.skipped).toContain("title");
		expect(writr.frontMatter.title).toBe("Keep This");
		expect(writr.frontMatter.description).toBeTypeOf("string");
	}, 30_000);

	it("should use cache to avoid duplicate calls", async () => {
		const writr = new Writr(blogPostWithMarkdown);
		const ai = new WritrAI(writr, { model, cache: true });
		const options = { title: true };

		const result1 = await ai.getMetadata(options);
		const result2 = await ai.getMetadata(options);

		expect(result1.title).toBe(result2.title);
	}, 30_000);
});

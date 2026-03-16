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

dotenv.config({ quiet: true });

const providers = [
	{
		name: "OpenAI",
		model: () => openai("gpt-5-mini"),
		enabled: Boolean(process.env.OPENAI_API_KEY),
	},
	{
		name: "Google Gemini",
		model: () => google("gemini-2.5-flash"),
		enabled: Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY),
	},
	{
		name: "Anthropic",
		model: () => anthropic("claude-haiku-4-5-20251001"),
		enabled: Boolean(process.env.ANTHROPIC_API_KEY),
	},
];

for (const provider of providers) {
	describe.skipIf(!provider.enabled)(
		`writr-ai integration (${provider.name})`,
		() => {
			const model = provider.model();

			it("should generate, select, apply, and cache metadata", async () => {
				// Generate all metadata fields
				const writr1 = new Writr(productPageWithMarkdown);
				const ai1 = new WritrAI(writr1, { model });
				const metadata = await ai1.getMetadata();

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
				expect(metadata.difficulty).toMatch(
					/^(beginner|intermediate|advanced)$/,
				);
				expect(metadata.wordCount).toBeTypeOf("number");
				expect(metadata.wordCount).toBeGreaterThan(0);
				expect(metadata.readingTime).toBeTypeOf("number");
				expect(metadata.readingTime).toBeGreaterThanOrEqual(1);

				// Generate only selected fields
				const writr2 = new Writr(blogPostWithMarkdown);
				const ai2 = new WritrAI(writr2, { model });
				const selected = await ai2.getMetadata({
					title: true,
					description: true,
				});

				expect(selected.title).toBeTypeOf("string");
				expect(selected.description).toBeTypeOf("string");
				expect(selected.tags).toBeUndefined();
				expect(selected.wordCount).toBeUndefined();

				// Apply metadata to frontmatter
				const writr3 = new Writr(
					"---\ntitle: Keep This\n---\n\n# Some Document\n\nContent for metadata generation.",
				);
				const ai3 = new WritrAI(writr3, { model });
				const result = await ai3.applyMetadata({
					generate: { description: true, category: true },
				});

				expect(result.applied).toContain("description");
				expect(result.applied).toContain("category");
				expect(writr3.frontMatter.title).toBe("Keep This");
				expect(writr3.frontMatter.description).toBeTypeOf("string");

				// Cache returns same result
				const writr4 = new Writr(blogPostWithMarkdown);
				const ai4 = new WritrAI(writr4, { model, cache: true });
				const options = { title: true };
				const result1 = await ai4.getMetadata(options);
				const result2 = await ai4.getMetadata(options);

				expect(result1.title).toBe(result2.title);
			}, 120_000);

			it("should generate SEO metadata and translate content", async () => {
				// Generate all SEO fields
				const writr1 = new Writr(blogPostWithMarkdown);
				const ai1 = new WritrAI(writr1, { model });
				const seo = await ai1.getSEO();

				expect(seo.slug).toBeTypeOf("string");
				expect(seo.slug?.length).toBeGreaterThan(0);
				expect(seo.canonical).toBeTypeOf("string");
				expect(seo.openGraph).toBeDefined();
				expect(seo.openGraph?.title).toBeTypeOf("string");
				expect(seo.openGraph?.description).toBeTypeOf("string");

				// Generate only selected SEO fields
				const writr2 = new Writr(blogPostWithMarkdown);
				const ai2 = new WritrAI(writr2, { model });
				const selectedSeo = await ai2.getSEO({ slug: true });

				expect(selectedSeo.slug).toBeTypeOf("string");
				expect(selectedSeo.canonical).toBeUndefined();
				expect(selectedSeo.openGraph).toBeUndefined();

				// Translate content
				const writr3 = new Writr(
					"# Hello World\n\nThis is a simple test document.",
				);
				const ai3 = new WritrAI(writr3, { model });
				const translated = await ai3.getTranslation({ to: "es", from: "en" });

				expect(translated).toBeInstanceOf(Writr);
				expect(translated.body).toBeTruthy();
				expect(translated.body).not.toContain("Hello World");
			}, 120_000);
		},
	);
}

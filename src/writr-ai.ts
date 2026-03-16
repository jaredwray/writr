import { generateObject, generateText, type LanguageModel } from "ai";
import { z } from "zod";
import type {
	WritrAIOptions,
	WritrAIPrompts,
	WritrApplyMetadataOptions,
	WritrApplyMetadataResult,
	WritrGetMetadataOptions,
	WritrGetSEOOptions,
	WritrMetadata,
	WritrMetadataKey,
	WritrSEO,
	WritrTranslationOptions,
} from "./types.js";
import { Writr } from "./writr.js";
import { WritrAICache } from "./writr-ai-cache.js";

const AVERAGE_WORDS_PER_MINUTE = 200;

/**
 * AI companion for a {@link Writr} instance.
 *
 * WritrAI provides metadata generation, SEO generation,
 * translation, and metadata application for markdown documents.
 */
export class WritrAI {
	/**
	 * The AI SDK model used for all generation requests.
	 */
	public model: LanguageModel;

	/**
	 * The prompt templates used by this WritrAI instance.
	 */
	public prompts: WritrAIPrompts;

	/**
	 * Optional in-memory cache for generated AI results.
	 */
	public cache?: WritrAICache;

	/**
	 * Creates a new WritrAI instance bound to a specific Writr document.
	 *
	 * @param writr - The base Writr instance this AI helper operates on.
	 * @param options - The AI model and optional cache/prompt settings.
	 */
	constructor(
		public readonly writr: Writr,
		options: WritrAIOptions,
	) {
		this.model = options.model;
		this.prompts = options.prompts ?? {};
		this.cache = options.cache ? new WritrAICache() : undefined;
	}

	/**
	 * Generates metadata for the current markdown document.
	 *
	 * @param options - Controls which metadata fields should be generated.
	 * @returns A metadata object for the current document.
	 */
	public async getMetadata(
		options?: WritrGetMetadataOptions,
	): Promise<WritrMetadata> {
		const cacheKey = `metadata:${JSON.stringify(options ?? {})}`;
		const cached = this.cache?.get<WritrMetadata>(cacheKey, this.writr.content);
		if (cached) {
			return cached;
		}

		const fields = this.resolveMetadataFields(options);
		const result: WritrMetadata = {};

		// Deterministic fields
		if (fields.includes("wordCount")) {
			result.wordCount = this.computeWordCount();
		}

		if (fields.includes("readingTime")) {
			result.readingTime = this.computeReadingTime();
		}

		// AI fields
		const aiFields = fields.filter(
			(f) => f !== "wordCount" && f !== "readingTime",
		);

		if (aiFields.length > 0) {
			const schema = this.buildMetadataSchema(aiFields);
			const prompt =
				this.prompts.metadata ??
				"Analyze the following markdown document and generate metadata for it. Be concise and accurate.";

			const { object } = await generateObject({
				model: this.model,
				schema,
				prompt: `${prompt}\n\n---\n\n${this.writr.content}`,
			});

			Object.assign(result, object);
		}

		this.cache?.set(cacheKey, this.writr.content, result);

		return result;
	}

	/**
	 * Generates SEO metadata for the current markdown document.
	 *
	 * @param options - Controls which SEO fields should be generated.
	 * @returns An SEO metadata object for the current document.
	 */
	public async getSEO(options?: WritrGetSEOOptions): Promise<WritrSEO> {
		const cacheKey = `seo:${JSON.stringify(options ?? {})}`;
		const cached = this.cache?.get<WritrSEO>(cacheKey, this.writr.content);
		if (cached) {
			return cached;
		}

		const fields = this.resolveSEOFields(options);
		const schema = this.buildSEOSchema(fields);

		const prompt =
			this.prompts.seo ??
			"Analyze the following markdown document and generate SEO metadata for it. Be concise and accurate.";

		const { object } = await generateObject({
			model: this.model,
			schema,
			prompt: `${prompt}\n\n---\n\n${this.writr.content}`,
		});

		const result = object as WritrSEO;

		this.cache?.set(cacheKey, this.writr.content, result);

		return result;
	}

	/**
	 * Generates a translated version of the current document.
	 *
	 * @param options - Translation settings including target locale.
	 * @returns A new translated Writr instance.
	 */
	public async getTranslation(
		options: WritrTranslationOptions,
	): Promise<Writr> {
		const cacheKey = `translation:${JSON.stringify(options)}`;
		const cached = this.cache?.get<string>(cacheKey, this.writr.content);
		if (cached) {
			return new Writr(cached);
		}

		const fromClause = options.from ? ` from ${options.from}` : "";
		const frontMatterClause = options.translateFrontMatter
			? " Also translate any string values in the YAML frontmatter."
			: " Preserve the YAML frontmatter exactly as-is without translating it.";

		const prompt =
			this.prompts.translation ??
			`Translate the following markdown document${fromClause} to ${options.to}.${frontMatterClause} Preserve all markdown formatting, links, code blocks, and structure. Return only the translated markdown document with no additional commentary.`;

		const { text } = await generateText({
			model: this.model,
			prompt: `${prompt}\n\n---\n\n${this.writr.content}`,
		});

		this.cache?.set(cacheKey, this.writr.content, text);

		return new Writr(text);
	}

	/**
	 * Generates metadata and applies it to the document frontmatter.
	 *
	 * @param options - Controls generation, overwrite behavior, and field mapping.
	 * @returns A result object describing what metadata was generated and applied.
	 */
	public async applyMetadata(
		options?: WritrApplyMetadataOptions,
	): Promise<WritrApplyMetadataResult> {
		const generated = await this.getMetadata(options?.generate);
		const frontMatter = { ...this.writr.frontMatter };
		const fieldMap = options?.fieldMap ?? {};
		const overwrite = options?.overwrite;

		const applied: WritrMetadataKey[] = [];
		const overwritten: WritrMetadataKey[] = [];
		const skipped: WritrMetadataKey[] = [];

		const overwriteSet = Array.isArray(overwrite)
			? new Set(overwrite)
			: undefined;

		for (const key of Object.keys(generated) as WritrMetadataKey[]) {
			const value = generated[key];
			if (value === undefined) {
				continue;
			}

			const frontMatterKey = fieldMap[key] ?? key;
			const exists = frontMatterKey in frontMatter;

			if (!exists) {
				frontMatter[frontMatterKey] = value;
				applied.push(key);
			} else if (overwrite === true || overwriteSet?.has(key)) {
				frontMatter[frontMatterKey] = value;
				overwritten.push(key);
			} else {
				skipped.push(key);
			}
		}

		this.writr.frontMatter = frontMatter;

		return {
			writr: this.writr,
			generated,
			applied,
			overwritten,
			skipped,
		};
	}

	private resolveMetadataFields(
		options?: WritrGetMetadataOptions,
	): WritrMetadataKey[] {
		const allFields: WritrMetadataKey[] = [
			"title",
			"tags",
			"keywords",
			"description",
			"preview",
			"summary",
			"category",
			"topic",
			"audience",
			"difficulty",
			"readingTime",
			"wordCount",
		];

		if (!options) {
			return allFields;
		}

		return allFields.filter(
			(field) => options[field as keyof WritrGetMetadataOptions] === true,
		);
	}

	private resolveSEOFields(options?: WritrGetSEOOptions): string[] {
		const allFields = ["slug", "canonical", "openGraph"];

		if (!options) {
			return allFields;
		}

		return allFields.filter(
			(field) => options[field as keyof WritrGetSEOOptions] === true,
		);
	}

	// biome-ignore lint/suspicious/noExplicitAny: dynamic schema construction
	private buildMetadataSchema(fields: WritrMetadataKey[]): z.ZodObject<any> {
		const fieldSet = new Set(fields);
		// biome-ignore lint/suspicious/noExplicitAny: dynamic schema construction
		const entries: Array<[string, any]> = [];

		if (fieldSet.has("title")) {
			entries.push([
				"title",
				z.string().describe("The best-fit title for the document"),
			]);
		}

		if (fieldSet.has("tags")) {
			entries.push([
				"tags",
				z
					.array(z.string())
					.describe("Human-friendly labels for organizing the document"),
			]);
		}

		if (fieldSet.has("keywords")) {
			entries.push([
				"keywords",
				z
					.array(z.string())
					.describe("Search-oriented terms related to the document"),
			]);
		}

		if (fieldSet.has("description")) {
			entries.push([
				"description",
				z.string().describe("A concise meta-style description of the document"),
			]);
		}

		if (fieldSet.has("preview")) {
			entries.push([
				"preview",
				z.string().describe("A short teaser or preview of the content"),
			]);
		}

		if (fieldSet.has("summary")) {
			entries.push([
				"summary",
				z.string().describe("A slightly longer overview of the document"),
			]);
		}

		if (fieldSet.has("category")) {
			entries.push([
				"category",
				z
					.string()
					.describe('A broad grouping such as "docs", "guide", or "blog"'),
			]);
		}

		if (fieldSet.has("topic")) {
			entries.push([
				"topic",
				z.string().describe("The primary subject the document is about"),
			]);
		}

		if (fieldSet.has("audience")) {
			entries.push([
				"audience",
				z
					.string()
					.describe(
						'The intended audience such as "developers" or "beginners"',
					),
			]);
		}

		if (fieldSet.has("difficulty")) {
			entries.push([
				"difficulty",
				z
					.enum(["beginner", "intermediate", "advanced"])
					.describe(
						"The estimated skill level required to understand the document",
					),
			]);
		}

		return z.object(Object.fromEntries(entries));
	}

	// biome-ignore lint/suspicious/noExplicitAny: dynamic schema construction
	private buildSEOSchema(fields: string[]): z.ZodObject<any> {
		const fieldSet = new Set(fields);
		// biome-ignore lint/suspicious/noExplicitAny: dynamic schema construction
		const entries: Array<[string, any]> = [];

		if (fieldSet.has("slug")) {
			entries.push([
				"slug",
				z.string().describe("A URL-safe identifier for the document"),
			]);
		}

		if (fieldSet.has("canonical")) {
			entries.push([
				"canonical",
				z.string().describe("The preferred canonical URL for the document"),
			]);
		}

		if (fieldSet.has("openGraph")) {
			entries.push([
				"openGraph",
				z
					.object({
						title: z.string().describe("The social sharing title"),
						description: z.string().describe("The social sharing description"),
						image: z
							.string()
							.describe("The image URL for social sharing")
							.nullable(),
					})
					.describe("Open Graph metadata"),
			]);
		}

		return z.object(Object.fromEntries(entries));
	}

	private computeWordCount(): number {
		const text = this.writr.body;
		const words = text
			.replace(/```[\s\S]*?```/g, "")
			.replace(/`[^`]*`/g, "")
			.replace(/[#*_[\]()>~|-]/g, " ")
			.split(/\s+/)
			.filter((word) => word.length > 0);
		return words.length;
	}

	private computeReadingTime(): number {
		const wordCount = this.computeWordCount();
		return Math.max(1, Math.ceil(wordCount / AVERAGE_WORDS_PER_MINUTE));
	}
}

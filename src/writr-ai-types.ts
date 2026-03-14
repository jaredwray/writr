import type { LanguageModel } from "ai";
import type { Writr } from "./writr.js";

/**
 * Metadata generated for a markdown document.
 */
export type WritrMetadata = {
	/**
	 * The best-fit title for the document.
	 */
	title?: string;

	/**
	 * Human-friendly labels for organizing the document.
	 */
	tags?: string[];

	/**
	 * Search-oriented terms related to the document.
	 */
	keywords?: string[];

	/**
	 * A concise meta-style description of the document.
	 */
	description?: string;

	/**
	 * A short teaser or preview of the content.
	 */
	preview?: string;

	/**
	 * A slightly longer overview of the document.
	 */
	summary?: string;

	/**
	 * A broad grouping for the document such as "docs", "guide", or "blog".
	 */
	category?: string;

	/**
	 * The primary subject the document is about.
	 */
	topic?: string;

	/**
	 * The intended audience for the document.
	 */
	audience?: string;

	/**
	 * The estimated skill level required to understand the document.
	 */
	difficulty?: "beginner" | "intermediate" | "advanced";

	/**
	 * Estimated reading time in minutes.
	 */
	readingTime?: number;

	/**
	 * Total number of words in the document.
	 */
	wordCount?: number;
};

/**
 * Search and social metadata for a markdown document.
 */
export type WritrSEO = {
	/**
	 * A URL-safe identifier for the document.
	 */
	slug?: string;

	/**
	 * The preferred canonical URL for the document.
	 */
	canonical?: string;

	/**
	 * Open Graph metadata used by social platforms.
	 */
	openGraph?: {
		/**
		 * The social sharing title for the document.
		 */
		title?: string;

		/**
		 * The social sharing description for the document.
		 */
		description?: string;

		/**
		 * The image URL to use when the document is shared socially.
		 */
		image?: string;
	};
};

/**
 * A valid metadata key from {@link WritrMetadata}.
 */
export type WritrMetadataKey = keyof WritrMetadata;

/**
 * Custom prompt templates used by WritrAI.
 */
export type WritrAIPrompts = {
	/**
	 * Custom prompt template used for metadata generation.
	 */
	metadata?: string;

	/**
	 * Custom prompt template used for SEO generation.
	 */
	seo?: string;

	/**
	 * Custom prompt template used for translation.
	 */
	translation?: string;
};

/**
 * Options used to configure a {@link WritrAI} instance.
 */
export type WritrAIOptions = {
	/**
	 * The AI SDK model instance used for generation.
	 * Example: `openai("gpt-4.1-mini")`.
	 */
	model: LanguageModel;

	/**
	 * Enables the in-memory AI cache when true.
	 */
	cache?: boolean;

	/**
	 * Optional prompt overrides for metadata, SEO, and translation.
	 */
	prompts?: WritrAIPrompts;
};

/**
 * Controls which metadata fields should be generated.
 * When omitted, WritrAI generates all supported metadata fields.
 */
export type WritrGetMetadataOptions = {
	/**
	 * Generate a title for the document.
	 */
	title?: boolean;

	/**
	 * Generate tags for the document.
	 */
	tags?: boolean;

	/**
	 * Generate keywords for the document.
	 */
	keywords?: boolean;

	/**
	 * Generate a meta-style description for the document.
	 */
	description?: boolean;

	/**
	 * Generate a short teaser or preview for the document.
	 */
	preview?: boolean;

	/**
	 * Generate a longer summary for the document.
	 */
	summary?: boolean;

	/**
	 * Generate a broad category for the document.
	 */
	category?: boolean;

	/**
	 * Generate the primary topic for the document.
	 */
	topic?: boolean;

	/**
	 * Generate the intended audience for the document.
	 */
	audience?: boolean;

	/**
	 * Generate a difficulty level for the document.
	 */
	difficulty?: boolean;

	/**
	 * Include a deterministic reading time estimate.
	 */
	readingTime?: boolean;

	/**
	 * Include a deterministic word count.
	 */
	wordCount?: boolean;
};

/**
 * Controls which SEO fields should be generated.
 * When omitted, WritrAI generates all supported SEO fields.
 */
export type WritrGetSEOOptions = {
	/**
	 * Generate a URL-safe slug.
	 */
	slug?: boolean;

	/**
	 * Generate a canonical URL value.
	 */
	canonical?: boolean;

	/**
	 * Generate Open Graph metadata for the document.
	 */
	openGraph?: boolean;
};

/**
 * Options used when generating a translated document.
 */
export type WritrTranslationOptions = {
	/**
	 * The target language or locale to translate the document into.
	 */
	to: string;

	/**
	 * The source language or locale of the document when known.
	 */
	from?: string;

	/**
	 * When true, frontmatter string values may also be translated.
	 */
	translateFrontMatter?: boolean;
};

/**
 * Options used when applying generated metadata to frontmatter.
 */
export type WritrApplyMetadataOptions = {
	/**
	 * Controls overwrite behavior for existing frontmatter values.
	 *
	 * - `true` overwrites all generated fields.
	 * - `false` or `undefined` fills only missing fields.
	 * - `WritrMetadataKey[]` overwrites only the specified fields.
	 */
	overwrite?: boolean | WritrMetadataKey[];

	/**
	 * Maps metadata keys to custom frontmatter field names.
	 */
	fieldMap?: Partial<Record<WritrMetadataKey, string>>;

	/**
	 * Controls which metadata fields should be generated before applying them.
	 */
	generate?: WritrGetMetadataOptions;
};

/**
 * Result returned after metadata has been applied to frontmatter.
 */
export type WritrApplyMetadataResult = {
	/**
	 * The Writr instance after metadata application.
	 */
	writr: Writr;

	/**
	 * The full metadata object that was generated during this operation.
	 */
	generated: WritrMetadata;

	/**
	 * Metadata fields that were newly written because they were missing.
	 */
	applied: WritrMetadataKey[];

	/**
	 * Metadata fields that replaced existing frontmatter values.
	 */
	overwritten: WritrMetadataKey[];

	/**
	 * Metadata fields that were generated but not written because
	 * they already existed and were not allowed to be overwritten.
	 */
	skipped: WritrMetadataKey[];
};

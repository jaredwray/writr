# WritrAI

WritrAI is an AI companion for Writr that provides metadata generation, SEO generation, translation, and metadata application for markdown documents. It uses the [Vercel AI SDK](https://sdk.vercel.ai) so you can plug in any supported model provider (OpenAI, Anthropic, Google, etc.).

## Getting Started

```typescript
import { Writr, WritrAI } from 'writr';
import { openai } from '@ai-sdk/openai';

const writr = new Writr('# My Document\n\nSome markdown content here.');
const ai = new WritrAI(writr, {
  model: openai('gpt-4.1-mini'),
});
```

## Constructor

```typescript
new WritrAI(writr: Writr, options: WritrAIOptions)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `writr` | `Writr` | The Writr instance the AI helper operates on. |
| `options` | `WritrAIOptions` | Configuration for the AI model, caching, and prompts. |

## Instance Properties

| Property | Type | Description |
|----------|------|-------------|
| `writr` | `Writr` | The bound Writr instance (read-only). |
| `model` | `LanguageModel` | The AI SDK model used for all generation requests. |
| `prompts` | `WritrAIPrompts` | The prompt templates used by this instance. |
| `cache` | `WritrAICache \| undefined` | Optional in-memory cache for generated AI results. |

## Methods

### `getMetadata(options?)`

Generates metadata for the current markdown document. When called without options, all fields are generated. When options are provided, only fields explicitly set to `true` are included.

```typescript
// Generate all metadata fields
const metadata = await ai.getMetadata();

// Generate only specific fields (opt-in)
const metadata = await ai.getMetadata({
  title: true,
  description: true,
  tags: true,
});
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `options` | `WritrGetMetadataOptions` | No | Controls which metadata fields to generate. |

**Returns:** `Promise<WritrMetadata>`

### `getSEO(options?)`

Generates SEO metadata for the current markdown document. When called without options, all fields are generated. When options are provided, only fields explicitly set to `true` are included.

```typescript
// Generate all SEO fields
const seo = await ai.getSEO();

// Generate only a slug
const seo = await ai.getSEO({ slug: true });
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `options` | `WritrGetSEOOptions` | No | Controls which SEO fields to generate. |

**Returns:** `Promise<WritrSEO>`

### `getTranslation(options)`

Generates a translated version of the current document, returning a new `Writr` instance with the translated content.

```typescript
const translated = await ai.getTranslation({ to: 'es' });
console.log(translated.body); // Spanish markdown

// With source language and frontmatter translation
const translated = await ai.getTranslation({
  to: 'fr',
  from: 'en',
  translateFrontMatter: true,
});
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `options` | `WritrTranslationOptions` | Yes | Translation settings including target locale. |

**Returns:** `Promise<Writr>`

### `applyMetadata(options?)`

Generates metadata and applies it directly to the document's frontmatter. Returns a result describing what was applied, overwritten, and skipped.

```typescript
// Apply all generated metadata to frontmatter
const result = await ai.applyMetadata();

// Apply only specific fields, overwriting existing values
const result = await ai.applyMetadata({
  generate: { title: true, description: true },
  overwrite: true,
});

// Map metadata keys to custom frontmatter field names
const result = await ai.applyMetadata({
  generate: { description: true },
  fieldMap: { description: 'meta_description' },
});
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `options` | `WritrApplyMetadataOptions` | No | Controls generation, overwrite behavior, and field mapping. |

**Returns:** `Promise<WritrApplyMetadataResult>`

## Types

### `WritrAIOptions`

Configuration for a WritrAI instance.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `model` | `LanguageModel` | Yes | The AI SDK model instance used for generation (e.g. `openai("gpt-4.1-mini")`). |
| `cache` | `boolean` | No | Enables the in-memory AI cache when `true`. |
| `prompts` | `WritrAIPrompts` | No | Optional prompt overrides for metadata, SEO, and translation. |

### `WritrAIPrompts`

Custom prompt templates used by WritrAI.

| Property | Type | Description |
|----------|------|-------------|
| `metadata` | `string` | Custom prompt for metadata generation. |
| `seo` | `string` | Custom prompt for SEO generation. |
| `translation` | `string` | Custom prompt for translation. |

### `WritrMetadata`

Metadata generated for a markdown document.

| Property | Type | Description |
|----------|------|-------------|
| `title` | `string` | The best-fit title for the document. |
| `tags` | `string[]` | Human-friendly labels for organizing the document. |
| `keywords` | `string[]` | Search-oriented terms related to the document. |
| `description` | `string` | A concise meta-style description. |
| `preview` | `string` | A short teaser or preview of the content. |
| `summary` | `string` | A slightly longer overview of the document. |
| `category` | `string` | A broad grouping such as "docs", "guide", or "blog". |
| `topic` | `string` | The primary subject the document is about. |
| `audience` | `string` | The intended audience for the document. |
| `difficulty` | `"beginner" \| "intermediate" \| "advanced"` | The estimated skill level required. |
| `readingTime` | `number` | Estimated reading time in minutes (deterministic). |
| `wordCount` | `number` | Total number of words in the document (deterministic). |

### `WritrGetMetadataOptions`

Controls which metadata fields should be generated. When provided, only fields set to `true` are included.

| Property | Type | Description |
|----------|------|-------------|
| `title` | `boolean` | Generate a title. |
| `tags` | `boolean` | Generate tags. |
| `keywords` | `boolean` | Generate keywords. |
| `description` | `boolean` | Generate a description. |
| `preview` | `boolean` | Generate a preview. |
| `summary` | `boolean` | Generate a summary. |
| `category` | `boolean` | Generate a category. |
| `topic` | `boolean` | Generate a topic. |
| `audience` | `boolean` | Generate an audience. |
| `difficulty` | `boolean` | Generate a difficulty level. |
| `readingTime` | `boolean` | Include a deterministic reading time estimate. |
| `wordCount` | `boolean` | Include a deterministic word count. |

### `WritrSEO`

Search and social metadata for a markdown document.

| Property | Type | Description |
|----------|------|-------------|
| `slug` | `string` | A URL-safe identifier for the document. |
| `canonical` | `string` | The preferred canonical URL. |
| `openGraph` | `object` | Open Graph metadata (`title`, `description`, `image`). |

### `WritrGetSEOOptions`

Controls which SEO fields should be generated. When provided, only fields set to `true` are included.

| Property | Type | Description |
|----------|------|-------------|
| `slug` | `boolean` | Generate a URL-safe slug. |
| `canonical` | `boolean` | Generate a canonical URL. |
| `openGraph` | `boolean` | Generate Open Graph metadata. |

### `WritrTranslationOptions`

Options for generating a translated document.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `to` | `string` | Yes | The target language or locale. |
| `from` | `string` | No | The source language or locale when known. |
| `translateFrontMatter` | `boolean` | No | When `true`, frontmatter string values are also translated. |

### `WritrApplyMetadataOptions`

Options for applying generated metadata to frontmatter.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `overwrite` | `boolean \| WritrMetadataKey[]` | No | `true` overwrites all fields. An array overwrites only the specified fields. Default fills only missing fields. |
| `fieldMap` | `Partial<Record<WritrMetadataKey, string>>` | No | Maps metadata keys to custom frontmatter field names. |
| `generate` | `WritrGetMetadataOptions` | No | Controls which metadata fields to generate before applying. |

### `WritrApplyMetadataResult`

Result returned after metadata has been applied to frontmatter.

| Property | Type | Description |
|----------|------|-------------|
| `writr` | `Writr` | The Writr instance after metadata application. |
| `generated` | `WritrMetadata` | The full metadata object that was generated. |
| `applied` | `WritrMetadataKey[]` | Fields that were newly written because they were missing. |
| `overwritten` | `WritrMetadataKey[]` | Fields that replaced existing frontmatter values. |
| `skipped` | `WritrMetadataKey[]` | Fields that were not written because they already existed. |

## Caching

When `cache: true` is set in the constructor options, WritrAI caches results in memory keyed by the operation type, options, and document content. Repeated calls with the same content and options return cached results without making additional AI requests.

```typescript
const ai = new WritrAI(writr, {
  model: openai('gpt-4.1-mini'),
  cache: true,
});

// First call hits the AI model
const metadata1 = await ai.getMetadata({ title: true });

// Second call returns cached result
const metadata2 = await ai.getMetadata({ title: true });
```

## Custom Prompts

Override the default prompts used for each operation:

```typescript
const ai = new WritrAI(writr, {
  model: openai('gpt-4.1-mini'),
  prompts: {
    metadata: 'Generate concise metadata focusing on technical accuracy.',
    seo: 'Generate SEO metadata optimized for developer documentation.',
    translation: 'Translate the document while preserving all code examples.',
  },
});
```

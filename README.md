![Writr](site/logo.svg)

# Markdown Rendering Simplified
[![tests](https://github.com/jaredwray/writr/actions/workflows/tests.yml/badge.svg)](https://github.com/jaredwray/writr/actions/workflows/tests.yml)
[![ai-integration-tests](https://github.com/jaredwray/writr/actions/workflows/ai-integration-tests.yml/badge.svg)](https://github.com/jaredwray/writr/actions/workflows/ai-integration-tests.yml)
[![GitHub license](https://img.shields.io/github/license/jaredwray/writr)](https://github.com/jaredwray/writr/blob/master/LICENSE)
[![codecov](https://codecov.io/gh/jaredwray/writr/branch/master/graph/badge.svg?token=1YdMesM07X)](https://codecov.io/gh/jaredwray/writr)
[![npm](https://img.shields.io/npm/dm/writr)](https://npmjs.com/package/writr)
[![npm](https://img.shields.io/npm/v/writr)](https://npmjs.com/package/writr)

# Features
* Removes the remark / unified complexity and easy to use.
* Powered by the [unified processor](https://github.com/unifiedjs/unified) for an extensible plugin pipeline.
* Built in caching 💥 making it render very fast when there isn't a change
* Frontmatter support built in by default. :tada:
* Easily Render to `React` or `HTML`.
* Generates a Table of Contents for your markdown files (remark-toc).
* Slug generation for your markdown files (rehype-slug).
* Code Highlighting (rehype-highlight).
* Math Support (rehype-katex).
* Markdown to HTML (rehype-stringify).
* Github Flavor Markdown (remark-gfm).
* Emoji Support (remark-emoji).
* MDX Support (remark-mdx).
* Built in Hooks for adding code to render pipeline.
* AI-powered metadata generation, SEO, and translation via the [Vercel AI SDK](https://sdk.vercel.ai).

# Table of Contents
- [Getting Started](#getting-started)
- [API](#api)
  - [`new Writr(arg?: string | WritrOptions, options?: WritrOptions)`](#new-writrarg-string--writroptions-options-writroptions)
  - [`.ai`](#writrai)
  - [`.content`](#content)
  - [`.body`](#body)
  - [`.options`](#options)
  - [`.frontmatter`](#frontmatter)
  - [`.frontMatterRaw`](#frontmatterraw)
  - [`.cache`](#cache)
  - [`.engine`](#engine)
  - [`.render(options?: RenderOptions)`](#renderoptions-renderoptions)
  - [`.renderSync(options?: RenderOptions)`](#rendersyncoptions-renderoptions)
  - [`.renderToFile(filePath: string, options?)`](#rendertofilefilepath-string-options-renderoptions)
  - [`.renderToFileSync(filePath: string, options?)`](#rendertofilesyncfilepath-string-options-renderoptions)
  - [`.renderReact(options?: RenderOptions, reactOptions?: HTMLReactParserOptions)`](#renderreactoptions-renderoptions-reactoptions-htmlreactparseroptions)
  - [`.renderReactSync( options?: RenderOptions, reactOptions?: HTMLReactParserOptions)`](#renderreactsync-options-renderoptions-reactoptions-htmlreactparseroptions)
  - [`.validate(content?: string, options?: RenderOptions)`](#validatecontent-string-options-renderoptions)
  - [`.validateSync(content?: string, options?: RenderOptions)`](#validatesynccontent-string-options-renderoptions)
  - [`.loadFromFile(filePath: string)`](#loadfromfilefilepath-string)
  - [`.loadFromFileSync(filePath: string)`](#loadfromfilesyncfilepath-string)
  - [`.saveToFile(filePath: string)`](#savetofilefilepath-string)
  - [`.saveToFileSync(filePath: string)`](#savetofilesyncfilepath-string)
- [Caching On Render](#caching-on-render)
- [GitHub Flavored Markdown (GFM)](#github-flavored-markdown-gfm)
  - [GFM Features](#gfm-features)
  - [Using GFM](#using-gfm)
  - [Disabling GFM](#disabling-gfm)
- [Hooks](#hooks)
- [Emitters](#emitters)
  - [Error Events](#error-events)
  - [Listening to Error Events](#listening-to-error-events)
  - [Methods that Emit Errors](#methods-that-emit-errors)
  - [Error Event Examples](#error-event-examples)
  - [Event Emitter Methods](#event-emitter-methods)
- [AI](#ai)
  - [AI Options](#ai-options)
  - [AI Provider Configuration](#ai-provider-configuration)
  - [Metadata](#metadata)
    - [Generating Metadata](#generating-metadata)
    - [Applying Metadata to Frontmatter](#applying-metadata-to-frontmatter)
    - [Overwrite](#overwrite)
    - [Field Mapping](#field-mapping)
  - [SEO](#seo)
  - [Translation](#translation)
  - [Using WritrAI Directly](#using-writrai-directly)
- [Migrating to v6](#migrating-to-v6)
- [Unified Processor Engine](#unified-processor-engine)
- [Benchmarks](#benchmarks)
- [ESM and Node Version Support](#esm-and-node-version-support)
- [Code of Conduct and Contributing](#code-of-conduct-and-contributing)
- [License](#license)

# Getting Started 

```bash
> npm install writr
```

Then you can use it like this:

```javascript
import { Writr } from 'writr';

const writr = new Writr(`# Hello World ::-):\n\n This is a test.`);

const html = await writr.render(); // <h1>Hello World 🙂</h1><p>This is a test.</p>
```
Its just that simple. Want to add some options? No problem.

```javascript
import { Writr } from 'writr';
const writr = new Writr(`# Hello World ::-):\n\n This is a test.`);
const options  = {
	emoji: false
}
const html = await writr.render(options); // <h1>Hello World ::-):</h1><p>This is a test.</p>
```

An example passing in the options also via the constructor:

```javascript
import { Writr, WritrOptions } from 'writr';
const writrOptions = {
  renderOptions: {
    emoji: true,
    toc: true,
    slug: true,
    highlight: true,
    gfm: true,
    math: true,
    mdx: true,
    caching: true,
  }
};
const writr = new Writr(`# Hello World ::-):\n\n This is a test.`, writrOptions);
const html = await writr.render(options); // <h1>Hello World ::-):</h1><p>This is a test.</p>
```

# API

## `new Writr(arg?: string | WritrOptions, options?: WritrOptions)` 

By default the constructor takes in a markdown `string` or `WritrOptions` in the first parameter. You can also send in nothing and set the markdown via `.content` property. If you want to pass in your markdown and options you can easily do this with `new Writr('## Your Markdown Here', { ...options here})`. You can access the `WritrOptions` from the instance of Writr. Here is an example of WritrOptions.

```javascript
import { Writr, WritrOptions } from 'writr';
const writrOptions = {
  renderOptions: {
    emoji: true,
    toc: true,
    slug: true,
    highlight: true,
    gfm: true,
    math: true,
    mdx: true,
    caching: true,
  }
};
const writr = new Writr(writrOptions);
```

## `.content`

Setting the markdown content for the instance of Writr. This can be set via the constructor or directly on the instance and can even handle `frontmatter`.

```javascript

import { Writr } from 'writr';
const writr = new Writr();
writr.content = `---
title: Hello World
---
# Hello World ::-):\n\n This is a test.`;
```

## `.body`

gets the body of the markdown content. This is the content without the frontmatter.

```javascript
import { Writr } from 'writr';
const writr = new Writr();
writr.content = `---
title: Hello World
---
# Hello World ::-):\n\n This is a test.`;
console.log(writr.body); // '# Hello World ::-):\n\n This is a test.'
```

## `.options`

Accessing the default options for this instance of Writr. Here is the default settings for `WritrOptions`. These are the default settings for the `WritrOptions`:

```javascript
{
  renderOptions: {
    emoji: true,
    toc: true,
    slug: true,
    highlight: true,
    gfm: true,
    math: true,
    mdx: false,
    caching: true,
  }
}
```

## `.frontmatter`

Accessing the frontmatter for this instance of Writr. This is a `Record<string, any>` and can be set via the `.content` property.

```javascript
import { Writr } from 'writr';
const writr = new Writr();
writr.content = `---
title: Hello World
---
# Hello World ::-):\n\n This is a test.`;
console.log(writr.frontmatter); // { title: 'Hello World' }
```

you can also set the front matter directly like this:

```javascript
import { Writr } from 'writr';
const writr = new Writr();
writr.frontmatter = { title: 'Hello World' };
```

## `.frontMatterRaw`

Accessing the raw frontmatter for this instance of Writr. This is a `string` and can be set via the `.content` property.

```javascript
import { Writr } from 'writr';
const writr = new Writr();
writr.content = `---
title: Hello World
---
# Hello World ::-):\n\n This is a test.`;
console.log(writr.frontMatterRaw); // '---\ntitle: Hello World\n---'
```

## `.cache`

Accessing the cache for this instance of Writr. By default this is an in memory cache and is disabled (set to false) by default. You can enable this by setting `caching: true` in the `RenderOptions` of the `WritrOptions` or when calling render passing the `RenderOptions` like here:

```javascript
import { Writr } from 'writr';
const writr = new Writr(`# Hello World ::-):\n\n This is a test.`);
const options  = {
  caching: true
}
const html = await writr.render(options); // <h1>Hello World ::-):</h1><p>This is a test.</p>
```


## `.engine`

Accessing the underlying engine for this instance of Writr. This is a `Processor<Root, Root, Root, undefined, undefined>` from the core [`unified`](https://github.com/unifiedjs/unified) project and uses the familiar `.use()` plugin pattern. You can chain additional unified plugins on this processor to customize the render pipeline. Learn more about the unified engine at [unifiedjs.com](https://unifiedjs.com/) and check out the [getting started guide](https://unifiedjs.com/learn/guide/using-unified/) for examples.


## `.render(options?: RenderOptions)`

Rendering markdown to HTML. the options are based on RenderOptions. Which you can access from the Writr instance.

```javascript
import { Writr } from 'writr';
const writr = new Writr(`# Hello World ::-):\n\n This is a test.`);
const html = await writr.render(); // <h1>Hello World 🙂</h1><p>This is a test.</p>

//passing in with render options
const options  = {
  emoji: false
}

const html = await writr.render(options); // <h1>Hello World ::-):</h1><p>This is a test.</p>
```

## `.renderSync(options?: RenderOptions)`

Rendering markdown to HTML synchronously. the options are based on RenderOptions. Which you can access from the Writr instance. The parameters are the same as the `.render()` function.

```javascript
import { Writr } from 'writr';
const writr = new Writr(`# Hello World ::-):\n\n This is a test.`);
const html = writr.renderSync(); // <h1>Hello World 🙂</h1><p>This is a test.</p>
```

## `.renderToFile(filePath: string, options?: RenderOptions)`

Rendering markdown to a file. The options are based on RenderOptions.

```javascript
import { Writr } from 'writr';
const writr = new Writr(`# Hello World ::-):\n\n This is a test.`);
await writr.renderToFile('path/to/file.html');
```

## `.renderToFileSync(filePath: string, options?: RenderOptions)`

Rendering markdown to a file synchronously. The options are based on RenderOptions.

```javascript
import { Writr } from 'writr';
const writr = new Writr(`# Hello World ::-):\n\n This is a test.`);
writr.renderToFileSync('path/to/file.html');
```

## `.renderReact(options?: RenderOptions, reactOptions?: HTMLReactParserOptions)`

Rendering markdown to React. The options are based on RenderOptions and now HTMLReactParserOptions from `html-react-parser`.

```javascript
import { Writr } from 'writr';
const writr = new Writr(`# Hello World ::-):\n\n This is a test.`);
const reactElement = await writr.renderReact(); // Will return a React.JSX.Element
```

## `.renderReactSync( options?: RenderOptions, reactOptions?: HTMLReactParserOptions)`

Rendering markdown to React. The options are based on RenderOptions and now HTMLReactParserOptions from `html-react-parser`.

```javascript
import { Writr } from 'writr';
const writr = new Writr(`# Hello World ::-):\n\n This is a test.`);
const reactElement = writr.renderReactSync(); // Will return a React.JSX.Element
```

## `.validate(content?: string, options?: RenderOptions)`

Validate markdown content by attempting to render it. Returns a `WritrValidateResult` object with a `valid` boolean and optional `error` property. Note that this will disable caching on render to ensure accurate validation.

```javascript
import { Writr } from 'writr';
const writr = new Writr(`# Hello World\n\nThis is a test.`);

// Validate current content
const result = await writr.validate();
console.log(result.valid); // true

// Validate external content without changing the instance
const externalResult = await writr.validate('## Different Content');
console.log(externalResult.valid); // true
console.log(writr.content); // Still "# Hello World\n\nThis is a test."

// Handle validation errors
const invalidWritr = new Writr('Put invalid markdown here');
const errorResult = await invalidWritr.validate();
console.log(errorResult.valid); // false
console.log(errorResult.error?.message); // "Invalid plugin"
```

## `.validateSync(content?: string, options?: RenderOptions)`

Synchronously validate markdown content by attempting to render it. Returns a `WritrValidateResult` object with a `valid` boolean and optional `error` property.

This is the synchronous version of `.validate()` with the same parameters and behavior.

```javascript
import { Writr } from 'writr';
const writr = new Writr(`# Hello World\n\nThis is a test.`);

// Validate current content synchronously
const result = writr.validateSync();
console.log(result.valid); // true

// Validate external content without changing the instance
const externalResult = writr.validateSync('## Different Content');
console.log(externalResult.valid); // true
console.log(writr.content); // Still "# Hello World\n\nThis is a test."
```

## `.loadFromFile(filePath: string)`

Load your markdown content from a file path.

```javascript
import { Writr } from 'writr';
const writr = new Writr();
await writr.loadFromFile('path/to/file.md');
```

## `.loadFromFileSync(filePath: string)`

Load your markdown content from a file path synchronously.

```javascript
import { Writr } from 'writr';
const writr = new Writr();
writr.loadFromFileSync('path/to/file.md');
```

## `.saveToFile(filePath: string)`

Save your markdown and frontmatter (if included) content to a file path.

```javascript
import { Writr } from 'writr';
const writr = new Writr(`# Hello World ::-):\n\n This is a test.`);
await writr.saveToFile('path/to/file.md');
```

## `.saveToFileSync(filePath: string)`

Save your markdown and frontmatter (if included) content to a file path synchronously.

```javascript
import { Writr } from 'writr';
const writr = new Writr(`# Hello World ::-):\n\n This is a test.`);
writr.saveToFileSync('path/to/file.md');
```

# Caching On Render

Caching is built into Writr and is an in-memory cache using `CacheableMemory` from [Cacheable](https://cacheable.org). It is turned off by default and can be enabled by setting `caching: true` in the `RenderOptions` of the `WritrOptions` or when calling render passing the `RenderOptions` like here:

```javascript
import { Writr } from 'writr';
const writr = new Writr(`# Hello World ::-):\n\n This is a test.`, { renderOptions: { caching: true } });
```

or via `RenderOptions` such as:

```javascript
import { Writr } from 'writr';
const writr = new Writr(`# Hello World ::-):\n\n This is a test.`);
await writr.render({ caching: true});
```

If you want to set the caching options for the instance of Writr you can do so like this:

```javascript
// we will set the lruSize of the cache and the default ttl
import {Writr} from 'writr';
const writr = new Writr(`# Hello World ::-):\n\n This is a test.`, { renderOptions: { caching: true } });
writr.cache.store.lruSize = 100;
writr.cache.store.ttl = '5m'; // setting it to 5 minutes
```

# GitHub Flavored Markdown (GFM)

Writr includes full support for [GitHub Flavored Markdown](https://github.github.com/gfm/) (GFM) through the `remark-gfm` and `remark-github-blockquote-alert` plugins. GFM is enabled by default and adds several powerful features to standard Markdown.

## GFM Features

When GFM is enabled (which it is by default), you get access to the following features:

### Tables

Create tables using pipes and hyphens:

```markdown
| Feature | Supported |
|---------|-----------|
| Tables  | Yes       |
| Alerts  | Yes       |
```

### Strikethrough

Use `~~` to create strikethrough text:

```markdown
~~This text is crossed out~~
```

### Task Lists

Create interactive checkboxes:

```markdown
- [x] Completed task
- [ ] Incomplete task
- [ ] Another task
```

### Autolinks

URLs are automatically converted to clickable links:

```markdown
https://github.com
```

### GitHub Blockquote Alerts

GitHub-style alerts are supported to emphasize critical information. These are blockquote-based admonitions that render with special styling:

```markdown
> [!NOTE]
> Useful information that users should know, even when skimming content.

> [!TIP]
> Helpful advice for doing things better or more easily.

> [!IMPORTANT]
> Key information users need to know to achieve their goal.

> [!WARNING]
> Urgent info that needs immediate user attention to avoid problems.

> [!CAUTION]
> Advises about risks or negative outcomes of certain actions.
```

## Using GFM

GFM is enabled by default. Here's an example:

```javascript
import { Writr } from 'writr';

const markdown = `
# Task List Example

- [x] Learn Writr basics
- [ ] Master GFM features

> [!NOTE]
> GitHub Flavored Markdown is enabled by default!

| Feature | Status |
|---------|--------|
| GFM     | ✓      |
`;

const writr = new Writr(markdown);
const html = await writr.render(); // Renders with full GFM support
```

## Disabling GFM

If you need to disable GFM features, you can set `gfm: false` in the render options:

```javascript
import { Writr } from 'writr';

const writr = new Writr('~~strikethrough~~ text');

// Disable GFM
const html = await writr.render({ gfm: false });
// Output: <p>~~strikethrough~~ text</p>

// With GFM enabled (default)
const htmlWithGfm = await writr.render({ gfm: true });
// Output: <p><del>strikethrough</del> text</p>
```

Note: When GFM is disabled, GitHub blockquote alerts will not be processed and will render as regular blockquotes.

# Hooks

Hooks are a way to add additional parsing to the render pipeline. You can add hooks to the the Writr instance. Here is an example of adding a hook to the instance of Writr:

```javascript
import { Writr, WritrHooks } from 'writr';
const writr = new Writr(`# Hello World ::-):\n\n This is a test.`);
writr.onHook(WritrHooks.beforeRender, data => {
  data.body = 'Hello, Universe!';
});
const result = await writr.render();
console.log(result); // Hello, Universe!
```

For `beforeRender` the data object is a `renderData` object. Here is the interface for `renderData`:

```typescript
export type renderData = {
  body: string
  options: RenderOptions;
}
```

For `afterRender` the data object is a `resultData` object. Here is the interface for `resultData`:

```typescript
export type resultData = {
  result: string;
}
```

For `saveToFile` the data object is an object with the `filePath` and `content`. Here is the interface for `saveToFileData`:

```typescript
export type saveToFileData = {
  filePath: string;
  content: string;
}
```

This is called when you call `saveToFile`, `saveToFileSync`.

For `renderToFile` the data object is an object with the `filePath` and `content`. Here is the interface for `renderToFileData`:

```typescript
export type renderToFileData = {
  filePath: string;
  content: string;
}
```

This is called when you call `renderToFile`, `renderToFileSync`.

For `loadFromFile` the data object is an object with `content` so you can change before it is set on `writr.content`. Here is the interface for `loadFromFileData`:

```typescript
export type loadFromFileData = {
  content: string;
}
```

This is called when you call `loadFromFile`, `loadFromFileSync`.

# Emitters

Writr extends the [Hookified](https://github.com/jaredwray/hookified) class, which provides event emitter capabilities. This means you can listen to events emitted by Writr during its lifecycle, particularly error events.

## Error Events

Writr emits an `error` event whenever an error occurs in any of its methods. This provides a centralized way to handle errors without wrapping every method call in a try/catch block.

### Listening to Error Events

You can listen to error events using the `.on()` method:

```javascript
import { Writr } from 'writr';

const writr = new Writr('# Hello World');

// Listen for any errors
writr.on('error', (error) => {
  console.error('An error occurred:', error.message);
  // Handle the error appropriately
  // Log to error tracking service, display to user, etc.
});

// With a listener registered, errors are emitted to the listener
// and the method returns its fallback value (e.g. "" for render)
const html = await writr.render();
```

### Methods that Emit Errors

All methods use an emit-only error pattern — they call `this.emit('error', error)` but never explicitly re-throw. If no error listener is registered and `throwOnEmptyListeners` is `true` (the default), the `emit('error')` call itself will throw, following standard Node.js EventEmitter behavior.

**Rendering Methods** — emit error, return `""`:
- `render()` - Emits error when markdown rendering fails, returns empty string
- `renderSync()` - Emits error when markdown rendering fails, returns empty string
- `renderReact()` - Emits error when React rendering fails, returns empty string
- `renderReactSync()` - Emits error when React rendering fails, returns empty string

**Validation Methods:**
- `validate()` - Does **not** emit errors. Returns `{ valid: false, error }` on failure
- `validateSync()` - Emits error and returns `{ valid: false, error }` on failure

**File Operations** — emit error, return void:
- `renderToFile()` - Emits error when rendering or file writing fails
- `renderToFileSync()` - Emits error when rendering or file writing fails
- `loadFromFile()` - Emits error when file reading fails
- `loadFromFileSync()` - Emits error when file reading fails
- `saveToFile()` - Emits error when file writing fails
- `saveToFileSync()` - Emits error when file writing fails

**Front Matter Operations** — emit error, return fallback:
- `frontMatter` getter - Emits error when YAML parsing fails, returns `{}`
- `frontMatter` setter - Emits error when YAML serialization fails

### Error Event Examples

**Example 1: Global Error Handler**

```javascript
import { Writr } from 'writr';

const writr = new Writr();

// Set up a global error handler
writr.on('error', (error) => {
  // Log to your monitoring service
  console.error('Writr error:', error);

  // Send to error tracking (e.g., Sentry, Rollbar)
  // errorTracker.captureException(error);
});

// All errors will be emitted to the listener above
await writr.loadFromFile('./content.md');
const html = await writr.render();
```

**Example 2: Validation with Error Listening**

```javascript
import { Writr } from 'writr';

const writr = new Writr('# My Content');
let lastError = null;

writr.on('error', (error) => {
  lastError = error;
});

const result = await writr.validate();

if (!result.valid) {
  console.log('Validation failed');
  console.log('Error details:', lastError);
  // result.error is also available
}
```

**Example 3: File Operations Without Try/Catch**

```javascript
import { Writr } from 'writr';

const writr = new Writr('# Content');

writr.on('error', (error) => {
  console.error('File operation failed:', error.message);
  // Handle gracefully - maybe use default content
});

// With a listener registered, errors are emitted and the method returns normally
await writr.loadFromFile('./maybe-missing.md');
// Note: without a listener, this will throw by default (throwOnEmptyListeners is true)
```

### Event Emitter Methods

Since Writr extends Hookified, you have access to standard event emitter methods:

- `writr.on(event, handler)` - Add an event listener
- `writr.once(event, handler)` - Add a one-time event listener
- `writr.off(event, handler)` - Remove an event listener
- `writr.emit(event, data)` - Emit an event (used internally)

For more information about event handling capabilities, see the [Hookified documentation](https://github.com/jaredwray/hookified).

# AI

Writr includes built-in AI capabilities for metadata generation, SEO, and translation powered by the [Vercel AI SDK](https://sdk.vercel.ai). Plug in any supported model provider (OpenAI, Anthropic, Google, etc.) via the `ai` option.

```typescript
import { Writr } from 'writr';
import { openai } from '@ai-sdk/openai';

const writr = new Writr('# My Document\n\nSome markdown content here.', {
  ai: { model: openai('gpt-4.1-mini') },
});

// Generate metadata
const metadata = await writr.ai.getMetadata();

// Generate only specific fields
const metadata = await writr.ai.getMetadata({ title: true, description: true });

// Generate SEO metadata
const seo = await writr.ai.getSEO();

// Translate to Spanish
const translated = await writr.ai.getTranslation({ to: 'es' });

// Apply generated metadata to frontmatter
const result = await writr.ai.applyMetadata({
  generate: { description: true, category: true },
  overwrite: true,
});
```

## AI Options

Pass `ai` in the `WritrOptions` to enable AI features:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `model` | `LanguageModel` | Yes | The AI SDK model instance (e.g. `openai("gpt-4.1-mini")`). |
| `cache` | `boolean` | No | Enables in-memory caching of AI results. |
| `prompts` | `WritrAIPrompts` | No | Custom prompt overrides for metadata, SEO, and translation. |

```typescript
const writr = new Writr('# My Document', {
  ai: {
    model: openai('gpt-4.1-mini'),
    cache: true,
  },
});
```

## AI Provider Configuration

By default, the provider imports read API keys from environment variables:

| Provider | Import | Environment Variable |
|----------|--------|---------------------|
| OpenAI | `openai` from `@ai-sdk/openai` | `OPENAI_API_KEY` |
| Anthropic | `anthropic` from `@ai-sdk/anthropic` | `ANTHROPIC_API_KEY` |
| Google | `google` from `@ai-sdk/google` | `GOOGLE_GENERATIVE_AI_API_KEY` |

```typescript
// Uses OPENAI_API_KEY from environment
import { openai } from '@ai-sdk/openai';

const writr = new Writr('# Hello', { ai: { model: openai('gpt-4.1-mini') } });
```

To set API keys programmatically, use the provider factory functions instead:

```typescript
import { Writr } from 'writr';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

// OpenAI
const openai = createOpenAI({ apiKey: 'your-openai-key' });
const writr = new Writr('# Hello', { ai: { model: openai('gpt-4.1-mini') } });

// Anthropic
const anthropic = createAnthropic({ apiKey: 'your-anthropic-key' });
const writr = new Writr('# Hello', { ai: { model: anthropic('claude-sonnet-4-20250514') } });

// Google
const google = createGoogleGenerativeAI({ apiKey: 'your-google-key' });
const writr = new Writr('# Hello', { ai: { model: google('gemini-2.0-flash') } });
```

## Metadata

Generate metadata from your document content using `writr.ai.getMetadata()`, or generate and apply it directly to frontmatter with `writr.ai.applyMetadata()`.

### Generating Metadata

`getMetadata()` analyzes the document and returns a `WritrMetadata` object. By default all fields are generated. Pass options to select specific fields.

```typescript
// Generate all metadata fields
const metadata = await writr.ai.getMetadata();
console.log(metadata.title);       // "Getting Started with Writr"
console.log(metadata.tags);        // ["markdown", "rendering", "typescript"]
console.log(metadata.description); // "A guide to using Writr for markdown processing."
console.log(metadata.readingTime); // 3 (minutes)
console.log(metadata.wordCount);   // 450

// Generate only specific fields
const partial = await writr.ai.getMetadata({
  title: true,
  description: true,
  tags: true,
});
```

**Generated fields:**

| Field | Type | Description |
|-------|------|-------------|
| `title` | `string` | The best-fit title for the document. |
| `description` | `string` | A concise meta-style description of the document. |
| `tags` | `string[]` | Human-friendly labels for organizing the document. |
| `keywords` | `string[]` | Search-oriented terms related to the document content. |
| `preview` | `string` | A short teaser or preview snippet of the content. |
| `summary` | `string` | A slightly longer overview of the document. |
| `category` | `string` | A broad grouping such as "docs", "guide", or "blog". |
| `topic` | `string` | The primary subject the document is about. |
| `audience` | `string` | The intended audience for the document. |
| `difficulty` | `"beginner" \| "intermediate" \| "advanced"` | The estimated skill level required. |
| `readingTime` | `number` | Estimated reading time in minutes (computed, not AI-generated). |
| `wordCount` | `number` | Total word count of the document (computed, not AI-generated). |

### Applying Metadata to Frontmatter

`applyMetadata()` generates metadata and writes it into the document's frontmatter. The result tells you exactly what happened:

- **`applied`** — fields that were newly written because they were missing from frontmatter.
- **`skipped`** — fields that already existed and were not overwritten.
- **`overwritten`** — fields that replaced existing frontmatter values.

```typescript
const result = await writr.ai.applyMetadata();
console.log(result.applied);     // ["description", "tags", "category"]
console.log(result.skipped);     // ["title"] (already existed)
console.log(result.overwritten); // []
```

### Overwrite

By default, `applyMetadata()` only fills in missing fields — existing frontmatter values are never touched. The `overwrite` option changes this behavior:

- **Default (no overwrite):** Only missing fields are written. Existing values are preserved.
- **`overwrite: true`:** All generated fields replace existing frontmatter values.
- **`overwrite: ['field1', 'field2']`:** Only the listed fields are overwritten. Other existing values are preserved.

```typescript
// Overwrite all generated fields, even if they already exist
const result = await writr.ai.applyMetadata({
  generate: { title: true, description: true },
  overwrite: true,
});

// Only overwrite title, leave description alone if it already exists
const result = await writr.ai.applyMetadata({
  generate: { title: true, description: true, category: true },
  overwrite: ['title'],
});
```

### Field Mapping

The `fieldMap` option maps generated metadata keys to different frontmatter field names. This is useful when your frontmatter schema uses different naming conventions than the default metadata keys.

```typescript
const result = await writr.ai.applyMetadata({
  generate: { description: true, tags: true },
  fieldMap: {
    description: 'meta_description',
    tags: 'labels',
  },
});
// writr.frontMatter.meta_description === "A guide to..."
// writr.frontMatter.labels === ["markdown", "rendering"]
```

The mapping applies to all behaviors — field existence checks, overwrites, and skips all use the mapped key when checking frontmatter.

## SEO

Generate SEO metadata using `writr.ai.getSEO()`. By default all fields are generated. Pass options to select specific fields.

```typescript
const seo = await writr.ai.getSEO();
console.log(seo.slug);              // "getting-started-with-writr"
console.log(seo.canonical);         // "https://example.com/getting-started-with-writr"
console.log(seo.openGraph?.title);  // "Getting Started with Writr"

// Generate only a slug
const seo = await writr.ai.getSEO({ slug: true });
```

**Available fields:** `slug`, `canonical`, `openGraph` (includes `title`, `description`, `image`).

## Translation

Translate the document into another language using `writr.ai.getTranslation()`. Returns a new `Writr` instance with the translated content.

```typescript
const spanish = await writr.ai.getTranslation({ to: 'es' });
console.log(spanish.body); // Spanish markdown

// With source language and frontmatter translation
const french = await writr.ai.getTranslation({
  to: 'fr',
  from: 'en',
  translateFrontMatter: true,
});
```

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `to` | `string` | Yes | Target language or locale. |
| `from` | `string` | No | Source language or locale. |
| `translateFrontMatter` | `boolean` | No | Also translate frontmatter string values. |

## Using WritrAI Directly

`WritrAI` is exported as a named export and can be instantiated independently from the `Writr` constructor. This is useful when you want to configure the AI instance separately or swap models on the fly.

```typescript
import { Writr, WritrAI } from 'writr';
import { openai } from '@ai-sdk/openai';

const writr = new Writr('# My Document\n\nSome markdown content here.');
const ai = new WritrAI(writr, {
  model: openai('gpt-4.1-mini'),
  cache: true,
});

// Generate metadata
const metadata = await ai.getMetadata();
console.log(metadata.title);
console.log(metadata.tags);

// Generate SEO data
const seo = await ai.getSEO();
console.log(seo.slug);

// Translate
const translated = await ai.getTranslation({ to: 'es' });
console.log(translated.body);

// Apply metadata to frontmatter
const result = await ai.applyMetadata({
  generate: { title: true, description: true, tags: true },
  overwrite: true,
});
```

# Migrating to v6

Writr v6 upgrades [hookified](https://github.com/jaredwray/hookified) from v1 to v2 and removes `throwErrors` in favor of hookified's built-in error handling options.

## Breaking Changes

### `throwErrors` removed

The `throwErrors` option has been removed from `WritrOptions`. Use `throwOnEmitError` instead, which is provided by hookified's `HookifiedOptions` (now spread into `WritrOptions`).

**Before (v5):**

```typescript
const writr = new Writr('# Hello', { throwErrors: true });
```

**After (v6):**

```typescript
const writr = new Writr('# Hello', { throwOnEmitError: true });
```

### Error handling redesign

All methods now use an **emit-only** pattern — errors are emitted via `emit('error', error)` but never explicitly re-thrown. Methods return fallback values on error (`""` for render methods, `{}` for frontMatter getter, `{ valid: false, error }` for validate).

**How errors propagate:**

- **With a listener registered:** Errors are passed to the listener. The method returns its fallback value without throwing.
- **Without a listener (default behavior):** Since `throwOnEmptyListeners` defaults to `true`, the `emit('error')` call itself throws, following standard Node.js EventEmitter behavior. This means unhandled errors will still surface as exceptions.
- **With `throwOnEmitError: true`:** Every `emit('error')` call throws, even when listeners are registered. This affects all methods that emit errors.

**Other changes:**

- `render()` and `renderSync()` no longer throw wrapped `"Failed to render markdown: ..."` errors. They emit the original error and return `""`.
- `validate()` (async) no longer emits errors — it only returns `{ valid: false, error }`. `validateSync()` still emits.

### hookified v2

Writr now uses hookified v2 which introduces several new options available through `WritrOptions`:

- `throwOnEmitError` — Throw when `emit("error")` is called, even with listeners (default: `false`)
- `throwOnHookError` — Throw when a hook handler throws (default: `false`)
- `throwOnEmptyListeners` — Throw when emitting `error` with no listeners (default: `true`)
- `eventLogger` — Logger instance for event logging

See the [hookified documentation](https://github.com/jaredwray/hookified) for full details.

# Unified Processor Engine

Writr builds on top of the open source [unified](https://github.com/unifiedjs/unified) processor – the core project that powers
[remark](https://github.com/remarkjs/remark), [rehype](https://github.com/rehypejs/rehype), and many other content tools. Unified
provides a pluggable pipeline where each plugin transforms a syntax tree. Writr configures a default set of plugins to turn
Markdown into HTML, but you can access the processor through the `.engine` property to add your own behavior with
`writr.engine.use(myPlugin)`. The [unified documentation](https://unifiedjs.com/) has more details and guides for building
plugins and working with the processor directly.

# Benchmarks

This is a comparison with minimal configuration where we have disabled all rendering pipeline and just did straight caching + rendering to compare it against the fastest:

|           name            |  summary  |  ops/sec  |  time/op  |  margin  |  samples  |
|---------------------------|:---------:|----------:|----------:|:--------:|----------:|
|  Writr (Sync) (Caching)   |    🥇     |      83K  |     14µs  |  ±0.27%  |      74K  |
|  Writr (Async) (Caching)  |    -3%    |      80K  |     14µs  |  ±0.27%  |      71K  |
|  markdown-it              |   -30%    |      58K  |     20µs  |  ±0.37%  |      50K  |
|  marked                   |   -33%    |      56K  |     25µs  |  ±0.50%  |      40K  |
|  Writr (Sync)             |   -94%    |       5K  |    225µs  |  ±0.88%  |      10K  |
|  Writr (Async)            |   -94%    |       5K  |    229µs  |  ±0.89%  |      10K  |

As you can see this module is performant with `caching` enabled but was built to be performant enough but with all the features added in. If you are just wanting performance and not features then `markdown-it` or `marked` is the solution unless you use `Writr` with caching. 

|           name            |  summary  |  ops/sec  |  time/op  |  margin  |  samples  |
|---------------------------|:---------:|----------:|----------:|:--------:|----------:|
|  Writr (Async) (Caching)  |    🥇     |      26K  |     39µs  |  ±0.12%  |      25K  |
|  Writr (Sync) (Caching)   |  -0.92%   |      26K  |     40µs  |  ±0.15%  |      25K  |
|  Writr (Sync)             |   -93%    |       2K  |    630µs  |  ±0.97%  |      10K  |
|  Writr (Async)            |   -93%    |       2K  |    649µs  |  ±0.96%  |      10K  |

The benchmark shows rendering performance via Sync and Async methods with caching enabled and disabled and all features.

# ESM and Node Version Support

This package is ESM only and tested on the current lts version and its previous. Please don't open issues for questions regarding CommonJS / ESM or previous Nodejs versions.

# Code of Conduct and Contributing
Please use our [Code of Conduct](CODE_OF_CONDUCT.md) and [Contributing](CONTRIBUTING.md) guidelines for development and testing. We appreciate your contributions!

# License

[MIT](LICENSE) & © [Jared Wray](https://jaredwray.com)

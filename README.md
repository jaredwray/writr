![Writr](site/logo.svg)

# Markdown Rendering Simplified
[![tests](https://github.com/jaredwray/writr/actions/workflows/tests.yml/badge.svg)](https://github.com/jaredwray/writr/actions/workflows/tests.yml)
[![GitHub license](https://img.shields.io/github/license/jaredwray/writr)](https://github.com/jaredwray/writr/blob/master/LICENSE)
[![codecov](https://codecov.io/gh/jaredwray/writr/branch/master/graph/badge.svg?token=1YdMesM07X)](https://codecov.io/gh/jaredwray/writr)
[![npm](https://img.shields.io/npm/dm/writr)](https://npmjs.com/package/writr)
[![npm](https://img.shields.io/npm/v/writr)](https://npmjs.com/package/writr)

# Table of Contents
- [Features](#features)
- [ESM and Node Version Support](#esm-and-node-version-support)
- [Getting Started](#getting-started)
- [API](#api)
  - [`new Writr(arg?: string | WritrOptions, options?: WritrOptions)`](#new-writrarg-string--writroptions-options-writroptions)
  - [`.content`](#content)
  - [`.body`](#body)
  - [`.options`](#options)
  - [`.frontmatter`](#frontmatter)
  - [`.frontMatterRaw`](#frontmatterraw)
  - [`.cache`](#cache)
  - [`.engine`](#engine)
  - [`.render(options?: RenderOptions): Promise<string>`](#renderoptions-renderoptions-promisestring)
  - [`.renderSync(options?: RenderOptions): string`](#rendersyncoptions-renderoptions-string)
  - [`.renderToFile(filePath: string, options?: RenderOptions)`](#rendertofilefilepath-string-options-renderoptions)
  - [`.renderToFileSync(filePath: string, options?: RenderOptions): void`](#rendertofilesyncfilepath-string-options-renderoptions-void)
  - [`.renderReact(options?: RenderOptions, reactOptions?: HTMLReactParserOptions): Promise<React.JSX.Element />`](#renderreactoptions-renderoptions-reactoptions-htmlreactparseroptions-promise-reactjsxelement-)
  - [`.renderReactSync( options?: RenderOptions, reactOptions?: HTMLReactParserOptions): React.JSX.Element`](#renderreactsync-options-renderoptions-reactoptions-htmlreactparseroptions-reactjsxelement)
  - [`.loadFromFile(filePath: string): Promise<void>`](#loadfromfilefilepath-string-promisevoid)
  - [`.loadFromFileSync(filePath: string): void`](#loadfromfilesyncfilepath-string-void)
  - [`.saveToFile(filePath: string): Promise<void>`](#savetofilefilepath-string-promisevoid)
  - [`.saveToFileSync(filePath: string): void`](#savetofilesyncfilepath-string-void)
- [Hooks](#hooks)
- [Code of Conduct and Contributing](#code-of-conduct-and-contributing)
- [License](#license)


# Features
* Removes the remark / unified complexity and easy to use.
* Built in caching 💥 making it render very fast when there isnt a change
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

# ESM and Node Version Support

This package is ESM only and tested on the current lts version and its previous. Please don't open issues for questions regarding CommonJS / ESM or previous Nodejs versions. To learn more about using ESM please read this from `sindresorhus`: https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c

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
  throwErrors: true,
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
  throwErrors: true,
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

Accessing the default options for this instance of Writr. Here is the default settings for `WritrOptions`.

```javascript
{
  throwErrors: false,
  renderOptions: {
    emoji: true,
    toc: false,
    slug: false,
    highlight: false,
    gfm: true,
    math: false,
    mdx: false,
    caching: false,
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

Accessing the underlying engine for this instance of Writr. This is a `Processor<Root, Root, Root, undefined, undefined>` fro the unified `.use()` function. You can use this to add additional plugins to the engine.

## `.render(options?: RenderOptions): Promise<string>`

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

## `.renderSync(options?: RenderOptions): string`

Rendering markdown to HTML synchronously. the options are based on RenderOptions. Which you can access from the Writr instance. The parameters are the same as the `.render()` function.

```javascript
import { Writr } from 'writr';
const writr = new Writr(`# Hello World ::-):\n\n This is a test.`);
const html = writr.renderSync(); // <h1>Hello World 🙂</h1><p>This is a test.</p>
```

## '.renderToFile(filePath: string, options?: RenderOptions)'

Rendering markdown to a file. The options are based on RenderOptions.

```javascript
import { Writr } from 'writr';
const writr = new Writr(`# Hello World ::-):\n\n This is a test.`);
await writr.renderToFile('path/to/file.html');
```

## '.renderToFileSync(filePath: string, options?: RenderOptions): void'

Rendering markdown to a file synchronously. The options are based on RenderOptions.

```javascript
import { Writr } from 'writr';
const writr = new Writr(`# Hello World ::-):\n\n This is a test.`);
writr.renderToFileSync('path/to/file.html');
```

## '.renderReact(options?: RenderOptions, reactOptions?: HTMLReactParserOptions): Promise<React.JSX.Element />'

Rendering markdown to React. The options are based on RenderOptions and now HTMLReactParserOptions from `html-react-parser`.

```javascript
import { Writr } from 'writr';
const writr = new Writr(`# Hello World ::-):\n\n This is a test.`);
const reactElement = await writr.renderReact(); // Will return a React.JSX.Element
```

## '.renderReactSync( options?: RenderOptions, reactOptions?: HTMLReactParserOptions): React.JSX.Element'

Rendering markdown to React. The options are based on RenderOptions and now HTMLReactParserOptions from `html-react-parser`.

```javascript
import { Writr } from 'writr';
const writr = new Writr(`# Hello World ::-):\n\n This is a test.`);
const reactElement = writr.renderReactSync(); // Will return a React.JSX.Element
```

## `.loadFromFile(filePath: string): Promise<void>`

Load your markdown content from a file path.

```javascript
import { Writr } from 'writr';
const writr = new Writr();
await writr.loadFromFile('path/to/file.md');
```

## `.loadFromFileSync(filePath: string): void`

Load your markdown content from a file path synchronously.

## `.saveToFile(filePath: string): Promise<void>`

Save your markdown and frontmatter (if included) content to a file path.

```javascript
import { Writr } from 'writr';
const writr = new Writr(`# Hello World ::-):\n\n This is a test.`);
await writr.saveToFile('path/to/file.md');
```

## `.saveToFileSync(filePath: string): void`

Save your markdown and frontmatter (if included) content to a file path synchronously.

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

# Code of Conduct and Contributing
[Code of Conduct](CODE_OF_CONDUCT.md) and [Contributing](CONTRIBUTING.md) guidelines.

# License

[MIT](LICENSE) & © [Jared Wray](https://jaredwray.com)

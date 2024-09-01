![Writr](site/logo.svg)

---

## Markdown Rendering Simplified
[![tests](https://github.com/jaredwray/writr/actions/workflows/tests.yml/badge.svg)](https://github.com/jaredwray/writr/actions/workflows/tests.yml)
[![GitHub license](https://img.shields.io/github/license/jaredwray/writr)](https://github.com/jaredwray/writr/blob/master/LICENSE)
[![codecov](https://codecov.io/gh/jaredwray/writr/branch/master/graph/badge.svg?token=1YdMesM07X)](https://codecov.io/gh/jaredwray/writr)
[![npm](https://img.shields.io/npm/dm/writr)](https://npmjs.com/package/writr)
[![npm](https://img.shields.io/npm/v/writr)](https://npmjs.com/package/writr)

---
## Table of Contents
- [Features](#features)
- [Getting Started](#getting-started)
- [License - MIT](#license)

## Features
* Removes the remark complexity and easy to use.
* It's fast with built in caching 💥
* Easily Render to `React` or `HTML`.
* Generates a Table of Contents for your markdown files (remark-toc).
* Slug generation for your markdown files (rehype-slug).
* Code Highlighting (rehype-highlight).
* Math Support (rehype-katex).
* Markdown to HTML (rehype-stringify).
* Github Flavor Markdown (remark-gfm).
* Emoji Support (remark-emoji).
* MDX Support (remark-mdx).
* ESM and Node 20+

## Getting Started 

## 1. Install Writr

```bash
> npm install writr
```

## 2. Render from Markdown

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

## API

### `new Writr(arg?: string | WritrOptions, options?: WritrOptions)` 

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

### `.content`

Setting the markdown content for the instance of Writr. This can be set via the constructor or directly on the instance and can even handle `frontmatter`.

```javascript

import { Writr } from 'writr';
const writr = new Writr();
writr.content = `---
title: Hello World
---
# Hello World ::-):\n\n This is a test.`;
```

### `.options`

Accessing the default options for this instance of Writr.

### `.cache`

Accessing the cache for this instance of Writr. By default this is an in memory cache and is enabled by default. You can disable this by setting `caching: false` in the `RenderOptions` of the `WritrOptions` or when calling render passing the `RenderOptions` like here:

```javascript
import { Writr } from 'writr';
const writr = new Writr(`# Hello World ::-):\n\n This is a test.`);
const options  = {
  caching: false
}
const html = await writr.render(options); // <h1>Hello World ::-):</h1><p>This is a test.</p>
```

If you would like to use a specific storage adapter from https://keyv.org you can pass in the adapter like so:

```javascript
import { Writr } from 'writr';
import Keyv from '@keyv/redis';
const keyvRedis = new Keyv('redis://user:pass@localhost:6379');
const writr = new Writr(`# Hello World ::-):\n\n This is a test.`);
writr.cache.setStorageAdapter(keyvRedis);
```

### `.engine`

Accessing the underlying engine for this instance of Writr. This is a `Processor<Root, Root, Root, undefined, undefined>` fro the unified `.use()` function. You can use this to add additional plugins to the engine.

### `.render(options?: RenderOptions): Promise<string>`

Rendering markdown to HTML. the options are based on RenderOptions. Which you can access from the Writr instance.

```javascript
import { Writr, RenderOptions } from 'writr';

## `RenderOptions`

```js
type RenderOptions = {
	emoji?: boolean; // Emoji support (default: true)
	toc?: boolean; // Table of contents generation (default: true)
	slug?: boolean; // Slug generation (default: true)
	highlight?: boolean; // Code highlighting (default: true)
	gfm?: boolean; // Github flavor markdown (default: true)
	math?: boolean; // Math support (default: true)
	mdx?: boolean; // MDX support (default: true)
	caching?: boolean; // Caching (default: true)
};
```

### `.renderSync(options?: RenderOptions): string`

Rendering markdown to HTML synchronously. the options are based on RenderOptions. Which you can access from the Writr instance. The parameters are the same as the `.render()` function.

```javascript
import { Writr } from 'writr';
const writr = new Writr(`# Hello World ::-):\n\n This is a test.`);
const html = writr.renderSync(); // <h1>Hello World 🙂</h1><p>This is a test.</p>
```

### '.renderReact(options?: RenderOptions, reactOptions?: HTMLReactParserOptions): Promise<React.JSX.Element />'

Rendering markdown to React. The options are based on RenderOptions and now HTMLReactParserOptions from `html-react-parser`.

```javascript
import { Writr } from 'writr';
const writr = new Writr(`# Hello World ::-):\n\n This is a test.`);
const reactElement = await writr.renderReact(); // Will return a React.JSX.Element
```

### '.renderReactSync( options?: RenderOptions, reactOptions?: HTMLReactParserOptions): React.JSX.Element'

Rendering markdown to React. The options are based on RenderOptions and now HTMLReactParserOptions from `html-react-parser`.

```javascript
import { Writr } from 'writr';
const writr = new Writr(`# Hello World ::-):\n\n This is a test.`);
const reactElement = writr.renderReactSync(); // Will return a React.JSX.Element
```

### `.loadFromFile(filePath: string): Promise<void>`

Load your markdown content from a file path.

```javascript
import { Writr } from 'writr';
const writr = new Writr();
await writr.loadFromFile('path/to/file.md');
```

### `.loadFromFileSync(filePath: string): void`

Load your markdown content from a file path synchronously.

### `.saveToFile(filePath: string): Promise<void>`

Save your markdown and frontmatter (if included) content to a file path.

```javascript
import { Writr } from 'writr';
const writr = new Writr(`# Hello World ::-):\n\n This is a test.`);
await writr.saveToFile('path/to/file.md');
```

### `.saveToFileSync(filePath: string): void`

Save your markdown and frontmatter (if included) content to a file path synchronously.

## Code of Conduct and Contributing
[Code of Conduct](CODE_OF_CONDUCT.md) and [Contributing](CONTRIBUTING.md) guidelines.

## License

MIT © [Jared Wray](https://jaredwray.com)

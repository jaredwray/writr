![Writr](site/logo.svg)

---

## Markdown Rendering Simplified
[![Build](https://github.com/jaredwray/writr/actions/workflows/tests.yml/badge.svg)](https://github.com/jaredwray/writr/actions/workflows/tests.yml)
[![GitHub license](https://img.shields.io/github/license/jaredwray/writr)](https://github.com/jaredwray/writr/blob/master/LICENSE)
[![codecov](https://codecov.io/gh/jaredwray/writr/branch/master/graph/badge.svg?token=1YdMesM07X)](https://codecov.io/gh/jaredwray/writr)
[![npm](https://img.shields.io/npm/dm/writr)](https://npmjs.com/package/writr)

---
## Table of Contents
- [Features](#features)
- [Getting Started](#getting-started)
- [License - MIT](#license)

## Features
* Takes the complexity of Remark and makes it easy to use.
* Up and Rendering in seconds with a simple API.
* Generates a Table of Contents for your markdown files (remark-toc).
* Slug generation for your markdown files (rehype-slug).
* Code Highlighting (rehype-highlight).
* Math Support (rehype-katex).
* Markdown to HTML (rehype-stringify).
* Github Flavor Markdown (remark-gfm).
* Emoji Support (remark-emoji).

## Getting Started 

## 1. Install Writr

```bash
> npm install writr
```

## 2. Render from Markdown

```javascript
import { Writr } from 'writr';

const writr = new Writr();
const markdown = `# Hello World ::-):\n\n This is a test.`;

const html = await writr.render(markdown); // <h1>Hello World 🙂</h1><p>This is a test.</p>
```
Its just that simple. Want to add some options? No problem.

```javascript
import { Writr } from 'writr';
const writr = new Writr();
const markdown = `# Hello World ::-):\n\n This is a test.`;
const options  = {
	emoji: false
}
const html = await writr.render(markdown, options); // <h1>Hello World ::-):</h1><p>This is a test.</p>
```

Want to render to a translation? No problem.

```javascript
import { Writr } from 'writr';
const writr = new Writr({ openai: 'your-api-key'});
const markdown = `# Hello World ::-):\n\n This is a test.`;
const langCode = 'es';
const html = await writr.renderTranslation(markdown, langCode, options); // <h1>Hola Mundo 🙂</h1><p>Esta es una prueba.</p>
```

How about generating keywords and descriptions for your front matter?

```javascript
import { Writr } from 'writr';
const writr = new Writr({ openai: 'your-api-key'});
const markdown = `# Hello World ::-):\n\n This is a test.`;
const keywords = await writr.keywords(markdown); // ['Hello World', 'Test']
const description = await writr.description(markdown); // 'Hello World Test'
```

## API

### `new Writr(options?: WritrOptions)`

```js
interface WritrOptions {
  	openai?: string; // openai api key (default: undefined)
	emoji?: boolean; // emoji support (default: true)
  	toc?: boolean; // table of contents generation (default: true)
  	slug?: boolean; // slug generation (default: true)
  	highlight?: boolean; // code highlighting (default: true)
	gfm?: boolean; // github flavor markdown (default: true)
}
```

You can access the `WritrOptions` from the instance of Writr.

```javascript
import { Writr, WritrOptions } from 'writr';
```

### `.options`

Accessing the default options for this instance of Writr.

### `.render(markdown: string, options?: RenderOptions): Promise<string>`

Rendering markdown to HTML. the options are based on RenderOptions. Which you can access from the Writr instance.

```javascript
import { Writr, RenderOptions } from 'writr';

## `RenderOptions`

```js
interface RenderOptions {
  emoji?: boolean; // emoji support
  toc?: boolean; // table of contents generation
  slug?: boolean; // slug generation
  highlight?: boolean; // code highlighting
  gfm?: boolean; // github flavor markdown
}
```

### `.renderTranslation(markdown: string, langCode: string, options?: RenderOptions): Promise<string>`

Rendering markdown to HTML. the options are based on RenderOptions. Which you can access from the Writr instance.


### `.keywords(markdown: string): Promise<string[]>`

AI Generation of Keywords that can be used for SEO on your HTML.

### `.description(markdown: string): Promise<string>`

AI Generation of a Description that can be used for SEO on your HTML.

## Code of Conduct and Contributing
[Code of Conduct](CODE_OF_CONDUCT.md) and [Contributing](CONTRIBUTING.md) guidelines.

## License

MIT © [Jared Wray](https://jaredwray.com)

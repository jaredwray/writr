![Writr](site/logo.svg)

---

## Markdown Rendering Simplified
[![Build](https://github.com/jaredwray/writr/actions/workflows/tests.yml/badge.svg)](https://github.com/jaredwray/writr/actions/workflows/tests.yml)
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

You can access the `WritrOptions` from the instance of Writr. Here is an example of WritrOptions.

```javascript
import { Writr, WritrOptions } from 'writr';
const writrOptions = {
  openai: 'your-api-key', // openai api key (default: undefined)
  renderOptions: {
	emoji: true,
	toc: true,
	slug: true,
	highlight: true,
	gfm: true,
	math: true
  }
};
const writr = new Writr(writrOptions);
```

### `.engine`

Accessing the underlying engine for this instance of Writr. This is a `Processor<Root, Root, Root, undefined, undefined>` fromt the unified `.use()` function. You can use this to add additional plugins to the engine.


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

### `.renderSync(markdown: string, options?: RenderOptions): string`

Rendering markdown to HTML synchronously. the options are based on RenderOptions. Which you can access from the Writr instance. The parameters are the same as the `.render()` function.

```javascript
import { Writr } from 'writr';
const writr = new Writr();
const markdown = `# Hello World ::-):\n\n This is a test.`;
const html = writr.renderSync(markdown); // <h1>Hello World 🙂</h1><p>This is a test.</p>
```

## Code of Conduct and Contributing
[Code of Conduct](CODE_OF_CONDUCT.md) and [Contributing](CONTRIBUTING.md) guidelines.

## License

MIT © [Jared Wray](https://jaredwray.com)

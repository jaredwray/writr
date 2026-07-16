//! Stage-level and per-profile benchmarks (`cargo bench -p writr-core`).
//!
//! The document mirrors the shape of writr's `benchmark-contents.ts` docs:
//! frontmatter, headings, lists, a table, emphasis, an autolink, emoji, a
//! JS fence, and inline + display math.
use criterion::{criterion_group, criterion_main, Criterion};
use writr_core::RenderOptions;

const DOC: &str = r#"---
title: "Benchmark Document"
tags:
  - "performance"
---

# Getting Started :rocket:

TypeScript is a strongly typed language that builds on JavaScript, giving
you better tooling at any scale. Visit https://www.typescriptlang.org for
more — or read the [handbook](https://www.typescriptlang.org/docs/).

## Why TypeScript?

- **Type Safety**: catch errors at compile time
- *Better IDE support*: autocomplete and refactoring
- ~~Runtime checks~~ Static analysis

| Feature | Supported |
| :------ | --------: |
| Types   | yes       |
| JSX     | yes       |

```javascript
function greet(name) {
	const message = `Hello, ${name}!`;
	console.log(message);
	return message.length;
}
```

The identity $e^{i\pi} + 1 = 0$ is famous, and so is

$$\frac{d}{dx} \int_a^x f(t)\,dt = f(x)$$

> [!NOTE]
> Benchmarks lie less when the content is realistic.
"#;

fn minimal() -> RenderOptions {
	RenderOptions {
		emoji: false,
		toc: false,
		slug: false,
		highlight: false,
		gfm: false,
		math: false,
		mdx: false,
		raw_html: false,
	}
}

fn benches(c: &mut Criterion) {
	let default = RenderOptions::default();
	// Warm lazy state (grammar compilation, KaTeX context + formula memo).
	writr_core::render(DOC, &default).unwrap();

	c.bench_function("parse_to_mdast", |b| {
		b.iter(|| writr_core::parse_to_mdast(std::hint::black_box(DOC), &minimal()).unwrap())
	});
	c.bench_function("render/minimal", |b| {
		b.iter(|| writr_core::render(std::hint::black_box(DOC), &minimal()).unwrap())
	});
	c.bench_function("render/gfm", |b| {
		let options = RenderOptions {
			gfm: true,
			..minimal()
		};
		b.iter(|| writr_core::render(std::hint::black_box(DOC), &options).unwrap())
	});
	c.bench_function("render/highlight", |b| {
		let options = RenderOptions {
			highlight: true,
			..minimal()
		};
		b.iter(|| writr_core::render(std::hint::black_box(DOC), &options).unwrap())
	});
	c.bench_function("render/math-memoized", |b| {
		let options = RenderOptions {
			math: true,
			..minimal()
		};
		b.iter(|| writr_core::render(std::hint::black_box(DOC), &options).unwrap())
	});
	c.bench_function("render/default", |b| {
		b.iter(|| writr_core::render(std::hint::black_box(DOC), &default).unwrap())
	});
}

criterion_group!(pipeline, benches);
criterion_main!(pipeline);

//! Golden cases captured from the real writr JS engine (unified/remark/rehype)
//! via `new Writr(input).render({...options, caching: false})` — see
//! `tests/fixtures/render-cases.jsonl`. Every expected string is the JS
//! output verbatim; the Rust engine must reproduce each byte-for-byte.

use serde::Deserialize;
use writr_core::{render, RenderOptions};

#[derive(Deserialize)]
struct Options {
	emoji: bool,
	toc: bool,
	slug: bool,
	highlight: bool,
	gfm: bool,
	math: bool,
	mdx: bool,
	raw_html: bool,
}

#[derive(Deserialize)]
struct Case {
	name: String,
	options: Options,
	input: String,
	expected: String,
}

impl From<&Options> for RenderOptions {
	fn from(options: &Options) -> Self {
		Self {
			emoji: options.emoji,
			toc: options.toc,
			slug: options.slug,
			highlight: options.highlight,
			gfm: options.gfm,
			math: options.math,
			mdx: options.mdx,
			raw_html: options.raw_html,
		}
	}
}

#[test]
fn render_matches_js_engine() {
	let raw = include_str!("fixtures/render-cases.jsonl");
	let mut failures: Vec<String> = Vec::new();
	let mut total = 0;
	for line in raw.lines() {
		if line.is_empty() {
			continue;
		}
		total += 1;
		let case: Case = serde_json::from_str(line).expect("valid case");
		let actual =
			render(&case.input, &RenderOptions::from(&case.options)).expect("render succeeds");
		if actual != case.expected {
			let at = case
				.expected
				.bytes()
				.zip(actual.bytes())
				.position(|(a, b)| a != b)
				.unwrap_or_else(|| case.expected.len().min(actual.len()));
			failures.push(format!(
				"case `{}` diverges at byte {at}:\n  expected: {:?}\n  actual:   {:?}",
				case.name, case.expected, actual
			));
		}
	}
	assert!(total > 0, "no cases loaded");
	assert!(
		failures.is_empty(),
		"{} of {total} cases diverge from the JS engine:\n{}",
		failures.len(),
		failures.join("\n")
	);
}

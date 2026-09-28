//! Differential corpus: every `(tex, display)` pair in
//! tests/fixtures/katex-corpus.jsonl must render exactly as katex@0.18.7 does
//! through rehype-katex's call sequence (tools/gen-katex-fixtures.mjs records
//! the FNV-1a hash and UTF-8 length of each expected output).
//!
//! To see full diffs, write the oracle's outputs with
//! `node writr-rs/tools/gen-katex-fixtures.mjs --full <file>` and run with
//! `WRITR_KATEX_FULL=<file>`. `WRITR_KATEX_CORPUS=<file>` checks another
//! fixture file instead, and `WRITR_KATEX_REPORT=<file>` writes every
//! mismatch as JSON lines.

use serde::Deserialize;
use std::collections::HashMap;

#[derive(Deserialize)]
struct Case {
	tex: String,
	display: bool,
	kind: String,
	hash: String,
	len: usize,
}

#[derive(Deserialize)]
struct Full {
	tex: String,
	display: bool,
	output: String,
}

fn fnv1a64(text: &str) -> String {
	let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
	for byte in text.bytes() {
		hash ^= u64::from(byte);
		hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
	}
	format!("{hash:016x}")
}

fn render(tex: &str, display: bool) -> (&'static str, String) {
	match writr_katex::render_math_with_cache(tex, display, false) {
		Ok(html) => ("html", html),
		Err(error) => ("error", error),
	}
}

/// The largest char boundary of `text` at or below `index` (the workspace MSRV
/// predates `str::floor_char_boundary`).
fn floor_boundary(text: &str, index: usize) -> usize {
	let mut index = index.min(text.len());
	while !text.is_char_boundary(index) {
		index -= 1;
	}
	index
}

/// First difference between `expected` and `actual`, with context.
fn diff(expected: &str, actual: &str) -> String {
	let at = expected
		.char_indices()
		.zip(actual.chars())
		.find(|((_, a), b)| a != b)
		.map_or(expected.len().min(actual.len()), |((index, _), _)| index);
	let from = floor_boundary(expected, at.saturating_sub(80));
	let window = |text: &str| {
		let from = floor_boundary(text, from);
		let to = floor_boundary(text, at + 120);
		text[from..to].to_string()
	};
	format!(
		"at byte {at}\n      expected …{}\n      actual   …{}",
		window(expected),
		window(actual)
	)
}

#[test]
fn corpus() {
	let full: HashMap<(String, bool), String> = std::env::var("WRITR_KATEX_FULL")
		.ok()
		.map(|path| {
			std::fs::read_to_string(path)
				.expect("full outputs file")
				.lines()
				.map(|line| {
					let entry: Full = serde_json::from_str(line).expect("full line");
					((entry.tex, entry.display), entry.output)
				})
				.collect()
		})
		.unwrap_or_default();
	let text = match std::env::var("WRITR_KATEX_CORPUS") {
		Ok(path) => std::fs::read_to_string(path).expect("corpus file"),
		Err(_) => include_str!("fixtures/katex-corpus.jsonl").to_string(),
	};
	let mut report = Vec::new();
	let mut checks = 0;
	let mut mismatches = Vec::new();
	for line in text.lines().filter(|line| !line.is_empty()) {
		let case: Case = serde_json::from_str(line).expect("corpus line");
		checks += 1;
		let (kind, output) = render(&case.tex, case.display);
		if kind == case.kind && output.len() == case.len && fnv1a64(&output) == case.hash {
			continue;
		}
		if let Some(expected) = full.get(&(case.tex.clone(), case.display)) {
			report.push(serde_json::json!({
				"tex": case.tex, "display": case.display,
				"expected": expected, "actual": output, "kind": kind,
			}));
		}
		let detail = match full.get(&(case.tex.clone(), case.display)) {
			Some(expected) => diff(expected, &output),
			None => {
				let end = floor_boundary(&output, 240);
				format!(
					"expected {} ({} bytes), got {kind}: {}",
					case.kind,
					case.len,
					&output[..end]
				)
			}
		};
		mismatches.push(format!(
			"{:?} display={}\n      {detail}",
			case.tex, case.display
		));
	}
	if let Ok(path) = std::env::var("WRITR_KATEX_REPORT") {
		let lines: Vec<String> = report.iter().map(ToString::to_string).collect();
		std::fs::write(path, lines.join("\n")).expect("write report");
	}
	if !mismatches.is_empty() {
		let shown: Vec<_> = mismatches.iter().take(40).cloned().collect();
		panic!(
			"{} of {checks} corpus renders differ:\n  {}",
			mismatches.len(),
			shown.join("\n  ")
		);
	}
	assert!(checks > 0);
}

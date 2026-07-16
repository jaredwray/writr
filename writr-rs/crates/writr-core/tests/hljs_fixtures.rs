//! Highlight fixtures: every corpus/diagnostic fence rendered by the real
//! lowlight@3.3.0 (see tools/gen-hljs-fixtures.mjs). The Rust engine must
//! reproduce each serialized result byte-for-byte.

use serde::Deserialize;
use writr_core::hast::{to_html, Element, Node};

#[derive(Deserialize)]
struct Fixture {
	lang: String,
	text: String,
	html: String,
}

fn render(lang: &str, text: &str) -> String {
	let nodes = writr_hljs::highlight(lang, text).expect("registered");
	let children = nodes.into_iter().map(hl_to_hast).collect();
	to_html::to_html(&Node::Root(children), to_html::Options::default())
}

fn hl_to_hast(node: writr_hljs::HlNode) -> Node {
	match node {
		writr_hljs::HlNode::Text(value) => Node::Text(value),
		writr_hljs::HlNode::Span {
			class_names,
			children,
		} => {
			let mut span = Element::new("span");
			span.push_property("className", class_names);
			span.children = children.into_iter().map(hl_to_hast).collect();
			Node::Element(span)
		}
	}
}

#[test]
fn corpus_fences_match_lowlight() {
	let raw = include_str!("fixtures/hljs-corpus.jsonl");
	let mut failures: Vec<String> = Vec::new();
	let mut total = 0;
	for line in raw.lines() {
		if line.is_empty() {
			continue;
		}
		total += 1;
		let fixture: Fixture = serde_json::from_str(line).expect("valid fixture");
		let actual = render(&fixture.lang, &fixture.text);
		if actual != fixture.html {
			let at = fixture
				.html
				.bytes()
				.zip(actual.bytes())
				.take_while(|(a, b)| a == b)
				.count();
			let from = at.saturating_sub(60);
			// Clamp to char boundaries for slicing.
			let clamp = |s: &str, i: usize| {
				let mut i = i.min(s.len());
				while i > 0 && !s.is_char_boundary(i) {
					i -= 1;
				}
				i
			};
			let (ef, af) = (clamp(&fixture.html, from), clamp(&actual, from));
			let (et, at2) = (clamp(&fixture.html, at + 80), clamp(&actual, at + 80));
			failures.push(format!(
				"[{} #{}]\n  expected: …{}…\n  actual:   …{}…",
				fixture.lang,
				total,
				&fixture.html[ef..et.max(ef)],
				&actual[af..at2.max(af)],
			));
		}
	}
	if let Ok(path) = std::env::var("HLJS_FIXTURE_REPORT") {
		std::fs::write(&path, failures.join("\n\n")).ok();
	}
	if !failures.is_empty() {
		let shown = failures.len().min(15);
		panic!(
			"{}/{total} hljs fixtures diverged. First {shown}:\n\n{}",
			failures.len(),
			failures[..shown].join("\n\n")
		);
	}
}

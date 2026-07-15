//! writr-hljs — a Rust port of the highlight.js 11.11.1 tokenizer with
//! lowlight@3.3.0's common-language registry, producing the exact token
//! trees rehype-highlight@7.0.2 emits.

mod compile;
mod engine;
mod raw;
pub mod regex_js;
mod registry;
pub mod tree;

pub use engine::HighlightResult;
pub use tree::HlNode;

/// Whether a language (or alias) is registered — `lowlight.registered`.
pub fn registered(name: &str) -> bool {
	registry::registered(name)
}

/// Highlight `code` as `language` (ignoring illegal matches, exactly like
/// lowlight). Returns `None` when the language is not registered.
pub fn highlight(language: &str, code: &str) -> Option<Vec<HlNode>> {
	let compiled = registry::get(language)?;
	Some(engine::highlight(compiled, code, None).root)
}

#[cfg(test)]
mod tests {
	use super::*;
	use tree::HlNode;

	fn spans(nodes: &[HlNode]) -> String {
		let mut out = String::new();
		for node in nodes {
			match node {
				HlNode::Text(value) => out.push_str(value),
				HlNode::Span {
					class_names,
					children,
				} => {
					out.push_str(&format!("<{}>", class_names.join(" ")));
					out.push_str(&spans(children));
					out.push_str("</>");
				}
			}
		}
		out
	}

	#[test]
	fn registry_resolves_aliases() {
		assert!(registered("javascript"));
		assert!(registered("js"));
		assert!(registered("JS"));
		assert!(registered("golang"));
		assert!(!registered("nonexistlang"));
	}

	#[test]
	fn highlights_json() {
		let result = highlight("json", "{\"a\": true}\n").unwrap();
		let rendered = spans(&result);
		assert!(
			rendered.contains("<hljs-attr>\"a\"</>"),
			"got: {rendered}"
		);
		assert!(
			rendered.contains("<hljs-literal>") && rendered.contains("true"),
			"got: {rendered}"
		);
	}

	#[test]
	fn highlights_javascript_keywords() {
		let result = highlight("js", "const x = 1;\n").unwrap();
		let rendered = spans(&result);
		assert!(
			rendered.contains("<hljs-keyword>const</>"),
			"got: {rendered}"
		);
	}

	#[test]
	fn unknown_language_is_none() {
		assert!(highlight("nonexistlang", "x").is_none());
	}
}


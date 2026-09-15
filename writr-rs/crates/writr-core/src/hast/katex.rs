//! Port of rehype-katex@7.0.1 with default options.

use super::{Element, Node, PropertyValue};
use writr_katex::cache::MathCache;

thread_local! {
	static PARSED: std::cell::RefCell<MathCache<Vec<Node>>> =
		std::cell::RefCell::new(MathCache::default());
}

fn classes(element: &Element) -> &[String] {
	match element.property("className") {
		Some(PropertyValue::List(classes)) => classes,
		_ => &[],
	}
}

fn to_text(element: &Element) -> String {
	let mut out = String::new();
	collect(&element.children, &mut out);
	out
}

fn collect(children: &[Node], out: &mut String) {
	for child in children {
		match child {
			Node::Text(value) => out.push_str(value),
			Node::Element(element) => collect(&element.children, out),
			_ => {}
		}
	}
}

/// The `katex-error` span rehype-katex builds when even the lenient KaTeX
/// call fails (`errorColor` default `#cc0000`).
fn error_span(value: &str, error: &str) -> Node {
	let mut span = Element::new("span");
	span.push_property("className", vec!["katex-error".to_string()]);
	span.push_property("style", "color:#cc0000");
	span.push_property("title", error);
	span.children = vec![Node::Text(value.to_string())];
	Node::Element(span)
}

/// Apply math rendering to a hast tree.
pub fn transform(tree: &mut Node) {
	transform_with_cache(tree, true);
}

/// Apply math rendering, optionally bypassing both formula caches.
pub fn transform_with_cache(tree: &mut Node, caching: bool) {
	if let Node::Root(children) = tree {
		walk(children, None, caching);
	}
}

/// Visit children of a parent whose tag is `parent_tag`, replacing math
/// scopes in place (`visitParents` + splice + SKIP).
fn walk(children: &mut Vec<Node>, parent_tag: Option<&str>, caching: bool) {
	let mut index = 0;
	while index < children.len() {
		let replacement: Option<Vec<Node>> = match &children[index] {
			Node::Element(element) => {
				let class_list = classes(element);
				let language_math = class_list.iter().any(|c| c == "language-math");
				let math_display = class_list.iter().any(|c| c == "math-display");
				let math_inline = class_list.iter().any(|c| c == "math-inline");
				if !(language_math || math_display || math_inline) {
					None
				} else {
					// ```math code in a pre: the pre is the scope (handled at
					// the pre's parent level below via the code check).
					let mut display_mode = math_display;
					let mut scope_is_this = true;
					if element.tag_name == "code" && language_math && parent_tag == Some("pre") {
						// The parent <pre> is the scope; handled one level up
						// (when iterating the pre's parent). Skip here — the
						// pre-level pass below replaces it.
						scope_is_this = false;
					}
					if scope_is_this {
						let value = to_text(element);
						Some(render(&value, display_mode, caching))
					} else {
						let _ = &mut display_mode;
						None
					}
				}
			}
			_ => None,
		};

		// `<pre><code class="language-math">`: the scope is the pre itself.
		let pre_replacement: Option<Vec<Node>> = match &children[index] {
			Node::Element(pre) if pre.tag_name == "pre" => {
				let code_is_math = pre.children.iter().any(|child| {
					matches!(
						child,
						Node::Element(code)
							if code.tag_name == "code"
								&& classes(code).iter().any(|c| c == "language-math")
					)
				});
				if code_is_math {
					let value = to_text(pre);
					Some(render(&value, true, caching))
				} else {
					None
				}
			}
			_ => None,
		};

		if let Some(nodes) = pre_replacement.or(replacement) {
			let count = nodes.len();
			children.splice(index..=index, nodes);
			// SKIP: continue after the inserted nodes.
			index += count;
			continue;
		}

		if let Node::Element(element) = &mut children[index] {
			let tag = element.tag_name.clone();
			walk(&mut element.children, Some(&tag), caching);
			if let Some(content) = &mut element.template_content {
				walk(content, Some(&tag), caching);
			}
		}
		index += 1;
	}
}

fn render(value: &str, display_mode: bool, caching: bool) -> Vec<Node> {
	if caching {
		if let Some(nodes) = PARSED.with(|cache| cache.borrow().get(value, display_mode).cloned()) {
			return nodes;
		}
	}
	let nodes = match writr_katex::render_math_with_cache(value, display_mode, caching) {
		Ok(html) => super::raw::parse_fragment(&html),
		Err(error) => vec![error_span(value, &error)],
	};
	if caching {
		let retained = nodes.clone();
		let bytes = nodes_bytes(&retained);
		PARSED.with(|cache| {
			cache
				.borrow_mut()
				.insert(value, display_mode, retained, bytes)
		});
	}
	nodes
}

/// Heap capacity of the retained clone, including nested nodes and properties.
/// Inline fields are already included in the containing vector's allocation.
fn nodes_bytes(nodes: &Vec<Node>) -> usize {
	let mut bytes = nodes.capacity() * std::mem::size_of::<Node>();
	for node in nodes {
		bytes += match node {
			Node::Root(children) => nodes_bytes(children),
			Node::Text(value) | Node::Comment(value) | Node::Raw(value) => value.capacity(),
			Node::Doctype => 0,
			Node::Element(element) => {
				let mut size = element.tag_name.capacity()
					+ element.properties.capacity()
						* std::mem::size_of::<(String, PropertyValue)>()
					+ nodes_bytes(&element.children);
				if let Some(content) = &element.template_content {
					size += nodes_bytes(content);
				}
				for (key, value) in &element.properties {
					size += key.capacity();
					size += match value {
						PropertyValue::String(value) => value.capacity(),
						PropertyValue::List(values) => {
							values.capacity() * std::mem::size_of::<String>()
								+ values.iter().map(String::capacity).sum::<usize>()
						}
						PropertyValue::Bool(_) | PropertyValue::Number(_) => 0,
					};
				}
				size
			}
		};
	}
	bytes
}

#[cfg(test)]
mod tests {
	use super::*;
	use writr_katex::cache::{MAX_BYTES, MAX_ENTRIES};

	#[test]
	fn parsed_cache_stays_bounded_under_unique_formulas() {
		let options = crate::RenderOptions {
			math: true,
			caching: true,
			..crate::RenderOptions::all_off()
		};
		for i in 0..MAX_ENTRIES * 3 {
			let html = crate::render(&format!("$p_{{{i}}}+9$"), &options).unwrap();
			assert!(html.contains("katex"));
			PARSED.with(|cache| {
				let cache = cache.borrow();
				assert!(cache.len() <= MAX_ENTRIES);
				assert!(cache.bytes() <= MAX_BYTES);
			});
		}
		PARSED.with(|cache| assert!(cache.borrow().get("p_{0}+9", false).is_none()));
	}

	#[test]
	fn disabled_caching_bypasses_parsed_reads_and_writes_through_pipeline() {
		let options = crate::RenderOptions {
			math: true,
			..crate::RenderOptions::all_off()
		};
		PARSED.with(|cache| {
			cache
				.borrow_mut()
				.insert("x", false, vec![Node::text("sentinel")], 8)
		});
		let before = PARSED.with(|cache| (cache.borrow().len(), cache.borrow().bytes()));
		for input in ["$x$", "$$\nx+1\n$$", "```math\nx+2\n```", "$\\frac{$"] {
			let uncached = crate::render(input, &options).unwrap();
			assert!(uncached.contains("katex"), "{uncached}");
			assert_eq!(
				PARSED.with(|cache| (cache.borrow().len(), cache.borrow().bytes())),
				before
			);
		}
		PARSED.with(|cache| {
			assert_eq!(
				cache.borrow().get("x", false),
				Some(&vec![Node::text("sentinel")])
			)
		});
	}

	#[test]
	fn caching_preserves_output_and_display_mode() {
		for formula in ["x^2", "\\frac{", "\\int_0^1 x"] {
			for display in [false, true] {
				let uncached = render(formula, display, false);
				assert_eq!(render(formula, display, true), uncached);
				assert_eq!(render(formula, display, true), uncached);
			}
		}
		assert_ne!(render("x^2", false, true), render("x^2", true, true));
	}

	#[test]
	fn parsed_byte_budget_counts_nested_allocations_and_skips_oversized_entries() {
		let mut element = Element::new("span");
		element.push_property("className", vec!["katex".into()]);
		element.template_content = Some(vec![Node::text("template")]);
		element.children = vec![Node::text("x".repeat(MAX_BYTES))];
		let nodes = vec![Node::Element(element)];
		assert!(nodes_bytes(&nodes) > MAX_BYTES);
		let mut cache = MathCache::default();
		cache.insert("large", false, nodes.clone(), nodes_bytes(&nodes));
		assert!(cache.is_empty());
		assert_eq!(cache.bytes(), 0);

		let nodes = vec![Node::text("x".repeat(MAX_BYTES / 2))];
		cache.insert("a", false, nodes.clone(), nodes_bytes(&nodes));
		cache.insert("b", false, nodes.clone(), nodes_bytes(&nodes));
		assert_eq!(cache.len(), 1);
		assert!(cache.get("a", false).is_none());
		assert!(cache.bytes() <= MAX_BYTES);
	}
}

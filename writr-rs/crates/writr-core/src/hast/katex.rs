//! Port of rehype-katex@7.0.1 with default options.

use super::{Element, Node, PropertyValue};

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
	if let Node::Root(children) = tree {
		walk(children, None);
	}
}

/// Visit children of a parent whose tag is `parent_tag`, replacing math
/// scopes in place (`visitParents` + splice + SKIP).
fn walk(children: &mut Vec<Node>, parent_tag: Option<&str>) {
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
						Some(render(&value, display_mode))
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
					Some(render(&value, true))
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
			walk(&mut element.children, Some(&tag));
			if let Some(content) = &mut element.template_content {
				walk(content, Some(&tag));
			}
		}
		index += 1;
	}
}

fn render(value: &str, display_mode: bool) -> Vec<Node> {
	// writr-katex memoizes (formula, display) → HTML string; memoize the
	// html5ever parse of that string too — KaTeX output is deterministic,
	// so repeated formulas cost one clone instead of a fragment parse.
	thread_local! {
		static PARSED: std::cell::RefCell<std::collections::HashMap<(String, bool), Vec<Node>>> =
			std::cell::RefCell::new(std::collections::HashMap::new());
	}
	PARSED.with(|cache| {
		if let Some(nodes) = cache.borrow().get(&(value.to_string(), display_mode)) {
			return nodes.clone();
		}
		let nodes = match writr_katex::render_math(value, display_mode) {
			Ok(html) => super::raw::parse_fragment(&html),
			Err(error) => vec![error_span(value, &error)],
		};
		cache
			.borrow_mut()
			.insert((value.to_string(), display_mode), nodes.clone());
		nodes
	})
}

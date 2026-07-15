//! Port of rehype-highlight@7.0.2 with default options (lowlight common
//! languages, `detect: false`, prefix `hljs-`).

use super::{Element, Node, PropertyValue};

/// The language for a `<code>` element per rehype-highlight's `language()`:
/// scan classes for `no-highlight`/`nohighlight` (→ skip), else the first
/// `lang-`/`language-` prefix.
enum CodeLanguage {
	Skip,
	None,
	Some(String),
}

fn language_of(element: &Element) -> CodeLanguage {
	let Some(PropertyValue::List(classes)) = element.property("className") else {
		return CodeLanguage::None;
	};
	let mut name: Option<String> = None;
	for value in classes {
		if value == "no-highlight" || value == "nohighlight" {
			return CodeLanguage::Skip;
		}
		if name.is_none() {
			if let Some(rest) = value.strip_prefix("lang-") {
				name = Some(rest.to_string());
			} else if let Some(rest) = value.strip_prefix("language-") {
				name = Some(rest.to_string());
			}
		}
	}
	match name {
		// An empty name (`language-`) is falsy in JS — treated as no language.
		Some(name) if !name.is_empty() => CodeLanguage::Some(name),
		_ => CodeLanguage::None,
	}
}

/// hast-util-to-text with `whitespace: 'pre'` over a `<code>` element —
/// for our trees this is the concatenated text descendants.
fn to_text(element: &Element) -> String {
	let mut out = String::new();
	collect_text(&element.children, &mut out);
	out
}

fn collect_text(children: &[Node], out: &mut String) {
	for child in children {
		match child {
			Node::Text(value) => out.push_str(value),
			Node::Element(element) => collect_text(&element.children, out),
			_ => {}
		}
	}
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

/// Apply highlighting to every `<pre><code>` pair.
pub fn transform(tree: &mut Node) {
	walk(tree, None);
}

fn walk(node: &mut Node, parent_tag: Option<&str>) {
	match node {
		Node::Root(children) => {
			for child in children {
				walk(child, None);
			}
		}
		Node::Element(element) => {
			if element.tag_name == "code" && parent_tag == Some("pre") {
				highlight_code(element);
			}
			let tag = element.tag_name.clone();
			for child in &mut element.children {
				walk(child, Some(&tag));
			}
			if let Some(content) = &mut element.template_content {
				for child in content {
					walk(child, Some(&tag));
				}
			}
		}
		_ => {}
	}
}

fn highlight_code(element: &mut Element) {
	let lang = match language_of(element) {
		CodeLanguage::Skip => return,
		CodeLanguage::None => return, // `detect` is false
		CodeLanguage::Some(lang) => lang,
	};

	// Ensure a class list exists and unshift `hljs` (before the try —
	// unregistered languages keep the class, matching upstream).
	let has_class_list = matches!(
		element.property("className"),
		Some(PropertyValue::List(_))
	);
	if !has_class_list {
		element.push_property("className", Vec::<String>::new());
	}
	if let Some(entry) = element
		.properties
		.iter_mut()
		.find(|(key, _)| key == "className")
	{
		if let PropertyValue::List(classes) = &mut entry.1 {
			if !classes.iter().any(|c| c == "hljs") {
				classes.insert(0, "hljs".to_string());
			}
		}
	}

	if !writr_hljs::registered(&lang) {
		// rehype-highlight reports a vfile message and leaves the children.
		return;
	}

	let text = to_text(element);
	let result = writr_hljs::highlight(&lang, &text).expect("registered language");
	if !result.is_empty() {
		element.children = result.into_iter().map(hl_to_hast).collect();
	}
}

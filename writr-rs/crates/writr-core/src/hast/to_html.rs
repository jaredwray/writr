//! Byte-exact port of hast-util-to-html@9.0.5 with rehype-stringify's default
//! options (all settings false, `quote: '"'`, HTML void elements).
//!
//! Entity encoding follows stringify-entities' `formatSmart` with no named or
//! shortest references configured: uppercase hexadecimal character references
//! with a semicolon (`&` → `&#x26;`).

use super::property_info::{find, Info, Space};
use super::{Element, Node, PropertyValue};
use crate::js;

/// `html-void-elements@3.0.0`.
const VOID_ELEMENTS: &[&str] = &[
	"area", "base", "basefont", "bgsound", "br", "col", "command", "embed", "frame", "hr", "image",
	"img", "input", "keygen", "link", "meta", "param", "source", "track", "wbr",
];

/// Subset escaped in text nodes.
const TEXT_SUBSET: &[char] = &['<', '&'];
/// Subset escaped in attribute names (defaults: `constants.name[1][1]`).
const NAME_SUBSET: &[char] = &[
	'\0', '\t', '\n', '\u{000C}', '\r', ' ', '"', '&', '\'', '/', '<', '=', '>', '`',
];
/// Subset escaped in double-quoted attribute values (`constants.double[1][1]`).
const DOUBLE_QUOTED_SUBSET: &[char] = &['\0', '"', '&', '\'', '`'];
/// Subset escaped inside comment token replacements.
const COMMENT_SUBSET: &[char] = &['<', '>'];

/// Serializer options (rehype-stringify only ever varies this one).
#[derive(Debug, Clone, Copy, Default)]
pub struct Options {
	pub allow_dangerous_html: bool,
}

/// Serialize a hast tree to HTML.
pub fn to_html(node: &Node, options: Options) -> String {
	to_html_with_capacity(node, options, 0)
}

/// `to_html` with a pre-sized output buffer (callers that know the source
/// length pass a heuristic to skip growth reallocations).
pub fn to_html_with_capacity(node: &Node, options: Options, capacity: usize) -> String {
	let mut output = String::with_capacity(capacity);
	one(&mut output, node, None, Space::Html, options);
	output
}

fn one(output: &mut String, node: &Node, parent: Option<&Element>, space: Space, options: Options) {
	match node {
		Node::Root(children) => all(output, children, None, space, options),
		Node::Element(element) => serialize_element(output, element, space, options),
		Node::Text(value) => text(output, value, parent),
		Node::Comment(value) => comment(output, value),
		Node::Doctype => output.push_str("<!doctype html>"),
		Node::Raw(value) => {
			if options.allow_dangerous_html {
				output.push_str(value);
			} else {
				text(output, value, parent);
			}
		}
	}
}

fn all(
	output: &mut String,
	children: &[Node],
	parent: Option<&Element>,
	space: Space,
	options: Options,
) {
	for child in children {
		one(output, child, parent, space, options);
	}
}

fn serialize_element(output: &mut String, node: &Element, space: Space, options: Options) {
	// With defaults, self-closing is possible only for HTML void elements
	// (`closeEmptyElements` is false for SVG).
	let child_space = if space == Space::Html && node.tag_name == "svg" {
		Space::Svg
	} else {
		space
	};
	let self_closing = space == Space::Html
		&& VOID_ELEMENTS
			.iter()
			.any(|void| void.eq_ignore_ascii_case(&node.tag_name));

	let children = if child_space == Space::Html && node.tag_name == "template" {
		node.template_content.as_deref().unwrap_or(&node.children)
	} else {
		&node.children
	};

	output.push('<');
	output.push_str(&node.tag_name);
	// Defaults: `tightAttributes: false` — one space before every emitted
	// attribute (equivalent to the reference's ` ` + `join(" ")`).
	for (key, value) in &node.properties {
		serialize_attribute_into(output, key, value, child_space);
	}
	// With defaults (`closeSelfClosing: false`, SVG `closeEmptyElements:
	// false`) no ` /` is ever emitted before `>`.
	output.push('>');
	// Serialize children straight into the parent buffer (no per-level
	// copy); "did this element have content" falls out of the length.
	let content_start = output.len();
	all(output, children, Some(node), child_space, options);
	let had_content = output.len() > content_start;
	// A void element with actual content is serialized with a closing tag.
	if !self_closing || had_content {
		output.push_str("</");
		output.push_str(&node.tag_name);
		output.push('>');
	}
}

fn serialize_attribute_into(output: &mut String, key: &str, value: &PropertyValue, space: Space) {
	let info = find(space, key);
	let value = coerce_boolean(value, &info);

	match &value {
		PropertyValue::Bool(false) => return,
		PropertyValue::Number(n) if n.is_nan() => return,
		_ => {}
	}

	output.push(' ');
	stringify_entities_into(output, &info.attribute, NAME_SUBSET);

	if value == PropertyValue::Bool(true) {
		return;
	}

	let string_value: std::borrow::Cow<'_, str> = match &value {
		PropertyValue::List(items) => {
			if info.comma_separated() {
				stringify_commas(items).into()
			} else {
				stringify_spaces(items).into()
			}
		}
		PropertyValue::Number(n) => js::number_to_string(*n).into(),
		PropertyValue::String(s) => s.as_str().into(),
		PropertyValue::Bool(_) => unreachable!("booleans handled above"),
	};

	// Defaults: `collapseEmptyAttributes: false`, `preferUnquoted: false`,
	// `quoteSmart: false` — always double-quoted.
	output.push('=');
	output.push('"');
	stringify_entities_into(output, &string_value, DOUBLE_QUOTED_SUBSET);
	output.push('"');
}

/// The boolean/overloaded-boolean coercion at the top of `serializeAttribute`.
fn coerce_boolean(value: &PropertyValue, info: &Info<'_>) -> PropertyValue {
	if info.overloaded_boolean() {
		if let PropertyValue::String(s) = value {
			if s == info.attribute.as_ref() || s.is_empty() {
				return PropertyValue::Bool(true);
			}
		}
	}
	if info.boolean() || info.overloaded_boolean() {
		let keep_string = matches!(
			value,
			PropertyValue::String(s) if s != info.attribute.as_ref() && !s.is_empty()
		);
		if !keep_string {
			// `Boolean(value)` — note JS truthiness: `Boolean([])` is true,
			// `Boolean("")` is false.
			return PropertyValue::Bool(match value {
				PropertyValue::Bool(b) => *b,
				PropertyValue::String(s) => !s.is_empty(),
				PropertyValue::Number(n) => *n != 0.0 && !n.is_nan(),
				PropertyValue::List(_) => true,
			});
		}
	}
	value.clone()
}

/// comma-separated-tokens@2.0.3 `stringify` with `padLeft: true`.
fn stringify_commas(values: &[String]) -> String {
	let mut input: Vec<&str> = values.iter().map(String::as_str).collect();
	// Ensure the last empty entry is seen.
	if input.last() == Some(&"") {
		input.push("");
	}
	input.join(", ")
}

/// space-separated-tokens@2.0.2 `stringify`.
fn stringify_spaces(values: &[String]) -> String {
	js::trim(&values.join(" ")).to_string()
}

fn text(output: &mut String, value: &str, parent: Option<&Element>) {
	let raw = matches!(
		parent,
		Some(element) if element.tag_name == "script" || element.tag_name == "style"
	);
	if raw {
		output.push_str(value);
	} else {
		stringify_entities_into(output, value, TEXT_SUBSET);
	}
}

/// Port of the comment handler: `<!--` + value with the dangerous token
/// sequences (`^>`, `^->`, `<!--`, `-->`, `--!>`, `<!-$`) encoded + `-->`.
fn comment(output: &mut String, value: &str) {
	output.push_str("<!--");
	let bytes = value.as_bytes();
	let mut index = 0;
	let mut last_emit = 0;
	while index < bytes.len() {
		let rest = &value[index..];
		let token_len = if index == 0 && rest.starts_with('>') {
			1
		} else if index == 0 && rest.starts_with("->") {
			2
		} else if rest.starts_with("<!--") {
			4
		} else if rest.starts_with("-->") {
			3
		} else if rest.starts_with("--!>") {
			4
		} else if rest == "<!-" {
			3
		} else {
			0
		};
		if token_len > 0 {
			output.push_str(&value[last_emit..index]);
			stringify_entities_into(output, &value[index..index + token_len], COMMENT_SUBSET);
			index += token_len;
			last_emit = index;
		} else {
			// Advance one byte; tokens are all ASCII so byte scanning is safe.
			index += 1;
			while index < bytes.len() && !value.is_char_boundary(index) {
				index += 1;
			}
		}
	}
	output.push_str(&value[last_emit..]);
	output.push_str("-->");
}

/// stringify-entities with a `subset` (formatSmart, no named/shortest
/// references): each subset character becomes `&#x<HEX>;` (uppercase).
pub fn stringify_entities(value: &str, subset: &[char]) -> String {
	let mut result = String::with_capacity(value.len());
	stringify_entities_into(&mut result, value, subset);
	result
}

/// `stringify_entities` writing straight into the output buffer. Every
/// subset is pure ASCII, so clean runs are found with a byte scan and
/// copied over in bulk instead of char-by-char.
fn stringify_entities_into(output: &mut String, value: &str, subset: &[char]) {
	debug_assert!(subset.iter().all(char::is_ascii), "ASCII-only subsets");
	const HEX: &[u8; 16] = b"0123456789ABCDEF";
	let bytes = value.as_bytes();
	let mut start = 0;
	for (index, &byte) in bytes.iter().enumerate() {
		if byte.is_ascii() && subset.contains(&(byte as char)) {
			output.push_str(&value[start..index]);
			output.push_str("&#x");
			// `{:X}` of the code point: at most two digits for ASCII, no
			// leading zero.
			if byte >= 0x10 {
				output.push(HEX[(byte >> 4) as usize] as char);
			}
			output.push(HEX[(byte & 0x0F) as usize] as char);
			output.push(';');
			start = index + 1;
		}
	}
	output.push_str(&value[start..]);
}

#[cfg(test)]
mod tests {
	use super::*;

	fn element(tag: &str, children: Vec<Node>) -> Element {
		Element::with_children(tag, children)
	}

	#[test]
	fn serializes_basic_tree() {
		let mut p = element("p", vec![Node::text("a & b < c > d")]);
		p.push_property("className", vec!["x".to_string(), "y".to_string()]);
		let html = to_html(&Node::Element(p), Options::default());
		assert_eq!(html, "<p class=\"x y\">a &#x26; b &#x3C; c > d</p>");
	}

	#[test]
	fn void_elements_have_no_closing_tag() {
		let br = element("br", vec![]);
		assert_eq!(to_html(&Node::Element(br), Options::default()), "<br>");
	}

	#[test]
	fn boolean_attributes_are_bare() {
		let mut input = element("input", vec![]);
		input.push_property("type", "checkbox");
		input.push_property("checked", true);
		input.push_property("disabled", true);
		assert_eq!(
			to_html(&Node::Element(input), Options::default()),
			"<input type=\"checkbox\" checked disabled>"
		);
	}

	#[test]
	fn false_and_nan_attributes_are_dropped() {
		let mut input = element("input", vec![]);
		input.push_property("checked", false);
		input.push_property("tabIndex", f64::NAN);
		assert_eq!(
			to_html(&Node::Element(input), Options::default()),
			"<input>"
		);
	}

	#[test]
	fn attribute_values_escape_quotes_and_ampersands() {
		let mut a = element("a", vec![Node::text("x")]);
		a.push_property("href", "https://e.com/?a=1&b='\"`");
		assert_eq!(
			to_html(&Node::Element(a), Options::default()),
			"<a href=\"https://e.com/?a=1&#x26;b=&#x27;&#x22;&#x60;\">x</a>"
		);
	}

	#[test]
	fn empty_string_attribute_keeps_quotes() {
		let mut a = element("a", vec![]);
		a.push_property("dataFootnoteBackref", "");
		assert_eq!(
			to_html(&Node::Element(a), Options::default()),
			"<a data-footnote-backref=\"\"></a>"
		);
	}

	#[test]
	fn script_and_style_text_is_not_escaped() {
		let script = element("script", vec![Node::text("if (a < b && c) {}")]);
		assert_eq!(
			to_html(&Node::Element(script), Options::default()),
			"<script>if (a < b && c) {}</script>"
		);
	}

	#[test]
	fn raw_nodes_escape_unless_dangerous() {
		let root = Node::Root(vec![Node::Raw("<div>".into())]);
		assert_eq!(to_html(&root, Options::default()), "&#x3C;div>");
		assert_eq!(
			to_html(
				&root,
				Options {
					allow_dangerous_html: true
				}
			),
			"<div>"
		);
	}

	#[test]
	fn svg_space_uses_svg_attributes_and_closes_elements() {
		let mut path = element("path", vec![]);
		path.push_property("d", "M0 8a8");
		let mut svg = element("svg", vec![Node::Element(path)]);
		svg.push_property("className", vec!["octicon".to_string()]);
		svg.push_property("viewBox", "0 0 16 16");
		svg.push_property("width", 16.0);
		assert_eq!(
			to_html(&Node::Element(svg), Options::default()),
			"<svg class=\"octicon\" viewBox=\"0 0 16 16\" width=\"16\"><path d=\"M0 8a8\"></path></svg>"
		);
	}

	#[test]
	fn comments_encode_dangerous_sequences() {
		assert_eq!(
			to_html(&Node::Comment("hi".into()), Options::default()),
			"<!--hi-->"
		);
		assert_eq!(
			to_html(&Node::Comment(">start".into()), Options::default()),
			"<!--&#x3E;start-->"
		);
		assert_eq!(
			to_html(&Node::Comment("a--><!--b".into()), Options::default()),
			"<!--a--&#x3E;&#x3C;!--b-->"
		);
		assert_eq!(
			to_html(&Node::Comment("tail<!-".into()), Options::default()),
			"<!--tail&#x3C;!--->"
		);
	}

	#[test]
	fn doctype_serializes_lowercase() {
		assert_eq!(
			to_html(&Node::Doctype, Options::default()),
			"<!doctype html>"
		);
	}

	// Expectations below are verbatim hast-util-to-html@9.0.5 outputs on the
	// same trees.

	#[test]
	fn comma_separated_properties_join_with_commas() {
		// JS: `<input accept=".jpg, .png">` (comma-separated-tokens
		// stringify with `padLeft`).
		let mut input = element("input", vec![]);
		input.push_property("accept", vec![".jpg".to_string(), ".png".to_string()]);
		assert_eq!(
			to_html(&Node::Element(input), Options::default()),
			"<input accept=\".jpg, .png\">"
		);

		// Interior empty entries survive: JS `<input accept="a, , b">`.
		let mut input = element("input", vec![]);
		input.push_property(
			"accept",
			vec!["a".to_string(), String::new(), "b".to_string()],
		);
		assert_eq!(
			to_html(&Node::Element(input), Options::default()),
			"<input accept=\"a, , b\">"
		);
	}

	#[test]
	fn overloaded_boolean_download() {
		let a = |value: PropertyValue| {
			let mut a = element("a", vec![]);
			a.properties.push(("download".to_string(), value));
			to_html(&Node::Element(a), Options::default())
		};
		// JS: value === attribute or '' → bare attribute.
		assert_eq!(
			a(PropertyValue::String("download".into())),
			"<a download></a>"
		);
		assert_eq!(a(PropertyValue::String(String::new())), "<a download></a>");
		// Any other string is kept.
		assert_eq!(
			a(PropertyValue::String("file.txt".into())),
			"<a download=\"file.txt\"></a>"
		);
		// Non-strings coerce via `Boolean(value)`.
		assert_eq!(a(PropertyValue::Bool(true)), "<a download></a>");
		assert_eq!(a(PropertyValue::Number(0.0)), "<a></a>");
		assert_eq!(
			a(PropertyValue::List(vec!["x".into(), "y".into()])),
			"<a download></a>"
		);
	}

	#[test]
	fn boolean_properties_coerce_like_js() {
		let input = |value: PropertyValue| {
			let mut input = element("input", vec![]);
			input.properties.push(("checked".to_string(), value));
			to_html(&Node::Element(input), Options::default())
		};
		// Strings equal to the attribute name (or empty) coerce to boolean…
		assert_eq!(
			input(PropertyValue::String("checked".into())),
			"<input checked>"
		);
		assert_eq!(input(PropertyValue::String(String::new())), "<input>");
		// …while any other string is kept verbatim (JS `<input checked="yes">`).
		assert_eq!(
			input(PropertyValue::String("yes".into())),
			"<input checked=\"yes\">"
		);
		// Numbers and lists use JS truthiness (`Boolean([])` is true).
		assert_eq!(input(PropertyValue::Number(0.0)), "<input>");
		assert_eq!(input(PropertyValue::Number(7.0)), "<input checked>");
		assert_eq!(input(PropertyValue::List(Vec::new())), "<input checked>");
	}

	#[test]
	fn comments_encode_leading_and_bang_sequences() {
		// JS: `<!---&#x3E;x-->` and `<!--a--!&#x3E;b-->`.
		assert_eq!(
			to_html(&Node::Comment("->x".into()), Options::default()),
			"<!---&#x3E;x-->"
		);
		assert_eq!(
			to_html(&Node::Comment("a--!>b".into()), Options::default()),
			"<!--a--!&#x3E;b-->"
		);
		// Multi-byte characters pass through untouched: JS
		// `<!--héé💯&#x3C;!--->`.
		assert_eq!(
			to_html(&Node::Comment("héé💯<!-".into()), Options::default()),
			"<!--héé💯&#x3C;!--->"
		);
	}
}

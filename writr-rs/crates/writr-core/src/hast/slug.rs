//! Port of rehype-slug@6.0.0 (default options: no prefix).

use super::{Node, PropertyValue};
use crate::slugger::Slugger;

/// hast-util-to-string@3: concatenated text values of a node's descendants.
pub fn to_string(node: &Node) -> String {
	let mut result = String::new();
	collect(node, true, &mut result);
	result
}

fn collect(node: &Node, top_level: bool, out: &mut String) {
	match node {
		Node::Text(value) => out.push_str(value),
		Node::Element(element) => {
			for child in &element.children {
				collect(child, false, out);
			}
		}
		Node::Root(children) => {
			for child in children {
				collect(child, false, out);
			}
		}
		// At the top level, `toString` returns any node's `value`; nested,
		// only text counts.
		Node::Comment(value) | Node::Raw(value) => {
			if top_level {
				out.push_str(value);
			}
		}
		Node::Doctype => {}
	}
}

/// `h1`–`h6` rank check (hast-util-heading-rank).
fn is_heading(tag_name: &str) -> bool {
	let bytes = tag_name.as_bytes();
	bytes.len() == 2 && (bytes[0] == b'h' || bytes[0] == b'H') && (b'1'..=b'6').contains(&bytes[1])
}

/// Add `id`s to headings that lack one.
pub fn transform(tree: &mut Node) {
	let mut slugger = Slugger::new();
	visit(tree, &mut slugger);
}

fn visit(node: &mut Node, slugger: &mut Slugger) {
	match node {
		Node::Element(element) => {
			if is_heading(&element.tag_name) && !has_truthy_id(element) {
				let value = {
					let mut out = String::new();
					for child in &element.children {
						collect(child, false, &mut out);
					}
					out
				};
				let slug = slugger.slug(&value);
				element
					.properties
					.push(("id".into(), PropertyValue::String(slug)));
			}
			for child in &mut element.children {
				visit(child, slugger);
			}
			if let Some(content) = &mut element.template_content {
				for child in content {
					visit(child, slugger);
				}
			}
		}
		Node::Root(children) => {
			for child in children {
				visit(child, slugger);
			}
		}
		_ => {}
	}
}

/// `!node.properties.id` — JS falsiness: absent, empty string, `false`,
/// `0`/`NaN` are all "no id".
fn has_truthy_id(element: &super::Element) -> bool {
	match element.property("id") {
		None => false,
		Some(PropertyValue::String(s)) => !s.is_empty(),
		Some(PropertyValue::Bool(b)) => *b,
		Some(PropertyValue::Number(n)) => *n != 0.0 && !n.is_nan(),
		Some(PropertyValue::List(_)) => true,
	}
}

#[cfg(test)]
mod tests {
	use super::super::Element;
	use super::*;

	#[test]
	fn slugs_headings_and_dedupes() {
		let mut tree = Node::Root(vec![
			Node::Element(Element::with_children(
				"h1",
				vec![Node::text("Hello World")],
			)),
			Node::Element(Element::with_children("h2", vec![Node::text("Duplicate")])),
			Node::Element(Element::with_children("h2", vec![Node::text("Duplicate")])),
			Node::Element(Element::with_children(
				"p",
				vec![Node::text("not a heading")],
			)),
		]);
		transform(&mut tree);
		let Node::Root(children) = &tree else {
			unreachable!()
		};
		let id = |index: usize| -> Option<&PropertyValue> {
			let Node::Element(el) = &children[index] else {
				unreachable!()
			};
			el.property("id")
		};
		assert_eq!(id(0), Some(&PropertyValue::String("hello-world".into())));
		assert_eq!(id(1), Some(&PropertyValue::String("duplicate".into())));
		assert_eq!(id(2), Some(&PropertyValue::String("duplicate-1".into())));
		assert_eq!(id(3), None);
	}

	#[test]
	fn existing_ids_are_kept() {
		let mut heading = Element::with_children("h1", vec![Node::text("Kept")]);
		heading.push_property("id", "custom");
		let mut tree = Node::Root(vec![Node::Element(heading)]);
		transform(&mut tree);
		let Node::Root(children) = &tree else {
			unreachable!()
		};
		let Node::Element(el) = &children[0] else {
			unreachable!()
		};
		assert_eq!(
			el.property("id"),
			Some(&PropertyValue::String("custom".into()))
		);
	}

	#[test]
	fn to_string_matches_hast_util_to_string() {
		// hast-util-to-string@3: at the top level any node's `value` counts;
		// nested, only text values do.
		assert_eq!(to_string(&Node::text("plain")), "plain");
		assert_eq!(
			to_string(&Node::Comment("top comment".into())),
			"top comment"
		);
		assert_eq!(to_string(&Node::Raw("<raw>".into())), "<raw>");
		assert_eq!(to_string(&Node::Doctype), "");

		let tree = Node::Root(vec![
			Node::Element(Element::with_children(
				"p",
				vec![
					Node::text("a"),
					Node::Comment("nested comment".into()),
					Node::Element(Element::with_children("b", vec![Node::text("b")])),
				],
			)),
			Node::Doctype,
			Node::text("c"),
		]);
		assert_eq!(to_string(&tree), "abc");
	}

	#[test]
	fn id_truthiness_follows_js() {
		// rehype-slug's guard is `!node.properties.id` — JS truthiness.
		let with_id = |value: PropertyValue| {
			let mut element = Element::new("h1");
			element.properties.push(("id".to_string(), value));
			element
		};
		assert!(!has_truthy_id(&Element::new("h1")));
		assert!(!has_truthy_id(&with_id(PropertyValue::String(
			String::new()
		))));
		assert!(has_truthy_id(&with_id(PropertyValue::String("x".into()))));
		assert!(!has_truthy_id(&with_id(PropertyValue::Bool(false))));
		assert!(has_truthy_id(&with_id(PropertyValue::Bool(true))));
		assert!(!has_truthy_id(&with_id(PropertyValue::Number(0.0))));
		assert!(!has_truthy_id(&with_id(PropertyValue::Number(f64::NAN))));
		assert!(has_truthy_id(&with_id(PropertyValue::Number(3.0))));
		assert!(has_truthy_id(&with_id(PropertyValue::List(Vec::new()))));
	}
}

//! mdast-stage transforms (the remark plugins writr registers between
//! parse and mdast→hast conversion), in writr's registration order:
//! alerts (folded into conversion) → toc → emoji.

pub mod emoji;
pub mod gfm_autolink;
pub mod toc;

use markdown::mdast;

/// Port of mdast-util-to-string@4.0.0.
pub fn to_string(node: &mdast::Node, include_image_alt: bool) -> String {
	let mut result = String::new();
	one(node, include_image_alt, &mut result);
	result
}

fn one(node: &mdast::Node, include_image_alt: bool, out: &mut String) {
	// `'value' in node` first…
	if let Some(value) = node_value(node) {
		out.push_str(value);
		return;
	}
	// …then `'alt' in node && node.alt`…
	match node {
		mdast::Node::Image(image) => {
			if !image.alt.is_empty() {
				if include_image_alt {
					out.push_str(&image.alt);
				}
				return;
			}
		}
		mdast::Node::ImageReference(reference) => {
			if !reference.alt.is_empty() {
				if include_image_alt {
					out.push_str(&reference.alt);
				}
				return;
			}
		}
		_ => {}
	}
	// …then children.
	if let Some(children) = node.children() {
		for child in children {
			one(child, include_image_alt, out);
		}
	}
}

/// The `value` field of value-carrying mdast nodes.
fn node_value(node: &mdast::Node) -> Option<&str> {
	match node {
		mdast::Node::Text(n) => Some(&n.value),
		mdast::Node::InlineCode(n) => Some(&n.value),
		mdast::Node::Code(n) => Some(&n.value),
		mdast::Node::Html(n) => Some(&n.value),
		mdast::Node::Math(n) => Some(&n.value),
		mdast::Node::InlineMath(n) => Some(&n.value),
		mdast::Node::Yaml(n) => Some(&n.value),
		mdast::Node::Toml(n) => Some(&n.value),
		mdast::Node::MdxFlowExpression(n) => Some(&n.value),
		mdast::Node::MdxTextExpression(n) => Some(&n.value),
		mdast::Node::MdxjsEsm(n) => Some(&n.value),
		_ => None,
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	fn text(value: &str) -> mdast::Node {
		mdast::Node::Text(mdast::Text {
			value: value.into(),
			position: None,
		})
	}

	// Expectations mirror mdast-util-to-string@4.0.0: `node.value` first,
	// then `node.alt` (only when `includeImageAlt`), then children.

	#[test]
	fn image_alt_respects_include_image_alt() {
		let image = mdast::Node::Image(mdast::Image {
			position: None,
			alt: "ALT".into(),
			url: "u".into(),
			title: None,
		});
		assert_eq!(to_string(&image, true), "ALT");
		assert_eq!(to_string(&image, false), "");

		let reference = mdast::Node::ImageReference(mdast::ImageReference {
			position: None,
			alt: "REF".into(),
			reference_kind: mdast::ReferenceKind::Shortcut,
			identifier: "r".into(),
			label: None,
		});
		assert_eq!(to_string(&reference, true), "REF");
		assert_eq!(to_string(&reference, false), "");

		// An empty alt falls through to children (images have none).
		let empty_alt = mdast::Node::Image(mdast::Image {
			position: None,
			alt: String::new(),
			url: "u".into(),
			title: None,
		});
		assert_eq!(to_string(&empty_alt, true), "");
		let empty_ref = mdast::Node::ImageReference(mdast::ImageReference {
			position: None,
			alt: String::new(),
			reference_kind: mdast::ReferenceKind::Shortcut,
			identifier: "e".into(),
			label: None,
		});
		assert_eq!(to_string(&empty_ref, true), "");
	}

	#[test]
	fn value_carrying_nodes_use_their_value() {
		let cases: Vec<(mdast::Node, &str)> = vec![
			(text("plain"), "plain"),
			(
				mdast::Node::InlineCode(mdast::InlineCode {
					value: "code".into(),
					position: None,
				}),
				"code",
			),
			(
				mdast::Node::Code(mdast::Code {
					value: "block".into(),
					position: None,
					lang: None,
					meta: None,
				}),
				"block",
			),
			(
				mdast::Node::Html(mdast::Html {
					value: "<i>".into(),
					position: None,
				}),
				"<i>",
			),
			(
				mdast::Node::Math(mdast::Math {
					value: "x^2".into(),
					position: None,
					meta: None,
				}),
				"x^2",
			),
			(
				mdast::Node::InlineMath(mdast::InlineMath {
					value: "y".into(),
					position: None,
				}),
				"y",
			),
			(
				mdast::Node::Yaml(mdast::Yaml {
					value: "a: 1".into(),
					position: None,
				}),
				"a: 1",
			),
			(
				mdast::Node::Toml(mdast::Toml {
					value: "b = 2".into(),
					position: None,
				}),
				"b = 2",
			),
			(
				mdast::Node::MdxFlowExpression(mdast::MdxFlowExpression {
					value: "1 + 1".into(),
					position: None,
					stops: Vec::new(),
				}),
				"1 + 1",
			),
			(
				mdast::Node::MdxTextExpression(mdast::MdxTextExpression {
					value: "2".into(),
					position: None,
					stops: Vec::new(),
				}),
				"2",
			),
			(
				mdast::Node::MdxjsEsm(mdast::MdxjsEsm {
					value: "import 'x'".into(),
					position: None,
					stops: Vec::new(),
				}),
				"import 'x'",
			),
		];
		for (node, expected) in cases {
			assert_eq!(to_string(&node, false), expected);
		}
	}

	#[test]
	fn containers_concatenate_children() {
		let heading = mdast::Node::Heading(mdast::Heading {
			children: vec![
				text("a "),
				mdast::Node::Emphasis(mdast::Emphasis {
					children: vec![text("b")],
					position: None,
				}),
				mdast::Node::Image(mdast::Image {
					position: None,
					alt: "skipped".into(),
					url: "u".into(),
					title: None,
				}),
			],
			position: None,
			depth: 1,
		});
		assert_eq!(to_string(&heading, false), "a b");
		assert_eq!(to_string(&heading, true), "a bskipped");

		// Childless, valueless nodes stringify to "".
		let brk = mdast::Node::ThematicBreak(mdast::ThematicBreak { position: None });
		assert_eq!(to_string(&brk, true), "");
	}
}

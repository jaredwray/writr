//! mdast-stage transforms (the remark plugins writr registers between
//! parse and mdast→hast conversion), in writr's registration order:
//! alerts (folded into conversion) → toc → emoji.

pub mod emoji;
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

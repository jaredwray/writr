//! Port of remark-emoji@5.0.2 with default options (`padSpaceAfter: false`,
//! `emoticon: false`, `accessible: false`) over mdast-util-find-and-replace's
//! exec/splice semantics.

use crate::generated::emoji_table::EMOJI_BY_NAME;
use markdown::mdast;

/// node-emoji's `get(name)` (colons already stripped by the caller).
fn emoji_for(name: &str) -> Option<&'static str> {
	EMOJI_BY_NAME
		.binary_search_by(|(key, _)| (*key).cmp(name))
		.ok()
		.map(|index| EMOJI_BY_NAME[index].1)
}

/// One regex match of `/:\+1:|:-1:|:[\w-]+:/g` at byte offset `start`.
struct Match {
	start: usize,
	end: usize,
}

/// Find the leftmost match at or after `from` (byte offset).
fn find_match(value: &str, from: usize) -> Option<Match> {
	let bytes = value.as_bytes();
	let mut position = from;
	while position < bytes.len() {
		if bytes[position] != b':' {
			position += 1;
			continue;
		}
		let rest = &bytes[position + 1..];
		// `:\+1:` / `:-1:`
		if rest.starts_with(b"+1:") || rest.starts_with(b"-1:") {
			return Some(Match {
				start: position,
				end: position + 4,
			});
		}
		// `:[\w-]+:` — JS `\w` is `[A-Za-z0-9_]`.
		let mut length = 0;
		while length < rest.len()
			&& (rest[length].is_ascii_alphanumeric()
				|| rest[length] == b'_'
				|| rest[length] == b'-')
		{
			length += 1;
		}
		if length > 0 && rest.get(length) == Some(&b':') {
			return Some(Match {
				start: position,
				end: position + 1 + length + 1,
			});
		}
		position += 1;
	}
	None
}

/// Run find-and-replace over one text value. Returns the replacement node
/// values when anything matched (`None` → text unchanged).
fn replace_in_text(value: &str) -> Option<Vec<mdast::Node>> {
	let mut nodes: Vec<mdast::Node> = Vec::new();
	let mut start = 0usize;
	let mut changed = false;
	let mut last_index = 0usize;

	while let Some(m) = find_match(value, last_index) {
		let name = &value[m.start + 1..m.end - 1];
		match emoji_for(name) {
			Some(emoji) => {
				if start != m.start {
					nodes.push(text(&value[start..m.start]));
				}
				nodes.push(text(emoji));
				start = m.end;
				changed = true;
				last_index = m.end;
			}
			None => {
				// `false` from the replacer: act as if there was no match and
				// resume scanning right after the match's first character.
				last_index = m.start + 1;
			}
		}
	}

	if !changed {
		return None;
	}
	if start < value.len() {
		nodes.push(text(&value[start..]));
	}
	Some(nodes)
}

fn text(value: &str) -> mdast::Node {
	mdast::Node::Text(mdast::Text {
		value: value.to_string(),
		position: None,
	})
}

/// Apply the emoji transform to a tree (mutating, like the JS plugin).
pub fn transform(tree: &mut mdast::Node) {
	let Some(children) = tree.children_mut() else {
		return;
	};
	let mut index = 0;
	while index < children.len() {
		if let mdast::Node::Text(node) = &children[index] {
			if let Some(replacement) = replace_in_text(&node.value) {
				let count = replacement.len();
				children.splice(index..=index, replacement);
				// visitParents receives `index + nodes.length` — continue
				// after the inserted nodes.
				index += count;
				continue;
			}
		}
		transform(&mut children[index]);
		index += 1;
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	fn replaced(value: &str) -> Option<Vec<String>> {
		replace_in_text(value).map(|nodes| {
			nodes
				.into_iter()
				.map(|node| match node {
					mdast::Node::Text(text) => text.value,
					_ => unreachable!(),
				})
				.collect()
		})
	}

	#[test]
	fn replaces_known_shortcodes() {
		assert_eq!(
			replaced("A :dog: and :+1: here"),
			Some(vec![
				"A ".into(),
				"🐶".into(),
				" and ".into(),
				"👍".into(),
				" here".into()
			])
		);
	}

	#[test]
	fn unknown_shortcodes_stay() {
		assert_eq!(replaced(":not-a-real-emoji:"), None);
		assert_eq!(replaced("plain text"), None);
	}

	#[test]
	fn false_match_rescans_overlapping() {
		// `:zz:` is unknown → the scanner resumes at position 1, so the
		// overlapping `:dog:` (sharing the middle colon) is found.
		assert_eq!(
			replaced(":zz:dog: :-1:"),
			Some(vec![":zz".into(), "🐶".into(), " ".into(), "👎".into()])
		);
		// `:x:` IS an emoji (❌) — the shared colon is consumed, so the
		// remainder no longer forms a shortcode.
		assert_eq!(replaced(":x:dog:"), Some(vec!["❌".into(), "dog:".into()]));
	}

	#[test]
	fn adjacent_shortcodes() {
		assert_eq!(replaced(":dog::cat:"), Some(vec!["🐶".into(), "🐱".into()]));
	}
}

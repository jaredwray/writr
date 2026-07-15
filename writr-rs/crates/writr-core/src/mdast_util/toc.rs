//! Port of remark-toc@9.0.0 over mdast-util-toc@7.1.0 with writr's
//! configuration (all defaults): heading `(table[ -]of[ -])?contents?|toc`,
//! `tight: true`, no maxDepth/minDepth/skip/prefix/parents.

use super::to_string;
use crate::slugger::Slugger;
use markdown::mdast;

/// A heading recorded for the contents list.
struct SearchEntry {
	depth: usize,
	children: Vec<mdast::Node>,
	id: String,
}

struct Search {
	/// Root-children index right after the opening heading.
	index: Option<usize>,
	/// Root-children index of the closing heading.
	end_index: Option<usize>,
	opening_depth: Option<u8>,
	map: Vec<SearchEntry>,
	slugger: Slugger,
}

/// `^((table[ -]of[ -])?contents?|toc)$/i` against the heading's text.
fn heading_matches(value: &str) -> bool {
	if value.eq_ignore_ascii_case("toc") {
		return true;
	}
	let mut rest = value;
	// Optional `table[ -]of[ -]` prefix.
	if rest.len() >= 9 && rest.as_bytes()[..5].eq_ignore_ascii_case(b"table") {
		let bytes = rest.as_bytes();
		if matches!(bytes[5], b' ' | b'-')
			&& bytes[6..8].eq_ignore_ascii_case(b"of")
			&& matches!(bytes[8], b' ' | b'-')
		{
			rest = &rest[9..];
		}
	}
	rest.eq_ignore_ascii_case("content") || rest.eq_ignore_ascii_case("contents")
}

/// Apply the toc transform (mutating the root's children on a match).
pub fn transform(tree: &mut mdast::Node) {
	let mdast::Node::Root(root) = tree else {
		return;
	};

	let mut search = Search {
		index: None,
		end_index: None,
		opening_depth: None,
		map: Vec::new(),
		slugger: Slugger::new(),
	};

	// Visit all headings in tree order; only top-level ones (children of the
	// root) can open/close the section or enter the map, but *every* heading
	// advances the slugger (duplicate counters are shared).
	for (position, child) in root.children.iter().enumerate() {
		visit_headings(child, Some(position), &mut search);
	}

	let (Some(index), Some(_)) = (search.index, search.opening_depth) else {
		return;
	};
	if search.map.is_empty() {
		return;
	}
	let end_index = search.end_index.unwrap_or(root.children.len());
	let list = contents(search.map);

	root.children.splice(index..end_index, [list]);
}

fn visit_headings(node: &mdast::Node, root_position: Option<usize>, search: &mut Search) {
	if let mdast::Node::Heading(heading) = node {
		let value = to_string(node, false);
		let slug = search.slugger.slug(&value);

		// Only top-level headings participate beyond slugging.
		if let Some(position) = root_position {
			if search.index.is_none() && heading_matches(&value) {
				search.index = Some(position + 1);
				search.opening_depth = Some(heading.depth);
				return;
			}

			if let Some(opening_depth) = search.opening_depth {
				if search.end_index.is_none() && heading.depth <= opening_depth {
					search.end_index = Some(position);
				}
			}

			if search.end_index.is_some() {
				search.map.push(SearchEntry {
					depth: usize::from(heading.depth),
					children: heading.children.clone(),
					id: slug,
				});
			}
		}
		return;
	}

	if let Some(children) = node.children() {
		for child in children {
			// Nested headings: slugged, never mapped.
			visit_headings(child, None, search);
		}
	}
}

/// `contents()`: build the (tight) nested list.
fn contents(mut map: Vec<SearchEntry>) -> mdast::Node {
	let min_depth = map.iter().map(|entry| entry.depth).min().unwrap_or(1);
	for entry in &mut map {
		entry.depth -= min_depth - 1;
	}

	let mut table = new_list();
	for entry in map {
		let children = clone_inline(&entry.children);
		insert_into_list(&mut table, entry.depth, entry.id, children);
	}
	mdast::Node::List(table)
}

fn new_list() -> mdast::List {
	mdast::List {
		children: Vec::new(),
		position: None,
		ordered: false,
		start: None,
		spread: false,
	}
}

fn new_list_item() -> mdast::ListItem {
	mdast::ListItem {
		children: Vec::new(),
		position: None,
		spread: false,
		checked: None,
	}
}

/// `insert()` for lists (tight mode keeps every spread false, which the
/// constructors above already guarantee).
fn insert_into_list(list: &mut mdast::List, depth: usize, id: String, children: Vec<mdast::Node>) {
	if depth == 1 {
		let link = mdast::Node::Link(mdast::Link {
			children,
			position: None,
			url: format!("#{id}"),
			title: None,
		});
		let paragraph = mdast::Node::Paragraph(mdast::Paragraph {
			children: vec![link],
			position: None,
		});
		let mut item = new_list_item();
		item.children.push(paragraph);
		list.children.push(mdast::Node::ListItem(item));
	} else if let Some(mdast::Node::ListItem(tail)) = list.children.last_mut() {
		insert_into_item(tail, depth, id, children);
	} else {
		let mut item = new_list_item();
		insert_into_item(&mut item, depth, id, children);
		list.children.push(mdast::Node::ListItem(item));
	}
}

/// `insert()` for list items: descend into a trailing list, creating one
/// when needed (depth decreases by one either way).
fn insert_into_item(item: &mut mdast::ListItem, depth: usize, id: String, children: Vec<mdast::Node>) {
	if let Some(mdast::Node::List(tail)) = item.children.last_mut() {
		insert_into_list(tail, depth - 1, id, children);
	} else {
		let mut list = new_list();
		insert_into_list(&mut list, depth - 1, id, children);
		item.children.push(mdast::Node::List(list));
	}
}

/// `all()/one()` over heading children: drop footnote references, unwrap
/// links and link references, deep-clone everything else.
fn clone_inline(nodes: &[mdast::Node]) -> Vec<mdast::Node> {
	let mut results = Vec::with_capacity(nodes.len());
	for node in nodes {
		match node {
			mdast::Node::FootnoteReference(_) => {}
			mdast::Node::Link(link) => results.extend(clone_inline(&link.children)),
			mdast::Node::LinkReference(reference) => {
				results.extend(clone_inline(&reference.children));
			}
			other => {
				let mut clone = other.clone();
				if let Some(children) = clone.children_mut() {
					*children = clone_inline(other.children().expect("same node kind"));
				}
				results.push(clone);
			}
		}
	}
	results
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn heading_expression_matches() {
		for value in [
			"toc", "TOC", "Toc", "contents", "Contents", "content",
			"Table of Contents", "table-of-contents", "Table of-Content",
			"TABLE-OF CONTENTS",
		] {
			assert!(heading_matches(value), "{value} should match");
		}
		for value in ["toc!", " toc", "the contents", "table of stuff", "tocx", "table ofcontents"] {
			assert!(!heading_matches(value), "{value} should not match");
		}
	}
}

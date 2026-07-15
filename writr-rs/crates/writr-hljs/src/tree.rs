//! Output token tree + the lowlight `HastEmitter` port.
//!
//! lowlight configures highlight.js with a custom emitter that builds hast
//! directly; scope→class conversion happens here (first dot-piece gets the
//! `hljs-` prefix, later pieces get `_` suffixes per depth).

/// A highlighted token tree node (maps 1:1 to hast in writr-core).
#[derive(Debug, Clone, PartialEq)]
pub enum HlNode {
	Text(String),
	Span {
		class_names: Vec<String>,
		children: Vec<HlNode>,
	},
}

/// Port of lowlight's `HastEmitter` (prefix is always `hljs-` for writr).
pub struct Emitter {
	prefix: String,
	root: Vec<HlNode>,
	/// Stack of open spans as index paths into `root`.
	stack: Vec<usize>,
}

impl Emitter {
	pub fn new(prefix: &str) -> Self {
		Self {
			prefix: prefix.to_string(),
			root: Vec::new(),
			stack: Vec::new(),
		}
	}

	fn current(&mut self) -> &mut Vec<HlNode> {
		let mut children = &mut self.root;
		for &index in &self.stack {
			match &mut children[index] {
				HlNode::Span {
					children: inner, ..
				} => children = inner,
				HlNode::Text(_) => unreachable!("stack points at spans"),
			}
		}
		children
	}

	/// `addText`: merge with a trailing text sibling.
	pub fn add_text(&mut self, value: &str) {
		if value.is_empty() {
			return;
		}
		let children = self.current();
		if let Some(HlNode::Text(tail)) = children.last_mut() {
			tail.push_str(value);
		} else {
			children.push(HlNode::Text(value.to_string()));
		}
	}

	/// `openNode`: scope name → class list.
	pub fn open_node(&mut self, name: &str) {
		let class_names: Vec<String> = name
			.split('.')
			.enumerate()
			.map(|(index, piece)| {
				if index == 0 {
					format!("{}{piece}", self.prefix)
				} else {
					format!("{piece}{}", "_".repeat(index))
				}
			})
			.collect();
		let children = self.current();
		children.push(HlNode::Span {
			class_names,
			children: Vec::new(),
		});
		let index = children.len() - 1;
		self.stack.push(index);
	}

	pub fn close_node(&mut self) {
		self.stack.pop();
	}

	/// `startScope`/`endScope` are aliases used by `emitKeyword`.
	pub fn start_scope(&mut self, name: &str) {
		self.open_node(name);
	}

	pub fn end_scope(&mut self) {
		self.close_node();
	}

	/// `__addSublanguage`: splice another highlight run's root, optionally
	/// wrapped in a span whose class is the sub-language name (lowlight
	/// semantics — note: no `language-` prefix).
	pub fn add_sublanguage(&mut self, results: Vec<HlNode>, name: Option<&str>) {
		let children = self.current();
		match name {
			Some(name) if !name.is_empty() => children.push(HlNode::Span {
				class_names: vec![name.to_string()],
				children: results,
			}),
			_ => children.extend(results),
		}
	}

	pub fn finish(self) -> Vec<HlNode> {
		self.root
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn scope_class_conversion() {
		let mut emitter = Emitter::new("hljs-");
		emitter.open_node("title.function_");
		emitter.add_text("greet");
		emitter.close_node();
		assert_eq!(
			emitter.finish(),
			vec![HlNode::Span {
				class_names: vec!["hljs-title".into(), "function__".into()],
				children: vec![HlNode::Text("greet".into())],
			}]
		);
	}

	#[test]
	fn text_merging() {
		let mut emitter = Emitter::new("hljs-");
		emitter.add_text("a");
		emitter.add_text("b");
		emitter.open_node("keyword");
		emitter.add_text("if");
		emitter.close_node();
		emitter.add_text("");
		assert_eq!(
			emitter.finish(),
			vec![
				HlNode::Text("ab".into()),
				HlNode::Span {
					class_names: vec!["hljs-keyword".into()],
					children: vec![HlNode::Text("if".into())],
				},
			]
		);
	}
}

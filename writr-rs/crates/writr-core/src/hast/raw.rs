//! Port of rehype-raw@7.0.0 / hast-util-raw@9.1.0 over html5ever.
//!
//! The JS utility replays the hast tree through parse5's tree builder —
//! synthesizing start/end/character/comment tokens for existing nodes — and
//! feeds `raw` node values through the real tokenizer *in context*, so
//! unclosed tags inside raw HTML interact correctly with surrounding markup.
//! The resulting DOM is converted back to hast (hast-util-from-parse5@8 +
//! hastscript property parsing).
//!
//! html5ever is the WHATWG-spec sibling of parse5. Structural differences of
//! this port (all in pathological-input territory, validated against the 484
//! rawhtml goldens):
//!
//! - parse5's tokenizer survives across raw chunks with partial-token state;
//!   here each raw chunk gets a fresh tokenizer seeded with the tracked
//!   state + last start-tag name. A tag *spanning* two adjacent raw nodes
//!   (no other node between) is therefore not stitched back together.
//! - The tracked tokenizer state is inferred from tree-builder responses
//!   (`RawData`, `Plaintext`, script completion, end-tag emission), matching
//!   parse5's tree-builder-driven state switches for synthesized tags.

use super::property_info::{find, Space};
use super::{Element, Node, PropertyValue};
use crate::js;
use html5ever::interface::{
	create_element, ElemName, ElementFlags, NodeOrText, QuirksMode, TokenizerResult, TreeSink,
};
use html5ever::tendril::StrTendril;
use html5ever::tokenizer::{
	states, BufferQueue, Tag, TagKind, Token, TokenSink, TokenSinkResult, Tokenizer, TokenizerOpts,
};
use html5ever::tree_builder::{TreeBuilder, TreeBuilderOpts};
use html5ever::{ns, Attribute, LocalName, QualName};
use std::cell::{Cell, RefCell};
use std::rc::Rc;

/// html-void-elements@3.0.0 (same list the serializer uses).
const VOID_ELEMENTS: &[&str] = &[
	"area", "base", "basefont", "bgsound", "br", "col", "command", "embed", "frame", "hr", "image",
	"img", "input", "keygen", "link", "meta", "param", "source", "track", "wbr",
];

/// hastscript's case-sensitive SVG tag names.
const SVG_CASE_SENSITIVE: &[&str] = &[
	"altGlyph",
	"altGlyphDef",
	"altGlyphItem",
	"animateColor",
	"animateMotion",
	"animateTransform",
	"clipPath",
	"feBlend",
	"feColorMatrix",
	"feComponentTransfer",
	"feComposite",
	"feConvolveMatrix",
	"feDiffuseLighting",
	"feDisplacementMap",
	"feDistantLight",
	"feDropShadow",
	"feFlood",
	"feFuncA",
	"feFuncB",
	"feFuncG",
	"feFuncR",
	"feGaussianBlur",
	"feImage",
	"feMerge",
	"feMergeNode",
	"feMorphology",
	"feOffset",
	"fePointLight",
	"feSpecularLighting",
	"feSpotLight",
	"feTile",
	"feTurbulence",
	"foreignObject",
	"glyphRef",
	"linearGradient",
	"radialGradient",
	"solidColor",
	"textArea",
	"textPath",
];

/// `Object.prototype` own property names — hast-util-from-parse5 drops
/// attributes with these names (its prototype-pollution guard).
const PROTO_PROPERTY_NAMES: &[&str] = &[
	"__defineGetter__",
	"__defineSetter__",
	"__lookupGetter__",
	"__lookupSetter__",
	"__proto__",
	"constructor",
	"hasOwnProperty",
	"isPrototypeOf",
	"propertyIsEnumerable",
	"toLocaleString",
	"toString",
	"valueOf",
];

// ---------------------------------------------------------------------------
// Arena DOM sink
// ---------------------------------------------------------------------------

#[derive(Debug)]
enum ArenaNode {
	Document {
		children: Vec<usize>,
	},
	Element {
		name: QualName,
		attrs: Vec<Attribute>,
		children: Vec<usize>,
		template_contents: Option<usize>,
	},
	Text {
		value: String,
	},
	Comment {
		value: String,
	},
	Doctype,
}

#[derive(Default)]
struct Arena {
	nodes: Vec<ArenaNode>,
	/// Parent index per node (for `remove_from_parent`).
	parents: Vec<Option<usize>>,
}

impl Arena {
	fn push(&mut self, node: ArenaNode) -> usize {
		self.nodes.push(node);
		self.parents.push(None);
		self.nodes.len() - 1
	}

	fn children_mut(&mut self, handle: usize) -> &mut Vec<usize> {
		match &mut self.nodes[handle] {
			ArenaNode::Document { children } | ArenaNode::Element { children, .. } => children,
			_ => unreachable!("append target is a parent node"),
		}
	}

	fn detach(&mut self, child: usize) {
		if let Some(parent) = self.parents[child].take() {
			self.children_mut(parent).retain(|&c| c != child);
		}
	}

	fn append_child(&mut self, parent: usize, child: usize) {
		self.detach(child);
		self.children_mut(parent).push(child);
		self.parents[child] = Some(parent);
	}

	/// Append text, merging with a trailing text sibling (spec behavior).
	fn append_text(&mut self, parent: usize, text: &str) {
		if let Some(&last) = self.children_mut(parent).last() {
			if let ArenaNode::Text { value } = &mut self.nodes[last] {
				value.push_str(text);
				return;
			}
		}
		let handle = self.push(ArenaNode::Text {
			value: text.to_string(),
		});
		self.append_child(parent, handle);
	}

	fn insert_before(&mut self, sibling: usize, child: usize) {
		let parent = self.parents[sibling].expect("sibling has a parent");
		self.detach(child);
		let children = self.children_mut(parent);
		let index = children
			.iter()
			.position(|&c| c == sibling)
			.expect("sibling under parent");
		children.insert(index, child);
		self.parents[child] = Some(parent);
	}

	fn insert_text_before(&mut self, sibling: usize, text: &str) {
		let parent = self.parents[sibling].expect("sibling has a parent");
		let previous = {
			let children = self.children_mut(parent);
			let index = children
				.iter()
				.position(|&c| c == sibling)
				.expect("sibling under parent");
			if index > 0 {
				Some(children[index - 1])
			} else {
				None
			}
		};
		if let Some(previous) = previous {
			if let ArenaNode::Text { value } = &mut self.nodes[previous] {
				value.push_str(text);
				return;
			}
		}
		let handle = self.push(ArenaNode::Text {
			value: text.to_string(),
		});
		self.insert_before(sibling, handle);
	}
}

#[derive(Clone)]
struct ArenaSink {
	arena: Rc<RefCell<Arena>>,
	document: usize,
	/// Set while a pending table-text batch contains synthesized (hast text
	/// node) characters. parse5 types synthesized tokens as CHARACTER — never
	/// WHITESPACE_CHARACTER — so such batches are foster-parented out of
	/// tables even when they are pure whitespace; html5ever classifies by
	/// content, so the sink re-routes those appends to match.
	synthesized_text_pending: Rc<Cell<bool>>,
}

impl ArenaSink {
	fn new() -> Self {
		let mut arena = Arena::default();
		let document = arena.push(ArenaNode::Document {
			children: Vec::new(),
		});
		Self {
			arena: Rc::new(RefCell::new(arena)),
			document,
			synthesized_text_pending: Rc::new(Cell::new(false)),
		}
	}

	fn is_table_part(&self, handle: usize) -> bool {
		match &self.arena.borrow().nodes[handle] {
			ArenaNode::Element { name, .. } => {
				name.ns == ns!(html)
					&& matches!(
						name.local.as_ref(),
						"table" | "tbody" | "thead" | "tfoot" | "tr"
					)
			}
			_ => false,
		}
	}

	/// Foster a text append out of table context (parse5's
	/// `_findFosterParentingLocation`: before the nearest open table).
	fn foster_text_target(&self, parent: usize) -> Option<usize> {
		let arena = self.arena.borrow();
		let mut current = Some(parent);
		while let Some(handle) = current {
			if let ArenaNode::Element { name, .. } = &arena.nodes[handle] {
				if name.ns == ns!(html) && name.local.as_ref() == "table" {
					// Insertable only when the table has a parent.
					return arena.parents[handle].map(|_| handle);
				}
			}
			current = arena.parents[handle];
		}
		None
	}
}

/// Owned `ElemName` (the arena is behind a `RefCell`, so borrows cannot be
/// handed out; qualified names are atom-backed and cheap to clone).
struct OwnedName(QualName);

impl std::fmt::Debug for OwnedName {
	fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
		write!(f, "{:?}", self.0)
	}
}

impl ElemName for OwnedName {
	fn ns(&self) -> &html5ever::Namespace {
		&self.0.ns
	}

	fn local_name(&self) -> &LocalName {
		&self.0.local
	}
}

impl TreeSink for ArenaSink {
	type Handle = usize;
	type Output = Self;
	type ElemName<'a> = OwnedName;

	fn finish(self) -> Self {
		self
	}

	fn parse_error(&self, _msg: std::borrow::Cow<'static, str>) {}

	fn get_document(&self) -> usize {
		self.document
	}

	fn elem_name(&self, target: &usize) -> OwnedName {
		match &self.arena.borrow().nodes[*target] {
			ArenaNode::Element { name, .. } => OwnedName(name.clone()),
			_ => unreachable!("elem_name called on a non-element"),
		}
	}

	fn create_element(&self, name: QualName, attrs: Vec<Attribute>, flags: ElementFlags) -> usize {
		let mut arena = self.arena.borrow_mut();
		let template_contents = if flags.template {
			Some(arena.push(ArenaNode::Document {
				children: Vec::new(),
			}))
		} else {
			None
		};
		arena.push(ArenaNode::Element {
			name,
			attrs,
			children: Vec::new(),
			template_contents,
		})
	}

	fn create_comment(&self, text: StrTendril) -> usize {
		self.arena.borrow_mut().push(ArenaNode::Comment {
			value: text.to_string(),
		})
	}

	fn create_pi(&self, _target: StrTendril, data: StrTendril) -> usize {
		// Processing instructions cannot appear in HTML parsing; parse5 maps
		// bogus comments the same way html5ever does (comment tokens).
		self.arena.borrow_mut().push(ArenaNode::Comment {
			value: data.to_string(),
		})
	}

	fn append(&self, parent: &usize, child: NodeOrText<usize>) {
		if let NodeOrText::AppendText(text) = &child {
			if self.synthesized_text_pending.get() && self.is_table_part(*parent) {
				if let Some(table) = self.foster_text_target(*parent) {
					self.arena.borrow_mut().insert_text_before(table, text);
					return;
				}
			}
		}
		let mut arena = self.arena.borrow_mut();
		match child {
			NodeOrText::AppendNode(node) => arena.append_child(*parent, node),
			NodeOrText::AppendText(text) => arena.append_text(*parent, &text),
		}
	}

	fn append_based_on_parent_node(
		&self,
		element: &usize,
		prev_element: &usize,
		child: NodeOrText<usize>,
	) {
		let has_parent = self.arena.borrow().parents[*element].is_some();
		if has_parent {
			self.append_before_sibling(element, child);
		} else {
			self.append(prev_element, child);
		}
	}

	fn append_doctype_to_document(
		&self,
		_name: StrTendril,
		_public_id: StrTendril,
		_system_id: StrTendril,
	) {
		let handle = self.arena.borrow_mut().push(ArenaNode::Doctype);
		self.arena.borrow_mut().append_child(self.document, handle);
	}

	fn get_template_contents(&self, target: &usize) -> usize {
		match &self.arena.borrow().nodes[*target] {
			ArenaNode::Element {
				template_contents: Some(contents),
				..
			} => *contents,
			_ => unreachable!("get_template_contents on a non-template"),
		}
	}

	fn same_node(&self, x: &usize, y: &usize) -> bool {
		x == y
	}

	fn set_quirks_mode(&self, _mode: QuirksMode) {}

	fn append_before_sibling(&self, sibling: &usize, new_node: NodeOrText<usize>) {
		let mut arena = self.arena.borrow_mut();
		match new_node {
			NodeOrText::AppendNode(node) => arena.insert_before(*sibling, node),
			NodeOrText::AppendText(text) => arena.insert_text_before(*sibling, &text),
		}
	}

	fn add_attrs_if_missing(&self, target: &usize, new_attrs: Vec<Attribute>) {
		let mut arena = self.arena.borrow_mut();
		if let ArenaNode::Element { attrs, .. } = &mut arena.nodes[*target] {
			for attr in new_attrs {
				if !attrs.iter().any(|existing| existing.name == attr.name) {
					attrs.push(attr);
				}
			}
		}
	}

	fn remove_from_parent(&self, target: &usize) {
		self.arena.borrow_mut().detach(*target);
	}

	fn reparent_children(&self, node: &usize, new_parent: &usize) {
		let children = {
			let mut arena = self.arena.borrow_mut();
			std::mem::take(arena.children_mut(*node))
		};
		let mut arena = self.arena.borrow_mut();
		for child in children {
			arena.parents[child] = None;
			arena.append_child(*new_parent, child);
		}
	}
}

// ---------------------------------------------------------------------------
// Replay driver
// ---------------------------------------------------------------------------

type Builder = TreeBuilder<usize, ArenaSink>;

/// Delegating token sink that records tree-builder responses so the driver
/// can mirror parse5's tokenizer-state bookkeeping.
struct TrackingSink<'a> {
	builder: &'a Builder,
	state: &'a Cell<TrackedState>,
	/// Set while feeding raw text (tokenizer-driven transitions).
	from_tokenizer: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TrackedState {
	Data,
	RawData(states::RawKind),
	Plaintext,
}

impl TrackedState {
	fn to_tokenizer_state(self) -> states::State {
		match self {
			Self::Data => states::State::Data,
			Self::RawData(kind) => states::State::RawData(kind),
			Self::Plaintext => states::State::Plaintext,
		}
	}
}

impl TokenSink for TrackingSink<'_> {
	type Handle = usize;

	fn process_token(&self, token: Token, line_number: u64) -> TokenSinkResult<usize> {
		let is_end_tag = matches!(
			&token,
			Token::TagToken(tag) if tag.kind == TagKind::EndTag
		);
		let is_text = matches!(
			&token,
			Token::CharacterTokens(_) | Token::NullCharacterToken
		);
		let result = self.builder.process_token(token, line_number);
		if !is_text {
			self.builder.sink.synthesized_text_pending.set(false);
		}
		match &result {
			TokenSinkResult::RawData(kind) => self.state.set(TrackedState::RawData(*kind)),
			TokenSinkResult::Plaintext => self.state.set(TrackedState::Plaintext),
			TokenSinkResult::Script(_) => {
				if self.from_tokenizer {
					self.state.set(TrackedState::Data);
				}
			}
			TokenSinkResult::Continue => {
				// A real end tag can only be emitted from a rawtext state by
				// exiting it (appropriate end tag) — the tokenizer is back in
				// Data.
				if self.from_tokenizer
					&& is_end_tag && matches!(self.state.get(), TrackedState::RawData(_))
				{
					self.state.set(TrackedState::Data);
				}
			}
			_ => {}
		}
		result
	}
}

struct Driver {
	builder: Builder,
	state: Cell<TrackedState>,
	last_start_tag: RefCell<Option<String>>,
	/// Approximation of parse5's `inForeignNode` for synthesized tags.
	foreign_depth: Cell<usize>,
}

impl Driver {
	fn new() -> Self {
		let sink = ArenaSink::new();
		// parse5's default fragment context is a `<template>` element.
		let context = create_element(
			&sink,
			QualName::new(None, ns!(html), LocalName::from("template")),
			Vec::new(),
		);
		let builder = TreeBuilder::new_for_fragment(
			sink,
			context,
			None,
			TreeBuilderOpts {
				scripting_enabled: false,
				..TreeBuilderOpts::default()
			},
		);
		Self {
			builder,
			state: Cell::new(TrackedState::Data),
			last_start_tag: RefCell::new(None),
			foreign_depth: Cell::new(0),
		}
	}

	/// Send a synthesized token straight to the tree builder (parse5's
	/// `parser._processToken`), applying start-tag state switches.
	fn process_synthesized(&self, token: Token, apply_state: bool) {
		let is_end_tag = matches!(
			&token,
			Token::TagToken(tag) if tag.kind == TagKind::EndTag
		);
		let is_text = matches!(
			&token,
			Token::CharacterTokens(_) | Token::NullCharacterToken
		);
		if is_text {
			self.builder.sink.synthesized_text_pending.set(true);
		}
		let result = self.builder.process_token(token, 0);
		if !is_text {
			// A non-character token flushes any pending table text during
			// its own processing (above); the batch is over afterwards.
			self.builder.sink.synthesized_text_pending.set(false);
		}
		if apply_state && !is_end_tag {
			match result {
				TokenSinkResult::RawData(kind) => {
					self.state.set(TrackedState::RawData(kind));
				}
				TokenSinkResult::Plaintext => self.state.set(TrackedState::Plaintext),
				_ => {}
			}
		}
	}

	fn handle(&self, node: &Node) {
		match node {
			Node::Root(children) => {
				for child in children {
					self.handle(child);
				}
			}
			Node::Element(element) => self.element(element),
			Node::Text(value) => self.text(value),
			Node::Comment(value) => {
				self.process_synthesized(Token::CommentToken(StrTendril::from_slice(value)), false);
			}
			Node::Doctype => {
				self.process_synthesized(
					Token::DoctypeToken(html5ever::tokenizer::Doctype {
						name: Some(StrTendril::from_slice("html")),
						public_id: None,
						system_id: None,
						force_quirks: false,
					}),
					false,
				);
			}
			Node::Raw(value) => self.raw(value),
		}
	}

	fn element(&self, element: &Element) {
		let tag_name = element.tag_name.to_lowercase();
		let plaintext = self.state.get() == TrackedState::Plaintext;

		// Start tag (ignored in plain text).
		if !plaintext {
			let foreign = self.foreign_depth.get() > 0;
			let svg_space = foreign || tag_name == "svg";
			if tag_name == "svg" || tag_name == "math" || foreign {
				self.foreign_depth.set(self.foreign_depth.get() + 1);
			}
			let attrs = properties_to_attrs(
				&element.properties,
				if svg_space { Space::Svg } else { Space::Html },
			);
			self.process_synthesized(
				Token::TagToken(Tag {
					kind: TagKind::StartTag,
					name: LocalName::from(tag_name.as_str()),
					self_closing: false,
					attrs,
					had_duplicate_attributes: false,
				}),
				true,
			);
			*self.last_start_tag.borrow_mut() = Some(tag_name.clone());
		}

		for child in &element.children {
			self.handle(child);
		}
		if let Some(content) = &element.template_content {
			for child in content {
				self.handle(child);
			}
		}

		// End tag: skipped for void elements outside foreign content, and in
		// plain text.
		let in_foreign = self.foreign_depth.get() > 0;
		if in_foreign && (tag_name == "svg" || tag_name == "math" || self.foreign_depth.get() > 1) {
			self.foreign_depth.set(self.foreign_depth.get() - 1);
		}
		if !in_foreign && VOID_ELEMENTS.contains(&tag_name.as_str()) {
			return;
		}
		if self.state.get() == TrackedState::Plaintext {
			return;
		}
		self.process_synthesized(
			Token::TagToken(Tag {
				kind: TagKind::EndTag,
				name: LocalName::from(tag_name.as_str()),
				self_closing: false,
				attrs: Vec::new(),
				had_duplicate_attributes: false,
			}),
			false,
		);
	}

	fn text(&self, value: &str) {
		// (parse5 resets mid-tag tokenizer states here; the tracked state
		// only ever holds content states, so no reset is needed.)
		self.process_synthesized(Token::CharacterTokens(StrTendril::from_slice(value)), false);
	}

	fn raw(&self, value: &str) {
		let queue = BufferQueue::default();
		queue.push_back(StrTendril::from_slice(value));
		let tokenizer = Tokenizer::new(
			TrackingSink {
				builder: &self.builder,
				state: &self.state,
				from_tokenizer: true,
			},
			TokenizerOpts {
				initial_state: Some(self.state.get().to_tokenizer_state()),
				last_start_tag_name: self.last_start_tag.borrow().clone(),
				..TokenizerOpts::default()
			},
		);
		// Keep going past script completions (scripting is disabled; parse5's
		// loop does not pause either).
		while let TokenizerResult::Script(_) = tokenizer.feed(&queue) {
			// Keep feeding; scripting is disabled, nothing to run.
		}
	}

	fn into_fragment(self) -> (ArenaSink, Vec<usize>) {
		// Per the fragment-parsing algorithm the tree builder creates a root
		// `<html>` element under the document and appends all output there
		// (parse5's `getFragment()` likewise adopts that root's children).
		let sink = self.builder.sink;
		let children = {
			let arena = sink.arena.borrow();
			let ArenaNode::Document { children } = &arena.nodes[sink.document] else {
				unreachable!("document handle is a document");
			};
			children
				.iter()
				.copied()
				.find_map(|child| match &arena.nodes[child] {
					ArenaNode::Element { name, children, .. } if name.local.as_ref() == "html" => {
						Some(children.clone())
					}
					_ => None,
				})
				.unwrap_or_default()
		};
		(sink, children)
	}
}

// ---------------------------------------------------------------------------
// hast properties → token attributes (hast-util-to-parse5 subset)
// ---------------------------------------------------------------------------

fn properties_to_attrs(properties: &[(String, PropertyValue)], space: Space) -> Vec<Attribute> {
	let mut attrs = Vec::with_capacity(properties.len());
	for (key, value) in properties {
		let info = find(space, key);
		let string_value = match value {
			PropertyValue::Bool(false) => continue,
			PropertyValue::Number(n) if n.is_nan() => continue,
			PropertyValue::Bool(true) => String::new(),
			PropertyValue::Number(n) => js::number_to_string(*n),
			PropertyValue::String(s) => s.clone(),
			PropertyValue::List(items) => {
				if info.comma_separated() {
					let mut list: Vec<&str> = items.iter().map(String::as_str).collect();
					if list.last() == Some(&"") {
						list.push("");
					}
					list.join(", ")
				} else {
					js::trim(&items.join(" ")).to_string()
				}
			}
		};
		attrs.push(Attribute {
			name: QualName::new(None, ns!(), LocalName::from(info.attribute.as_ref())),
			value: StrTendril::from_slice(&string_value),
		});
	}
	attrs
}

// ---------------------------------------------------------------------------
// Arena → hast (hast-util-from-parse5 + hastscript)
// ---------------------------------------------------------------------------

fn convert_children(arena: &Arena, handles: &[usize]) -> Vec<Node> {
	handles
		.iter()
		.map(|&handle| convert(arena, handle))
		.collect()
}

fn convert(arena: &Arena, handle: usize) -> Node {
	match &arena.nodes[handle] {
		ArenaNode::Document { children } => Node::Root(convert_children(arena, children)),
		ArenaNode::Text { value } => Node::Text(value.clone()),
		ArenaNode::Comment { value } => Node::Comment(value.clone()),
		ArenaNode::Doctype => Node::Doctype,
		ArenaNode::Element {
			name,
			attrs,
			children,
			template_contents,
		} => {
			let svg = name.ns == ns!(svg);
			let space = if svg { Space::Svg } else { Space::Html };

			// hastscript normalizes the tag name: lowercase, then adjust
			// case-sensitive SVG names.
			let mut tag_name = name.local.to_string().to_lowercase();
			if svg {
				if let Some(adjusted) = SVG_CASE_SENSITIVE
					.iter()
					.find(|candidate| candidate.to_lowercase() == tag_name)
				{
					tag_name = (*adjusted).to_string();
				}
			}

			let mut element = Element::new(&tag_name);
			for attr in attrs {
				let attr_name = match &attr.name.prefix {
					// html5ever uses an EMPTY prefix for adjusted foreign
					// attributes like `xmlns`; parse5 reports no prefix.
					Some(prefix) if !prefix.is_empty() => {
						format!("{prefix}:{}", attr.name.local)
					}
					_ => attr.name.local.to_string(),
				};
				if PROTO_PROPERTY_NAMES.contains(&attr_name.as_str()) {
					continue;
				}
				if let Some((property, value)) = parse_attribute(space, &attr_name, &attr.value) {
					element.properties.push((property, value));
				}
			}

			element.children = convert_children(arena, children);

			if element.tag_name == "template" {
				if let Some(contents) = template_contents {
					let Node::Root(children) = convert(arena, *contents) else {
						unreachable!("template contents are a fragment");
					};
					element.template_content = Some(children);
				}
			}
			Node::Element(element)
		}
	}
}

/// hastscript `addProperty` for parsed (string-valued) attributes.
fn parse_attribute(space: Space, name: &str, value: &str) -> Option<(String, PropertyValue)> {
	let info = find(space, name);
	let property = info.property.to_string();

	let result = if info.space_separated() {
		PropertyValue::List(parse_spaces(value))
	} else if info.comma_separated() {
		PropertyValue::List(
			parse_commas(value)
				.into_iter()
				.map(|token| parse_list_item(&info, &property, token))
				.collect(),
		)
	} else if info.flags & super::property_info::COMMA_OR_SPACE_SEPARATED != 0 {
		PropertyValue::List(parse_spaces(&parse_commas(value).join(" ")))
	} else {
		parse_primitive(&info, &property, value)
	};

	// Space-separated lists also run items through `parsePrimitive` (numbers
	// normalize, e.g. `1e2` → `100`).
	let result = match result {
		PropertyValue::List(items) => PropertyValue::List(
			items
				.into_iter()
				.map(|item| parse_list_item(&info, &property, item))
				.collect(),
		),
		other => other,
	};

	Some((property, result))
}

fn parse_list_item(info: &super::property_info::Info<'_>, property: &str, item: String) -> String {
	match parse_primitive(info, property, &item) {
		PropertyValue::Number(n) => js::number_to_string(n),
		PropertyValue::Bool(true) => "true".to_string(),
		PropertyValue::String(s) => s,
		_ => item,
	}
}

/// hastscript `parsePrimitive` for string inputs.
fn parse_primitive(
	info: &super::property_info::Info<'_>,
	property_name: &str,
	value: &str,
) -> PropertyValue {
	if info.number() && !value.is_empty() {
		if let Some(number) = js_number_from_string(value) {
			return PropertyValue::Number(number);
		}
	}
	if (info.boolean() || info.overloaded_boolean())
		&& (value.is_empty() || value.to_lowercase() == property_name.to_lowercase())
	{
		return PropertyValue::Bool(true);
	}
	PropertyValue::String(value.to_string())
}

/// space-separated-tokens `parse`.
fn parse_spaces(value: &str) -> Vec<String> {
	js::trim(value)
		.split([' ', '\t', '\n', '\r', '\u{000C}'])
		.filter(|token| !token.is_empty())
		.map(str::to_string)
		.collect()
}

/// comma-separated-tokens `parse`.
fn parse_commas(value: &str) -> Vec<String> {
	let mut tokens = Vec::new();
	let mut rest = value;
	loop {
		match rest.find(',') {
			Some(index) => {
				tokens.push(js::trim(&rest[..index]).to_string());
				rest = &rest[index + 1..];
			}
			None => {
				let token = js::trim(rest).to_string();
				if !token.is_empty() {
					tokens.push(token);
				}
				break;
			}
		}
	}
	tokens
}

/// `Number(value)` for strings (the subset of JS numeric-string grammar).
fn js_number_from_string(value: &str) -> Option<f64> {
	let trimmed = js::trim(value);
	if trimmed.is_empty() {
		// `Number("")` is 0, but hastscript guards `value &&` before parsing,
		// so empty stays a string upstream; treat as non-numeric here.
		return None;
	}
	// Hex/octal/binary literals (no sign allowed).
	if let Some(rest) = trimmed
		.strip_prefix("0x")
		.or_else(|| trimmed.strip_prefix("0X"))
	{
		return u128::from_str_radix(rest, 16).ok().map(|n| n as f64);
	}
	if let Some(rest) = trimmed
		.strip_prefix("0o")
		.or_else(|| trimmed.strip_prefix("0O"))
	{
		return u128::from_str_radix(rest, 8).ok().map(|n| n as f64);
	}
	if let Some(rest) = trimmed
		.strip_prefix("0b")
		.or_else(|| trimmed.strip_prefix("0B"))
	{
		return u128::from_str_radix(rest, 2).ok().map(|n| n as f64);
	}
	let (sign, magnitude) = match trimmed.strip_prefix('-') {
		Some(rest) => (-1.0, rest),
		None => (1.0, trimmed.strip_prefix('+').unwrap_or(trimmed)),
	};
	if magnitude == "Infinity" {
		return Some(f64::INFINITY * sign);
	}
	// Decimal grammar: digits [. digits] [e[+|-]digits] — Rust's f64 parser
	// accepts a superset (`inf`, `nan`, `1_0` is rejected by both); guard the
	// JS-invalid spellings.
	if magnitude.is_empty()
		|| !magnitude
			.chars()
			.all(|c| c.is_ascii_digit() || matches!(c, '.' | 'e' | 'E' | '+' | '-'))
	{
		return None;
	}
	magnitude.parse::<f64>().ok().map(|n| n * sign)
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/// Parse an HTML fragment into hast nodes (hast-util-from-html-isomorphic
/// with `fragment: true` — parse5's template fragment context). Used by the
/// KaTeX stage to splice rendered markup.
pub fn parse_fragment(html: &str) -> Vec<Node> {
	let driver = Driver::new();
	driver.raw(html);
	let (sink, children) = driver.into_fragment();
	let arena = sink.arena.borrow();
	convert_children(&arena, &children)
}

/// Apply raw-HTML processing to a hast tree (the rehype-raw stage).
pub fn process(tree: &Node) -> Node {
	let driver = Driver::new();
	driver.handle(tree);
	let (sink, children) = driver.into_fragment();
	let arena = sink.arena.borrow();
	Node::Root(convert_children(&arena, &children))
}

#[cfg(test)]
mod tests {
	use super::super::to_html::{to_html, Options};
	use super::*;

	fn render_raw(tree: Node) -> String {
		to_html(
			&process(&tree),
			Options {
				allow_dangerous_html: true,
			},
		)
	}

	#[test]
	fn parses_raw_blocks() {
		let tree = Node::Root(vec![Node::Raw("<div class=\"x\">hi</div>".into())]);
		assert_eq!(render_raw(tree), "<div class=\"x\">hi</div>");
	}

	#[test]
	fn unclosed_raw_swallows_following_elements() {
		let tree = Node::Root(vec![
			Node::Raw("<div>".into()),
			Node::Text("\n".into()),
			Node::Element(Element::with_children("p", vec![Node::text("inside")])),
		]);
		assert_eq!(render_raw(tree), "<div>\n<p>inside</p></div>");
	}

	#[test]
	fn raw_end_tag_closes_synthesized_element() {
		// `[<x>]</x>` — a raw end tag closing an element that entered as a
		// synthesized token.
		let tree = Node::Root(vec![
			Node::Element(Element::with_children("div", vec![Node::text("a")])),
			Node::Raw("</div>oops".into()),
		]);
		assert_eq!(render_raw(tree), "<div>a</div>oops");
	}

	#[test]
	fn script_content_stays_raw() {
		let tree = Node::Root(vec![Node::Raw("<script>if (a < b) {}</script>".into())]);
		assert_eq!(render_raw(tree), "<script>if (a < b) {}</script>");
	}

	#[test]
	fn comments_pass_through() {
		let tree = Node::Root(vec![Node::Raw("<!-- note -->".into())]);
		assert_eq!(render_raw(tree), "<!-- note -->");
	}

	#[test]
	fn svg_attributes_adjust() {
		let tree = Node::Root(vec![Node::Raw(
			"<svg viewbox=\"0 0 1 1\"><path d=\"M0\"></path></svg>".into(),
		)]);
		assert_eq!(
			render_raw(tree),
			"<svg viewBox=\"0 0 1 1\"><path d=\"M0\"></path></svg>"
		);
	}

	#[test]
	fn table_fostering_applies() {
		let tree = Node::Root(vec![Node::Raw(
			"<table><tr><td>x</td></tr>misplaced</table>".into(),
		)]);
		assert_eq!(
			render_raw(tree),
			"misplaced<table><tbody><tr><td>x</td></tr></tbody></table>"
		);
	}

	#[test]
	fn number_attribute_values_normalize() {
		let tree = Node::Root(vec![Node::Raw("<img width=\"1e2\">".into())]);
		assert_eq!(render_raw(tree), "<img width=\"100\">");
	}

	#[test]
	fn boolean_attributes_parse() {
		let tree = Node::Root(vec![Node::Raw(
			"<input type=\"checkbox\" checked disabled=\"\">".into(),
		)]);
		assert_eq!(
			render_raw(tree),
			"<input type=\"checkbox\" checked disabled>"
		);
	}

	// Synthesized (non-raw) element shapes the markdown pipeline cannot
	// produce, verified verbatim against hast-util-raw@9.1.0 +
	// hast-util-to-html@9.0.5.

	#[test]
	fn synthesized_rawtext_elements_keep_their_text() {
		// JS: `<script>a<b && c</script>` — the start tag switches the
		// tree-builder into script data; the hast text child stays raw.
		let script = Element::with_children("script", vec![Node::text("a<b && c")]);
		assert_eq!(
			render_raw(Node::Root(vec![Node::Element(script)])),
			"<script>a<b && c</script>"
		);

		// JS: `<style>a>b{}</style>`.
		let style = Element::with_children("style", vec![Node::text("a>b{}")]);
		assert_eq!(
			render_raw(Node::Root(vec![Node::Element(style)])),
			"<style>a>b{}</style>"
		);

		// JS: `<textarea>a&#x3C;b</textarea>` (RCDATA; the serializer still
		// escapes text outside script/style).
		let textarea = Element::with_children("textarea", vec![Node::text("a<b")]);
		assert_eq!(
			render_raw(Node::Root(vec![Node::Element(textarea)])),
			"<textarea>a&#x3C;b</textarea>"
		);
	}

	#[test]
	fn comment_nodes_replay_as_comment_tokens() {
		// JS: `<!--hi -- there-->x`.
		let tree = Node::Root(vec![
			Node::Comment("hi -- there".into()),
			Node::Text("x".into()),
		]);
		assert_eq!(render_raw(tree), "<!--hi -- there-->x");
	}

	#[test]
	fn synthesized_plaintext_swallows_the_rest() {
		// JS: `<plaintext>a&#x3C;b&#x3C;tag>after</plaintext>` — the start
		// tag switches to PLAINTEXT; later element tags are skipped and all
		// following text is literal.
		let plaintext = Element::with_children("plaintext", vec![Node::text("a<b")]);
		let tree = Node::Root(vec![
			Node::Element(plaintext),
			Node::Text("<tag>after".into()),
		]);
		assert_eq!(
			render_raw(tree),
			"<plaintext>a&#x3C;b&#x3C;tag>after</plaintext>"
		);
	}

	#[test]
	fn synthesized_comma_separated_lists_serialize() {
		// JS: `<input accept="a, b">`.
		let mut input = Element::new("input");
		input.push_property("accept", vec!["a".to_string(), "b".to_string()]);
		assert_eq!(
			render_raw(Node::Root(vec![Node::Element(input)])),
			"<input accept=\"a, b\">"
		);
	}

	#[test]
	fn synthesized_properties_skip_false_and_nan() {
		// JS: `<input disabled width="5">` — `checked: false` and a NaN
		// number are dropped, `true` serializes empty, numbers stringify.
		let mut input = Element::new("input");
		input.push_property("checked", false);
		input.push_property("tabIndex", f64::NAN);
		input.push_property("disabled", true);
		input.push_property("width", 5.0);
		assert_eq!(
			render_raw(Node::Root(vec![Node::Element(input)])),
			"<input disabled width=\"5\">"
		);
	}
}

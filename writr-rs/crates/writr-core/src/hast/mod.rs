//! hast (HTML abstract syntax tree) — the subset of the JS `hast` model the
//! pipeline produces, with insertion-ordered properties (JS object key order
//! is observable in serialized attribute order).

pub mod from_mdast;
#[cfg(feature = "highlight")]
pub mod highlight;
pub mod property_info;
#[cfg(feature = "raw-html")]
pub mod raw;
pub mod slug;
pub mod to_html;

/// A hast node.
#[derive(Debug, Clone, PartialEq)]
pub enum Node {
	Root(Vec<Node>),
	Element(Element),
	Text(String),
	Comment(String),
	Doctype,
	/// Semistandard raw HTML node (`allowDangerousHtml`).
	Raw(String),
}

/// A hast element.
#[derive(Debug, Clone, PartialEq)]
pub struct Element {
	pub tag_name: String,
	/// Insertion-ordered `(property name, value)` pairs. Keys are hast
	/// property names (`className`, `ariaDescribedBy`, …), not attribute
	/// names — the serializer maps them via `property_info`.
	pub properties: Vec<(String, PropertyValue)>,
	pub children: Vec<Node>,
	/// `<template>` content (populated only by raw-HTML parsing).
	pub template_content: Option<Vec<Node>>,
}

impl Element {
	pub fn new(tag_name: &str) -> Self {
		Self {
			tag_name: tag_name.into(),
			properties: Vec::new(),
			children: Vec::new(),
			template_content: None,
		}
	}

	pub fn with_children(tag_name: &str, children: Vec<Node>) -> Self {
		Self {
			tag_name: tag_name.into(),
			properties: Vec::new(),
			children,
			template_content: None,
		}
	}

	pub fn push_property(&mut self, name: &str, value: impl Into<PropertyValue>) {
		self.properties.push((name.into(), value.into()));
	}

	/// First value for a property name, if present.
	pub fn property(&self, name: &str) -> Option<&PropertyValue> {
		self.properties
			.iter()
			.find(|(key, _)| key == name)
			.map(|(_, value)| value)
	}
}

/// A hast property value (mirroring the JS value space reachable from the
/// pipeline: booleans, strings, numbers, and string arrays).
#[derive(Debug, Clone, PartialEq)]
pub enum PropertyValue {
	Bool(bool),
	String(String),
	Number(f64),
	List(Vec<String>),
}

impl From<bool> for PropertyValue {
	fn from(value: bool) -> Self {
		Self::Bool(value)
	}
}

impl From<&str> for PropertyValue {
	fn from(value: &str) -> Self {
		Self::String(value.into())
	}
}

impl From<String> for PropertyValue {
	fn from(value: String) -> Self {
		Self::String(value)
	}
}

impl From<f64> for PropertyValue {
	fn from(value: f64) -> Self {
		Self::Number(value)
	}
}

impl From<Vec<String>> for PropertyValue {
	fn from(value: Vec<String>) -> Self {
		Self::List(value)
	}
}

impl Node {
	pub fn text(value: impl Into<String>) -> Self {
		Self::Text(value.into())
	}

	/// The `"\n"` text node used pervasively by mdast-util-to-hast's `wrap`.
	pub fn newline() -> Self {
		Self::Text("\n".into())
	}
}

/// Port of mdast-util-to-hast's `wrap`: intersperse `"\n"` text nodes,
/// adding leading/trailing newlines when `loose`.
pub fn wrap(nodes: Vec<Node>, loose: bool) -> Vec<Node> {
	let mut result = Vec::with_capacity(nodes.len() * 2 + 2);
	if loose {
		result.push(Node::newline());
	}
	let is_empty = nodes.is_empty();
	for (index, node) in nodes.into_iter().enumerate() {
		if index > 0 {
			result.push(Node::newline());
		}
		result.push(node);
	}
	if loose && !is_empty {
		result.push(Node::newline());
	}
	result
}

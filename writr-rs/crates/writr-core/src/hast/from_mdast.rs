//! Port of mdast-util-to-hast@13.2.1 (the exact version under
//! remark-rehype@11.1.2) over markdown-rs's mdast.
//!
//! Differences from the JS package are structural, not behavioral:
//!
//! - markdown-rs mdast nodes have no `data` escape hatch, so transforms that
//!   upstream implements via `data.hName`/`hProperties`/`hChildren`
//!   (remark-math's `math`/`inlineMath` shapes, writr's custom MDX JSX
//!   handler) are folded into the equivalent handlers here.
//! - GitHub blockquote alerts (remark-github-blockquote-alert) run as an
//!   mdast-stage plugin in JS *before* this conversion; here the blockquote
//!   handler performs the same rewrite inline (observably equivalent: the
//!   transforms between them — toc, emoji — cannot interact with the alert
//!   marker).

use super::{wrap, Element, Node, PropertyValue};
use crate::options::RenderOptions;
use markdown::mdast;
use std::collections::HashMap;

/// Conversion options (remark-rehype's `allowDangerousHtml` plus which
/// writr-level features are active).
#[derive(Debug, Clone, Copy, Default)]
pub struct Options {
	pub allow_dangerous_html: bool,
	/// GitHub blockquote alerts (`> [!NOTE]`), tied to writr's `gfm` flag.
	pub gfm_alerts: bool,
}

impl Options {
	pub fn from_render_options(options: &RenderOptions) -> Self {
		Self {
			allow_dangerous_html: options.raw_html,
			gfm_alerts: options.gfm,
		}
	}
}

/// Result of handling one mdast node — mirrors the JS handler return type
/// (`HastElementContent | Array<...> | undefined`). The distinction between
/// `One` and `Many` is observable: the after-break trimming in `all()` only
/// applies to single-node results.
enum OneResult {
	None,
	One(Node),
	Many(Vec<Node>),
}

struct State<'a> {
	definition_by_id: HashMap<String, &'a mdast::Definition>,
	footnote_by_id: HashMap<String, &'a mdast::FootnoteDefinition>,
	footnote_counts: HashMap<String, usize>,
	footnote_order: Vec<String>,
	options: Options,
}

/// Context a handler needs about its parent (JS handlers receive the actual
/// parent node; only lists and tables consult it).
#[derive(Clone, Copy)]
enum Parent<'a> {
	None,
	List(&'a mdast::List),
	Table(&'a mdast::Table),
	Other,
}

/// Transform an mdast tree to hast (the `toHast` entry point).
pub fn from_mdast(tree: &mdast::Node, options: Options) -> Node {
	let mut state = State::new(tree, options);
	let result = state.one(tree, Parent::None, 0);
	let footer = state.footer();
	let mut root = match result {
		OneResult::One(node) => node,
		OneResult::Many(nodes) => Node::Root(nodes),
		OneResult::None => Node::Root(Vec::new()),
	};
	if let Some(section) = footer {
		if let Node::Root(children) = &mut root {
			children.push(Node::newline());
			children.push(section);
		}
	}
	root
}

impl<'a> State<'a> {
	fn new(tree: &'a mdast::Node, options: Options) -> Self {
		let mut state = Self {
			definition_by_id: HashMap::new(),
			footnote_by_id: HashMap::new(),
			footnote_counts: HashMap::new(),
			footnote_order: Vec::new(),
			options,
		};
		state.collect_definitions(tree);
		state
	}

	/// Preorder walk collecting link/footnote definitions (first one wins,
	/// mimicking CommonMark's link-definition behavior).
	fn collect_definitions(&mut self, node: &'a mdast::Node) {
		match node {
			mdast::Node::Definition(definition) => {
				let id = definition.identifier.to_uppercase();
				self.definition_by_id.entry(id).or_insert(definition);
			}
			mdast::Node::FootnoteDefinition(definition) => {
				let id = definition.identifier.to_uppercase();
				self.footnote_by_id.entry(id).or_insert(definition);
			}
			_ => {}
		}
		if let Some(children) = node.children() {
			for child in children {
				self.collect_definitions(child);
			}
		}
	}

	fn all_of(&mut self, node: &'a mdast::Node) -> Vec<Node> {
		let parent = match node {
			mdast::Node::List(list) => Parent::List(list),
			mdast::Node::Table(table) => Parent::Table(table),
			_ => Parent::Other,
		};
		match node.children() {
			Some(children) => self.all(children, parent),
			None => Vec::new(),
		}
	}

	fn all(&mut self, children: &'a [mdast::Node], parent: Parent<'a>) -> Vec<Node> {
		let mut values = Vec::new();
		for (index, child) in children.iter().enumerate() {
			let mut result = self.one(child, parent, index);
			// After a hard break, trim initial spaces/tabs from a single
			// text result or the first text child of a single element result.
			if index > 0 && matches!(children[index - 1], mdast::Node::Break(_)) {
				if let OneResult::One(node) = &mut result {
					match node {
						Node::Text(value) => {
							*value = trim_markdown_space_start(value).to_string();
						}
						Node::Element(element) => {
							if let Some(Node::Text(value)) = element.children.first_mut() {
								*value = trim_markdown_space_start(value).to_string();
							}
						}
						_ => {}
					}
				}
			}
			match result {
				OneResult::None => {}
				OneResult::One(node) => values.push(node),
				OneResult::Many(nodes) => values.extend(nodes),
			}
		}
		values
	}

	fn one(&mut self, node: &'a mdast::Node, parent: Parent<'a>, index: usize) -> OneResult {
		match node {
			mdast::Node::Root(_) => {
				OneResult::One(Node::Root(wrap(self.all_of(node), false)))
			}
			mdast::Node::Paragraph(_) => {
				OneResult::One(Node::Element(Element::with_children("p", self.all_of(node))))
			}
			mdast::Node::Heading(heading) => {
				let tag = format!("h{}", heading.depth);
				OneResult::One(Node::Element(Element::with_children(&tag, self.all_of(node))))
			}
			mdast::Node::ThematicBreak(_) => {
				OneResult::One(Node::Element(Element::new("hr")))
			}
			mdast::Node::Blockquote(_) => self.blockquote(node),
			mdast::Node::List(list) => OneResult::One(self.list(node, list)),
			mdast::Node::ListItem(item) => OneResult::One(self.list_item(node, item, parent)),
			mdast::Node::Html(html) => {
				if self.options.allow_dangerous_html {
					OneResult::One(Node::Raw(html.value.clone()))
				} else {
					OneResult::None
				}
			}
			mdast::Node::Code(code) => OneResult::One(self.code(code)),
			mdast::Node::InlineCode(code) => OneResult::One(inline_code(code)),
			mdast::Node::Emphasis(_) => {
				OneResult::One(Node::Element(Element::with_children("em", self.all_of(node))))
			}
			mdast::Node::Strong(_) => {
				OneResult::One(Node::Element(Element::with_children("strong", self.all_of(node))))
			}
			mdast::Node::Delete(_) => {
				OneResult::One(Node::Element(Element::with_children("del", self.all_of(node))))
			}
			mdast::Node::Text(text) => OneResult::One(Node::Text(trim_lines(&text.value))),
			mdast::Node::Break(_) => OneResult::Many(vec![
				Node::Element(Element::new("br")),
				Node::newline(),
			]),
			mdast::Node::Link(link) => {
				let mut element = Element::with_children("a", self.all_of(node));
				element.properties = link_properties("href", &link.url, link.title.as_deref());
				OneResult::One(Node::Element(element))
			}
			mdast::Node::Image(image) => {
				let mut element = Element::new("img");
				element.push_property("src", normalize_uri(&image.url));
				element.push_property("alt", image.alt.as_str());
				if let Some(title) = &image.title {
					element.push_property("title", title.as_str());
				}
				OneResult::One(Node::Element(element))
			}
			mdast::Node::LinkReference(reference) => self.link_reference(node, reference),
			mdast::Node::ImageReference(reference) => self.image_reference(reference),
			mdast::Node::FootnoteReference(reference) => {
				OneResult::One(self.footnote_reference(reference))
			}
			mdast::Node::Table(table) => OneResult::One(self.table(node, table)),
			mdast::Node::TableRow(_) => OneResult::One(self.table_row(node, parent, index)),
			mdast::Node::TableCell(_) => {
				// Normally unreachable (rows compile their own cells).
				OneResult::One(Node::Element(Element::with_children("td", self.all_of(node))))
			}
			mdast::Node::Math(math) => OneResult::One(block_math(math)),
			mdast::Node::InlineMath(math) => OneResult::One(inline_math(math)),
			mdast::Node::MdxJsxFlowElement(_) | mdast::Node::MdxJsxTextElement(_) => {
				self.mdx_jsx(node)
			}
			// Unknown-node fallback (`defaultUnknownHandler`): nodes with a
			// `value` become text. This is exactly how remark's pipeline
			// renders MDX expressions and ESM without dedicated handlers.
			mdast::Node::MdxFlowExpression(expression) => {
				OneResult::One(Node::Text(expression.value.clone()))
			}
			mdast::Node::MdxTextExpression(expression) => {
				OneResult::One(Node::Text(expression.value.clone()))
			}
			mdast::Node::MdxjsEsm(esm) => OneResult::One(Node::Text(esm.value.clone())),
			// Ignored node types.
			mdast::Node::Definition(_)
			| mdast::Node::FootnoteDefinition(_)
			| mdast::Node::Yaml(_)
			| mdast::Node::Toml(_) => OneResult::None,
		}
	}

	fn blockquote(&mut self, node: &'a mdast::Node) -> OneResult {
		if self.options.gfm_alerts {
			if let Some(alert) = self.try_alert(node) {
				return OneResult::One(alert);
			}
		}
		OneResult::One(Node::Element(Element {
			tag_name: "blockquote".into(),
			properties: Vec::new(),
			children: wrap(self.all_of(node), true),
			template_content: None,
		}))
	}

	/// GitHub blockquote alerts — port of remark-github-blockquote-alert@2.1.0
	/// with default options (`legacyTitle: false`, `tagName: "div"`).
	///
	/// The JS plugin runs on mdast *before* emoji replacement; here detection
	/// runs at conversion time, *after* emoji. The two orders are observably
	/// identical except when an emoji shortcode sits on the alert-marker line
	/// itself in the single-line (`no-\n`) branch — the plugin drops the whole
	/// first text node there, while a pre-split text keeps the emoji. That
	/// corner (an emoji inside `> [!NOTE] :x:` on one line) is accepted as a
	/// known limitation; the golden corpus contains no such document.
	fn try_alert(&mut self, node: &'a mdast::Node) -> Option<Node> {
		let mdast::Node::Blockquote(blockquote) = node else {
			return None;
		};

		// Scan paragraphs (only) until one's first text matches the marker —
		// the plugin's `isNext` flag keeps scanning past non-matching ones.
		let mut matched: Option<(usize, AlertMatch)> = None;
		for (index, child) in blockquote.children.iter().enumerate() {
			if let mdast::Node::Paragraph(paragraph) = child {
				let text = match paragraph.children.first() {
					Some(mdast::Node::Text(text)) => text.value.as_str(),
					_ => "",
				};
				if let Some(alert) = match_alert(text) {
					matched = Some((index, alert));
					break;
				}
			}
		}
		let (match_index, alert) = matched?;

		let mut converted: Vec<Node> = vec![self.alert_title_paragraph(&alert)];
		for (index, child) in blockquote.children.iter().enumerate() {
			if index == match_index {
				converted.push(self.alert_marker_paragraph(child, &alert));
			} else {
				match self.one(child, Parent::Other, index) {
					OneResult::None => {}
					OneResult::One(node) => converted.push(node),
					OneResult::Many(nodes) => converted.extend(nodes),
				}
			}
		}

		let mut div = Element::new("div");
		div.push_property(
			"className",
			vec![
				"markdown-alert".to_string(),
				format!("markdown-alert-{}", alert.kind),
			],
		);
		div.push_property("dir", "auto");
		div.children = wrap(converted, true);
		Some(Node::Element(div))
	}

	/// Convert the paragraph carrying the alert marker, applying the plugin's
	/// rewrite: multi-line first text → marker (and leading newlines)
	/// stripped; single-line first text → dropped entirely, along with an
	/// immediately following hard break.
	fn alert_marker_paragraph(&mut self, node: &'a mdast::Node, alert: &AlertMatch) -> Node {
		let mdast::Node::Paragraph(paragraph) = node else {
			unreachable!("alert marker is always a paragraph");
		};
		let children = &paragraph.children;
		let first_text = match children.first() {
			Some(mdast::Node::Text(text)) => text.value.as_str(),
			_ => unreachable!("alert marker paragraph starts with text"),
		};

		let mut hast_children: Vec<Node>;
		if first_text.contains('\n') {
			let stripped = first_text[alert.marker_len..].trim_start_matches('\n');
			hast_children = vec![Node::Text(trim_lines(stripped))];
			hast_children.extend(self.all(&children[1..], Parent::Other));
		} else {
			let skip = if matches!(children.get(1), Some(mdast::Node::Break(_))) {
				2
			} else {
				1
			};
			hast_children = self.all(&children[skip.min(children.len())..], Parent::Other);
		}

		Node::Element(Element::with_children("p", hast_children))
	}

	/// The injected title paragraph: octicon SVG + upper-cased alert name.
	fn alert_title_paragraph(&mut self, alert: &AlertMatch) -> Node {
		let mut path = Element::new("path");
		path.push_property("d", alert.icon_path);

		let mut svg = Element::new("svg");
		svg.push_property("className", vec!["octicon".to_string()]);
		svg.push_property("viewBox", "0 0 16 16");
		svg.push_property("width", "16");
		svg.push_property("height", "16");
		svg.push_property("ariaHidden", "true");
		svg.children = vec![Node::Element(path)];

		let mut title = Element::new("p");
		// The plugin passes `className` as a plain string here (not a list).
		title.push_property("className", "markdown-alert-title");
		title.push_property("dir", "auto");
		title.children = vec![Node::Element(svg), Node::Text(alert.title.clone())];
		Node::Element(title)
	}

	fn list(&mut self, node: &'a mdast::Node, list: &'a mdast::List) -> Node {
		let results = self.all_of(node);
		let mut element = Element::new(if list.ordered { "ol" } else { "ul" });
		if let Some(start) = list.start {
			if start != 1 {
				element.push_property("start", f64::from(start));
			}
		}
		let has_task_item = results.iter().any(|child| {
			matches!(
				child,
				Node::Element(el)
					if el.tag_name == "li"
						&& matches!(
							el.property("className"),
							Some(PropertyValue::List(classes))
								if classes.iter().any(|c| c == "task-list-item")
						)
			)
		});
		if has_task_item {
			element.push_property("className", vec!["contains-task-list".to_string()]);
		}
		element.children = wrap(results, true);
		Node::Element(element)
	}

	fn list_item(
		&mut self,
		node: &'a mdast::Node,
		item: &'a mdast::ListItem,
		parent: Parent<'a>,
	) -> Node {
		let mut results = self.all_of(node);
		let loose = match parent {
			Parent::List(list) => list_loose(list),
			_ => list_item_loose(item),
		};

		let mut element = Element::new("li");

		if let Some(checked) = item.checked {
			// Inject the checkbox into the head paragraph (creating one when
			// the item is empty).
			let has_head_paragraph = matches!(
				results.first(),
				Some(Node::Element(el)) if el.tag_name == "p"
			);
			if !has_head_paragraph {
				results.insert(0, Node::Element(Element::new("p")));
			}
			if let Some(Node::Element(paragraph)) = results.first_mut() {
				if !paragraph.children.is_empty() {
					paragraph.children.insert(0, Node::text(" "));
				}
				let mut input = Element::new("input");
				input.push_property("type", "checkbox");
				input.push_property("checked", checked);
				input.push_property("disabled", true);
				paragraph.children.insert(0, Node::Element(input));
			}
			element.push_property("className", vec!["task-list-item".to_string()]);
		}

		let mut children: Vec<Node> = Vec::new();
		let result_count = results.len();
		for (index, child) in results.into_iter().enumerate() {
			let is_paragraph =
				matches!(&child, Node::Element(el) if el.tag_name == "p");
			// Add eols before nodes, except before a tight first paragraph.
			if loose || index != 0 || !is_paragraph {
				children.push(Node::newline());
			}
			if is_paragraph && !loose {
				if let Node::Element(paragraph) = child {
					children.extend(paragraph.children);
				}
			} else {
				children.push(child);
			}
			// Final eol, except after a tight trailing paragraph.
			if index + 1 == result_count && (loose || !is_paragraph) {
				children.push(Node::newline());
			}
		}

		element.children = children;
		Node::Element(element)
	}

	fn code(&mut self, code: &mdast::Code) -> Node {
		let value = if code.value.is_empty() {
			String::new()
		} else {
			format!("{}\n", code.value)
		};
		let mut code_element = Element::new("code");
		if let Some(lang) = &code.lang {
			if !lang.is_empty() {
				// JS: `node.lang.split(/\s+/)` and take the first segment —
				// which is `""` when the string starts with JS whitespace.
				let first = lang
					.split(crate::js::is_js_whitespace)
					.next()
					.unwrap_or("");
				code_element
					.push_property("className", vec![format!("language-{first}")]);
			}
		}
		code_element.children = vec![Node::Text(value)];
		Node::Element(Element::with_children("pre", vec![Node::Element(code_element)]))
	}

	fn link_reference(
		&mut self,
		node: &'a mdast::Node,
		reference: &'a mdast::LinkReference,
	) -> OneResult {
		let id = reference.identifier.to_uppercase();
		let Some(definition) = self.definition_by_id.get(&id).copied() else {
			return OneResult::Many(self.revert_link(node, reference));
		};
		let mut element = Element::with_children("a", self.all_of(node));
		element.properties =
			link_properties("href", &definition.url, definition.title.as_deref());
		OneResult::One(Node::Element(element))
	}

	fn image_reference(&mut self, reference: &'a mdast::ImageReference) -> OneResult {
		let id = reference.identifier.to_uppercase();
		let Some(definition) = self.definition_by_id.get(&id).copied() else {
			return OneResult::One(Node::Text(format!(
				"![{}{}",
				reference.alt,
				revert_suffix(&reference.reference_kind, reference.label.as_deref(), &reference.identifier)
			)));
		};
		let mut element = Element::new("img");
		element.push_property("src", normalize_uri(&definition.url));
		element.push_property("alt", reference.alt.as_str());
		if let Some(title) = &definition.title {
			element.push_property("title", title.as_str());
		}
		OneResult::One(Node::Element(element))
	}

	/// `revert` for link references without a matching definition.
	fn revert_link(
		&mut self,
		node: &'a mdast::Node,
		reference: &'a mdast::LinkReference,
	) -> Vec<Node> {
		let suffix = revert_suffix(
			&reference.reference_kind,
			reference.label.as_deref(),
			&reference.identifier,
		);
		let mut contents = self.all_of(node);
		match contents.first_mut() {
			Some(Node::Text(value)) => {
				*value = format!("[{value}");
			}
			_ => contents.insert(0, Node::text("[")),
		}
		match contents.last_mut() {
			Some(Node::Text(value)) => {
				value.push_str(&suffix);
			}
			_ => contents.push(Node::Text(suffix)),
		}
		contents
	}

	fn footnote_reference(&mut self, reference: &mdast::FootnoteReference) -> Node {
		let id = reference.identifier.to_uppercase();
		let safe_id = normalize_uri(&id.to_lowercase());
		let index = self.footnote_order.iter().position(|entry| *entry == id);
		let counter;
		let mut reuse_counter = self.footnote_counts.get(&id).copied();
		match reuse_counter {
			None => {
				reuse_counter = Some(0);
				self.footnote_order.push(id.clone());
				counter = self.footnote_order.len();
			}
			Some(_) => {
				// `index` is present whenever the id was counted before.
				counter = index.map_or(0, |i| i + 1);
			}
		}
		let reuse = reuse_counter.unwrap_or(0) + 1;
		self.footnote_counts.insert(id, reuse);

		let mut link = Element::new("a");
		link.push_property("href", format!("#user-content-fn-{safe_id}"));
		link.push_property(
			"id",
			if reuse > 1 {
				format!("user-content-fnref-{safe_id}-{reuse}")
			} else {
				format!("user-content-fnref-{safe_id}")
			},
		);
		link.push_property("dataFootnoteRef", true);
		link.push_property("ariaDescribedBy", vec!["footnote-label".to_string()]);
		link.children = vec![Node::Text(counter.to_string())];

		Node::Element(Element::with_children("sup", vec![Node::Element(link)]))
	}

	fn table(&mut self, node: &'a mdast::Node, _table: &'a mdast::Table) -> Node {
		let mut rows = self.all_of(node);
		let mut table_content: Vec<Node> = Vec::new();
		if !rows.is_empty() {
			let first_row = rows.remove(0);
			table_content.push(Node::Element(Element {
				tag_name: "thead".into(),
				properties: Vec::new(),
				children: wrap(vec![first_row], true),
				template_content: None,
			}));
		}
		if !rows.is_empty() {
			table_content.push(Node::Element(Element {
				tag_name: "tbody".into(),
				properties: Vec::new(),
				children: wrap(rows, true),
				template_content: None,
			}));
		}
		Node::Element(Element {
			tag_name: "table".into(),
			properties: Vec::new(),
			children: wrap(table_content, true),
			template_content: None,
		})
	}

	fn table_row(&mut self, node: &'a mdast::Node, parent: Parent<'a>, index: usize) -> Node {
		let row_index = match parent {
			Parent::None => 1,
			_ => index,
		};
		let tag_name = if row_index == 0 { "th" } else { "td" };
		let align = match parent {
			Parent::Table(table) => Some(&table.align),
			_ => None,
		};
		let row_children = node.children().map(Vec::as_slice).unwrap_or(&[]);
		let length = align.map_or(row_children.len(), |align| align.len());

		let mut cells = Vec::with_capacity(length);
		for cell_index in 0..length {
			let mut cell_element = Element::new(tag_name);
			if let Some(align) = align {
				if let Some(value) = align.get(cell_index).and_then(align_value) {
					cell_element.push_property("align", value);
				}
			}
			if let Some(cell) = row_children.get(cell_index) {
				cell_element.children = self.all_of(cell);
			}
			cells.push(Node::Element(cell_element));
		}

		Node::Element(Element {
			tag_name: "tr".into(),
			properties: Vec::new(),
			children: wrap(cells, true),
			template_content: None,
		})
	}

	/// Port of writr's custom `mdxJsxHandler` (src/writr.ts:737-756): keep
	/// string and shorthand (true) attributes, drop expression/spread
	/// attributes, default fragments to `div`.
	fn mdx_jsx(&mut self, node: &'a mdast::Node) -> OneResult {
		let (name, attributes) = match node {
			mdast::Node::MdxJsxFlowElement(el) => (el.name.as_deref(), &el.attributes),
			mdast::Node::MdxJsxTextElement(el) => (el.name.as_deref(), &el.attributes),
			_ => unreachable!("mdx_jsx called with a non-JSX node"),
		};
		let mut element = Element::new(name.unwrap_or("div"));
		for attribute in attributes {
			if let mdast::AttributeContent::Property(property) = attribute {
				match &property.value {
					None => element.push_property(&property.name, true),
					Some(mdast::AttributeValue::Literal(value)) => {
						element.push_property(&property.name, value.as_str());
					}
					Some(mdast::AttributeValue::Expression(_)) => {}
				}
			}
		}
		element.children = self.all_of(node);
		OneResult::One(Node::Element(element))
	}

	/// The footnote section (`footer.js`), generated after the whole tree.
	fn footer(&mut self) -> Option<Node> {
		let order = std::mem::take(&mut self.footnote_order);
		let mut list_items: Vec<Node> = Vec::new();

		for (reference_index, id) in order.iter().enumerate() {
			let Some(definition) = self.footnote_by_id.get(id).copied() else {
				continue;
			};
			let mut content = self.all_of_footnote(definition);
			let safe_id = normalize_uri(&id.to_lowercase());
			let counts = self.footnote_counts.get(id).copied();

			let mut back_references: Vec<Node> = Vec::new();
			if let Some(counts) = counts {
				for rereference_index in 1..=counts {
					if !back_references.is_empty() {
						back_references.push(Node::text(" "));
					}
					let mut children = vec![Node::text("↩")];
					if rereference_index > 1 {
						children.push(Node::Element(Element::with_children(
							"sup",
							vec![Node::Text(rereference_index.to_string())],
						)));
					}
					let mut anchor = Element::new("a");
					anchor.push_property(
						"href",
						if rereference_index > 1 {
							format!("#user-content-fnref-{safe_id}-{rereference_index}")
						} else {
							format!("#user-content-fnref-{safe_id}")
						},
					);
					anchor.push_property("dataFootnoteBackref", "");
					anchor.push_property(
						"ariaLabel",
						if rereference_index > 1 {
							format!(
								"Back to reference {}-{}",
								reference_index + 1,
								rereference_index
							)
						} else {
							format!("Back to reference {}", reference_index + 1)
						},
					);
					anchor.push_property(
						"className",
						vec!["data-footnote-backref".to_string()],
					);
					anchor.children = children;
					back_references.push(Node::Element(anchor));
				}
			}

			let appended_to_paragraph = match content.last_mut() {
				Some(Node::Element(tail)) if tail.tag_name == "p" => {
					match tail.children.last_mut() {
						Some(Node::Text(value)) => value.push(' '),
						_ => tail.children.push(Node::text(" ")),
					}
					tail.children.append(&mut back_references);
					true
				}
				_ => false,
			};
			if !appended_to_paragraph {
				content.append(&mut back_references);
			}

			let mut list_item = Element::new("li");
			list_item.push_property("id", format!("user-content-fn-{safe_id}"));
			list_item.children = wrap(content, true);
			list_items.push(Node::Element(list_item));
		}

		if list_items.is_empty() {
			return None;
		}

		let mut label = Element::new("h2");
		label.push_property("className", vec!["sr-only".to_string()]);
		label.push_property("id", "footnote-label");
		label.children = vec![Node::text("Footnotes")];

		let mut section = Element::new("section");
		section.push_property("dataFootnotes", true);
		section.push_property("className", vec!["footnotes".to_string()]);
		section.children = vec![
			Node::Element(label),
			Node::newline(),
			Node::Element(Element {
				tag_name: "ol".into(),
				properties: Vec::new(),
				children: wrap(list_items, true),
				template_content: None,
			}),
			Node::newline(),
		];
		Some(Node::Element(section))
	}

	fn all_of_footnote(&mut self, definition: &'a mdast::FootnoteDefinition) -> Vec<Node> {
		self.all(&definition.children, Parent::Other)
	}
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

/// A matched `[!KIND]` alert marker.
struct AlertMatch {
	/// Lower-cased kind (`note`, `tip`, …).
	kind: String,
	/// Upper-cased title text (`NOTE`, `TIP`, …).
	title: String,
	/// Byte length of the `[!KIND]` marker in the source text.
	marker_len: usize,
	/// Octicon path data for the kind.
	icon_path: &'static str,
}

/// `/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i`
fn match_alert(text: &str) -> Option<AlertMatch> {
	const KINDS: &[(&str, &str)] = &[
		("NOTE", OCTICON_NOTE),
		("TIP", OCTICON_TIP),
		("IMPORTANT", OCTICON_IMPORTANT),
		("WARNING", OCTICON_WARNING),
		("CAUTION", OCTICON_CAUTION),
	];
	let rest = text.strip_prefix("[!")?;
	for (keyword, icon_path) in KINDS {
		if rest.len() > keyword.len()
			&& rest.as_bytes()[keyword.len()] == b']'
			&& rest[..keyword.len()].eq_ignore_ascii_case(keyword)
		{
			return Some(AlertMatch {
				kind: keyword.to_lowercase(),
				title: (*keyword).to_string(),
				marker_len: 2 + keyword.len() + 1,
				icon_path,
			});
		}
	}
	None
}

const OCTICON_NOTE: &str = "M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z";
const OCTICON_TIP: &str = "M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.848.284.411.537.896.621 1.49a.75.75 0 0 1-1.484.211c-.04-.282-.163-.547-.37-.847a8.456 8.456 0 0 0-.542-.68c-.084-.1-.173-.205-.268-.32C3.201 7.75 2.5 6.766 2.5 5.25 2.5 2.31 4.863 0 8 0s5.5 2.31 5.5 5.25c0 1.516-.701 2.5-1.328 3.259-.095.115-.184.22-.268.319-.207.245-.383.453-.541.681-.208.3-.33.565-.37.847a.751.751 0 0 1-1.485-.212c.084-.593.337-1.078.621-1.489.203-.292.45-.584.673-.848.075-.088.147-.173.213-.253.561-.679.985-1.32.985-2.304 0-2.06-1.637-3.75-4-3.75ZM5.75 12h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5ZM6 15.25a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Z";
const OCTICON_IMPORTANT: &str = "M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0 1 14.25 13H8.06l-2.573 2.573A1.458 1.458 0 0 1 3 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h6.5a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25Zm7 2.25v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z";
const OCTICON_WARNING: &str = "M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z";
const OCTICON_CAUTION: &str = "M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z";

// ---------------------------------------------------------------------------
// Stateless helpers
// ---------------------------------------------------------------------------

fn link_properties(
	href_key: &str,
	url: &str,
	title: Option<&str>,
) -> Vec<(String, PropertyValue)> {
	let mut properties = vec![(
		href_key.to_string(),
		PropertyValue::String(normalize_uri(url)),
	)];
	if let Some(title) = title {
		properties.push(("title".to_string(), PropertyValue::String(title.into())));
	}
	properties
}

fn revert_suffix(
	kind: &mdast::ReferenceKind,
	label: Option<&str>,
	identifier: &str,
) -> String {
	match kind {
		mdast::ReferenceKind::Shortcut => "]".to_string(),
		mdast::ReferenceKind::Collapsed => "][]".to_string(),
		mdast::ReferenceKind::Full => {
			let label = match label {
				Some(label) if !label.is_empty() => label,
				_ => identifier,
			};
			format!("][{label}]")
		}
	}
}

fn inline_code(code: &mdast::InlineCode) -> Node {
	// `value.replace(/\r?\n|\r/g, ' ')`
	let mut value = String::with_capacity(code.value.len());
	let mut chars = code.value.chars().peekable();
	while let Some(c) = chars.next() {
		match c {
			'\r' => {
				if chars.peek() == Some(&'\n') {
					chars.next();
				}
				value.push(' ');
			}
			'\n' => value.push(' '),
			other => value.push(other),
		}
	}
	Node::Element(Element::with_children("code", vec![Node::Text(value)]))
}

/// remark-math's block math hast shape (mdast-util-math@3.0.0).
fn block_math(math: &mdast::Math) -> Node {
	let mut code = Element::new("code");
	code.push_property(
		"className",
		vec!["language-math".to_string(), "math-display".to_string()],
	);
	code.children = vec![Node::Text(math.value.clone())];
	Node::Element(Element::with_children("pre", vec![Node::Element(code)]))
}

/// remark-math's inline math hast shape.
fn inline_math(math: &mdast::InlineMath) -> Node {
	let mut code = Element::new("code");
	code.push_property(
		"className",
		vec!["language-math".to_string(), "math-inline".to_string()],
	);
	code.children = vec![Node::Text(math.value.clone())];
	Node::Element(code)
}

fn align_value(kind: &mdast::AlignKind) -> Option<&'static str> {
	match kind {
		mdast::AlignKind::Left => Some("left"),
		mdast::AlignKind::Center => Some("center"),
		mdast::AlignKind::Right => Some("right"),
		mdast::AlignKind::None => None,
	}
}

fn list_loose(list: &mdast::List) -> bool {
	if list.spread {
		return true;
	}
	list.children.iter().any(|child| match child {
		mdast::Node::ListItem(item) => list_item_loose(item),
		_ => false,
	})
}

fn list_item_loose(item: &mdast::ListItem) -> bool {
	item.spread
}

/// `trimMarkdownSpaceStart`: strip leading spaces and tabs.
fn trim_markdown_space_start(value: &str) -> &str {
	value.trim_start_matches([' ', '\t'])
}

/// trim-lines@3.0.1: remove spaces/tabs around line endings inside a value
/// (not at its very start/end), preserving the line endings themselves.
pub fn trim_lines(value: &str) -> String {
	let bytes = value.as_bytes();
	let mut lines: Vec<&str> = Vec::new();
	let mut breaks: Vec<&str> = Vec::new();
	let mut start = 0;
	let mut index = 0;
	while index < bytes.len() {
		match bytes[index] {
			b'\r' => {
				lines.push(&value[start..index]);
				if bytes.get(index + 1) == Some(&b'\n') {
					breaks.push("\r\n");
					index += 2;
				} else {
					breaks.push("\r");
					index += 1;
				}
				start = index;
			}
			b'\n' => {
				lines.push(&value[start..index]);
				breaks.push("\n");
				index += 1;
				start = index;
			}
			_ => index += 1,
		}
	}
	lines.push(&value[start..]);

	if breaks.is_empty() {
		return value.to_string();
	}

	let mut result = String::with_capacity(value.len());
	let last = lines.len() - 1;
	for (i, line) in lines.iter().enumerate() {
		let mut trimmed: &str = line;
		if i > 0 {
			trimmed = trimmed.trim_start_matches([' ', '\t']);
		}
		if i < last {
			trimmed = trimmed.trim_end_matches([' ', '\t']);
		}
		// JS keeps a line only when non-empty after trimming, but since it
		// joins with the separators interleaved, empty strings contribute
		// nothing either way.
		result.push_str(trimmed);
		if i < last {
			result.push_str(breaks[i]);
		}
	}
	result
}

/// micromark-util-sanitize-uri's `normalizeUri`: percent-encode unsafe
/// characters, skipping already-encoded `%XX` sequences.
pub fn normalize_uri(value: &str) -> String {
	let bytes = value.as_bytes();
	let mut result = String::with_capacity(value.len());
	let mut index = 0;
	while index < bytes.len() {
		let byte = bytes[index];
		if byte == b'%'
			&& index + 2 < bytes.len()
			&& bytes[index + 1].is_ascii_alphanumeric()
			&& bytes[index + 2].is_ascii_alphanumeric()
		{
			result.push_str(&value[index..index + 3]);
			index += 3;
			continue;
		}
		if byte < 128 {
			let c = byte as char;
			if matches!(c, '!' | '#' | '$' | '&'..=';' | '=' | '?'..='Z' | '_' | 'a'..='z' | '~') {
				result.push(c);
			} else {
				percent_encode_char(&mut result, c);
			}
			index += 1;
			continue;
		}
		// Multi-byte character: percent-encode its UTF-8 bytes
		// (`encodeURIComponent` semantics; lone surrogates cannot occur in
		// Rust strings).
		let c = value[index..].chars().next().expect("valid UTF-8");
		percent_encode_char(&mut result, c);
		index += c.len_utf8();
	}
	result
}

fn percent_encode_char(result: &mut String, c: char) {
	let mut buffer = [0u8; 4];
	for byte in c.encode_utf8(&mut buffer).as_bytes() {
		result.push('%');
		result.push_str(&format!("{byte:02X}"));
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn normalize_uri_matches_micromark() {
		assert_eq!(normalize_uri("https://a.com/b c"), "https://a.com/b%20c");
		assert_eq!(normalize_uri("a%20b"), "a%20b");
		assert_eq!(normalize_uri("a%2xb"), "a%252xb");
		assert_eq!(normalize_uri("é"), "%C3%A9");
		assert_eq!(normalize_uri("a\"b<c>"), "a%22b%3Cc%3E");
		assert_eq!(normalize_uri("?query=1&x=2"), "?query=1&x=2");
		assert_eq!(normalize_uri("\\backslash"), "%5Cbackslash");
		assert_eq!(normalize_uri("emoji💯"), "emoji%F0%9F%92%AF");
	}

	#[test]
	fn trim_lines_strips_around_breaks_only() {
		assert_eq!(trim_lines("a  \n  b"), "a\nb");
		assert_eq!(trim_lines("  a  "), "  a  ");
		assert_eq!(trim_lines("a \r\n b \n c"), "a\r\nb\nc");
		assert_eq!(trim_lines("a \r b"), "a\rb");
		assert_eq!(trim_lines(""), "");
	}

	#[test]
	fn inline_code_replaces_newlines() {
		let code = mdast::InlineCode {
			value: "a\nb\r\nc\rd".into(),
			position: None,
		};
		assert_eq!(
			inline_code(&code),
			Node::Element(Element::with_children("code", vec![Node::text("a b c d")]))
		);
	}
}

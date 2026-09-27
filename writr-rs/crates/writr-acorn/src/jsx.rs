//! acorn-jsx 5.3.2 parse functions (`allowNamespaces: true`,
//! `allowNamespacedObjects: false`).

use crate::chars::lossy;
use crate::node::{Node, K, W};
use crate::parser::{ForInit, Parser, R};
use crate::token::T;

impl<'a> Parser<'a> {
	/// `jsx_parseIdentifier`: the name.
	fn jsx_parse_identifier(&mut self) -> R<W> {
		let name = if self.ty == T::JsxName {
			self.value.clone().unwrap_or_default()
		} else if let Some(keyword) = self.ty.keyword() {
			crate::chars::utf16(keyword)
		} else {
			return self.unexpected(None);
		};
		self.next(false)?;
		Ok(name)
	}

	/// `jsx_parseNamespacedName`: the qualified name and whether it is
	/// namespaced.
	fn jsx_parse_namespaced_name(&mut self) -> R<(W, bool)> {
		let name = self.jsx_parse_identifier()?;
		if !self.eat(T::Colon)? {
			return Ok((name, false));
		}
		let local = self.jsx_parse_identifier()?;
		let mut qualified = name;
		qualified.push(58);
		qualified.extend(local);
		Ok((qualified, true))
	}

	/// `jsx_parseElementName`: `None` for fragments.
	fn jsx_parse_element_name(&mut self) -> R<Option<W>> {
		if self.ty == T::JsxTagEnd {
			return Ok(None);
		}
		let (mut name, namespaced) = self.jsx_parse_namespaced_name()?;
		if self.ty == T::Dot && namespaced {
			return self.unexpected(None);
		}
		while self.eat(T::Dot)? {
			let property = self.jsx_parse_identifier()?;
			name.push(46);
			name.extend(property);
		}
		Ok(Some(name))
	}

	fn jsx_parse_attribute_value(&mut self) -> R<()> {
		match self.ty {
			T::BraceL => {
				let (start, empty) = self.jsx_parse_expression_container()?;
				if empty {
					return self.raise(
						start,
						"JSX attributes must only be assigned a non-empty expression",
					);
				}
				Ok(())
			}
			T::JsxTagStart | T::String => self.parse_expr_atom(None).map(|_| ()),
			_ => self.raise(
				self.start,
				"JSX value should be either an expression or a quoted JSX text",
			),
		}
	}

	/// `jsx_parseExpressionContainer`: its start and whether it is empty.
	fn jsx_parse_expression_container(&mut self) -> R<(usize, bool)> {
		let start = self.start;
		self.next(false)?;
		let empty = self.ty == T::BraceR;
		if !empty {
			self.parse_expression(ForInit::No, None)?;
		}
		self.expect(T::BraceR)?;
		Ok((start, empty))
	}

	fn jsx_parse_attribute(&mut self) -> R<()> {
		if self.eat(T::BraceL)? {
			self.expect(T::Ellipsis)?;
			self.parse_maybe_assign(ForInit::No, None)?;
			return self.expect(T::BraceR);
		}
		self.jsx_parse_namespaced_name()?;
		if self.eat(T::Eq)? {
			self.jsx_parse_attribute_value()?;
		}
		Ok(())
	}

	/// `jsx_parseOpeningElementAt`: the name and whether it self-closes.
	fn jsx_parse_opening_element_at(&mut self) -> R<(Option<W>, bool)> {
		let name = self.jsx_parse_element_name()?;
		while self.ty != T::Slash && self.ty != T::JsxTagEnd {
			self.jsx_parse_attribute()?;
		}
		let self_closing = self.eat(T::Slash)?;
		self.expect(T::JsxTagEnd)?;
		Ok((name, self_closing))
	}

	fn jsx_parse_element_at(&mut self, start: usize) -> R<Node> {
		self.enter()?;
		let result = self.jsx_parse_element_at_inner(start);
		self.leave();
		result
	}

	fn jsx_parse_element_at_inner(&mut self, start: usize) -> R<Node> {
		let (opening, self_closing) = self.jsx_parse_opening_element_at()?;
		if !self_closing {
			let (closing_start, closing) = loop {
				match self.ty {
					T::JsxTagStart => {
						let child_start = self.start;
						self.next(false)?;
						if self.eat(T::Slash)? {
							let name = self.jsx_parse_element_name()?;
							self.expect(T::JsxTagEnd)?;
							break (child_start, name);
						}
						self.jsx_parse_element_at(child_start)?;
					}
					T::JsxText => {
						self.parse_expr_atom(None)?;
					}
					T::BraceL => {
						self.jsx_parse_expression_container()?;
					}
					_ => return self.unexpected(None),
				}
			};
			if closing != opening {
				return self.raise(
					closing_start,
					format!(
						"Expected corresponding JSX closing tag for <{}>",
						opening
							.as_deref()
							.map_or_else(|| "undefined".to_string(), lossy)
					),
				);
			}
		}
		if self.ty == T::Relational && self.value_is("<") {
			return self.raise(
				self.start,
				"Adjacent JSX elements must be wrapped in an enclosing tag",
			);
		}
		Ok(Node::new(
			start,
			self.last_tok_end,
			K::Other(if opening.is_some() {
				"JSXElement"
			} else {
				"JSXFragment"
			}),
		))
	}

	pub fn jsx_parse_text(&mut self) -> R<Node> {
		let start = self.start;
		self.next(false)?;
		Ok(Node::new(start, self.last_tok_end, K::Other("JSXText")))
	}

	pub fn jsx_parse_element(&mut self) -> R<Node> {
		let start = self.start;
		self.next(false)?;
		self.jsx_parse_element_at(start)
	}
}

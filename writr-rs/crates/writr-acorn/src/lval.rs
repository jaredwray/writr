//! Port of acorn's `lval.js`: expression-to-pattern conversion, binding
//! patterns, and the `checkLVal*` family.

use std::collections::HashSet;

use crate::chars::{eq, lossy};
use crate::node::{Node, PropKind, K, W};
use crate::parser::{De, ForInit, Parser, BIND_LEXICAL, BIND_NONE, BIND_OUTSIDE, R};
use crate::token::T;

const RESERVED_STRICT_BIND: &[&str] = &[
	"enum",
	"await",
	"implements",
	"interface",
	"let",
	"package",
	"private",
	"protected",
	"public",
	"static",
	"yield",
	"eval",
	"arguments",
];

pub fn is_reserved_strict_bind(name: &[u16]) -> bool {
	RESERVED_STRICT_BIND.iter().any(|word| eq(name, word))
}

fn take(node: &mut Node) -> K {
	std::mem::replace(&mut node.k, K::Other(""))
}

impl<'a> Parser<'a> {
	/// `toAssignable(node, isBinding, refDestructuringErrors)`.
	#[allow(clippy::wrong_self_convention)] // acorn's name
	pub fn to_assignable(&mut self, node: &mut Node, is_binding: bool, rde: Option<&De>) -> R<()> {
		match take(node) {
			K::Ident(name) => {
				let is_await = eq(&name, "await");
				node.k = K::Ident(name);
				if self.in_async() && is_await {
					return self.raise(
						node.start,
						"Cannot use 'await' as identifier inside an async function",
					);
				}
			}
			k @ (K::ObjPat(_) | K::ArrPat(_) | K::AssignPat { .. } | K::Rest(_)) => node.k = k,
			K::Obj(mut props) => {
				if rde.is_some() {
					self.check_pattern_errors(rde, true)?;
				}
				for prop in &mut props {
					self.to_assignable(prop, is_binding, None)?;
					if let K::Rest(argument) = &prop.k {
						if matches!(argument.k, K::ArrPat(_) | K::ObjPat(_)) {
							return self.raise(argument.start, "Unexpected token");
						}
					}
				}
				node.k = K::ObjPat(props);
			}
			K::Prop(mut prop) => {
				if prop.kind != PropKind::Init {
					return self.raise(
						prop.key.start,
						"Object pattern can't contain getter or setter",
					);
				}
				self.to_assignable(&mut prop.value, is_binding, None)?;
				node.k = K::Prop(prop);
			}
			K::Arr(mut elements) => {
				if rde.is_some() {
					self.check_pattern_errors(rde, true)?;
				}
				self.to_assignable_list(&mut elements, is_binding)?;
				node.k = K::ArrPat(elements);
			}
			K::Spread(mut argument) => {
				self.to_assignable(&mut argument, is_binding, None)?;
				if matches!(argument.k, K::AssignPat { .. }) {
					return self.raise(argument.start, "Rest elements cannot have a default value");
				}
				node.k = K::Rest(argument);
			}
			K::Assign {
				eq: is_eq,
				mut left,
			} => {
				if !is_eq {
					return self.raise(
						left.end,
						"Only '=' operator can be used for specifying default value.",
					);
				}
				self.to_assignable(&mut left, is_binding, None)?;
				node.k = K::AssignPat { left };
			}
			K::Paren(mut expression) => {
				self.to_assignable(&mut expression, is_binding, rde)?;
				node.k = K::Paren(expression);
			}
			k @ K::Chain(_) => {
				node.k = k;
				return self.raise(
					node.start,
					"Optional chaining cannot appear in left-hand side",
				);
			}
			k @ K::Member { .. } if !is_binding => node.k = k,
			k => {
				node.k = k;
				return self.raise(node.start, "Assigning to rvalue");
			}
		}
		Ok(())
	}

	#[allow(clippy::wrong_self_convention)] // acorn's name
	pub fn to_assignable_list(&mut self, list: &mut [Option<Node>], is_binding: bool) -> R<()> {
		for element in list.iter_mut().flatten() {
			self.to_assignable(element, is_binding, None)?;
		}
		Ok(())
	}

	pub fn parse_spread(&mut self, rde: Option<&mut De>) -> R<Node> {
		let start = self.start;
		self.next(false)?;
		let argument = self.parse_maybe_assign(ForInit::No, rde)?;
		Ok(Node::new(
			start,
			self.last_tok_end,
			K::Spread(Box::new(argument)),
		))
	}

	pub fn parse_rest_binding(&mut self) -> R<Node> {
		let start = self.start;
		self.next(false)?;
		let argument = self.parse_binding_atom()?;
		Ok(Node::new(
			start,
			self.last_tok_end,
			K::Rest(Box::new(argument)),
		))
	}

	pub fn parse_binding_atom(&mut self) -> R<Node> {
		self.enter()?;
		let result = match self.ty {
			T::BracketL => {
				let start = self.start;
				self.next(false)?;
				let elements = self.parse_binding_list(T::BracketR, true, true)?;
				Ok(Node::new(start, self.last_tok_end, K::ArrPat(elements)))
			}
			T::BraceL => self.parse_obj(true, None),
			_ => self.parse_ident(false),
		};
		self.leave();
		result
	}

	pub fn parse_binding_list(
		&mut self,
		close: T,
		allow_empty: bool,
		allow_trailing_comma: bool,
	) -> R<Vec<Option<Node>>> {
		let mut elements = Vec::new();
		let mut first = true;
		while !self.eat(close)? {
			if first {
				first = false;
			} else {
				self.expect(T::Comma)?;
			}
			if allow_empty && self.ty == T::Comma {
				elements.push(None);
			} else if allow_trailing_comma && self.after_trailing_comma(close, false)? {
				break;
			} else if self.ty == T::Ellipsis {
				let rest = self.parse_rest_binding()?;
				elements.push(Some(rest));
				if self.ty == T::Comma {
					return self.raise(self.start, "Comma is not permitted after the rest element");
				}
				self.expect(close)?;
				break;
			} else {
				let start = self.start;
				elements.push(Some(self.parse_maybe_default(start, None)?));
			}
		}
		Ok(elements)
	}

	pub fn parse_maybe_default(&mut self, start: usize, left: Option<Node>) -> R<Node> {
		let left = match left {
			Some(left) => left,
			None => self.parse_binding_atom()?,
		};
		if !self.eat(T::Eq)? {
			return Ok(left);
		}
		self.parse_maybe_assign(ForInit::No, None)?;
		Ok(Node::new(
			start,
			self.last_tok_end,
			K::AssignPat {
				left: Box::new(left),
			},
		))
	}

	pub fn check_lval_simple(
		&mut self,
		expr: &Node,
		binding_type: u8,
		check_clashes: Option<&mut HashSet<W>>,
	) -> R<()> {
		let is_bind = binding_type != BIND_NONE;
		match &expr.k {
			K::Ident(name) => {
				if self.strict && is_reserved_strict_bind(name) {
					return self.raise(
						expr.start,
						format!(
							"{}{} in strict mode",
							if is_bind { "Binding " } else { "Assigning to " },
							lossy(name)
						),
					);
				}
				if is_bind {
					if binding_type == BIND_LEXICAL && eq(name, "let") {
						return self
							.raise(expr.start, "let is disallowed as a lexically bound name");
					}
					if let Some(clashes) = check_clashes {
						if clashes.contains(name) {
							return self.raise(expr.start, "Argument name clash");
						}
						clashes.insert(name.clone());
					}
					if binding_type != BIND_OUTSIDE {
						self.declare_name(name, binding_type, expr.start)?;
					}
				}
				Ok(())
			}
			K::Chain(_) => self.raise(
				expr.start,
				"Optional chaining cannot appear in left-hand side",
			),
			K::Member { .. } => {
				if is_bind {
					return self.raise(expr.start, "Binding member expression");
				}
				Ok(())
			}
			K::Paren(inner) => {
				if is_bind {
					return self.raise(expr.start, "Binding parenthesized expression");
				}
				self.check_lval_simple(inner, binding_type, check_clashes)
			}
			_ => self.raise(
				expr.start,
				format!(
					"{} rvalue",
					if is_bind { "Binding" } else { "Assigning to" }
				),
			),
		}
	}

	pub fn check_lval_pattern(
		&mut self,
		expr: &Node,
		binding_type: u8,
		mut check_clashes: Option<&mut HashSet<W>>,
	) -> R<()> {
		match &expr.k {
			K::ObjPat(properties) => {
				for prop in properties {
					self.check_lval_inner_pattern(
						prop,
						binding_type,
						check_clashes.as_deref_mut(),
					)?;
				}
				Ok(())
			}
			K::ArrPat(elements) => {
				for element in elements.iter().flatten() {
					self.check_lval_inner_pattern(
						element,
						binding_type,
						check_clashes.as_deref_mut(),
					)?;
				}
				Ok(())
			}
			_ => self.check_lval_simple(expr, binding_type, check_clashes),
		}
	}

	pub fn check_lval_inner_pattern(
		&mut self,
		expr: &Node,
		binding_type: u8,
		check_clashes: Option<&mut HashSet<W>>,
	) -> R<()> {
		match &expr.k {
			K::Prop(prop) => {
				self.check_lval_inner_pattern(&prop.value, binding_type, check_clashes)
			}
			K::AssignPat { left } => self.check_lval_pattern(left, binding_type, check_clashes),
			K::Rest(argument) => self.check_lval_pattern(argument, binding_type, check_clashes),
			_ => self.check_lval_pattern(expr, binding_type, check_clashes),
		}
	}
}

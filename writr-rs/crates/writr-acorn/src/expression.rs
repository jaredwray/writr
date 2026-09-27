//! Port of acorn's `expression.js`, with acorn-jsx's `parseExprAtom`
//! override (which drops the `forInit`/`forNew` arguments) applied.

use crate::chars::{eq, has_line_break, lossy};
use crate::node::{Node, Prop, PropKind, K, W};
use crate::parser::{
	function_flags, De, ForInit, Parser, BIND_NONE, BIND_VAR, R, SCOPE_ARROW, SCOPE_DIRECT_SUPER,
	SCOPE_SUPER, SCOPE_VAR,
};
use crate::token::{Ctx, T};

const RESERVED: &[&str] = &["enum", "await"];
const RESERVED_STRICT: &[&str] = &[
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
];

/// What a function body is being parsed for (the node fields
/// `parseFunctionBody` reads).
pub struct FnInfo<'n> {
	pub start: usize,
	pub params: &'n [Node],
	pub id: Option<&'n Node>,
}

fn is_local_variable_access(node: &Node) -> bool {
	match &node.k {
		K::Ident(_) => true,
		K::Paren(inner) => is_local_variable_access(inner),
		_ => false,
	}
}

fn is_private_field_access(node: &Node) -> bool {
	match &node.k {
		K::Member { private, .. } => *private,
		K::Chain(inner) | K::Paren(inner) => is_private_field_access(inner),
		_ => false,
	}
}

impl<'a> Parser<'a> {
	fn check_prop_clash(&self, prop: &Node, proto: &mut bool, rde: Option<&mut De>) -> R<()> {
		let K::Prop(p) = &prop.k else { return Ok(()) };
		if p.computed || p.method || p.shorthand {
			return Ok(());
		}
		let is_proto = match &p.key.k {
			K::Ident(name) => eq(name, "__proto__"),
			K::Lit(Some(value)) => eq(value, "__proto__"),
			K::Lit(None) => false,
			_ => return Ok(()),
		};
		if is_proto && p.kind == PropKind::Init {
			if *proto {
				match rde {
					Some(rde) => {
						if rde.double_proto < 0 {
							rde.double_proto = p.key.start as i64;
						}
					}
					None => {
						return self.raise(p.key.start, "Redefinition of __proto__ property");
					}
				}
			}
			*proto = true;
		}
		Ok(())
	}

	/// `parseExpression(forInit, refDestructuringErrors)`.
	pub fn parse_expression(&mut self, for_init: ForInit, rde: Option<&mut De>) -> R<Node> {
		let result = self.parse_expression_inner(for_init, rde);
		self.catch_overflow(result)
	}

	fn parse_expression_inner(&mut self, for_init: ForInit, mut rde: Option<&mut De>) -> R<Node> {
		let start = self.start;
		let expr = self.parse_maybe_assign(for_init, rde.as_deref_mut())?;
		if self.ty == T::Comma {
			while self.eat(T::Comma)? {
				self.parse_maybe_assign(for_init, rde.as_deref_mut())?;
			}
			return Ok(Node::new(
				start,
				self.last_tok_end,
				K::Other("SequenceExpression"),
			));
		}
		Ok(expr)
	}

	/// `parseMaybeAssign(forInit, refDestructuringErrors)`; the
	/// `afterLeftParse` hook is always the identity `parseParenItem`.
	pub fn parse_maybe_assign(&mut self, for_init: ForInit, rde: Option<&mut De>) -> R<Node> {
		self.enter()?;
		let result = self.parse_maybe_assign_inner(for_init, rde);
		self.leave();
		result
	}

	fn parse_maybe_assign_inner(&mut self, for_init: ForInit, rde: Option<&mut De>) -> R<Node> {
		if self.is_contextual("yield") {
			if self.in_generator() {
				return self.parse_yield(for_init);
			}
			self.expr_allowed = false;
		}
		let mut own = De::new();
		let own_destructuring_errors = rde.is_none();
		let rde: &mut De = match rde {
			Some(rde) => rde,
			None => &mut own,
		};
		let (old_paren_assign, old_trailing_comma, old_double_proto) = if own_destructuring_errors {
			(-1, -1, -1)
		} else {
			let old = (
				rde.parenthesized_assign,
				rde.trailing_comma,
				rde.double_proto,
			);
			rde.parenthesized_assign = -1;
			rde.trailing_comma = -1;
			old
		};
		let start = self.start;
		if self.ty == T::ParenL || self.ty == T::Name {
			self.potential_arrow_at = self.start as i64;
			self.potential_arrow_in_for_await = for_init == ForInit::Await;
		}
		let mut left = self.parse_maybe_conditional(for_init, Some(rde))?;
		if self.ty.is_assign() {
			let is_eq = self.ty == T::Eq;
			if is_eq {
				self.to_assignable(&mut left, false, Some(rde))?;
			}
			if !own_destructuring_errors {
				rde.parenthesized_assign = -1;
				rde.trailing_comma = -1;
				rde.double_proto = -1;
			}
			if rde.shorthand_assign >= left.start as i64 {
				rde.shorthand_assign = -1;
			}
			if is_eq {
				self.check_lval_pattern(&left, BIND_NONE, None)?;
			} else {
				self.check_lval_simple(&left, BIND_NONE, None)?;
			}
			self.next(false)?;
			self.parse_maybe_assign(for_init, None)?;
			if old_double_proto > -1 {
				rde.double_proto = old_double_proto;
			}
			return Ok(Node::new(
				start,
				self.last_tok_end,
				K::Assign {
					eq: is_eq,
					left: Box::new(left),
				},
			));
		} else if own_destructuring_errors {
			self.check_expression_errors(Some(rde), true)?;
		}
		if old_paren_assign > -1 {
			rde.parenthesized_assign = old_paren_assign;
		}
		if old_trailing_comma > -1 {
			rde.trailing_comma = old_trailing_comma;
		}
		Ok(left)
	}

	fn parse_maybe_conditional(&mut self, for_init: ForInit, mut rde: Option<&mut De>) -> R<Node> {
		let start = self.start;
		let expr = self.parse_expr_ops(for_init, rde.as_deref_mut())?;
		if self.check_expression_errors(rde.as_deref(), false)? {
			return Ok(expr);
		}
		if !(matches!(expr.k, K::Arrow) && expr.start == start) && self.eat(T::Question)? {
			self.parse_maybe_assign(ForInit::No, None)?;
			self.expect(T::Colon)?;
			self.parse_maybe_assign(for_init, None)?;
			return Ok(Node::new(
				start,
				self.last_tok_end,
				K::Other("ConditionalExpression"),
			));
		}
		Ok(expr)
	}

	fn parse_expr_ops(&mut self, for_init: ForInit, mut rde: Option<&mut De>) -> R<Node> {
		let start = self.start;
		let expr = self.parse_maybe_unary(rde.as_deref_mut(), false, false, for_init)?;
		if self.check_expression_errors(rde.as_deref(), false)? {
			return Ok(expr);
		}
		if expr.start == start && matches!(expr.k, K::Arrow) {
			return Ok(expr);
		}
		self.parse_expr_op(expr, start, -1, for_init)
	}

	fn parse_expr_op(
		&mut self,
		mut left: Node,
		left_start: usize,
		min_prec: i32,
		for_init: ForInit,
	) -> R<Node> {
		// The trailing `return this.parseExprOp(node, ...)` is a loop here.
		loop {
			let Some(mut prec) = self.ty.binop() else {
				return Ok(left);
			};
			if for_init.truthy() && self.ty == T::In {
				return Ok(left);
			}
			if prec <= min_prec {
				return Ok(left);
			}
			let logical = self.ty == T::LogicalOr || self.ty == T::LogicalAnd;
			let coalesce = self.ty == T::Coalesce;
			if coalesce {
				prec = 2;
			}
			self.next(false)?;
			let start = self.start;
			self.enter()?;
			let unary = self.parse_maybe_unary(None, false, false, for_init);
			let right = match unary {
				Ok(unary) => self.parse_expr_op(unary, start, prec, for_init),
				Err(error) => Err(error),
			};
			self.leave();
			let right = right?;
			left = self.build_binary(left_start, left, right, logical || coalesce)?;
			if (logical && self.ty == T::Coalesce)
				|| (coalesce && (self.ty == T::LogicalOr || self.ty == T::LogicalAnd))
			{
				return self.raise(
					self.start,
					"Logical expressions and coalesce expressions cannot be mixed. Wrap either by parentheses",
				);
			}
		}
	}

	fn build_binary(&self, start: usize, _left: Node, right: Node, logical: bool) -> R<Node> {
		if matches!(right.k, K::PrivateIdent(_)) {
			return self.raise(
				right.start,
				"Private identifier can only be left side of binary expression",
			);
		}
		Ok(Node::new(
			start,
			self.last_tok_end,
			K::Other(if logical {
				"LogicalExpression"
			} else {
				"BinaryExpression"
			}),
		))
	}

	fn parse_maybe_unary(
		&mut self,
		rde: Option<&mut De>,
		saw_unary: bool,
		inc_dec: bool,
		for_init: ForInit,
	) -> R<Node> {
		self.enter()?;
		let result = self.parse_maybe_unary_inner(rde, saw_unary, inc_dec, for_init);
		self.leave();
		result
	}

	fn parse_maybe_unary_inner(
		&mut self,
		rde: Option<&mut De>,
		mut saw_unary: bool,
		inc_dec: bool,
		for_init: ForInit,
	) -> R<Node> {
		let start = self.start;
		let mut expr;
		if self.is_contextual("await") && self.can_await() {
			expr = self.parse_await(for_init)?;
			saw_unary = true;
		} else if self.ty.prefix() {
			let update = self.ty == T::IncDec;
			let is_delete = self.ty == T::Delete;
			self.next(false)?;
			let argument = self.parse_maybe_unary(None, true, update, for_init)?;
			self.check_expression_errors(rde.as_deref(), true)?;
			if update {
				self.check_lval_simple(&argument, BIND_NONE, None)?;
			} else if self.strict && is_delete && is_local_variable_access(&argument) {
				return self.raise(start, "Deleting local variable in strict mode");
			} else if is_delete && is_private_field_access(&argument) {
				return self.raise(start, "Private fields can not be deleted");
			} else {
				saw_unary = true;
			}
			expr = Node::new(
				start,
				self.last_tok_end,
				K::Other(if update {
					"UpdateExpression"
				} else {
					"UnaryExpression"
				}),
			);
		} else if !saw_unary && self.ty == T::PrivateId {
			if for_init.truthy() || self.private_name_stack.is_empty() {
				return self.unexpected(None);
			}
			expr = self.parse_private_ident()?;
			if self.ty != T::In {
				return self.unexpected(None);
			}
		} else {
			let mut rde = rde;
			expr = self.parse_expr_subscripts(rde.as_deref_mut(), for_init)?;
			if self.check_expression_errors(rde.as_deref(), false)? {
				return Ok(expr);
			}
			while self.ty.postfix() && !self.can_insert_semicolon() {
				self.check_lval_simple(&expr, BIND_NONE, None)?;
				self.next(false)?;
				expr = Node::new(start, self.last_tok_end, K::Other("UpdateExpression"));
			}
		}
		if !(inc_dec || matches!(expr.k, K::Arrow) && expr.start == start)
			&& self.eat(T::Starstar)?
		{
			if saw_unary {
				return self.unexpected(Some(self.last_tok_start));
			}
			let right = self.parse_maybe_unary(None, false, false, for_init)?;
			return self.build_binary(start, expr, right, false);
		}
		Ok(expr)
	}

	pub fn parse_expr_subscripts(&mut self, rde: Option<&mut De>, for_init: ForInit) -> R<Node> {
		let start = self.start;
		let mut rde = rde;
		let expr = self.parse_expr_atom(rde.as_deref_mut())?;
		if matches!(expr.k, K::Arrow)
			&& !eq(self.slice(self.last_tok_start, self.last_tok_end), ")")
		{
			return Ok(expr);
		}
		let result = self.parse_subscripts(expr, start, false, for_init)?;
		if let Some(rde) = rde {
			if matches!(result.k, K::Member { .. }) {
				let start = result.start as i64;
				if rde.parenthesized_assign >= start {
					rde.parenthesized_assign = -1;
				}
				if rde.parenthesized_bind >= start {
					rde.parenthesized_bind = -1;
				}
				if rde.trailing_comma >= start {
					rde.trailing_comma = -1;
				}
			}
		}
		Ok(result)
	}

	fn parse_subscripts(
		&mut self,
		mut base: Node,
		start: usize,
		no_calls: bool,
		for_init: ForInit,
	) -> R<Node> {
		let maybe_async_arrow = base.is_ident("async")
			&& self.last_tok_end == base.end
			&& !self.can_insert_semicolon()
			&& base.end - base.start == 5
			&& self.potential_arrow_at == base.start as i64;
		let mut optional_chained = false;
		loop {
			let (element, changed) = self.parse_subscript(
				base,
				start,
				no_calls,
				maybe_async_arrow,
				optional_chained,
				for_init,
			)?;
			if element.optional() {
				optional_chained = true;
			}
			if !changed || matches!(element.k, K::Arrow) {
				if optional_chained {
					return Ok(Node::new(
						start,
						self.last_tok_end,
						K::Chain(Box::new(element)),
					));
				}
				return Ok(element);
			}
			base = element;
		}
	}

	fn parse_subscript(
		&mut self,
		base: Node,
		start: usize,
		no_calls: bool,
		maybe_async_arrow: bool,
		optional_chained: bool,
		for_init: ForInit,
	) -> R<(Node, bool)> {
		let optional = self.eat(T::QuestionDot)?;
		if no_calls && optional {
			return self.raise(
				self.last_tok_start,
				"Optional chaining cannot appear in the callee of new expressions",
			);
		}
		let computed = self.eat(T::BracketL)?;
		if computed
			|| (optional && self.ty != T::ParenL && self.ty != T::BackQuote)
			|| self.eat(T::Dot)?
		{
			let private;
			if computed {
				self.parse_expression(ForInit::No, None)?;
				self.expect(T::BracketR)?;
				private = false;
			} else if self.ty == T::PrivateId && !matches!(base.k, K::Super) {
				self.parse_private_ident()?;
				private = true;
			} else {
				self.parse_ident(true)?;
				private = false;
			}
			return Ok((
				Node::new(start, self.last_tok_end, K::Member { private, optional }),
				true,
			));
		} else if !no_calls && self.eat(T::ParenL)? {
			let mut rde = De::new();
			let old_yield = self.yield_pos;
			let old_await = self.await_pos;
			let old_await_ident = self.await_ident_pos;
			self.yield_pos = 0;
			self.await_pos = 0;
			self.await_ident_pos = 0;
			let list = self.parse_expr_list(T::ParenR, true, false, Some(&mut rde))?;
			if maybe_async_arrow
				&& !optional && !self.can_insert_semicolon()
				&& self.eat(T::Arrow)?
			{
				self.check_pattern_errors(Some(&rde), false)?;
				self.check_yield_await_in_default_params()?;
				if self.await_ident_pos > 0 {
					return self.raise(
						self.await_ident_pos,
						"Cannot use 'await' as identifier inside an async function",
					);
				}
				self.yield_pos = old_yield;
				self.await_pos = old_await;
				self.await_ident_pos = old_await_ident;
				let params = list.into_iter().flatten().collect();
				return Ok((
					self.parse_arrow_expression(start, params, true, for_init)?,
					true,
				));
			}
			self.check_expression_errors(Some(&rde), true)?;
			if old_yield != 0 {
				self.yield_pos = old_yield;
			}
			if old_await != 0 {
				self.await_pos = old_await;
			}
			if old_await_ident != 0 {
				self.await_ident_pos = old_await_ident;
			}
			return Ok((
				Node::new(start, self.last_tok_end, K::Call { optional }),
				true,
			));
		} else if self.ty == T::BackQuote {
			if optional || optional_chained {
				return self.raise(
					self.start,
					"Optional chaining cannot appear in the tag of tagged template expressions",
				);
			}
			self.parse_template(true)?;
			return Ok((
				Node::new(
					start,
					self.last_tok_end,
					K::Other("TaggedTemplateExpression"),
				),
				true,
			));
		}
		Ok((base, false))
	}

	/// acorn-jsx `parseExprAtom(refDestructuringErrors)`; it forwards only
	/// the first argument, so acorn's `forInit`/`forNew` are always unset.
	pub fn parse_expr_atom(&mut self, rde: Option<&mut De>) -> R<Node> {
		// `new new …` and `class extends class extends …` recurse through
		// here alone.
		self.enter()?;
		let atom = self.parse_expr_atom_inner(rde);
		self.leave();
		atom
	}

	fn parse_expr_atom_inner(&mut self, rde: Option<&mut De>) -> R<Node> {
		if self.ty == T::JsxText {
			return self.jsx_parse_text();
		}
		if self.ty == T::JsxTagStart {
			return self.jsx_parse_element();
		}
		if self.ty == T::Slash {
			self.read_regexp()?;
		}
		let can_be_arrow = self.potential_arrow_at == self.start as i64;
		let start = self.start;
		match self.ty {
			T::Super => {
				if !self.allow_super() {
					return self.raise(self.start, "'super' keyword outside a method");
				}
				self.next(false)?;
				if self.ty == T::ParenL && !self.allow_direct_super() {
					return self.raise(start, "super() call outside constructor of a subclass");
				}
				if self.ty != T::Dot && self.ty != T::BracketL && self.ty != T::ParenL {
					return self.unexpected(None);
				}
				Ok(Node::new(start, self.last_tok_end, K::Super))
			}
			T::This => {
				self.next(false)?;
				Ok(Node::new(
					start,
					self.last_tok_end,
					K::Other("ThisExpression"),
				))
			}
			T::Name => {
				let contains_esc = self.contains_esc;
				let mut id = self.parse_ident(false)?;
				if !contains_esc
					&& id.is_ident("async")
					&& !self.can_insert_semicolon()
					&& self.eat(T::Function)?
				{
					self.override_context(Ctx::FExpr);
					return self.parse_function(start, 0, false, true, ForInit::No);
				}
				if can_be_arrow && !self.can_insert_semicolon() {
					if self.eat(T::Arrow)? {
						return self.parse_arrow_expression(start, vec![id], false, ForInit::No);
					}
					if id.is_ident("async")
						&& self.ty == T::Name
						&& !contains_esc && (!self.potential_arrow_in_for_await
						|| !self.value_is("of")
						|| self.contains_esc)
					{
						id = self.parse_ident(false)?;
						if self.can_insert_semicolon() || !self.eat(T::Arrow)? {
							return self.unexpected(None);
						}
						return self.parse_arrow_expression(start, vec![id], true, ForInit::No);
					}
				}
				Ok(id)
			}
			T::Regexp | T::Num | T::String => self.parse_literal(),
			T::Null | T::True | T::False => {
				self.next(false)?;
				Ok(Node::new(start, self.last_tok_end, K::Lit(None)))
			}
			T::ParenL => {
				let expr =
					self.parse_paren_and_distinguish_expression(can_be_arrow, ForInit::No)?;
				if let Some(rde) = rde {
					if rde.parenthesized_assign < 0 && !self.is_simple_assign_target(&expr) {
						rde.parenthesized_assign = start as i64;
					}
					if rde.parenthesized_bind < 0 {
						rde.parenthesized_bind = start as i64;
					}
				}
				Ok(expr)
			}
			T::BracketL => {
				self.next(false)?;
				let elements = self.parse_expr_list(T::BracketR, true, true, rde)?;
				Ok(Node::new(start, self.last_tok_end, K::Arr(elements)))
			}
			T::BraceL => {
				self.override_context(Ctx::BExpr);
				self.parse_obj(false, rde)
			}
			T::Function => {
				self.next(false)?;
				self.parse_function(start, 0, false, false, ForInit::No)
			}
			T::Class => self.parse_class(start, crate::statement::ClassKind::Expression),
			T::New => self.parse_new(),
			T::BackQuote => self.parse_template(false),
			T::Import => self.parse_expr_import(false),
			_ => self.unexpected(None),
		}
	}

	fn parse_expr_import(&mut self, for_new: bool) -> R<Node> {
		let start = self.start;
		if self.contains_esc {
			return self.raise(self.start, "Escape sequence in keyword import");
		}
		self.next(false)?;
		if self.ty == T::ParenL && !for_new {
			self.parse_dynamic_import(start)
		} else if self.ty == T::Dot {
			self.parse_import_meta(start)
		} else {
			self.unexpected(None)
		}
	}

	fn parse_dynamic_import(&mut self, start: usize) -> R<Node> {
		self.next(false)?;
		self.parse_maybe_assign(ForInit::No, None)?;
		if !self.eat(T::ParenR)? {
			let error_pos = self.start;
			if self.eat(T::Comma)? && self.eat(T::ParenR)? {
				return self.raise(error_pos, "Trailing comma is not allowed in import()");
			}
			return self.unexpected(Some(error_pos));
		}
		Ok(Node::new(
			start,
			self.last_tok_end,
			K::Other("ImportExpression"),
		))
	}

	fn parse_import_meta(&mut self, start: usize) -> R<Node> {
		self.next(false)?;
		let contains_esc = self.contains_esc;
		let property = self.parse_ident(true)?;
		if !property.is_ident("meta") {
			return self.raise(
				property.start,
				"The only valid meta property for import is 'import.meta'",
			);
		}
		if contains_esc {
			return self.raise(start, "'import.meta' must not contain escaped characters");
		}
		Ok(Node::new(
			start,
			self.last_tok_end,
			K::Other("MetaProperty"),
		))
	}

	pub fn parse_literal(&mut self) -> R<Node> {
		let start = self.start;
		let value = if self.ty == T::String {
			self.value.clone()
		} else {
			None
		};
		self.next(false)?;
		Ok(Node::new(start, self.last_tok_end, K::Lit(value)))
	}

	pub fn parse_paren_expression(&mut self) -> R<Node> {
		self.expect(T::ParenL)?;
		let value = self.parse_expression(ForInit::No, None)?;
		self.expect(T::ParenR)?;
		Ok(value)
	}

	fn parse_paren_and_distinguish_expression(
		&mut self,
		can_be_arrow: bool,
		for_init: ForInit,
	) -> R<Node> {
		let start = self.start;
		self.next(false)?;
		let inner_start = self.start;
		let mut list: Vec<Node> = Vec::new();
		let mut first = true;
		let mut last_is_comma = false;
		let mut rde = De::new();
		let old_yield = self.yield_pos;
		let old_await = self.await_pos;
		let mut spread_start: Option<usize> = None;
		self.yield_pos = 0;
		self.await_pos = 0;
		while self.ty != T::ParenR {
			if first {
				first = false;
			} else {
				self.expect(T::Comma)?;
			}
			if self.after_trailing_comma(T::ParenR, true)? {
				last_is_comma = true;
				break;
			} else if self.ty == T::Ellipsis {
				spread_start = Some(self.start);
				list.push(self.parse_rest_binding()?);
				if self.ty == T::Comma {
					return self.raise(self.start, "Comma is not permitted after the rest element");
				}
				break;
			} else {
				list.push(self.parse_maybe_assign(ForInit::No, Some(&mut rde))?);
			}
		}
		let inner_end = self.last_tok_end;
		self.expect(T::ParenR)?;
		if can_be_arrow && !self.can_insert_semicolon() && self.eat(T::Arrow)? {
			self.check_pattern_errors(Some(&rde), false)?;
			self.check_yield_await_in_default_params()?;
			self.yield_pos = old_yield;
			self.await_pos = old_await;
			return self.parse_arrow_expression(start, list, false, for_init);
		}
		if list.is_empty() || last_is_comma {
			return self.unexpected(Some(self.last_tok_start));
		}
		if let Some(spread_start) = spread_start {
			return self.unexpected(Some(spread_start));
		}
		self.check_expression_errors(Some(&rde), true)?;
		if old_yield != 0 {
			self.yield_pos = old_yield;
		}
		if old_await != 0 {
			self.await_pos = old_await;
		}
		let value = if list.len() > 1 {
			Node::new(inner_start, inner_end, K::Other("SequenceExpression"))
		} else {
			list.pop().unwrap()
		};
		Ok(Node::new(
			start,
			self.last_tok_end,
			K::Paren(Box::new(value)),
		))
	}

	fn parse_new(&mut self) -> R<Node> {
		if self.contains_esc {
			return self.raise(self.start, "Escape sequence in keyword new");
		}
		let start = self.start;
		self.next(false)?;
		if self.ty == T::Dot {
			self.next(false)?;
			let contains_esc = self.contains_esc;
			let property = self.parse_ident(true)?;
			if !property.is_ident("target") {
				return self.raise(
					property.start,
					"The only valid meta property for new is 'new.target'",
				);
			}
			if contains_esc {
				return self.raise(start, "'new.target' must not contain escaped characters");
			}
			if !self.allow_new_dot_target() {
				return self.raise(
					start,
					"'new.target' can only be used in functions and class static block",
				);
			}
			return Ok(Node::new(
				start,
				self.last_tok_end,
				K::Other("MetaProperty"),
			));
		}
		let callee_start = self.start;
		let atom = self.parse_expr_atom(None)?;
		let callee = self.parse_subscripts(atom, callee_start, true, ForInit::No)?;
		if matches!(callee.k, K::Super) {
			return self.raise(callee_start, "Invalid use of 'super'");
		}
		if self.eat(T::ParenL)? {
			self.parse_expr_list(T::ParenR, true, false, None)?;
		}
		Ok(Node::new(
			start,
			self.last_tok_end,
			K::Other("NewExpression"),
		))
	}

	fn parse_template_element(&mut self, is_tagged: bool) -> R<bool> {
		if self.ty == T::InvalidTemplate && !is_tagged {
			return self.raise(
				self.start,
				"Bad escape sequence in untagged template literal",
			);
		}
		self.next(false)?;
		Ok(self.ty == T::BackQuote)
	}

	pub fn parse_template(&mut self, is_tagged: bool) -> R<Node> {
		let start = self.start;
		self.next(false)?;
		let mut tail = self.parse_template_element(is_tagged)?;
		while !tail {
			if self.ty == T::Eof {
				return self.raise(self.pos, "Unterminated template literal");
			}
			self.expect(T::DollarBraceL)?;
			self.parse_expression(ForInit::No, None)?;
			self.expect(T::BraceR)?;
			tail = self.parse_template_element(is_tagged)?;
		}
		self.next(false)?;
		Ok(Node::new(
			start,
			self.last_tok_end,
			K::Other("TemplateLiteral"),
		))
	}

	fn is_async_prop(&self, key: &Node, computed: bool) -> bool {
		!computed
			&& key.is_ident("async")
			&& (matches!(
				self.ty,
				T::Name | T::Num | T::String | T::BracketL | T::Star
			) || self.ty.keyword().is_some())
			&& !has_line_break(self.input, self.last_tok_end, self.start)
	}

	/// `parseObj(isPattern, refDestructuringErrors)`.
	pub fn parse_obj(&mut self, is_pattern: bool, mut rde: Option<&mut De>) -> R<Node> {
		let start = self.start;
		let mut first = true;
		let mut proto = false;
		let mut properties = Vec::new();
		self.next(false)?;
		while !self.eat(T::BraceR)? {
			if !first {
				self.expect(T::Comma)?;
				if self.after_trailing_comma(T::BraceR, false)? {
					break;
				}
			} else {
				first = false;
			}
			let prop = self.parse_property(is_pattern, rde.as_deref_mut())?;
			if !is_pattern {
				self.check_prop_clash(&prop, &mut proto, rde.as_deref_mut())?;
			}
			properties.push(prop);
		}
		Ok(Node::new(
			start,
			self.last_tok_end,
			if is_pattern {
				K::ObjPat(properties)
			} else {
				K::Obj(properties)
			},
		))
	}

	fn parse_property(&mut self, is_pattern: bool, rde: Option<&mut De>) -> R<Node> {
		let start = self.start;
		if self.eat(T::Ellipsis)? {
			if is_pattern {
				let argument = self.parse_ident(false)?;
				if self.ty == T::Comma {
					return self.raise(self.start, "Comma is not permitted after the rest element");
				}
				return Ok(Node::new(
					start,
					self.last_tok_end,
					K::Rest(Box::new(argument)),
				));
			}
			let mut rde = rde;
			let argument = self.parse_maybe_assign(ForInit::No, rde.as_deref_mut())?;
			if self.ty == T::Comma {
				if let Some(rde) = rde {
					if rde.trailing_comma < 0 {
						rde.trailing_comma = self.start as i64;
					}
				}
			}
			return Ok(Node::new(
				start,
				self.last_tok_end,
				K::Spread(Box::new(argument)),
			));
		}
		let value_start = if is_pattern || rde.is_some() {
			Some(self.start)
		} else {
			None
		};
		let mut is_generator = if !is_pattern {
			self.eat(T::Star)?
		} else {
			false
		};
		let contains_esc = self.contains_esc;
		let (mut key, mut computed) = self.parse_property_name()?;
		let is_async;
		if !is_pattern && !contains_esc && !is_generator && self.is_async_prop(&key, computed) {
			is_async = true;
			is_generator = self.eat(T::Star)?;
			(key, computed) = self.parse_property_name()?;
		} else {
			is_async = false;
		}
		let prop = self.parse_property_value(
			key,
			computed,
			is_pattern,
			is_generator,
			is_async,
			value_start,
			rde,
			contains_esc,
		)?;
		Ok(Node::new(start, self.last_tok_end, K::Prop(Box::new(prop))))
	}

	#[allow(clippy::too_many_arguments)]
	fn parse_property_value(
		&mut self,
		key: Node,
		computed: bool,
		is_pattern: bool,
		is_generator: bool,
		is_async: bool,
		value_start: Option<usize>,
		rde: Option<&mut De>,
		contains_esc: bool,
	) -> R<Prop> {
		if (is_generator || is_async) && self.ty == T::Colon {
			return self.unexpected(None);
		}
		let prop = |key, value, kind, method, shorthand| Prop {
			key,
			value,
			kind,
			method,
			shorthand,
			computed,
		};
		if self.eat(T::Colon)? {
			let value = if is_pattern {
				let start = self.start;
				self.parse_maybe_default(start, None)?
			} else {
				self.parse_maybe_assign(ForInit::No, rde)?
			};
			return Ok(prop(key, value, PropKind::Init, false, false));
		}
		if self.ty == T::ParenL {
			if is_pattern {
				return self.unexpected(None);
			}
			let value = self.parse_method(is_generator, is_async, false)?;
			return Ok(prop(key, value, PropKind::Init, true, false));
		}
		let is_get = key.is_ident("get");
		if !is_pattern
			&& !contains_esc
			&& !computed
			&& (is_get || key.is_ident("set"))
			&& self.ty != T::Comma
			&& self.ty != T::BraceR
			&& self.ty != T::Eq
		{
			if is_generator || is_async {
				return self.unexpected(None);
			}
			let kind = if is_get { PropKind::Get } else { PropKind::Set };
			let (key, computed) = self.parse_property_name()?;
			let value = self.parse_method(false, false, false)?;
			let K::Func { params } = &value.k else {
				unreachable!("methods are function expressions")
			};
			let param_count = if kind == PropKind::Get { 0 } else { 1 };
			if params.len() != param_count {
				return self.raise(
					value.start,
					if kind == PropKind::Get {
						"getter should have no params"
					} else {
						"setter should have exactly one param"
					},
				);
			} else if kind == PropKind::Set && matches!(params[0].k, K::Rest(_)) {
				return self.raise(params[0].start, "Setter cannot use rest params");
			}
			return Ok(Prop {
				key,
				value,
				kind,
				method: false,
				shorthand: false,
				computed,
			});
		}
		if !computed && matches!(key.k, K::Ident(_)) {
			if is_generator || is_async {
				return self.unexpected(None);
			}
			self.check_unreserved(&key)?;
			if key.is_ident("await") && self.await_ident_pos == 0 {
				self.await_ident_pos = value_start.unwrap_or(0);
			}
			let value = if is_pattern {
				self.parse_maybe_default(value_start.unwrap(), Some(key.clone()))?
			} else if self.ty == T::Eq && rde.is_some() {
				let rde = rde.unwrap();
				if rde.shorthand_assign < 0 {
					rde.shorthand_assign = self.start as i64;
				}
				self.parse_maybe_default(value_start.unwrap(), Some(key.clone()))?
			} else {
				key.clone()
			};
			return Ok(prop(key, value, PropKind::Init, false, true));
		}
		self.unexpected(None)
	}

	/// `parsePropertyName`: returns the key and whether it is computed.
	pub fn parse_property_name(&mut self) -> R<(Node, bool)> {
		if self.eat(T::BracketL)? {
			let key = self.parse_maybe_assign(ForInit::No, None)?;
			self.expect(T::BracketR)?;
			return Ok((key, true));
		}
		let key = if self.ty == T::Num || self.ty == T::String {
			self.parse_expr_atom(None)?
		} else {
			self.parse_ident(true)?
		};
		Ok((key, false))
	}

	/// `parseMethod(isGenerator, isAsync, allowDirectSuper)`.
	pub fn parse_method(
		&mut self,
		is_generator: bool,
		is_async: bool,
		allow_direct_super: bool,
	) -> R<Node> {
		let start = self.start;
		let old_yield = self.yield_pos;
		let old_await = self.await_pos;
		let old_await_ident = self.await_ident_pos;
		self.yield_pos = 0;
		self.await_pos = 0;
		self.await_ident_pos = 0;
		self.enter_scope(
			function_flags(is_async, is_generator)
				| SCOPE_SUPER
				| if allow_direct_super {
					SCOPE_DIRECT_SUPER
				} else {
					0
				},
		);
		self.expect(T::ParenL)?;
		let params: Vec<Node> = self
			.parse_binding_list(T::ParenR, false, true)?
			.into_iter()
			.flatten()
			.collect();
		self.check_yield_await_in_default_params()?;
		self.parse_function_body(
			FnInfo {
				start,
				params: &params,
				id: None,
			},
			false,
			true,
			ForInit::No,
		)?;
		self.yield_pos = old_yield;
		self.await_pos = old_await;
		self.await_ident_pos = old_await_ident;
		Ok(Node::new(start, self.last_tok_end, K::Func { params }))
	}

	pub fn parse_arrow_expression(
		&mut self,
		start: usize,
		params: Vec<Node>,
		is_async: bool,
		for_init: ForInit,
	) -> R<Node> {
		let old_yield = self.yield_pos;
		let old_await = self.await_pos;
		let old_await_ident = self.await_ident_pos;
		self.enter_scope(function_flags(is_async, false) | SCOPE_ARROW);
		self.yield_pos = 0;
		self.await_pos = 0;
		self.await_ident_pos = 0;
		let mut params: Vec<Option<Node>> = params.into_iter().map(Some).collect();
		self.to_assignable_list(&mut params, true)?;
		let params: Vec<Node> = params.into_iter().flatten().collect();
		self.parse_function_body(
			FnInfo {
				start,
				params: &params,
				id: None,
			},
			true,
			false,
			for_init,
		)?;
		self.yield_pos = old_yield;
		self.await_pos = old_await;
		self.await_ident_pos = old_await_ident;
		Ok(Node::new(start, self.last_tok_end, K::Arrow))
	}

	pub fn parse_function_body(
		&mut self,
		node: FnInfo,
		is_arrow_function: bool,
		is_method: bool,
		for_init: ForInit,
	) -> R<()> {
		let is_expression = is_arrow_function && self.ty != T::BraceL;
		let old_strict = self.strict;
		let mut use_strict = false;
		if is_expression {
			self.parse_maybe_assign(for_init, None)?;
			self.check_params(node.params, false)?;
		} else {
			let non_simple = !is_simple_param_list(node.params);
			if !old_strict || non_simple {
				use_strict = self.strict_directive(self.end);
				if use_strict && non_simple {
					return self.raise(
						node.start,
						"Illegal 'use strict' directive in function with non-simple parameter list",
					);
				}
			}
			let old_labels = std::mem::take(&mut self.labels);
			if use_strict {
				self.strict = true;
			}
			self.check_params(
				node.params,
				!old_strict
					&& !use_strict && !is_arrow_function
					&& !is_method && is_simple_param_list(node.params),
			)?;
			if self.strict {
				if let Some(id) = node.id {
					self.check_lval_simple(id, crate::parser::BIND_OUTSIDE, None)?;
				}
			}
			let start = self.start;
			self.parse_block(false, start, use_strict && !old_strict)?;
			self.labels = old_labels;
		}
		self.exit_scope();
		Ok(())
	}

	fn check_params(&mut self, params: &[Node], allow_duplicates: bool) -> R<()> {
		let mut names = std::collections::HashSet::new();
		for param in params {
			self.check_lval_inner_pattern(
				param,
				BIND_VAR,
				if allow_duplicates {
					None
				} else {
					Some(&mut names)
				},
			)?;
		}
		Ok(())
	}

	pub fn parse_expr_list(
		&mut self,
		close: T,
		allow_trailing_comma: bool,
		allow_empty: bool,
		mut rde: Option<&mut De>,
	) -> R<Vec<Option<Node>>> {
		let mut elements = Vec::new();
		let mut first = true;
		while !self.eat(close)? {
			if !first {
				self.expect(T::Comma)?;
				if allow_trailing_comma && self.after_trailing_comma(close, false)? {
					break;
				}
			} else {
				first = false;
			}
			let element = if allow_empty && self.ty == T::Comma {
				None
			} else if self.ty == T::Ellipsis {
				let element = self.parse_spread(rde.as_deref_mut())?;
				if let Some(rde) = rde.as_deref_mut() {
					if self.ty == T::Comma && rde.trailing_comma < 0 {
						rde.trailing_comma = self.start as i64;
					}
				}
				Some(element)
			} else {
				Some(self.parse_maybe_assign(ForInit::No, rde.as_deref_mut())?)
			};
			elements.push(element);
		}
		Ok(elements)
	}

	/// `checkUnreserved` for identifier nodes (a no-op for anything else).
	pub fn check_unreserved(&self, node: &Node) -> R<()> {
		let K::Ident(name) = &node.k else {
			return Ok(());
		};
		let start = node.start;
		if self.in_generator() && eq(name, "yield") {
			return self.raise(start, "Cannot use 'yield' as identifier inside a generator");
		}
		if self.in_async() && eq(name, "await") {
			return self.raise(
				start,
				"Cannot use 'await' as identifier inside an async function",
			);
		}
		if self.current_this_scope().flags & SCOPE_VAR == 0 && eq(name, "arguments") {
			return self.raise(start, "Cannot use 'arguments' in class field initializer");
		}
		if self.in_class_static_block() && (eq(name, "arguments") || eq(name, "await")) {
			return self.raise(
				start,
				format!(
					"Cannot use {} in class static initialization block",
					lossy(name)
				),
			);
		}
		if T::from_keyword(name).is_some() {
			return self.raise(start, format!("Unexpected keyword '{}'", lossy(name)));
		}
		let reserved = if self.strict {
			RESERVED_STRICT
		} else {
			RESERVED
		};
		if reserved.iter().any(|word| eq(name, word)) {
			if !self.in_async() && eq(name, "await") {
				return self.raise(
					start,
					"Cannot use keyword 'await' outside an async function",
				);
			}
			return self.raise(start, format!("The keyword '{}' is reserved", lossy(name)));
		}
		Ok(())
	}

	/// `parseIdent(liberal)`.
	pub fn parse_ident(&mut self, liberal: bool) -> R<Node> {
		let start = self.start;
		let name = self.parse_ident_node()?;
		self.next(liberal)?;
		let node = Node::new(start, self.last_tok_end, K::Ident(name));
		if !liberal {
			self.check_unreserved(&node)?;
			if node.is_ident("await") && self.await_ident_pos == 0 {
				self.await_ident_pos = node.start;
			}
		}
		Ok(node)
	}

	fn parse_ident_node(&mut self) -> R<W> {
		if self.ty == T::Name {
			return Ok(self.value.clone().unwrap_or_default());
		}
		if let Some(keyword) = self.ty.keyword() {
			if (keyword == "class" || keyword == "function")
				&& (self.last_tok_end != self.last_tok_start + 1
					|| self.cu(self.last_tok_start) != Some(46))
			{
				self.context.pop();
			}
			self.ty = T::Name;
			return Ok(crate::chars::utf16(keyword));
		}
		self.unexpected(None)
	}

	pub fn parse_private_ident(&mut self) -> R<Node> {
		let start = self.start;
		let name = if self.ty == T::PrivateId {
			self.value.clone().unwrap_or_default()
		} else {
			return self.unexpected(None);
		};
		self.next(false)?;
		let node = Node::new(start, self.last_tok_end, K::PrivateIdent(name.clone()));
		match self.private_name_stack.last_mut() {
			None => {
				return self.raise(
					start,
					format!(
						"Private field '#{}' must be declared in an enclosing class",
						lossy(&name)
					),
				)
			}
			Some(frame) => frame.used.push((name, start)),
		}
		Ok(node)
	}

	fn parse_yield(&mut self, for_init: ForInit) -> R<Node> {
		if self.yield_pos == 0 {
			self.yield_pos = self.start;
		}
		let start = self.start;
		self.next(false)?;
		if self.ty == T::Semi
			|| self.can_insert_semicolon()
			|| (self.ty != T::Star && !self.ty.starts_expr())
		{
		} else {
			self.eat(T::Star)?;
			self.parse_maybe_assign(for_init, None)?;
		}
		Ok(Node::new(
			start,
			self.last_tok_end,
			K::Other("YieldExpression"),
		))
	}

	fn parse_await(&mut self, for_init: ForInit) -> R<Node> {
		if self.await_pos == 0 {
			self.await_pos = self.start;
		}
		let start = self.start;
		self.next(false)?;
		self.parse_maybe_unary(None, true, false, for_init)?;
		Ok(Node::new(
			start,
			self.last_tok_end,
			K::Other("AwaitExpression"),
		))
	}
}

pub fn is_simple_param_list(params: &[Node]) -> bool {
	params.iter().all(|param| matches!(param.k, K::Ident(_)))
}

//! Port of acorn's `statement.js` for module code at ecmaVersion 2024
//! (no `using` declarations, no import attributes).

use crate::chars::{
	eq, has_line_break, has_lone_surrogate, is_identifier_char, is_identifier_start, lossy,
	skip_white_space,
};
use crate::expression::FnInfo;
use crate::node::{MethodKind, Node, VarKind, K, W};
use crate::parser::{
	function_flags, De, Exports, ForInit, Label, LabelKind, Parser, PrivateDecl, PrivateFrame,
	BIND_FUNCTION, BIND_LEXICAL, BIND_NONE, BIND_SIMPLE_CATCH, BIND_VAR, R, SCOPE_CLASS_FIELD_INIT,
	SCOPE_CLASS_STATIC_BLOCK, SCOPE_SIMPLE_CATCH, SCOPE_SUPER, SCOPE_SWITCH,
};
use crate::token::T;

const FUNC_STATEMENT: u8 = 1;
const FUNC_HANGING_STATEMENT: u8 = 2;
const FUNC_NULLABLE_ID: u8 = 4;

/// `parseClass`'s `isStatement` argument: `false`, `true`, or `"nullableID"`.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum ClassKind {
	Expression,
	Statement,
	NullableId,
}

impl<'a> Parser<'a> {
	/// `parseTopLevel`: the program body.
	pub fn parse_top_level(&mut self) -> R<Vec<Node>> {
		let mut exports: Exports = Default::default();
		let mut body = Vec::new();
		while self.ty != T::Eof {
			body.push(self.parse_statement(false, true, Some(&mut exports))?);
		}
		if let Some((name, start)) = self.undefined_exports.first() {
			return self.raise(*start, format!("Export '{}' is not defined", lossy(name)));
		}
		self.next(false)?;
		Ok(body)
	}

	fn is_let(&self, context: bool) -> bool {
		if !self.is_contextual("let") {
			return false;
		}
		let mut next = skip_white_space(self.input, self.pos);
		let mut next_ch = self.full_char_code_at(next);
		if next_ch == Some(91) || next_ch == Some(92) {
			return true;
		}
		if context {
			return false;
		}
		if next_ch == Some(123) {
			return true;
		}
		if is_identifier_start(next_ch) {
			let start = next;
			loop {
				next += if next_ch.unwrap() <= 0xffff { 1 } else { 2 };
				next_ch = self.full_char_code_at(next);
				if !is_identifier_char(next_ch) {
					break;
				}
			}
			if next_ch == Some(92) {
				return true;
			}
			let ident = self.slice(start, next);
			if !(eq(ident, "in") || eq(ident, "instanceof")) {
				return true;
			}
		}
		false
	}

	fn is_async_function(&self) -> bool {
		if !self.is_contextual("async") {
			return false;
		}
		let next = skip_white_space(self.input, self.pos);
		if has_line_break(self.input, self.pos, next) || !eq(self.slice(next, next + 8), "function")
		{
			return false;
		}
		if next + 8 == self.input.len() {
			return true;
		}
		let after = self.full_char_code_at(next + 8);
		!(is_identifier_char(after) || after == Some(92))
	}

	/// `parseStatement(context, topLevel, exports)`. Only the truthiness of
	/// `context` matters in strict code.
	pub fn parse_statement(
		&mut self,
		context: bool,
		top_level: bool,
		exports: Option<&mut Exports>,
	) -> R<Node> {
		self.enter()?;
		let result = self.parse_statement_inner(context, top_level, exports);
		self.leave();
		result
	}

	fn parse_statement_inner(
		&mut self,
		context: bool,
		top_level: bool,
		exports: Option<&mut Exports>,
	) -> R<Node> {
		let mut starttype = self.ty;
		let start = self.start;
		let mut kind: Option<VarKind> = None;
		if self.is_let(context) {
			starttype = T::Var;
			kind = Some(VarKind::Let);
		}
		match starttype {
			T::Break | T::Continue => {
				self.parse_break_continue_statement(start, starttype == T::Break)
			}
			T::Debugger => {
				self.next(false)?;
				self.semicolon()?;
				Ok(self.finish(start, "DebuggerStatement"))
			}
			T::Do => self.parse_do_statement(start),
			T::For => self.parse_for_statement(start),
			T::Function => {
				if context {
					return self.unexpected(None);
				}
				self.parse_function_statement(start, false, !context)
			}
			T::Class => {
				if context {
					return self.unexpected(None);
				}
				self.parse_class(start, ClassKind::Statement)
			}
			T::If => self.parse_if_statement(start),
			T::Return => self.parse_return_statement(start),
			T::Switch => self.parse_switch_statement(start),
			T::Throw => self.parse_throw_statement(start),
			T::Try => self.parse_try_statement(start),
			T::Const | T::Var => {
				let kind = kind.unwrap_or(if self.ty == T::Const {
					VarKind::Const
				} else {
					VarKind::Var
				});
				if context && kind != VarKind::Var {
					return self.unexpected(None);
				}
				self.parse_var_statement(start, kind)
			}
			T::While => self.parse_while_statement(start),
			T::With => {
				// `with` is never allowed in module (strict) code.
				self.raise(self.start, "'with' in strict mode")
			}
			T::BraceL => self.parse_block(true, start, false),
			T::Semi => {
				self.next(false)?;
				Ok(self.finish(start, "EmptyStatement"))
			}
			T::Export | T::Import => {
				if starttype == T::Import {
					let next = skip_white_space(self.input, self.pos);
					let next_ch = self.cu(next);
					if next_ch == Some(40) || next_ch == Some(46) {
						let expr = self.parse_expression(ForInit::No, None)?;
						return self.parse_expression_statement(start, expr);
					}
				}
				if !top_level {
					return self.raise(
						self.start,
						"'import' and 'export' may only appear at the top level",
					);
				}
				if starttype == T::Import {
					self.parse_import(start)
				} else {
					self.parse_export(start, exports)
				}
			}
			_ => {
				if self.is_async_function() {
					if context {
						return self.unexpected(None);
					}
					self.next(false)?;
					return self.parse_function_statement(start, true, !context);
				}
				let maybe_name = self.value.clone();
				let expr = self.parse_expression(ForInit::No, None)?;
				if starttype == T::Name && matches!(expr.k, K::Ident(_)) && self.eat(T::Colon)? {
					return self.parse_labeled_statement(
						start,
						maybe_name.unwrap_or_default(),
						expr,
					);
				}
				self.parse_expression_statement(start, expr)
			}
		}
	}

	fn finish(&self, start: usize, name: &'static str) -> Node {
		Node::new(start, self.last_tok_end, K::Other(name))
	}

	fn parse_break_continue_statement(&mut self, start: usize, is_break: bool) -> R<Node> {
		self.next(false)?;
		let label: Option<W>;
		if self.eat(T::Semi)? || self.insert_semicolon() {
			label = None;
		} else if self.ty != T::Name {
			return self.unexpected(None);
		} else {
			let id = self.parse_ident(false)?;
			let K::Ident(name) = id.k else { unreachable!() };
			label = Some(name);
			self.semicolon()?;
		}
		let mut i = 0;
		while i < self.labels.len() {
			let lab = &self.labels[i];
			if label.is_none() || lab.name == label {
				if lab.kind.is_some() && (is_break || lab.kind == Some(LabelKind::Loop)) {
					break;
				}
				if label.is_some() && is_break {
					break;
				}
			}
			i += 1;
		}
		if i == self.labels.len() {
			return self.raise(
				start,
				format!(
					"Unsyntactic {}",
					if is_break { "break" } else { "continue" }
				),
			);
		}
		Ok(self.finish(
			start,
			if is_break {
				"BreakStatement"
			} else {
				"ContinueStatement"
			},
		))
	}

	fn parse_do_statement(&mut self, start: usize) -> R<Node> {
		self.next(false)?;
		self.labels.push(Label::loop_label());
		self.parse_statement(true, false, None)?;
		self.labels.pop();
		self.expect(T::While)?;
		self.parse_paren_expression()?;
		self.eat(T::Semi)?;
		Ok(self.finish(start, "DoWhileStatement"))
	}

	fn parse_for_statement(&mut self, start: usize) -> R<Node> {
		self.next(false)?;
		let await_at: i64 = if self.can_await() && self.eat_contextual("await")? {
			self.last_tok_start as i64
		} else {
			-1
		};
		self.labels.push(Label::loop_label());
		self.enter_scope(0);
		self.expect(T::ParenL)?;
		if self.ty == T::Semi {
			if await_at > -1 {
				return self.unexpected(Some(await_at as usize));
			}
			return self.parse_for(start);
		}
		let is_let = self.is_let(false);
		if self.ty == T::Var || self.ty == T::Const || is_let {
			let init_start = self.start;
			let kind = if is_let {
				VarKind::Let
			} else if self.ty == T::Const {
				VarKind::Const
			} else {
				VarKind::Var
			};
			self.next(false)?;
			let decls = self.parse_var(true, kind, false)?;
			let init = Node::new(init_start, self.last_tok_end, K::VarDecl { kind, decls });
			return self.parse_for_after_init(start, init, await_at);
		}
		let starts_with_let = self.is_contextual("let");
		let mut is_for_of = false;
		let contains_esc = self.contains_esc;
		let mut rde = De::new();
		let init_pos = self.start;
		let mut init = if await_at > -1 {
			self.parse_expr_subscripts(Some(&mut rde), ForInit::Await)?
		} else {
			self.parse_expression(ForInit::Yes, Some(&mut rde))?
		};
		if self.ty == T::In || {
			is_for_of = self.is_contextual("of");
			is_for_of
		} {
			if await_at > -1 {
				if self.ty == T::In {
					return self.unexpected(Some(await_at as usize));
				}
			} else if is_for_of && init.start == init_pos && !contains_esc && init.is_ident("async")
			{
				return self.unexpected(None);
			}
			if starts_with_let && is_for_of {
				return self.raise(
					init.start,
					"The left-hand side of a for-of loop may not start with 'let'.",
				);
			}
			self.to_assignable(&mut init, false, Some(&rde))?;
			self.check_lval_pattern(&init, BIND_NONE, None)?;
			return self.parse_for_in(start, init);
		} else {
			self.check_expression_errors(Some(&rde), true)?;
		}
		if await_at > -1 {
			return self.unexpected(Some(await_at as usize));
		}
		self.parse_for(start)
	}

	fn parse_for_after_init(&mut self, start: usize, init: Node, await_at: i64) -> R<Node> {
		let single = matches!(&init.k, K::VarDecl { decls, .. } if decls.len() == 1);
		if (self.ty == T::In || self.is_contextual("of")) && single {
			if self.ty == T::In && await_at > -1 {
				return self.unexpected(Some(await_at as usize));
			}
			return self.parse_for_in(start, init);
		}
		if await_at > -1 {
			return self.unexpected(Some(await_at as usize));
		}
		self.parse_for(start)
	}

	fn parse_function_statement(
		&mut self,
		start: usize,
		is_async: bool,
		declaration_position: bool,
	) -> R<Node> {
		self.next(false)?;
		self.parse_function(
			start,
			FUNC_STATEMENT
				| if declaration_position {
					0
				} else {
					FUNC_HANGING_STATEMENT
				},
			false,
			is_async,
			ForInit::No,
		)
	}

	fn parse_if_statement(&mut self, start: usize) -> R<Node> {
		self.next(false)?;
		self.parse_paren_expression()?;
		self.parse_statement(true, false, None)?;
		if self.eat(T::Else)? {
			self.parse_statement(true, false, None)?;
		}
		Ok(self.finish(start, "IfStatement"))
	}

	fn parse_return_statement(&mut self, start: usize) -> R<Node> {
		if !self.allow_return() {
			return self.raise(self.start, "'return' outside of function");
		}
		self.next(false)?;
		if !(self.eat(T::Semi)? || self.insert_semicolon()) {
			self.parse_expression(ForInit::No, None)?;
			self.semicolon()?;
		}
		Ok(self.finish(start, "ReturnStatement"))
	}

	fn parse_switch_statement(&mut self, start: usize) -> R<Node> {
		self.next(false)?;
		self.parse_paren_expression()?;
		self.expect(T::BraceL)?;
		self.labels.push(Label::switch_label());
		self.enter_scope(SCOPE_SWITCH);
		let mut has_case = false;
		let mut saw_default = false;
		while self.ty != T::BraceR {
			if self.ty == T::Case || self.ty == T::Default {
				let is_case = self.ty == T::Case;
				has_case = true;
				self.next(false)?;
				if is_case {
					self.parse_expression(ForInit::No, None)?;
				} else {
					if saw_default {
						return self.raise(self.last_tok_start, "Multiple default clauses");
					}
					saw_default = true;
				}
				self.expect(T::Colon)?;
			} else {
				if !has_case {
					return self.unexpected(None);
				}
				self.parse_statement(false, false, None)?;
			}
		}
		self.exit_scope();
		self.next(false)?;
		self.labels.pop();
		Ok(self.finish(start, "SwitchStatement"))
	}

	fn parse_throw_statement(&mut self, start: usize) -> R<Node> {
		self.next(false)?;
		if has_line_break(self.input, self.last_tok_end, self.start) {
			return self.raise(self.last_tok_end, "Illegal newline after throw");
		}
		self.parse_expression(ForInit::No, None)?;
		self.semicolon()?;
		Ok(self.finish(start, "ThrowStatement"))
	}

	fn parse_catch_clause_param(&mut self) -> R<()> {
		let param = self.parse_binding_atom()?;
		let simple = matches!(param.k, K::Ident(_));
		self.enter_scope(if simple { SCOPE_SIMPLE_CATCH } else { 0 });
		self.check_lval_pattern(
			&param,
			if simple {
				BIND_SIMPLE_CATCH
			} else {
				BIND_LEXICAL
			},
			None,
		)?;
		self.expect(T::ParenR)
	}

	fn parse_try_statement(&mut self, start: usize) -> R<Node> {
		self.next(false)?;
		let block_start = self.start;
		self.parse_block(true, block_start, false)?;
		let mut has_handler = false;
		if self.ty == T::Catch {
			self.next(false)?;
			if self.eat(T::ParenL)? {
				self.parse_catch_clause_param()?;
			} else {
				self.enter_scope(0);
			}
			let body_start = self.start;
			self.parse_block(false, body_start, false)?;
			self.exit_scope();
			has_handler = true;
		}
		let has_finalizer = if self.eat(T::Finally)? {
			let finalizer_start = self.start;
			self.parse_block(true, finalizer_start, false)?;
			true
		} else {
			false
		};
		if !has_handler && !has_finalizer {
			return self.raise(start, "Missing catch or finally clause");
		}
		Ok(self.finish(start, "TryStatement"))
	}

	fn parse_var_statement(&mut self, start: usize, kind: VarKind) -> R<Node> {
		self.next(false)?;
		let decls = self.parse_var(false, kind, false)?;
		self.semicolon()?;
		Ok(Node::new(
			start,
			self.last_tok_end,
			K::VarDecl { kind, decls },
		))
	}

	fn parse_while_statement(&mut self, start: usize) -> R<Node> {
		self.next(false)?;
		self.parse_paren_expression()?;
		self.labels.push(Label::loop_label());
		self.parse_statement(true, false, None)?;
		self.labels.pop();
		Ok(self.finish(start, "WhileStatement"))
	}

	fn parse_labeled_statement(&mut self, start: usize, name: W, expr: Node) -> R<Node> {
		if self
			.labels
			.iter()
			.any(|label| label.name.as_ref() == Some(&name))
		{
			return self.raise(
				expr.start,
				format!("Label '{}' is already declared", lossy(&name)),
			);
		}
		let kind = if self.ty.is_loop() {
			Some(LabelKind::Loop)
		} else if self.ty == T::Switch {
			Some(LabelKind::Switch)
		} else {
			None
		};
		for i in (0..self.labels.len()).rev() {
			if self.labels[i].statement_start == Some(start) {
				self.labels[i].statement_start = Some(self.start);
				self.labels[i].kind = kind;
			} else {
				break;
			}
		}
		self.labels.push(Label {
			name: Some(name),
			kind,
			statement_start: Some(self.start),
		});
		self.parse_statement(true, false, None)?;
		self.labels.pop();
		Ok(self.finish(start, "LabeledStatement"))
	}

	fn parse_expression_statement(&mut self, start: usize, _expr: Node) -> R<Node> {
		self.semicolon()?;
		Ok(self.finish(start, "ExpressionStatement"))
	}

	/// `parseBlock(createNewLexicalScope, node, exitStrict)`.
	pub fn parse_block(
		&mut self,
		create_new_lexical_scope: bool,
		start: usize,
		exit_strict: bool,
	) -> R<Node> {
		self.expect(T::BraceL)?;
		if create_new_lexical_scope {
			self.enter_scope(0);
		}
		while self.ty != T::BraceR {
			self.parse_statement(false, false, None)?;
		}
		if exit_strict {
			self.strict = false;
		}
		self.next(false)?;
		if create_new_lexical_scope {
			self.exit_scope();
		}
		Ok(self.finish(start, "BlockStatement"))
	}

	fn parse_for(&mut self, start: usize) -> R<Node> {
		self.expect(T::Semi)?;
		if self.ty != T::Semi {
			self.parse_expression(ForInit::No, None)?;
		}
		self.expect(T::Semi)?;
		if self.ty != T::ParenR {
			self.parse_expression(ForInit::No, None)?;
		}
		self.expect(T::ParenR)?;
		self.parse_statement(true, false, None)?;
		self.exit_scope();
		self.labels.pop();
		Ok(self.finish(start, "ForStatement"))
	}

	fn parse_for_in(&mut self, start: usize, init: Node) -> R<Node> {
		let is_for_in = self.ty == T::In;
		self.next(false)?;
		if let K::VarDecl { decls, .. } = &init.k {
			if decls[0].1 {
				return self.raise(
					init.start,
					format!(
						"{} loop variable declaration may not have an initializer",
						if is_for_in { "for-in" } else { "for-of" }
					),
				);
			}
		}
		if is_for_in {
			self.parse_expression(ForInit::No, None)?;
		} else {
			self.parse_maybe_assign(ForInit::No, None)?;
		}
		self.expect(T::ParenR)?;
		self.parse_statement(true, false, None)?;
		self.exit_scope();
		self.labels.pop();
		Ok(self.finish(
			start,
			if is_for_in {
				"ForInStatement"
			} else {
				"ForOfStatement"
			},
		))
	}

	/// `parseVar`: declarators as `(id, hasInit)`.
	fn parse_var(
		&mut self,
		is_for: bool,
		kind: VarKind,
		allow_missing_initializer: bool,
	) -> R<Vec<(Node, bool)>> {
		let mut decls = Vec::new();
		loop {
			let id = self.parse_binding_atom()?;
			self.check_lval_pattern(
				&id,
				if kind == VarKind::Var {
					BIND_VAR
				} else {
					BIND_LEXICAL
				},
				None,
			)?;
			let has_init;
			if self.eat(T::Eq)? {
				self.parse_maybe_assign(if is_for { ForInit::Yes } else { ForInit::No }, None)?;
				has_init = true;
			} else if !allow_missing_initializer
				&& kind == VarKind::Const
				&& !(self.ty == T::In || self.is_contextual("of"))
			{
				return self.unexpected(None);
			} else if !allow_missing_initializer
				&& !matches!(id.k, K::Ident(_))
				&& !(is_for && (self.ty == T::In || self.is_contextual("of")))
			{
				return self.raise(
					self.last_tok_end,
					"Complex binding patterns require an initialization value",
				);
			} else {
				has_init = false;
			}
			decls.push((id, has_init));
			if !self.eat(T::Comma)? {
				break;
			}
		}
		Ok(decls)
	}

	/// `parseFunction(node, statement, allowExpressionBody, isAsync, forInit)`.
	pub fn parse_function(
		&mut self,
		start: usize,
		statement: u8,
		allow_expression_body: bool,
		is_async: bool,
		for_init: ForInit,
	) -> R<Node> {
		if self.ty == T::Star && statement & FUNC_HANGING_STATEMENT != 0 {
			return self.unexpected(None);
		}
		let generator = self.eat(T::Star)?;
		let mut id = None;
		if statement & FUNC_STATEMENT != 0 {
			id = if statement & FUNC_NULLABLE_ID != 0 && self.ty != T::Name {
				None
			} else {
				Some(self.parse_ident(false)?)
			};
			if let Some(id) = &id {
				if statement & FUNC_HANGING_STATEMENT == 0 {
					let binding = if self.strict || generator || is_async {
						if self.treat_functions_as_var() {
							BIND_VAR
						} else {
							BIND_LEXICAL
						}
					} else {
						BIND_FUNCTION
					};
					self.check_lval_simple(id, binding, None)?;
				}
			}
		}
		let old_yield = self.yield_pos;
		let old_await = self.await_pos;
		let old_await_ident = self.await_ident_pos;
		self.yield_pos = 0;
		self.await_pos = 0;
		self.await_ident_pos = 0;
		self.enter_scope(function_flags(is_async, generator));
		if statement & FUNC_STATEMENT == 0 {
			id = if self.ty == T::Name {
				Some(self.parse_ident(false)?)
			} else {
				None
			};
		}
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
				id: id.as_ref(),
			},
			allow_expression_body,
			false,
			for_init,
		)?;
		self.yield_pos = old_yield;
		self.await_pos = old_await;
		self.await_ident_pos = old_await_ident;
		if statement & FUNC_STATEMENT != 0 {
			Ok(Node::new(
				start,
				self.last_tok_end,
				K::FuncDecl {
					id: id.map(Box::new),
				},
			))
		} else {
			Ok(Node::new(start, self.last_tok_end, K::Func { params }))
		}
	}

	/// `parseClass(node, isStatement)`.
	pub fn parse_class(&mut self, start: usize, kind: ClassKind) -> R<Node> {
		self.next(false)?;
		let old_strict = self.strict;
		self.strict = true;
		let id = if self.ty == T::Name {
			let id = self.parse_ident(false)?;
			if kind != ClassKind::Expression {
				self.check_lval_simple(&id, BIND_LEXICAL, None)?;
			}
			Some(id)
		} else {
			if kind == ClassKind::Statement {
				return self.unexpected(None);
			}
			None
		};
		let has_super = if self.eat(T::Extends)? {
			self.parse_expr_subscripts(None, ForInit::No)?;
			true
		} else {
			false
		};
		self.private_name_stack.push(PrivateFrame {
			declared: Default::default(),
			used: Vec::new(),
		});
		let mut had_constructor = false;
		self.expect(T::BraceL)?;
		while self.ty != T::BraceR {
			let Some(element) = self.parse_class_element(has_super)? else {
				continue;
			};
			match &element.k {
				K::Method {
					kind: MethodKind::Constructor,
					..
				} => {
					if had_constructor {
						return self
							.raise(element.start, "Duplicate constructor in the same class");
					}
					had_constructor = true;
				}
				K::Method { key, .. } | K::Field { key } => {
					if let K::PrivateIdent(name) = &key.k {
						if self.is_private_name_conflicted(name, &element) {
							return self.raise(
								key.start,
								format!("Identifier '#{}' has already been declared", lossy(name)),
							);
						}
					}
				}
				_ => {}
			}
		}
		self.strict = old_strict;
		self.next(false)?;
		self.exit_class_body()?;
		if kind == ClassKind::Expression {
			Ok(Node::new(
				start,
				self.last_tok_end,
				K::Other("ClassExpression"),
			))
		} else {
			Ok(Node::new(
				start,
				self.last_tok_end,
				K::ClassDecl {
					id: id.map(Box::new),
				},
			))
		}
	}

	fn is_private_name_conflicted(&mut self, name: &W, element: &Node) -> bool {
		let next = match &element.k {
			K::Method {
				kind: kind @ (MethodKind::Get | MethodKind::Set),
				is_static,
				..
			} => match (is_static, kind) {
				(true, MethodKind::Get) => PrivateDecl::SGet,
				(true, _) => PrivateDecl::SSet,
				(false, MethodKind::Get) => PrivateDecl::IGet,
				(false, _) => PrivateDecl::ISet,
			},
			_ => PrivateDecl::True,
		};
		let map = &mut self.private_name_stack.last_mut().unwrap().declared;
		let current = map.get(name).copied();
		use PrivateDecl::*;
		match (current, next) {
			(Some(IGet), ISet) | (Some(ISet), IGet) | (Some(SGet), SSet) | (Some(SSet), SGet) => {
				map.insert(name.clone(), True);
				false
			}
			(None, next) => {
				map.insert(name.clone(), next);
				false
			}
			_ => true,
		}
	}

	fn exit_class_body(&mut self) -> R<()> {
		let frame = self.private_name_stack.pop().unwrap();
		for (name, start) in frame.used {
			if !frame.declared.contains_key(&name) {
				match self.private_name_stack.last_mut() {
					Some(parent) => parent.used.push((name, start)),
					None => {
						return self.raise(
							start,
							format!(
								"Private field '#{}' must be declared in an enclosing class",
								lossy(&name)
							),
						)
					}
				}
			}
		}
		Ok(())
	}

	fn is_class_element_name_start(&self) -> bool {
		matches!(
			self.ty,
			T::Name | T::PrivateId | T::Num | T::String | T::BracketL
		) || self.ty.keyword().is_some()
	}

	fn parse_class_element(&mut self, constructor_allows_super: bool) -> R<Option<Node>> {
		if self.eat(T::Semi)? {
			return Ok(None);
		}
		let start = self.start;
		let mut key_name: Option<W> = None;
		let mut is_generator = false;
		let mut is_async = false;
		let mut kind = MethodKind::Method;
		let mut is_static = false;
		if self.eat_contextual("static")? {
			if self.eat(T::BraceL)? {
				self.parse_class_static_block()?;
				return Ok(Some(Node::new(
					start,
					self.last_tok_end,
					K::Other("StaticBlock"),
				)));
			}
			if self.is_class_element_name_start() || self.ty == T::Star {
				is_static = true;
			} else {
				key_name = Some(crate::chars::utf16("static"));
			}
		}
		if key_name.is_none() && self.eat_contextual("async")? {
			if (self.is_class_element_name_start() || self.ty == T::Star)
				&& !self.can_insert_semicolon()
			{
				is_async = true;
			} else {
				key_name = Some(crate::chars::utf16("async"));
			}
		}
		if key_name.is_none() && self.eat(T::Star)? {
			is_generator = true;
		}
		if key_name.is_none() && !is_async && !is_generator {
			let last_value = self.value.clone().unwrap_or_default();
			if self.eat_contextual("get")? || self.eat_contextual("set")? {
				if self.is_class_element_name_start() {
					kind = if eq(&last_value, "get") {
						MethodKind::Get
					} else {
						MethodKind::Set
					};
				} else {
					key_name = Some(last_value);
				}
			}
		}
		let (key, computed) = if let Some(name) = key_name {
			(
				Node::new(self.last_tok_start, self.last_tok_end, K::Ident(name)),
				false,
			)
		} else if self.ty == T::PrivateId {
			if self.value_is("constructor") {
				return self.raise(
					self.start,
					"Classes can't have an element named '#constructor'",
				);
			}
			(self.parse_private_ident()?, false)
		} else {
			self.parse_property_name()?
		};
		if self.ty == T::ParenL || kind != MethodKind::Method || is_generator || is_async {
			let is_constructor = !is_static && check_key_name(&key, computed, "constructor");
			let allows_direct_super = is_constructor && constructor_allows_super;
			if is_constructor && kind != MethodKind::Method {
				return self.raise(key.start, "Constructor can't have get/set modifier");
			}
			if is_constructor {
				kind = MethodKind::Constructor;
			}
			if kind == MethodKind::Constructor {
				if is_generator {
					return self.raise(key.start, "Constructor can't be a generator");
				}
				if is_async {
					return self.raise(key.start, "Constructor can't be an async method");
				}
			} else if is_static && check_key_name(&key, computed, "prototype") {
				return self.raise(
					key.start,
					"Classes may not have a static property named prototype",
				);
			}
			let value = self.parse_method(is_generator, is_async, allows_direct_super)?;
			let K::Func { params } = &value.k else {
				unreachable!("methods are function expressions")
			};
			if kind == MethodKind::Get && !params.is_empty() {
				return self.raise(value.start, "getter should have no params");
			}
			if kind == MethodKind::Set && params.len() != 1 {
				return self.raise(value.start, "setter should have exactly one param");
			}
			if kind == MethodKind::Set && matches!(params[0].k, K::Rest(_)) {
				return self.raise(params[0].start, "Setter cannot use rest params");
			}
			return Ok(Some(Node::new(
				start,
				self.last_tok_end,
				K::Method {
					kind,
					is_static,
					key: Box::new(key),
				},
			)));
		}
		if check_key_name(&key, computed, "constructor") {
			return self.raise(key.start, "Classes can't have a field named 'constructor'");
		} else if is_static && check_key_name(&key, computed, "prototype") {
			return self.raise(
				key.start,
				"Classes can't have a static field named 'prototype'",
			);
		}
		if self.eat(T::Eq)? {
			self.enter_scope(SCOPE_CLASS_FIELD_INIT | SCOPE_SUPER);
			self.parse_maybe_assign(ForInit::No, None)?;
			self.exit_scope();
		}
		self.semicolon()?;
		Ok(Some(Node::new(
			start,
			self.last_tok_end,
			K::Field { key: Box::new(key) },
		)))
	}

	fn parse_class_static_block(&mut self) -> R<()> {
		let old_labels = std::mem::take(&mut self.labels);
		self.enter_scope(SCOPE_CLASS_STATIC_BLOCK | SCOPE_SUPER);
		while self.ty != T::BraceR {
			self.parse_statement(false, false, None)?;
		}
		self.next(false)?;
		self.exit_scope();
		self.labels = old_labels;
		Ok(())
	}

	fn module_export_name(node: &Node) -> W {
		match &node.k {
			K::Ident(name) => name.clone(),
			K::Lit(Some(value)) => value.clone(),
			_ => Vec::new(),
		}
	}

	fn parse_export_all_declaration(
		&mut self,
		start: usize,
		exports: Option<&mut Exports>,
	) -> R<Node> {
		if self.eat_contextual("as")? {
			let exported = self.parse_module_export_name()?;
			self.check_export(
				exports,
				&Self::module_export_name(&exported),
				self.last_tok_start,
			)?;
		}
		self.expect_contextual("from")?;
		if self.ty != T::String {
			return self.unexpected(None);
		}
		self.parse_expr_atom(None)?;
		self.semicolon()?;
		Ok(Node::new(start, self.last_tok_end, K::ExportAll))
	}

	fn parse_export(&mut self, start: usize, mut exports: Option<&mut Exports>) -> R<Node> {
		self.next(false)?;
		if self.eat(T::Star)? {
			return self.parse_export_all_declaration(start, exports);
		}
		if self.eat(T::Default)? {
			self.check_export(
				exports,
				&crate::chars::utf16("default"),
				self.last_tok_start,
			)?;
			self.parse_export_default_declaration()?;
			return Ok(Node::new(start, self.last_tok_end, K::ExportDefault));
		}
		if self.should_parse_export_statement() {
			let declaration = self.parse_statement(false, false, None)?;
			match &declaration.k {
				K::VarDecl { decls, .. } => {
					if let Some(exports) = exports.as_deref_mut() {
						for (id, _) in decls {
							self.check_pattern_export(exports, id)?;
						}
					}
				}
				K::FuncDecl { id: Some(id) } | K::ClassDecl { id: Some(id) } => {
					let K::Ident(name) = &id.k else {
						unreachable!()
					};
					self.check_export(exports, name, id.start)?;
				}
				_ => {}
			}
		} else {
			let specifiers = self.parse_export_specifiers(exports)?;
			if self.eat_contextual("from")? {
				if self.ty != T::String {
					return self.unexpected(None);
				}
				self.parse_expr_atom(None)?;
			} else {
				for local in &specifiers {
					self.check_unreserved(local)?;
					if let K::Ident(name) = &local.k {
						self.check_local_export(name, local.start);
					}
					if matches!(local.k, K::Lit(_)) {
						return self.raise(
							local.start,
							"A string literal cannot be used as an exported binding without `from`.",
						);
					}
				}
			}
			self.semicolon()?;
		}
		Ok(Node::new(start, self.last_tok_end, K::ExportNamed))
	}

	fn parse_export_default_declaration(&mut self) -> R<()> {
		let is_async = self.ty != T::Function && self.is_async_function();
		if self.ty == T::Function || is_async {
			let start = self.start;
			self.next(false)?;
			if is_async {
				self.next(false)?;
			}
			self.parse_function(
				start,
				FUNC_STATEMENT | FUNC_NULLABLE_ID,
				false,
				is_async,
				ForInit::No,
			)?;
		} else if self.ty == T::Class {
			let start = self.start;
			self.parse_class(start, ClassKind::NullableId)?;
		} else {
			self.parse_maybe_assign(ForInit::No, None)?;
			self.semicolon()?;
		}
		Ok(())
	}

	fn check_export(&self, exports: Option<&mut Exports>, name: &W, pos: usize) -> R<()> {
		let Some(exports) = exports else {
			return Ok(());
		};
		if exports.contains(name) {
			return self.raise(pos, format!("Duplicate export '{}'", lossy(name)));
		}
		exports.insert(name.clone());
		Ok(())
	}

	fn check_pattern_export(&self, exports: &mut Exports, pattern: &Node) -> R<()> {
		match &pattern.k {
			K::Ident(name) => self.check_export(Some(exports), name, pattern.start),
			K::ObjPat(properties) => {
				for prop in properties {
					self.check_pattern_export(exports, prop)?;
				}
				Ok(())
			}
			K::ArrPat(elements) => {
				for element in elements.iter().flatten() {
					self.check_pattern_export(exports, element)?;
				}
				Ok(())
			}
			K::Prop(prop) => self.check_pattern_export(exports, &prop.value),
			K::AssignPat { left } => self.check_pattern_export(exports, left),
			K::Rest(argument) => self.check_pattern_export(exports, argument),
			_ => Ok(()),
		}
	}

	fn should_parse_export_statement(&self) -> bool {
		matches!(self.ty, T::Var | T::Const | T::Class | T::Function)
			|| self.is_let(false)
			|| self.is_async_function()
	}

	/// `parseExportSpecifiers`: the local names.
	fn parse_export_specifiers(&mut self, mut exports: Option<&mut Exports>) -> R<Vec<Node>> {
		let mut locals = Vec::new();
		let mut first = true;
		self.expect(T::BraceL)?;
		while !self.eat(T::BraceR)? {
			if !first {
				self.expect(T::Comma)?;
				if self.after_trailing_comma(T::BraceR, false)? {
					break;
				}
			} else {
				first = false;
			}
			let local = self.parse_module_export_name()?;
			let exported = if self.eat_contextual("as")? {
				self.parse_module_export_name()?
			} else {
				local.clone()
			};
			self.check_export(
				exports.as_deref_mut(),
				&Self::module_export_name(&exported),
				exported.start,
			)?;
			locals.push(local);
		}
		Ok(locals)
	}

	fn parse_import(&mut self, start: usize) -> R<Node> {
		self.next(false)?;
		let mut locals = Vec::new();
		if self.ty == T::String {
			self.parse_expr_atom(None)?;
		} else {
			locals = self.parse_import_specifiers()?;
			self.expect_contextual("from")?;
			if self.ty == T::String {
				self.parse_expr_atom(None)?;
			} else {
				return self.unexpected(None);
			}
		}
		self.semicolon()?;
		Ok(Node::new(start, self.last_tok_end, K::Import { locals }))
	}

	fn import_local(&mut self, local: Node) -> R<W> {
		self.check_lval_simple(&local, BIND_LEXICAL, None)?;
		let K::Ident(name) = local.k else {
			unreachable!()
		};
		Ok(name)
	}

	fn parse_import_specifiers(&mut self) -> R<Vec<W>> {
		let mut locals = Vec::new();
		let mut first = true;
		if self.ty == T::Name {
			let local = self.parse_ident(false)?;
			locals.push(self.import_local(local)?);
			if !self.eat(T::Comma)? {
				return Ok(locals);
			}
		}
		if self.ty == T::Star {
			self.next(false)?;
			self.expect_contextual("as")?;
			let local = self.parse_ident(false)?;
			locals.push(self.import_local(local)?);
			return Ok(locals);
		}
		self.expect(T::BraceL)?;
		while !self.eat(T::BraceR)? {
			if !first {
				self.expect(T::Comma)?;
				if self.after_trailing_comma(T::BraceR, false)? {
					break;
				}
			} else {
				first = false;
			}
			let imported = self.parse_module_export_name()?;
			let local = if self.eat_contextual("as")? {
				self.parse_ident(false)?
			} else {
				self.check_unreserved(&imported)?;
				imported
			};
			locals.push(self.import_local(local)?);
		}
		Ok(locals)
	}

	fn parse_module_export_name(&mut self) -> R<Node> {
		if self.ty == T::String {
			let literal = self.parse_literal()?;
			if let K::Lit(Some(value)) = &literal.k {
				if has_lone_surrogate(value) {
					return self.raise(
						literal.start,
						"An export name cannot include a lone surrogate.",
					);
				}
			}
			return Ok(literal);
		}
		self.parse_ident(true)
	}
}

fn check_key_name(key: &Node, computed: bool, name: &str) -> bool {
	!computed
		&& match &key.k {
			K::Ident(value) => eq(value, name),
			K::Lit(Some(value)) => eq(value, name),
			_ => false,
		}
}

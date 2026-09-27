//! Parser state, error plumbing, parse utilities (`parseutil.js`) and scope
//! tracking (`scope.js`). The parser is fixed to the configuration remark-mdx
//! uses: `ecmaVersion: 2024`, `sourceType: "module"`, `preserveParens`, and
//! the acorn-jsx plugin with default options.

use std::collections::{HashMap, HashSet};

use crate::chars::{self, eq, has_line_break, lossy};
use crate::node::{Node, K, W};
use crate::token::{Ctx, T};

pub const SCOPE_TOP: u32 = 1;
pub const SCOPE_FUNCTION: u32 = 2;
pub const SCOPE_ASYNC: u32 = 4;
pub const SCOPE_GENERATOR: u32 = 8;
pub const SCOPE_ARROW: u32 = 16;
pub const SCOPE_SIMPLE_CATCH: u32 = 32;
pub const SCOPE_SUPER: u32 = 64;
pub const SCOPE_DIRECT_SUPER: u32 = 128;
pub const SCOPE_CLASS_STATIC_BLOCK: u32 = 256;
pub const SCOPE_CLASS_FIELD_INIT: u32 = 512;
pub const SCOPE_SWITCH: u32 = 1024;
pub const SCOPE_VAR: u32 = SCOPE_TOP | SCOPE_FUNCTION | SCOPE_CLASS_STATIC_BLOCK;

pub fn function_flags(is_async: bool, generator: bool) -> u32 {
	SCOPE_FUNCTION
		| if is_async { SCOPE_ASYNC } else { 0 }
		| if generator { SCOPE_GENERATOR } else { 0 }
}

pub const BIND_NONE: u8 = 0;
pub const BIND_VAR: u8 = 1;
pub const BIND_LEXICAL: u8 = 2;
pub const BIND_FUNCTION: u8 = 3;
pub const BIND_SIMPLE_CATCH: u8 = 4;
pub const BIND_OUTSIDE: u8 = 5;

/// Stack the parser may use below [`Parser::new`]'s caller, standing in for
/// V8's ~1 MB stack: past it the parser behaves like JavaScript overflowing
/// its stack, which `parseExpression`/`parse` turn into "Not enough stack
/// space to parse input". Like V8, that happens only hundreds of levels deep,
/// at a depth that varies by construct (and is not identical to V8's).
const STACK_BUDGET: usize = 1 << 20;

/// Recursion backstop in case stack addresses can't be compared.
pub const MAX_DEPTH: usize = 10_000;

/// The address of a stack local: how deep the thread's stack currently is.
#[inline(always)]
fn stack_pointer() -> usize {
	let marker = 0u8;
	std::hint::black_box(&marker) as *const u8 as usize
}

/// An acorn `SyntaxError`: message without the ` (line:column)` suffix,
/// `pos`, and `raisedAt`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SyntaxError {
	pub message: String,
	pub pos: usize,
	pub raised_at: usize,
}

#[derive(Debug)]
pub enum Fail {
	Syntax(SyntaxError),
	/// `INVALID_TEMPLATE_ESCAPE_ERROR`, caught by `tryReadTemplateToken`.
	InvalidTemplate,
	/// A stack overflow (see [`STACK_BUDGET`]).
	Overflow,
	/// Any other exception JavaScript would throw.
	Runtime(String),
}

pub type R<T> = Result<T, Fail>;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum ForInit {
	No,
	Yes,
	Await,
}

impl ForInit {
	pub fn truthy(self) -> bool {
		self != ForInit::No
	}
}

/// `DestructuringErrors`.
#[derive(Clone, Debug)]
pub struct De {
	pub shorthand_assign: i64,
	pub trailing_comma: i64,
	pub parenthesized_assign: i64,
	pub parenthesized_bind: i64,
	pub double_proto: i64,
}

impl De {
	pub fn new() -> Self {
		Self {
			shorthand_assign: -1,
			trailing_comma: -1,
			parenthesized_assign: -1,
			parenthesized_bind: -1,
			double_proto: -1,
		}
	}
}

pub struct Scope {
	pub flags: u32,
	pub var: Vec<W>,
	pub lexical: Vec<W>,
	pub functions: Vec<W>,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum LabelKind {
	Loop,
	Switch,
}

pub struct Label {
	pub name: Option<W>,
	pub kind: Option<LabelKind>,
	pub statement_start: Option<usize>,
}

impl Label {
	pub fn loop_label() -> Self {
		Self {
			name: None,
			kind: Some(LabelKind::Loop),
			statement_start: None,
		}
	}
	pub fn switch_label() -> Self {
		Self {
			name: None,
			kind: Some(LabelKind::Switch),
			statement_start: None,
		}
	}
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum PrivateDecl {
	True,
	IGet,
	ISet,
	SGet,
	SSet,
}

pub struct PrivateFrame {
	pub declared: HashMap<W, PrivateDecl>,
	pub used: Vec<(W, usize)>,
}

pub type Exports = HashSet<W>;

pub struct Parser<'a> {
	pub input: &'a [u16],
	/// remark-mdx's provisional ESM parser: `checkLocalExport` is a no-op.
	pub provisional: bool,
	pub pos: usize,
	pub ty: T,
	pub value: Option<W>,
	pub start: usize,
	pub end: usize,
	pub last_tok_start: usize,
	pub last_tok_end: usize,
	pub context: Vec<Ctx>,
	pub expr_allowed: bool,
	pub contains_esc: bool,
	pub in_template_element: bool,
	pub strict: bool,
	pub potential_arrow_at: i64,
	pub potential_arrow_in_for_await: bool,
	pub yield_pos: usize,
	pub await_pos: usize,
	pub await_ident_pos: usize,
	pub labels: Vec<Label>,
	pub undefined_exports: Vec<(W, usize)>,
	pub scope_stack: Vec<Scope>,
	pub private_name_stack: Vec<PrivateFrame>,
	pub depth: usize,
	/// [`stack_pointer`] when the parser was created.
	stack_base: usize,
}

impl<'a> Parser<'a> {
	pub fn new(input: &'a [u16], provisional: bool) -> Self {
		let mut parser = Self {
			input,
			provisional,
			pos: 0,
			ty: T::Eof,
			value: None,
			start: 0,
			end: 0,
			last_tok_start: 0,
			last_tok_end: 0,
			context: vec![Ctx::BStat],
			expr_allowed: true,
			contains_esc: false,
			in_template_element: false,
			// Module code is always strict.
			strict: true,
			potential_arrow_at: -1,
			potential_arrow_in_for_await: false,
			yield_pos: 0,
			await_pos: 0,
			await_ident_pos: 0,
			labels: Vec::new(),
			undefined_exports: Vec::new(),
			scope_stack: Vec::new(),
			private_name_stack: Vec::new(),
			depth: 0,
			stack_base: stack_pointer(),
		};
		// `allowHashBang` defaults on for ecmaVersion >= 2023.
		if input.len() >= 2 && input[0] == 35 && input[1] == 33 {
			parser.skip_line_comment(2);
		}
		parser.enter_scope(SCOPE_TOP);
		parser
	}

	// ## Errors

	pub fn raise<X>(&self, pos: usize, message: impl Into<String>) -> R<X> {
		Err(Fail::Syntax(SyntaxError {
			message: message.into(),
			pos,
			raised_at: self.pos,
		}))
	}

	pub fn unexpected<X>(&self, pos: Option<usize>) -> R<X> {
		self.raise(pos.unwrap_or(self.start), "Unexpected token")
	}

	pub fn enter(&mut self) -> R<()> {
		self.depth += 1;
		if self.depth > MAX_DEPTH || self.stack_exhausted() {
			Err(Fail::Overflow)
		} else {
			Ok(())
		}
	}

	/// Whether the parser has used up [`STACK_BUDGET`].
	pub fn stack_exhausted(&self) -> bool {
		self.stack_base.saturating_sub(stack_pointer()) > STACK_BUDGET
	}

	pub fn leave(&mut self) {
		self.depth -= 1;
	}

	/// `catchStackOverflow`.
	pub fn catch_overflow<X>(&mut self, result: R<X>) -> R<X> {
		match result {
			Err(Fail::Overflow) => self.raise(self.start, "Not enough stack space to parse input"),
			other => other,
		}
	}

	// ## Input helpers

	/// `charCodeAt`, where `None` is `NaN`.
	pub fn cu(&self, index: usize) -> Option<u16> {
		self.input.get(index).copied()
	}

	/// `fullCharCodeAt`, where `None` is `NaN`.
	pub fn full_char_code_at(&self, index: usize) -> Option<u32> {
		let code = self.cu(index)? as u32;
		if code <= 0xd7ff || code >= 0xdc00 {
			return Some(code);
		}
		let next = self.cu(index + 1)? as u32;
		if next <= 0xdbff || next >= 0xe000 {
			Some(code)
		} else {
			Some((code << 10) + next - 0x35f_dc00)
		}
	}

	/// JavaScript `slice` on the input.
	pub fn slice(&self, from: usize, to: usize) -> &'a [u16] {
		let to = to.min(self.input.len());
		if from >= to {
			&[]
		} else {
			&self.input[from..to]
		}
	}

	pub fn value_is(&self, name: &str) -> bool {
		self.value.as_deref().is_some_and(|value| eq(value, name))
	}

	// ## Parse utilities

	pub fn is_contextual(&self, name: &str) -> bool {
		self.ty == T::Name && self.value_is(name) && !self.contains_esc
	}

	pub fn eat(&mut self, ty: T) -> R<bool> {
		if self.ty == ty {
			self.next(false)?;
			Ok(true)
		} else {
			Ok(false)
		}
	}

	pub fn eat_contextual(&mut self, name: &str) -> R<bool> {
		if !self.is_contextual(name) {
			return Ok(false);
		}
		self.next(false)?;
		Ok(true)
	}

	pub fn expect_contextual(&mut self, name: &str) -> R<()> {
		if !self.eat_contextual(name)? {
			return self.unexpected(None);
		}
		Ok(())
	}

	pub fn can_insert_semicolon(&self) -> bool {
		self.ty == T::Eof
			|| self.ty == T::BraceR
			|| has_line_break(self.input, self.last_tok_end, self.start)
	}

	pub fn insert_semicolon(&self) -> bool {
		self.can_insert_semicolon()
	}

	pub fn semicolon(&mut self) -> R<()> {
		if !self.eat(T::Semi)? && !self.insert_semicolon() {
			return self.unexpected(None);
		}
		Ok(())
	}

	pub fn after_trailing_comma(&mut self, ty: T, not_next: bool) -> R<bool> {
		if self.ty == ty {
			if !not_next {
				self.next(false)?;
			}
			return Ok(true);
		}
		Ok(false)
	}

	pub fn expect(&mut self, ty: T) -> R<()> {
		if !self.eat(ty)? {
			return self.unexpected(None);
		}
		Ok(())
	}

	pub fn check_pattern_errors(&self, rde: Option<&De>, is_assign: bool) -> R<()> {
		let Some(rde) = rde else { return Ok(()) };
		if rde.trailing_comma > -1 {
			return self.raise(
				rde.trailing_comma as usize,
				"Comma is not permitted after the rest element",
			);
		}
		let parens = if is_assign {
			rde.parenthesized_assign
		} else {
			rde.parenthesized_bind
		};
		if parens > -1 {
			return self.raise(
				parens as usize,
				if is_assign {
					"Assigning to rvalue"
				} else {
					"Parenthesized pattern"
				},
			);
		}
		Ok(())
	}

	pub fn check_expression_errors(&self, rde: Option<&De>, and_throw: bool) -> R<bool> {
		let Some(rde) = rde else { return Ok(false) };
		if !and_throw {
			return Ok(rde.shorthand_assign >= 0 || rde.double_proto >= 0);
		}
		if rde.shorthand_assign >= 0 {
			return self.raise(
				rde.shorthand_assign as usize,
				"Shorthand property assignments are valid only in destructuring patterns",
			);
		}
		if rde.double_proto >= 0 {
			return self.raise(
				rde.double_proto as usize,
				"Redefinition of __proto__ property",
			);
		}
		Ok(false)
	}

	pub fn check_yield_await_in_default_params(&self) -> R<()> {
		if self.yield_pos != 0 && (self.await_pos == 0 || self.yield_pos < self.await_pos) {
			return self.raise(self.yield_pos, "Yield expression cannot be a default value");
		}
		if self.await_pos != 0 {
			return self.raise(self.await_pos, "Await expression cannot be a default value");
		}
		Ok(())
	}

	pub fn is_simple_assign_target(&self, expr: &Node) -> bool {
		match &expr.k {
			K::Paren(inner) => self.is_simple_assign_target(inner),
			K::Ident(_) | K::Member { .. } => true,
			_ => false,
		}
	}

	/// `strictDirective`.
	pub fn strict_directive(&self, mut start: usize) -> bool {
		let input = self.input;
		loop {
			start = chars::skip_white_space(input, start);
			let Some(length) = string_literal_len(input, start) else {
				return false;
			};
			let content = &input[start + 1..start + length - 1];
			if eq(content, "use strict") {
				let after = start + length;
				let end = chars::skip_white_space(input, after);
				let next = input.get(end).copied();
				return next == Some(59)
					|| next == Some(125)
					|| (has_line_break(input, after, end)
						&& !(matches!(
							next,
							Some(
								40 | 96
									| 46 | 91 | 43 | 45 | 47 | 42
									| 37 | 60 | 62 | 61 | 44 | 63
									| 94 | 38
							)
						) || next == Some(33) && input.get(end + 1) == Some(&61)));
			}
			start += length;
			start = chars::skip_white_space(input, start);
			if input.get(start) == Some(&59) {
				start += 1;
			}
		}
	}

	// ## Scope

	pub fn enter_scope(&mut self, flags: u32) {
		self.scope_stack.push(Scope {
			flags,
			var: Vec::new(),
			lexical: Vec::new(),
			functions: Vec::new(),
		});
	}

	pub fn exit_scope(&mut self) {
		self.scope_stack.pop();
	}

	fn treat_functions_as_var_in_scope(&self, flags: u32) -> bool {
		// `!this.inModule && ...` never applies to module code.
		flags & SCOPE_FUNCTION != 0
	}

	pub fn treat_functions_as_var(&self) -> bool {
		self.treat_functions_as_var_in_scope(self.current_scope().flags)
	}

	pub fn current_scope(&self) -> &Scope {
		self.scope_stack.last().expect("scope")
	}

	pub fn current_var_scope(&self) -> &Scope {
		self.scope_stack
			.iter()
			.rev()
			.find(|scope| {
				scope.flags & (SCOPE_VAR | SCOPE_CLASS_FIELD_INIT | SCOPE_CLASS_STATIC_BLOCK) != 0
			})
			.expect("var scope")
	}

	pub fn current_this_scope(&self) -> &Scope {
		self.scope_stack
			.iter()
			.rev()
			.find(|scope| {
				scope.flags & (SCOPE_VAR | SCOPE_CLASS_FIELD_INIT | SCOPE_CLASS_STATIC_BLOCK) != 0
					&& scope.flags & SCOPE_ARROW == 0
			})
			.expect("this scope")
	}

	pub fn in_function(&self) -> bool {
		self.current_var_scope().flags & SCOPE_FUNCTION > 0
	}

	pub fn in_generator(&self) -> bool {
		self.current_var_scope().flags & SCOPE_GENERATOR > 0
	}

	pub fn in_async(&self) -> bool {
		self.current_var_scope().flags & SCOPE_ASYNC > 0
	}

	pub fn can_await(&self) -> bool {
		for scope in self.scope_stack.iter().rev() {
			if scope.flags & (SCOPE_CLASS_STATIC_BLOCK | SCOPE_CLASS_FIELD_INIT) != 0 {
				return false;
			}
			if scope.flags & SCOPE_FUNCTION != 0 {
				return scope.flags & SCOPE_ASYNC > 0;
			}
		}
		// Module code at ecmaVersion >= 2022 allows top-level await.
		true
	}

	pub fn allow_return(&self) -> bool {
		self.in_function()
	}

	pub fn allow_super(&self) -> bool {
		self.current_this_scope().flags & SCOPE_SUPER > 0
	}

	pub fn allow_direct_super(&self) -> bool {
		self.current_this_scope().flags & SCOPE_DIRECT_SUPER > 0
	}

	pub fn allow_new_dot_target(&self) -> bool {
		self.scope_stack.iter().rev().any(|scope| {
			scope.flags & (SCOPE_CLASS_STATIC_BLOCK | SCOPE_CLASS_FIELD_INIT) != 0
				|| (scope.flags & SCOPE_FUNCTION != 0 && scope.flags & SCOPE_ARROW == 0)
		})
	}

	pub fn in_class_static_block(&self) -> bool {
		self.current_var_scope().flags & SCOPE_CLASS_STATIC_BLOCK > 0
	}

	pub fn declare_name(&mut self, name: &W, binding_type: u8, pos: usize) -> R<()> {
		let mut redeclared = false;
		let top = self.scope_stack.len() - 1;
		match binding_type {
			BIND_LEXICAL => {
				let scope = &mut self.scope_stack[top];
				redeclared = scope.lexical.contains(name)
					|| scope.functions.contains(name)
					|| scope.var.contains(name);
				scope.lexical.push(name.clone());
				if scope.flags & SCOPE_TOP != 0 {
					self.remove_undefined_export(name);
				}
			}
			BIND_SIMPLE_CATCH => {
				self.scope_stack[top].lexical.push(name.clone());
			}
			BIND_FUNCTION => {
				let as_var = self.treat_functions_as_var();
				let scope = &mut self.scope_stack[top];
				redeclared = if as_var {
					scope.lexical.contains(name)
				} else {
					scope.lexical.contains(name) || scope.var.contains(name)
				};
				scope.functions.push(name.clone());
			}
			_ => {
				for i in (0..self.scope_stack.len()).rev() {
					let flags = self.scope_stack[i].flags;
					let scope = &self.scope_stack[i];
					if (scope.lexical.contains(name)
						&& !(flags & SCOPE_SIMPLE_CATCH != 0
							&& scope.lexical.first() == Some(name)))
						|| (!self.treat_functions_as_var_in_scope(flags)
							&& scope.functions.contains(name))
					{
						redeclared = true;
						break;
					}
					self.scope_stack[i].var.push(name.clone());
					if flags & SCOPE_TOP != 0 {
						self.remove_undefined_export(name);
					}
					if flags & SCOPE_VAR != 0 {
						break;
					}
				}
			}
		}
		if redeclared {
			return self.raise(
				pos,
				format!("Identifier '{}' has already been declared", lossy(name)),
			);
		}
		Ok(())
	}

	fn remove_undefined_export(&mut self, name: &W) {
		self.undefined_exports.retain(|(key, _)| key != name);
	}

	pub fn check_local_export(&mut self, name: &W, start: usize) {
		if self.provisional {
			return;
		}
		let top = &self.scope_stack[0];
		if !top.lexical.contains(name) && !top.var.contains(name) {
			// Re-assigning an existing key keeps its insertion position.
			if let Some(entry) = self
				.undefined_exports
				.iter_mut()
				.find(|(key, _)| key == name)
			{
				entry.1 = start;
			} else {
				self.undefined_exports.push((name.clone(), start));
			}
		}
	}
}

/// Length of acorn's `literal` regex match at `start`
/// (`'((?:\\[^]|[^'\\])*?)'|"((?:\\[^]|[^"\\])*?)"`).
fn string_literal_len(input: &[u16], start: usize) -> Option<usize> {
	let quote = *input.get(start)?;
	if quote != 34 && quote != 39 {
		return None;
	}
	let mut i = start + 1;
	while i < input.len() {
		let c = input[i];
		if c == quote {
			return Some(i + 1 - start);
		}
		if c == 92 {
			if i + 1 >= input.len() {
				return None;
			}
			i += 2;
		} else {
			i += 1;
		}
	}
	None
}

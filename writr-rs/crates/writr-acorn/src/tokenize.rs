//! Port of acorn's tokenizer (`tokenize.js`, `tokencontext.js`) with the
//! acorn-jsx `readToken`/`updateContext` overrides applied.

use crate::chars::{
	code_point_to_string, has_line_break, index_of, is_identifier_char, is_identifier_start,
	is_new_line, is_non_ascii_whitespace, lossy, to_uint16,
};
use crate::node::W;
use crate::parser::{Fail, Parser, R};
use crate::token::{Ctx, T};

impl<'a> Parser<'a> {
	/// `next(ignoreEscapeSequenceInKeyword)`.
	pub fn next(&mut self, ignore_escape_in_keyword: bool) -> R<()> {
		if !ignore_escape_in_keyword && self.contains_esc {
			if let Some(keyword) = self.ty.keyword() {
				return self.raise(self.start, format!("Escape sequence in keyword {keyword}"));
			}
		}
		self.last_tok_end = self.end;
		self.last_tok_start = self.start;
		self.next_token()
	}

	pub fn cur_context(&self) -> Option<Ctx> {
		self.context.last().copied()
	}

	pub fn next_token(&mut self) -> R<()> {
		let cur = self.cur_context();
		if cur.is_none_or(|ctx| !ctx.preserve_space()) {
			self.skip_space()?;
		}
		self.start = self.pos;
		if self.pos >= self.input.len() {
			self.finish_token(T::Eof, None);
			return Ok(());
		}
		match cur {
			None => Err(Fail::Runtime(
				"TypeError: Cannot read properties of undefined (reading 'override')".into(),
			)),
			Some(Ctx::QTmpl) => self.try_read_template_token(),
			Some(_) => self.read_token(self.full_char_code_at(self.pos)),
		}
	}

	/// acorn-jsx `readToken`, falling back to acorn's.
	fn read_token(&mut self, code: Option<u32>) -> R<()> {
		let context = self.cur_context();
		if context == Some(Ctx::JsxExpr) {
			return self.jsx_read_token();
		}
		if context == Some(Ctx::JsxOTag) || context == Some(Ctx::JsxCTag) {
			if is_identifier_start(code) {
				return self.jsx_read_word();
			}
			if code == Some(62) {
				self.pos += 1;
				self.finish_token(T::JsxTagEnd, None);
				return Ok(());
			}
			if (code == Some(34) || code == Some(39)) && context == Some(Ctx::JsxOTag) {
				return self.jsx_read_string(code.unwrap() as u16);
			}
		}
		if code == Some(60) && self.expr_allowed && self.cu(self.pos + 1) != Some(33) {
			self.pos += 1;
			self.finish_token(T::JsxTagStart, None);
			return Ok(());
		}
		if is_identifier_start(code) || code == Some(92) {
			return self.read_word();
		}
		self.get_token_from_code(code)
	}

	fn skip_block_comment(&mut self) -> R<()> {
		self.pos += 2;
		match index_of(self.input, &[42, 47], self.pos) {
			Some(end) => {
				self.pos = end + 2;
				Ok(())
			}
			None => self.raise(self.pos - 2, "Unterminated comment"),
		}
	}

	pub fn skip_line_comment(&mut self, start_skip: usize) {
		self.pos += start_skip;
		while self.pos < self.input.len() && !is_new_line(self.cu(self.pos)) {
			self.pos += 1;
		}
	}

	fn skip_space(&mut self) -> R<()> {
		while self.pos < self.input.len() {
			let ch = self.input[self.pos];
			match ch {
				32 | 160 => self.pos += 1,
				13 => {
					if self.cu(self.pos + 1) == Some(10) {
						self.pos += 1;
					}
					self.pos += 1;
				}
				10 | 8232 | 8233 => self.pos += 1,
				47 => match self.cu(self.pos + 1) {
					Some(42) => self.skip_block_comment()?,
					Some(47) => self.skip_line_comment(2),
					_ => break,
				},
				_ => {
					if (ch > 8 && ch < 14) || (ch >= 5760 && is_non_ascii_whitespace(ch)) {
						self.pos += 1;
					} else {
						break;
					}
				}
			}
		}
		Ok(())
	}

	pub fn finish_token(&mut self, ty: T, value: Option<W>) {
		self.end = self.pos;
		let prev = self.ty;
		self.ty = ty;
		self.value = value;
		self.update_context(prev);
	}

	// ## Token contexts

	fn brace_is_block(&self, prev: T) -> bool {
		let parent = self.cur_context();
		if parent == Some(Ctx::FExpr) || parent == Some(Ctx::FStat) {
			return true;
		}
		if prev == T::Colon && (parent == Some(Ctx::BStat) || parent == Some(Ctx::BExpr)) {
			return !parent.unwrap().is_expr();
		}
		if prev == T::Return || (prev == T::Name && self.expr_allowed) {
			return has_line_break(self.input, self.last_tok_end, self.start);
		}
		if matches!(prev, T::Else | T::Semi | T::Eof | T::ParenR | T::Arrow) {
			return true;
		}
		if prev == T::BraceL {
			return parent == Some(Ctx::BStat);
		}
		if matches!(prev, T::Var | T::Const | T::Name) {
			return false;
		}
		!self.expr_allowed
	}

	fn in_generator_context(&self) -> bool {
		for i in (1..self.context.len()).rev() {
			let context = self.context[i];
			if context.is_function() {
				return context.generator();
			}
		}
		false
	}

	pub fn override_context(&mut self, ctx: Ctx) {
		if self.cur_context() != Some(ctx) {
			if let Some(last) = self.context.last_mut() {
				*last = ctx;
			}
		}
	}

	/// acorn-jsx `updateContext`, falling back to acorn's.
	fn update_context(&mut self, prev: T) {
		if self.ty == T::BraceL {
			match self.cur_context() {
				Some(Ctx::JsxOTag) => self.context.push(Ctx::BExpr),
				Some(Ctx::JsxExpr) => self.context.push(Ctx::BTmpl),
				_ => self.base_update_context(prev),
			}
			self.expr_allowed = true;
		} else if self.ty == T::Slash && prev == T::JsxTagStart {
			let len = self.context.len();
			self.context.truncate(len.saturating_sub(2));
			self.context.push(Ctx::JsxCTag);
			self.expr_allowed = false;
		} else {
			self.base_update_context(prev);
		}
	}

	fn base_update_context(&mut self, prev: T) {
		let ty = self.ty;
		if ty.keyword().is_some() && prev == T::Dot {
			self.expr_allowed = false;
			return;
		}
		match ty {
			T::ParenR | T::BraceR => {
				if self.context.len() == 1 {
					self.expr_allowed = true;
					return;
				}
				let mut out = self.context.pop();
				if out == Some(Ctx::BStat) && self.cur_context().is_some_and(Ctx::is_function) {
					out = self.context.pop();
				}
				self.expr_allowed = !out.is_some_and(Ctx::is_expr);
			}
			T::BraceL => {
				let ctx = if self.brace_is_block(prev) {
					Ctx::BStat
				} else {
					Ctx::BExpr
				};
				self.context.push(ctx);
				self.expr_allowed = true;
			}
			T::DollarBraceL => {
				self.context.push(Ctx::BTmpl);
				self.expr_allowed = true;
			}
			T::ParenL => {
				let statement_parens = matches!(prev, T::If | T::For | T::With | T::While);
				self.context.push(if statement_parens {
					Ctx::PStat
				} else {
					Ctx::PExpr
				});
				self.expr_allowed = true;
			}
			T::IncDec => {}
			T::Function | T::Class => {
				let cur = self.cur_context();
				if prev.before_expr()
					&& prev != T::Else
					&& !(prev == T::Semi && cur != Some(Ctx::PStat))
					&& !(prev == T::Return
						&& has_line_break(self.input, self.last_tok_end, self.start))
					&& !((prev == T::Colon || prev == T::BraceL) && cur == Some(Ctx::BStat))
				{
					self.context.push(Ctx::FExpr);
				} else {
					self.context.push(Ctx::FStat);
				}
				self.expr_allowed = false;
			}
			T::Colon => {
				if self.cur_context().is_some_and(Ctx::is_function) {
					self.context.pop();
				}
				self.expr_allowed = true;
			}
			T::BackQuote => {
				if self.cur_context() == Some(Ctx::QTmpl) {
					self.context.pop();
				} else {
					self.context.push(Ctx::QTmpl);
				}
				self.expr_allowed = false;
			}
			T::Star => {
				if prev == T::Function {
					if let Some(last) = self.context.last_mut() {
						*last = if *last == Ctx::FExpr {
							Ctx::FExprGen
						} else {
							Ctx::FGen
						};
					}
				}
				self.expr_allowed = true;
			}
			T::Name => {
				let mut allowed = false;
				if prev != T::Dot
					&& ((self.value_is("of") && !self.expr_allowed)
						|| (self.value_is("yield") && self.in_generator_context()))
				{
					allowed = true;
				}
				self.expr_allowed = allowed;
			}
			T::JsxTagStart => {
				self.context.push(Ctx::JsxExpr);
				self.context.push(Ctx::JsxOTag);
				self.expr_allowed = false;
			}
			T::JsxTagEnd => {
				let out = self.context.pop();
				if (out == Some(Ctx::JsxOTag) && prev == T::Slash) || out == Some(Ctx::JsxCTag) {
					self.context.pop();
					self.expr_allowed = self.cur_context() == Some(Ctx::JsxExpr);
				} else {
					self.expr_allowed = true;
				}
			}
			_ => self.expr_allowed = ty.before_expr(),
		}
	}

	// ## Token reading

	fn read_token_dot(&mut self) -> R<()> {
		let next = self.cu(self.pos + 1);
		if matches!(next, Some(48..=57)) {
			return self.read_number(true);
		}
		let next2 = self.cu(self.pos + 2);
		if next == Some(46) && next2 == Some(46) {
			self.pos += 3;
			self.finish_token(T::Ellipsis, None);
		} else {
			self.pos += 1;
			self.finish_token(T::Dot, None);
		}
		Ok(())
	}

	fn read_token_slash(&mut self) -> R<()> {
		let next = self.cu(self.pos + 1);
		if self.expr_allowed {
			self.pos += 1;
			return self.read_regexp();
		}
		if next == Some(61) {
			self.finish_op(T::Assign, 2);
		} else {
			self.finish_op(T::Slash, 1);
		}
		Ok(())
	}

	fn read_token_mult_modulo_exp(&mut self, code: u16) {
		let mut next = self.cu(self.pos + 1);
		let mut size = 1;
		let mut ty = if code == 42 { T::Star } else { T::Modulo };
		if code == 42 && next == Some(42) {
			size += 1;
			ty = T::Starstar;
			next = self.cu(self.pos + 2);
		}
		if next == Some(61) {
			self.finish_op(T::Assign, size + 1);
		} else {
			self.finish_op(ty, size);
		}
	}

	fn read_token_pipe_amp(&mut self, code: u16) {
		let next = self.cu(self.pos + 1);
		if next == Some(code) {
			if self.cu(self.pos + 2) == Some(61) {
				return self.finish_op(T::Assign, 3);
			}
			return self.finish_op(
				if code == 124 {
					T::LogicalOr
				} else {
					T::LogicalAnd
				},
				2,
			);
		}
		if next == Some(61) {
			return self.finish_op(T::Assign, 2);
		}
		self.finish_op(
			if code == 124 {
				T::BitwiseOr
			} else {
				T::BitwiseAnd
			},
			1,
		);
	}

	fn read_token_caret(&mut self) {
		if self.cu(self.pos + 1) == Some(61) {
			self.finish_op(T::Assign, 2);
		} else {
			self.finish_op(T::BitwiseXor, 1);
		}
	}

	fn read_token_plus_min(&mut self, code: u16) {
		let next = self.cu(self.pos + 1);
		if next == Some(code) {
			// `-->` comments are script-only.
			return self.finish_op(T::IncDec, 2);
		}
		if next == Some(61) {
			return self.finish_op(T::Assign, 2);
		}
		self.finish_op(T::PlusMin, 1);
	}

	fn read_token_lt_gt(&mut self, code: u16) {
		let next = self.cu(self.pos + 1);
		let mut size = 1;
		if next == Some(code) {
			size = if code == 62 && self.cu(self.pos + 2) == Some(62) {
				3
			} else {
				2
			};
			if self.cu(self.pos + size) == Some(61) {
				return self.finish_op(T::Assign, size + 1);
			}
			return self.finish_op(T::BitShift, size);
		}
		// `<!--` comments are script-only.
		if next == Some(61) {
			size = 2;
		}
		self.finish_op(T::Relational, size);
	}

	fn read_token_eq_excl(&mut self, code: u16) {
		let next = self.cu(self.pos + 1);
		if next == Some(61) {
			let size = if self.cu(self.pos + 2) == Some(61) {
				3
			} else {
				2
			};
			return self.finish_op(T::Equality, size);
		}
		if code == 61 && next == Some(62) {
			self.pos += 2;
			return self.finish_token(T::Arrow, None);
		}
		self.finish_op(if code == 61 { T::Eq } else { T::Prefix }, 1);
	}

	fn read_token_question(&mut self) {
		let next = self.cu(self.pos + 1);
		if next == Some(46) {
			// `NaN < 48 || NaN > 57` is false.
			if let Some(next2) = self.cu(self.pos + 2) {
				if !(48..=57).contains(&next2) {
					return self.finish_op(T::QuestionDot, 2);
				}
			}
		}
		if next == Some(63) {
			if self.cu(self.pos + 2) == Some(61) {
				return self.finish_op(T::Assign, 3);
			}
			return self.finish_op(T::Coalesce, 2);
		}
		self.finish_op(T::Question, 1);
	}

	fn read_token_number_sign(&mut self) -> R<()> {
		self.pos += 1;
		let code = self.full_char_code_at(self.pos);
		if is_identifier_start(code) || code == Some(92) {
			let word = self.read_word1()?;
			self.finish_token(T::PrivateId, Some(word));
			return Ok(());
		}
		self.raise(
			self.pos,
			format!(
				"Unexpected character '{}'",
				lossy(&code_point_to_string(code.map(f64::from)))
			),
		)
	}

	fn get_token_from_code(&mut self, code: Option<u32>) -> R<()> {
		let simple = |ty: T| {
			move |parser: &mut Self| {
				parser.pos += 1;
				parser.finish_token(ty, None);
				Ok(())
			}
		};
		match code {
			Some(46) => self.read_token_dot(),
			Some(40) => simple(T::ParenL)(self),
			Some(41) => simple(T::ParenR)(self),
			Some(59) => simple(T::Semi)(self),
			Some(44) => simple(T::Comma)(self),
			Some(91) => simple(T::BracketL)(self),
			Some(93) => simple(T::BracketR)(self),
			Some(123) => simple(T::BraceL)(self),
			Some(125) => simple(T::BraceR)(self),
			Some(58) => simple(T::Colon)(self),
			Some(96) => simple(T::BackQuote)(self),
			Some(48) => {
				let next = self.cu(self.pos + 1);
				match next {
					Some(120 | 88) => self.read_radix_number(16),
					Some(111 | 79) => self.read_radix_number(8),
					Some(98 | 66) => self.read_radix_number(2),
					_ => self.read_number(false),
				}
			}
			Some(49..=57) => self.read_number(false),
			Some(34 | 39) => self.read_string(code.unwrap() as u16),
			Some(47) => self.read_token_slash(),
			Some(37 | 42) => {
				self.read_token_mult_modulo_exp(code.unwrap() as u16);
				Ok(())
			}
			Some(124 | 38) => {
				self.read_token_pipe_amp(code.unwrap() as u16);
				Ok(())
			}
			Some(94) => {
				self.read_token_caret();
				Ok(())
			}
			Some(43 | 45) => {
				self.read_token_plus_min(code.unwrap() as u16);
				Ok(())
			}
			Some(60 | 62) => {
				self.read_token_lt_gt(code.unwrap() as u16);
				Ok(())
			}
			Some(61 | 33) => {
				self.read_token_eq_excl(code.unwrap() as u16);
				Ok(())
			}
			Some(63) => {
				self.read_token_question();
				Ok(())
			}
			Some(126) => {
				self.finish_op(T::Prefix, 1);
				Ok(())
			}
			Some(35) => self.read_token_number_sign(),
			_ => self.raise(
				self.pos,
				format!(
					"Unexpected character '{}'",
					lossy(&code_point_to_string(code.map(f64::from)))
				),
			),
		}
	}

	fn finish_op(&mut self, ty: T, size: usize) {
		let value = self.slice(self.pos, self.pos + size).to_vec();
		self.pos += size;
		self.finish_token(ty, Some(value));
	}

	/// `readRegexp`, which starts just after the opening slash.
	pub fn read_regexp(&mut self) -> R<()> {
		let start = self.pos;
		let mut escaped = false;
		let mut in_class = false;
		loop {
			if self.pos >= self.input.len() {
				return self.raise(start, "Unterminated regular expression");
			}
			let ch = self.input[self.pos];
			if is_new_line(Some(ch)) {
				return self.raise(start, "Unterminated regular expression");
			}
			if !escaped {
				if ch == 91 {
					in_class = true;
				} else if ch == 93 && in_class {
					in_class = false;
				} else if ch == 47 && !in_class {
					break;
				}
				escaped = ch == 92;
			} else {
				escaped = false;
			}
			self.pos += 1;
		}
		let pattern = self.slice(start, self.pos);
		self.pos += 1;
		let flags_start = self.pos;
		let flags = self.read_word1()?;
		if self.contains_esc {
			return self.unexpected(Some(flags_start));
		}
		self.validate_regexp(start, pattern, &flags)?;
		self.finish_token(T::Regexp, None);
		Ok(())
	}

	/// `readInt(radix, len, maybeLegacyOctalNumericLiteral)`.
	fn read_int(
		&mut self,
		radix: u32,
		len: Option<i64>,
		maybe_legacy_octal: bool,
	) -> R<Option<f64>> {
		let allow_separators = len.is_none();
		let is_legacy_octal = maybe_legacy_octal && self.cu(self.pos) == Some(48);
		let start = self.pos;
		let mut total = 0.0f64;
		let mut last_code: Option<u16> = Some(0);
		let mut i: i64 = 0;
		while len.is_none_or(|len| i < len) {
			let code = self.cu(self.pos);
			if allow_separators && code == Some(95) {
				if is_legacy_octal {
					return self.raise(
						self.pos,
						"Numeric separator is not allowed in legacy octal numeric literals",
					);
				}
				if last_code == Some(95) {
					return self
						.raise(self.pos, "Numeric separator must be exactly one underscore");
				}
				if i == 0 {
					return self.raise(
						self.pos,
						"Numeric separator is not allowed at the first of digits",
					);
				}
				last_code = code;
				i += 1;
				self.pos += 1;
				continue;
			}
			let value = match code {
				Some(c) if c >= 97 => (c - 97 + 10) as u32,
				Some(c) if c >= 65 => (c - 65 + 10) as u32,
				Some(c @ 48..=57) => (c - 48) as u32,
				_ => u32::MAX,
			};
			if value >= radix {
				break;
			}
			last_code = code;
			total = total * radix as f64 + value as f64;
			i += 1;
			self.pos += 1;
		}
		if allow_separators && last_code == Some(95) {
			return self.raise(
				self.pos - 1,
				"Numeric separator is not allowed at the last of digits",
			);
		}
		if self.pos == start || len.is_some_and(|len| (self.pos - start) as i64 != len) {
			return Ok(None);
		}
		Ok(Some(total))
	}

	fn read_radix_number(&mut self, radix: u32) -> R<()> {
		self.pos += 2;
		let value = self.read_int(radix, None, false)?;
		if value.is_none() {
			return self.raise(self.start + 2, format!("Expected number in radix {radix}"));
		}
		if self.cu(self.pos) == Some(110) {
			self.pos += 1;
		} else if is_identifier_start(self.full_char_code_at(self.pos)) {
			return self.raise(self.pos, "Identifier directly after number");
		}
		self.finish_token(T::Num, None);
		Ok(())
	}

	fn read_number(&mut self, starts_with_dot: bool) -> R<()> {
		let start = self.pos;
		if !starts_with_dot && self.read_int(10, None, true)?.is_none() {
			return self.raise(start, "Invalid number");
		}
		let mut octal = self.pos - start >= 2 && self.cu(start) == Some(48);
		if octal && self.strict {
			return self.raise(start, "Invalid number");
		}
		let mut next = self.cu(self.pos);
		if !octal && !starts_with_dot && next == Some(110) {
			self.pos += 1;
			if is_identifier_start(self.full_char_code_at(self.pos)) {
				return self.raise(self.pos, "Identifier directly after number");
			}
			self.finish_token(T::Num, None);
			return Ok(());
		}
		if octal
			&& self
				.slice(start, self.pos)
				.iter()
				.any(|&c| c == 56 || c == 57)
		{
			octal = false;
		}
		if next == Some(46) && !octal {
			self.pos += 1;
			self.read_int(10, None, false)?;
			next = self.cu(self.pos);
		}
		if (next == Some(69) || next == Some(101)) && !octal {
			self.pos += 1;
			next = self.cu(self.pos);
			if next == Some(43) || next == Some(45) {
				self.pos += 1;
			}
			if self.read_int(10, None, false)?.is_none() {
				return self.raise(start, "Invalid number");
			}
		}
		if is_identifier_start(self.full_char_code_at(self.pos)) {
			return self.raise(self.pos, "Identifier directly after number");
		}
		self.finish_token(T::Num, None);
		Ok(())
	}

	fn read_code_point(&mut self) -> R<f64> {
		let code;
		if self.cu(self.pos) == Some(123) {
			self.pos += 1;
			let code_pos = self.pos;
			let close = index_of(self.input, &[125], self.pos).map_or(-1, |at| at as i64);
			code = self.read_hex_char(close - self.pos as i64)?;
			self.pos += 1;
			if code > 1_114_111.0 {
				return self.invalid_string_token(code_pos, "Code point out of bounds");
			}
		} else {
			code = self.read_hex_char(4)?;
		}
		Ok(code)
	}

	fn read_string(&mut self, quote: u16) -> R<()> {
		let mut out: W = Vec::new();
		self.pos += 1;
		let mut chunk_start = self.pos;
		loop {
			if self.pos >= self.input.len() {
				return self.raise(self.start, "Unterminated string constant");
			}
			let ch = self.input[self.pos];
			if ch == quote {
				break;
			}
			if ch == 92 {
				out.extend_from_slice(self.slice(chunk_start, self.pos));
				let escaped = self.read_escaped_char(false)?;
				out.extend(escaped);
				chunk_start = self.pos;
			} else if ch == 0x2028 || ch == 0x2029 {
				self.pos += 1;
			} else {
				if is_new_line(Some(ch)) {
					return self.raise(self.start, "Unterminated string constant");
				}
				self.pos += 1;
			}
		}
		out.extend_from_slice(self.slice(chunk_start, self.pos));
		self.pos += 1;
		self.finish_token(T::String, Some(out));
		Ok(())
	}

	fn try_read_template_token(&mut self) -> R<()> {
		self.in_template_element = true;
		match self.read_tmpl_token() {
			Err(Fail::InvalidTemplate) => self.read_invalid_template_token()?,
			other => other?,
		}
		self.in_template_element = false;
		Ok(())
	}

	pub fn invalid_string_token<X>(&self, position: usize, message: &str) -> R<X> {
		if self.in_template_element {
			Err(Fail::InvalidTemplate)
		} else {
			self.raise(position, message)
		}
	}

	fn read_tmpl_token(&mut self) -> R<()> {
		loop {
			if self.pos >= self.input.len() {
				return self.raise(self.start, "Unterminated template");
			}
			let ch = self.input[self.pos];
			if ch == 96 || (ch == 36 && self.cu(self.pos + 1) == Some(123)) {
				if self.pos == self.start
					&& (self.ty == T::Template || self.ty == T::InvalidTemplate)
				{
					if ch == 36 {
						self.pos += 2;
						self.finish_token(T::DollarBraceL, None);
					} else {
						self.pos += 1;
						self.finish_token(T::BackQuote, None);
					}
					return Ok(());
				}
				self.finish_token(T::Template, None);
				return Ok(());
			}
			if ch == 92 {
				self.read_escaped_char(true)?;
			} else if is_new_line(Some(ch)) {
				self.pos += 1;
				if ch == 13 && self.cu(self.pos) == Some(10) {
					self.pos += 1;
				}
			} else {
				self.pos += 1;
			}
		}
	}

	fn read_invalid_template_token(&mut self) -> R<()> {
		while self.pos < self.input.len() {
			match self.input[self.pos] {
				92 => self.pos += 1,
				36 if self.cu(self.pos + 1) == Some(123) => {
					self.finish_token(T::InvalidTemplate, None);
					return Ok(());
				}
				96 => {
					self.finish_token(T::InvalidTemplate, None);
					return Ok(());
				}
				13 => {
					if self.cu(self.pos + 1) == Some(10) {
						self.pos += 1;
					}
				}
				_ => {}
			}
			self.pos += 1;
		}
		self.raise(self.start, "Unterminated template")
	}

	/// `readEscapedChar`: the cooked text of one escape sequence.
	fn read_escaped_char(&mut self, in_template: bool) -> R<W> {
		self.pos += 1;
		let ch = self.cu(self.pos);
		self.pos += 1;
		match ch {
			Some(110) => Ok(vec![10]),
			Some(114) => Ok(vec![13]),
			Some(120) => Ok(vec![to_uint16(self.read_hex_char(2)?)]),
			Some(117) => {
				let code = self.read_code_point()?;
				Ok(code_point_to_string(Some(code)))
			}
			Some(116) => Ok(vec![9]),
			Some(98) => Ok(vec![8]),
			Some(118) => Ok(vec![11]),
			Some(102) => Ok(vec![12]),
			Some(13) => {
				if self.cu(self.pos) == Some(10) {
					self.pos += 1;
				}
				Ok(Vec::new())
			}
			Some(10) => Ok(Vec::new()),
			_ => {
				if matches!(ch, Some(56 | 57)) {
					if self.strict {
						return self.invalid_string_token(self.pos - 1, "Invalid escape sequence");
					}
					if in_template {
						return self.invalid_string_token(
							self.pos - 1,
							"Invalid escape sequence in template string",
						);
					}
				}
				if let Some(c @ 48..=55) = ch {
					let _ = c;
					let mut digits: Vec<u16> = Vec::new();
					for i in 0..3 {
						match self.cu(self.pos - 1 + i) {
							Some(d @ 48..=55) => digits.push(d),
							_ => break,
						}
					}
					let parse = |digits: &[u16]| {
						digits
							.iter()
							.fold(0u32, |total, &d| total * 8 + (d - 48) as u32)
					};
					let mut octal = parse(&digits);
					if octal > 255 {
						digits.pop();
						octal = parse(&digits);
					}
					self.pos += digits.len() - 1;
					let next = self.cu(self.pos);
					let is_zero = digits.len() == 1 && digits[0] == 48;
					if (!is_zero || next == Some(56) || next == Some(57))
						&& (self.strict || in_template)
					{
						return self.invalid_string_token(
							self.pos - 1 - digits.len(),
							if in_template {
								"Octal literal in template string"
							} else {
								"Octal literal in strict mode"
							},
						);
					}
					return Ok(vec![octal as u16]);
				}
				if is_new_line(ch) {
					return Ok(Vec::new());
				}
				Ok(vec![ch.unwrap_or(0)])
			}
		}
	}

	fn read_hex_char(&mut self, len: i64) -> R<f64> {
		let code_pos = self.pos;
		match self.read_int(16, Some(len), false)? {
			Some(n) => Ok(n),
			None => self.invalid_string_token(code_pos, "Bad character escape sequence"),
		}
	}

	/// `readWord1`: an identifier name with `\u` escapes decoded.
	pub fn read_word1(&mut self) -> R<W> {
		self.contains_esc = false;
		let mut word: W = Vec::new();
		let mut first = true;
		let mut chunk_start = self.pos;
		while self.pos < self.input.len() {
			let ch = self.full_char_code_at(self.pos);
			if is_identifier_char(ch) {
				self.pos += if ch.unwrap() <= 0xffff { 1 } else { 2 };
			} else if ch == Some(92) {
				self.contains_esc = true;
				word.extend_from_slice(self.slice(chunk_start, self.pos));
				let esc_start = self.pos;
				self.pos += 1;
				if self.cu(self.pos) != Some(117) {
					return self.invalid_string_token(
						self.pos,
						"Expecting Unicode escape sequence \\uXXXX",
					);
				}
				self.pos += 1;
				let esc = self.read_code_point()?;
				let code = Some(esc as u32);
				let valid = if first {
					is_identifier_start(code)
				} else {
					is_identifier_char(code)
				};
				if !valid {
					return self.invalid_string_token(esc_start, "Invalid Unicode escape");
				}
				word.extend(code_point_to_string(Some(esc)));
				chunk_start = self.pos;
			} else {
				break;
			}
			first = false;
		}
		word.extend_from_slice(self.slice(chunk_start, self.pos));
		Ok(word)
	}

	fn read_word(&mut self) -> R<()> {
		let word = self.read_word1()?;
		let ty = T::from_keyword(&word).unwrap_or(T::Name);
		self.finish_token(ty, Some(word));
		Ok(())
	}

	// ## acorn-jsx tokens

	fn jsx_read_token(&mut self) -> R<()> {
		loop {
			if self.pos >= self.input.len() {
				return self.raise(self.start, "Unterminated JSX contents");
			}
			let ch = self.input[self.pos];
			match ch {
				60 | 123 => {
					if self.pos == self.start {
						if ch == 60 && self.expr_allowed {
							self.pos += 1;
							self.finish_token(T::JsxTagStart, None);
							return Ok(());
						}
						return self.get_token_from_code(Some(ch as u32));
					}
					self.finish_token(T::JsxText, None);
					return Ok(());
				}
				38 => self.jsx_read_entity(),
				62 | 125 => {
					let c = char::from_u32(ch as u32).unwrap();
					return self.raise(
						self.pos,
						format!(
							"Unexpected token `{c}`. Did you mean `{}` or `{{\"{c}\"}}`?",
							if ch == 62 { "&gt;" } else { "&rbrace;" }
						),
					);
				}
				_ => {
					if is_new_line(Some(ch)) {
						self.jsx_read_new_line();
					} else {
						self.pos += 1;
					}
				}
			}
		}
	}

	fn jsx_read_new_line(&mut self) {
		let ch = self.input[self.pos];
		self.pos += 1;
		if ch == 13 && self.cu(self.pos) == Some(10) {
			self.pos += 1;
		}
	}

	fn jsx_read_string(&mut self, quote: u16) -> R<()> {
		self.pos += 1;
		loop {
			if self.pos >= self.input.len() {
				return self.raise(self.start, "Unterminated string constant");
			}
			let ch = self.input[self.pos];
			if ch == quote {
				break;
			}
			if ch == 38 {
				self.jsx_read_entity();
			} else if is_new_line(Some(ch)) {
				self.jsx_read_new_line();
			} else {
				self.pos += 1;
			}
		}
		self.pos += 1;
		self.finish_token(T::String, Some(Vec::new()));
		Ok(())
	}

	/// `jsx_readEntity`. Whether an entity is recognized only changes the
	/// decoded text, never where tokens end: a recognized entity spans name
	/// characters, digits, `#` and `;` only, which the callers would step
	/// over one by one anyway. So this always takes the "not an entity"
	/// path and resumes after the `&`.
	fn jsx_read_entity(&mut self) {
		self.pos += 1;
	}

	fn jsx_read_word(&mut self) -> R<()> {
		let start = self.pos;
		loop {
			self.pos += 1;
			let ch = self.cu(self.pos);
			if !(is_identifier_char(ch.map(u32::from)) || ch == Some(45)) {
				break;
			}
		}
		let name = self.slice(start, self.pos).to_vec();
		self.finish_token(T::JsxName, Some(name));
		Ok(())
	}
}

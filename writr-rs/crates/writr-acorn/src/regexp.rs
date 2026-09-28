//! Port of acorn's `RegExpValidationState` and `regexp_*` validator at
//! ecmaVersion 2024 (`u`/`v`/`s`/`d` flags, no modifiers, no duplicate
//! named groups across alternatives).

use std::collections::HashSet;

use crate::chars::{code_point_to_string, is_identifier_char, is_identifier_start, lossy};
use crate::generated::tables::{
	BINARY_PROPERTIES, BINARY_PROPERTIES_OF_STRINGS, GENERAL_CATEGORY_VALUES, SCRIPT_VALUES,
};
use crate::node::W;
use crate::parser::{Fail, Parser, MAX_DEPTH, R};

const CHARSET_NONE: u8 = 0;
const CHARSET_OK: u8 = 1;
const CHARSET_STRING: u8 = 2;

struct State<'s> {
	source: &'s [u16],
	start: usize,
	switch_u: bool,
	switch_v: bool,
	switch_n: bool,
	pos: usize,
	last_int_value: f64,
	last_string_value: W,
	last_assertion_is_quantifiable: bool,
	num_capturing_parens: f64,
	max_back_reference: f64,
	group_names: HashSet<W>,
	back_reference_names: Vec<W>,
	depth: usize,
}

impl State<'_> {
	fn at(&self, i: usize, force_u: bool) -> i64 {
		let s = self.source;
		let l = s.len();
		if i >= l {
			return -1;
		}
		let c = s[i] as i64;
		if !(force_u || self.switch_u) || c <= 0xd7ff || c >= 0xe000 || i + 1 >= l {
			return c;
		}
		let next = s[i + 1] as i64;
		if (0xdc00..=0xdfff).contains(&next) {
			(c << 10) + next - 0x35f_dc00
		} else {
			c
		}
	}

	fn next_index(&self, i: usize, force_u: bool) -> usize {
		let s = self.source;
		let l = s.len();
		if i >= l {
			return l;
		}
		let c = s[i];
		if !(force_u || self.switch_u) || c <= 0xd7ff || c >= 0xe000 || i + 1 >= l {
			return i + 1;
		}
		let next = s[i + 1];
		if !(0xdc00..=0xdfff).contains(&next) {
			return i + 1;
		}
		i + 2
	}

	fn current(&self) -> i64 {
		self.at(self.pos, false)
	}

	fn current_u(&self, force_u: bool) -> i64 {
		self.at(self.pos, force_u)
	}

	fn lookahead(&self) -> i64 {
		self.at(self.next_index(self.pos, false), false)
	}

	fn advance(&mut self) {
		self.pos = self.next_index(self.pos, false);
	}

	fn advance_u(&mut self, force_u: bool) {
		self.pos = self.next_index(self.pos, force_u);
	}

	fn eat(&mut self, ch: i64) -> bool {
		if self.current() == ch {
			self.advance();
			true
		} else {
			false
		}
	}

	fn eat_chars(&mut self, chs: &[i64]) -> bool {
		let mut pos = self.pos;
		for &ch in chs {
			let current = self.at(pos, false);
			if current == -1 || current != ch {
				return false;
			}
			pos = self.next_index(pos, false);
		}
		self.pos = pos;
		true
	}
}

fn is_syntax_character(ch: i64) -> bool {
	ch == 0x24
		|| (0x28..=0x2b).contains(&ch)
		|| ch == 0x2e
		|| ch == 0x3f
		|| (0x5b..=0x5e).contains(&ch)
		|| (0x7b..=0x7d).contains(&ch)
}

fn is_regexp_identifier_start(ch: i64) -> bool {
	code(ch).is_some_and(|c| is_identifier_start(Some(c))) || ch == 0x24 || ch == 0x5f
}

fn is_regexp_identifier_part(ch: i64) -> bool {
	code(ch).is_some_and(|c| is_identifier_char(Some(c)))
		|| ch == 0x24
		|| ch == 0x5f
		|| ch == 0x200c
		|| ch == 0x200d
}

fn code(ch: i64) -> Option<u32> {
	u32::try_from(ch).ok()
}

fn is_control_letter(ch: i64) -> bool {
	(0x41..=0x5a).contains(&ch) || (0x61..=0x7a).contains(&ch)
}

fn is_character_class_escape(ch: i64) -> bool {
	matches!(ch, 0x64 | 0x44 | 0x73 | 0x53 | 0x77 | 0x57)
}

fn is_unicode_property_name_character(ch: i64) -> bool {
	is_control_letter(ch) || ch == 0x5f
}

fn is_unicode_property_value_character(ch: i64) -> bool {
	is_unicode_property_name_character(ch) || is_decimal_digit(ch)
}

fn is_decimal_digit(ch: i64) -> bool {
	(0x30..=0x39).contains(&ch)
}

fn is_hex_digit(ch: i64) -> bool {
	is_decimal_digit(ch) || (0x41..=0x46).contains(&ch) || (0x61..=0x66).contains(&ch)
}

fn hex_to_int(ch: i64) -> f64 {
	if (0x41..=0x46).contains(&ch) {
		return (10 + ch - 0x41) as f64;
	}
	if (0x61..=0x66).contains(&ch) {
		return (10 + ch - 0x61) as f64;
	}
	(ch - 0x30) as f64
}

fn is_octal_digit(ch: i64) -> bool {
	(0x30..=0x37).contains(&ch)
}

fn is_class_set_reserved_double_punctuator_character(ch: i64) -> bool {
	ch == 0x21
		|| (0x23..=0x26).contains(&ch)
		|| (0x2a..=0x2c).contains(&ch)
		|| ch == 0x2e
		|| (0x3a..=0x40).contains(&ch)
		|| ch == 0x5e
		|| ch == 0x60
		|| ch == 0x7e
}

fn is_class_set_syntax_character(ch: i64) -> bool {
	ch == 0x28
		|| ch == 0x29
		|| ch == 0x2d
		|| ch == 0x2f
		|| (0x5b..=0x5d).contains(&ch)
		|| (0x7b..=0x7d).contains(&ch)
}

fn is_class_set_reserved_punctuator(ch: i64) -> bool {
	matches!(
		ch,
		0x21 | 0x23 | 0x25 | 0x26 | 0x2c | 0x2d | 0x3a..=0x3e | 0x40 | 0x60 | 0x7e
	)
}

fn words_contains(list: &[&str], value: &W) -> bool {
	list.iter().any(|word| crate::chars::eq(value, word))
}

fn push_code_point(target: &mut W, ch: i64) {
	target.extend(code_point_to_string(Some(ch as f64)));
}

type V<T> = Result<T, Fail>;

impl<'a> Parser<'a> {
	pub fn validate_regexp(&self, start: usize, pattern: &[u16], flags: &[u16]) -> R<()> {
		let unicode_sets = flags.contains(&118);
		let unicode = flags.contains(&117);
		let mut state = State {
			source: pattern,
			start,
			switch_u: unicode || unicode_sets,
			switch_v: unicode_sets,
			switch_n: unicode || unicode_sets,
			pos: 0,
			last_int_value: 0.0,
			last_string_value: Vec::new(),
			last_assertion_is_quantifiable: false,
			num_capturing_parens: 0.0,
			max_back_reference: 0.0,
			group_names: HashSet::new(),
			back_reference_names: Vec::new(),
			depth: 0,
		};
		self.validate_regexp_flags(&state, flags)?;
		self.regexp_pattern(&mut state)?;
		if !state.switch_n && !state.group_names.is_empty() {
			state.switch_n = true;
			self.regexp_pattern(&mut state)?;
		}
		Ok(())
	}

	fn state_raise<X>(&self, state: &State, message: &str) -> V<X> {
		self.raise(
			state.start,
			format!(
				"Invalid regular expression: /{}/: {message}",
				lossy(state.source)
			),
		)
	}

	fn validate_regexp_flags(&self, state: &State, flags: &[u16]) -> R<()> {
		const VALID: [u16; 8] = [103, 105, 109, 117, 121, 115, 100, 118];
		let mut u = false;
		let mut v = false;
		for (i, &flag) in flags.iter().enumerate() {
			if !VALID.contains(&flag) {
				return self.raise(state.start, "Invalid regular expression flag");
			}
			if flags[i + 1..].contains(&flag) {
				return self.raise(state.start, "Duplicate regular expression flag");
			}
			if flag == 117 {
				u = true;
			}
			if flag == 118 {
				v = true;
			}
		}
		if u && v {
			return self.raise(state.start, "Invalid regular expression flag");
		}
		Ok(())
	}

	fn regexp_pattern(&self, state: &mut State) -> V<()> {
		state.pos = 0;
		state.last_int_value = 0.0;
		state.last_string_value.clear();
		state.last_assertion_is_quantifiable = false;
		state.num_capturing_parens = 0.0;
		state.max_back_reference = 0.0;
		state.group_names.clear();
		state.back_reference_names.clear();
		self.regexp_disjunction(state)?;
		if state.pos != state.source.len() {
			if state.eat(0x29) {
				return self.state_raise(state, "Unmatched ')'");
			}
			if state.eat(0x5d) || state.eat(0x7d) {
				return self.state_raise(state, "Lone quantifier brackets");
			}
		}
		if state.max_back_reference > state.num_capturing_parens {
			return self.state_raise(state, "Invalid escape");
		}
		for name in &state.back_reference_names {
			if !state.group_names.contains(name) {
				return self.state_raise(state, "Invalid named capture referenced");
			}
		}
		Ok(())
	}

	fn regexp_disjunction(&self, state: &mut State) -> V<()> {
		state.depth += 1;
		if state.depth > MAX_DEPTH || self.stack_exhausted() {
			return Err(Fail::Overflow);
		}
		self.regexp_alternative(state)?;
		while state.eat(0x7c) {
			self.regexp_alternative(state)?;
		}
		state.depth -= 1;
		if self.regexp_eat_quantifier(state, true)? {
			return self.state_raise(state, "Nothing to repeat");
		}
		if state.eat(0x7b) {
			return self.state_raise(state, "Lone quantifier brackets");
		}
		Ok(())
	}

	fn regexp_alternative(&self, state: &mut State) -> V<()> {
		while state.pos < state.source.len() && self.regexp_eat_term(state)? {}
		Ok(())
	}

	fn regexp_eat_term(&self, state: &mut State) -> V<bool> {
		if self.regexp_eat_assertion(state)? {
			if state.last_assertion_is_quantifiable
				&& self.regexp_eat_quantifier(state, false)?
				&& state.switch_u
			{
				return self.state_raise(state, "Invalid quantifier");
			}
			return Ok(true);
		}
		let atom = if state.switch_u {
			self.regexp_eat_atom(state)?
		} else {
			self.regexp_eat_extended_atom(state)?
		};
		if atom {
			self.regexp_eat_quantifier(state, false)?;
			return Ok(true);
		}
		Ok(false)
	}

	fn regexp_eat_assertion(&self, state: &mut State) -> V<bool> {
		let start = state.pos;
		state.last_assertion_is_quantifiable = false;
		if state.eat(0x5e) || state.eat(0x24) {
			return Ok(true);
		}
		if state.eat(0x5c) {
			if state.eat(0x42) || state.eat(0x62) {
				return Ok(true);
			}
			state.pos = start;
		}
		if state.eat(0x28) && state.eat(0x3f) {
			let lookbehind = state.eat(0x3c);
			if state.eat(0x3d) || state.eat(0x21) {
				self.regexp_disjunction(state)?;
				if !state.eat(0x29) {
					return self.state_raise(state, "Unterminated group");
				}
				state.last_assertion_is_quantifiable = !lookbehind;
				return Ok(true);
			}
		}
		state.pos = start;
		Ok(false)
	}

	fn regexp_eat_quantifier(&self, state: &mut State, no_error: bool) -> V<bool> {
		if self.regexp_eat_quantifier_prefix(state, no_error)? {
			state.eat(0x3f);
			return Ok(true);
		}
		Ok(false)
	}

	fn regexp_eat_quantifier_prefix(&self, state: &mut State, no_error: bool) -> V<bool> {
		Ok(state.eat(0x2a)
			|| state.eat(0x2b)
			|| state.eat(0x3f)
			|| self.regexp_eat_braced_quantifier(state, no_error)?)
	}

	fn regexp_eat_braced_quantifier(&self, state: &mut State, no_error: bool) -> V<bool> {
		let start = state.pos;
		if state.eat(0x7b) {
			let mut max = -1.0;
			if self.regexp_eat_decimal_digits(state) {
				let min = state.last_int_value;
				if state.eat(0x2c) && self.regexp_eat_decimal_digits(state) {
					max = state.last_int_value;
				}
				if state.eat(0x7d) {
					if max != -1.0 && max < min && !no_error {
						return self.state_raise(state, "numbers out of order in {} quantifier");
					}
					return Ok(true);
				}
			}
			if state.switch_u && !no_error {
				return self.state_raise(state, "Incomplete quantifier");
			}
			state.pos = start;
		}
		Ok(false)
	}

	fn regexp_eat_atom(&self, state: &mut State) -> V<bool> {
		Ok(self.regexp_eat_pattern_characters(state)
			|| state.eat(0x2e)
			|| self.regexp_eat_reverse_solidus_atom_escape(state)?
			|| self.regexp_eat_character_class(state)?
			|| self.regexp_eat_uncapturing_group(state)?
			|| self.regexp_eat_capturing_group(state)?)
	}

	fn regexp_eat_reverse_solidus_atom_escape(&self, state: &mut State) -> V<bool> {
		let start = state.pos;
		if state.eat(0x5c) {
			if self.regexp_eat_atom_escape(state)? {
				return Ok(true);
			}
			state.pos = start;
		}
		Ok(false)
	}

	fn regexp_eat_uncapturing_group(&self, state: &mut State) -> V<bool> {
		let start = state.pos;
		if state.eat(0x28) {
			if state.eat(0x3f) && state.eat(0x3a) {
				self.regexp_disjunction(state)?;
				if state.eat(0x29) {
					return Ok(true);
				}
				return self.state_raise(state, "Unterminated group");
			}
			state.pos = start;
		}
		Ok(false)
	}

	fn regexp_eat_capturing_group(&self, state: &mut State) -> V<bool> {
		if state.eat(0x28) {
			self.regexp_group_specifier(state)?;
			self.regexp_disjunction(state)?;
			if state.eat(0x29) {
				state.num_capturing_parens += 1.0;
				return Ok(true);
			}
			return self.state_raise(state, "Unterminated group");
		}
		Ok(false)
	}

	fn regexp_eat_extended_atom(&self, state: &mut State) -> V<bool> {
		Ok(state.eat(0x2e)
			|| self.regexp_eat_reverse_solidus_atom_escape(state)?
			|| self.regexp_eat_character_class(state)?
			|| self.regexp_eat_uncapturing_group(state)?
			|| self.regexp_eat_capturing_group(state)?
			|| self.regexp_eat_invalid_braced_quantifier(state)?
			|| self.regexp_eat_extended_pattern_character(state))
	}

	fn regexp_eat_invalid_braced_quantifier(&self, state: &mut State) -> V<bool> {
		if self.regexp_eat_braced_quantifier(state, true)? {
			return self.state_raise(state, "Nothing to repeat");
		}
		Ok(false)
	}

	fn regexp_eat_syntax_character(&self, state: &mut State) -> bool {
		let ch = state.current();
		if is_syntax_character(ch) {
			state.last_int_value = ch as f64;
			state.advance();
			return true;
		}
		false
	}

	fn regexp_eat_pattern_characters(&self, state: &mut State) -> bool {
		let start = state.pos;
		loop {
			let ch = state.current();
			if ch == -1 || is_syntax_character(ch) {
				break;
			}
			state.advance();
		}
		state.pos != start
	}

	fn regexp_eat_extended_pattern_character(&self, state: &mut State) -> bool {
		let ch = state.current();
		if ch != -1
			&& ch != 0x24
			&& !(0x28..=0x2b).contains(&ch)
			&& ch != 0x2e
			&& ch != 0x3f
			&& ch != 0x5b
			&& ch != 0x5e
			&& ch != 0x7c
		{
			state.advance();
			return true;
		}
		false
	}

	fn regexp_group_specifier(&self, state: &mut State) -> V<()> {
		if state.eat(0x3f) {
			if !self.regexp_eat_group_name(state)? {
				return self.state_raise(state, "Invalid group");
			}
			if state.group_names.contains(&state.last_string_value) {
				return self.state_raise(state, "Duplicate capture group name");
			}
			let name = state.last_string_value.clone();
			state.group_names.insert(name);
		}
		Ok(())
	}

	fn regexp_eat_group_name(&self, state: &mut State) -> V<bool> {
		state.last_string_value.clear();
		if state.eat(0x3c) {
			if self.regexp_eat_regexp_identifier_name(state)? && state.eat(0x3e) {
				return Ok(true);
			}
			return self.state_raise(state, "Invalid capture group name");
		}
		Ok(false)
	}

	fn regexp_eat_regexp_identifier_name(&self, state: &mut State) -> V<bool> {
		state.last_string_value.clear();
		if self.regexp_eat_regexp_identifier_start(state)? {
			let value = state.last_int_value as i64;
			push_code_point(&mut state.last_string_value, value);
			while self.regexp_eat_regexp_identifier_part(state)? {
				let value = state.last_int_value as i64;
				push_code_point(&mut state.last_string_value, value);
			}
			return Ok(true);
		}
		Ok(false)
	}

	fn regexp_eat_regexp_identifier_start(&self, state: &mut State) -> V<bool> {
		let start = state.pos;
		let mut ch = state.current_u(true);
		state.advance_u(true);
		if ch == 0x5c && self.regexp_eat_regexp_unicode_escape_sequence(state, true)? {
			ch = state.last_int_value as i64;
		}
		if is_regexp_identifier_start(ch) {
			state.last_int_value = ch as f64;
			return Ok(true);
		}
		state.pos = start;
		Ok(false)
	}

	fn regexp_eat_regexp_identifier_part(&self, state: &mut State) -> V<bool> {
		let start = state.pos;
		let mut ch = state.current_u(true);
		state.advance_u(true);
		if ch == 0x5c && self.regexp_eat_regexp_unicode_escape_sequence(state, true)? {
			ch = state.last_int_value as i64;
		}
		if is_regexp_identifier_part(ch) {
			state.last_int_value = ch as f64;
			return Ok(true);
		}
		state.pos = start;
		Ok(false)
	}

	fn regexp_eat_atom_escape(&self, state: &mut State) -> V<bool> {
		if self.regexp_eat_back_reference(state)
			|| self.regexp_eat_character_class_escape(state)? != CHARSET_NONE
			|| self.regexp_eat_character_escape(state)?
			|| (state.switch_n && self.regexp_eat_k_group_name(state)?)
		{
			return Ok(true);
		}
		if state.switch_u {
			if state.current() == 0x63 {
				return self.state_raise(state, "Invalid unicode escape");
			}
			return self.state_raise(state, "Invalid escape");
		}
		Ok(false)
	}

	fn regexp_eat_back_reference(&self, state: &mut State) -> bool {
		let start = state.pos;
		if self.regexp_eat_decimal_escape(state) {
			let n = state.last_int_value;
			if state.switch_u {
				if n > state.max_back_reference {
					state.max_back_reference = n;
				}
				return true;
			}
			if n <= state.num_capturing_parens {
				return true;
			}
			state.pos = start;
		}
		false
	}

	fn regexp_eat_k_group_name(&self, state: &mut State) -> V<bool> {
		if state.eat(0x6b) {
			if self.regexp_eat_group_name(state)? {
				let name = state.last_string_value.clone();
				state.back_reference_names.push(name);
				return Ok(true);
			}
			return self.state_raise(state, "Invalid named reference");
		}
		Ok(false)
	}

	fn regexp_eat_character_escape(&self, state: &mut State) -> V<bool> {
		Ok(self.regexp_eat_control_escape(state)
			|| self.regexp_eat_c_control_letter(state)
			|| self.regexp_eat_zero(state)
			|| self.regexp_eat_hex_escape_sequence(state)?
			|| self.regexp_eat_regexp_unicode_escape_sequence(state, false)?
			|| (!state.switch_u && self.regexp_eat_legacy_octal_escape_sequence(state))
			|| self.regexp_eat_identity_escape(state))
	}

	fn regexp_eat_c_control_letter(&self, state: &mut State) -> bool {
		let start = state.pos;
		if state.eat(0x63) {
			if self.regexp_eat_control_letter(state) {
				return true;
			}
			state.pos = start;
		}
		false
	}

	fn regexp_eat_zero(&self, state: &mut State) -> bool {
		if state.current() == 0x30 && !is_decimal_digit(state.lookahead()) {
			state.last_int_value = 0.0;
			state.advance();
			return true;
		}
		false
	}

	fn regexp_eat_control_escape(&self, state: &mut State) -> bool {
		let value = match state.current() {
			0x74 => 0x09,
			0x6e => 0x0a,
			0x76 => 0x0b,
			0x66 => 0x0c,
			0x72 => 0x0d,
			_ => return false,
		};
		state.last_int_value = value as f64;
		state.advance();
		true
	}

	fn regexp_eat_control_letter(&self, state: &mut State) -> bool {
		let ch = state.current();
		if is_control_letter(ch) {
			state.last_int_value = (ch % 0x20) as f64;
			state.advance();
			return true;
		}
		false
	}

	fn regexp_eat_regexp_unicode_escape_sequence(
		&self,
		state: &mut State,
		force_u: bool,
	) -> V<bool> {
		let start = state.pos;
		let switch_u = force_u || state.switch_u;
		if state.eat(0x75) {
			if self.regexp_eat_fixed_hex_digits(state, 4) {
				let lead = state.last_int_value;
				if switch_u && (0xd800 as f64..=0xdbff as f64).contains(&lead) {
					let lead_surrogate_end = state.pos;
					if state.eat(0x5c)
						&& state.eat(0x75) && self.regexp_eat_fixed_hex_digits(state, 4)
					{
						let trail = state.last_int_value;
						if (0xdc00 as f64..=0xdfff as f64).contains(&trail) {
							state.last_int_value =
								(lead - 0xd800 as f64) * 1024.0 + (trail - 0xdc00 as f64) + 65536.0;
							return Ok(true);
						}
					}
					state.pos = lead_surrogate_end;
					state.last_int_value = lead;
				}
				return Ok(true);
			}
			if switch_u
				&& state.eat(0x7b)
				&& self.regexp_eat_hex_digits(state)
				&& state.eat(0x7d)
				&& (0.0..=1_114_111.0).contains(&state.last_int_value)
			{
				return Ok(true);
			}
			if switch_u {
				return self.state_raise(state, "Invalid unicode escape");
			}
			state.pos = start;
		}
		Ok(false)
	}

	fn regexp_eat_identity_escape(&self, state: &mut State) -> bool {
		if state.switch_u {
			if self.regexp_eat_syntax_character(state) {
				return true;
			}
			if state.eat(0x2f) {
				state.last_int_value = 0x2f as f64;
				return true;
			}
			return false;
		}
		let ch = state.current();
		if ch != 0x63 && (!state.switch_n || ch != 0x6b) {
			state.last_int_value = ch as f64;
			state.advance();
			return true;
		}
		false
	}

	fn regexp_eat_decimal_escape(&self, state: &mut State) -> bool {
		state.last_int_value = 0.0;
		let mut ch = state.current();
		if (0x31..=0x39).contains(&ch) {
			loop {
				state.last_int_value = 10.0 * state.last_int_value + (ch - 0x30) as f64;
				state.advance();
				ch = state.current();
				if !(0x30..=0x39).contains(&ch) {
					break;
				}
			}
			return true;
		}
		false
	}

	fn regexp_eat_character_class_escape(&self, state: &mut State) -> V<u8> {
		let ch = state.current();
		if is_character_class_escape(ch) {
			state.last_int_value = -1.0;
			state.advance();
			return Ok(CHARSET_OK);
		}
		if state.switch_u && (ch == 0x50 || ch == 0x70) {
			let negate = ch == 0x50;
			state.last_int_value = -1.0;
			state.advance();
			if state.eat(0x7b) {
				let result = self.regexp_eat_unicode_property_value_expression(state)?;
				if result != CHARSET_NONE && state.eat(0x7d) {
					if negate && result == CHARSET_STRING {
						return self.state_raise(state, "Invalid property name");
					}
					return Ok(result);
				}
			}
			return self.state_raise(state, "Invalid property name");
		}
		Ok(CHARSET_NONE)
	}

	fn regexp_eat_unicode_property_value_expression(&self, state: &mut State) -> V<u8> {
		let start = state.pos;
		if self.regexp_eat_unicode_property_name(state) && state.eat(0x3d) {
			let name = state.last_string_value.clone();
			if self.regexp_eat_unicode_property_value(state) {
				let value = state.last_string_value.clone();
				self.regexp_validate_unicode_property_name_and_value(state, &name, &value)?;
				return Ok(CHARSET_OK);
			}
		}
		state.pos = start;
		if self.regexp_eat_unicode_property_value(state) {
			let name_or_value = state.last_string_value.clone();
			return self.regexp_validate_unicode_property_name_or_value(state, &name_or_value);
		}
		Ok(CHARSET_NONE)
	}

	fn regexp_validate_unicode_property_name_and_value(
		&self,
		state: &State,
		name: &W,
		value: &W,
	) -> V<()> {
		let values: &[&str] = if words_contains(&["General_Category", "gc"], name) {
			GENERAL_CATEGORY_VALUES
		} else if words_contains(&["Script", "Script_Extensions", "sc", "scx"], name) {
			SCRIPT_VALUES
		} else {
			return self.state_raise(state, "Invalid property name");
		};
		if !words_contains(values, value) {
			return self.state_raise(state, "Invalid property value");
		}
		Ok(())
	}

	fn regexp_validate_unicode_property_name_or_value(
		&self,
		state: &State,
		name_or_value: &W,
	) -> V<u8> {
		if words_contains(BINARY_PROPERTIES, name_or_value) {
			return Ok(CHARSET_OK);
		}
		if state.switch_v && words_contains(BINARY_PROPERTIES_OF_STRINGS, name_or_value) {
			return Ok(CHARSET_STRING);
		}
		self.state_raise(state, "Invalid property name")
	}

	fn regexp_eat_unicode_property_name(&self, state: &mut State) -> bool {
		state.last_string_value.clear();
		loop {
			let ch = state.current();
			if !is_unicode_property_name_character(ch) {
				break;
			}
			push_code_point(&mut state.last_string_value, ch);
			state.advance();
		}
		!state.last_string_value.is_empty()
	}

	fn regexp_eat_unicode_property_value(&self, state: &mut State) -> bool {
		state.last_string_value.clear();
		loop {
			let ch = state.current();
			if !is_unicode_property_value_character(ch) {
				break;
			}
			push_code_point(&mut state.last_string_value, ch);
			state.advance();
		}
		!state.last_string_value.is_empty()
	}

	fn regexp_eat_character_class(&self, state: &mut State) -> V<bool> {
		if state.eat(0x5b) {
			let negate = state.eat(0x5e);
			let result = self.regexp_class_contents(state)?;
			if !state.eat(0x5d) {
				return self.state_raise(state, "Unterminated character class");
			}
			if negate && result == CHARSET_STRING {
				return self.state_raise(state, "Negated character class may contain strings");
			}
			return Ok(true);
		}
		Ok(false)
	}

	fn regexp_class_contents(&self, state: &mut State) -> V<u8> {
		if state.current() == 0x5d {
			return Ok(CHARSET_OK);
		}
		if state.switch_v {
			return self.regexp_class_set_expression(state);
		}
		self.regexp_non_empty_class_ranges(state)?;
		Ok(CHARSET_OK)
	}

	fn regexp_non_empty_class_ranges(&self, state: &mut State) -> V<()> {
		while self.regexp_eat_class_atom(state)? {
			let left = state.last_int_value;
			if state.eat(0x2d) && self.regexp_eat_class_atom(state)? {
				let right = state.last_int_value;
				if state.switch_u && (left == -1.0 || right == -1.0) {
					return self.state_raise(state, "Invalid character class");
				}
				if left != -1.0 && right != -1.0 && left > right {
					return self.state_raise(state, "Range out of order in character class");
				}
			}
		}
		Ok(())
	}

	fn regexp_eat_class_atom(&self, state: &mut State) -> V<bool> {
		let start = state.pos;
		if state.eat(0x5c) {
			if self.regexp_eat_class_escape(state)? {
				return Ok(true);
			}
			if state.switch_u {
				let ch = state.current();
				if ch == 0x63 || is_octal_digit(ch) {
					return self.state_raise(state, "Invalid class escape");
				}
				return self.state_raise(state, "Invalid escape");
			}
			state.pos = start;
		}
		let ch = state.current();
		if ch != 0x5d {
			state.last_int_value = ch as f64;
			state.advance();
			return Ok(true);
		}
		Ok(false)
	}

	fn regexp_eat_class_escape(&self, state: &mut State) -> V<bool> {
		let start = state.pos;
		if state.eat(0x62) {
			state.last_int_value = 0x08 as f64;
			return Ok(true);
		}
		if state.switch_u && state.eat(0x2d) {
			state.last_int_value = 0x2d as f64;
			return Ok(true);
		}
		if !state.switch_u && state.eat(0x63) {
			if self.regexp_eat_class_control_letter(state) {
				return Ok(true);
			}
			state.pos = start;
		}
		Ok(
			self.regexp_eat_character_class_escape(state)? != CHARSET_NONE
				|| self.regexp_eat_character_escape(state)?,
		)
	}

	fn regexp_class_set_expression(&self, state: &mut State) -> V<u8> {
		let mut result = CHARSET_OK;
		if self.regexp_eat_class_set_range(state)? {
		} else {
			let sub_result = self.regexp_eat_class_set_operand(state)?;
			if sub_result != CHARSET_NONE {
				if sub_result == CHARSET_STRING {
					result = CHARSET_STRING;
				}
				let start = state.pos;
				while state.eat_chars(&[0x26, 0x26]) {
					if state.current() != 0x26 {
						let sub_result = self.regexp_eat_class_set_operand(state)?;
						if sub_result != CHARSET_NONE {
							if sub_result != CHARSET_STRING {
								result = CHARSET_OK;
							}
							continue;
						}
					}
					return self.state_raise(state, "Invalid character in character class");
				}
				if start != state.pos {
					return Ok(result);
				}
				while state.eat_chars(&[0x2d, 0x2d]) {
					if self.regexp_eat_class_set_operand(state)? != CHARSET_NONE {
						continue;
					}
					return self.state_raise(state, "Invalid character in character class");
				}
				if start != state.pos {
					return Ok(result);
				}
			} else {
				return self.state_raise(state, "Invalid character in character class");
			}
		}
		loop {
			if self.regexp_eat_class_set_range(state)? {
				continue;
			}
			let sub_result = self.regexp_eat_class_set_operand(state)?;
			if sub_result == CHARSET_NONE {
				return Ok(result);
			}
			if sub_result == CHARSET_STRING {
				result = CHARSET_STRING;
			}
		}
	}

	fn regexp_eat_class_set_range(&self, state: &mut State) -> V<bool> {
		let start = state.pos;
		if self.regexp_eat_class_set_character(state)? {
			let left = state.last_int_value;
			if state.eat(0x2d) && self.regexp_eat_class_set_character(state)? {
				let right = state.last_int_value;
				if left != -1.0 && right != -1.0 && left > right {
					return self.state_raise(state, "Range out of order in character class");
				}
				return Ok(true);
			}
			state.pos = start;
		}
		Ok(false)
	}

	fn regexp_eat_class_set_operand(&self, state: &mut State) -> V<u8> {
		if self.regexp_eat_class_set_character(state)? {
			return Ok(CHARSET_OK);
		}
		let result = self.regexp_eat_class_string_disjunction(state)?;
		if result != CHARSET_NONE {
			return Ok(result);
		}
		self.regexp_eat_nested_class(state)
	}

	fn regexp_eat_nested_class(&self, state: &mut State) -> V<u8> {
		let start = state.pos;
		if state.eat(0x5b) {
			state.depth += 1;
			if state.depth > MAX_DEPTH || self.stack_exhausted() {
				return Err(Fail::Overflow);
			}
			let negate = state.eat(0x5e);
			let result = self.regexp_class_contents(state)?;
			state.depth -= 1;
			if state.eat(0x5d) {
				if negate && result == CHARSET_STRING {
					return self.state_raise(state, "Negated character class may contain strings");
				}
				return Ok(result);
			}
			state.pos = start;
		}
		if state.eat(0x5c) {
			let result = self.regexp_eat_character_class_escape(state)?;
			if result != CHARSET_NONE {
				return Ok(result);
			}
			state.pos = start;
		}
		Ok(CHARSET_NONE)
	}

	fn regexp_eat_class_string_disjunction(&self, state: &mut State) -> V<u8> {
		let start = state.pos;
		if state.eat_chars(&[0x5c, 0x71]) {
			if state.eat(0x7b) {
				let result = self.regexp_class_string_disjunction_contents(state)?;
				if state.eat(0x7d) {
					return Ok(result);
				}
			} else {
				return self.state_raise(state, "Invalid escape");
			}
			state.pos = start;
		}
		Ok(CHARSET_NONE)
	}

	fn regexp_class_string_disjunction_contents(&self, state: &mut State) -> V<u8> {
		let mut result = self.regexp_class_string(state)?;
		while state.eat(0x7c) {
			if self.regexp_class_string(state)? == CHARSET_STRING {
				result = CHARSET_STRING;
			}
		}
		Ok(result)
	}

	fn regexp_class_string(&self, state: &mut State) -> V<u8> {
		let mut count = 0;
		while self.regexp_eat_class_set_character(state)? {
			count += 1;
		}
		Ok(if count == 1 {
			CHARSET_OK
		} else {
			CHARSET_STRING
		})
	}

	fn regexp_eat_class_set_character(&self, state: &mut State) -> V<bool> {
		let start = state.pos;
		if state.eat(0x5c) {
			if self.regexp_eat_character_escape(state)?
				|| self.regexp_eat_class_set_reserved_punctuator(state)
			{
				return Ok(true);
			}
			if state.eat(0x62) {
				state.last_int_value = 0x08 as f64;
				return Ok(true);
			}
			state.pos = start;
			return Ok(false);
		}
		let ch = state.current();
		if ch < 0
			|| (ch == state.lookahead() && is_class_set_reserved_double_punctuator_character(ch))
		{
			return Ok(false);
		}
		if is_class_set_syntax_character(ch) {
			return Ok(false);
		}
		state.advance();
		state.last_int_value = ch as f64;
		Ok(true)
	}

	fn regexp_eat_class_set_reserved_punctuator(&self, state: &mut State) -> bool {
		let ch = state.current();
		if is_class_set_reserved_punctuator(ch) {
			state.last_int_value = ch as f64;
			state.advance();
			return true;
		}
		false
	}

	fn regexp_eat_class_control_letter(&self, state: &mut State) -> bool {
		let ch = state.current();
		if is_decimal_digit(ch) || ch == 0x5f {
			state.last_int_value = (ch % 0x20) as f64;
			state.advance();
			return true;
		}
		false
	}

	fn regexp_eat_hex_escape_sequence(&self, state: &mut State) -> V<bool> {
		let start = state.pos;
		if state.eat(0x78) {
			if self.regexp_eat_fixed_hex_digits(state, 2) {
				return Ok(true);
			}
			if state.switch_u {
				return self.state_raise(state, "Invalid escape");
			}
			state.pos = start;
		}
		Ok(false)
	}

	fn regexp_eat_decimal_digits(&self, state: &mut State) -> bool {
		let start = state.pos;
		state.last_int_value = 0.0;
		loop {
			let ch = state.current();
			if !is_decimal_digit(ch) {
				break;
			}
			state.last_int_value = 10.0 * state.last_int_value + (ch - 0x30) as f64;
			state.advance();
		}
		state.pos != start
	}

	fn regexp_eat_hex_digits(&self, state: &mut State) -> bool {
		let start = state.pos;
		state.last_int_value = 0.0;
		loop {
			let ch = state.current();
			if !is_hex_digit(ch) {
				break;
			}
			state.last_int_value = 16.0 * state.last_int_value + hex_to_int(ch);
			state.advance();
		}
		state.pos != start
	}

	fn regexp_eat_legacy_octal_escape_sequence(&self, state: &mut State) -> bool {
		if self.regexp_eat_octal_digit(state) {
			let n1 = state.last_int_value;
			if self.regexp_eat_octal_digit(state) {
				let n2 = state.last_int_value;
				if n1 <= 3.0 && self.regexp_eat_octal_digit(state) {
					state.last_int_value += n1 * 64.0 + n2 * 8.0;
				} else {
					state.last_int_value = n1 * 8.0 + n2;
				}
			} else {
				state.last_int_value = n1;
			}
			return true;
		}
		false
	}

	fn regexp_eat_octal_digit(&self, state: &mut State) -> bool {
		let ch = state.current();
		if is_octal_digit(ch) {
			state.last_int_value = (ch - 0x30) as f64;
			state.advance();
			return true;
		}
		state.last_int_value = 0.0;
		false
	}

	fn regexp_eat_fixed_hex_digits(&self, state: &mut State, length: usize) -> bool {
		let start = state.pos;
		state.last_int_value = 0.0;
		for _ in 0..length {
			let ch = state.current();
			if !is_hex_digit(ch) {
				state.pos = start;
				return false;
			}
			state.last_int_value = 16.0 * state.last_int_value + hex_to_int(ch);
			state.advance();
		}
		true
	}
}

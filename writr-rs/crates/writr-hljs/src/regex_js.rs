//! JavaScript regex semantics over fancy-regex.
//!
//! highlight.js grammars are written against JS `RegExp`. The differences
//! that matter here:
//!
//! - `\w`/`\d`/`\b` are ASCII in JS (Unicode in the regex crate) — classes
//!   are expanded, `\b` becomes lookarounds.
//! - `.` excludes `\r`, ` `, ` ` in JS (only `\n` in Rust).
//! - `\s` is the JS whitespace set (includes U+FEFF, excludes U+0085).
//! - `\uHHHH`/`\u{...}` become `\x{...}`.
//! - `[\s\S]`-style any-char classes and `[^]` are special-cased.
//! - `$`/`^` with `m` match at `\n` boundaries in both engines (JS also
//!   honors `\r`/` `/` ` — a known, documented divergence).
//!
//! `exec` mirrors `RegExp.prototype.exec` with `lastIndex` (byte offsets).

use fancy_regex::Regex;

const JS_WS: &str = r"\t\n\x0B\f\r \x{00A0}\x{1680}\x{2000}-\x{200A}\x{2028}\x{2029}\x{202F}\x{205F}\x{3000}\x{FEFF}";
const WORD: &str = "0-9A-Za-z_";

#[derive(Debug)]
pub struct TranslateError(pub String);

impl std::fmt::Display for TranslateError {
	fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
		write!(f, "regex translation error: {}", self.0)
	}
}

/// Translate a JS pattern (given its flags) to regex-crate syntax.
pub fn translate(pattern: &str, flags: &str) -> Result<String, TranslateError> {
	let dot_all = flags.contains('s');
	let unicode = flags.contains('u');
	let mut out = String::with_capacity(pattern.len() + 16);
	if flags.contains('i') {
		out.push_str("(?i)");
	}
	if flags.contains('m') {
		out.push_str("(?m)");
	}
	let chars: Vec<char> = pattern.chars().collect();
	let mut i = 0;
	while i < chars.len() {
		let c = chars[i];
		match c {
			'\\' => {
				i += 1;
				let Some(&next) = chars.get(i) else {
					return Err(TranslateError("trailing backslash".into()));
				};
				translate_escape(&chars, &mut i, next, &mut out, false, unicode)?;
				i += 1;
			}
			'[' => {
				i = translate_class(&chars, i, &mut out, unicode)?;
			}
			'.' => {
				if dot_all {
					out.push_str("(?s:.)");
				} else {
					out.push_str(r"[^\n\r\x{2028}\x{2029}]");
				}
				i += 1;
			}
			'(' => {
				// `(?<name>`, `(?:`, `(?=`, `(?!`, `(?<=`, `(?<!` pass through.
				out.push('(');
				i += 1;
			}
			'{' => {
				// JS treats an invalid quantifier `{` as a literal; Rust
				// errors. Pass through when it looks like a quantifier,
				// escape otherwise.
				if is_quantifier(&chars, i) {
					out.push('{');
				} else {
					out.push_str("\\{");
				}
				i += 1;
			}
			'}' => {
				// Literal `}` (closing a quantifier passes the same way).
				if out.ends_with(|c: char| c.is_ascii_digit() || c == ',')
					&& has_open_quantifier(&out)
				{
					out.push('}');
				} else {
					out.push_str("\\}");
				}
				i += 1;
			}
			_ => {
				out.push(c);
				i += 1;
			}
		}
	}
	Ok(out)
}

fn has_open_quantifier(out: &str) -> bool {
	// Scan backwards for an unescaped `{` before any `}`.
	let bytes = out.as_bytes();
	let mut index = bytes.len();
	while index > 0 {
		index -= 1;
		match bytes[index] {
			b'{' => return index == 0 || bytes[index - 1] != b'\\',
			b'}' => return false,
			b'0'..=b'9' | b',' => {}
			_ => return false,
		}
	}
	false
}

fn is_quantifier(chars: &[char], open: usize) -> bool {
	// `{n}`, `{n,}`, `{n,m}`
	let mut i = open + 1;
	let mut digits = 0;
	while i < chars.len() && chars[i].is_ascii_digit() {
		digits += 1;
		i += 1;
	}
	if digits == 0 {
		return false;
	}
	if chars.get(i) == Some(&',') {
		i += 1;
		while i < chars.len() && chars[i].is_ascii_digit() {
			i += 1;
		}
	}
	chars.get(i) == Some(&'}')
}

/// Translate one escape sequence. `i` points at the char after `\`; the
/// caller advances past it. For multi-char escapes (`\u`, `\x`) this
/// consumes extra characters by advancing `i`.
fn translate_escape(
	chars: &[char],
	i: &mut usize,
	next: char,
	out: &mut String,
	in_class: bool,
	unicode: bool,
) -> Result<(), TranslateError> {
	match next {
		'd' => out.push_str(if in_class { "0-9" } else { "[0-9]" }),
		'D' => {
			if in_class {
				return Err(TranslateError("\\D inside class".into()));
			}
			out.push_str("[^0-9]");
		}
		'w' => out.push_str(if in_class {
			WORD
		} else {
			"[0-9A-Za-z_]"
		}),
		'W' => {
			if in_class {
				return Err(TranslateError("\\W inside class".into()));
			}
			out.push_str("[^0-9A-Za-z_]");
		}
		's' => {
			if in_class {
				out.push_str(JS_WS);
			} else {
				out.push('[');
				out.push_str(JS_WS);
				out.push(']');
			}
		}
		'S' => {
			if in_class {
				return Err(TranslateError("\\S inside class".into()));
			}
			out.push_str("[^");
			out.push_str(JS_WS);
			out.push(']');
		}
		'b' => {
			if in_class {
				out.push_str(r"\x08");
			} else {
				// ASCII word boundary via lookarounds.
				out.push_str(&format!(
					"(?:(?<=[{WORD}])(?![{WORD}])|(?<![{WORD}])(?=[{WORD}]))"
				));
			}
		}
		'B' => {
			if in_class {
				return Err(TranslateError("\\B inside class".into()));
			}
			out.push_str(&format!(
				"(?:(?<=[{WORD}])(?=[{WORD}])|(?<![{WORD}])(?![{WORD}]))"
			));
		}
		'u' => {
			// `\uHHHH` or (with u flag) `\u{...}`.
			if chars.get(*i + 1) == Some(&'{') && unicode {
				let mut j = *i + 2;
				let mut hex = String::new();
				while j < chars.len() && chars[j] != '}' {
					hex.push(chars[j]);
					j += 1;
				}
				out.push_str(&format!("\\x{{{hex}}}"));
				*i = j;
			} else {
				let hex: String = chars.iter().skip(*i + 1).take(4).collect();
				if hex.len() == 4 && hex.chars().all(|c| c.is_ascii_hexdigit()) {
					// Surrogates cannot be expressed; grammars don't use them.
					out.push_str(&format!("\\x{{{hex}}}"));
					*i += 4;
				} else {
					// Loose `\u` is a literal `u` in JS (non-unicode mode).
					out.push('u');
				}
			}
		}
		'x' => {
			let hex: String = chars.iter().skip(*i + 1).take(2).collect();
			if hex.len() == 2 && hex.chars().all(|c| c.is_ascii_hexdigit()) {
				out.push_str(&format!("\\x{hex}"));
				*i += 2;
			} else {
				out.push('x');
			}
		}
		'0' => out.push_str("\\x00"),
		'1'..='9' => {
			// Backreference (fancy-regex supports these).
			out.push('\\');
			out.push(next);
		}
		'n' | 'r' | 't' | 'f' | 'v' => {
			out.push('\\');
			out.push(if next == 'v' { 'x' } else { next });
			if next == 'v' {
				out.push_str("0B");
			}
		}
		'k' => {
			// Named backreference `\k<name>`.
			out.push_str("\\k");
		}
		'p' | 'P' => {
			// Unicode property (u-flag grammars); same syntax in Rust —
			// consume the `{Name}` payload so the brace isn't re-escaped.
			out.push('\\');
			out.push(next);
			if chars.get(*i + 1) == Some(&'{') {
				let mut j = *i + 1;
				while j < chars.len() && chars[j] != '}' {
					out.push(chars[j]);
					j += 1;
				}
				if j < chars.len() {
					out.push('}');
				}
				*i = j;
			}
		}
		'c' => {
			// Control escape `\cX` → \x{01..1A}.
			if let Some(&letter) = chars.get(*i + 1) {
				if letter.is_ascii_alphabetic() {
					let code = (letter.to_ascii_uppercase() as u32) - ('A' as u32) + 1;
					out.push_str(&format!("\\x{{{code:X}}}"));
					*i += 1;
					return Ok(());
				}
			}
			out.push('c');
		}
		_ => {
			// Identity escape: keep escaping metacharacters, emit others
			// bare when Rust would reject the escape.
			if next.is_ascii_alphanumeric() {
				out.push(next);
			} else {
				out.push('\\');
				out.push(next);
			}
		}
	}
	Ok(())
}

/// Translate a character class starting at `chars[open] == '['`; returns the
/// index just past the closing `]`.
fn translate_class(
	chars: &[char],
	open: usize,
	out: &mut String,
	unicode: bool,
) -> Result<usize, TranslateError> {
	let mut i = open + 1;
	let negated = chars.get(i) == Some(&'^');
	if negated {
		i += 1;
	}

	// Collect raw members first to detect any-char classes. In JS a `]`
	// immediately after `[`/`[^` closes the class (empty classes are legal).
	let start = i;
	let mut depth_end = None;
	let mut j = i;
	while j < chars.len() {
		match chars[j] {
			']' => {
				depth_end = Some(j);
				break;
			}
			'\\' => j += 1,
			_ => {}
		}
		j += 1;
	}
	let Some(end) = depth_end else {
		return Err(TranslateError("unterminated class".into()));
	};

	let body: String = chars[start..end].iter().collect();
	if !negated && body.is_empty() {
		// `[]` matches nothing in JS.
		out.push_str("[^\\x00-\\x{10FFFF}]");
		return Ok(end + 1);
	}
	// `[^]` and `[\s\S]`/`[\w\W]`/`[\d\D]` match any character.
	if (negated && body.is_empty())
		|| (!negated
			&& matches!(body.as_str(), r"\s\S" | r"\S\s" | r"\w\W" | r"\W\w" | r"\d\D" | r"\D\d"))
	{
		out.push_str("(?s:.)");
		return Ok(end + 1);
	}
	if !negated && (body.contains(r"\S") || body.contains(r"\W") || body.contains(r"\D")) {
		// Positive class with a negative shorthand plus other members: the
		// negative set alone covers nearly everything; grammars in the
		// common set don't hit this — fail loudly if one ever does.
		return Err(TranslateError(format!("mixed negative shorthand in class: [{body}]")));
	}

	out.push('[');
	if negated {
		out.push('^');
	}
	while i < end {
		let c = chars[i];
		if c == '\\' {
			i += 1;
			let next = chars[i];
			translate_escape(chars, &mut i, next, out, true, unicode)?;
			i += 1;
			continue;
		}
		match c {
			// Escape chars that are structural in Rust classes.
			'[' => out.push_str("\\["),
			'&' => out.push_str("\\&"),
			'~' => out.push_str("\\~"),
			'-' if i == start || i + 1 == end => out.push_str("\\-"),
			']' => out.push_str("\\]"),
			_ => out.push(c),
		}
		i += 1;
	}
	out.push(']');
	Ok(end + 1)
}

/// Count capturing groups the way `countMatchGroups` observes them (JS
/// numbering: `(` not followed by `?`, plus named groups `(?<name>`).
pub fn count_capture_groups(pattern: &str) -> usize {
	let bytes = pattern.as_bytes();
	let mut count = 0;
	let mut i = 0;
	let mut in_class = false;
	while i < bytes.len() {
		match bytes[i] {
			b'\\' => i += 1,
			b'[' if !in_class => in_class = true,
			b']' if in_class => in_class = false,
			b'(' if !in_class => {
				if bytes.get(i + 1) != Some(&b'?') {
					count += 1;
				} else if bytes.get(i + 2) == Some(&b'<')
					&& !matches!(bytes.get(i + 3), Some(&b'=') | Some(&b'!'))
				{
					count += 1;
				}
			}
			_ => {}
		}
		i += 1;
	}
	count
}

/// A compiled JS-semantics regex.
#[derive(Debug)]
pub struct JsRegex {
	regex: Regex,
	/// Original JS source (used for `terminatorEnd` concatenation).
	pub source: String,
	pub group_count: usize,
}

/// One match: byte offsets into the haystack.
#[derive(Debug, Clone)]
pub struct JsMatch {
	pub index: usize,
	pub end: usize,
	/// Capture group texts (`groups[0]` = whole match).
	pub groups: Vec<Option<String>>,
}

impl JsMatch {
	pub fn text(&self) -> &str {
		self.groups[0].as_deref().unwrap_or("")
	}
}

impl JsRegex {
	pub fn new(js_source: &str, flags: &str) -> Result<Self, TranslateError> {
		let translated = translate(js_source, flags)?;
		let regex = Regex::new(&translated)
			.map_err(|error| TranslateError(format!("{error} (from /{js_source}/{flags})")))?;
		Ok(Self {
			regex,
			source: js_source.to_string(),
			group_count: count_capture_groups(js_source),
		})
	}

	/// `regex.exec(text)` with `lastIndex` semantics (byte offset).
	pub fn exec_from(&self, text: &str, last_index: usize) -> Option<JsMatch> {
		if last_index > text.len() {
			return None;
		}
		let captures = self.regex.captures_from_pos(text, last_index).ok()??;
		let whole = captures.get(0).expect("group 0 always present");
		Some(JsMatch {
			index: whole.start(),
			end: whole.end(),
			groups: (0..captures.len())
				.map(|i| captures.get(i).map(|m| m.as_str().to_string()))
				.collect(),
		})
	}

	/// `startsWith`: does the regex match at position 0 of `lexeme`?
	pub fn starts_with(&self, lexeme: &str) -> bool {
		matches!(self.exec_from(lexeme, 0), Some(m) if m.index == 0)
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	fn m(pattern: &str, flags: &str, text: &str) -> Option<(usize, String)> {
		JsRegex::new(pattern, flags)
			.unwrap()
			.exec_from(text, 0)
			.map(|m| (m.index, m.text().to_string()))
	}

	#[test]
	fn ascii_word_semantics() {
		assert_eq!(m(r"\w+", "", "héllo"), Some((0, "h".into())));
		assert_eq!(m(r"\bfoo\b", "", "xfoo foo"), Some((5, "foo".into())));
		// JS \b is ASCII: boundary between `o` and `é`.
		assert_eq!(m(r"foo\b", "", "fooé"), Some((0, "foo".into())));
	}

	#[test]
	fn dot_excludes_js_line_terminators() {
		assert_eq!(m(r"a.b", "", "a\u{2028}b"), None);
		assert_eq!(m(r"a.b", "", "axb"), Some((0, "axb".into())));
	}

	#[test]
	fn any_char_classes() {
		assert_eq!(m(r"\\[\s\S]", "", "\\\n"), Some((0, "\\\n".into())));
		assert_eq!(m(r"[^]", "", "\n"), Some((0, "\n".into())));
	}

	#[test]
	fn multiline_and_case_flags() {
		assert_eq!(m(r"^b$", "m", "a\nb\nc"), Some((2, "b".into())));
		assert_eq!(m(r"abc", "i", "xABC"), Some((1, "ABC".into())));
	}

	#[test]
	fn unicode_escapes() {
		assert_eq!(m(r"é", "", "é"), Some((0, "é".into())));
		assert_eq!(m(r"\u{1F600}", "u", "😀"), Some((0, "😀".into())));
	}

	#[test]
	fn class_edges() {
		assert_eq!(m(r"[a-c-]+", "", "ab-c"), Some((0, "ab-c".into())));
		assert_eq!(m(r"[\w-]+", "", "a_b-c!"), Some((0, "a_b-c".into())));
		assert_eq!(m(r"[[\]]+", "", "[]"), Some((0, "[]".into())));
	}

	#[test]
	fn group_counting() {
		assert_eq!(count_capture_groups(r"(a)(?:b)(?=c)(?<x>d)[()]"), 2);
		assert_eq!(count_capture_groups(r"(-?)(\b0[xX][a-fA-F0-9]+|(\b\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?)"), 5);
	}

	#[test]
	fn exec_from_position() {
		let re = JsRegex::new(r"o", "").unwrap();
		assert_eq!(re.exec_from("foo", 2).map(|m| m.index), Some(2));
		assert!(re.exec_from("foo", 3).is_none());
		assert!(re.exec_from("foo", 9).is_none());
	}

	#[test]
	fn starts_with_check() {
		let re = JsRegex::new(r"end", "").unwrap();
		assert!(re.starts_with("end of it"));
		assert!(!re.starts_with("the end"));
	}
}

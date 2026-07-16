//! JavaScript regex semantics over the regex crate, with fancy-regex as the
//! fallback for patterns using lookarounds or backreferences. Both backends
//! implement leftmost-first alternation (Perl-style), so a pattern compiles
//! to the same match semantics either way; the regex-crate backend is
//! preferred because its automata engines avoid fancy-regex's backtracking
//! VM on the hot tokenizer paths.
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

const JS_WS: &str = r"\t\n\x0B\f\r \x{00A0}\x{1680}\x{2000}-\x{200A}\x{2028}\x{2029}\x{202F}\x{205F}\x{3000}\x{FEFF}";
const WORD: &str = "0-9A-Za-z_";

/// How `\b`/`\B` (outside classes) are encoded.
#[derive(Clone, Copy, PartialEq)]
enum BoundaryStyle {
	/// `(?-u:\b)` — regex-crate syntax; fancy-regex's parser rejects it.
	FlagGroup,
	/// Explicit `[0-9A-Za-z_]` lookarounds — accepted by fancy-regex, but
	/// they force its backtracking VM.
	Lookaround,
}

#[derive(Debug)]
pub struct TranslateError(pub String);

impl std::fmt::Display for TranslateError {
	fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
		write!(f, "regex translation error: {}", self.0)
	}
}

/// Translate a JS pattern (given its flags) to regex-crate syntax.
pub fn translate(pattern: &str, flags: &str) -> Result<String, TranslateError> {
	translate_with(pattern, flags, BoundaryStyle::FlagGroup)
}

fn translate_with(
	pattern: &str,
	flags: &str,
	boundary: BoundaryStyle,
) -> Result<String, TranslateError> {
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
				translate_escape(&chars, &mut i, next, &mut out, false, unicode, boundary)?;
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
#[allow(clippy::too_many_arguments)]
fn translate_escape(
	chars: &[char],
	i: &mut usize,
	next: char,
	out: &mut String,
	in_class: bool,
	unicode: bool,
	boundary: BoundaryStyle,
) -> Result<(), TranslateError> {
	match next {
		'd' => out.push_str(if in_class { "0-9" } else { "[0-9]" }),
		'D' => {
			if in_class {
				return Err(TranslateError("\\D inside class".into()));
			}
			out.push_str("[^0-9]");
		}
		'w' => out.push_str(if in_class { WORD } else { "[0-9A-Za-z_]" }),
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
			} else if boundary == BoundaryStyle::FlagGroup {
				// JS non-unicode `\b` is the ASCII word boundary.
				out.push_str(r"(?-u:\b)");
			} else {
				out.push_str(&format!(
					"(?:(?<=[{WORD}])(?![{WORD}])|(?<![{WORD}])(?=[{WORD}]))"
				));
			}
		}
		'B' => {
			if in_class {
				return Err(TranslateError("\\B inside class".into()));
			}
			if boundary == BoundaryStyle::FlagGroup {
				out.push_str(r"(?-u:\B)");
			} else {
				out.push_str(&format!(
					"(?:(?<=[{WORD}])(?=[{WORD}])|(?<![{WORD}])(?![{WORD}]))"
				));
			}
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
			&& matches!(
				body.as_str(),
				r"\s\S" | r"\S\s" | r"\w\W" | r"\W\w" | r"\d\D" | r"\D\d"
			)) {
		out.push_str("(?s:.)");
		return Ok(end + 1);
	}
	if !negated && (body.contains(r"\S") || body.contains(r"\W") || body.contains(r"\D")) {
		// Positive class with a negative shorthand plus other members: the
		// negative set alone covers nearly everything; grammars in the
		// common set don't hit this — fail loudly if one ever does.
		return Err(TranslateError(format!(
			"mixed negative shorthand in class: [{body}]"
		)));
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
			translate_escape(
				chars,
				&mut i,
				next,
				out,
				true,
				unicode,
				BoundaryStyle::FlagGroup,
			)?;
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
				// Plain `(` or a named group `(?<name>` both capture.
				if bytes.get(i + 1) != Some(&b'?')
					|| (bytes.get(i + 2) == Some(&b'<')
						&& !matches!(bytes.get(i + 3), Some(&b'=') | Some(&b'!')))
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
	backend: Backend,
	/// Original JS source (used for `terminatorEnd` concatenation).
	pub source: String,
	pub group_count: usize,
}

/// The compiled form: the regex crate whenever the pattern has no fancy
/// features (lookarounds, backreferences), fancy-regex otherwise.
///
/// A fancy pattern additionally carries a "prefilter" when one can be
/// derived: a non-fancy regex matching a superset of the fancy pattern's
/// match START positions (lookaround guards dropped; a trailing `(?=Y)`
/// kept as the sequence `(?:Y)`). `find_from` then leapfrogs — the
/// prefilter's DFA skips the stretch where no match can start, and the
/// backtracking VM only scans from the first candidate onward.
#[derive(Debug)]
enum Backend {
	Fast(regex::Regex),
	Fancy {
		regex: fancy_regex::Regex,
		prefilter: Option<regex::Regex>,
	},
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

/// Derive a non-fancy "start superset" prefilter from a translated pattern.
///
/// Soundness: every zero-width guard (lookahead/lookbehind) can be dropped
/// without losing any candidate match START — any accepting path of the
/// original at position `p` is an accepting path of the guard-free pattern
/// at `p`. A positive lookahead after which nothing more is consumed can
/// instead be kept as a plain sequence `(?:Y)` (tighter, still a start
/// superset: the original requires `Y` to follow). Backreferences consume
/// text and cannot be dropped — a pattern relying on them in consumed
/// position yields `None` (no prefilter, scan as before).
fn defancy_prefilter(pattern: &str) -> Option<String> {
	let chars: Vec<char> = pattern.chars().collect();
	let out = defancy(&chars)?;
	if out.is_empty() || out == "(?i)" || out == "(?m)" || out == "(?i)(?m)" {
		return None;
	}
	Some(out)
}

fn defancy(chars: &[char]) -> Option<String> {
	let mut out = String::with_capacity(chars.len());
	let mut i = 0;
	while i < chars.len() {
		match chars[i] {
			'\\' => {
				let next = *chars.get(i + 1)?;
				if (next.is_ascii_digit() && next != '0') || next == 'k' {
					return None; // backreference in consumed position
				}
				out.push('\\');
				out.push(next);
				i += 2;
			}
			'[' => {
				let start = i;
				i += 1;
				if chars.get(i) == Some(&'^') {
					i += 1;
				}
				while i < chars.len() && chars[i] != ']' {
					if chars[i] == '\\' {
						i += 1;
					}
					i += 1;
				}
				i = (i + 1).min(chars.len());
				out.extend(&chars[start..i]);
			}
			'(' if lookaround_len(chars, i).is_some() => {
				let prefix = lookaround_len(chars, i).expect("checked");
				let positive_ahead = chars[i + 2] == '=';
				let close = matching_paren(chars, i)?;
				let trailing = chars[close + 1..].iter().all(|&c| c == ')');
				let sequenced = if positive_ahead && trailing {
					defancy(&chars[i + prefix..close])
				} else {
					None
				};
				match sequenced {
					Some(inner) => {
						out.push_str("(?:");
						out.push_str(&inner);
						out.push(')');
						i = close + 1;
					}
					None => {
						// Drop the guard (and any quantifier on it).
						i = skip_quantifier(chars, close + 1);
					}
				}
			}
			c => {
				out.push(c);
				i += 1;
			}
		}
	}
	Some(out)
}

/// If `i` starts a lookaround group, its prefix length: `(?=`/`(?!` → 3,
/// `(?<=`/`(?<!` → 4. Named groups (`(?<name>`) are not lookarounds.
fn lookaround_len(chars: &[char], i: usize) -> Option<usize> {
	if chars.get(i) != Some(&'(') || chars.get(i + 1) != Some(&'?') {
		return None;
	}
	match chars.get(i + 2) {
		Some('=') | Some('!') => Some(3),
		Some('<') if matches!(chars.get(i + 3), Some('=') | Some('!')) => Some(4),
		_ => None,
	}
}

/// Index of the `)` closing the group opened at `open` (class- and
/// escape-aware).
fn matching_paren(chars: &[char], open: usize) -> Option<usize> {
	let mut depth = 0usize;
	let mut i = open;
	while i < chars.len() {
		match chars[i] {
			'\\' => i += 1,
			'[' => {
				i += 1;
				if chars.get(i) == Some(&'^') {
					i += 1;
				}
				while i < chars.len() && chars[i] != ']' {
					if chars[i] == '\\' {
						i += 1;
					}
					i += 1;
				}
			}
			'(' => depth += 1,
			')' => {
				depth -= 1;
				if depth == 0 {
					return Some(i);
				}
			}
			_ => {}
		}
		i += 1;
	}
	None
}

/// Skip a quantifier (`?`, `*`, `+`, `{n[,m]}`) plus a lazy `?` suffix.
fn skip_quantifier(chars: &[char], mut i: usize) -> usize {
	match chars.get(i) {
		Some('?') | Some('*') | Some('+') => i += 1,
		Some('{') => {
			let mut j = i + 1;
			while j < chars.len() && (chars[j].is_ascii_digit() || chars[j] == ',') {
				j += 1;
			}
			if chars.get(j) == Some(&'}') && j > i + 1 {
				i = j + 1;
			}
		}
		_ => return i,
	}
	if chars.get(i) == Some(&'?') {
		i += 1;
	}
	i
}

impl JsRegex {
	pub fn new(js_source: &str, flags: &str) -> Result<Self, TranslateError> {
		// Prefer the regex crate; its parser rejects fancy features
		// (lookarounds, backreferences), for which we fall back to
		// fancy-regex with the lookaround `\b` encoding.
		let fast = translate_with(js_source, flags, BoundaryStyle::FlagGroup)?;
		let backend = match regex::Regex::new(&fast) {
			Ok(regex) => Backend::Fast(regex),
			Err(_) => {
				let fancy = translate_with(js_source, flags, BoundaryStyle::Lookaround)?;
				let regex = fancy_regex::Regex::new(&fancy).map_err(|error| {
					TranslateError(format!("{error} (from /{js_source}/{flags})"))
				})?;
				let prefilter =
					defancy_prefilter(&fast).and_then(|pattern| regex::Regex::new(&pattern).ok());
				Backend::Fancy { regex, prefilter }
			}
		};
		Ok(Self {
			backend,
			source: js_source.to_string(),
			group_count: count_capture_groups(js_source),
		})
	}

	/// Match span only (no capture materialization) — the regex crate can
	/// answer this from its DFA engines without capture tracking, so it is
	/// substantially cheaper than `exec_from` for callers that race
	/// several regexes and only materialize the winner.
	pub fn find_from(&self, text: &str, last_index: usize) -> Option<(usize, usize)> {
		if last_index > text.len() {
			return None;
		}
		match &self.backend {
			Backend::Fast(regex) => regex
				.find_at(text, last_index)
				.map(|m| (m.start(), m.end())),
			Backend::Fancy { regex, prefilter } => {
				let from = match prefilter {
					// Leapfrog: no fancy match can start before the first
					// prefilter candidate, so start the VM scan there.
					Some(pre) => match pre.find_at(text, last_index) {
						Some(candidate) => candidate.start(),
						None => return None,
					},
					None => last_index,
				};
				regex
					.find_from_pos(text, from)
					.ok()
					.flatten()
					.map(|m| (m.start(), m.end()))
			}
		}
	}

	/// `regex.exec(text)` with `lastIndex` semantics (byte offset).
	pub fn exec_from(&self, text: &str, last_index: usize) -> Option<JsMatch> {
		if last_index > text.len() {
			return None;
		}
		match &self.backend {
			Backend::Fast(regex) => {
				let captures = regex.captures_at(text, last_index)?;
				let whole = captures.get(0).expect("group 0 always present");
				Some(JsMatch {
					index: whole.start(),
					end: whole.end(),
					groups: (0..captures.len())
						.map(|i| captures.get(i).map(|m| m.as_str().to_string()))
						.collect(),
				})
			}
			Backend::Fancy { regex, prefilter } => {
				let from = match prefilter {
					Some(pre) => pre.find_at(text, last_index)?.start(),
					None => last_index,
				};
				let captures = regex.captures_from_pos(text, from).ok()??;
				let whole = captures.get(0).expect("group 0 always present");
				Some(JsMatch {
					index: whole.start(),
					end: whole.end(),
					groups: (0..captures.len())
						.map(|i| captures.get(i).map(|m| m.as_str().to_string()))
						.collect(),
				})
			}
		}
	}

	/// `startsWith`: does the regex match at position 0 of `lexeme`?
	pub fn starts_with(&self, lexeme: &str) -> bool {
		matches!(self.find_from(lexeme, 0), Some((0, _)))
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
		assert_eq!(
			count_capture_groups(r"(-?)(\b0[xX][a-fA-F0-9]+|(\b\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?)"),
			5
		);
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

	#[test]
	fn translate_is_public_and_reports_errors() {
		assert_eq!(translate(r"\d+\w", "").unwrap(), "[0-9]+[0-9A-Za-z_]");
		let error = translate("a\\", "").unwrap_err();
		assert!(error.to_string().contains("trailing backslash"));
	}

	#[test]
	fn dot_all_flag() {
		assert_eq!(m(r"a.b", "s", "a\nb"), Some((0, "a\nb".into())));
	}

	#[test]
	fn literal_braces_and_quantifiers() {
		assert_eq!(m(r"a{2}", "", "caaa"), Some((1, "aa".into())));
		assert_eq!(m(r"a{2,3}", "", "aaaa"), Some((0, "aaa".into())));
		assert_eq!(m(r"{x}", "", "a{x}"), Some((1, "{x}".into())));
		assert_eq!(m(r"a{", "", "a{"), Some((0, "a{".into())));
		// `}` escaping scans back for an open quantifier brace.
		assert_eq!(m(r"}1}", "", "}1}"), Some((0, "}1}".into())));
		assert_eq!(m(r"a1}", "", "a1}"), Some((0, "a1}".into())));
		assert_eq!(m(r"1}", "", "1}"), Some((0, "1}".into())));
	}

	#[test]
	fn class_shorthand_limits() {
		// Negative shorthands inside classes are unsupported (grammars in the
		// common set never use them) and must fail loudly.
		assert!(JsRegex::new(r"[^\D]", "").is_err());
		assert!(JsRegex::new(r"[^\W]", "").is_err());
		assert!(JsRegex::new(r"[^\S]", "").is_err());
		assert!(JsRegex::new(r"[^\B]", "").is_err());
		assert!(JsRegex::new(r"[a\S]", "").is_err());
		assert!(JsRegex::new(r"[abc", "").is_err());
		// Outside classes the negative shorthands work.
		assert_eq!(m(r"\D", "", "5a"), Some((1, "a".into())));
		assert_eq!(m(r"\W", "", "a!"), Some((1, "!".into())));
		assert_eq!(m(r"a\Sb", "", "a b axb"), Some((4, "axb".into())));
	}

	#[test]
	fn class_members_and_empty_class() {
		assert_eq!(m(r"[\b]", "", "a\u{8}"), Some((1, "\u{8}".into())));
		assert_eq!(m(r"[\s]", "", "x\u{FEFF}"), Some((1, "\u{FEFF}".into())));
		assert_eq!(m(r"[a[]", "", "["), Some((0, "[".into())));
		assert_eq!(m(r"[a&]", "", "&"), Some((0, "&".into())));
		assert_eq!(m(r"[a~]", "", "~"), Some((0, "~".into())));
		assert_eq!(m(r"[-a]", "", "-"), Some((0, "-".into())));
		// `[]` matches nothing in JS.
		assert_eq!(translate(r"x[]y", "").unwrap(), "x[^\\x00-\\x{10FFFF}]y");
	}

	#[test]
	fn escape_sequences() {
		assert_eq!(m(r"é", "", "é"), Some((0, "é".into())));
		assert_eq!(m("\\u00e9", "", "xé"), Some((1, "é".into())));
		assert_eq!(m(r"\uq", "", "uq"), Some((0, "uq".into())));
		assert_eq!(m(r"\x41", "", "A"), Some((0, "A".into())));
		assert_eq!(m(r"\xZ", "", "xZ"), Some((0, "xZ".into())));
		assert_eq!(m("a\\0", "", "a\0b"), Some((0, "a\0".into())));
		assert_eq!(m(r"\v", "", "\u{B}"), Some((0, "\u{B}".into())));
		assert_eq!(m(r"\cJ", "", "\n"), Some((0, "\n".into())));
		assert_eq!(m(r"\c1", "", "c1"), Some((0, "c1".into())));
		assert_eq!(m(r"a\c", "", "ac"), Some((0, "ac".into())));
		assert_eq!(m(r"\q\y", "", "qy"), Some((0, "qy".into())));
		assert_eq!(m(r"\p{Lu}+", "u", "abcDEF"), Some((3, "DEF".into())));
		assert_eq!(m(r"\P{L}", "u", "ab1"), Some((2, "1".into())));
		assert_eq!(m(r"\pL", "u", "1A"), Some((1, "A".into())));
	}

	#[test]
	fn backreferences_via_fancy() {
		// Numbered backreference: consumed position → no prefilter, still
		// correct match semantics.
		let re = JsRegex::new(r"(ab)\1", "").unwrap();
		assert_eq!(re.find_from("xabab", 0), Some((1, 5)));
		let found = re.exec_from("xabab", 0).unwrap();
		assert_eq!(
			(found.index, found.end, found.groups[1].as_deref()),
			(1, 5, Some("ab"))
		);
		// Named backreference.
		let re = JsRegex::new(r"(?<w>ab)\k<w>", "").unwrap();
		assert_eq!(re.find_from("abab", 0), Some((0, 4)));
	}

	#[test]
	fn boundary_fallback_encoding() {
		// A lookaround forces the fancy backend, which needs the explicit
		// lookaround encoding of \b/\B.
		let re = JsRegex::new(r"\Bnd(?=\s)", "").unwrap();
		assert_eq!(re.find_from("end of", 0), Some((1, 3)));
		let re = JsRegex::new(r"\bof(?=f)", "").unwrap();
		assert_eq!(re.find_from("x off", 0), Some((2, 4)));
	}

	#[test]
	fn prefilter_shapes() {
		// Trailing lookahead becomes a sequenced prefilter.
		let re = JsRegex::new(r"a(?=b)", "").unwrap();
		assert_eq!(re.find_from("xxab", 0), Some((2, 3)));
		assert_eq!(re.exec_from("xxab", 0).map(|m| m.index), Some(2));
		assert!(re.exec_from("xxa", 0).is_none());
		// Mid-pattern guard is dropped (start superset stays sound).
		let re = JsRegex::new(r"a(?=b).", "").unwrap();
		assert_eq!(re.find_from("ab", 0), Some((0, 2)));
		// Lookbehind is dropped.
		let re = JsRegex::new(r"(?<=a)b", "").unwrap();
		assert_eq!(re.find_from("xxab", 0), Some((3, 4)));
		// A pure guard leaves an empty prefilter → none; scanning still works.
		let re = JsRegex::new(r"(?!a)", "").unwrap();
		assert_eq!(re.find_from("ab", 0), Some((1, 1)));
		// A class containing literal "(?=" is not treated as a group.
		let re = JsRegex::new(r"[(?=]a(?=b)", "").unwrap();
		assert_eq!(re.find_from("q?ab", 0), Some((1, 3)));
	}

	#[test]
	fn defancy_internals() {
		fn dc(pattern: &str) -> Option<String> {
			defancy(&pattern.chars().collect::<Vec<char>>())
		}
		// Quantified lookarounds are dropped together with their quantifier.
		assert_eq!(dc("a(?!b)*c").as_deref(), Some("ac"));
		assert_eq!(dc("a(?!b)*?c").as_deref(), Some("ac"));
		assert_eq!(dc("a(?!b){2,3}c").as_deref(), Some("ac"));
		// Unbalanced lookaround / trailing backslash: no prefilter.
		assert_eq!(dc("(?=a"), None);
		assert_eq!(dc("a\\"), None);
	}

	#[test]
	fn find_from_bounds() {
		let re = JsRegex::new("a", "").unwrap();
		assert!(re.find_from("aa", 5).is_none());
	}

	#[test]
	fn double_parse_failure_reports_source() {
		let error = JsRegex::new(r"(?=a", "").unwrap_err();
		assert!(error.to_string().contains("(?=a"));
	}
}

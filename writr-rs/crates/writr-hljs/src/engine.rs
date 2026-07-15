//! Port of hljs `_highlight` — the tokenizer main loop, keyword processing,
//! begin/end matching, sub-language recursion, and callbacks. Always runs
//! with `ignoreIllegals: true` (lowlight's configuration).

use crate::compile::{CompiledLanguage, CompiledScope, RuleKind, SubLanguage};
use crate::raw::Callback;
use crate::registry;
use crate::regex_js::JsMatch;
use crate::tree::{Emitter, HlNode};
use std::collections::HashMap;

const MAX_KEYWORD_HITS: usize = 7;

/// Saved mode stack for sub-language continuations (compiled-mode indexes,
/// `[0]` is the language root).
pub type Continuation = Vec<usize>;

pub struct HighlightResult {
	pub root: Vec<HlNode>,
	pub relevance: f64,
	pub top: Continuation,
	pub language: String,
}

struct MatchEvent {
	kind: RuleKind,
	/// Byte index of the match in the full input.
	index: usize,
	/// Rule-relative groups (`[0]` = full lexeme).
	groups: Vec<Option<String>>,
	/// Rule position within the executing matcher slice.
	position: usize,
}

impl MatchEvent {
	fn lexeme(&self) -> &str {
		self.groups[0].as_deref().unwrap_or("")
	}
}

pub fn highlight(
	language: &CompiledLanguage,
	code: &str,
	continuation: Option<Continuation>,
) -> HighlightResult {
	Engine::new(language, code, true).run(continuation)
}

/// hljs `highlightAuto` over a language subset (used for array-valued
/// `subLanguage`). Candidates run with `ignoreIllegals: false` — an illegal
/// match aborts with relevance 0 and a partial tree, exactly like the JS
/// catch path. A plain-text baseline participates and wins ties (stable
/// sort). Returns `(result, Some(language))` or the baseline with `None`.
pub fn highlight_auto(subset: &[String], code: &str) -> (HighlightResult, Option<String>) {
	let baseline = HighlightResult {
		root: vec![HlNode::Text(code.to_string())],
		relevance: 0.0,
		top: Vec::new(),
		language: String::new(),
	};
	let mut best: (HighlightResult, Option<String>) = (baseline, None);
	for name in subset {
		let Some(language) = registry::get(name) else {
			continue;
		};
		let candidate = Engine::new(language, code, false).run(None);
		if candidate.relevance > best.0.relevance {
			let language_name = candidate.language.clone();
			best = (candidate, Some(language_name));
		}
	}
	best
}

struct Engine<'a> {
	language: &'a CompiledLanguage,
	code: &'a str,
	emitter: Emitter,
	stack: Vec<usize>,
	mode_buffer: String,
	relevance: f64,
	keyword_hits: HashMap<String, usize>,
	/// Per-mode matcher rotation (`regexIndex`).
	regex_index: HashMap<usize, usize>,
	/// Per-mode callback data (`END_SAME_AS_BEGIN`'s `_beginMatch`).
	mode_data: HashMap<usize, Option<String>>,
	/// Sub-language continuations by language name.
	continuations: HashMap<String, Continuation>,
	resume_same_position: bool,
	last_begin_index: Option<usize>,
	ignore_illegals: bool,
	aborted: bool,
}

impl<'a> Engine<'a> {
	fn new(language: &'a CompiledLanguage, code: &'a str, ignore_illegals: bool) -> Self {
		Self {
			language,
			code,
			emitter: Emitter::new("hljs-"),
			stack: vec![language.root],
			mode_buffer: String::new(),
			relevance: 0.0,
			keyword_hits: HashMap::new(),
			regex_index: HashMap::new(),
			mode_data: HashMap::new(),
			continuations: HashMap::new(),
			resume_same_position: false,
			last_begin_index: None,
			ignore_illegals,
			aborted: false,
		}
	}

	fn top_index(&self) -> usize {
		*self.stack.last().expect("non-empty stack")
	}

	fn run(mut self, continuation: Option<Continuation>) -> HighlightResult {
		if let Some(saved) = continuation {
			self.stack = saved;
		}
		// `processContinuations`: reopen scopes of stacked modes (skipping
		// the language root).
		let scopes: Vec<String> = self
			.stack
			.iter()
			.skip(1)
			.filter_map(|&index| self.language.modes[index].scope.clone())
			.collect();
		for scope in scopes {
			let aliased = self.language.alias(&scope);
			self.emitter.open_node(&aliased);
		}

		let mut index = 0usize;
		loop {
			if self.resume_same_position {
				self.resume_same_position = false;
			} else {
				self.regex_index.insert(self.top_index(), 0);
			}
			let Some(event) = self.exec_matcher(index) else {
				break;
			};
			let before = self.code[index..event.index].to_string();
			let processed = self.process_lexeme(&before, Some(&event));
			if self.aborted {
				// Illegal with `ignoreIllegals: false` — the JS engine throws
				// and the catch returns relevance 0 with the partial emitter.
				return HighlightResult {
					root: self.emitter.finish(),
					relevance: 0.0,
					top: self.stack.clone(),
					language: self.language.name.clone(),
				};
			}
			index = event.index + processed;
		}
		let tail = self.code[index.min(self.code.len())..].to_string();
		self.process_lexeme(&tail, None);

		HighlightResult {
			root: self.emitter.finish(),
			relevance: self.relevance,
			top: self.stack.clone(),
			language: self.language.name.clone(),
		}
	}

	/// `ResumableMultiRegex.exec`.
	fn exec_matcher(&mut self, last_index: usize) -> Option<MatchEvent> {
		let top_index = self.top_index();
		let matcher = &self.language.modes[top_index].matcher;
		if matcher.rules.is_empty() {
			return None;
		}
		let regex_index = (*self.regex_index.get(&top_index).unwrap_or(&0))
			.min(matcher.rules.len() - 1);
		let resuming = regex_index != 0;

		let multi = matcher.matcher_at(regex_index);
		let mut base = regex_index;
		let mut result = multi.regex.exec_from(self.code, last_index);

		if resuming {
			let take_second = match &result {
				Some(m) => m.index != last_index,
				None => true,
			};
			if take_second {
				let full = matcher.matcher_at(0);
				base = 0;
				result = full.regex.exec_from(self.code, last_index + 1);
			}
		}

		let m = result?;
		let event = to_event(matcher, base, &m);
		let next = base + event.position + 1;
		self.regex_index.insert(
			top_index,
			if next == matcher.begin_count { 0 } else { next },
		);
		Some(event)
	}

	fn process_lexeme(&mut self, text_before: &str, event: Option<&MatchEvent>) -> usize {
		self.mode_buffer.push_str(text_before);
		let Some(event) = event else {
			self.process_buffer();
			return 0;
		};

		// Zero-width begin followed by zero-width end at the same position:
		// consume one raw character to escape the loop (upstream SAFE_MODE
		// behavior — writes the skipped character through).
		if self.last_begin_index == Some(event.index)
			&& matches!(event.kind, RuleKind::End)
			&& event.lexeme().is_empty()
		{
			let advance = next_char_len(self.code, event.index);
			self.mode_buffer
				.push_str(&self.code[event.index..event.index + advance]);
			return advance;
		}
		self.last_begin_index = match event.kind {
			RuleKind::Begin(_) => Some(event.index),
			_ => None,
		};

		match event.kind {
			RuleKind::Begin(position) => self.do_begin_match(event, position),
			RuleKind::End => match self.do_end_match(event) {
				Some(processed) => processed,
				None => self.plain_advance(event),
			},
			RuleKind::Illegal => {
				if !self.ignore_illegals {
					self.aborted = true;
					return 0;
				}
				// ignoreIllegals: a zero-width illegal (e.g. `$`) advances
				// past one character, appending a literal newline (upstream
				// quirk); otherwise the lexeme is plain text.
				if event.lexeme().is_empty() {
					self.mode_buffer.push('\n');
					1
				} else {
					self.plain_advance(event)
				}
			}
		}
	}

	fn plain_advance(&mut self, event: &MatchEvent) -> usize {
		self.mode_buffer.push_str(event.lexeme());
		event.lexeme().len()
	}

	fn do_begin_match(&mut self, event: &MatchEvent, position: usize) -> usize {
		let top_index = self.top_index();
		let new_mode_index = self.language.modes[top_index].contains[position];
		let lexeme = event.lexeme().to_string();

		let callbacks = {
			let mode = &self.language.modes[new_mode_index];
			[mode.before_begin, mode.on_begin]
		};
		for callback in callbacks.into_iter().flatten() {
			if self.run_callback(callback, event, new_mode_index) {
				return self.do_ignore(&lexeme, top_index);
			}
		}

		let (skip, exclude_begin, return_begin) = {
			let mode = &self.language.modes[new_mode_index];
			(mode.skip, mode.exclude_begin, mode.return_begin)
		};
		if skip {
			self.mode_buffer.push_str(&lexeme);
		} else {
			if exclude_begin {
				self.mode_buffer.push_str(&lexeme);
			}
			self.process_buffer();
			if !return_begin && !exclude_begin {
				self.mode_buffer = lexeme.clone();
			}
		}
		self.start_new_mode(new_mode_index, event);
		if return_begin {
			0
		} else {
			lexeme.len()
		}
	}

	/// `doIgnore`.
	fn do_ignore(&mut self, lexeme: &str, top_index: usize) -> usize {
		if *self.regex_index.get(&top_index).unwrap_or(&0) == 0 {
			let advance = lexeme
				.chars()
				.next()
				.map(char::len_utf8)
				.unwrap_or_else(|| next_char_len_at_least_one());
			self.mode_buffer.push_str(&lexeme[..advance.min(lexeme.len())]);
			advance.max(1)
		} else {
			self.resume_same_position = true;
			0
		}
	}

	fn do_end_match(&mut self, event: &MatchEvent) -> Option<usize> {
		let lexeme = event.lexeme().to_string();
		let remainder = &self.code[event.index..].to_string();

		// Frame index of the mode that ends (after endsParent chains).
		let target = self.end_of_mode(self.stack.len() - 1, event, remainder)?;
		let end_mode_starts = self.language.modes[self.stack[target]].starts;

		let origin_index = self.top_index();
		let (origin_skip, origin_return_end, origin_exclude_end, end_scope) = {
			let origin = &self.language.modes[origin_index];
			(
				origin.skip,
				origin.return_end,
				origin.exclude_end,
				origin.end_scope.clone(),
			)
		};

		match &end_scope {
			Some(CompiledScope::Wrap(name)) => {
				self.process_buffer();
				let aliased = self.language.alias(name);
				self.emit_keyword(&lexeme, &aliased);
			}
			Some(CompiledScope::Multi(scope)) => {
				self.process_buffer();
				let scope = scope.clone();
				self.emit_multi(event, &scope.positions, &scope.emit);
			}
			None => {
				if origin_skip {
					self.mode_buffer.push_str(&lexeme);
				} else {
					if !(origin_return_end || origin_exclude_end) {
						self.mode_buffer.push_str(&lexeme);
					}
					self.process_buffer();
					if origin_exclude_end {
						self.mode_buffer = lexeme.clone();
					}
				}
			}
		}

		// Pop frames through the target (stack length becomes `target`).
		while self.stack.len() > target {
			let mode = &self.language.modes[self.top_index()];
			if mode.scope.is_some() {
				self.emitter.close_node();
			}
			if !mode.skip && mode.sub_language.is_none() {
				self.relevance += mode.relevance;
			}
			self.stack.pop();
		}
		if let Some(starts) = end_mode_starts {
			self.start_new_mode(starts, event);
		}
		Some(if origin_return_end { 0 } else { lexeme.len() })
	}

	/// `endOfMode`: returns the frame index of the ending mode (walking
	/// `endsParent` chains), or `None` when nothing ends here.
	fn end_of_mode(&mut self, frame: usize, event: &MatchEvent, remainder: &str) -> Option<usize> {
		if frame == 0 {
			return None;
		}
		let mode_index = self.stack[frame];
		let matched = {
			let mode = &self.language.modes[mode_index];
			mode.end_re
				.as_ref()
				.map(|re| re.starts_with(remainder))
				.unwrap_or(false)
		};

		if matched {
			let ignored = match self.language.modes[mode_index].on_end {
				Some(callback) => self.run_callback(callback, event, mode_index),
				None => false,
			};
			if !ignored {
				let mut target = frame;
				while target > 1 && self.language.modes[self.stack[target]].ends_parent {
					target -= 1;
				}
				return Some(target);
			}
		}
		if self.language.modes[mode_index].ends_with_parent {
			return self.end_of_mode(frame - 1, event, remainder);
		}
		None
	}

	fn start_new_mode(&mut self, mode_index: usize, event: &MatchEvent) {
		let (scope, begin_scope) = {
			let mode = &self.language.modes[mode_index];
			(mode.scope.clone(), mode.begin_scope.clone())
		};
		if let Some(scope) = scope {
			let aliased = self.language.alias(&scope);
			self.emitter.open_node(&aliased);
		}
		match begin_scope {
			Some(CompiledScope::Wrap(name)) => {
				let buffer = std::mem::take(&mut self.mode_buffer);
				let aliased = self.language.alias(&name);
				self.emit_keyword(&buffer, &aliased);
			}
			Some(CompiledScope::Multi(scope)) => {
				self.emit_multi(event, &scope.positions, &scope.emit);
				self.mode_buffer.clear();
			}
			None => {}
		}
		self.stack.push(mode_index);
	}

	/// `emitMultiClass`.
	fn emit_multi(
		&mut self,
		event: &MatchEvent,
		positions: &HashMap<usize, String>,
		emit: &[usize],
	) {
		for &position in emit {
			let Some(text) = event.groups.get(position).cloned().flatten() else {
				continue;
			};
			match positions.get(&position) {
				Some(kind) if !kind.is_empty() => {
					let aliased = self.language.alias(kind);
					self.emit_keyword(&text, &aliased);
				}
				_ => {
					self.mode_buffer = text;
					self.process_keywords();
					self.mode_buffer.clear();
				}
			}
		}
	}

	fn emit_keyword(&mut self, keyword: &str, scope: &str) {
		if keyword.is_empty() {
			return;
		}
		self.emitter.start_scope(scope);
		self.emitter.add_text(keyword);
		self.emitter.end_scope();
	}

	fn process_buffer(&mut self) {
		if self.language.modes[self.top_index()].sub_language.is_some() {
			self.process_sub_language();
		} else {
			self.process_keywords();
		}
		self.mode_buffer.clear();
	}

	fn process_keywords(&mut self) {
		let top_index = self.top_index();
		if self.language.modes[top_index].keywords.is_none() {
			let buffer = std::mem::take(&mut self.mode_buffer);
			self.emitter.add_text(&buffer);
			self.mode_buffer = buffer;
			return;
		}
		let buffer = self.mode_buffer.clone();
		let mut last_index = 0usize;
		let mut out = String::new();
		// Collect emissions first (pattern exec borrows the language).
		let mut emissions: Vec<(String, Option<String>)> = Vec::new();
		let mut relevance_gain = 0.0;
		{
			let mode = &self.language.modes[top_index];
			let keywords = mode.keywords.as_ref().expect("checked above");
			let pattern = &mode.keyword_pattern;
			while let Some(m) = pattern.exec_from(&buffer, last_index) {
				if m.end == m.index {
					break; // zero-width guard
				}
				out.push_str(&buffer[last_index..m.index]);
				let matched = m.text().to_string();
				let word = if self.language.case_insensitive {
					matched.to_lowercase()
				} else {
					matched.clone()
				};
				if let Some((kind, keyword_relevance)) = keywords.get(&word) {
					emissions.push((std::mem::take(&mut out), None));
					let hits = self.keyword_hits.entry(word.clone()).or_insert(0);
					*hits += 1;
					if *hits <= MAX_KEYWORD_HITS {
						relevance_gain += keyword_relevance;
					}
					if kind.starts_with('_') {
						out.push_str(&matched);
					} else {
						let aliased = self.language.alias(kind);
						emissions.push((matched, Some(aliased)));
					}
				} else {
					out.push_str(&matched);
				}
				last_index = m.end;
			}
		}
		out.push_str(&buffer[last_index.min(buffer.len())..]);
		emissions.push((out, None));
		self.relevance += relevance_gain;

		for (text, scope) in emissions {
			match scope {
				Some(scope) => self.emit_keyword(&text, &scope),
				None => self.emitter.add_text(&text),
			}
		}
	}

	fn process_sub_language(&mut self) {
		if self.mode_buffer.is_empty() {
			return;
		}
		let top_index = self.top_index();
		let (relevance_gate, sub) = {
			let mode = &self.language.modes[top_index];
			(mode.relevance, mode.sub_language.clone())
		};
		match sub {
			Some(SubLanguage::One(name)) => {
				let Some(language) = registry::get(&name) else {
					let buffer = std::mem::take(&mut self.mode_buffer);
					self.emitter.add_text(&buffer);
					self.mode_buffer = buffer;
					return;
				};
				let continuation = self.continuations.get(&name).cloned();
				let result = highlight(language, &self.mode_buffer, continuation);
				if relevance_gate > 0.0 {
					self.relevance += result.relevance;
				}
				self.continuations.insert(name.clone(), result.top.clone());
				self.emitter
					.add_sublanguage(result.root, Some(&result.language));
			}
			Some(SubLanguage::Auto(subset)) => {
				let (result, language_name) = highlight_auto(&subset, &self.mode_buffer);
				if relevance_gate > 0.0 {
					self.relevance += result.relevance;
				}
				self.emitter
					.add_sublanguage(result.root, language_name.as_deref());
			}
			None => {}
		}
	}

	/// Returns whether the match should be ignored.
	fn run_callback(&mut self, callback: Callback, event: &MatchEvent, mode_index: usize) -> bool {
		match callback {
			Callback::ShebangBegin => event.index != 0,
			Callback::SkipIfHasPrecedingDot => {
				event.index > 0 && self.code.as_bytes()[event.index - 1] == b'.'
			}
			Callback::EndSameAsBeginBegin => {
				self.mode_data
					.insert(mode_index, event.groups.get(1).cloned().flatten());
				false
			}
			Callback::PhpHeredocBegin => {
				let value = event
					.groups
					.get(1)
					.cloned()
					.flatten()
					.filter(|s| !s.is_empty())
					.or_else(|| event.groups.get(2).cloned().flatten());
				self.mode_data.insert(mode_index, value);
				false
			}
			Callback::EndSameAsBeginEnd => {
				let stored = self.mode_data.get(&mode_index).cloned().flatten();
				stored != event.groups.get(1).cloned().flatten()
			}
			Callback::JsIsTrulyOpeningTag => js_is_truly_opening_tag(self.code, event),
		}
	}
}

/// `isTrulyOpeningTag` — returns true when the match should be IGNORED.
fn js_is_truly_opening_tag(code: &str, event: &MatchEvent) -> bool {
	let after_index = event.index + event.lexeme().len();
	let after = &code[after_index.min(code.len())..];
	match after.chars().next() {
		// `<` or `,` → not HTML.
		Some('<') | Some(',') => return true,
		Some('>') => {
			// `<something>`: require a matching closing tag.
			let tag = format!("</{}", &event.lexeme()[1..]);
			if !after.contains(&tag) {
				return true;
			}
		}
		_ => {}
	}
	// `/^\s*=/` (JS \s).
	let trimmed = after.trim_start_matches(is_js_ws);
	if trimmed.starts_with('=') {
		return true;
	}
	// `/^\s+extends\s+/` at position 0 (requires leading whitespace).
	if after.len() != trimmed.len() {
		if let Some(rest) = trimmed.strip_prefix("extends") {
			if rest.starts_with(is_js_ws) {
				return true;
			}
		}
	}
	false
}

fn is_js_ws(c: char) -> bool {
	matches!(
		c,
		'\t' | '\n'
			| '\u{000B}' | '\u{000C}' | '\r' | ' '
			| '\u{00A0}' | '\u{1680}'
			| '\u{2000}'..='\u{200A}'
			| '\u{2028}' | '\u{2029}' | '\u{202F}' | '\u{205F}' | '\u{3000}'
			| '\u{FEFF}'
	)
}

fn next_char_len(code: &str, index: usize) -> usize {
	code[index..].chars().next().map(char::len_utf8).unwrap_or(1)
}

fn next_char_len_at_least_one() -> usize {
	1
}

fn to_event(matcher: &crate::compile::Matcher, base: usize, m: &JsMatch) -> MatchEvent {
	let multi = matcher.matcher_at(base);
	for &(group_start, position, group_count) in &multi.match_at {
		if m.groups.get(group_start).cloned().flatten().is_some() {
			let rule = &matcher.rules[base + position];
			let groups: Vec<Option<String>> = (group_start..=group_start + group_count)
				.map(|i| m.groups.get(i).cloned().flatten())
				.collect();
			return MatchEvent {
				kind: rule.kind,
				index: m.index,
				groups,
				position,
			};
		}
	}
	// Unreachable in practice: the winning alternative's wrapper group
	// always participates (possibly as an empty string).
	MatchEvent {
		kind: matcher.rules[base].kind,
		index: m.index,
		groups: vec![Some(String::new())],
		position: 0,
	}
}

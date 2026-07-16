//! Port of hljs `compileLanguage` (core.js) — mode-graph compilation with
//! the compiler extensions in exact order: scopeClassName, compileMatch,
//! MultiClass, beforeMatchExt, beginKeywords, compileIllegal,
//! compileRelevance — plus variant expansion / parent-dependent cloning and
//! the ResumableMultiRegex construction.

use crate::raw::{Callback, Contained, ReSpec, ReValue, ScopeValue, WorkingArena, WorkingMode};
use crate::regex_js::{count_capture_groups, JsRegex};
use serde_json::Value;
// FxHashMap to match the engine (keyword lookups are per-token hot).
use rustc_hash::FxHashMap as HashMap;
use std::sync::OnceLock;

/// Keywords that default to zero relevance.
const COMMON_KEYWORDS: &[&str] = &[
	"of", "and", "for", "in", "not", "or", "if", "then", "parent", "list", "value",
];

/// A compiled keyword: (scope kind, relevance).
pub type KeywordEntry = (String, f64);

/// Multi-class scope map: group position → scope name, plus emit positions.
#[derive(Debug, Clone)]
pub struct MultiScope {
	pub positions: HashMap<usize, String>,
	pub emit: Vec<usize>,
}

#[derive(Debug, Clone)]
pub enum CompiledScope {
	Wrap(String),
	Multi(MultiScope),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RuleKind {
	/// `begin` of contains[i].
	Begin(usize),
	End,
	Illegal,
}

/// One matcher rule: the JS begin/end/illegal source.
#[derive(Debug)]
pub struct MatcherRule {
	pub source: String,
	pub kind: RuleKind,
}

/// ResumableMultiRegex: rules with individually compiled regexes. The JS
/// engine joins `rules[index..]` into one `(a)|(b)|…` union per resume
/// offset; the engine here races the per-rule regexes instead (same
/// leftmost-first semantics), so each rule pays only its own regex
/// complexity.
pub struct Matcher {
	pub rules: Vec<MatcherRule>,
	/// Count of `begin` rules (rotation wrap threshold).
	pub begin_count: usize,
	per_rule: Vec<OnceLock<JsRegex>>,
	flags: String,
}

impl Matcher {
	/// The compiled regex for one rule, wrapped like the JS union wraps
	/// every alternative (`(rule)`), preserving group numbering.
	pub fn rule_at(&self, index: usize) -> &JsRegex {
		self.per_rule[index].get_or_init(|| {
			let sources = [self.rules[index].source.as_str()];
			let wrapped = rewrite_backreferences(&sources, "|");
			JsRegex::new(&wrapped, &format!("{}g", self.flags))
				.unwrap_or_else(|error| panic!("matcher compile failed: {error}"))
		})
	}
}

/// A fully compiled mode.
pub struct CompiledMode {
	pub scope: Option<String>,
	pub end_re: Option<JsRegex>,
	pub keywords: Option<HashMap<String, KeywordEntry>>,
	pub keyword_pattern: JsRegex,
	pub contains: Vec<usize>,
	pub starts: Option<usize>,
	pub matcher: Matcher,
	pub relevance: f64,
	pub skip: bool,
	pub exclude_begin: bool,
	pub exclude_end: bool,
	pub return_begin: bool,
	pub return_end: bool,
	pub ends_with_parent: bool,
	pub ends_parent: bool,
	pub sub_language: Option<SubLanguage>,
	pub begin_scope: Option<CompiledScope>,
	pub end_scope: Option<CompiledScope>,
	pub on_begin: Option<Callback>,
	pub before_begin: Option<Callback>,
	pub on_end: Option<Callback>,
}

#[derive(Debug, Clone)]
pub enum SubLanguage {
	One(String),
	Auto(Vec<String>),
}

/// A compiled language: mode arena + language-level settings.
pub struct CompiledLanguage {
	pub name: String,
	pub modes: Vec<CompiledMode>,
	/// Index of the root mode (always 0 after compilation).
	pub root: usize,
	pub case_insensitive: bool,
	pub class_name_aliases: HashMap<String, String>,
}

impl CompiledLanguage {
	pub fn alias(&self, kind: &str) -> String {
		self.class_name_aliases
			.get(kind)
			.cloned()
			.unwrap_or_else(|| kind.to_string())
	}
}

/// Port of `_rewriteBackreferences` — string-level scan using the same
/// BACKREF_RE alternatives: `[...]` classes, `(` or `(?`, `\N`, `\.`.
pub fn rewrite_backreferences(regexps: &[&str], join_with: &str) -> String {
	let mut num_captures = 0usize;
	let mut rewritten = Vec::with_capacity(regexps.len());
	for source in regexps {
		num_captures += 1;
		let offset = num_captures;
		let mut out = String::with_capacity(source.len() + 8);
		let bytes = source.as_bytes();
		let mut i = 0;
		while i < bytes.len() {
			match bytes[i] {
				b'[' => {
					// `[...]` with escapes.
					out.push('[');
					i += 1;
					while i < bytes.len() && bytes[i] != b']' {
						if bytes[i] == b'\\' && i + 1 < bytes.len() {
							out.push_str(&source[i..i + 2]);
							i += 2;
						} else {
							let c = source[i..].chars().next().expect("char");
							out.push(c);
							i += c.len_utf8();
						}
					}
					if i < bytes.len() {
						out.push(']');
						i += 1;
					}
				}
				b'\\' if i + 1 < bytes.len() => {
					if bytes[i + 1].is_ascii_digit() && bytes[i + 1] != b'0' {
						// Backreference: renumber.
						let mut j = i + 1;
						while j < bytes.len() && bytes[j].is_ascii_digit() {
							j += 1;
						}
						let number: usize = source[i + 1..j].parse().expect("digits");
						out.push('\\');
						out.push_str(&(number + offset).to_string());
						i = j;
					} else {
						out.push_str(&source[i..i + 2]);
						i += 2;
					}
				}
				b'(' => {
					out.push('(');
					if bytes.get(i + 1) == Some(&b'?') {
						// Non-capturing / lookaround / named: leave as-is.
						// (Named groups still capture, but hljs's own
						// countMatchGroups treats them via the same regex —
						// grammars in the common set don't mix named groups
						// with multi-matchers.)
					} else {
						num_captures += 1;
					}
					i += 1;
				}
				_ => {
					let c = source[i..].chars().next().expect("char");
					out.push(c);
					i += c.len_utf8();
				}
			}
		}
		rewritten.push(format!("({out})"));
	}
	rewritten.join(join_with)
}

fn source_of(value: &ReValue) -> String {
	match value {
		ReValue::One(re) => re.source.clone(),
		ReValue::Many(list) => {
			let sources: Vec<&str> = list.iter().map(|re| re.source.as_str()).collect();
			rewrite_backreferences(&sources, "")
		}
	}
}

/// `either(...)` for illegal arrays.
fn either(res: &[ReSpec]) -> String {
	let joined: Vec<String> = res.iter().map(|re| re.source.clone()).collect();
	format!("(?:{})", joined.join("|"))
}

/// Compile keywords (`compileKeywords`).
fn compile_keywords(
	raw: &Value,
	case_insensitive: bool,
	scope_name: &str,
	out: &mut HashMap<String, KeywordEntry>,
) {
	match raw {
		Value::String(list) => {
			compile_list(scope_name, list.split(' '), case_insensitive, out);
		}
		Value::Array(items) => {
			compile_list(
				scope_name,
				items.iter().filter_map(Value::as_str),
				case_insensitive,
				out,
			);
		}
		Value::Object(map) => {
			for (key, value) in map {
				if key == "$pattern" {
					continue;
				}
				compile_keywords(value, case_insensitive, key, out);
			}
		}
		_ => {}
	}
}

fn compile_list<'a>(
	scope_name: &str,
	keywords: impl Iterator<Item = &'a str>,
	case_insensitive: bool,
	out: &mut HashMap<String, KeywordEntry>,
) {
	for keyword in keywords {
		let keyword = if case_insensitive {
			keyword.to_lowercase()
		} else {
			keyword.to_string()
		};
		let mut parts = keyword.splitn(2, '|');
		let word = parts.next().unwrap_or("").to_string();
		let score = match parts.next() {
			Some(provided) => provided.parse::<f64>().unwrap_or(f64::NAN),
			None => {
				if COMMON_KEYWORDS.contains(&word.to_lowercase().as_str()) {
					0.0
				} else {
					1.0
				}
			}
		};
		out.insert(word, (scope_name.to_string(), score));
	}
}

/// Compile one language from its working arena.
pub struct Compiler {
	arena: WorkingArena,
	compiled: Vec<Option<CompiledMode>>,
	/// working index → compiled index.
	cache: HashMap<usize, usize>,
	/// begin/terminator sources recorded before child recursion, so cyclic
	/// references can build matchers against in-progress modes.
	begin_sources: HashMap<usize, String>,
	terminator_ends: HashMap<usize, String>,
	case_insensitive: bool,
	unicode_regex: bool,
}

impl Compiler {
	pub fn compile(mut arena: WorkingArena, name: &str) -> CompiledLanguage {
		let root = &arena.modes[0];
		let case_insensitive = root.case_insensitive;
		let unicode_regex = root.unicode_regex;
		let class_name_aliases = root.class_name_aliases.clone();

		let mut compiler = Compiler {
			compiled: Vec::new(),
			cache: HashMap::default(),
			begin_sources: HashMap::default(),
			terminator_ends: HashMap::default(),
			case_insensitive,
			unicode_regex,
			arena: WorkingArena { modes: Vec::new() },
		};
		std::mem::swap(&mut compiler.arena, &mut arena);

		let root_index = compiler.compile_mode(0, None);
		assert_eq!(root_index, 0, "root compiles first");

		CompiledLanguage {
			name: name.to_string(),
			modes: compiler
				.compiled
				.into_iter()
				.map(|slot| slot.expect("all slots filled"))
				.collect(),
			root: root_index,
			case_insensitive,
			class_name_aliases,
		}
	}

	fn lang_flags(&self, global: bool) -> String {
		let mut flags = String::from("m");
		if self.case_insensitive {
			flags.push('i');
		}
		if self.unicode_regex {
			flags.push('u');
		}
		if global {
			flags.push('g');
		}
		flags
	}

	fn lang_re(&self, source: &str, extra_flags: &str) -> JsRegex {
		// Grammar-object regexes may carry their own flags (e.g. `s`); the
		// language adds m/i/u.
		let mut flags = self.lang_flags(false);
		for flag in extra_flags.chars() {
			if !flags.contains(flag) && flag != 'g' {
				flags.push(flag);
			}
		}
		JsRegex::new(source, &flags).unwrap_or_else(|error| panic!("grammar regex failed: {error}"))
	}

	/// `compileMode` — returns the compiled index.
	fn compile_mode(&mut self, working: usize, parent: Option<usize>) -> usize {
		if let Some(&compiled) = self.cache.get(&working) {
			return compiled;
		}

		// --- compiler extensions (mutating the working mode) ---
		self.ext_scope_class_name(working);
		self.ext_compile_match(working);
		self.ext_multi_class(working);
		self.ext_before_match(working);
		self.ext_begin_keywords(working, parent);
		self.ext_compile_illegal(working);
		self.ext_compile_relevance(working);
		self.arena.modes[working].is_compiled = true;

		// Reserve the compiled slot before recursion (cycles).
		let compiled_index = self.compiled.len();
		self.compiled.push(None);
		self.cache.insert(working, compiled_index);

		let mode = self.arena.modes[working].clone();

		// Keywords + pattern.
		let mut keyword_pattern = String::from(r"\w+");
		let mut keyword_flags = String::new();
		if let Some(Value::Object(map)) = &mode.keywords {
			if let Some(pattern) = map.get("$pattern") {
				if let Some(re) = pattern.as_str() {
					keyword_pattern = re.to_string();
				} else if let Some(obj) = pattern.as_object() {
					if let Some(source) = obj.get("$re").and_then(Value::as_str) {
						keyword_pattern = source.to_string();
					}
					if let Some(flags) = obj.get("$flags").and_then(Value::as_str) {
						keyword_flags = flags.to_string();
					}
				}
			}
		}
		let keywords = mode.keywords.as_ref().map(|raw| {
			let mut out = HashMap::default();
			compile_keywords(raw, self.case_insensitive, "keyword", &mut out);
			out
		});

		// begin/end regexes (only when there is a parent).
		let mut begin_source = String::new();
		let mut end_re = None;
		let mut terminator_end = String::new();
		if parent.is_some() {
			let begin = mode
				.begin
				.clone()
				.unwrap_or(ReValue::One(ReSpec::literal(r"\B|\b")));
			begin_source = source_of(&begin);

			let mut end = mode.end.clone();
			if end.is_none() && !mode.ends_with_parent {
				end = Some(ReValue::One(ReSpec::literal(r"\B|\b")));
			}
			if let Some(end_value) = &end {
				let end_source = source_of(end_value);
				let end_flags = match end_value {
					ReValue::One(re) => re.flags.clone(),
					ReValue::Many(_) => String::new(),
				};
				end_re = Some(self.lang_re(&end_source, &end_flags));
				terminator_end = end_source;
			}
			if let (true, Some(parent_index)) = (mode.ends_with_parent, parent) {
				let parent_compiled = self.cache[&parent_index];
				let parent_terminator = self
					.terminator_ends
					.get(&parent_compiled)
					.cloned()
					.unwrap_or_default();
				if !parent_terminator.is_empty() {
					if !terminator_end.is_empty() {
						terminator_end.push('|');
					}
					terminator_end.push_str(&parent_terminator);
				}
			}
		}
		self.begin_sources
			.insert(compiled_index, begin_source.clone());
		self.terminator_ends
			.insert(compiled_index, terminator_end.clone());

		let illegal_source = mode.illegal.as_ref().map(|res| either(res));

		// Expand contains ('self' + variants + clones).
		let mut contains_working: Vec<usize> = Vec::new();
		for entry in mode.contains.clone() {
			let target = match entry {
				Contained::SelfRef => working,
				Contained::Mode(index) => index,
			};
			contains_working.extend(self.expand_or_clone(target));
		}

		let contains: Vec<usize> = contains_working
			.iter()
			.map(|&child| self.compile_mode(child, Some(working)))
			.collect();

		let starts = self.arena.modes[working]
			.starts
			.map(|starts| self.compile_mode(starts, parent));

		// Matcher rules: children begins, own terminator, illegal.
		let mut rules: Vec<MatcherRule> = Vec::new();
		let mut begin_count = 0;
		for (position, &child) in contains.iter().enumerate() {
			let source = self.begin_sources[&child].clone();
			rules.push(MatcherRule {
				source,
				kind: RuleKind::Begin(position),
			});
			begin_count += 1;
		}
		if !terminator_end.is_empty() {
			rules.push(MatcherRule {
				source: terminator_end.clone(),
				kind: RuleKind::End,
			});
		}
		if let Some(illegal) = &illegal_source {
			rules.push(MatcherRule {
				source: illegal.clone(),
				kind: RuleKind::Illegal,
			});
		}
		let per_rule = (0..rules.len()).map(|_| OnceLock::new()).collect();

		let mode = &self.arena.modes[working];
		let sub_language = mode.sub_language.as_ref().and_then(|value| match value {
			Value::String(name) => Some(SubLanguage::One(name.clone())),
			Value::Array(items) => Some(SubLanguage::Auto(
				items
					.iter()
					.filter_map(Value::as_str)
					.map(str::to_string)
					.collect(),
			)),
			_ => None,
		});

		self.compiled[compiled_index] = Some(CompiledMode {
			// JS treats `""`/null scopes as falsy: no node is opened.
			scope: match &mode.scope {
				Some(ScopeValue::Name(name)) if !name.is_empty() => Some(name.clone()),
				_ => None,
			},
			end_re,
			keywords,
			keyword_pattern: self.lang_re(&keyword_pattern, &format!("{keyword_flags}g")),
			contains,
			starts,
			matcher: Matcher {
				rules,
				begin_count,
				per_rule,
				flags: self.lang_flags(false),
			},
			relevance: mode.relevance.unwrap_or(1.0),
			skip: mode.skip,
			exclude_begin: mode.exclude_begin,
			exclude_end: mode.exclude_end,
			return_begin: mode.return_begin,
			return_end: mode.return_end,
			ends_with_parent: mode.ends_with_parent,
			ends_parent: mode.ends_parent,
			sub_language,
			begin_scope: compile_scope(&mode.begin_scope),
			end_scope: compile_scope(&mode.end_scope),
			on_begin: mode.on_begin,
			before_begin: mode.before_begin,
			on_end: mode.on_end,
		});
		compiled_index
	}

	// --- extensions ---

	fn ext_scope_class_name(&mut self, index: usize) {
		let mode = &mut self.arena.modes[index];
		if mode.class_name.is_some() {
			mode.scope = mode.class_name.take();
		}
	}

	fn ext_compile_match(&mut self, index: usize) {
		let mode = &mut self.arena.modes[index];
		if let Some(match_) = mode.match_.take() {
			assert!(
				mode.begin.is_none() && mode.end.is_none(),
				"begin & end are not supported with match"
			);
			mode.begin = Some(match_);
		}
	}

	/// `MultiClass`: scope sugar + multi-class begin/end.
	fn ext_multi_class(&mut self, index: usize) {
		let mode = &mut self.arena.modes[index];
		// scopeSugar: object scope → beginScope.
		if let Some(ScopeValue::Multi(_)) = &mode.scope {
			mode.begin_scope = mode.scope.take();
		}
		// String begin/end scopes become _wrap (represented as Name).
		// beginMultiClass:
		if let (Some(ReValue::Many(list)), Some(ScopeValue::Multi(_))) =
			(&mode.begin, &mode.begin_scope)
		{
			let sources: Vec<String> = list.iter().map(|re| re.source.clone()).collect();
			let refs: Vec<&str> = sources.iter().map(String::as_str).collect();
			let remapped = remap_scope_positions(
				match &mode.begin_scope {
					Some(ScopeValue::Multi(map)) => map,
					_ => unreachable!(),
				},
				&refs,
			);
			mode.begin_scope = Some(ScopeValue::Multi(remapped.positions_as_map()));
			// Keep the emit info by encoding positions map directly; the
			// compiled stage rebuilds MultiScope from it.
			mode.begin = Some(ReValue::One(ReSpec::literal(&rewrite_backreferences(
				&refs, "",
			))));
			// Stash emit set through a parallel side-channel: positions map
			// only contains emitted entries after remap, so emit == keys.
		}
		if let (Some(ReValue::Many(list)), Some(ScopeValue::Multi(_))) =
			(&mode.end, &mode.end_scope)
		{
			let sources: Vec<String> = list.iter().map(|re| re.source.clone()).collect();
			let refs: Vec<&str> = sources.iter().map(String::as_str).collect();
			let remapped = remap_scope_positions(
				match &mode.end_scope {
					Some(ScopeValue::Multi(map)) => map,
					_ => unreachable!(),
				},
				&refs,
			);
			mode.end_scope = Some(ScopeValue::Multi(remapped.positions_as_map()));
			mode.end = Some(ReValue::One(ReSpec::literal(&rewrite_backreferences(
				&refs, "",
			))));
		}
	}

	/// `beforeMatchExt`.
	fn ext_before_match(&mut self, index: usize) {
		let Some(before) = self.arena.modes[index].before_match.clone() else {
			return;
		};
		assert!(
			self.arena.modes[index].starts.is_none(),
			"beforeMatch cannot be used with starts"
		);
		// Clone the original mode (minus beforeMatch) as the inner rule.
		let mut original = self.arena.modes[index].clone();
		original.before_match = None;
		original.is_compiled = false;
		original.cached_variants = None;
		original.ends_parent = true;
		let original_begin = original.begin.as_ref().map(source_of).unwrap_or_default();
		let inner = self.arena.push(original);

		let starts_wrapper = self.arena.push(WorkingMode {
			relevance: Some(0.0),
			contains: vec![Contained::Mode(inner)],
			..WorkingMode::default()
		});

		let mode = &mut self.arena.modes[index];
		let keywords = mode.keywords.clone();
		*mode = WorkingMode {
			keywords,
			begin: Some(ReValue::One(ReSpec::literal(&format!(
				"{}(?={})",
				before.source, original_begin
			)))),
			starts: Some(starts_wrapper),
			relevance: Some(0.0),
			..WorkingMode::default()
		};
	}

	/// `beginKeywords`.
	fn ext_begin_keywords(&mut self, index: usize, parent: Option<usize>) {
		let mode = &mut self.arena.modes[index];
		if parent.is_none() {
			return;
		}
		let Some(begin_keywords) = mode.begin_keywords.take() else {
			return;
		};
		let pattern = format!(
			"\\b({})(?!\\.)(?=\\b|\\s)",
			begin_keywords.split(' ').collect::<Vec<_>>().join("|")
		);
		mode.begin = Some(ReValue::One(ReSpec::literal(&pattern)));
		mode.before_begin = Some(Callback::SkipIfHasPrecedingDot);
		if mode.keywords.is_none() {
			mode.keywords = Some(Value::String(begin_keywords));
		}
		if mode.relevance.is_none() {
			mode.relevance = Some(0.0);
		}
	}

	fn ext_compile_illegal(&mut self, _index: usize) {
		// Illegal arrays are handled at compile time via `either`.
	}

	fn ext_compile_relevance(&mut self, index: usize) {
		let mode = &mut self.arena.modes[index];
		if mode.relevance.is_none() {
			mode.relevance = Some(1.0);
		}
	}

	/// `expandOrCloneMode`.
	fn expand_or_clone(&mut self, index: usize) -> Vec<usize> {
		if self.arena.modes[index].variants.is_some()
			&& self.arena.modes[index].cached_variants.is_none()
		{
			let variants = self.arena.modes[index].variants.clone().unwrap();
			let cached: Vec<usize> = variants
				.iter()
				.map(|&variant| {
					let clone = self.arena.inherit(index, &[variant]);
					self.arena.modes[clone].variants = None;
					clone
				})
				.collect();
			self.arena.modes[index].cached_variants = Some(cached);
		}
		if let Some(cached) = self.arena.modes[index].cached_variants.clone() {
			return cached;
		}
		if self.dependency_on_parent(index) {
			let clone = self.arena.inherit(index, &[]);
			if let Some(starts) = self.arena.modes[clone].starts {
				let starts_clone = self.arena.inherit(starts, &[]);
				self.arena.modes[clone].starts = Some(starts_clone);
			}
			return vec![clone];
		}
		vec![index]
	}

	fn dependency_on_parent(&self, index: usize) -> bool {
		let mode = &self.arena.modes[index];
		if mode.ends_with_parent {
			return true;
		}
		mode.starts
			.map(|starts| self.dependency_on_parent(starts))
			.unwrap_or(false)
	}
}

/// `remapScopeNames` result.
struct Remapped {
	positions: Vec<(usize, String)>,
}

impl Remapped {
	fn positions_as_map(&self) -> HashMap<usize, String> {
		self.positions.iter().cloned().collect()
	}
}

fn remap_scope_positions(scope: &HashMap<usize, String>, regexes: &[&str]) -> Remapped {
	// `remapScopeNames` marks EVERY rule position for emission (`_emit`),
	// scoped or not — unscoped groups are emitted as plain text through
	// keyword processing. Unscoped entries carry an empty name here.
	let mut offset = 0;
	let mut positions = Vec::new();
	for (i, regex) in regexes.iter().enumerate() {
		let position = i + 1;
		let name = scope.get(&position).cloned().unwrap_or_default();
		positions.push((position + offset, name));
		offset += count_capture_groups(regex);
	}
	Remapped { positions }
}

fn compile_scope(scope: &Option<ScopeValue>) -> Option<CompiledScope> {
	match scope {
		Some(ScopeValue::Name(name)) if name.is_empty() => None,
		Some(ScopeValue::Null) => None,
		Some(ScopeValue::Name(name)) => Some(CompiledScope::Wrap(name.clone())),
		Some(ScopeValue::Multi(map)) => {
			let mut emit: Vec<usize> = map.keys().copied().collect();
			emit.sort_unstable();
			Some(CompiledScope::Multi(MultiScope {
				positions: map.clone(),
				emit,
			}))
		}
		None => None,
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::engine;
	use crate::tree::HlNode;

	fn compile_json(json: &str) -> CompiledLanguage {
		Compiler::compile(WorkingArena::from_json(json), "synthetic")
	}

	fn spans(nodes: &[HlNode]) -> String {
		let mut out = String::new();
		for node in nodes {
			match node {
				HlNode::Text(value) => out.push_str(value),
				HlNode::Span {
					class_names,
					children,
				} => {
					out.push_str(&format!("<{}>", class_names.join(" ")));
					out.push_str(&spans(children));
					out.push_str("</>");
				}
			}
		}
		out
	}

	fn flat(nodes: &[HlNode]) -> String {
		let mut out = String::new();
		for node in nodes {
			match node {
				HlNode::Text(value) => out.push_str(value),
				HlNode::Span { children, .. } => out.push_str(&flat(children)),
			}
		}
		out
	}

	#[test]
	fn lang_flags_appends_global() {
		let compiler = Compiler {
			arena: WorkingArena { modes: Vec::new() },
			compiled: Vec::new(),
			cache: HashMap::default(),
			begin_sources: HashMap::default(),
			terminator_ends: HashMap::default(),
			case_insensitive: true,
			unicode_regex: false,
		};
		assert_eq!(compiler.lang_flags(true), "mig");
		assert_eq!(compiler.lang_flags(false), "mi");
	}

	#[test]
	fn end_arrays_concatenate() {
		let language = compile_json(
			r#"[{"contains":[{"$ref":1}]},
			    {"scope":"strong","begin":"a","end":["b","(c)"]}]"#,
		);
		let result = engine::highlight(&language, "a xbc y", None);
		assert_eq!(flat(&result.root), "a xbc y");
		assert_eq!(spans(&result.root), "<hljs-strong>a xbc</> y");
	}

	#[test]
	fn keyword_pattern_object_with_flags() {
		let language = compile_json(
			r#"[{"keywords":{"$pattern":{"$re":"[a-z]+","$flags":"s"},"keyword":"kw"}}]"#,
		);
		let result = engine::highlight(&language, "kw other", None);
		assert_eq!(spans(&result.root), "<hljs-keyword>kw</> other");

		// The same object form without $flags.
		let language =
			compile_json(r#"[{"keywords":{"$pattern":{"$re":"[a-z]+"},"keyword":"kw"}}]"#);
		let result = engine::highlight(&language, "kw", None);
		assert_eq!(spans(&result.root), "<hljs-keyword>kw</>");

		// A $pattern of an unexpected type falls back to \w+.
		let language = compile_json(r#"[{"keywords":{"$pattern":true,"keyword":"kw"}}]"#);
		let result = engine::highlight(&language, "kw!", None);
		assert_eq!(spans(&result.root), "<hljs-keyword>kw</>!");
	}

	#[test]
	fn rewrite_backreferences_renumbers() {
		assert_eq!(
			rewrite_backreferences(&[r"(a)\1", r"(b)\1"], "|"),
			r"((a)\2)|((b)\4)"
		);
	}

	#[test]
	fn keywords_of_unexpected_type_are_ignored() {
		let language = compile_json(r#"[{"keywords":true}]"#);
		let result = engine::highlight(&language, "x y", None);
		assert_eq!(spans(&result.root), "x y");
	}

	#[test]
	fn ends_with_parent_of_root_keeps_own_terminator() {
		// The root has no terminator, so the child's endsWithParent merge
		// finds an empty parent terminator and keeps its own end.
		let language = compile_json(
			r#"[{"contains":[{"$ref":1}]},
			    {"scope":"strong","begin":"a","end":"b","endsWithParent":true}]"#,
		);
		let result = engine::highlight(&language, "xab y", None);
		assert_eq!(spans(&result.root), "x<hljs-strong>ab</> y");
	}

	#[test]
	fn ends_with_parent_merges_parent_terminator() {
		let language = compile_json(
			r#"[{"contains":[{"$ref":1}]},
			    {"scope":"strong","begin":"a","end":"b","contains":[{"$ref":2}]},
			    {"scope":"emphasis","begin":"c","end":"d","endsWithParent":true}]"#,
		);
		// The inner mode ends at its own `d`…
		let result = engine::highlight(&language, "acdb", None);
		assert_eq!(
			spans(&result.root),
			"<hljs-strong>a<hljs-emphasis>cd</>b</>"
		);
		// …or at the parent's `b`, which pops both modes.
		let result = engine::highlight(&language, "ac b", None);
		assert_eq!(
			spans(&result.root),
			"<hljs-strong>a<hljs-emphasis>c b</></>"
		);
	}

	#[test]
	fn sub_language_of_unexpected_type_is_none() {
		let language = compile_json(
			r#"[{"contains":[{"$ref":1}]},
			    {"begin":"a","end":"b","subLanguage":true}]"#,
		);
		let child = language.modes[language.root].contains[0];
		assert!(language.modes[child].sub_language.is_none());
		let result = engine::highlight(&language, "a x b", None);
		assert_eq!(spans(&result.root), "a x b");
	}

	#[test]
	fn end_multi_class_scopes() {
		let language = compile_json(
			r#"[{"contains":[{"$ref":1}]},
			    {"scope":"strong","begin":"q","end":["(x)","(y)"],
			     "endScope":{"1":"title","2":"literal"}}]"#,
		);
		let result = engine::highlight(&language, "q xy.", None);
		assert_eq!(flat(&result.root), "q xy.");
		assert_eq!(
			spans(&result.root),
			"<hljs-strong>q <hljs-title>x</><hljs-literal>y</></>."
		);
	}

	#[test]
	fn before_match_wraps_the_inner_mode() {
		let language = compile_json(
			r#"[{"contains":[{"$ref":1}]},
			    {"scope":"strong","beforeMatch":"x","begin":"y"}]"#,
		);
		let result = engine::highlight(&language, "a xy b", None);
		assert_eq!(flat(&result.root), "a xy b");
		assert_eq!(spans(&result.root), "a x<hljs-strong>y</> b");
	}

	#[test]
	fn begin_scope_null_is_cleared() {
		let language = compile_json(
			r#"[{"contains":[{"$ref":1}]},
			    {"begin":"a","end":"b","beginScope":null}]"#,
		);
		let child = language.modes[language.root].contains[0];
		assert!(language.modes[child].begin_scope.is_none());
	}
}

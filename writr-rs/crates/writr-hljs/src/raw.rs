//! Grammar loading: the JSON arenas produced by `tools/gen-hljs-grammars.mjs`
//! become a mutable working-mode arena that the compiler transforms exactly
//! like hljs's `compileMode` (which mutates its input).

use serde_json::Value;
// FxHashMap throughout the grammar structures (see engine.rs).
use rustc_hash::FxHashMap as HashMap;

/// A regex reference: JS source + flags (grammar strings carry no flags).
#[derive(Debug, Clone, PartialEq)]
pub struct ReSpec {
	pub source: String,
	pub flags: String,
}

impl ReSpec {
	pub fn literal(source: &str) -> Self {
		Self {
			source: source.to_string(),
			flags: String::new(),
		}
	}
}

/// `begin`/`end` may be one regex or (MultiClass) a list.
#[derive(Debug, Clone, PartialEq)]
pub enum ReValue {
	One(ReSpec),
	Many(Vec<ReSpec>),
}

/// Scope: plain name, (MultiClass) a group-number map, or an explicit
/// `null` (a variant override clearing an inherited className).
#[derive(Debug, Clone, PartialEq)]
pub enum ScopeValue {
	Name(String),
	Multi(HashMap<usize, String>),
	Null,
}

/// Grammar callbacks (canonical ids from the extractor).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Callback {
	ShebangBegin,
	EndSameAsBeginBegin,
	EndSameAsBeginEnd,
	PhpHeredocBegin,
	JsIsTrulyOpeningTag,
	/// Internal `__beforeBegin` wired by the `beginKeywords` extension.
	SkipIfHasPrecedingDot,
}

fn callback_from_id(id: &str) -> Callback {
	match id {
		"shebang-begin" => Callback::ShebangBegin,
		"end-same-as-begin:begin" => Callback::EndSameAsBeginBegin,
		"end-same-as-begin:end" => Callback::EndSameAsBeginEnd,
		"php-heredoc-begin" => Callback::PhpHeredocBegin,
		"js-is-truly-opening-tag" => Callback::JsIsTrulyOpeningTag,
		other => panic!("unknown grammar callback id: {other}"),
	}
}

/// A `contains` entry: `'self'` or a mode reference.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Contained {
	SelfRef,
	Mode(usize),
}

/// A mutable mode being compiled (mirror of the hljs raw mode object).
#[derive(Debug, Clone, Default)]
pub struct WorkingMode {
	pub scope: Option<ScopeValue>,
	pub class_name: Option<ScopeValue>,
	pub begin: Option<ReValue>,
	pub end: Option<ReValue>,
	pub match_: Option<ReValue>,
	pub before_match: Option<ReSpec>,
	pub begin_scope: Option<ScopeValue>,
	pub end_scope: Option<ScopeValue>,
	pub begin_keywords: Option<String>,
	pub keywords: Option<Value>,
	pub illegal: Option<Vec<ReSpec>>,
	pub contains: Vec<Contained>,
	pub variants: Option<Vec<usize>>,
	pub starts: Option<usize>,
	pub sub_language: Option<Value>,
	pub relevance: Option<f64>,
	pub skip: bool,
	pub exclude_begin: bool,
	pub exclude_end: bool,
	pub return_begin: bool,
	pub return_end: bool,
	pub ends_with_parent: bool,
	pub ends_parent: bool,
	pub on_begin: Option<Callback>,
	pub on_end: Option<Callback>,
	pub before_begin: Option<Callback>,
	// Compilation state:
	pub is_compiled: bool,
	pub cached_variants: Option<Vec<usize>>,
	// Language-root fields:
	pub name: Option<String>,
	pub aliases: Vec<String>,
	pub case_insensitive: bool,
	pub unicode_regex: bool,
	pub class_name_aliases: HashMap<String, String>,
}

/// The working arena for one grammar.
pub struct WorkingArena {
	pub modes: Vec<WorkingMode>,
}

impl WorkingArena {
	/// Parse a grammar JSON arena (entry 0 is the language root).
	pub fn from_json(json: &str) -> Self {
		let objects: Vec<Value> = serde_json::from_str(json).expect("valid grammar json");
		let modes = objects
			.iter()
			.map(|object| parse_mode(object, &objects))
			.collect();
		Self { modes }
	}

	/// Shallow-merge clone (`inherit`): base fields, then overrides.
	pub fn inherit(&mut self, base: usize, overrides: &[usize]) -> usize {
		let mut mode = self.modes[base].clone();
		mode.is_compiled = false;
		mode.cached_variants = None;
		for &over in overrides {
			merge_into(&mut mode, &self.modes[over].clone());
		}
		self.modes.push(mode);
		self.modes.len() - 1
	}

	pub fn push(&mut self, mode: WorkingMode) -> usize {
		self.modes.push(mode);
		self.modes.len() - 1
	}
}

/// Field-wise shallow merge used by `inherit` for variant expansion. In JS
/// this is object-key based; here every serialized field is merged when the
/// override carries it. `variants: null` in overrides clears variants.
fn merge_into(target: &mut WorkingMode, over: &WorkingMode) {
	macro_rules! take {
		($field:ident) => {
			if over.$field.is_some() {
				target.$field = over.$field.clone();
			}
		};
	}
	take!(scope);
	take!(class_name);
	take!(begin);
	take!(end);
	take!(match_);
	take!(before_match);
	take!(begin_scope);
	take!(end_scope);
	take!(begin_keywords);
	take!(keywords);
	take!(illegal);
	take!(sub_language);
	take!(relevance);
	take!(on_begin);
	take!(on_end);
	if !over.contains.is_empty() {
		target.contains = over.contains.clone();
	}
	if over.starts.is_some() {
		target.starts = over.starts;
	}
	if over.skip {
		target.skip = true;
	}
	if over.exclude_begin {
		target.exclude_begin = true;
	}
	if over.exclude_end {
		target.exclude_end = true;
	}
	if over.return_begin {
		target.return_begin = true;
	}
	if over.return_end {
		target.return_end = true;
	}
	if over.ends_with_parent {
		target.ends_with_parent = true;
	}
	if over.ends_parent {
		target.ends_parent = true;
	}
	// `variants: null` clears; a present list replaces.
	target.variants = over.variants.clone();
}

fn as_re(value: &Value) -> Option<ReSpec> {
	match value {
		Value::String(source) => Some(ReSpec::literal(source)),
		Value::Object(map) => {
			let source = map.get("$re")?.as_str()?.to_string();
			let flags = map
				.get("$flags")
				.and_then(Value::as_str)
				.unwrap_or("")
				.to_string();
			Some(ReSpec { source, flags })
		}
		_ => None,
	}
}

fn as_re_value(value: &Value) -> Option<ReValue> {
	match value {
		Value::Array(items) => Some(ReValue::Many(items.iter().filter_map(as_re).collect())),
		other => as_re(other).map(ReValue::One),
	}
}

fn as_scope(value: &Value) -> Option<ScopeValue> {
	match value {
		Value::Null => Some(ScopeValue::Null),
		Value::String(name) => Some(ScopeValue::Name(name.clone())),
		Value::Object(map) if !map.contains_key("$re") => {
			let mut multi = HashMap::default();
			for (key, name) in map {
				if let (Ok(position), Some(name)) = (key.parse::<usize>(), name.as_str()) {
					multi.insert(position, name.to_string());
				}
			}
			Some(ScopeValue::Multi(multi))
		}
		_ => None,
	}
}

fn as_ref(value: &Value) -> Option<usize> {
	value
		.as_object()?
		.get("$ref")?
		.as_u64()
		.map(|index| index as usize)
}

/// Follow a `$ref` one level (the extractor flattens every plain object
/// into the arena — including keywords/scope/alias maps, not just modes).
fn resolve<'a>(objects: &'a [Value], value: &'a Value) -> &'a Value {
	match as_ref(value) {
		Some(index) => &objects[index],
		None => value,
	}
}

/// Deep-resolve `$ref`s inside a (small) value — used for `keywords`, whose
/// object shell is flattened but whose contents must be self-contained.
fn resolve_deep(objects: &[Value], value: &Value) -> Value {
	match value {
		Value::Object(map) => {
			if let Some(index) = as_ref(value) {
				return resolve_deep(objects, &objects[index]);
			}
			let _ = map;
			Value::Object(
				value
					.as_object()
					.unwrap()
					.iter()
					.map(|(k, v)| (k.clone(), resolve_deep(objects, v)))
					.collect(),
			)
		}
		Value::Array(items) => Value::Array(
			items
				.iter()
				.map(|item| resolve_deep(objects, item))
				.collect(),
		),
		other => other.clone(),
	}
}

fn parse_mode(object: &Value, objects: &[Value]) -> WorkingMode {
	let mut mode = WorkingMode::default();
	let Some(map) = object.as_object() else {
		return mode;
	};
	for (key, value) in map {
		match key.as_str() {
			"scope" => mode.scope = as_scope(resolve(objects, value)),
			"className" => mode.class_name = as_scope(resolve(objects, value)),
			"begin" => mode.begin = as_re_value(value),
			"end" => mode.end = as_re_value(value),
			"match" => mode.match_ = as_re_value(value),
			"beforeMatch" => mode.before_match = as_re(value),
			"beginScope" => mode.begin_scope = as_scope(resolve(objects, value)),
			"endScope" => mode.end_scope = as_scope(resolve(objects, value)),
			"beginKeywords" => {
				mode.begin_keywords = value.as_str().map(str::to_string);
			}
			"keywords" => mode.keywords = Some(resolve_deep(objects, value)),
			"illegal" => {
				mode.illegal = match value {
					Value::Array(items) => Some(items.iter().filter_map(as_re).collect()),
					other => as_re(other).map(|re| vec![re]),
				};
			}
			"contains" => {
				// Entries may be nested arrays — hljs's compiler flattens
				// them via `[].concat(...contains)`.
				fn collect(items: &[Value], out: &mut Vec<Contained>) {
					for item in items {
						match item {
							Value::String(s) if s == "self" => out.push(Contained::SelfRef),
							Value::Array(nested) => collect(nested, out),
							other => {
								if let Some(index) = as_ref(other) {
									out.push(Contained::Mode(index));
								}
							}
						}
					}
				}
				let mut entries = Vec::new();
				if let Some(items) = value.as_array() {
					collect(items, &mut entries);
				}
				mode.contains = entries;
			}
			"variants" => {
				mode.variants = value
					.as_array()
					.map(|items| items.iter().filter_map(as_ref).collect());
			}
			"starts" => mode.starts = as_ref(value),
			"subLanguage" => mode.sub_language = Some(value.clone()),
			"relevance" => mode.relevance = value.as_f64(),
			"skip" => mode.skip = value.as_bool().unwrap_or(false),
			"excludeBegin" => mode.exclude_begin = value.as_bool().unwrap_or(false),
			"excludeEnd" => mode.exclude_end = value.as_bool().unwrap_or(false),
			"returnBegin" => mode.return_begin = value.as_bool().unwrap_or(false),
			"returnEnd" => mode.return_end = value.as_bool().unwrap_or(false),
			"endsWithParent" => mode.ends_with_parent = value.as_bool().unwrap_or(false),
			"endsParent" => mode.ends_parent = value.as_bool().unwrap_or(false),
			"on:begin" => {
				mode.on_begin = value
					.as_object()
					.and_then(|m| m.get("$callback"))
					.and_then(Value::as_str)
					.map(callback_from_id);
			}
			"on:end" => {
				mode.on_end = value
					.as_object()
					.and_then(|m| m.get("$callback"))
					.and_then(Value::as_str)
					.map(callback_from_id);
			}
			"name" => mode.name = value.as_str().map(str::to_string),
			"aliases" => {
				mode.aliases = value
					.as_array()
					.map(|items| {
						items
							.iter()
							.filter_map(Value::as_str)
							.map(str::to_string)
							.collect()
					})
					.unwrap_or_default();
			}
			"case_insensitive" => {
				mode.case_insensitive = value.as_bool().unwrap_or(false);
			}
			"unicodeRegex" => mode.unicode_regex = value.as_bool().unwrap_or(false),
			"classNameAliases" => {
				if let Some(map) = resolve(objects, value).as_object() {
					for (alias, target) in map {
						if let Some(target) = target.as_str() {
							mode.class_name_aliases
								.insert(alias.clone(), target.to_string());
						}
					}
				}
			}
			// Ignored: label, disableAutodetect, exports, keywords handled
			// above, compilerExtensions (none in the common set).
			_ => {}
		}
	}
	mode
}

#[cfg(test)]
mod tests {
	use super::*;
	use serde_json::json;

	#[test]
	#[should_panic(expected = "unknown grammar callback id")]
	fn unknown_callback_panics() {
		callback_from_id("no-such-callback");
	}

	#[test]
	fn inherit_merges_flags_and_starts() {
		let over = WorkingMode {
			starts: Some(0),
			skip: true,
			exclude_begin: true,
			exclude_end: true,
			return_begin: true,
			return_end: true,
			ends_with_parent: true,
			ends_parent: true,
			..WorkingMode::default()
		};
		let mut arena = WorkingArena {
			modes: vec![WorkingMode::default(), over],
		};
		let merged = arena.inherit(0, &[1]);
		let mode = &arena.modes[merged];
		assert_eq!(mode.starts, Some(0));
		assert!(mode.skip && mode.exclude_begin && mode.exclude_end);
		assert!(mode.return_begin && mode.return_end);
		assert!(mode.ends_with_parent && mode.ends_parent);
		assert!(!mode.is_compiled);
	}

	#[test]
	fn scope_values_reject_unexpected_shapes() {
		assert_eq!(as_scope(&json!(5)), None);
		assert_eq!(as_scope(&json!({"$re": "x"})), None);
		assert_eq!(as_scope(&json!(null)), Some(ScopeValue::Null));
	}

	#[test]
	fn illegal_arrays_and_nested_contains_parse() {
		let arena = WorkingArena::from_json(
			r#"[{"illegal":["x","y"],"contains":[[{"$ref":1}],"self"]},
			    {"begin":"a"}]"#,
		);
		assert_eq!(arena.modes[0].illegal.as_ref().map(Vec::len), Some(2));
		assert_eq!(
			arena.modes[0].contains,
			vec![Contained::Mode(1), Contained::SelfRef]
		);
	}

	#[test]
	fn non_object_arena_entries_become_default_modes() {
		let arena = WorkingArena::from_json(r#"[{"name":"t"},"stray-string"]"#);
		assert!(arena.modes[1].begin.is_none());
		assert!(arena.modes[1].name.is_none());
	}

	#[test]
	fn class_name_aliases_ignore_unexpected_shapes() {
		let arena = WorkingArena::from_json(
			r#"[{"classNameAliases": 5},
			    {"classNameAliases": {"good": "keyword", "bad": 7}}]"#,
		);
		assert!(arena.modes[0].class_name_aliases.is_empty());
		assert_eq!(
			arena.modes[1]
				.class_name_aliases
				.get("good")
				.map(String::as_str),
			Some("keyword")
		);
		assert!(!arena.modes[1].class_name_aliases.contains_key("bad"));
	}
}

//! Language registry — lowlight@3.3.0's `common` set, with hljs alias
//! resolution (lowercased lookup, grammar-declared aliases).

use crate::compile::{CompiledLanguage, Compiler};
use crate::raw::WorkingArena;
use std::collections::HashMap;
use std::sync::OnceLock;

macro_rules! grammars {
	($(($name:literal, $file:literal)),+ $(,)?) => {
		&[$(($name, include_str!(concat!("../grammars/", $file)))),+]
	};
}

/// `(canonical name, grammar json)` for every registered language.
static GRAMMARS: &[(&str, &str)] = grammars![
	("bash", "bash.json"),
	("c", "c.json"),
	("cpp", "cpp.json"),
	("csharp", "csharp.json"),
	("css", "css.json"),
	("diff", "diff.json"),
	("go", "go.json"),
	("graphql", "graphql.json"),
	("ini", "ini.json"),
	("java", "java.json"),
	("javascript", "javascript.json"),
	("json", "json.json"),
	("kotlin", "kotlin.json"),
	("less", "less.json"),
	("lua", "lua.json"),
	("makefile", "makefile.json"),
	("markdown", "markdown.json"),
	("objectivec", "objectivec.json"),
	("perl", "perl.json"),
	("php", "php.json"),
	("php-template", "php-template.json"),
	("plaintext", "plaintext.json"),
	("python", "python.json"),
	("python-repl", "python-repl.json"),
	("r", "r.json"),
	("ruby", "ruby.json"),
	("rust", "rust.json"),
	("scss", "scss.json"),
	("shell", "shell.json"),
	("sql", "sql.json"),
	("swift", "swift.json"),
	("typescript", "typescript.json"),
	("vbnet", "vbnet.json"),
	("wasm", "wasm.json"),
	("xml", "xml.json"),
	("yaml", "yaml.json"),
];

struct Entry {
	name: &'static str,
	json: &'static str,
	compiled: OnceLock<CompiledLanguage>,
}

struct Registry {
	entries: Vec<Entry>,
	/// lowercased name/alias → entry index.
	lookup: HashMap<String, usize>,
}

fn registry() -> &'static Registry {
	static REGISTRY: OnceLock<Registry> = OnceLock::new();
	REGISTRY.get_or_init(|| {
		let mut entries = Vec::with_capacity(GRAMMARS.len());
		let mut lookup = HashMap::new();
		for (index, (name, json)) in GRAMMARS.iter().enumerate() {
			lookup.insert(name.to_lowercase(), index);
			// Aliases live in the root object of the arena; parse just that
			// field cheaply.
			let arena: Vec<serde_json::Value> =
				serde_json::from_str(json).expect("valid grammar json");
			if let Some(aliases) = arena[0].get("aliases").and_then(|v| v.as_array()) {
				for alias in aliases.iter().filter_map(|a| a.as_str()) {
					lookup.entry(alias.to_lowercase()).or_insert(index);
				}
			}
			entries.push(Entry {
				name,
				json,
				compiled: OnceLock::new(),
			});
		}
		Registry { entries, lookup }
	})
}

/// hljs `getLanguage`: lowercased name or alias.
pub fn get(name: &str) -> Option<&'static CompiledLanguage> {
	let registry = registry();
	let index = *registry.lookup.get(&name.to_lowercase())?;
	let entry = &registry.entries[index];
	Some(entry.compiled.get_or_init(|| {
		Compiler::compile(WorkingArena::from_json(entry.json), entry.name)
	}))
}

/// `lowlight.registered`.
pub fn registered(name: &str) -> bool {
	registry().lookup.contains_key(&name.to_lowercase())
}

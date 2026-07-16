//! Shared harness plumbing for the conformance tests: profile definitions
//! mirroring `test/harness/profiles.ts`, the `normalize()` port, allowlist
//! loading, and golden discovery.

use serde::Deserialize;
use std::path::{Path, PathBuf};
use writr_core::RenderOptions;

/// A named render profile — must stay in lockstep with
/// `test/harness/profiles.ts` (the TS side is the source of truth).
#[derive(Debug, Clone, Copy)]
pub struct Profile {
	pub name: &'static str,
	pub options: RenderOptions,
}

/// The seven harness profiles.
pub const PROFILES: &[Profile] = &[
	Profile {
		name: "default",
		options: RenderOptions {
			emoji: true,
			toc: true,
			slug: true,
			highlight: true,
			gfm: true,
			math: true,
			mdx: false,
			raw_html: false,
		},
	},
	Profile {
		name: "commonmark",
		options: RenderOptions {
			emoji: false,
			toc: false,
			slug: false,
			highlight: false,
			gfm: false,
			math: false,
			mdx: false,
			raw_html: false,
		},
	},
	Profile {
		name: "gfm-only",
		options: RenderOptions {
			emoji: false,
			toc: false,
			slug: false,
			highlight: false,
			gfm: true,
			math: false,
			mdx: false,
			raw_html: false,
		},
	},
	Profile {
		name: "no-highlight",
		options: RenderOptions {
			emoji: true,
			toc: true,
			slug: true,
			highlight: false,
			gfm: true,
			math: true,
			mdx: false,
			raw_html: false,
		},
	},
	Profile {
		name: "no-math",
		options: RenderOptions {
			emoji: true,
			toc: true,
			slug: true,
			highlight: true,
			gfm: true,
			math: false,
			mdx: false,
			raw_html: false,
		},
	},
	Profile {
		name: "rawhtml",
		options: RenderOptions {
			emoji: true,
			toc: true,
			slug: true,
			highlight: true,
			gfm: true,
			math: true,
			mdx: false,
			raw_html: true,
		},
	},
	Profile {
		name: "mdx",
		options: RenderOptions {
			emoji: true,
			toc: true,
			slug: true,
			highlight: true,
			gfm: true,
			math: true,
			mdx: true,
			raw_html: false,
		},
	},
];

/// Look up a profile by name.
pub fn profile(name: &str) -> Option<&'static Profile> {
	PROFILES.iter().find(|profile| profile.name == name)
}

/// Locate `test/harness` (override with `WRITR_HARNESS_DIR`).
pub fn harness_dir() -> PathBuf {
	if let Ok(dir) = std::env::var("WRITR_HARNESS_DIR") {
		return PathBuf::from(dir);
	}
	Path::new(env!("CARGO_MANIFEST_DIR"))
		.join("../../../test/harness")
		.canonicalize()
		.expect("test/harness directory exists next to writr-rs")
}

/// Port of `test/harness/normalize.ts`: CRLF/CR → LF, strip trailing
/// space/tab per line, exactly one trailing newline (or empty).
pub fn normalize(html: &str) -> String {
	let unified = html.replace("\r\n", "\n").replace('\r', "\n");
	let mut lines: Vec<&str> = unified
		.split('\n')
		.map(|line| line.trim_end_matches([' ', '\t']))
		.collect();
	while lines.last() == Some(&"") {
		lines.pop();
	}
	if lines.is_empty() {
		String::new()
	} else {
		let mut result = lines.join("\n");
		result.push('\n');
		result
	}
}

#[derive(Debug, Deserialize)]
pub struct Allowlist {
	pub entries: Vec<AllowlistEntry>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AllowlistEntry {
	pub engine: String,
	pub profile: String,
	pub id: String,
	pub reason: String,
	#[serde(default)]
	pub approved_by: Option<String>,
	#[serde(default)]
	pub date: Option<String>,
}

/// Load `allowlist.json` (missing file → empty).
pub fn load_allowlist(harness: &Path) -> Allowlist {
	let path = harness.join("allowlist.json");
	let Ok(raw) = std::fs::read_to_string(path) else {
		return Allowlist {
			entries: Vec::new(),
		};
	};
	serde_json::from_str(&raw).unwrap_or(Allowlist {
		entries: Vec::new(),
	})
}

impl Allowlist {
	/// Match an entry for `engine`/`profile`/`id` (`*` wildcards allowed).
	pub fn matches(&self, engine: &str, profile: &str, id: &str) -> Option<&AllowlistEntry> {
		self.entries.iter().find(|entry| {
			entry.engine == engine
				&& (entry.profile == "*" || entry.profile == profile)
				&& (entry.id == "*" || entry.id == id)
		})
	}
}

/// A discovered golden file.
#[derive(Debug)]
pub struct Golden {
	pub profile: String,
	/// Corpus id (`commonmark/0042`) or diagnostic id (`feature/name`).
	pub id: String,
	pub input_path: PathBuf,
	pub golden_path: PathBuf,
}

fn walk(dir: &Path, out: &mut Vec<PathBuf>) {
	let Ok(entries) = std::fs::read_dir(dir) else {
		return;
	};
	let mut entries: Vec<_> = entries.flatten().collect();
	entries.sort_by_key(std::fs::DirEntry::path);
	for entry in entries {
		let path = entry.path();
		if path.is_dir() {
			walk(&path, out);
		} else if path.extension().is_some_and(|ext| ext == "html") {
			out.push(path);
		}
	}
}

/// Every corpus golden for a profile.
pub fn corpus_goldens(harness: &Path, profile_name: &str) -> Vec<Golden> {
	let root = harness.join("goldens").join(profile_name);
	let mut files = Vec::new();
	walk(&root, &mut files);
	files
		.into_iter()
		.map(|golden_path| {
			let id = golden_path
				.strip_prefix(&root)
				.expect("under root")
				.with_extension("")
				.to_string_lossy()
				.replace('\\', "/");
			let input_path = harness.join("corpus/inputs").join(format!("{id}.md"));
			Golden {
				profile: profile_name.to_string(),
				id,
				input_path,
				golden_path,
			}
		})
		.collect()
}

/// Every diagnostic golden for a profile (inputs may be `.md` or `.mdx`).
pub fn diagnostic_goldens(harness: &Path, profile_name: &str) -> Vec<Golden> {
	let root = harness.join("diagnostics-goldens").join(profile_name);
	let mut files = Vec::new();
	walk(&root, &mut files);
	files
		.into_iter()
		.map(|golden_path| {
			let id = golden_path
				.strip_prefix(&root)
				.expect("under root")
				.with_extension("")
				.to_string_lossy()
				.replace('\\', "/");
			let md = harness.join("diagnostics").join(format!("{id}.md"));
			let input_path = if md.exists() {
				md
			} else {
				harness.join("diagnostics").join(format!("{id}.mdx"))
			};
			Golden {
				profile: profile_name.to_string(),
				id,
				input_path,
				golden_path,
			}
		})
		.collect()
}

/// First line/column where two strings diverge, with context — the Rust
/// analogue of the harness `diff.ts` first-divergence report.
pub fn first_divergence(expected: &str, actual: &str) -> String {
	let expected_lines: Vec<&str> = expected.split('\n').collect();
	let actual_lines: Vec<&str> = actual.split('\n').collect();
	for (index, (want, got)) in expected_lines.iter().zip(actual_lines.iter()).enumerate() {
		if want != got {
			let col = want
				.chars()
				.zip(got.chars())
				.take_while(|(a, b)| a == b)
				.count();
			return format!(
				"first divergence at line {}, col {}:\n  expected: {}\n  actual:   {}",
				index + 1,
				col + 1,
				want,
				got
			);
		}
	}
	format!(
		"line counts differ: expected {} lines, actual {} lines\n  expected tail: {:?}\n  actual tail:   {:?}",
		expected_lines.len(),
		actual_lines.len(),
		expected_lines.get(actual_lines.len().min(expected_lines.len()).saturating_sub(1)),
		actual_lines.get(expected_lines.len().min(actual_lines.len()).saturating_sub(1)),
	)
}

/// Render an input under a profile and compare against its golden.
/// Returns `None` on a byte-exact match, `Some(report)` otherwise.
pub fn check(golden: &Golden, options: &RenderOptions) -> Option<String> {
	let input = std::fs::read_to_string(&golden.input_path)
		.unwrap_or_else(|error| panic!("read {}: {error}", golden.input_path.display()));
	let expected_raw = std::fs::read_to_string(&golden.golden_path)
		.unwrap_or_else(|error| panic!("read {}: {error}", golden.golden_path.display()));
	let expected = normalize(&expected_raw);
	match writr_core::render(&input, options) {
		Ok(html) => {
			let actual = normalize(&html);
			if actual == expected {
				None
			} else {
				Some(format!(
					"[{}/{}] {}",
					golden.profile,
					golden.id,
					first_divergence(&expected, &actual)
				))
			}
		}
		Err(error) => Some(format!(
			"[{}/{}] render error: {error}",
			golden.profile, golden.id
		)),
	}
}

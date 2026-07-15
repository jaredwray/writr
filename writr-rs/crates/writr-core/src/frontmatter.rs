//! Byte-exact port of writr's front-matter stripping (src/writr.ts:154-183).
//!
//! Writr strips front matter *before* the unified pipeline ever sees the
//! content, via its `body` getter:
//!
//! ```js
//! // frontMatterRaw:
//! if (!content.trimStart().startsWith("---")) return "";
//! const match = /^\s*(---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$))/.exec(content);
//! return match ? match[1] : "";
//! // body:
//! if (frontMatter === "") return content;
//! return content.slice(content.indexOf(frontMatter) + frontMatter.length).trim();
//! ```
//!
//! Two load-bearing quirks are preserved: the body is `.trim()`ed **only when
//! front matter was present**, and `\s`/`trim` use the JS whitespace set.

use crate::js;

/// The front-matter block including its `---` delimiters (and trailing
/// newline when present), or `""` when the content has none.
pub fn front_matter_raw(content: &str) -> &str {
	if !js::trim_start(content).starts_with("---") {
		return "";
	}

	// `^\s*` — greedy, but the next required char `-` is not `\s`, so this is
	// exactly the JS-whitespace prefix.
	let start = content.len() - js::trim_start(content).len();
	let rest = &content[start..];
	let Some(after_open) = rest.strip_prefix("---") else {
		return "";
	};

	// `---\r?\n` — the opening line is exactly three dashes.
	let open_len = if after_open.starts_with("\r\n") {
		5
	} else if after_open.starts_with('\n') {
		4
	} else {
		return "";
	};

	// `[\s\S]*?\r?\n---(?:\r?\n|$)` — lazy: the earliest closing fence wins.
	// Scan for `\n---` followed by `\r\n`, `\n`, or end of input. A `\r`
	// before the `\n` is simply content consumed by `[\s\S]*?`.
	let hay = &content[start + open_len..];
	let bytes = hay.as_bytes();
	let mut from = 0;
	while let Some(offset) = hay[from..].find("\n---") {
		let after = from + offset + 4;
		if after == hay.len() {
			return &content[start..start + open_len + after];
		}
		match bytes[after] {
			b'\n' => return &content[start..start + open_len + after + 1],
			b'\r' if bytes.get(after + 1) == Some(&b'\n') => {
				return &content[start..start + open_len + after + 2];
			}
			_ => {}
		}
		from += offset + 1;
	}

	""
}

/// The markdown body: content minus front matter, JS-trimmed only when front
/// matter was present (matching writr's `body` getter exactly).
pub fn body(content: &str) -> &str {
	let front_matter = front_matter_raw(content);
	if front_matter.is_empty() {
		return content;
	}
	// `content.indexOf(frontMatter)`: everything before the match is JS
	// whitespace and the block starts with `-`, so the first occurrence is
	// the match position itself.
	let start = content.len() - js::trim_start(content).len();
	js::trim(&content[start + front_matter.len()..])
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn no_front_matter_returns_content_untrimmed() {
		assert_eq!(body("  # Hi \n"), "  # Hi \n");
		assert_eq!(front_matter_raw("# Hi"), "");
	}

	#[test]
	fn strips_and_trims_when_present() {
		let content = "---\ntitle: x\n---\n\n# Hi\n";
		assert_eq!(front_matter_raw(content), "---\ntitle: x\n---\n");
		assert_eq!(body(content), "# Hi");
	}

	#[test]
	fn leading_whitespace_allowed() {
		let content = "\n  \n---\na: 1\n---\nBody";
		assert_eq!(front_matter_raw(content), "---\na: 1\n---\n");
		assert_eq!(body(content), "Body");
	}

	#[test]
	fn crlf_delimiters() {
		let content = "---\r\na: 1\r\n---\r\nBody";
		assert_eq!(front_matter_raw(content), "---\r\na: 1\r\n---\r\n");
		assert_eq!(body(content), "Body");
	}

	#[test]
	fn closing_fence_at_eof_without_newline() {
		let content = "---\na: 1\n---";
		assert_eq!(front_matter_raw(content), "---\na: 1\n---");
		assert_eq!(body(content), "");
	}

	#[test]
	fn four_dashes_is_not_front_matter() {
		assert_eq!(front_matter_raw("----\na\n----\n"), "");
	}

	#[test]
	fn unclosed_fence_is_not_front_matter() {
		assert_eq!(front_matter_raw("---\na: 1\n"), "");
		// `---` followed by more dashes is not a closing fence.
		assert_eq!(front_matter_raw("---\na\n----\n"), "");
	}

	#[test]
	fn later_block_is_not_front_matter() {
		let content = "# Title\n\n---\na: 1\n---\n";
		assert_eq!(front_matter_raw(content), "");
		assert_eq!(body(content), content);
	}

	#[test]
	fn earliest_close_wins() {
		let content = "---\na: 1\n---\nrest\n---\n";
		assert_eq!(front_matter_raw(content), "---\na: 1\n---\n");
		assert_eq!(body(content), "rest\n---");
	}

	#[test]
	fn empty_front_matter_body() {
		let content = "---\n\n---\nBody";
		assert_eq!(front_matter_raw(content), "---\n\n---\n");
		assert_eq!(body(content), "Body");
	}

	#[test]
	fn carriage_return_only_at_eof_is_not_a_close() {
		// `---\r` at EOF: `(?:\r?\n|$)` cannot match (the `\r` is neither
		// followed by `\n` nor is the position at end).
		assert_eq!(front_matter_raw("---\na\n---\r"), "");
	}
}

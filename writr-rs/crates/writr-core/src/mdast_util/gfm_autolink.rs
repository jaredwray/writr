//! Port of mdast-util-gfm-autolink-literal@2.0.1's `transforms` — the
//! mdast-level find-and-replace remark-gfm applies at parse time. It catches
//! literal URLs/emails the tokenizer-level construct cannot see (e.g. across
//! character escapes: `<foo\+@bar.example.com>`).

use crate::generated::unicode_data::{UNICODE_PUNCTUATION_RANGES, UNICODE_WHITESPACE_RANGES};
use markdown::mdast;

fn in_ranges(table: &[(u16, u16)], unit: u16) -> bool {
	table
		.binary_search_by(|&(start, end)| {
			if unit < start {
				std::cmp::Ordering::Greater
			} else if unit > end {
				std::cmp::Ordering::Less
			} else {
				std::cmp::Ordering::Equal
			}
		})
		.is_ok()
}

/// `previous(match, email)` — the gate on the character before a match.
/// JS reads a single UTF-16 unit via `charCodeAt`; an astral previous char
/// therefore yields a low surrogate, failing both class checks.
fn previous_ok(input: &str, match_start: usize, email: bool) -> bool {
	if match_start == 0 {
		return true;
	}
	let prev = input[..match_start].chars().next_back().expect("non-empty prefix");
	let code = prev as u32;
	if email && code == 47 {
		return false;
	}
	if code > 0xFFFF {
		// `charCodeAt(index - 1)` sees the low surrogate.
		return false;
	}
	let unit = code as u16;
	in_ranges(UNICODE_WHITESPACE_RANGES, unit) || in_ranges(UNICODE_PUNCTUATION_RANGES, unit)
	// (For emails the slash check above matches JS's `code !== 47`, which
	// applies even though `/` is punctuation.)
}

fn is_word(byte: u8) -> bool {
	byte.is_ascii_alphanumeric() || byte == b'_'
}

/// One find-and-replace match: replacement nodes for `value[start..end]`.
struct Found {
	start: usize,
	end: usize,
	nodes: Vec<mdast::Node>,
}

fn text(value: &str) -> mdast::Node {
	mdast::Node::Text(mdast::Text {
		value: value.to_string(),
		position: None,
	})
}

fn link(url: String, label: &str) -> mdast::Node {
	mdast::Node::Link(mdast::Link {
		children: vec![text(label)],
		position: None,
		url,
		title: None,
	})
}

// ---------------------------------------------------------------------------
// URL pass: /(https?:\/\/|www(?=\.))([-.\w]+)([^ \t\r\n]*)/gi
// ---------------------------------------------------------------------------

fn find_url_match(value: &str, from: usize) -> Option<(usize, usize, usize, usize)> {
	let bytes = value.as_bytes();
	let mut i = from;
	while i < bytes.len() {
		// Alternative 1: `https?://` (case-insensitive).
		let after_protocol = if bytes[i..].len() >= 7
			&& bytes[i..i + 4].eq_ignore_ascii_case(b"http")
		{
			let mut p = i + 4;
			if p < bytes.len() && (bytes[p] | 0x20) == b's' {
				p += 1;
			}
			if bytes[p..].starts_with(b"://") {
				Some(p + 3)
			} else {
				None
			}
		} else {
			None
		};
		// Alternative 2: `www(?=\.)`.
		let www = after_protocol.is_none()
			&& bytes[i..].len() >= 4
			&& bytes[i..i + 3].eq_ignore_ascii_case(b"www")
			&& bytes[i + 3] == b'.';

		if let Some(domain_start) = after_protocol.or(if www { Some(i + 3) } else { None }) {
			// `([-.\w]+)` — at least one.
			let mut d = domain_start;
			while d < bytes.len()
				&& (is_word(bytes[d]) || bytes[d] == b'-' || bytes[d] == b'.')
			{
				d += 1;
			}
			if d > domain_start {
				// `([^ \t\r\n]*)`
				let mut p = d;
				while p < bytes.len() && !matches!(bytes[p], b' ' | b'\t' | b'\r' | b'\n') {
					// Path is byte-oriented in the class; advance one char.
					p += 1;
					while p < bytes.len() && !value.is_char_boundary(p) {
						p += 1;
					}
				}
				return Some((i, domain_start, d, p));
			}
		}
		i += 1;
		while i < bytes.len() && !value.is_char_boundary(i) {
			i += 1;
		}
	}
	None
}

/// `isCorrectDomain`.
fn is_correct_domain(domain: &str) -> bool {
	let parts: Vec<&str> = domain.split('.').collect();
	if parts.len() < 2 {
		return false;
	}
	for part in parts.iter().rev().take(2) {
		if !part.is_empty()
			&& (part.contains('_') || !part.bytes().any(|b| b.is_ascii_alphanumeric()))
		{
			return false;
		}
	}
	true
}

/// `splitUrl`: strip trailing punctuation, rebalancing `)` against `(`.
fn split_url(url: &str) -> (String, Option<String>) {
	const TRAIL: &[u8] = b"!\"&'),.:;<>?]}";
	let bytes = url.as_bytes();
	let mut trail_start = bytes.len();
	while trail_start > 0 && TRAIL.contains(&bytes[trail_start - 1]) {
		trail_start -= 1;
	}
	if trail_start == bytes.len() {
		return (url.to_string(), None);
	}
	let mut kept = url[..trail_start].to_string();
	let mut trail = url[trail_start..].to_string();
	let opening = kept.bytes().filter(|&b| b == b'(').count();
	let mut closing = kept.bytes().filter(|&b| b == b')').count();
	while let Some(paren) = trail.find(')') {
		if opening <= closing {
			break;
		}
		kept.push_str(&trail[..=paren]);
		trail = trail[paren + 1..].to_string();
		closing += 1;
	}
	(kept, if trail.is_empty() { None } else { Some(trail) })
}

fn url_pass(value: &str) -> Option<Vec<Found>> {
	let mut found = Vec::new();
	let mut last_index = 0;
	while let Some((start, domain_start, domain_end, path_end)) =
		find_url_match(value, last_index)
	{
		let mut protocol = &value[start..domain_start];
		let mut domain = value[domain_start..domain_end].to_string();
		let path = &value[domain_end..path_end];
		let mut prefix = "";

		let ok = previous_ok(value, start, false);
		let www = protocol.len() >= 1 && (protocol.as_bytes()[0] | 0x20) == b'w';
		if www {
			domain = format!("{protocol}{domain}");
			protocol = "";
			prefix = "http://";
		}
		if ok && is_correct_domain(&domain) {
			let (kept, trail) = split_url(&format!("{domain}{path}"));
			if !kept.is_empty() {
				let mut nodes = vec![link(
					format!("{prefix}{protocol}{kept}"),
					&format!("{protocol}{kept}"),
				)];
				if let Some(trail) = trail {
					nodes.push(text(&trail));
				}
				found.push(Found {
					start,
					end: path_end,
					nodes,
				});
				last_index = path_end;
				continue;
			}
		}
		// `false` from the replacer: rescan from just past the match start.
		last_index = start + 1;
		while last_index < value.len() && !value.is_char_boundary(last_index) {
			last_index += 1;
		}
	}
	if found.is_empty() {
		None
	} else {
		Some(found)
	}
}

// ---------------------------------------------------------------------------
// Email pass: /(?<=^|\s|\p{P}|\p{S})([-.\w+]+)@([-\w]+(?:\.[-\w]+)+)/gu
// ---------------------------------------------------------------------------

fn find_email_match(value: &str, from: usize) -> Option<(usize, usize, usize)> {
	let bytes = value.as_bytes();
	let mut i = from;
	while i < bytes.len() {
		if is_word(bytes[i]) || matches!(bytes[i], b'-' | b'.' | b'+') {
			// Only try a match at the START of an atext run (the regex is
			// leftmost-first; an interior start would imply the run start
			// also matched or was rejected by the lookbehind — JS handles
			// that by simply failing the lookbehind mid-run; replicate by
			// attempting every position).
			let atext_start = i;
			let mut a = i;
			while a < bytes.len()
				&& (is_word(bytes[a]) || matches!(bytes[a], b'-' | b'.' | b'+'))
			{
				a += 1;
			}
			if a < bytes.len() && bytes[a] == b'@' {
				// Domain: `[-\w]+(?:\.[-\w]+)+`
				let mut d = a + 1;
				let first_start = d;
				while d < bytes.len() && (is_word(bytes[d]) || bytes[d] == b'-') {
					d += 1;
				}
				if d > first_start {
					let mut groups = 0;
					loop {
						if d < bytes.len() && bytes[d] == b'.' {
							let mut g = d + 1;
							while g < bytes.len() && (is_word(bytes[g]) || bytes[g] == b'-') {
								g += 1;
							}
							if g > d + 1 {
								d = g;
								groups += 1;
								continue;
							}
						}
						break;
					}
					if groups > 0 {
						// The lookbehind applies at the atext start.
						if lookbehind_ok(value, atext_start) {
							return Some((atext_start, a, d));
						}
					}
				}
			}
			// No match from this run start: the regex engine advances one
			// position; positions inside the run fail the lookbehind (the
			// previous char is atext — a word char is neither \s nor \p{P}).
			// `-`/`.`/`+` ARE punctuation though, so interior starts after
			// those can match; advance by one, not past the run.
			i += 1;
			continue;
		}
		i += 1;
		while i < bytes.len() && !value.is_char_boundary(i) {
			i += 1;
		}
	}
	None
}

/// The email regex's own lookbehind: `(?<=^|\s|\p{P}|\p{S})` (full
/// codepoint semantics under /u).
fn lookbehind_ok(value: &str, index: usize) -> bool {
	if index == 0 {
		return true;
	}
	let prev = value[..index].chars().next_back().expect("non-empty prefix");
	let code = prev as u32;
	if code > 0xFFFF {
		// Astral punctuation/symbols do satisfy the /u lookbehind — but the
		// `previous()` gate then rejects them via `charCodeAt`; reject here
		// directly (equivalent outcome).
		return false;
	}
	let unit = code as u16;
	in_ranges(UNICODE_WHITESPACE_RANGES, unit) || in_ranges(UNICODE_PUNCTUATION_RANGES, unit)
}

fn email_pass(value: &str) -> Option<Vec<Found>> {
	let mut found = Vec::new();
	let mut last_index = 0;
	while let Some((start, at, end)) = find_email_match(value, last_index) {
		let atext = &value[start..at];
		let label = &value[at + 1..end];
		let label_end_ok = !label
			.as_bytes()
			.last()
			.is_some_and(|b| b.is_ascii_digit() || matches!(b, b'-' | b'_'));
		if previous_ok(value, start, true) && label_end_ok {
			found.push(Found {
				start,
				end,
				nodes: vec![link(
					format!("mailto:{atext}@{label}"),
					&format!("{atext}@{label}"),
				)],
			});
			last_index = end;
		} else {
			last_index = start + 1;
			while last_index < value.len() && !value.is_char_boundary(last_index) {
				last_index += 1;
			}
		}
	}
	if found.is_empty() {
		None
	} else {
		Some(found)
	}
}

// ---------------------------------------------------------------------------
// Tree walking (find-and-replace with ignore: ['link', 'linkReference'])
// ---------------------------------------------------------------------------

fn splice(children: &mut Vec<mdast::Node>, index: usize, value: &str, found: Vec<Found>) -> usize {
	let mut nodes: Vec<mdast::Node> = Vec::new();
	let mut cursor = 0;
	for item in found {
		if item.start > cursor {
			nodes.push(text(&value[cursor..item.start]));
		}
		nodes.extend(item.nodes);
		cursor = item.end;
	}
	if cursor < value.len() {
		nodes.push(text(&value[cursor..]));
	}
	let count = nodes.len();
	children.splice(index..=index, nodes);
	count
}

fn walk(node: &mut mdast::Node, pass: &dyn Fn(&str) -> Option<Vec<Found>>) {
	if matches!(
		node,
		mdast::Node::Link(_) | mdast::Node::LinkReference(_)
	) {
		return;
	}
	let Some(children) = node.children_mut() else {
		return;
	};
	let mut index = 0;
	while index < children.len() {
		if let mdast::Node::Text(node_text) = &children[index] {
			if let Some(found) = pass(&node_text.value) {
				let value = node_text.value.clone();
				index += splice(children, index, &value, found);
				continue;
			}
		}
		walk(&mut children[index], pass);
		index += 1;
	}
}

/// Apply the transform (remark-gfm runs this right after parsing).
pub fn transform(tree: &mut mdast::Node) {
	walk(tree, &url_pass);
	walk(tree, &email_pass);
}

#[cfg(test)]
mod tests {
	use super::*;

	fn render(md: &str) -> String {
		let options = crate::RenderOptions {
			gfm: true,
			..crate::RenderOptions::all_off()
		};
		crate::render(md, &options).unwrap()
	}

	#[test]
	fn links_email_after_escape() {
		assert_eq!(
			render("<foo\\+@bar.example.com>"),
			"<p>&#x3C;<a href=\"mailto:foo+@bar.example.com\">foo+@bar.example.com</a>></p>"
		);
	}

	#[test]
	fn links_url_after_escape() {
		// Verified against the JS engine: the first URL links (the escape
		// hid it from the tokenizer; the mdast pass catches it), the second
		// fails `isCorrectDomain` (no dot).
		assert_eq!(
			render("http\\://example.com is not, https\\://nope neither"),
			"<p><a href=\"http://example.com\">http://example.com</a> is not, https://nope neither</p>"
		);
	}

	#[test]
	fn splits_trailing_punctuation() {
		assert_eq!(
			render("Visit http\\://example.com/a."),
			"<p>Visit <a href=\"http://example.com/a\">http://example.com/a</a>.</p>"
		);
	}

	#[test]
	fn balances_parens() {
		assert_eq!(
			render("See http\\://example.com/a(b) end"),
			"<p>See <a href=\"http://example.com/a(b)\">http://example.com/a(b)</a> end</p>"
		);
		assert_eq!(
			render("And http\\://example.com/a(b end"),
			"<p>And <a href=\"http://example.com/a(b\">http://example.com/a(b</a> end</p>"
		);
	}

	#[test]
	fn rejects_bad_domains_and_labels() {
		// Email label ending in a digit; domain part containing `_`.
		assert_eq!(render("a\\_a@b.c1"), "<p>a_a@b.c1</p>");
		assert_eq!(render("x http\\://a\\_b.com y"), "<p>x http://a_b.com y</p>");
	}
}

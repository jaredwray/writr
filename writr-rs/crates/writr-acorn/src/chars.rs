//! Character classes and the lookahead regexes acorn runs over UTF-16 input.

use crate::generated::tables::{ID_CONTINUE, ID_START};

fn in_ranges(table: &[(u32, u32)], code: u32) -> bool {
	table
		.binary_search_by(|&(start, end)| {
			if end < code {
				std::cmp::Ordering::Less
			} else if start > code {
				std::cmp::Ordering::Greater
			} else {
				std::cmp::Ordering::Equal
			}
		})
		.is_ok()
}

/// `isIdentifierStart(code, true)`. `None` models JavaScript's `NaN`.
pub fn is_identifier_start(code: Option<u32>) -> bool {
	match code {
		None => false,
		Some(c) if c < 128 => {
			c == 36 || c == 95 || (65..=90).contains(&c) || (97..=122).contains(&c)
		}
		Some(c) => in_ranges(ID_START, c),
	}
}

/// `isIdentifierChar(code, true)`.
pub fn is_identifier_char(code: Option<u32>) -> bool {
	match code {
		None => false,
		Some(c) if c < 128 => {
			c == 36
				|| c == 95 || (48..=57).contains(&c)
				|| (65..=90).contains(&c)
				|| (97..=122).contains(&c)
		}
		Some(c) => in_ranges(ID_CONTINUE, c),
	}
}

/// `isNewLine` — acorn's line terminators.
pub fn is_new_line(code: Option<u16>) -> bool {
	matches!(code, Some(10 | 13 | 0x2028 | 0x2029))
}

/// acorn's `nonASCIIwhitespace`.
pub fn is_non_ascii_whitespace(code: u16) -> bool {
	matches!(
		code,
		0x1680 | 0x2000..=0x200a | 0x202f | 0x205f | 0x3000 | 0xfeff
	)
}

/// JavaScript `\s`.
pub fn is_js_space(code: u16) -> bool {
	matches!(
		code,
		9..=13 | 32 | 0xa0 | 0x1680 | 0x2000..=0x200a | 0x2028 | 0x2029 | 0x202f | 0x205f | 0x3000 | 0xfeff
	)
}

/// Whether `input[from..to]` (JS `slice` semantics) matches acorn's
/// `lineBreak` regex.
pub fn has_line_break(input: &[u16], from: usize, to: usize) -> bool {
	let to = to.min(input.len());
	from < to && input[from..to].iter().any(|&c| is_new_line(Some(c)))
}

/// First index of `needle` at or after `from`.
pub fn index_of(input: &[u16], needle: &[u16], from: usize) -> Option<usize> {
	if needle.is_empty() {
		return Some(from.min(input.len()));
	}
	if from >= input.len() {
		return None;
	}
	input[from..]
		.windows(needle.len())
		.position(|window| window == needle)
		.map(|at| at + from)
}

/// End of acorn's `skipWhiteSpace` match (`/(?:\s|\/\/.*|\/\*[^]*?\*\/)*/g`)
/// starting at `pos`.
pub fn skip_white_space(input: &[u16], mut pos: usize) -> usize {
	loop {
		match input.get(pos) {
			Some(&c) if is_js_space(c) => pos += 1,
			Some(&47) if input.get(pos + 1) == Some(&47) => {
				pos += 2;
				while pos < input.len() && !is_new_line(Some(input[pos])) {
					pos += 1;
				}
			}
			Some(&47) if input.get(pos + 1) == Some(&42) => {
				match index_of(input, &[42, 47], pos + 2) {
					Some(end) => pos = end + 2,
					None => return pos,
				}
			}
			_ => return pos,
		}
	}
}

/// Whether a UTF-16 string contains a lone surrogate (acorn's `loneSurrogate`).
pub fn has_lone_surrogate(value: &[u16]) -> bool {
	let mut i = 0;
	while i < value.len() {
		let c = value[i];
		if (0xd800..=0xdbff).contains(&c) {
			if matches!(value.get(i + 1), Some(0xdc00..=0xdfff)) {
				i += 2;
				continue;
			}
			return true;
		}
		if (0xdc00..=0xdfff).contains(&c) {
			return true;
		}
		i += 1;
	}
	false
}

/// `codePointToString`, where `None` is `NaN` (which JavaScript turns into
/// the pair `𐀀`).
pub fn code_point_to_string(code: Option<f64>) -> Vec<u16> {
	match code {
		Some(c) if c <= 65535.0 => vec![to_uint16(c)],
		Some(c) => {
			let c = (c - 65536.0) as i64;
			vec![
				to_uint16(((c >> 10) + 0xd800) as f64),
				to_uint16(((c & 1023) + 0xdc00) as f64),
			]
		}
		None => vec![0xd800, 0xdc00],
	}
}

/// `String.fromCharCode` for one number.
pub fn to_uint16(value: f64) -> u16 {
	if !value.is_finite() {
		return 0;
	}
	(value.trunc().rem_euclid(65536.0)) as u16
}

pub fn utf16(value: &str) -> Vec<u16> {
	value.encode_utf16().collect()
}

pub fn lossy(value: &[u16]) -> String {
	String::from_utf16_lossy(value)
}

pub fn eq(value: &[u16], ascii: &str) -> bool {
	value.len() == ascii.len() && value.iter().zip(ascii.bytes()).all(|(&a, b)| a == b as u16)
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn skip_white_space_matches_regex() {
		let input = utf16("  // x\n /* y */ z");
		assert_eq!(skip_white_space(&input, 0), 16);
		let input = utf16(" /* open");
		assert_eq!(skip_white_space(&input, 0), 1);
		let input = utf16("/*/ */a");
		assert_eq!(skip_white_space(&input, 0), 6);
	}

	#[test]
	fn surrogates_and_code_points() {
		assert!(has_lone_surrogate(&[0xd800]));
		assert!(has_lone_surrogate(&[0x41, 0xdc00]));
		assert!(!has_lone_surrogate(&[0xd83d, 0xde00]));
		assert_eq!(
			code_point_to_string(Some(0x1f600 as f64)),
			vec![0xd83d, 0xde00]
		);
		assert_eq!(code_point_to_string(None), vec![0xd800, 0xdc00]);
		assert!(is_identifier_start(Some('é' as u32)));
		assert!(!is_identifier_start(Some(0xd800)));
		assert!(is_identifier_char(Some(0x200c)));
	}
}

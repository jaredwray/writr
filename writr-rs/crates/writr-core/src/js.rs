//! Helpers that replicate JavaScript string/number semantics where they
//! differ from Rust's, so ports of the JS pipeline stay byte-exact.

/// Characters matched by JavaScript's `\s` and trimmed by `String.prototype.trim`.
///
/// Note this differs from Rust's `char::is_whitespace` (Unicode `White_Space`):
/// JS includes U+FEFF (BOM) and excludes U+0085 (NEL).
pub fn is_js_whitespace(c: char) -> bool {
	matches!(
		c,
		'\t' | '\n' | '\u{000B}' | '\u{000C}' | '\r' | ' ' | '\u{00A0}' | '\u{1680}' | '\u{2000}'
			..='\u{200A}'
				| '\u{2028}' | '\u{2029}'
				| '\u{202F}' | '\u{205F}'
				| '\u{3000}' | '\u{FEFF}'
	)
}

/// `String.prototype.trim`.
pub fn trim(value: &str) -> &str {
	value.trim_matches(is_js_whitespace)
}

/// `String.prototype.trimStart`.
pub fn trim_start(value: &str) -> &str {
	value.trim_start_matches(is_js_whitespace)
}

/// `String(number)` for the numbers that can appear in hast properties.
///
/// Integers in the f64-exact range print without a decimal point, like JS.
/// The general fallthrough uses Rust's shortest round-trip formatting, which
/// matches JS for the values reachable from markdown rendering.
pub fn number_to_string(value: f64) -> String {
	if value == 0.0 {
		// JS prints both 0 and -0 as "0".
		return "0".into();
	}
	if value.is_finite() && value.fract() == 0.0 && value.abs() < 9_007_199_254_740_992.0 {
		return format!("{}", value as i64);
	}
	format!("{value}")
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn whitespace_set_matches_js() {
		assert!(is_js_whitespace('\u{FEFF}'));
		assert!(is_js_whitespace('\u{00A0}'));
		assert!(is_js_whitespace('\u{3000}'));
		assert!(!is_js_whitespace('\u{0085}'));
		assert!(!is_js_whitespace('a'));
	}

	#[test]
	fn trim_matches_js() {
		assert_eq!(trim("\u{FEFF} a \u{00A0}"), "a");
		assert_eq!(trim_start("\n\t x "), "x ");
	}

	#[test]
	fn numbers_match_js() {
		assert_eq!(number_to_string(1.0), "1");
		assert_eq!(number_to_string(0.0), "0");
		assert_eq!(number_to_string(-0.0), "0");
		assert_eq!(number_to_string(42.0), "42");
		assert_eq!(number_to_string(-7.0), "-7");
		assert_eq!(number_to_string(1.5), "1.5");
	}
}

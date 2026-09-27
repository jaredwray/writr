//! WRITR-RS PATCH: JavaScript built-ins KaTeX's parser relies on
//! (`parseFloat`, `parseInt`, `Number.prototype.toString`), reproduced so
//! that error messages and parsed values match katex@0.18.7 exactly.

use alloc::string::String;

/// JavaScript's `StrWhiteSpaceChar` (WhiteSpace and LineTerminator), which
/// `parseFloat`/`parseInt` skip before the number.
const fn is_js_whitespace(c: char) -> bool {
    matches!(
        c,
        '\u{9}' | '\u{a}' | '\u{b}' | '\u{c}' | '\u{d}' | ' ' | '\u{a0}' | '\u{1680}' | '\u{2000}'
            ..='\u{200a}'
                | '\u{2028}'
                | '\u{2029}'
                | '\u{202f}'
                | '\u{205f}'
                | '\u{3000}'
                | '\u{feff}'
    )
}

/// JavaScript's `String.prototype.trim`.
#[must_use]
pub fn js_trim(text: &str) -> &str {
    text.trim_matches(is_js_whitespace)
}

fn count_digits(bytes: &[u8], from: usize) -> usize {
    bytes[from..]
        .iter()
        .take_while(|b| b.is_ascii_digit())
        .count()
}

/// JavaScript's global `parseFloat`: the longest prefix (after leading white
/// space) that is a decimal literal or `Infinity`; `NaN` if there is none.
#[must_use]
pub fn js_parse_float(text: &str) -> f64 {
    let trimmed = text.trim_start_matches(is_js_whitespace);
    let bytes = trimmed.as_bytes();
    let mut i = 0;
    if matches!(bytes.first(), Some(b'+' | b'-')) {
        i = 1;
    }
    if trimmed[i..].starts_with("Infinity") {
        return if bytes.first() == Some(&b'-') {
            f64::NEG_INFINITY
        } else {
            f64::INFINITY
        };
    }
    let int_digits = count_digits(bytes, i);
    let mut end = i + int_digits;
    let mut frac_digits = 0;
    if bytes.get(end) == Some(&b'.') {
        frac_digits = count_digits(bytes, end + 1);
        if int_digits > 0 || frac_digits > 0 {
            end += 1 + frac_digits;
        }
    }
    if int_digits == 0 && frac_digits == 0 {
        return f64::NAN;
    }
    if matches!(bytes.get(end), Some(b'e' | b'E')) {
        let mut j = end + 1;
        if matches!(bytes.get(j), Some(b'+' | b'-')) {
            j += 1;
        }
        let exp_digits = count_digits(bytes, j);
        if exp_digits > 0 {
            end = j + exp_digits;
        }
    }
    trimmed[..end].parse::<f64>().unwrap_or(f64::NAN)
}

/// JavaScript's global `parseInt` without a radix (`parseInt(text)`): after
/// leading white space and an optional sign, a `0x`/`0X` prefix selects
/// radix 16, otherwise radix 10; the value is the longest run of digits in
/// that radix, `NaN` if there is none (`parseInt("0x")`, `parseInt("0xg")`).
///
/// WRITR-RS PATCH: the hex prefix (char.ts calls `parseInt(number)`, so
/// `\@char{0x41}` is `A`); upstream read decimal digits only.
#[must_use]
pub fn js_parse_int(text: &str) -> f64 {
    let trimmed = text.trim_start_matches(is_js_whitespace);
    let bytes = trimmed.as_bytes();
    let mut i = 0;
    let negative = bytes.first() == Some(&b'-');
    if matches!(bytes.first(), Some(b'+' | b'-')) {
        i = 1;
    }
    let value = if matches!(bytes.get(i..i + 2), Some(b"0x" | b"0X")) {
        parse_hex_digits(&bytes[i + 2..])
    } else {
        let digits = count_digits(bytes, i);
        if digits == 0 {
            return f64::NAN;
        }
        trimmed[i..i + digits].parse::<f64>().unwrap_or(f64::NAN)
    };
    if negative { -value } else { value }
}

/// The value of the longest run of hexadecimal digits at the start of
/// `bytes`, rounded to the nearest `f64` (ties to even) as V8 does for a
/// power-of-two radix; `NaN` if there is none.
fn parse_hex_digits(bytes: &[u8]) -> f64 {
    let mut digits = bytes
        .iter()
        .map_while(|&b| char::from(b).to_digit(16))
        .peekable();
    if digits.peek().is_none() {
        return f64::NAN;
    }
    // The first 32 significant digits fit a u128 exactly; any nonzero digit
    // after them only matters as a sticky bit far below f64 precision.
    let mut mantissa: u128 = 0;
    let mut kept = 0usize;
    let mut dropped = 0i32;
    let mut sticky = false;
    for digit in digits.skip_while(|&d| d == 0) {
        if kept < 32 {
            mantissa = (mantissa << 4) | u128::from(digit);
            kept += 1;
        } else {
            dropped = dropped.saturating_add(1);
            sticky |= digit != 0;
        }
    }
    if sticky {
        mantissa |= 1;
    }
    #[allow(clippy::cast_precision_loss)]
    let value = mantissa as f64;
    value * 2f64.powi(dropped.saturating_mul(4))
}

/// JavaScript's `Number.prototype.toString()` (radix 10).
///
/// WRITR-RS PATCH: one implementation, shared with the builders
/// ([`crate::units::js_number`]); JavaScript switches to exponent form below
/// 1e-6 (`String(1.5e-7)` is `1.5e-7`).
#[must_use]
pub fn js_number_to_string(value: f64) -> String {
    crate::units::js_number(value)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_float_prefix() {
        assert_eq!(js_parse_float(" 1.5abc"), 1.5);
        assert_eq!(js_parse_float(".5"), 0.5);
        assert_eq!(js_parse_float("5."), 5.0);
        assert_eq!(js_parse_float("-2e3x"), -2000.0);
        assert_eq!(js_parse_float("1e"), 1.0);
        assert!(js_parse_float("abc").is_nan());
        assert!(js_parse_float(".").is_nan());
        assert_eq!(js_parse_float("-Infinityx"), f64::NEG_INFINITY);
    }

    #[test]
    fn parse_int_prefix() {
        assert_eq!(js_parse_int(" 12ab"), 12.0);
        assert_eq!(js_parse_int("-3"), -3.0);
        assert_eq!(js_parse_int("1.5"), 1.0);
        assert!(js_parse_int("x1").is_nan());
        assert_eq!(js_parse_int("0x41g"), 65.0);
        assert_eq!(js_parse_int(" +0X3b1"), 945.0);
        assert_eq!(js_parse_int("-0x41"), -65.0);
        assert_eq!(js_parse_int("0x1F600"), 128_512.0);
        assert_eq!(js_parse_int("0xffffffffffffffffffff"), 1.208_925_819_614_629_2e24);
        assert_eq!(js_parse_int("0x00000000000000000000000000000000000041"), 65.0);
        assert!(js_parse_int("0x").is_nan());
        assert!(js_parse_int("0xg").is_nan());
        assert!(js_parse_int("-0x").is_nan());
        assert_eq!(js_parse_int("0 x41"), 0.0);
        // Ties to even, and a dropped nonzero digit breaks the tie upward.
        assert_eq!(js_parse_int("0x1fffffffffffff8"), 144_115_188_075_855_872.0);
        assert_eq!(
            js_parse_int("0x1fffffffffffff8000000000000000000000001"),
            2f64.powi(153)
        );
    }

    #[test]
    fn number_to_string() {
        assert_eq!(js_number_to_string(-0.0), "0");
        assert_eq!(js_number_to_string(55296.0), "55296");
        assert_eq!(js_number_to_string(1e21), "1e+21");
        assert_eq!(js_number_to_string(1.5e-8), "1.5e-8");
        assert_eq!(js_number_to_string(1.5e-7), "1.5e-7");
        assert_eq!(js_number_to_string(1e-6), "0.000001");
        assert_eq!(js_number_to_string(0.25), "0.25");
    }
}

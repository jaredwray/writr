//! Units conversion utilities (Rust port of KaTeX src/units.js)
//!
//! This module performs conversion between TeX/KaTeX units and CSS ems.
//! It provides helpers similar to the original JavaScript implementation:
//! - `valid_unit` to validate a unit string or measurement
//! - `calculate_size` to convert a `Measurement` into ems for the given
//!   `Options`
//! - `make_em` to format a number as an em string rounded to 4 decimals

use crate::KatexContext;
use crate::options::Options;
use crate::spacing_data::Measurement;
use crate::types::{ParseError, ParseErrorKind};
use core::fmt::Write as _;
use phf::phf_set;

const RELATIVE_UNITS: phf::Set<&'static str> = phf_set!("ex", "em", "mu");

/// Return TeX points per unit for absolute TeX units.
/// See KaTeX src/units.js `ptPerUnit` for reference values.
const PT_PER_UNIT: phf::Map<&'static str, f64> = phf::phf_map! {
    // https://en.wikibooks.org/wiki/LaTeX/Lengths
    // https://tex.stackexchange.com/a/8263
    "pt" => 1.0,             // TeX point
    "mm" => 7227.0 / 2540.0, // millimeter
    "cm" => 7227.0 / 254.0,  // centimeter
    "in" => 72.27,           // inch
    // https://tex.stackexchange.com/a/41371
    "bp" | "px" => 803.0 / 800.0, // big (PostScript) points
    // \pdfpxdimen defaults to 1 bp in pdfTeX and LuaTeX
    "pc" => 12.0,             // pica
    "dd" => 1238.0 / 1157.0,  // didot
    "cc" => 14856.0 / 1157.0, // cicero (12 didot)
    "nd" => 685.0 / 642.0,    // new didot
    "nc" => 1370.0 / 107.0,   // new cicero (12 new didot)
    "sp" => 1.0 / 65536.0,    // scaled point (TeX's internal smallest unit)
};

/// Check whether a unit string is a valid length unit understood by KaTeX.
pub fn valid_unit_str<T>(unit: T) -> bool
where
    T: AsRef<str>,
{
    PT_PER_UNIT.contains_key(unit.as_ref()) || RELATIVE_UNITS.contains(unit.as_ref())
}

/// Check whether a measurement has a valid unit.
pub fn valid_unit<T>(measurement: &Measurement<T>) -> bool
where
    T: AsRef<str>,
{
    valid_unit_str(&measurement.unit)
}

impl KatexContext {
    /// Convert a `Measurement` (e.g., `{ number: 1.2, unit: "cm" }`) into CSS
    /// ems for the given `Options`. Mirrors the logic in KaTeX
    /// `calculateSize`.
    ///
    /// Returns an error if the unit is invalid.
    pub fn calculate_size<T>(
        &self,
        size: &Measurement<T>,
        options: &Options,
    ) -> Result<f64, ParseError>
    where
        T: AsRef<str>,
    {
        let mut scale: f64;

        if let Some(pt) = PT_PER_UNIT.get(size.unit.as_ref()) {
            // Absolute units. Convert unit -> pt -> em, then unscale absolute
            // to current size.
            let metrics = self.get_global_metrics(options.size as f64);
            let pt_per_em = metrics.pt_per_em;
            scale = pt / pt_per_em / options.size_multiplier;
        } else if size.unit.as_ref() == "mu" {
            // `mu` units scale with scriptstyle/scriptscriptstyle.
            let metrics = self.get_global_metrics(options.size as f64);
            scale = metrics.css_em_per_mu;
        } else {
            // Other relative units always refer to the textstyle font in the
            // current size.
            let unit_options = if options.style.is_tight() {
                options.having_style(options.style.text())
            } else {
                options.clone()
            };

            let metrics = self.get_global_metrics(unit_options.size as f64);
            scale = match size.unit.as_ref() {
                "ex" => metrics.x_height,
                "em" => metrics.quad,
                other => {
                    return Err(ParseError::new(ParseErrorKind::InvalidUnit {
                        unit: other.to_owned(),
                    }));
                }
            };

            // If we changed options for tight style, compensate for size
            // multiplier.
            if unit_options.size != options.size {
                let ratio = unit_options.size_multiplier / options.size_multiplier;
                scale *= ratio;
            }
        }

        // WRITR-RS PATCH: `Math.min` (NaN propagates).
        Ok(js_min(size.number * scale, options.max_size))
    }
}

/// WRITR-RS PATCH: JavaScript's `Number#toString()` for an `f64` (`String(n)`):
/// `-0` prints as `0`, non-finite values as `NaN`/`Infinity`, and magnitudes
/// outside [1e-6, 1e21) in exponent form (`1e+21`, `1.5e-7`). Rust's `{}`
/// prints the same shortest round-trip digits otherwise, except on a tie
/// (see [`js_shortest_tie_to_even`]).
#[must_use]
pub fn js_number(n: f64) -> String {
    if n.is_nan() {
        return "NaN".to_owned();
    }
    if n.is_infinite() {
        return if n > 0.0 { "Infinity" } else { "-Infinity" }.to_owned();
    }
    if n == 0.0 {
        return "0".to_owned();
    }
    if let Some(value) = js_shortest_tie_to_even(n) {
        return value;
    }
    let abs = n.abs();
    if (1e-6..1e21).contains(&abs) {
        return format!("{n}");
    }
    let exp = format!("{n:e}");
    match exp.split_once('e') {
        Some((mantissa, power)) if !power.starts_with('-') => format!("{mantissa}e+{power}"),
        _ => exp,
    }
}

/// WRITR-RS PATCH: when two digit strings of the shortest length round-trip
/// and are equally close to `n`, ECMAScript's Number::toString (and V8's
/// bignum dtoa) picks the one whose last digit is even; Rust picks the upper
/// one (`853582677165355.25` prints as `…355.2` in JavaScript, `…355.3` in
/// Rust). Returns JavaScript's string when Rust's choice is the odd one of
/// such a tie, else `None`.
///
/// Writing a finite nonzero `|n|` as `m × 2^e` with `m` odd, its exact
/// decimal expansion is `m × 5^-e` digits times `10^e` when `e < 0` (an
/// integer `n` never ties: its candidates are further apart than an ulp).
/// A tie means the shortest string has exactly one digit fewer than that
/// expansion, whose last digit (a multiple of 5 that is odd) is then a 5.
fn js_shortest_tie_to_even(n: f64) -> Option<String> {
    let abs = n.abs();
    let bits = abs.to_bits();
    let biased = ((bits >> 52) & 0x7ff) as i32;
    let fraction = bits & ((1u64 << 52) - 1);
    let (mantissa, exponent) = if biased == 0 {
        (fraction, -1074)
    } else {
        (fraction | (1u64 << 52), biased - 1075)
    };
    let zeros = mantissa.trailing_zeros() as i32;
    let (odd, exponent) = (mantissa >> zeros, exponent + zeros);
    if exponent >= 0 {
        return None;
    }
    let exact = 5u128
        .checked_pow(u32::try_from(-exponent).ok()?)?
        .checked_mul(u128::from(odd))?;
    let exact_digits = exact.to_string();

    // Rust's shortest round-trip digits: `d.ddd` and the power of ten.
    let shortest = format!("{abs:e}");
    let (mantissa, power) = shortest.split_once('e')?;
    let digits: String = mantissa.chars().filter(|&c| c != '.').collect();
    let power: i32 = power.parse().ok()?;
    if exact_digits.len() != digits.len() + 1 {
        return None;
    }
    let chosen: u128 = digits.parse().ok()?;
    if chosen % 2 == 0 {
        return None;
    }
    let lower = exact / 10;
    let other = if chosen == lower { lower + 1 } else { lower };
    let other_digits = other.to_string();
    if other_digits.len() != digits.len() || (chosen != lower && chosen != lower + 1) {
        return None;
    }
    // The other candidate must round-trip too.
    if format!("{other_digits}e{}", power + 1 - digits.len() as i32).parse::<f64>() != Ok(abs) {
        return None;
    }
    let mut out = String::new();
    if n < 0.0 {
        out.push('-');
    }
    js_format_digits(&mut out, &other_digits, power + 1);
    Some(out)
}

/// Number::toString's layout of the digits `s` (k of them) with the decimal
/// point `point` places from their start (the value is `0.s × 10^point`).
fn js_format_digits(out: &mut String, s: &str, point: i32) {
    let k = s.len() as i32;
    if k <= point && point <= 21 {
        out.push_str(s);
        out.extend(core::iter::repeat_n('0', (point - k) as usize));
    } else if 0 < point && point <= 21 {
        out.push_str(&s[..point as usize]);
        out.push('.');
        out.push_str(&s[point as usize..]);
    } else if -6 < point && point <= 0 {
        out.push_str("0.");
        out.extend(core::iter::repeat_n('0', (-point) as usize));
        out.push_str(s);
    } else {
        out.push_str(&s[..1]);
        if k > 1 {
            out.push('.');
            out.push_str(&s[1..]);
        }
        let e = point - 1;
        let _ = write!(out, "e{}{}", if e > 0 { '+' } else { '-' }, e.abs());
    }
}

/// WRITR-RS PATCH: JavaScript truthiness of a Number (`if (x)`): `0`, `-0`
/// and `NaN` are falsy.
#[must_use]
pub fn js_truthy(x: f64) -> bool {
    x != 0.0 && !x.is_nan()
}

/// WRITR-RS PATCH: JavaScript's `Math.max(a, b)`: `NaN` if either is `NaN`
/// (Rust's `f64::max` returns the other operand), and `+0` beats `-0`.
#[must_use]
pub fn js_max(a: f64, b: f64) -> f64 {
    if a.is_nan() || b.is_nan() {
        f64::NAN
    } else if a == b {
        if a.is_sign_positive() { a } else { b }
    } else if a > b {
        a
    } else {
        b
    }
}

/// WRITR-RS PATCH: JavaScript's `Math.min(a, b)`: `NaN` if either is `NaN`
/// (Rust's `f64::min` returns the other operand), and `-0` beats `+0`.
#[must_use]
pub fn js_min(a: f64, b: f64) -> f64 {
    if a.is_nan() || b.is_nan() {
        f64::NAN
    } else if a == b {
        if a.is_sign_negative() { a } else { b }
    } else if a < b {
        a
    } else {
        b
    }
}

/// WRITR-RS PATCH: JavaScript's `Math.round`: halves round toward +∞
/// (`Math.round(-2.5)` is -2), where Rust's `round` goes away from zero.
#[must_use]
pub fn js_round(x: f64) -> f64 {
    let floor = x.floor();
    if x - floor >= 0.5 { floor + 1.0 } else { floor }
}

/// When `abs * 10^4` is exactly halfway between two integers, the larger one
/// (toFixed's choice for a tie), else `None`.
fn exact_tie_round_up(abs: f64) -> Option<u128> {
    let bits = abs.to_bits();
    let exponent = ((bits >> 52) & 0x7ff) as i32;
    let fraction = bits & ((1u64 << 52) - 1);
    let (mantissa, exponent) = if exponent == 0 {
        (fraction, -1074)
    } else {
        (fraction | (1u64 << 52), exponent - 1075)
    };
    if exponent >= 0 || exponent < -127 {
        return None;
    }
    // abs * 10^4 * 2 = mantissa * 20000 / 2^-exponent must be an odd integer.
    let doubled = u128::from(mantissa) * 20_000;
    let divisor = 1u128 << (-exponent);
    if doubled % divisor != 0 || (doubled / divisor) % 2 == 0 {
        return None;
    }
    Some((doubled / divisor).div_ceil(2))
}

/// Round to 4 decimal places and append "em", dropping trailing zeros.
#[must_use]
fn finalize_em(mut value: String) -> String {
    if value.contains('.') {
        while value.ends_with('0') {
            value.pop();
        }
        if value.ends_with('.') {
            value.pop();
        }
    }

    if value == "-0" {
        value.clear();
        value.push('0');
    } else if value.is_empty() {
        value.push('0');
    }

    value.push_str("em");
    value
}

/// WRITR-RS PATCH: KaTeX's size pattern
/// `/([-+]?) *(\d+(?:\.\d*)?|\.\d+) *([a-z]{2})/.exec(text)` (Parser.ts
/// parseSizeGroup, includegraphics.ts sizeData). The pattern is not
/// anchored, so the first match anywhere in `text` counts. Returns
/// `+(sign + magnitude)` and the two-letter unit.
#[must_use]
pub fn exec_size_regex(text: &str) -> Option<(f64, String)> {
    let bytes = text.as_bytes();
    let spaces = |mut i: usize| {
        while bytes.get(i) == Some(&b' ') {
            i += 1;
        }
        i
    };
    let digits = |mut i: usize| {
        while bytes.get(i).is_some_and(u8::is_ascii_digit) {
            i += 1;
        }
        i
    };
    for start in 0..bytes.len() {
        let mut i = start;
        let sign_end = if matches!(bytes[i], b'+' | b'-') {
            i + 1
        } else {
            i
        };
        i = spaces(sign_end);
        let number_start = i;
        if bytes.get(i).is_some_and(u8::is_ascii_digit) {
            i = digits(i);
            if bytes.get(i) == Some(&b'.') {
                i = digits(i + 1);
            }
        } else if bytes.get(i) == Some(&b'.') && bytes.get(i + 1).is_some_and(u8::is_ascii_digit) {
            i = digits(i + 1);
        } else {
            continue;
        }
        let number_end = i;
        i = spaces(i);
        if bytes.get(i).is_some_and(u8::is_ascii_lowercase)
            && bytes.get(i + 1).is_some_and(u8::is_ascii_lowercase)
        {
            let literal = alloc::format!(
                "{}{}",
                &text[start..sign_end],
                &text[number_start..number_end]
            );
            let number = literal.parse::<f64>().unwrap_or(f64::NAN);
            return Some((number, text[i..i + 2].to_owned()));
        }
    }
    None
}

/// Format an `f64` as an `em` CSS unit, rounding to four decimal places.
///
/// The output mirrors JavaScript's `Number#toFixed(4)` formatting while
/// trimming trailing zeros and avoiding the allocation-heavy float formatter.
#[must_use]
pub fn make_em(n: f64) -> String {
    const PRECISION: i64 = 10_000;

    // WRITR-RS PATCH: `+n.toFixed(4) + "em"` exactly: non-finite values
    // print as JavaScript does (`NaNem`, `Infinityem`), toFixed returns
    // String(n) from 1e21 on, large values are read back as a Number (so
    // they print with at most 17 significant digits), and exact ties round
    // half up like toFixed (Rust's formatter rounds them half to even).
    if !n.is_finite() || n.abs() >= 1e21 {
        let mut value = js_number(n);
        value.push_str("em");
        return value;
    }
    if n.abs() >= 1e11 {
        // WRITR-RS PATCH: exact ties round half up here too (toFixed), then
        // the fixed string is read back as a Number.
        let fixed = match exact_tie_round_up(n.abs()) {
            Some(half_up) => format!(
                "{}{}.{:04}",
                if n < 0.0 { "-" } else { "" },
                half_up / PRECISION as u128,
                half_up % PRECISION as u128
            ),
            None => format!("{n:.4}"),
        };
        let fixed = fixed.parse::<f64>().unwrap_or(n);
        let mut value = js_number(fixed);
        value.push_str("em");
        return value;
    }

    let scaled_float = n * PRECISION as f64;
    let scaled_abs = scaled_float.abs();
    let frac = scaled_abs - scaled_abs.floor();
    if (frac - 0.5).abs() <= f64::EPSILON * scaled_abs.max(1.0) {
        if let Some(half_up) = exact_tie_round_up(n.abs()) {
            let sign = if n < 0.0 { "-" } else { "" };
            return finalize_em(format!(
                "{sign}{}.{:04}",
                half_up / PRECISION as u128,
                half_up % PRECISION as u128
            ));
        }
        return finalize_em(format!("{n:.4}"));
    }

    let mut scaled_int = scaled_float.round() as i64;
    if scaled_int == 0 {
        return "0em".to_owned();
    }

    let mut result = String::with_capacity(16);
    if scaled_int < 0 {
        result.push('-');
        scaled_int = -scaled_int;
    }

    let int_part = scaled_int / PRECISION;
    let mut frac_part = scaled_int % PRECISION;

    // Write directly into the output instead of allocating a temporary String.
    let _ = write!(result, "{int_part}");

    if frac_part != 0 {
        result.push('.');

        let mut digits = 4;
        while digits > 0 && frac_part % 10 == 0 {
            frac_part /= 10;
            digits -= 1;
        }

        let mut buf = [b'0'; 4];
        for idx in (0..digits).rev() {
            buf[idx as usize] = b'0' + (frac_part % 10) as u8;
            frac_part /= 10;
        }
        if let Ok(s) = str::from_utf8(&buf[..digits as usize]) {
            result.push_str(s);
        } else {
            // Fallback in case of unexpected UTF-8 error
            result.push_str(frac_part.to_string().as_str());
        }
    }

    result.push_str("em");
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::options::Options;
    use crate::spacing_data::MeasurementOwned;
    use crate::style;

    fn default_options() -> Options {
        Options::builder()
            .style(style::TEXT)
            .max_size(1_000_000.0)
            .min_rule_thickness(0.04)
            .build()
    }

    #[test]
    fn test_valid_unit() {
        assert!(valid_unit_str("pt"));
        assert!(valid_unit_str("cm"));
        assert!(valid_unit_str("px"));
        assert!(valid_unit_str("em"));
        assert!(valid_unit_str("ex"));
        assert!(valid_unit_str("mu"));
        assert!(!valid_unit_str("bogus"));
    }

    #[test]
    fn test_make_em_rounding() {
        assert_eq!(make_em(1.0), "1em");
        assert_eq!(make_em(1.23456), "1.2346em");
        assert_eq!(make_em(0.00004), "0em");
        assert_eq!(make_em(0.00005), "0.0001em");
        assert_eq!(make_em(-0.00005), "-0.0001em");
        assert_eq!(make_em(-1.5), "-1.5em");
    }

    #[test]
    fn test_js_number_ties_to_even() {
        // Values checked against V8 (`String(n)`, `+n.toFixed(4) + "em"`).
        assert_eq!(js_number(853_582_677_165_355.25), "853582677165355.2");
        assert_eq!(js_number(-853_582_677_165_355.25), "-853582677165355.2");
        assert_eq!(js_number(10_681_152_343_749.812_5), "10681152343749.812");
        assert_eq!(js_number(0.1 + 0.2), "0.30000000000000004");
        assert_eq!(js_number(100_000_000_000.031_25), "100000000000.03125");
        assert_eq!(make_em(853_582_677_165_355.25), "853582677165355.2em");
        assert_eq!(make_em(100_000_000_000.031_25), "100000000000.0313em");
        assert_eq!(make_em(-100_000_000_000.031_25), "-100000000000.0313em");
    }

    #[test]
    fn test_js_math_max_min_truthy() {
        // Math.max/Math.min propagate NaN; +0 beats -0 in max, -0 in min.
        assert!(js_max(0.0, f64::NAN).is_nan());
        assert!(js_max(f64::NAN, 1.0).is_nan());
        assert!(js_min(f64::INFINITY, f64::NAN).is_nan());
        assert_eq!(js_max(1.0, 2.0), 2.0);
        assert_eq!(js_min(1.0, 2.0), 1.0);
        assert!(js_max(-0.0, 0.0).is_sign_positive());
        assert!(js_max(0.0, -0.0).is_sign_positive());
        assert!(js_min(0.0, -0.0).is_sign_negative());
        assert_eq!(js_max(0.0, f64::NEG_INFINITY), 0.0);
        assert!(!js_truthy(0.0));
        assert!(!js_truthy(-0.0));
        assert!(!js_truthy(f64::NAN));
        assert!(js_truthy(f64::INFINITY));
        assert!(js_truthy(-1e-300));
    }

    fn reference_make_em(n: f64) -> String {
        finalize_em(format!("{n:.4}"))
    }

    #[test]
    fn test_make_em_matches_reference() {
        let cases = [
            -1234.56789,
            -0.00004,
            -0.00005,
            -0.125,
            -1.0,
            -0.5,
            0.0,
            0.00004,
            0.00005,
            0.125,
            1.0,
            1234.56789,
            1.99995,
            1000000.0,
        ];

        for &value in &cases {
            assert_eq!(make_em(value), reference_make_em(value), "value: {value}");
        }
    }

    #[test]
    fn test_calculate_size_absolute_units() {
        let opts = default_options();
        let ctx = KatexContext::default();
        // 10pt per em by default, 1pt = 1/10 em
        let m = MeasurementOwned {
            number: 10.0,
            unit: "pt".to_owned(),
        };
        let ems = ctx.calculate_size(&m, &opts).unwrap();
        assert!((ems - 1.0).abs() < 1e-9);
    }

    #[test]
    fn test_calculate_size_relative_units() {
        let opts = default_options();
        let ctx = KatexContext::default();
        // In text style, quad is 1em
        let m_em = MeasurementOwned {
            number: 2.0,
            unit: "em".to_owned(),
        };
        let ems_em = ctx.calculate_size(&m_em, &opts).unwrap();
        assert!((ems_em - 2.0).abs() < 1e-9);

        // xHeight default is 0.431em in text
        let measure_owned = MeasurementOwned {
            number: 1.0,
            unit: "ex".to_owned(),
        };
        let ems_owned = ctx.calculate_size(&measure_owned, &opts).unwrap();
        assert!((ems_owned - 0.431).abs() < 1e-9);
    }
}

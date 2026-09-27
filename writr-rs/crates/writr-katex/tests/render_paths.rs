//! Error-path coverage through the public API.

use writr_katex::render_math;

fn deep_formula() -> String {
	let depth = 20_000;
	format!("{}x{}", "{".repeat(depth), "}".repeat(depth))
}

#[test]
fn stack_exhaustion_in_both_attempts_yields_the_first_error() {
	// 20K-deep nesting exhausts V8's stack in KaTeX, and katex-rs's stack
	// budget stands in for that: both renderToString attempts fail with the
	// RangeError, so the outcome is the stringified first error (rehype-katex's
	// own katex-error element). This runs on a default 2 MiB test thread — the
	// budget keeps the native stack from overflowing.
	let outcome = render_math(&deep_formula(), false);
	assert_eq!(
		outcome,
		Err("RangeError: Maximum call stack size exceeded".to_string())
	);
	// Errors are memoized too.
	assert_eq!(render_math(&deep_formula(), false), outcome);
}

#[test]
fn deep_nesting_is_bounded_on_small_stacks() {
	// Every shape KaTeX recurses on must fail cleanly rather than overflow,
	// even on a thread with only 2 MiB of stack. 3,000 levels is past V8's
	// limit for each shape too (~660 for scripts, ~2,200 for plain braces).
	let shapes: [fn(usize) -> String; 6] = [
		|n| "{".repeat(n) + "x" + &"}".repeat(n),
		|n| "\\frac{".repeat(n) + "x" + &"}{y}".repeat(n),
		|n| "\\sqrt{".repeat(n) + "x" + &"}".repeat(n),
		|n| "x^{".repeat(n) + "y" + &"}".repeat(n),
		|n| "\\left(".repeat(n) + "x" + &"\\right)".repeat(n),
		|n| "\\text{".repeat(n) + "x" + &"}".repeat(n),
	];
	let handle = std::thread::Builder::new()
		.stack_size(2 * 1024 * 1024)
		.spawn(move || {
			shapes
				.iter()
				.map(|make| writr_katex::render_math_with_cache(&make(3_000), true, false))
				.collect::<Vec<_>>()
		})
		.expect("spawn render thread");
	for outcome in handle.join().expect("render thread completes") {
		assert_eq!(
			outcome,
			Err("RangeError: Maximum call stack size exceeded".to_string())
		);
	}
}

#[test]
fn errors_that_are_not_parse_errors_escape_the_retry() {
	// KaTeX throws a plain Error for missing font metrics and runs into V8
	// TypeErrors on some malformed input; neither becomes the inline
	// katex-error span, so rehype-katex reports String(firstError).
	let cases = [
		(
			"\\textbf{\\circledR}",
			false,
			"Error: Font metrics not found for font: AMS-Bold.",
		),
		(
			"\\def\\x#1{#2}\\x b",
			false,
			"TypeError: args[((+tok.text) - 1)] is not iterable (cannot read property undefined)",
		),
		(
			"\\begin{CD} A @ \\end{CD}",
			true,
			"TypeError: Cannot read properties of undefined (reading 'type')",
		),
		// A brace-delimited parameter whose argument starts with `{` leaves
		// consumeArg with no tokens, and it reads `.text` of `undefined`.
		(
			"\\def\\a#1#{x}\\a{y}",
			false,
			"TypeError: Cannot read properties of undefined (reading 'text')",
		),
	];
	for (tex, display, expected) in cases {
		assert_eq!(
			writr_katex::render_math_with_cache(tex, display, false),
			Err(expected.to_string()),
			"{tex}"
		);
	}
}

#[test]
fn spreads_past_v8s_argument_limit_are_range_errors() {
	// KaTeX spreads token lists and fragment children into calls
	// (`stack.push(...tokens)`, `groups.push(...children)`), and V8 throws its
	// stack RangeError past about 125k arguments. A self-duplicating macro
	// reaches that in a few expansions; before the limit was emulated it grew
	// the token stack until the process ran out of memory.
	let range_error = Err("RangeError: Maximum call stack size exceeded".to_string());
	let render = |tex: &str| writr_katex::render_math_with_cache(tex, false, false);
	assert_eq!(render("\\def\\d#1#{#1#1#1}\\d\\d a{e}"), range_error);
	assert_eq!(
		render("\\def\\d#1.{#1#1.}\\d\\d\\d\\d\\d\\d x."),
		range_error
	);
	let fragment = |atoms: usize| format!("\\color{{red}}{}", "x1".repeat(atoms / 2));
	assert_eq!(render(&fragment(126_000)), range_error);
	assert!(render(&fragment(108_000)).is_ok());
	let argument = |tokens: usize| format!("\\frac{{{}}}{{y}}", "x".repeat(tokens));
	assert_eq!(render(&argument(127_000)), range_error);
	assert!(render(&argument(124_000)).is_ok());
	// 300 placeholders of a 32,768-token argument (doubled up by \bp … \bb):
	// KaTeX splices ~10M tokens together before the push rejects them;
	// katex-rs sizes the expansion first and builds none of it.
	let mut tex = format!("\\def\\a#1{{{}}}\\def\\ba#1{{\\a{{#1}}}}", "#1".repeat(300));
	for (prev, next) in ('a'..='o').zip('b'..='p') {
		tex += &format!("\\def\\b{next}#1{{\\b{prev}{{#1#1}}}}");
	}
	tex += "\\bp{x}";
	assert_eq!(render(&tex), range_error);
}

#[test]
fn parse_error_positions_count_utf16_code_units() {
	// KaTeX's positions and 15-unit context windows index UTF-16 code units;
	// split surrogate pairs print as U+FFFD.
	let html = render_math("😀😀😀😀😀😀😀😀^1^2", false).expect("inline error span");
	assert!(
		html.contains("Double superscript at position 19: …\u{FFFD}😀😀😀😀😀😀^1^\u{332}2\""),
		"{html}"
	);
	// A \verb delimiter is one UTF-16 unit: an astral delimiter closes on the
	// next high surrogate, and the lone low surrogate after it is rejected.
	let html = render_math("\\verb😀x😀", false).expect("inline error span");
	assert!(
		html.contains(
			"Unexpected character: &#x27;\u{FFFD}&#x27; at position 10: \\verb😀x😀\u{332}\""
		),
		"{html}"
	);
	assert!(render_math("\\verb§x§", false)
		.expect("renders")
		.contains("x"));
}

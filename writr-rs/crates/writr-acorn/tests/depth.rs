//! Deep nesting: the parser must never overflow the thread's stack. Past its
//! stack budget it reports what acorn reports when V8's stack runs out, and
//! it accepts nesting at least as deep as the JavaScript oracle does for
//! realistic depths.

use writr_acorn::{validate, Kind, Signal};

type Shape = (&'static str, Kind, fn(usize) -> String);

const SHAPES: &[Shape] = &[
	("parens", Kind::Expression, |n| {
		"(".repeat(n) + "1" + &")".repeat(n)
	}),
	("arrays", Kind::Expression, |n| {
		"[".repeat(n) + &"]".repeat(n)
	}),
	("objects", Kind::Expression, |n| {
		"{a:".repeat(n) + "1" + &"}".repeat(n)
	}),
	("unary", Kind::Expression, |n| "!".repeat(n) + "a"),
	("await", Kind::Esm, |n| {
		"export const a = ".to_string() + &"await ".repeat(n) + "b"
	}),
	("news", Kind::Expression, |n| "new ".repeat(n) + "a"),
	("classes", Kind::Expression, |n| {
		"class extends ".repeat(n) + "a{}" + &"{}".repeat(n - 1)
	}),
	("arrows", Kind::Expression, |n| "()=>".repeat(n) + "1"),
	("calls", Kind::Expression, |n| {
		"a(".repeat(n) + &")".repeat(n)
	}),
	("members", Kind::Expression, |n| {
		"a[".repeat(n) + "b" + &"]".repeat(n)
	}),
	("templates", Kind::Expression, |n| {
		"`${".repeat(n) + "1" + &"}`".repeat(n)
	}),
	("conditionals", Kind::Expression, |n| {
		"a?".repeat(n) + "b" + &":c".repeat(n)
	}),
	("assignments", Kind::Expression, |n| "a=".repeat(n) + "1"),
	("binary", Kind::Expression, |n| "a**".repeat(n) + "1"),
	("jsx", Kind::Expression, |n| {
		"<a>".repeat(n) + &"</a>".repeat(n)
	}),
	("jsx-attributes", Kind::Expression, |n| {
		"<a b=".repeat(n) + "<a/>" + &" />".repeat(n)
	}),
	("jsx-expressions", Kind::Expression, |n| {
		"<a>{".repeat(n) + "1" + &"}</a>".repeat(n)
	}),
	("patterns", Kind::Expression, |n| {
		"(".to_string() + &"[".repeat(n) + "a" + &"]".repeat(n) + ")=>1"
	}),
	("spread", Kind::Spread, |n| {
		"...".to_string() + &"(".repeat(n) + "a" + &")".repeat(n)
	}),
	("blocks", Kind::Esm, |n| {
		"export function f(){".to_string() + &"{".repeat(n) + &"}".repeat(n) + "}"
	}),
	("ifs", Kind::Esm, |n| {
		"export function f(){".to_string() + &"if(a)".repeat(n) + ";}"
	}),
	("labels", Kind::Esm, |n| {
		"export function f(){".to_string()
			+ &(0..n).map(|i| format!("a{i}:")).collect::<String>()
			+ ";}"
	}),
	("functions", Kind::Esm, |n| {
		"export function f(){".to_string() + &"function g(){".repeat(n) + &"}".repeat(n) + "}"
	}),
	("regexp-groups", Kind::Expression, |n| {
		"0,/".to_string() + &"(".repeat(n) + &")".repeat(n) + "/"
	}),
	("regexp-classes", Kind::Expression, |n| {
		"0,/".to_string() + &"[".repeat(n) + &"]".repeat(n) + "/v"
	}),
];

/// Every shape is valid at this depth, and JavaScript accepts all of them
/// (its shallowest limit, nested arrow functions, is ~530 on Node 22).
const REALISTIC: usize = 200;

fn run(shape: &Shape, n: usize) -> writr_acorn::Outcome {
	validate(&(shape.2)(n), shape.1, &[], true)
		.unwrap_or_else(|error| panic!("{} at {n}: {error}", shape.0))
}

#[test]
fn realistic_depths_parse() {
	for shape in SHAPES {
		let outcome = run(shape, REALISTIC);
		assert_eq!(
			outcome.signal,
			Signal::Ok,
			"{} at {REALISTIC}: {outcome:?}",
			shape.0
		);
	}
}

#[test]
fn pathological_depths_report_stack_space() {
	// Test threads have 2 MB stacks; the budget must fit well inside them.
	for shape in SHAPES {
		// The signal depends on where the overflow happens: a regular
		// expression overflows after its whole literal was read, which (as in
		// JavaScript) reads as incomplete input.
		let outcome = run(shape, 100_000);
		assert_eq!(
			outcome.message, "Not enough stack space to parse input",
			"{} at 100000: {outcome:?}",
			shape.0
		);
	}
}

/// acorn reads the first token outside `catchStackOverflow`, so a regular
/// expression nested too deeply there overflows like V8 does: a thrown
/// `RangeError` rather than a `SyntaxError`.
#[test]
fn first_token_overflow_throws() {
	let value = "/".to_string() + &"(".repeat(100_000) + &")".repeat(100_000) + "/";
	assert!(validate(&value, Kind::Expression, &[], true).is_err());
	let value = "/".to_string() + &"(".repeat(100_000) + &")".repeat(100_000) + "/;";
	assert!(validate(&value, Kind::Esm, &[], true).is_err());
}

/// `cargo test -p writr-acorn --test depth -- --ignored --nocapture` prints
/// each shape's nesting limit.
#[test]
#[ignore]
fn print_limits() {
	for shape in SHAPES {
		let (mut ok, mut fail) = (1, 20_000);
		while ok + 1 < fail {
			let mid = (ok + fail) / 2;
			if run(shape, mid).signal == Signal::Ok {
				ok = mid;
			} else {
				fail = mid;
			}
		}
		println!("{:16} {ok}", shape.0);
	}
}

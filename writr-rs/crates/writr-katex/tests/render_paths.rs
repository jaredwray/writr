//! Error-path coverage through the public API.

use writr_katex::render_math;

fn deep_formula() -> String {
	let depth = 20_000;
	format!("{}x{}", "{".repeat(depth), "}".repeat(depth))
}

#[test]
fn stack_exhaustion_in_both_attempts_yields_the_first_error() {
	// Run on a thread whose native stack exceeds the engine's 4 MiB budget,
	// so QuickJS's own guard throws a catchable RangeError instead of
	// overflowing natively. Both renderToString attempts then fail and the
	// bootstrap returns the stringified first error (the katex-error path).
	let handle = std::thread::Builder::new()
		.stack_size(32 * 1024 * 1024)
		.spawn(|| render_math(&deep_formula(), false))
		.expect("spawn render thread");
	let outcome = handle.join().expect("render thread completes");
	let error = outcome.clone().expect_err("both attempts should fail");
	assert!(
		error.contains("Maximum call stack size exceeded"),
		"got: {error}"
	);
	// Errors are memoized too: the retry never touches the engine (safe on
	// this small-stack thread).
	assert_eq!(render_math(&deep_formula(), false), outcome);
}

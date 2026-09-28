//! WRITR-RS PATCH: bounded recursion.
//!
//! KaTeX parses and builds recursively. In JavaScript, a deeply nested formula
//! makes V8 throw `RangeError: Maximum call stack size exceeded`, which
//! `renderToString` rethrows even with `throwOnError: false` (it is not a
//! `ParseError`). Upstream katex-rs had no limit, so such input overflowed
//! the native stack and aborted the process. Recursion points call [`check`],
//! which fails with [`ParseErrorKind::StackOverflow`] once a render has used
//! [`BUDGET`] bytes of stack — the same order of magnitude as V8's ~1 MB, so
//! the depth at which rendering gives up is close to, but not exactly,
//! JavaScript's.

use core::cell::Cell;

use crate::types::{ParseError, ParseErrorKind};

/// Stack a render may use below its entry point.
pub const BUDGET: usize = 1 << 20;

std::thread_local! {
	/// Stack address at the outermost render entry on this thread (0: none).
	static BASE: Cell<usize> = const { Cell::new(0) };
}

/// The address of a stack local: how deep this thread's stack currently is.
#[inline(always)]
fn stack_pointer() -> usize {
	let marker = 0_u8;
	core::hint::black_box(&marker) as *const u8 as usize
}

/// Marks a render entry point; the outermost scope on a thread sets the base.
pub struct RenderScope {
	outermost: bool,
}

impl RenderScope {
	/// Enters a render.
	#[must_use]
	pub fn enter() -> Self {
		let outermost = BASE.with(Cell::get) == 0;
		if outermost {
			BASE.with(|base| base.set(stack_pointer()));
		}
		Self { outermost }
	}
}

impl Drop for RenderScope {
	fn drop(&mut self) {
		if self.outermost {
			BASE.with(|base| base.set(0));
		}
	}
}

/// Fails once the current render has used up [`BUDGET`].
#[inline]
pub fn check() -> Result<(), ParseError> {
	let base = BASE.with(Cell::get);
	if base != 0 && base.saturating_sub(stack_pointer()) > BUDGET {
		return Err(ParseError::new(ParseErrorKind::StackOverflow));
	}
	Ok(())
}

/// WRITR-RS PATCH: the most elements a JavaScript spread call
/// (`f(...array)`, e.g. `stack.push(...tokens)`) takes before V8 throws
/// `RangeError: Maximum call stack size exceeded`. V8 passes each element as
/// an argument on its stack, which holds 984 KB (125,952 slots) in Node by
/// default; what the callers' frames already use leaves room for about
/// 125,000–125,600 arguments at the depths KaTeX spreads from (measured with
/// katex@0.18.7: `\frac{x…}{y}` 125,468, `\def\a#1{#1}\a{x…}` 125,554,
/// `\color{red}x1x1…` 125,587). The exact bound moves with the stack depth
/// and V8's JIT state; formulas that reach it grow far past it.
pub const MAX_SPREAD_ARGS: usize = 125_500;

/// WRITR-RS PATCH: fails like V8 when a spread call would pass more than
/// [`MAX_SPREAD_ARGS`] arguments. Array literals (`[...a, ...b]`) have no
/// such limit, only calls.
#[inline]
pub fn check_spread(args: usize) -> Result<(), ParseError> {
	if args > MAX_SPREAD_ARGS {
		return Err(ParseError::new(ParseErrorKind::StackOverflow));
	}
	Ok(())
}

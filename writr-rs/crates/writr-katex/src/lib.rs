//! KaTeX rendering for writr-rs.
//!
//! Byte-exact parity with rehype-katex requires the exact KaTeX version the
//! goldens were generated with (0.16.45 — markup carries version-sensitive
//! layout floats). Rather than porting a TeX layout engine, this crate runs
//! the real `katex.min.js` (vendored from the npm package, MIT licensed) on
//! an embedded QuickJS runtime.
//!
//! The call sequence mirrors rehype-katex@7.0.1: `renderToString` with
//! `throwOnError: true`; on error retry with `strict: 'ignore'` and
//! `throwOnError: false`; if that also fails, the caller builds the
//! `katex-error` span from the *first* error's message.
//!
//! Results are memoized per `(formula, display_mode)` process-wide; each
//! thread lazily initializes its own QuickJS context (QuickJS is
//! single-threaded by design).

use rquickjs::{Context, Function, Object, Runtime};
use std::cell::OnceCell;
use std::collections::HashMap;
use std::sync::Mutex;

const KATEX_SOURCE: &str = include_str!("../vendor/katex.min.js");

/// The KaTeX version this crate embeds.
pub const KATEX_VERSION: &str = "0.16.45";

const BOOTSTRAP: &str = r#"
function __writrKatex(value, displayMode) {
	try {
		return "H" + katex.renderToString(value, {
			displayMode: displayMode,
			throwOnError: true
		});
	} catch (error) {
		try {
			return "H" + katex.renderToString(value, {
				displayMode: displayMode,
				strict: "ignore",
				throwOnError: false
			});
		} catch (unused) {
			return "E" + String(error);
		}
	}
}
"#;

/// Rendered math, or the stringified first error (for `katex-error` markup).
pub type RenderOutcome = Result<String, String>;

fn memo() -> &'static Mutex<HashMap<(String, bool), RenderOutcome>> {
	static MEMO: std::sync::OnceLock<Mutex<HashMap<(String, bool), RenderOutcome>>> =
		std::sync::OnceLock::new();
	MEMO.get_or_init(|| Mutex::new(HashMap::new()))
}

thread_local! {
	static ENGINE: OnceCell<Context> = const { OnceCell::new() };
}

fn with_engine<T>(f: impl FnOnce(&Context) -> T) -> T {
	ENGINE.with(|cell| {
		let context = cell.get_or_init(|| {
			let runtime = Runtime::new().expect("QuickJS runtime");
			// KaTeX's parser recurses; the QuickJS default stack is too
			// small for deeply nested formulas.
			runtime.set_max_stack_size(4 * 1024 * 1024);
			let context = Context::full(&runtime).expect("QuickJS context");
			context.with(|ctx| {
				ctx.eval::<(), _>(KATEX_SOURCE)
					.expect("katex.min.js evaluates");
				ctx.eval::<(), _>(BOOTSTRAP).expect("bootstrap evaluates");
			});
			context
		});
		f(context)
	})
}

/// Render a TeX formula to KaTeX HTML (rehype-katex's exact call sequence).
pub fn render_math(formula: &str, display_mode: bool) -> RenderOutcome {
	let key = (formula.to_string(), display_mode);
	if let Some(hit) = memo().lock().expect("memo lock").get(&key) {
		return hit.clone();
	}
	let outcome = with_engine(|context| {
		context.with(|ctx| {
			let globals = ctx.globals();
			let render: Function = globals.get("__writrKatex").expect("bootstrap function");
			let result: String = render
				.call((formula, display_mode))
				.unwrap_or_else(|error| {
					// Engine-level failure (out of memory/stack) — surface as
					// an error string; the pipeline renders katex-error markup.
					let _ = &error;
					format!("E{error}")
				});
			let _ = Object::new(ctx.clone());
			match result.split_at(1) {
				("H", html) => Ok(html.to_string()),
				(_, error) => Err(error.to_string()),
			}
		})
	});
	memo()
		.lock()
		.expect("memo lock")
		.insert(key, outcome.clone());
	outcome
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn renders_inline_math() {
		let html = render_math("a^2 + b^2 = c^2", false).expect("valid formula");
		assert!(
			html.starts_with("<span class=\"katex\">"),
			"got: {}",
			&html[..80]
		);
		assert!(html.contains("katex-mathml"));
		assert!(html.contains("annotation encoding=\"application/x-tex\""));
	}

	#[test]
	fn renders_display_math() {
		let html = render_math("\\int_0^1 x", true).expect("valid formula");
		assert!(
			html.starts_with("<span class=\"katex-display\">"),
			"got: {}",
			&html[..80]
		);
	}

	#[test]
	fn memoizes_results() {
		let first = render_math("x+1", false).unwrap();
		let second = render_math("x+1", false).unwrap();
		assert_eq!(first, second);
	}

	#[test]
	fn parse_errors_render_katex_error_markup() {
		// The first call throws; the `strict: 'ignore'`/`throwOnError: false`
		// retry succeeds with KaTeX's own inline error span — exactly the
		// rehype-katex flow.
		let html = render_math("\\frac{", false).expect("retry renders");
		assert!(html.contains("katex-error"), "got: {html}");
		assert!(html.contains("ParseError"), "got: {html}");
	}
}

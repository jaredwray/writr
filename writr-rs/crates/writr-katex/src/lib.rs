//! KaTeX rendering for writr-rs.
//!
//! Byte-exact parity with rehype-katex requires the exact KaTeX version the
//! goldens were generated with (0.18.7 — markup carries version-sensitive
//! layout floats). Rather than porting a TeX layout engine, this crate runs
//! the real `katex.min.js` (vendored from the npm package, MIT licensed) on
//! an embedded QuickJS runtime.
//!
//! The call sequence mirrors rehype-katex@7.0.1: `renderToString` with
//! `throwOnError: true`; on error retry with `strict: 'ignore'` and
//! `throwOnError: false`; if that also fails, the caller builds the
//! `katex-error` span from the *first* error's message.
//!
//! Results are memoized in a bounded FIFO cache per `(formula, display_mode)`
//! process-wide (256 entries / 4 MiB of payload); each
//! thread lazily initializes its own QuickJS context (QuickJS is
//! single-threaded by design).

use rquickjs::{Context, Function, Object, Runtime};
use std::cell::OnceCell;
use std::sync::Mutex;

#[doc(hidden)]
pub mod cache;

use cache::MathCache;

const KATEX_SOURCE: &str = include_str!("../vendor/katex.min.js");

/// The KaTeX version this crate embeds.
pub const KATEX_VERSION: &str = "0.18.7";

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

fn memo() -> &'static Mutex<MathCache<RenderOutcome>> {
	static MEMO: std::sync::OnceLock<Mutex<MathCache<RenderOutcome>>> = std::sync::OnceLock::new();
	MEMO.get_or_init(|| Mutex::new(MathCache::default()))
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
	render_math_with_cache(formula, display_mode, true)
}

/// Render with optional memoization. `false` bypasses both cache reads and writes;
/// the thread's QuickJS context is still reused.
pub fn render_math_with_cache(formula: &str, display_mode: bool, caching: bool) -> RenderOutcome {
	if caching {
		if let Some(hit) = memo().lock().expect("memo lock").get(formula, display_mode) {
			return hit.clone();
		}
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
	if caching {
		let retained = outcome.clone();
		let bytes = match &retained {
			Ok(html) => html.capacity(),
			Err(error) => error.capacity(),
		};
		memo()
			.lock()
			.expect("memo lock")
			.insert(formula, display_mode, retained, bytes);
	}
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

	#[test]
	fn html_cache_stays_bounded_under_unique_formulas() {
		for i in 0..cache::MAX_ENTRIES * 3 {
			let formula = format!("h_{{{i}}}+7");
			assert!(render_math(&formula, i % 2 == 0).unwrap().contains("katex"));
			let cache = memo().lock().unwrap();
			assert!(cache.len() <= cache::MAX_ENTRIES);
			assert!(cache.bytes() <= cache::MAX_BYTES);
		}
		assert!(memo().lock().unwrap().get("h_{0}+7", true).is_none());
	}

	#[test]
	fn disabled_cache_bypasses_reads_and_writes() {
		// Seed an unmistakable value to prove a disabled call does not read it.
		let formula = "bypass_{987654321}";
		memo()
			.lock()
			.unwrap()
			.insert(formula, false, Ok("sentinel".into()), 8);
		let html = render_math_with_cache(formula, false, false).unwrap();
		assert!(html.contains("katex"));
		for i in 0..32 {
			let formula = format!("uncached_{{{i}}}");
			assert!(render_math_with_cache(&formula, false, false).is_ok());
			assert!(memo().lock().unwrap().get(&formula, false).is_none());
		}
	}
}

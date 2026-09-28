//! KaTeX rendering for writr-rs.
//!
//! Byte-exact parity with rehype-katex requires the exact KaTeX version the
//! goldens were generated with (0.18.7 — markup carries version-sensitive
//! layout floats). Rendering uses katex-rs, a native Rust implementation of
//! KaTeX, vendored under `vendor/katex-rs` with the patches that make its
//! output match katex@0.18.7 byte for byte (see `VENDORED.md` there);
//! `tests/corpus.rs` checks it against the real KaTeX.
//!
//! The call sequence mirrors rehype-katex@7.0.1: `renderToString` with
//! `throwOnError: true`; on error retry with `strict: 'ignore'` and
//! `throwOnError: false`; if that also fails, the caller builds the
//! `katex-error` span from the *first* error's message.
//!
//! Results are memoized in a bounded FIFO cache per `(formula, display_mode)`
//! process-wide (256 entries / 4 MiB of payload).

use katex::{KatexContext, Settings, StrictMode, StrictSetting};
use std::sync::{Mutex, OnceLock};

#[doc(hidden)]
pub mod cache;

use cache::MathCache;

/// The KaTeX version this crate reproduces.
pub const KATEX_VERSION: &str = "0.18.7";

/// Rendered math, or the stringified first error (for `katex-error` markup).
pub type RenderOutcome = Result<String, String>;

fn memo() -> &'static Mutex<MathCache<RenderOutcome>> {
	static MEMO: OnceLock<Mutex<MathCache<RenderOutcome>>> = OnceLock::new();
	MEMO.get_or_init(|| Mutex::new(MathCache::default()))
}

/// The function, symbol and environment tables, built once per process.
fn context() -> &'static KatexContext {
	static CONTEXT: OnceLock<KatexContext> = OnceLock::new();
	CONTEXT.get_or_init(KatexContext::default)
}

/// rehype-katex's two `renderToString` attempts.
fn render_uncached(formula: &str, display_mode: bool) -> RenderOutcome {
	let first = Settings::builder()
		.display_mode(display_mode)
		.throw_on_error(true)
		.build();
	let error = match katex::render_to_string(context(), formula, &first) {
		Ok(html) => return Ok(html),
		Err(error) => error,
	};
	let retry = Settings::builder()
		.display_mode(display_mode)
		.strict(StrictSetting::Mode(StrictMode::Ignore))
		.throw_on_error(false)
		.build();
	katex::render_to_string(context(), formula, &retry).map_err(|_| error.to_js_string())
}

/// Render a TeX formula to KaTeX HTML (rehype-katex's exact call sequence).
pub fn render_math(formula: &str, display_mode: bool) -> RenderOutcome {
	render_math_with_cache(formula, display_mode, true)
}

/// Render with optional memoization. `false` bypasses both cache reads and writes.
pub fn render_math_with_cache(formula: &str, display_mode: bool, caching: bool) -> RenderOutcome {
	if caching {
		if let Some(hit) = memo().lock().expect("memo lock").get(formula, display_mode) {
			return hit.clone();
		}
	}
	let outcome = render_uncached(formula, display_mode);
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

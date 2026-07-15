//! Error contract of the engine.
//!
//! The JS engine swallows errors, emits an `"error"` event, and returns `""`;
//! its harness adapter re-throws anything emitted. The Rust engine returns
//! `Result` instead — the Node binding maps `Err` to a thrown `Error`, which
//! is behaviorally identical to the adapter's `throwIfEmitted`.
//!
//! For non-MDX options `render` is total: it never errors on any input.

use core::fmt;

/// Rendering failure.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RenderError {
	/// The parser rejected the input. Only reachable with `mdx: true`
	/// (MDX has actual syntax errors; CommonMark does not).
	Parse(String),
	/// A runtime flag was enabled but the corresponding cargo feature was
	/// compiled out. Loud by design — never silently diverge from the
	/// requested configuration.
	FeatureDisabled(&'static str),
	/// The embedded KaTeX engine failed to initialize or evaluate.
	/// (Formula errors do not take this path — rehype-katex renders them
	/// inline as `katex-error` markup.)
	Math(String),
}

impl fmt::Display for RenderError {
	fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
		match self {
			Self::Parse(message) => write!(f, "markdown parse error: {message}"),
			Self::FeatureDisabled(feature) => write!(
				f,
				"the `{feature}` option is enabled but writr-core was compiled without the `{feature}` feature"
			),
			Self::Math(message) => write!(f, "math rendering error: {message}"),
		}
	}
}

impl std::error::Error for RenderError {}

//! writr-core — a Rust markdown engine that reproduces writr's JS
//! unified/remark/rehype pipeline byte-for-byte.
//!
//! The compatibility contract is the golden-snapshot harness in the writr
//! repository (`test/harness/`): ~2,000 golden HTML files across seven render
//! profiles, compared byte-exactly. See `crates/writr-conformance`.
//!
//! ```
//! use writr_core::{render, RenderOptions};
//!
//! let html = render("# Hello World", &RenderOptions::default()).unwrap();
//! assert_eq!(html, "<h1 id=\"hello-world\">Hello World</h1>");
//! ```

mod error;
mod frontmatter;
mod js;
mod options;
mod pipeline;
#[cfg(any(feature = "slug", feature = "toc"))]
mod slugger;

mod generated;
pub mod hast;
mod mdast_util;

pub use error::RenderError;
pub use options::RenderOptions;

/// The KaTeX version embedded by the math stage (for drift auditing).
#[cfg(feature = "math")]
pub const KATEX_VERSION: &str = writr_katex::KATEX_VERSION;
#[cfg(not(feature = "math"))]
pub const KATEX_VERSION: &str = "disabled";

/// Render markdown to HTML under the given options.
///
/// For non-MDX options this never fails on any input (matching the JS
/// engine, which has no error path for plain markdown).
pub fn render(input: &str, options: &RenderOptions) -> Result<String, RenderError> {
	pipeline::render(input, options)
}

/// Validate markdown: parse and run every enabled transform without
/// serializing (the equivalent of writr's `validate`, which runs the
/// processor without stringify).
pub fn validate(input: &str, options: &RenderOptions) -> Result<(), RenderError> {
	pipeline::render_to_hast(input, options).map(|_| ())
}

/// Front-matter helpers matching writr's getters byte-for-byte.
pub mod front_matter {
	/// The raw front-matter block including delimiters, or `""`.
	pub fn raw(content: &str) -> &str {
		crate::frontmatter::front_matter_raw(content)
	}

	/// The body with front matter stripped (trimmed only when front matter
	/// was present — a load-bearing writr quirk).
	pub fn body(content: &str) -> &str {
		crate::frontmatter::body(content)
	}
}

/// Parse markdown to an mdast tree (exposed for the Node binding's
/// `renderToMdast`).
pub fn parse_to_mdast(
	input: &str,
	options: &RenderOptions,
) -> Result<markdown::mdast::Node, RenderError> {
	pipeline::parse_to_mdast(input, options)
}

/// Render many documents under the same options.
///
/// With the `parallel` feature (native builds) documents render across the
/// rayon thread pool — the engine is stateless per call, so this is safe and
/// scales with cores. Without it (e.g. single-threaded wasm), rendering is
/// sequential. Order is preserved either way.
pub fn render_batch<S: AsRef<str> + Sync>(
	inputs: &[S],
	options: &RenderOptions,
) -> Vec<Result<String, RenderError>> {
	#[cfg(feature = "parallel")]
	{
		use rayon::prelude::*;
		inputs
			.par_iter()
			.map(|input| render(input.as_ref(), options))
			.collect()
	}
	#[cfg(not(feature = "parallel"))]
	{
		inputs
			.iter()
			.map(|input| render(input.as_ref(), options))
			.collect()
	}
}

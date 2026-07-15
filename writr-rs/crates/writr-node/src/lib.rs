//! Node.js bindings for writr-rs.
//!
//! The option object mirrors writr's JS `RenderOptions` (src/types.ts) —
//! camelCase fields, all optional, falling back to the JS defaults.
//! `caching` is accepted and ignored (the engine is deterministic and
//! stateless; caching remains a concern of the JS wrapper).
//!
//! Errors are thrown as JS `Error`s with a `writr-rs:` prefix — behaviorally
//! matching the harness adapter's `throwIfEmitted` for the JS engine.

use napi::bindgen_prelude::AsyncTask;
use napi::{Env, Error, Result, Task};
use napi_derive::napi;

#[napi(object)]
#[derive(Default, Clone, Copy)]
pub struct RenderOptions {
	pub emoji: Option<bool>,
	pub toc: Option<bool>,
	pub slug: Option<bool>,
	pub highlight: Option<bool>,
	pub gfm: Option<bool>,
	pub math: Option<bool>,
	pub mdx: Option<bool>,
	pub raw_html: Option<bool>,
	/// Accepted for API compatibility; the engine has no cache.
	pub caching: Option<bool>,
}

fn to_core(options: Option<RenderOptions>) -> writr_core::RenderOptions {
	let defaults = writr_core::RenderOptions::default();
	let options = options.unwrap_or_default();
	writr_core::RenderOptions {
		emoji: options.emoji.unwrap_or(defaults.emoji),
		toc: options.toc.unwrap_or(defaults.toc),
		slug: options.slug.unwrap_or(defaults.slug),
		highlight: options.highlight.unwrap_or(defaults.highlight),
		gfm: options.gfm.unwrap_or(defaults.gfm),
		math: options.math.unwrap_or(defaults.math),
		mdx: options.mdx.unwrap_or(defaults.mdx),
		raw_html: options.raw_html.unwrap_or(defaults.raw_html),
	}
}

fn map_error(error: writr_core::RenderError) -> Error {
	Error::from_reason(format!("writr-rs: {error}"))
}

/// Render markdown to HTML (synchronous).
#[napi]
pub fn render(input: String, options: Option<RenderOptions>) -> Result<String> {
	writr_core::render(&input, &to_core(options)).map_err(map_error)
}

pub struct RenderTask {
	input: String,
	options: writr_core::RenderOptions,
}

#[napi]
impl Task for RenderTask {
	type Output = String;
	type JsValue = String;

	fn compute(&mut self) -> Result<String> {
		writr_core::render(&self.input, &self.options).map_err(map_error)
	}

	fn resolve(&mut self, _env: Env, output: String) -> Result<String> {
		Ok(output)
	}
}

/// Render markdown to HTML off the main thread.
#[napi]
pub fn render_async(input: String, options: Option<RenderOptions>) -> AsyncTask<RenderTask> {
	AsyncTask::new(RenderTask {
		input,
		options: to_core(options),
	})
}

/// Validate markdown: parse and run every enabled transform.
#[napi]
pub fn validate(input: String, options: Option<RenderOptions>) -> Result<()> {
	writr_core::validate(&input, &to_core(options)).map_err(map_error)
}

/// Parse markdown to mdast, returned as a JSON string.
#[napi]
pub fn render_to_mdast(input: String, options: Option<RenderOptions>) -> Result<String> {
	let tree = writr_core::parse_to_mdast(&input, &to_core(options)).map_err(map_error)?;
	serde_json::to_string(&tree).map_err(|error| Error::from_reason(error.to_string()))
}

/// Engine + pinned third-party versions, for drift auditing.
#[napi]
pub fn engine_version() -> String {
	format!(
		"writr-rs {} (katex {}, highlight.js 11.11.1)",
		env!("CARGO_PKG_VERSION"),
		writr_core::KATEX_VERSION,
	)
}

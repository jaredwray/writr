//! Node.js bindings for writr-rs.
//!
//! The option object mirrors writr's JS `RenderOptions` (src/types.ts) —
//! camelCase fields, all optional, falling back to the JS defaults.
//! `caching` is accepted and ignored (the engine is deterministic and
//! stateless; caching remains a concern of the JS wrapper).
//!
//! Errors are thrown as JS `Error`s with a `writr-rs:` prefix — behaviorally
//! matching the harness adapter's `throwIfEmitted` for the JS engine.

use napi::bindgen_prelude::{AsyncTask, Buffer, Uint32Array};
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

fn batch<S: AsRef<str> + Sync>(
	inputs: &[S],
	options: &writr_core::RenderOptions,
) -> Result<Vec<String>> {
	writr_core::render_batch(inputs, options)
		.into_iter()
		.collect::<std::result::Result<Vec<_>, _>>()
		.map_err(map_error)
}

/// Slice a packed document buffer at `offsets` boundaries: document `i` is
/// `input[offsets[i]..offsets[i + 1]]` and must be valid UTF-8.
fn buffer_documents<'b>(input: &'b [u8], offsets: &[u32]) -> Result<Vec<&'b str>> {
	let mut documents = Vec::with_capacity(offsets.len().saturating_sub(1));
	for pair in offsets.windows(2) {
		let (start, end) = (pair[0] as usize, pair[1] as usize);
		if start > end || end > input.len() {
			return Err(Error::from_reason(format!(
				"writr-rs: invalid document range [{start}, {end}) for a {}-byte buffer",
				input.len(),
			)));
		}
		let document = std::str::from_utf8(&input[start..end]).map_err(|error| {
			Error::from_reason(format!(
				"writr-rs: document at [{start}, {end}) is not UTF-8: {error}"
			))
		})?;
		documents.push(document);
	}
	Ok(documents)
}

/// Render many documents under the same options — across all cores on
/// native builds (order preserved). This is the highest-throughput path
/// for multi-document workloads.
#[napi]
pub fn render_batch(inputs: Vec<String>, options: Option<RenderOptions>) -> Result<Vec<String>> {
	batch(&inputs, &to_core(options))
}

pub struct RenderBatchTask {
	inputs: Vec<String>,
	options: writr_core::RenderOptions,
}

#[napi]
impl Task for RenderBatchTask {
	type Output = Vec<String>;
	type JsValue = Vec<String>;

	fn compute(&mut self) -> Result<Vec<String>> {
		batch(&self.inputs, &self.options)
	}

	fn resolve(&mut self, _env: Env, output: Vec<String>) -> Result<Vec<String>> {
		Ok(output)
	}
}

/// `renderBatch`, computed off the main thread.
#[napi]
pub fn render_batch_async(
	inputs: Vec<String>,
	options: Option<RenderOptions>,
) -> AsyncTask<RenderBatchTask> {
	AsyncTask::new(RenderBatchTask {
		inputs,
		options: to_core(options),
	})
}

/// A batch result packed into one buffer: document `i` is
/// `html[offsets[i]..offsets[i + 1]]` (UTF-8).
#[napi(object)]
pub struct PackedBatch {
	pub html: Buffer,
	pub offsets: Uint32Array,
}

fn pack(rendered: Vec<String>) -> Result<PackedBatch> {
	let total: usize = rendered.iter().map(String::len).sum();
	if u32::try_from(total).is_err() {
		return Err(Error::from_reason(
			"writr-rs: batch output exceeds 4 GiB — split the batch".to_string(),
		));
	}
	let mut offsets = Vec::with_capacity(rendered.len() + 1);
	let mut html = Vec::with_capacity(total);
	offsets.push(0u32);
	for document in &rendered {
		html.extend_from_slice(document.as_bytes());
		offsets.push(html.len() as u32);
	}
	Ok(PackedBatch {
		html: html.into(),
		offsets: offsets.into(),
	})
}

/// `renderBatch` over one packed UTF-8 buffer plus `n + 1` boundary offsets
/// (document `i` is bytes `offsets[i]..offsets[i + 1]`), returning the
/// rendered HTML in the same packed shape. One V8→native handoff each way
/// and zero per-document string conversion on the main thread — the fastest
/// path when documents already live in Buffers (e.g. read from disk) and
/// the output goes back to bytes (e.g. written to disk).
#[napi]
pub fn render_batch_buffer(
	input: Buffer,
	offsets: Uint32Array,
	options: Option<RenderOptions>,
) -> Result<PackedBatch> {
	let documents = buffer_documents(&input, &offsets)?;
	pack(batch(&documents, &to_core(options))?)
}

pub struct RenderBatchBufferTask {
	input: Buffer,
	offsets: Vec<u32>,
	options: writr_core::RenderOptions,
}

#[napi]
impl Task for RenderBatchBufferTask {
	type Output = Vec<String>;
	type JsValue = PackedBatch;

	fn compute(&mut self) -> Result<Vec<String>> {
		let documents = buffer_documents(&self.input, &self.offsets)?;
		batch(&documents, &self.options)
	}

	fn resolve(&mut self, _env: Env, output: Vec<String>) -> Result<PackedBatch> {
		pack(output)
	}
}

/// `renderBatchBuffer`, computed off the main thread.
#[napi]
pub fn render_batch_buffer_async(
	input: Buffer,
	offsets: Uint32Array,
	options: Option<RenderOptions>,
) -> AsyncTask<RenderBatchBufferTask> {
	AsyncTask::new(RenderBatchBufferTask {
		input,
		offsets: offsets.to_vec(),
		options: to_core(options),
	})
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

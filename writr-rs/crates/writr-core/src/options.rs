//! Render options mirroring writr's JS `RenderOptions` (src/types.ts) 1:1.
//!
//! `caching` is intentionally absent: the engine is deterministic and
//! stateless per call, and caching stays a concern of the JS wrapper.

/// Feature flags for a render, matching the JS engine's defaults.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RenderOptions {
	/// Emoji shortcode replacement (remark-emoji). Default: `true`.
	pub emoji: bool,
	/// Table-of-contents generation (remark-toc). Default: `true`.
	pub toc: bool,
	/// Heading id generation (rehype-slug). Default: `true`.
	pub slug: bool,
	/// Syntax highlighting (rehype-highlight). Default: `true`.
	pub highlight: bool,
	/// GitHub Flavored Markdown *and* GitHub blockquote alerts. Default: `true`.
	pub gfm: bool,
	/// Math parsing (remark-math) *and* KaTeX rendering (rehype-katex).
	/// Default: `true`.
	pub math: bool,
	/// MDX support (remark-mdx + writr's custom JSX handler). Default: `false`.
	pub mdx: bool,
	/// Raw HTML passthrough (remark-rehype `allowDangerousHtml` + rehype-raw).
	/// Default: `false`.
	pub raw_html: bool,
}

impl Default for RenderOptions {
	fn default() -> Self {
		Self {
			emoji: true,
			toc: true,
			slug: true,
			highlight: true,
			gfm: true,
			math: true,
			mdx: false,
			raw_html: false,
		}
	}
}

impl RenderOptions {
	/// All flags off — the bare parse → convert → stringify pipeline
	/// (the harness `commonmark` profile).
	pub fn all_off() -> Self {
		Self {
			emoji: false,
			toc: false,
			slug: false,
			highlight: false,
			gfm: false,
			math: false,
			mdx: false,
			raw_html: false,
		}
	}
}

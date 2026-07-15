//! Pipeline orchestration mirroring writr's `createProcessor()` order
//! (src/writr.ts:629-691):
//!
//! ```text
//! frontmatter strip (always — writr renders `body`, never raw content)
//!   → parse (remark-parse [+gfm] [+math] [+mdx])
//!   → mdast: [gfm] alerts → [toc] toc → [emoji] emoji
//!   → mdast→hast ([mdx] custom JSX handler; [rawHtml] keep raw nodes)
//!   → hast: [rawHtml] raw → [slug] slug → [highlight] highlight → [math] katex
//!   → stringify
//! ```
//!
//! Alerts are folded into the blockquote handler of the mdast→hast stage —
//! see `hast::from_mdast` for the equivalence argument.

use crate::error::RenderError;
use crate::hast::{from_mdast, to_html};
use crate::options::RenderOptions;
use crate::{frontmatter, hast};
use markdown::ParseOptions;

/// Check that every enabled runtime flag has its cargo feature compiled in.
fn check_features(options: &RenderOptions) -> Result<(), RenderError> {
	macro_rules! ensure {
		($flag:expr, $feature:literal) => {
			#[cfg(not(feature = $feature))]
			if $flag {
				return Err(RenderError::FeatureDisabled($feature));
			}
		};
	}
	ensure!(options.gfm, "gfm");
	ensure!(options.toc, "toc");
	ensure!(options.emoji, "emoji");
	ensure!(options.math, "math");
	ensure!(options.mdx, "mdx");
	ensure!(options.raw_html, "raw-html");
	ensure!(options.slug, "slug");
	ensure!(options.highlight, "highlight");
	let _ = options;
	Ok(())
}

/// Build markdown-rs parse options for a writr render configuration.
fn parse_options(options: &RenderOptions) -> ParseOptions {
	let mut constructs = if options.gfm {
		markdown::Constructs::gfm()
	} else {
		markdown::Constructs::default()
	};
	// Writr strips front matter itself; the construct stays off so a
	// stray `---` parses as CommonMark (thematic break / setext heading).
	constructs.frontmatter = false;
	if options.math {
		constructs.math_flow = true;
		constructs.math_text = true;
	}
	if options.mdx {
		// remark-mdx (micromark-extension-mdxjs): MDX adds JSX/expressions/ESM
		// and removes autolinks, indented code, and HTML.
		constructs.mdx_jsx_flow = true;
		constructs.mdx_jsx_text = true;
		constructs.mdx_expression_flow = true;
		constructs.mdx_expression_text = true;
		constructs.mdx_esm = true;
		constructs.autolink = false;
		constructs.code_indented = false;
		constructs.html_flow = false;
		constructs.html_text = false;
	}

	ParseOptions {
		constructs,
		..ParseOptions::default()
	}
}

/// Render markdown to HTML.
pub fn render(input: &str, options: &RenderOptions) -> Result<String, RenderError> {
	Ok(to_html::to_html(
		&render_to_hast(input, options)?,
		to_html::Options {
			allow_dangerous_html: options.raw_html,
		},
	))
}

/// Parse and transform without serializing (used by `validate`).
pub fn render_to_hast(
	input: &str,
	options: &RenderOptions,
) -> Result<hast::Node, RenderError> {
	let mdast = parse_to_mdast(input, options)?;
	Ok(transform(mdast, options))
}

/// Parse the (frontmatter-stripped) body to mdast.
pub fn parse_to_mdast(
	input: &str,
	options: &RenderOptions,
) -> Result<markdown::mdast::Node, RenderError> {
	check_features(options)?;
	let body = frontmatter::body(input);
	markdown::to_mdast(body, &parse_options(options))
		.map_err(|message| RenderError::Parse(message.to_string()))
}

/// mdast transforms + conversion + hast transforms.
fn transform(mdast: markdown::mdast::Node, options: &RenderOptions) -> hast::Node {
	// mdast stage (writr order: alerts → toc → emoji; alerts are folded
	// into the conversion below). The gfm autolink-literal find-and-replace
	// belongs to parsing itself (remark-gfm registers it as a
	// mdast-util-from-markdown transform), so it runs before everything.
	let mut mdast = mdast;
	if options.gfm {
		crate::mdast_util::gfm_autolink::transform(&mut mdast);
	}
	if options.toc {
		crate::mdast_util::toc::transform(&mut mdast);
	}
	if options.emoji {
		crate::mdast_util::emoji::transform(&mut mdast);
	}

	let mut tree = from_mdast::from_mdast(
		&mdast,
		from_mdast::Options::from_render_options(options),
	);

	// hast stage: raw → slug → [highlight] (M4) → [math] (M5).
	#[cfg(feature = "raw-html")]
	if options.raw_html {
		tree = hast::raw::process(&tree);
	}
	if options.slug {
		hast::slug::transform(&mut tree);
	}
	tree
}

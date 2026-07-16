//! Public API surface: `render`, `validate`, `front_matter`, `parse_to_mdast`,
//! `RenderOptions`, `RenderError`, `KATEX_VERSION`.
//!
//! HTML expectations are verbatim outputs of the JS engine
//! (`new Writr(input).render({...flags, caching: false})`).

use writr_core::{front_matter, parse_to_mdast, render, validate, RenderError, RenderOptions};

#[test]
fn default_options_match_the_js_engine_defaults() {
	let options = RenderOptions::default();
	assert!(options.emoji);
	assert!(options.toc);
	assert!(options.slug);
	assert!(options.highlight);
	assert!(options.gfm);
	assert!(options.math);
	assert!(!options.mdx);
	assert!(!options.raw_html);
}

#[test]
fn all_off_disables_everything() {
	let options = RenderOptions::all_off();
	assert_eq!(
		options,
		RenderOptions {
			emoji: false,
			toc: false,
			slug: false,
			highlight: false,
			gfm: false,
			math: false,
			mdx: false,
			raw_html: false,
		}
	);
}

#[test]
fn render_with_default_options() {
	// JS: new Writr('# Hello World').render({caching: false})
	let html = render("# Hello World", &RenderOptions::default()).unwrap();
	assert_eq!(html, "<h1 id=\"hello-world\">Hello World</h1>");
}

#[test]
fn render_plain_paragraph_all_off() {
	let html = render("Just text.", &RenderOptions::all_off()).unwrap();
	assert_eq!(html, "<p>Just text.</p>");
	assert_eq!(render("", &RenderOptions::all_off()).unwrap(), "");
}

#[test]
fn validate_accepts_plain_markdown() {
	assert!(validate("# ok\n\n- a\n- b", &RenderOptions::default()).is_ok());
	assert!(validate("*anything* goes", &RenderOptions::all_off()).is_ok());
}

#[test]
fn mdx_parse_failure_is_an_error() {
	// The JS engine throws on all three too ("Unexpected end of file in
	// expression…", "Unexpected closing slash…", "Expected a closing tag for
	// `<b>`…"); only mdx has a parse error path.
	let options = RenderOptions {
		mdx: true,
		..RenderOptions::all_off()
	};
	let error = render("a {1 +", &options).unwrap_err();
	assert!(matches!(error, RenderError::Parse(_)));
	assert!(error.to_string().starts_with("markdown parse error: "));
	assert!(error
		.to_string()
		.contains("expected a corresponding closing brace for `{`"));

	assert!(matches!(
		validate("</a>", &options),
		Err(RenderError::Parse(_))
	));
	assert!(matches!(
		parse_to_mdast("text <b> more", &options),
		Err(RenderError::Parse(_))
	));
	// The same inputs are fine as plain markdown.
	assert!(validate("a {1 +", &RenderOptions::all_off()).is_ok());
	assert!(validate("</a>", &RenderOptions::all_off()).is_ok());
}

#[test]
fn parse_to_mdast_returns_the_tree() {
	let tree = parse_to_mdast("# Hi", &RenderOptions::all_off()).unwrap();
	let markdown::mdast::Node::Root(root) = &tree else {
		panic!("expected a root, got {tree:?}");
	};
	assert_eq!(root.children.len(), 1);
	let markdown::mdast::Node::Heading(heading) = &root.children[0] else {
		panic!("expected a heading, got {:?}", root.children[0]);
	};
	assert_eq!(heading.depth, 1);
}

#[test]
fn parse_to_mdast_strips_front_matter() {
	// writr always renders `body` (front matter stripped before parsing).
	let tree = parse_to_mdast("---\ntitle: x\n---\n\nBody", &RenderOptions::all_off()).unwrap();
	let markdown::mdast::Node::Root(root) = &tree else {
		panic!("expected a root");
	};
	assert!(matches!(
		root.children.as_slice(),
		[markdown::mdast::Node::Paragraph(_)]
	));
}

#[test]
fn front_matter_getters_match_writr() {
	let content = "---\ntitle: x\n---\n\n# Hi\n";
	assert_eq!(front_matter::raw(content), "---\ntitle: x\n---\n");
	assert_eq!(front_matter::body(content), "# Hi");

	// Without front matter: raw is empty and the body is NOT trimmed
	// (writr trims only when front matter was present).
	assert_eq!(front_matter::raw("# Hi"), "");
	assert_eq!(front_matter::body("  # Hi \n"), "  # Hi \n");
}

#[test]
fn render_strips_front_matter() {
	// JS: new Writr("---\na: 1\n---\n\nHello").render(...) renders the body.
	let html = render("---\na: 1\n---\n\nHello", &RenderOptions::all_off()).unwrap();
	assert_eq!(html, "<p>Hello</p>");
}

#[test]
fn render_error_display_and_source() {
	let parse = RenderError::Parse("boom".into());
	assert_eq!(parse.to_string(), "markdown parse error: boom");

	let feature = RenderError::FeatureDisabled("gfm");
	assert_eq!(
		feature.to_string(),
		"the `gfm` option is enabled but writr-core was compiled without the `gfm` feature"
	);

	let math = RenderError::Math("no engine".into());
	assert_eq!(math.to_string(), "math rendering error: no engine");

	// RenderError is a std error; equality/clone/debug are derived.
	let boxed: Box<dyn std::error::Error> = Box::new(parse.clone());
	assert!(boxed.source().is_none());
	assert_eq!(parse, RenderError::Parse("boom".into()));
	assert_ne!(parse, math);
	assert!(!format!("{feature:?}").is_empty());
}

#[test]
fn render_batch_preserves_order_and_matches_render() {
	let options = RenderOptions::all_off();
	let inputs = vec!["# One".to_string(), "".to_string(), "Two *em*".to_string()];
	let batch = writr_core::render_batch(&inputs, &options);
	assert_eq!(batch.len(), 3);
	for (input, result) in inputs.iter().zip(&batch) {
		assert_eq!(result.as_ref().unwrap(), &render(input, &options).unwrap());
	}
	assert_eq!(batch[0].as_ref().unwrap(), "<h1>One</h1>");
	assert_eq!(batch[1].as_ref().unwrap(), "");

	// Errors stay per-document.
	let mdx = RenderOptions {
		mdx: true,
		..RenderOptions::all_off()
	};
	let mixed = writr_core::render_batch(&["ok".to_string(), "</a>".to_string()], &mdx);
	assert!(mixed[0].is_ok());
	assert!(matches!(mixed[1], Err(RenderError::Parse(_))));
}

#[test]
fn katex_version_is_pinned() {
	// The `math` feature is on by default; the constant carries the embedded
	// KaTeX version for drift auditing.
	assert_eq!(writr_core::KATEX_VERSION, "0.16.45");
}

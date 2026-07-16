//! End-to-end tests through the public API with the real grammar set,
//! exercising engine paths the fixture corpus misses: string begin/end
//! scopes, heredoc callbacks, shebang rejection, JSX opening-tag heuristics,
//! sub-language continuations, and auto-detection fallbacks.

use writr_hljs::{highlight, HlNode};

fn spans(nodes: &[HlNode]) -> String {
	let mut out = String::new();
	for node in nodes {
		match node {
			HlNode::Text(value) => out.push_str(value),
			HlNode::Span {
				class_names,
				children,
			} => {
				out.push_str(&format!("<{}>", class_names.join(" ")));
				out.push_str(&spans(children));
				out.push_str("</>");
			}
		}
	}
	out
}

fn flat(nodes: &[HlNode]) -> String {
	let mut out = String::new();
	for node in nodes {
		match node {
			HlNode::Text(value) => out.push_str(value),
			HlNode::Span { children, .. } => out.push_str(&flat(children)),
		}
	}
	out
}

#[test]
fn php_attribute_uses_begin_and_end_scopes() {
	let code = "#[Attr]\n$x = 1;\n";
	let result = highlight("php", code).unwrap();
	let rendered = spans(&result);
	assert_eq!(flat(&result), code);
	assert!(rendered.contains("<hljs-meta>#[Attr</>"), "got: {rendered}");
	assert!(rendered.contains("<hljs-meta>]</>"), "got: {rendered}");
}

#[test]
fn php_heredoc_callbacks_track_both_quote_forms() {
	let code = "$a = <<<EOT\none two\nEOT;\n$b = <<<\"DQ\"\nthree\nDQ;\n";
	let result = highlight("php", code).unwrap();
	let rendered = spans(&result);
	assert_eq!(flat(&result), code);
	// Both heredoc bodies end at their own label, not at inner words.
	assert!(
		rendered.contains("one two") && rendered.contains("three"),
		"got: {rendered}"
	);
	assert!(rendered.contains("<hljs-string>"), "got: {rendered}");
}

#[test]
fn bash_shebang_only_matches_at_document_start() {
	let result = highlight("bash", "#!/bin/bash\necho hi\n").unwrap();
	let rendered = spans(&result);
	assert!(
		rendered.contains("<hljs-meta>#!/bin/bash</>"),
		"got: {rendered}"
	);

	// Away from index 0 the shebang match is rejected and the line is an
	// ordinary comment.
	let code = "echo hi\n#!/bin/dash\n";
	let result = highlight("bash", code).unwrap();
	let rendered = spans(&result);
	assert_eq!(flat(&result), code);
	assert!(!rendered.contains("hljs-meta"), "got: {rendered}");
}

#[test]
fn jsx_lookalikes_are_rejected_by_the_opening_tag_heuristic() {
	// `,` right after the tag: a comparison, not JSX.
	let code = "x = <a,b\n";
	let result = highlight("javascript", code).unwrap();
	let rendered = spans(&result);
	assert_eq!(flat(&result), code);
	assert!(!rendered.contains("<xml>"), "got: {rendered}");

	// `=` after JS whitespace (U+2003 em space): not JSX.
	let code = "x = <a\u{2003}= 1\n";
	let result = highlight("javascript", code).unwrap();
	let rendered = spans(&result);
	assert_eq!(flat(&result), code);
	assert!(!rendered.contains("<xml>"), "got: {rendered}");

	// `extends` after whitespace: a generic constraint, not JSX.
	let code = "x = <a extends b> c\n";
	let result = highlight("javascript", code).unwrap();
	let rendered = spans(&result);
	assert_eq!(flat(&result), code);
	assert!(!rendered.contains("<xml>"), "got: {rendered}");

	// `<a>` without a matching closing tag: not JSX.
	let code = "x = <a>hi\n";
	let result = highlight("javascript", code).unwrap();
	let rendered = spans(&result);
	assert_eq!(flat(&result), code);
	assert!(!rendered.contains("<xml>"), "got: {rendered}");

	// `extends` NOT followed by whitespace is an ordinary tag name suffix.
	let code = "x = <a extendsy>hi</a>;\n";
	let result = highlight("javascript", code).unwrap();
	let rendered = spans(&result);
	assert_eq!(flat(&result), code);
	assert!(rendered.contains("<xml>"), "got: {rendered}");

	// A real element with a matching closing tag is JSX.
	let code = "x = <a>hi</a>;\n";
	let result = highlight("javascript", code).unwrap();
	let rendered = spans(&result);
	assert_eq!(flat(&result), code);
	assert!(rendered.contains("<xml>"), "got: {rendered}");

	// An attribute word after whitespace (not `extends`, not `=`) is JSX.
	let code = "x = <a b>hi</a>;\n";
	let result = highlight("javascript", code).unwrap();
	let rendered = spans(&result);
	assert_eq!(flat(&result), code);
	assert!(rendered.contains("<xml>"), "got: {rendered}");
}

#[test]
fn json_illegal_characters_stay_plain_text() {
	// With ignoreIllegals (lowlight's configuration) a non-zero-width illegal
	// match is written through as plain text.
	let code = "= x\n";
	let result = highlight("json", code).unwrap();
	assert_eq!(flat(&result), code);
	assert_eq!(spans(&result), code);
}

#[test]
fn shell_sub_language_continuation_reopens_scopes() {
	// The first prompt line leaves a bash double-quoted string open; the
	// second line resumes that continuation, reopening the string scope.
	let code = "$ echo \"one\n$ two\"\n";
	let result = highlight("shell", code).unwrap();
	let rendered = spans(&result);
	assert_eq!(flat(&result), code);
	assert!(
		rendered.contains("<hljs-string>two\"</>"),
		"got: {rendered}"
	);
}

#[test]
fn style_auto_detection_keeps_plain_text_when_nothing_scores() {
	// `=` is illegal in css (candidate aborts with relevance 0) and scores
	// nothing in xml, so the auto-detected block stays unwrapped plain text.
	let code = "<style>=</style>";
	let result = highlight("xml", code).unwrap();
	let rendered = spans(&result);
	assert_eq!(flat(&result), code);
	assert!(rendered.contains("<hljs-tag>"), "got: {rendered}");
	assert!(
		!rendered.contains("<css>") && !rendered.contains("<xml>"),
		"got: {rendered}"
	);
}

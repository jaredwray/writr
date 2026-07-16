//! The failure-reporting half of the conformance crate: divergence
//! rendering, allowlist matching, profile lookup, and `check` mismatch
//! paths. The golden suites only exercise the happy path — these tests pin
//! the reporting behavior that fires when parity breaks.
use std::path::Path;

use writr_conformance::{
	check, first_divergence, harness_dir, load_allowlist, normalize, profile, Golden, PROFILES,
};

#[test]
fn profile_lookup() {
	assert_eq!(profile("default").unwrap().name, "default");
	assert_eq!(profile("mdx").unwrap().name, "mdx");
	assert!(profile("nope").is_none());
	assert_eq!(PROFILES.len(), 7);
}

#[test]
fn harness_dir_env_override() {
	// Serialize the env mutation inside one test.
	let real = harness_dir();
	assert!(real.join("profiles.ts").exists() || real.join("goldens").exists());

	std::env::set_var("WRITR_HARNESS_DIR", real.as_os_str());
	assert_eq!(harness_dir(), real);
	std::env::remove_var("WRITR_HARNESS_DIR");
}

#[test]
fn first_divergence_reports_line_and_col() {
	let report = first_divergence("<p>abc</p>\n<p>x</p>", "<p>abd</p>\n<p>x</p>");
	assert!(report.contains("line 1, col 6"), "{report}");
	assert!(report.contains("expected: <p>abc</p>"), "{report}");
	assert!(report.contains("actual:   <p>abd</p>"), "{report}");
}

#[test]
fn first_divergence_line_count_mismatch() {
	let report = first_divergence("a\nb\nc", "a");
	assert!(report.contains("line counts differ"), "{report}");
	assert!(
		report.contains("expected 3 lines, actual 1 lines"),
		"{report}"
	);
}

#[test]
fn allowlist_missing_file_and_wildcards() {
	// Missing file → empty allowlist.
	let empty = load_allowlist(Path::new("/nonexistent-dir-writr-rs"));
	assert!(empty.matches("writr-rust", "default", "any-id").is_none());

	// The committed allowlist is empty — full parity, nothing allowlisted.
	let committed = load_allowlist(&harness_dir());
	assert!(committed
		.matches("writr-rust", "default", "corpus-0001")
		.is_none());

	// Wildcard semantics on a synthetic allowlist.
	let synthetic: writr_conformance::Allowlist = serde_json::from_str(
		r#"{"entries":[
			{"engine":"writr-rust","profile":"*","id":"corpus-0001","reason":"r1"},
			{"engine":"writr-rust","profile":"mdx","id":"*","reason":"r2"}
		]}"#,
	)
	.unwrap();
	assert_eq!(
		synthetic
			.matches("writr-rust", "gfm-only", "corpus-0001")
			.unwrap()
			.reason,
		"r1"
	);
	assert_eq!(
		synthetic
			.matches("writr-rust", "mdx", "anything")
			.unwrap()
			.reason,
		"r2"
	);
	assert!(synthetic.matches("writr-js", "mdx", "anything").is_none());
	assert!(synthetic
		.matches("writr-rust", "default", "corpus-0002")
		.is_none());
}

#[test]
fn check_reports_divergence_and_render_errors() {
	let dir = std::env::temp_dir().join("writr-rs-reporting-test");
	std::fs::create_dir_all(&dir).unwrap();

	// A golden that cannot match the render of its input.
	let input = dir.join("synthetic.md");
	let golden = dir.join("synthetic.html");
	std::fs::write(&input, "# Hello\n").unwrap();
	std::fs::write(&golden, "<h1>NOT THIS</h1>\n").unwrap();
	let bad = Golden {
		profile: "commonmark".to_string(),
		id: "synthetic".to_string(),
		input_path: input.clone(),
		golden_path: golden.clone(),
	};
	let options = profile("commonmark").unwrap().options;
	let report = check(&bad, &options).expect("divergence expected");
	assert!(report.contains("[commonmark/synthetic]"), "{report}");
	assert!(report.contains("first divergence"), "{report}");

	// A byte-exact golden → None.
	std::fs::write(&golden, "<h1>Hello</h1>\n").unwrap();
	assert!(check(&bad, &options).is_none());

	// An input that fails to render (MDX syntax error) → render error path.
	let mdx_input = dir.join("broken.mdx");
	let mdx_golden = dir.join("broken.html");
	std::fs::write(&mdx_input, "{unclosed\n").unwrap();
	std::fs::write(&mdx_golden, "").unwrap();
	let broken = Golden {
		profile: "mdx".to_string(),
		id: "broken".to_string(),
		input_path: mdx_input,
		golden_path: mdx_golden,
	};
	let mdx_options = profile("mdx").unwrap().options;
	let report = check(&broken, &mdx_options).expect("render error expected");
	assert!(report.contains("render error"), "{report}");

	// Normalize is the byte contract: CRLF, trailing ws, trailing newline.
	assert_eq!(
		normalize("<p>a</p>  \r\n<p>b</p>\r\n\r\n"),
		"<p>a</p>\n<p>b</p>\n"
	);

	let _ = std::fs::remove_dir_all(&dir);
}

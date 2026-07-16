//! Golden-snapshot conformance against `test/harness`.
//!
//! Each profile gets its own `#[test]` so progress is visible per milestone.
//! A profile test renders every corpus + diagnostic input and reports every
//! divergence (not just the first), honoring `allowlist.json` for the
//! `writr-rust` engine.

use writr_conformance::{
	check, corpus_goldens, diagnostic_goldens, harness_dir, load_allowlist, profile,
};

const ENGINE: &str = "writr-rust";

fn run_profile(profile_name: &str) {
	let harness = harness_dir();
	let allowlist = load_allowlist(&harness);
	let profile = profile(profile_name).expect("known profile");

	let mut goldens = corpus_goldens(&harness, profile_name);
	goldens.extend(diagnostic_goldens(&harness, profile_name));
	assert!(
		!goldens.is_empty(),
		"no goldens found for profile {profile_name} under {}",
		harness.display()
	);

	let mut failures = Vec::new();
	let mut allowed = 0usize;
	let total = goldens.len();
	for golden in &goldens {
		if let Some(report) = check(golden, &profile.options) {
			if allowlist
				.matches(ENGINE, profile_name, &golden.id)
				.is_some()
			{
				allowed += 1;
				continue;
			}
			failures.push(report);
		}
	}

	if !failures.is_empty() {
		let shown = failures.len().min(25);
		panic!(
			"{}/{} goldens diverged for profile `{}` ({} allowlisted). First {}:\n\n{}",
			failures.len(),
			total,
			profile_name,
			allowed,
			shown,
			failures[..shown].join("\n\n")
		);
	}
}

#[test]
fn commonmark_profile() {
	run_profile("commonmark");
}

#[test]
fn gfm_only_profile() {
	run_profile("gfm-only");
}

#[test]
fn rawhtml_profile() {
	run_profile("rawhtml");
}

#[test]
fn no_highlight_profile() {
	run_profile("no-highlight");
}

#[test]
fn no_math_profile() {
	run_profile("no-math");
}

#[test]
fn default_profile() {
	run_profile("default");
}

#[test]
fn mdx_profile() {
	run_profile("mdx");
}

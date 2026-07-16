//! Stage-level timing over a JSON array of markdown documents.
//!
//! ```sh
//! cargo run --release -p writr-core --example profile -- docs.json [iters]
//! ```
//!
//! `PROFILE_STAGES=render (minimal),parse` runs only stages whose label
//! contains one of the comma-separated needles (and warms up with those
//! stages' options instead of the default profile) — useful for scoping
//! callgrind runs to one pipeline configuration.
use std::time::Instant;

use writr_core::RenderOptions;

fn main() {
	let mut args = std::env::args().skip(1);
	let path = args.next().expect("usage: profile <docs.json> [iters]");
	let iters: usize = args.next().map_or(200, |raw| raw.parse().unwrap());
	let docs: Vec<String> = serde_json::from_str(&std::fs::read_to_string(path).unwrap()).unwrap();
	let bytes: usize = docs.iter().map(String::len).sum();
	println!(
		"{} docs, {} bytes total, {iters} iterations",
		docs.len(),
		bytes
	);

	let minimal = RenderOptions {
		emoji: false,
		toc: false,
		slug: false,
		highlight: false,
		gfm: false,
		math: false,
		mdx: false,
		raw_html: false,
	};
	let default = RenderOptions::default();

	let stages = std::env::var("PROFILE_STAGES").ok();
	let selected = |label: &str| {
		stages.as_deref().is_none_or(|needles| {
			needles
				.split(',')
				.any(|needle| label.contains(needle.trim()))
		})
	};

	// Warm up lazy state (grammar compilation, KaTeX context) — with the
	// default profile normally, or only the selected stages when filtered
	// (keeps e.g. hljs out of a minimal-scoped callgrind run).
	if stages.is_none() {
		for doc in &docs {
			let _ = writr_core::render(doc, &default);
		}
	}

	let mut sink = 0usize;

	if selected("parse_to_mdast (minimal)") {
		let start = Instant::now();
		for _ in 0..iters {
			for doc in &docs {
				sink += writr_core::parse_to_mdast(doc, &minimal)
					.map(|_| 1)
					.unwrap_or(0);
			}
		}
		report("parse_to_mdast (minimal)", start, iters, &docs);
	}

	let mut probes: Vec<(&str, RenderOptions)> = vec![
		("render (minimal)", minimal),
		(
			"minimal+gfm",
			RenderOptions {
				gfm: true,
				..minimal
			},
		),
		(
			"minimal+emoji",
			RenderOptions {
				emoji: true,
				..minimal
			},
		),
		(
			"minimal+slug",
			RenderOptions {
				slug: true,
				..minimal
			},
		),
		(
			"minimal+toc",
			RenderOptions {
				toc: true,
				..minimal
			},
		),
		(
			"minimal+highlight",
			RenderOptions {
				highlight: true,
				..minimal
			},
		),
		(
			"minimal+math",
			RenderOptions {
				math: true,
				..minimal
			},
		),
		(
			"default-no-highlight",
			RenderOptions {
				highlight: false,
				..default
			},
		),
		(
			"default-no-math",
			RenderOptions {
				math: false,
				..default
			},
		),
		("render (default)", default),
	];
	for (label, options) in probes.drain(..) {
		if !selected(label) {
			continue;
		}
		if stages.is_some() {
			for doc in &docs {
				let _ = writr_core::render(doc, &options);
			}
		}
		let start = Instant::now();
		for _ in 0..iters {
			for doc in &docs {
				sink += writr_core::render(doc, &options).unwrap().len();
			}
		}
		report(label, start, iters, &docs);
	}

	eprintln!("(sink {sink})");
}

fn report(label: &str, start: Instant, iters: usize, docs: &[String]) {
	let elapsed = start.elapsed();
	let per_doc = elapsed / (iters * docs.len()) as u32;
	let ops = 1.0 / per_doc.as_secs_f64();
	println!("{label:28} {per_doc:>10.2?}/doc  {ops:>10.0} ops/s");
}

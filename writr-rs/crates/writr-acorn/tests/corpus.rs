//! Differential corpus: every outcome in tests/fixtures/acorn-corpus.jsonl
//! (generated from the JavaScript remark-mdx stack by
//! tools/gen-acorn-fixtures.mjs) must be reproduced exactly.

use serde::Deserialize;
use writr_acorn::{validate, Kind, Signal};

#[derive(Deserialize)]
struct Case {
	value: String,
	kind: String,
	imports: Vec<String>,
	defer: bool,
	/// `[code point prefix length, signal, message, pos, imports]`.
	results: Vec<(usize, String, String, usize, Vec<String>)>,
}

fn kind(name: &str) -> Kind {
	match name {
		"expression" => Kind::Expression,
		"spread" => Kind::Spread,
		"attribute" => Kind::Attribute,
		"esm" => Kind::Esm,
		other => panic!("unknown kind {other}"),
	}
}

fn actual(
	value: &str,
	kind: Kind,
	imports: &[String],
	defer: bool,
) -> (String, String, usize, Vec<String>) {
	match validate(value, kind, imports, defer) {
		Ok(outcome) => {
			let signal = match outcome.signal {
				Signal::Ok => "ok",
				Signal::Eof => "eof",
				Signal::Error => "error",
			};
			(signal.into(), outcome.message, outcome.pos, outcome.imports)
		}
		Err(error) => ("throw".into(), error.0, 0, Vec::new()),
	}
}

#[test]
fn corpus() {
	let checks = check(include_str!("fixtures/acorn-corpus.jsonl"));
	assert!(checks > 20_000, "corpus unexpectedly small: {checks}");
}

/// Checks a corpus in the same format from `WRITR_ACORN_CORPUS` (for
/// example a fuzzing run's output).
#[test]
#[ignore]
fn external_corpus() {
	let path = std::env::var("WRITR_ACORN_CORPUS").expect("WRITR_ACORN_CORPUS");
	check(&std::fs::read_to_string(path).expect("corpus file"));
}

fn check(text: &str) -> usize {
	let mut checks = 0;
	let mut mismatches = Vec::new();
	for line in text.lines().filter(|line| !line.is_empty()) {
		let case: Case = serde_json::from_str(line).expect("corpus line");
		let points: Vec<char> = case.value.chars().collect();
		for (length, signal, message, pos, imports) in &case.results {
			checks += 1;
			let value: String = points[..*length].iter().collect();
			let expected = (signal.clone(), message.clone(), *pos, imports.clone());
			let got = actual(&value, kind(&case.kind), &case.imports, case.defer);
			// A thrown runtime error only has to be thrown; its wording is V8's.
			let same = if expected.0 == "throw" {
				got.0 == "throw"
			} else {
				got == expected
			};
			if !same {
				mismatches.push(format!(
					"{} {:?} imports={:?} defer={}\n    expected {:?}\n    got      {:?}",
					case.kind, value, case.imports, case.defer, expected, got
				));
			}
		}
	}
	if !mismatches.is_empty() {
		let shown: Vec<_> = mismatches.iter().take(60).cloned().collect();
		panic!(
			"{} of {} corpus checks differ:\n  {}",
			mismatches.len(),
			checks,
			shown.join("\n  ")
		);
	}
	checks
}

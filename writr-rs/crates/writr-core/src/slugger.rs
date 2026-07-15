//! Port of github-slugger@2.0.0 (`BananaSlug`).

use crate::generated::slug_ranges::REMOVED_RANGES;
use std::collections::HashMap;

/// Whether the slugger strips this character (space is special-cased to `-`).
fn is_removed(c: char) -> bool {
	let cp = c as u32;
	REMOVED_RANGES
		.binary_search_by(|&(start, end)| {
			if cp < start {
				std::cmp::Ordering::Greater
			} else if cp > end {
				std::cmp::Ordering::Less
			} else {
				std::cmp::Ordering::Equal
			}
		})
		.is_ok()
}

/// The stateless core: lowercase, strip, spaces → dashes.
pub fn slug_once(value: &str) -> String {
	let lower = value.to_lowercase();
	let mut result = String::with_capacity(lower.len());
	for c in lower.chars() {
		if c == ' ' {
			result.push('-');
		} else if !is_removed(c) {
			result.push(c);
		}
	}
	result
}

/// Stateful slugger with GitHub's `-N` dedup counters.
#[derive(Debug, Default)]
pub struct Slugger {
	occurrences: HashMap<String, usize>,
}

impl Slugger {
	pub fn new() -> Self {
		Self::default()
	}

	pub fn slug(&mut self, value: &str) -> String {
		let original = slug_once(value);
		let mut result = original.clone();
		while self.occurrences.contains_key(&result) {
			let counter = self.occurrences.entry(original.clone()).or_insert(0);
			*counter += 1;
			result = format!("{original}-{counter}");
		}
		self.occurrences.insert(result.clone(), 0);
		result
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn matches_github_slugger() {
		assert_eq!(slug_once("Hello World"), "hello-world");
		assert_eq!(slug_once("Hello, World! (Punctuation)"), "hello-world-punctuation");
		assert_eq!(slug_once("Café Über Ünïcode"), "café-über-ünïcode");
		assert_eq!(slug_once("Launch 🚀"), "launch-");
		assert_eq!(slug_once("Launch :rocket:"), "launch-rocket");
		assert_eq!(slug_once("a_b"), "a_b");
	}

	#[test]
	fn dedupes_with_counters() {
		let mut slugger = Slugger::new();
		assert_eq!(slugger.slug("Duplicate"), "duplicate");
		assert_eq!(slugger.slug("Duplicate"), "duplicate-1");
		assert_eq!(slugger.slug("Duplicate"), "duplicate-2");
		// A literal `duplicate-1` heading collides with the generated id.
		assert_eq!(slugger.slug("duplicate-1"), "duplicate-1-1");
	}
}

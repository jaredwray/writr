//! Shared bounded formula cache used by the HTML and parsed-output stages.

use std::collections::{HashMap, VecDeque};

pub const MAX_ENTRIES: usize = 256;
pub const MAX_BYTES: usize = 4 * 1024 * 1024;

/// FIFO eviction bounds both variable-size payloads and container overhead.
/// Bytes include both owned formula keys and the value's heap allocations;
/// fixed-size entries and allocator overhead are bounded by `MAX_ENTRIES`.
pub struct MathCache<T> {
	entries: HashMap<(String, bool), (T, usize)>,
	order: VecDeque<(String, bool)>,
	bytes: usize,
}

impl<T> Default for MathCache<T> {
	fn default() -> Self {
		Self {
			entries: HashMap::new(),
			order: VecDeque::new(),
			bytes: 0,
		}
	}
}

impl<T> MathCache<T> {
	pub fn get(&self, formula: &str, display: bool) -> Option<&T> {
		self.entries
			.get(&(formula.to_owned(), display))
			.map(|(value, _)| value)
	}

	/// Oversized values are rendered normally but never retained. A duplicate
	/// insert (including a concurrent render) leaves the existing entry intact.
	pub fn insert(&mut self, formula: &str, display: bool, value: T, value_bytes: usize) {
		let bytes = value_bytes.saturating_add(formula.len().saturating_mul(2));
		if bytes > MAX_BYTES || self.get(formula, display).is_some() {
			return;
		}
		while self.entries.len() >= MAX_ENTRIES || self.bytes > MAX_BYTES - bytes {
			let oldest = self.order.pop_front().expect("cache entry to evict");
			let (_, removed_bytes) = self.entries.remove(&oldest).expect("queued cache entry");
			self.bytes -= removed_bytes;
		}
		let key = (formula.to_owned(), display);
		self.order.push_back(key.clone());
		self.entries.insert(key, (value, bytes));
		self.bytes += bytes;
	}

	pub fn len(&self) -> usize {
		self.entries.len()
	}

	pub fn is_empty(&self) -> bool {
		self.entries.is_empty()
	}

	pub fn bytes(&self) -> usize {
		self.bytes
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn unique_formulas_plateau_and_evict_oldest() {
		let mut cache = MathCache::default();
		for i in 0..MAX_ENTRIES * 10 {
			cache.insert(&i.to_string(), false, (), 1024);
			assert!(cache.len() <= MAX_ENTRIES);
			assert!(cache.bytes() <= MAX_BYTES);
		}
		assert_eq!(cache.len(), MAX_ENTRIES);
		assert!(cache.get("0", false).is_none());
		assert!(cache
			.get(&(MAX_ENTRIES * 10 - 1).to_string(), false)
			.is_some());
	}

	#[test]
	fn byte_limit_includes_keys_and_rejects_oversized_values() {
		let mut cache = MathCache::default();
		cache.insert("a", false, (), MAX_BYTES / 2);
		cache.insert("b", false, (), MAX_BYTES / 2);
		assert_eq!(cache.len(), 1);
		assert!(cache.get("a", false).is_none());
		assert_eq!(cache.bytes(), MAX_BYTES / 2 + 2);
		cache.insert("oversized", false, (), MAX_BYTES);
		cache.insert("overflow", false, (), usize::MAX);
		assert_eq!(cache.len(), 1);
		assert!(cache.get("b", false).is_some());
	}

	#[test]
	fn duplicate_inserts_and_display_mode_preserve_accounting() {
		let mut cache = MathCache::default();
		cache.insert("x", false, "inline", 6);
		cache.insert("x", false, "duplicate", 9);
		cache.insert("x", true, "display", 7);
		assert_eq!(cache.len(), 2);
		assert_eq!(cache.bytes(), 17);
		assert_eq!(cache.get("x", false), Some(&"inline"));
		assert_eq!(cache.get("x", true), Some(&"display"));
	}
}

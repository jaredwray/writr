//! WRITR-RS PATCH: attribute maps with JavaScript object key order.
//!
//! KaTeX keeps DOM/MathML attributes in plain objects and serializes them with
//! `Object.keys`, which lists integer-like keys in ascending numeric order and
//! every other key in insertion order (re-assigning a key keeps its position).
//! Upstream katex-rs stored them in a hash map, so attribute order varied from
//! KaTeX's markup.

use alloc::{string::String, vec::Vec};
use core::borrow::Borrow;

/// Attribute name → value, iterated in JavaScript `Object.keys` order.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct AttributeMap {
	entries: Vec<(String, String)>,
}

/// Canonical array index (`"0"`, `"17"`, not `"01"`), which JavaScript
/// orders before string keys.
fn array_index(key: &str) -> Option<u32> {
	if key.is_empty() || (key.len() > 1 && key.starts_with('0')) {
		return None;
	}
	if !key.bytes().all(|byte| byte.is_ascii_digit()) {
		return None;
	}
	key.parse::<u32>().ok().filter(|&index| index != u32::MAX)
}

impl AttributeMap {
	/// An empty map.
	#[must_use]
	pub const fn new() -> Self {
		Self {
			entries: Vec::new(),
		}
	}

	/// An empty map with room for `capacity` attributes.
	#[must_use]
	pub fn with_capacity(capacity: usize) -> Self {
		Self {
			entries: Vec::with_capacity(capacity),
		}
	}

	/// Sets `key`, keeping its position when it already exists.
	pub fn insert<K: Into<String>, V: Into<String>>(&mut self, key: K, value: V) -> Option<String> {
		let key = key.into();
		let value = value.into();
		if let Some((_, old)) = self.entries.iter_mut().find(|(existing, _)| *existing == key) {
			return Some(core::mem::replace(old, value));
		}
		self.entries.push((key, value));
		None
	}

	/// The value of `key`.
	pub fn get<Q>(&self, key: &Q) -> Option<&String>
	where
		String: Borrow<Q>,
		Q: PartialEq + ?Sized,
	{
		self.entries
			.iter()
			.find(|(existing, _)| existing.borrow() == key)
			.map(|(_, value)| value)
	}

	/// Whether `key` is set.
	pub fn contains_key<Q>(&self, key: &Q) -> bool
	where
		String: Borrow<Q>,
		Q: PartialEq + ?Sized,
	{
		self.get(key).is_some()
	}

	/// Removes `key`.
	pub fn remove<Q>(&mut self, key: &Q) -> Option<String>
	where
		String: Borrow<Q>,
		Q: PartialEq + ?Sized,
	{
		let index = self
			.entries
			.iter()
			.position(|(existing, _)| existing.borrow() == key)?;
		Some(self.entries.remove(index).1)
	}

	/// Whether no attribute is set.
	#[must_use]
	pub const fn is_empty(&self) -> bool {
		self.entries.is_empty()
	}

	/// Number of attributes.
	#[must_use]
	pub const fn len(&self) -> usize {
		self.entries.len()
	}

	/// Entries in `Object.keys` order.
	pub fn iter(&self) -> impl Iterator<Item = (&String, &String)> {
		let mut indexed: Vec<(u32, usize)> = self
			.entries
			.iter()
			.enumerate()
			.filter_map(|(position, (key, _))| array_index(key).map(|index| (index, position)))
			.collect();
		indexed.sort_unstable();
		let numeric = indexed.into_iter().map(|(_, position)| position);
		let named = self
			.entries
			.iter()
			.enumerate()
			.filter(|(_, (key, _))| array_index(key).is_none())
			.map(|(position, _)| position);
		numeric
			.chain(named)
			.map(|position| {
				let (key, value) = &self.entries[position];
				(key, value)
			})
			.collect::<Vec<_>>()
			.into_iter()
	}

	/// Keys in `Object.keys` order.
	pub fn keys(&self) -> impl Iterator<Item = &String> {
		self.iter().map(|(key, _)| key)
	}
}

impl<K: Into<String>, V: Into<String>> Extend<(K, V)> for AttributeMap {
	fn extend<I: IntoIterator<Item = (K, V)>>(&mut self, iter: I) {
		for (key, value) in iter {
			self.insert(key, value);
		}
	}
}

impl<K: Into<String>, V: Into<String>> FromIterator<(K, V)> for AttributeMap {
	fn from_iter<I: IntoIterator<Item = (K, V)>>(iter: I) -> Self {
		let mut map = Self::new();
		map.extend(iter);
		map
	}
}

impl<'a> IntoIterator for &'a AttributeMap {
	type Item = (&'a String, &'a String);
	type IntoIter = alloc::vec::IntoIter<(&'a String, &'a String)>;

	fn into_iter(self) -> Self::IntoIter {
		self.iter().collect::<Vec<_>>().into_iter()
	}
}

impl IntoIterator for AttributeMap {
	type Item = (String, String);
	type IntoIter = alloc::vec::IntoIter<(String, String)>;

	fn into_iter(self) -> Self::IntoIter {
		let order: Vec<String> = self.keys().cloned().collect();
		let mut entries = self.entries;
		let mut ordered = Vec::with_capacity(entries.len());
		for key in order {
			let position = entries
				.iter()
				.position(|(existing, _)| *existing == key)
				.unwrap_or_default();
			ordered.push(entries.swap_remove(position));
		}
		ordered.into_iter()
	}
}

#[cfg(test)]
mod tests {
	use super::AttributeMap;

	#[test]
	fn iterates_in_object_keys_order() {
		let mut map = AttributeMap::new();
		map.insert("b", "1");
		map.insert("10", "2");
		map.insert("a", "3");
		map.insert("2", "4");
		map.insert("b", "5");
		map.insert("01", "6");
		let keys: Vec<_> = map.keys().map(String::as_str).collect();
		assert_eq!(keys, ["2", "10", "b", "a", "01"]);
		assert_eq!(map.get("b").map(String::as_str), Some("5"));
	}
}

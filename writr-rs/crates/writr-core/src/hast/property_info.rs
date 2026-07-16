//! Port of property-information@7.1.0 `find()` over code-generated schema
//! tables (see `tools/gen-property-info.mjs`).

use crate::generated::property_info_data::{
	HTML_NORMAL, HTML_PROPERTIES, SVG_NORMAL, SVG_PROPERTIES,
};
use std::borrow::Cow;

pub const BOOLEAN: u8 = 1;
pub const BOOLEANISH: u8 = 2;
pub const OVERLOADED_BOOLEAN: u8 = 4;
pub const NUMBER: u8 = 8;
pub const SPACE_SEPARATED: u8 = 16;
pub const COMMA_SEPARATED: u8 = 32;
pub const COMMA_OR_SPACE_SEPARATED: u8 = 64;

/// Schema space, switched to `Svg` while serializing inside `<svg>`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Space {
	Html,
	Svg,
}

/// Resolved info for a property (or unknown attribute).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Info<'a> {
	/// The property name (hast key), e.g. `className`.
	pub property: Cow<'a, str>,
	/// The attribute name to serialize, e.g. `class`.
	pub attribute: Cow<'a, str>,
	pub flags: u8,
	/// Whether the property is defined in the schema (or is a valid `data-*`).
	pub defined: bool,
}

impl Info<'_> {
	pub fn boolean(&self) -> bool {
		self.flags & BOOLEAN != 0
	}

	pub fn overloaded_boolean(&self) -> bool {
		self.flags & OVERLOADED_BOOLEAN != 0
	}

	pub fn comma_separated(&self) -> bool {
		self.flags & COMMA_SEPARATED != 0
	}

	pub fn space_separated(&self) -> bool {
		self.flags & SPACE_SEPARATED != 0
	}

	pub fn number(&self) -> bool {
		self.flags & NUMBER != 0
	}

	pub fn booleanish(&self) -> bool {
		self.flags & BOOLEANISH != 0
	}
}

/// Per-space lookup tables: (normal names, property definitions).
type SpaceTables = (
	&'static [(&'static str, &'static str)],
	&'static [(&'static str, &'static str, u8)],
);

fn tables(space: Space) -> SpaceTables {
	match space {
		Space::Html => (HTML_NORMAL, HTML_PROPERTIES),
		Space::Svg => (SVG_NORMAL, SVG_PROPERTIES),
	}
}

fn schema_lookup(space: Space, property: &str) -> Option<Info<'static>> {
	let (_, properties) = tables(space);
	properties
		.binary_search_by(|(key, _, _)| (*key).cmp(property))
		.ok()
		.map(|index| {
			let (key, attribute, flags) = properties[index];
			Info {
				property: Cow::Borrowed(key),
				attribute: Cow::Borrowed(attribute),
				flags,
				defined: true,
			}
		})
}

/// `/^data[-\w.:]+$/i` (JS `\w` is `[A-Za-z0-9_]`).
fn is_valid_data_name(value: &str) -> bool {
	let bytes = value.as_bytes();
	if bytes.len() <= 4 || !bytes[..4].eq_ignore_ascii_case(b"data") {
		return false;
	}
	bytes[4..]
		.iter()
		.all(|&b| b == b'-' || b == b'.' || b == b':' || b == b'_' || b.is_ascii_alphanumeric())
}

/// Port of property-information's `find(schema, value)`.
///
/// The upstream `dash.test()` global-regex statefulness (a latent upstream
/// bug for names like `dataA-b`) is deliberately not replicated; this
/// implementation is stateless.
pub fn find<'a>(space: Space, value: &'a str) -> Info<'a> {
	let normal = value.to_lowercase();
	let (normal_table, _) = tables(space);
	if let Ok(index) = normal_table.binary_search_by(|(key, _)| (*key).cmp(normal.as_str())) {
		let property = normal_table[index].1;
		if let Some(info) = schema_lookup(space, property) {
			return info;
		}
	}

	if normal.len() > 4 && normal.starts_with("data") && is_valid_data_name(value) {
		if value.as_bytes()[4] == b'-' {
			// Attribute style: derive the camelCase property.
			let rest = &value[5..];
			let mut camel = String::with_capacity(rest.len());
			let mut chars = rest.chars().peekable();
			while let Some(c) = chars.next() {
				if c == '-' {
					if let Some(&next) = chars.peek() {
						if next.is_ascii_lowercase() {
							chars.next();
							camel.extend(next.to_uppercase());
							continue;
						}
					}
					camel.push(c);
				} else {
					camel.push(c);
				}
			}
			let mut property = String::with_capacity(camel.len() + 4);
			property.push_str("data");
			let mut chars = camel.chars();
			if let Some(first) = chars.next() {
				property.extend(first.to_uppercase());
				property.push_str(chars.as_str());
			}
			return Info {
				property: Cow::Owned(property),
				attribute: Cow::Borrowed(value),
				flags: 0,
				defined: true,
			};
		}

		// Property style: derive the dashed attribute (`/-[a-z]/` guard).
		let rest = &value[4..];
		let has_dash_lower = rest
			.as_bytes()
			.windows(2)
			.any(|pair| pair[0] == b'-' && pair[1].is_ascii_lowercase());
		let attribute = if has_dash_lower {
			Cow::Borrowed(value)
		} else {
			let mut dashes = String::with_capacity(rest.len() + 2);
			for c in rest.chars() {
				if c.is_ascii_uppercase() {
					dashes.push('-');
					dashes.push(c.to_ascii_lowercase());
				} else {
					dashes.push(c);
				}
			}
			if !dashes.starts_with('-') {
				dashes.insert(0, '-');
			}
			Cow::Owned(format!("data{dashes}"))
		};
		return Info {
			property: Cow::Borrowed(value),
			attribute,
			flags: 0,
			defined: true,
		};
	}

	Info {
		property: Cow::Borrowed(value),
		attribute: Cow::Borrowed(value),
		flags: 0,
		defined: false,
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn known_html_properties() {
		let class_name = find(Space::Html, "className");
		assert_eq!(class_name.attribute, "class");
		assert!(class_name.space_separated());

		let checked = find(Space::Html, "checked");
		assert_eq!(checked.attribute, "checked");
		assert!(checked.boolean());

		let aria = find(Space::Html, "ariaDescribedBy");
		assert_eq!(aria.attribute, "aria-describedby");
		assert!(aria.space_separated());
	}

	#[test]
	fn lookup_by_attribute_name() {
		let by_attribute = find(Space::Html, "class");
		assert_eq!(by_attribute.property, "className");
		assert_eq!(by_attribute.attribute, "class");
	}

	#[test]
	fn svg_space() {
		let view_box = find(Space::Svg, "viewBox");
		assert_eq!(view_box.attribute, "viewBox");
		// `class` exists in SVG too.
		assert_eq!(find(Space::Svg, "className").attribute, "class");
	}

	#[test]
	fn data_property_to_attribute() {
		let info = find(Space::Html, "dataFootnoteRef");
		assert_eq!(info.attribute, "data-footnote-ref");
		assert_eq!(info.property, "dataFootnoteRef");
		assert!(info.defined);
		assert_eq!(info.flags, 0);
	}

	#[test]
	fn data_attribute_to_property() {
		let info = find(Space::Html, "data-footnote-backref");
		assert_eq!(info.property, "dataFootnoteBackref");
		assert_eq!(info.attribute, "data-footnote-backref");
		assert!(info.defined);
	}

	#[test]
	fn unknown_names_pass_through() {
		let info = find(Space::Html, "bogus");
		assert_eq!(info.attribute, "bogus");
		assert!(!info.defined);
		// `data` alone is the real `<object data>` attribute, not a data-*.
		let data = find(Space::Html, "data");
		assert!(data.defined);
		assert_eq!(data.attribute, "data");
		// Invalid data name characters fall through to unknown.
		assert!(!find(Space::Html, "data-foo!bar").defined);
	}

	#[test]
	fn value_flags_match_property_information() {
		// booleanish: serialized with an explicit value ("true"/"false").
		let editable = find(Space::Html, "contentEditable");
		assert_eq!(editable.attribute, "contenteditable");
		assert!(editable.booleanish());
		assert!(!editable.boolean());

		// overloaded boolean: `download` on `<a>`.
		let download = find(Space::Html, "download");
		assert!(download.overloaded_boolean());
		assert!(!download.boolean());

		// numbers and comma lists.
		assert!(find(Space::Html, "rows").number());
		assert!(find(Space::Html, "tabIndex").number());
		assert!(find(Space::Html, "accept").comma_separated());
		assert!(!find(Space::Html, "accept").space_separated());
		let charset = find(Space::Html, "acceptCharset");
		assert_eq!(charset.attribute, "accept-charset");
		assert!(charset.space_separated());
		// SVG `kernelMatrix` is comma-or-space separated.
		let kernel = find(Space::Svg, "kernelMatrix");
		assert!(kernel.flags & COMMA_OR_SPACE_SEPARATED != 0);
	}

	#[test]
	fn data_names_with_mixed_dashes() {
		// A dash followed by a non-lowercase character stays literal; the
		// following `-b` still camel-cases (property-information's
		// `/-[a-z]/g` replacement): `data-foo--bar` → `dataFoo-Bar`.
		let info = find(Space::Html, "data-foo--bar");
		assert_eq!(info.property, "dataFoo-Bar");
		assert_eq!(info.attribute, "data-foo--bar");
		assert!(info.defined);

		// Property-style names containing `-<lowercase>` keep the attribute
		// as-is (the `dash.test(rest)` guard).
		let info = find(Space::Html, "dataFoo-bar");
		assert_eq!(info.property, "dataFoo-bar");
		assert_eq!(info.attribute, "dataFoo-bar");
		assert!(info.defined);

		// `.` and `:` are valid data-name characters.
		let info = find(Space::Html, "data-a.b:c");
		assert_eq!(info.property, "dataA.b:c");
		assert_eq!(info.attribute, "data-a.b:c");
		assert!(info.defined);
	}

	#[test]
	fn data_name_validity() {
		// `/^data[-\w.:]+$/i` needs `data` plus at least one more character.
		assert!(!is_valid_data_name("data"));
		assert!(!is_valid_data_name("dat"));
		assert!(!is_valid_data_name("xata-y"));
		assert!(is_valid_data_name("DATA-Y"));

		// A trailing dash has nothing to camel-case: `data-x-` → `dataX-`
		// (property-information's `/-[a-z]/g` finds no match in `x-`).
		let info = find(Space::Html, "data-x-");
		assert_eq!(info.property, "dataX-");
		assert_eq!(info.attribute, "data-x-");
		assert!(info.defined);
	}

	#[test]
	fn svg_namespaced_attributes() {
		let xlink = find(Space::Svg, "xlink:href");
		assert_eq!(xlink.property, "xLinkHref");
		assert_eq!(xlink.attribute, "xlink:href");

		// Unknown names keep their case in both spaces.
		let unknown = find(Space::Svg, "BOGUS-Attr");
		assert_eq!(unknown.property, "BOGUS-Attr");
		assert_eq!(unknown.attribute, "BOGUS-Attr");
		assert!(!unknown.defined);
	}
}

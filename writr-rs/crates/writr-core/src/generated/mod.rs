//! Code-generated data tables. Regenerate with the scripts in
//! `writr-rs/tools/` — never edit by hand; CI verifies freshness.

// `rustfmt::skip`: these files are generator output; formatting them would
// break the codegen-freshness check (regenerate-and-diff must be a no-op).
#[cfg(feature = "emoji")]
#[rustfmt::skip]
pub mod emoji_table;
#[rustfmt::skip]
pub mod property_info_data;
#[cfg(any(feature = "slug", feature = "toc"))]
#[rustfmt::skip]
pub mod slug_ranges;
#[cfg(feature = "gfm")]
#[rustfmt::skip]
pub mod unicode_data;

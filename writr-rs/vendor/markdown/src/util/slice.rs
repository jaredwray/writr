//! Deal with bytes.

use crate::event::{Event, Kind, Point};
use crate::util::constant::TAB_SIZE;
use alloc::{format, string::String, vec};
use core::str;

/// A range between two points.
#[derive(Debug)]
pub struct Position<'a> {
    /// Start point.
    pub start: &'a Point,
    /// End point.
    pub end: &'a Point,
}

impl<'a> Position<'a> {
    /// Get a position from an exit event.
    ///
    /// Looks backwards for the corresponding `enter` event.
    /// This does not support nested events (such as lists in lists).
    ///
    /// ## Panics
    ///
    /// This function panics if an enter event is given.
    /// When `markdown-rs` is used, this function never panics.
    pub fn from_exit_event(events: &'a [Event], index: usize) -> Position<'a> {
        debug_assert_eq!(events[index].kind, Kind::Exit, "expected `exit` event");
        let end = &events[index].point;
        let name = &events[index].name;
        let mut index = index - 1;

        while !(events[index].kind == Kind::Enter && events[index].name == *name) {
            index -= 1;
        }

        let start = &events[index].point;

        Position { start, end }
    }

    /// Turn a position into indices.
    ///
    /// Indices are places in `bytes` where this position starts and ends.
    ///
    /// > 👉 **Note**: indices cannot represent virtual spaces.
    pub fn to_indices(&self) -> (usize, usize) {
        (self.start.offset(), self.end.offset())
    }
}

/// Bytes belonging to a range.
///
/// Includes info on virtual spaces before and after the bytes.
#[derive(Debug)]
pub struct Slice<'a> {
    /// Bytes.
    pub bytes: &'a [u8],
    /// Number of virtual spaces before the bytes.
    pub before: usize,
    /// Number of virtual spaces after the bytes.
    pub after: usize,
}

impl<'a> Slice<'a> {
    /// Get a slice for a position.
    pub fn from_position(bytes: &'a [u8], position: &Position) -> Slice<'a> {
        let mut before = position.start.vs as usize;
        let mut after = position.end.vs as usize;
        let mut start = position.start.offset();
        let mut end = position.end.offset();

        // If we have virtual spaces before, it means we are past the actual
        // character at that index, and those virtual spaces.
        if before > 0 {
            before = TAB_SIZE - before;
            start += 1;
        }

        // If we have virtual spaces after, it means that character is included,
        // and one less virtual space.
        if after > 0 {
            after -= 1;
            end += 1;
        }

        Slice {
            bytes: &bytes[start..end],
            before,
            after,
        }
    }

    /// Get a slice for two indices.
    ///
    /// > 👉 **Note**: indices cannot represent virtual spaces.
    pub fn from_indices(bytes: &'a [u8], start: usize, end: usize) -> Slice<'a> {
        Slice {
            bytes: &bytes[start..end],
            before: 0,
            after: 0,
        }
    }

    /// Get the size of this slice, including virtual spaces.
    pub fn len(&self) -> usize {
        self.bytes.len() + self.before + self.after
    }

    /// Turn the slice into a `&str`.
    ///
    /// > 👉 **Note**: cannot represent virtual spaces.
    pub fn as_str(&self) -> &str {
        str::from_utf8(self.bytes).unwrap()
    }

    /// Turn the slice into a `String`.
    ///
    /// Supports virtual spaces.
    pub fn serialize(&self) -> String {
        // WRITR-RS PATCH (perf): build the string directly instead of
        // allocating prefix/suffix strings and running `format!` — this is
        // called once per data event during tree compilation, and virtual
        // spaces are rare.
        let mut result = String::with_capacity(self.len());
        for _ in 0..self.before {
            result.push(' ');
        }
        result.push_str(self.as_str());
        for _ in 0..self.after {
            result.push(' ');
        }
        result
    }
}

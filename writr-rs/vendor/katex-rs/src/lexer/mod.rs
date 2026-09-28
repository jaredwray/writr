//! The Lexer class handles tokenizing the input in various ways. Since our
//! parser expects us to be able to backtrack, the lexer allows lexing from any
//! given starting point.
//!
//! Its main exposed function is the `lex` function, which takes a position to
//! lex from and a type of token to lex. It defers to the appropriate
//! `_innerLex` function.
//!
//! The various `_innerLex` functions perform the actual lexing of different
//! kinds.

use crate::namespace::KeyMap;
use crate::types::{
    LexerInterface, ParseError, ParseErrorKind, Settings, SourceLocation, Token, TokenText,
};
use crate::utils::AdvanceWhile as _;
use alloc::sync::Arc;

/// Returns the byte index of the last character in the string `s`
/// that is **not** a Unicode combining diacritical mark
#[must_use]
pub fn last_non_combining_mark_index(s: &str) -> Option<usize> {
    let mut cut_idx = s.len();
    for (idx, ch) in s.char_indices().rev() {
        if (0x0300..=0x036F).contains(&(ch as u32)) {
            cut_idx = idx;
        } else {
            break;
        }
    }
    if cut_idx == s.len() {
        None
    } else {
        Some(cut_idx)
    }
}

const fn is_combining_mark(ch: char) -> bool {
    (ch as u32) >= 0x0300 && (ch as u32) <= 0x036F
}

#[inline]
const fn is_ascii_space(b: u8) -> bool {
    matches!(b, b' ' | b'\t' | b'\r' | b'\n')
}

#[inline]
fn match_space(s: &str) -> Option<usize> {
    let mut it = s.as_bytes().iter();
    let len = it.advance_while(is_ascii_space);
    (len > 0).then_some(len)
}

#[inline]
const fn is_hspace(b: u8) -> bool {
    matches!(b, b' ' | b'\r' | b'\t')
}

#[inline]
fn match_control_space_after_bs(rest: &str) -> Option<usize> {
    let mut it = rest.as_bytes().iter();
    let mut len = 0;

    let b1 = *it.next()?;
    len += 1;

    if b1 == b'\n' {
        // OK
    } else if is_hspace(b1) {
        len += it.advance_while(is_hspace);
        if matches!(it.as_slice().first(), Some(&b'\n')) {
            it.next();
            len += 1;
        }
    } else {
        return None;
    }

    len += it.advance_while(is_hspace);
    Some(len)
}

fn match_normal_char_with_accents(s: &str) -> Option<usize> {
    let mut chars = s.chars();
    let first = chars.next()?;
    let mut len_b = first.len_utf8();
    let u = first as u32;

    if matches!(u, 0x0021..=0x005B | 0x005D..=0x2027 | 0x202A..=0xD7FF | 0xF900..) {
        while let Some(c) = chars.next()
            && is_combining_mark(c)
        {
            len_b += c.len_utf8();
        }
        return Some(len_b);
    }
    None
}

#[inline]
fn match_control_symbol_after_bs(rest: &str) -> Option<usize> {
    let mut chars = rest.chars();
    let c = chars.next()?;
    // WRITR-RS PATCH: `\\[^\uD800-\uDFFF]` matches one UTF-16 unit, so a
    // backslash before an astral character (a surrogate pair) is no control
    // symbol.
    if c.len_utf16() != 1 {
        return None;
    }
    Some(c.len_utf8())
}

/// WRITR-RS PATCH: a `\verb` match. `split` means the closing delimiter
/// matched only the high surrogate of the character at `len - char_len`
/// (see `match_verb_after_bs`).
struct VerbMatch {
    len: usize,
    star: bool,
    split: bool,
}

/// WRITR-RS PATCH: `\\verb\*([^]).*?\4` / `\\verb([^*a-zA-Z]).*?\5` on
/// UTF-16 code units, as in Lexer.ts: the lazy body stops at the first unit
/// equal to the delimiter and cannot cross a line terminator (`.` excludes
/// \n, \r, U+2028 and U+2029). An astral delimiter is only its high
/// surrogate, so the match can end inside a character that shares it; the
/// lexer then fails on the lone low surrogate that follows.
#[inline]
fn match_verb_after_bs(rest: &str) -> Option<VerbMatch> {
    let rest = rest.strip_prefix("verb")?;
    let (star, rest, prefix_len) = rest
        .strip_prefix('*')
        .map_or_else(|| (false, rest, 4), |r| (true, r, 5));

    let mut chars = rest.char_indices();
    let (_, delim) = chars.next()?;
    if !star && (delim.is_ascii_alphabetic() || delim == '*') {
        return None;
    }
    let mut delim_units = [0u16; 2];
    // (An astral delimiter's own low surrogate starts the body; `.` matches
    // it.)
    let delim_unit = delim.encode_utf16(&mut delim_units)[0];

    for (i, c) in chars {
        let mut units = [0u16; 2];
        let first_unit = c.encode_utf16(&mut units)[0];
        if first_unit == delim_unit {
            let split = c.len_utf16() == 2 && delim.len_utf16() == 2;
            return Some(VerbMatch {
                len: prefix_len + i + c.len_utf8(),
                star,
                split,
            });
        }
        if matches!(c, '\n' | '\r' | '\u{2028}' | '\u{2029}') {
            return None;
        }
    }
    None
}

#[inline]
const fn is_ascii_alpha_or_at(b: u8) -> bool {
    matches!(b, b'A'..=b'Z' | b'a'..=b'z' | b'@')
}

#[inline]
fn match_control_word_with_space_after_bs(rest: &str) -> Option<(usize, usize)> {
    let mut it = rest.as_bytes().iter();
    let n = it.advance_while(is_ascii_alpha_or_at);
    if n == 0 {
        return None;
    }
    let ws = it.advance_while(is_ascii_space);
    Some((n, ws))
}

#[inline]
fn exec(last_index: &mut usize, slice: &str) -> TokenMatch {
    debug_assert!(!slice.is_empty());
    let bs = slice.as_bytes();
    if is_ascii_space(bs[0])
        && let Some(l) = match_space(slice)
    {
        *last_index += l;
        return TokenMatch {
            branch: BranchKind::Space,
            mlen: l,
            skip: 0,
            split: false,
        };
    }

    if bs[0] == b'\\' {
        let rest = &slice[1..];

        if let Some(l) = match_control_space_after_bs(rest) {
            let m = 1 + l;
            *last_index += m;
            return TokenMatch {
                branch: BranchKind::ControlSpace,
                mlen: m,
                skip: 0,
                split: false,
            };
        }

        if let Some(verb) = match_verb_after_bs(rest) {
            let m = 1 + verb.len;
            *last_index += m;
            return TokenMatch {
                branch: if verb.star {
                    BranchKind::VerbStar
                } else {
                    BranchKind::Verb
                },
                mlen: m,
                skip: 0,
                split: verb.split,
            };
        }

        if let Some((l, s)) = match_control_word_with_space_after_bs(rest) {
            let m = 1 + l + s;
            *last_index += m;
            return TokenMatch {
                branch: BranchKind::ControlWordWhitespace,
                mlen: m,
                skip: s,
                split: false,
            };
        }

        if let Some(l) = match_control_symbol_after_bs(rest) {
            let m = 1 + l;
            *last_index += m;
            return TokenMatch {
                branch: BranchKind::ControlSymbol,
                mlen: m,
                skip: 0,
                split: false,
            };
        }
    }

    if let Some(l) = match_normal_char_with_accents(slice) {
        *last_index += l;
        return TokenMatch {
            branch: BranchKind::NormalWithAccents,
            mlen: l,
            skip: 0,
            split: false,
        };
    }

    let m = slice.chars().next().map_or(0, char::len_utf8);

    *last_index += m;
    TokenMatch {
        branch: BranchKind::Unknown,
        mlen: m,
        skip: 0,
        split: false,
    }
}

#[derive(PartialEq, Eq)]
enum BranchKind {
    Unknown,
    Space,
    ControlSpace,
    NormalWithAccents,
    VerbStar,
    Verb,
    ControlWordWhitespace,
    ControlSymbol,
}

struct TokenMatch {
    branch: BranchKind,
    mlen: usize,
    skip: usize,
    /// WRITR-RS PATCH: the match ended after the high surrogate of its last
    /// character (see `match_verb_after_bs`).
    split: bool,
}

/// The core lexer for tokenizing LaTeX mathematical expressions in KaTeX.
pub struct Lexer<'a> {
    input: Arc<str>,
    last_index: usize,
    settings: &'a Settings,
    catcodes: KeyMap<char, u8>,
    /// WRITR-RS PATCH: the previous token ended inside the character at
    /// `last_index` (after its high surrogate); see `match_verb_after_bs`.
    mid_char: bool,
}

impl<'a> Lexer<'a> {
    /// Creates a new `Lexer` instance for tokenizing the provided LaTeX input
    /// string.
    #[must_use]
    pub fn new(input: Arc<str>, settings: &'a Settings) -> Self {
        Self {
            input,
            last_index: 0,
            settings,
            // Defaults are implicit; allocate only for explicit overrides.
            catcodes: KeyMap::default(),
            mid_char: false,
        }
    }

    /// Sets the category code for a specific character, controlling its lexical
    /// behavior.
    pub fn set_catcode(&mut self, char: char, code: u8) {
        self.catcodes.insert(char, code);
    }

    /// Retrieves the category code for a specific character, if one has been
    /// set.
    #[must_use]
    pub fn get_catcode(&self, ch: char) -> Option<u8> {
        self.catcodes.get(&ch).copied().or(match ch {
            '%' => Some(14),
            '~' => Some(13),
            _ => None,
        })
    }

    /// Tokenizes and returns the next token from the current position in the
    /// input string.
    pub fn lex(&mut self) -> Result<Token, ParseError> {
        // WRITR-RS PATCH: positioned on a lone low surrogate, which no token
        // matches (Lexer.ts: "Unexpected character"). A Rust string cannot
        // hold the lone surrogate, so the message shows U+FFFD, as the
        // JavaScript string prints once made well-formed.
        if self.mid_char {
            let start = self.input[..self.last_index].encode_utf16().count() + 1;
            return Err(ParseError::with_utf16_range(
                ParseErrorKind::UnexpectedCharacter {
                    character: "\u{FFFD}".to_owned(),
                },
                Arc::clone(&self.input),
                start,
                start + 1,
            ));
        }
        // If at end of input, return EOF token
        if self.last_index >= self.input.len() {
            return Ok(Token {
                text: TokenText::Static("EOF"),
                loc: Some(SourceLocation {
                    input: Arc::clone(&self.input),
                    start: self.last_index,
                    end: self.last_index,
                }),
                noexpand: None,
                treat_as_relax: None,
                id: Token::fresh_id(),
            });
        }

        let slice = &self.input[self.last_index..];
        let matched = exec(&mut self.last_index, slice);
        if matched.split {
            // WRITR-RS PATCH: resume inside the last character.
            let last_len = slice[..matched.mlen]
                .chars()
                .next_back()
                .map_or(0, char::len_utf8);
            self.last_index -= last_len;
            self.mid_char = true;
            let token_text = TokenText::slice(
                Arc::clone(&self.input),
                self.last_index + last_len - matched.mlen,
                self.last_index + last_len,
            );
            return Ok(Token::new(
                token_text,
                Some(SourceLocation {
                    input: Arc::clone(&self.input),
                    start: self.last_index + last_len - matched.mlen,
                    end: self.last_index + last_len,
                }),
            ));
        }

        let token_text = match matched.branch {
            BranchKind::Unknown => {
                let ch = &slice[..matched.mlen];
                let loc = Some(SourceLocation {
                    input: Arc::clone(&self.input),
                    start: self.last_index - matched.mlen,
                    end: self.last_index,
                });
                let token = Token::new(ch.to_owned(), loc);
                return Err(ParseError::with_token(
                    ParseErrorKind::UnexpectedCharacter {
                        character: ch.to_owned(),
                    },
                    &token,
                ));
            }
            BranchKind::ControlWordWhitespace => TokenText::slice(
                Arc::clone(&self.input),
                self.last_index - matched.mlen,
                self.last_index - matched.skip,
            ),
            BranchKind::ControlSymbol
            | BranchKind::NormalWithAccents
            | BranchKind::Verb
            | BranchKind::VerbStar => TokenText::slice(
                Arc::clone(&self.input),
                self.last_index - matched.mlen,
                self.last_index,
            ),
            BranchKind::ControlSpace => TokenText::Static(r"\ "),
            BranchKind::Space => TokenText::Static(" "),
        };

        if token_text.len() == 1
            && let Some(first_char) = token_text.as_str().chars().next()
            && self.get_catcode(first_char) == Some(14)
        {
            // Comment character, skip to end of line
            if let Some(rel_pos) = slice.find('\n') {
                let nl_index_global = self.last_index + rel_pos;
                self.last_index = nl_index_global;
            } else {
                self.last_index = self.input.len();
                self.settings.report_nonstrict("commentAtEnd", "% comment has no terminating newline; LaTeX would fail because of commenting the end of math mode (e.g. $)", None)?;
            }
            return self.lex();
        }

        Ok(Token::new(
            token_text,
            Some(SourceLocation {
                input: Arc::clone(&self.input),
                start: self.last_index - matched.mlen,
                end: self.last_index,
            }),
        ))
    }

    /// Returns the current byte position in the input string where the lexer
    /// will next read.
    #[must_use]
    pub const fn position(&self) -> usize {
        self.last_index
    }

    /// Manually sets the current position in the input string for lexing.
    pub const fn set_position(&mut self, last_index: usize) {
        self.last_index = last_index;
        self.mid_char = false;
    }
}

impl LexerInterface for Lexer<'_> {
    fn input(&self) -> &str {
        &self.input
    }
}

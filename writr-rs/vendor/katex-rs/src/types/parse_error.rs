//! Parse error handling for KaTeX
//!
//! This module contains the ParseError implementation that mirrors the
//! JavaScript ParseError class functionality, providing detailed error context
//! with positioning information for where in the source string the problem
//! occurred.

extern crate alloc;

use crate::parser::ParseNodeError;
use crate::parser::parse_node::{AnyParseNode, NodeType, ParseNodeOp};
use crate::symbols::Mode;
use crate::types::SourceLocation;
use alloc::boxed::Box;
use alloc::string::String;
use core::fmt;
#[cfg(feature = "backtrace")]
use std::backtrace::Backtrace;
use thiserror::Error;

#[cfg(feature = "wasm")]
use wasm_bindgen::prelude::wasm_bindgen;

/// WRITR-RS PATCH: the JavaScript error class a KaTeX failure maps to.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum JsErrorClass {
    /// KaTeX's `ParseError`.
    ParseError,
    /// A plain `Error` thrown by KaTeX (internal invariant failures).
    Error,
    /// V8's `RangeError` for stack exhaustion.
    RangeError,
    /// WRITR-RS PATCH: a V8 `TypeError` that KaTeX's code runs into on some
    /// malformed input (e.g. spreading a missing macro argument).
    TypeError,
}

/// Main error type thrown by KaTeX functions when something has gone wrong.
/// This is used to distinguish internal errors from errors in the expression
/// that the user provided.
#[cfg_attr(feature = "wasm", wasm_bindgen)]
#[derive(Debug, Error)]
#[error("KaTeX parse error: {kind}{context}")]
pub struct ParseError {
    /// Categorised reason for the failure.
    #[source]
    #[cfg_attr(feature = "wasm", wasm_bindgen(skip))]
    pub kind: Box<ParseErrorKind>,
    /// Additional context to render alongside the error.
    context: ParseErrorContext,
    /// Backtrace of the error stack
    #[cfg(feature = "backtrace")]
    #[cfg_attr(feature = "wasm", wasm_bindgen(skip))]
    pub backtrace: Box<Backtrace>,
}

impl ParseError {
    /// WRITR-RS PATCH: JavaScript's `String(error)` / `error.toString()` for a
    /// KaTeX `ParseError` (`"ParseError: " + message`), which KaTeX puts in the
    /// error span's `title` and rehype-katex reports.
    #[must_use]
    pub fn to_js_string(&self) -> String {
        match self.js_class() {
            JsErrorClass::ParseError => alloc::format!("ParseError: {self}"),
            JsErrorClass::RangeError => alloc::format!("RangeError: {}", self.kind),
            JsErrorClass::Error => alloc::format!("Error: {}", self.kind),
            JsErrorClass::TypeError => alloc::format!("TypeError: {}", self.kind),
        }
    }

    /// WRITR-RS PATCH: which JavaScript error class KaTeX throws for this
    /// failure. Only `ParseError`s become KaTeX's inline error span; anything
    /// else propagates out of `renderToString` even with `throwOnError: false`.
    #[must_use]
    pub fn js_class(&self) -> JsErrorClass {
        match *self.kind {
            ParseErrorKind::StackOverflow => JsErrorClass::RangeError,
            // WRITR-RS PATCH: KaTeX throws plain `Error`s for these internal
            // failures (fontMetrics.ts getCharacterMetrics, delimiter.ts
            // getMetrics, parseNode.ts assertNodeType), and V8 `TypeError`s for
            // JavaScript runtime failures.
            ParseErrorKind::FontMetricsNotFound { .. }
            | ParseErrorKind::UnsupportedSymbolFont { .. }
            | ParseErrorKind::JsError { .. } => JsErrorClass::Error,
            ParseErrorKind::JsTypeError { .. } => JsErrorClass::TypeError,
            _ => JsErrorClass::ParseError,
        }
    }

    /// Create a new ParseError with the given kind
    pub fn new<T: Into<ParseErrorKind>>(kind: T) -> Self {
        Self::from(kind.into())
    }

    /// Create a new ParseError with context from a Token or ParseNode
    pub fn with_token<T: Into<ParseErrorKind>>(kind: T, token: &dyn ErrorLocationProvider) -> Self {
        let context = token
            .loc()
            .filter(|loc| loc.start() <= loc.end())
            .map_or(ParseErrorContext::None, |loc| {
                ParseErrorContext::Location(loc.clone())
            });

        Self::from_kind(kind.into(), context)
    }

    /// WRITR-RS PATCH: an error located by UTF-16 offsets into `input`, for
    /// positions that fall inside a character (JavaScript strings index
    /// UTF-16 code units, so KaTeX can point at half of a surrogate pair).
    pub fn with_utf16_range<T: Into<ParseErrorKind>>(
        kind: T,
        input: alloc::sync::Arc<str>,
        start: usize,
        end: usize,
    ) -> Self {
        Self::from_kind(kind.into(), ParseErrorContext::Utf16 { input, start, end })
    }

    fn from_kind(kind: ParseErrorKind, context: ParseErrorContext) -> Self {
        Self {
            kind: Box::new(kind),
            context,
            #[cfg(feature = "backtrace")]
            backtrace: Box::new(Backtrace::force_capture()),
        }
    }

    /// Get the start position of the error if available
    #[must_use]
    pub const fn position(&self) -> Option<usize> {
        match &self.context {
            ParseErrorContext::None => None,
            ParseErrorContext::Location(loc) => Some(loc.start()),
            ParseErrorContext::Utf16 { start, .. } => Some(*start),
        }
    }

    /// Get the length of the error if available
    #[must_use]
    pub const fn length(&self) -> Option<usize> {
        match &self.context {
            ParseErrorContext::None => None,
            ParseErrorContext::Location(loc) => Some(loc.end().saturating_sub(loc.start())),
            ParseErrorContext::Utf16 { start, end, .. } => Some(end.saturating_sub(*start)),
        }
    }
}

impl From<strum::ParseError> for ParseError {
    fn from(err: strum::ParseError) -> Self {
        Self::new(ParseErrorKind::EnumParse(err))
    }
}

impl From<ParseErrorKind> for ParseError {
    fn from(kind: ParseErrorKind) -> Self {
        Self::from_kind(kind, ParseErrorContext::None)
    }
}

/// Describes the specific reason for a [`ParseError`].
#[allow(missing_docs)]
#[derive(Debug, Error)]
pub enum ParseErrorKind {
    /// WRITR-RS PATCH: recursion exceeded [`crate::stack_guard::BUDGET`] —
    /// JavaScript's `RangeError` (not a `ParseError`).
    #[error("Maximum call stack size exceeded")]
    StackOverflow,
    #[error(r"Invalid \arraystretch: {stretch}")]
    InvalidArrayStretch { stretch: String },
    #[error("{{{env}}} can be used only in display mode.")]
    DisplayModeOnly { env: String },
    /// WRITR-RS PATCH: array.ts wording (the position comes from the token).
    #[error(r"Expected & or \\ or \cr or \end")]
    ExpectedArrayDelimiter,
    #[error("Invalid separator type: {separator}")]
    InvalidSeparatorType { separator: String },
    /// WRITR-RS PATCH: `actual` is `row.length / 2` printed as a JavaScript
    /// number (it can be fractional).
    #[error("Too many math in a row: expected {expected}, but got {actual}")]
    TooManyMathInRow { expected: usize, actual: String },
    #[error("Expected ']', got '{found}'")]
    ExpectedClosingBracket { found: String },
    #[error("{func} valid only within array environment")]
    FunctionOnlyInArray { func: String },
    /// WRITR-RS PATCH: cd.ts wording.
    #[error(r"Expected \\ or \cr or \end")]
    ExpectedCdDelimiter,
    /// WRITR-RS PATCH: cd.ts wording.
    #[error("Missing a {arrow} character to complete a CD arrow.")]
    MissingCdArrowChar { arrow: String },
    /// WRITR-RS PATCH: cd.ts wording.
    #[error("Expected one of \"<>AV=|.\" after @")]
    InvalidCdArrowSpecifier,
    #[error("Invalid size: '{size}'")]
    InvalidSize { size: String },
    /// WRITR-RS PATCH: buildHTML.ts/buildMathML.ts throw this as a
    /// `ParseError`, with the type quoted.
    #[error("Got group of unknown type: '{}'", node_type_js_name(*.group_type))]
    UnknownGroupType { group_type: NodeType },
    #[error("Unrecognized genfrac command: {command}")]
    UnrecognizedGenfracCommand { command: String },
    #[error(r"Invalid style level for \genfrac: {level}")]
    InvalidGenfracStyle { level: String },
    /// WRITR-RS PATCH: environment.ts wording.
    #[error("Invalid environment name")]
    InvalidEnvironmentName,
    /// WRITR-RS PATCH: environment.ts (assertCharacterGroup) wording.
    #[error("Environment name should contain only text characters and spaces")]
    EnvironmentNameNotText,
    #[error("No such environment: {name}")]
    NoSuchEnvironment { name: String },
    #[error(r"Expected environment after \end, got {found}")]
    ExpectedEnvironmentAfterEnd { found: String },
    /// WRITR-RS PATCH: environment.ts wording.
    #[error(r"Mismatch: \begin{{{begin}}} matched by \end{{{end}}}")]
    MismatchedEnvironmentEnd { begin: String, end: String },
    #[error(r"Invalid number: '{value}' in \includegraphics")]
    InvalidIncludeGraphicsNumber { value: String },
    /// WRITR-RS PATCH: includegraphics.ts wording (trailing period).
    #[error(r"Invalid unit: '{unit}' in \includegraphics.")]
    InvalidIncludeGraphicsUnit { unit: String },
    #[error(r"Invalid size: '{size}' in \includegraphics")]
    InvalidIncludeGraphicsSize { size: String },
    /// WRITR-RS PATCH: includegraphics.ts wording (trailing period).
    #[error(r"Invalid key: '{key}' in \includegraphics.")]
    InvalidIncludeGraphicsKey { key: String },
    #[error(r"\@char has non-numeric argument {value}")]
    CharNonNumericArgument { value: String },
    #[error("Unsupported character: {character}")]
    UnsupportedWideCharacter { character: String },
    #[error("Unsupported character: <empty>")]
    EmptyWideCharacterInput,
    #[error("Unknown stretchy element: {label}")]
    UnknownStretchyElement { label: String },
    #[error("Unsupported group type for svg_span")]
    UnsupportedGroupTypeForSvgSpan,
    #[error("Label must start with a backslash")]
    LabelMissingBackslashPrefix,
    #[error("Invalid group type for accent")]
    InvalidGroupTypeForAccent,
    #[error("Unsupported number of paths: {count}")]
    UnsupportedStretchyPathCount { count: usize },
    /// WRITR-RS PATCH: delimiter.ts wording (a plain `Error`).
    #[error("Unsupported symbol {symbol} and font size {font}.")]
    UnsupportedSymbolFont { symbol: String, font: String },
    #[error("Font metrics not found for font: {font_family}.")]
    FontMetricsNotFound { font_family: String },
    #[error("Failed to write markup")]
    MarkupWriteFailure,
    #[error(r"\newcommand{{{name}}} attempting to redefine {name}; use \renewcommand")]
    NewcommandRedefinition { name: String },
    /// WRITR-RS PATCH: macros.ts wording.
    #[error(r"\renewcommand{{{name}}} when command {name} does not yet exist; use \newcommand")]
    RenewcommandNonexistent { name: String },
    /// WRITR-RS PATCH: macros.ts wording.
    #[error("Invalid number of arguments: {text}")]
    InvalidNewcommandArgumentCount { text: String },
    /// WRITR-RS PATCH: macros.ts newcommand.
    #[error("\\newcommand's first argument must be a macro name")]
    NewcommandFirstArgument,
    /// WRITR-RS PATCH: symbolsSpacing.ts wording.
    #[error("Unknown type of space \"{name}\"")]
    UnknownSpaceType { name: String },
    #[error("Expected '{expected}', got '{found}'")]
    ExpectedToken { expected: String, found: String },
    /// WRITR-RS PATCH: def.ts wording (the token only gives the position).
    #[error("Invalid token after macro prefix")]
    InvalidTokenAfterMacroPrefix,
    /// WRITR-RS PATCH: Lexer.ts wording.
    #[error("Unexpected character: '{character}'")]
    UnexpectedCharacter { character: String },
    /// WRITR-RS PATCH: def.ts wording.
    #[error("Invalid argument number \"{value}\"")]
    InvalidMacroArgumentNumber { value: String },
    /// WRITR-RS PATCH: def.ts wording.
    #[error("Argument number \"{value}\" out of order")]
    MacroArgumentOutOfOrder { value: String },
    /// WRITR-RS PATCH: MacroExpander.ts expandOnce wording.
    #[error("Not a valid argument number")]
    NotAValidArgumentNumber,
    #[error("Expected #{expected} but found #{found}")]
    ExpectedMacroParameter { expected: usize, found: usize },
    #[error("Use of the macro doesn't match its definition")]
    MacroDefinitionMismatch,
    #[error("The length of delimiters doesn't match the number of args!")]
    MacroDelimiterLengthMismatch,
    #[error("Too many expansions: infinite loop or need to increase maxExpand setting")]
    MacroTooManyExpansions,
    #[error("Incomplete placeholder at end of macro body")]
    MacroIncompletePlaceholder,
    #[error("Internal error: stack unexpectedly empty during token expansion")]
    MacroStackUnexpectedlyEmpty,
    #[error("Extra }}")]
    ExtraCloseBrace,
    #[error("Expected a control sequence")]
    ExpectedControlSequence,
    #[error("Expected a macro definition")]
    ExpectedMacroDefinition,
    #[error("Got function '{func}' with no arguments as {context}")]
    FunctionMissingArguments { func: String, context: String },
    /// WRITR-RS PATCH: Parser.ts wording (quoted name, lowercase mode).
    #[error("Can't use function '{func}' in {} mode", mode_name(*.mode))]
    FunctionDisallowedInMode { func: String, mode: Mode },
    #[error("Undefined control sequence: {name}")]
    UndefinedControlSequence { name: String },
    #[error("Unexpected end of input in a macro argument, expected '{expected}'")]
    UnexpectedEndOfMacroArgument { expected: String },
    #[error("Invalid color: '{color}'")]
    InvalidColor { color: String },
    #[error("Expected group as {context}")]
    ExpectedGroupAs { context: String },
    /// WRITR-RS PATCH: Parser.ts wording.
    #[error("Limit controls must follow a math operator")]
    LimitsMustFollowBase,
    #[error("Double superscript")]
    DoubleSuperscript,
    #[error("Double subscript")]
    DoubleSubscript,
    #[error("make_ord: expected MathOrd, TextOrd or Spacing node")]
    MakeOrdExpectedNode,
    /// WRITR-RS PATCH: Parser.ts wording.
    #[error("only one infix operator per group")]
    MultipleInfixOperators,
    #[error("Infix operator at start of expression")]
    InfixOperatorAtStart,
    #[error("Invalid delimiter '{delimiter}' after '{function}'")]
    InvalidDelimiterAfter { delimiter: String, function: String },
    /// WRITR-RS PATCH: delimsizing.ts wording (the parse node type).
    #[error("Invalid delimiter type '{node_type}'")]
    InvalidDelimiterType { node_type: String },
    #[error("Expected {node} node")]
    ExpectedNode { node: NodeType },
    #[error("Expected {node} node in SupSub base")]
    ExpectedSupSubBaseNode { node: NodeType },
    #[error("Expected {node} node or SupSub node")]
    ExpectedNodeOrSupSub { node: NodeType },
    #[error("LaTeX-incompatible input and strict mode is set to 'error': {message} [{code}]")]
    StrictModeError { message: String, code: String },
    #[error("Unrecognized infix genfrac command: {command}")]
    UnrecognizedInfixGenfracCommand { command: String },
    #[error("Illegal delimiter: '{delim}'")]
    IllegalDelimiter { delim: String },
    /// WRITR-RS PATCH: domTree.ts wording.
    #[error("Invalid attribute name '{attr}'")]
    InvalidAttributeName { attr: String },
    #[error("Invalid unit: '{unit}'")]
    InvalidUnit { unit: String },
    #[error("Invalid group: {group}")]
    InvalidGroup { group: String },
    #[error("Invalid base-{base} digit {digit}")]
    InvalidBaseDigit { base: u32, digit: String },
    #[error("Mismatched {what}")]
    Mismatched { what: String },
    #[error("No function handler for {name}")]
    NoFunctionHandler { name: String },
    #[error("Unknown column alignment: {alignment}")]
    UnknownColumnAlignment { alignment: String },
    #[error("First argument must be raw string")]
    ExpectedRawStringFirstArgument,
    #[error("Error parsing key-value for \\htmlData")]
    HtmlDataKeyValueParseError,
    /// An htmlData entry must contain an equals sign.
    #[error("\\htmlData key/value '{item}' missing equals sign")]
    HtmlDataMissingEquals { item: String },
    #[error("Unrecognized html command")]
    UnrecognizedHtmlCommand,
    #[error("Expected color-token for {argument}")]
    ExpectedColorToken { argument: &'static str },
    #[error("Expected size argument")]
    ExpectedSizeArgument,
    #[error("Expected size argument for {context}")]
    ExpectedSizeArgumentFor { context: &'static str },
    #[error("{position} argument must be a size")]
    ArgumentMustBeSize { position: &'static str },
    #[error("Expected function after prefix")]
    ExpectedFunctionAfterPrefix,
    #[error("Expected \\right after \\left")]
    ExpectedRightAfterLeft,
    #[error("\\middle without preceding \\left")]
    MiddleWithoutPrecedingLeft,
    #[error("Lap functions require exactly 1 argument")]
    LapRequiresSingleArgument,
    #[error("supsub must have either sup or sub.")]
    SupSubMissingSupOrSub,
    #[error("Expected base in SupSub node")]
    ExpectedBaseInSupSub,
    #[error("Expected HorizBrace node in SupSub base")]
    ExpectedHorizBraceBase,
    #[error("Expected HorizBrace node or SupSub node")]
    ExpectedHorizBraceOrSupSub,
    #[error("Cancel functions require exactly 1 argument")]
    CancelFunctionSingleArgument,
    #[error("\\above argument must be a size")]
    AboveArgumentMustBeSize,
    #[error("{context} must be a URL")]
    ArgumentMustBeUrl { context: &'static str },
    #[error("Command {name} not trusted")]
    CommandNotTrusted { name: &'static str },
    #[error("Delimiter character is empty")]
    EmptyDelimiterCharacter,
    #[error("Styling functions take no arguments")]
    StylingTakesNoArguments,
    #[error("Generated ord node should have classes")]
    GeneratedOrdMissingClasses,
    #[error("Sizing functions take no arguments")]
    SizingTakesNoArguments,
    #[error("Environment handler not implemented")]
    EnvironmentHandlerNotImplemented,
    #[error("\\@char argument must be an ordgroup")]
    CharArgumentMustBeOrdGroup,
    #[error("\\@char has non-numeric argument")]
    CharOrdGroupContentInvalid,
    #[error("Missing arrow character after @")]
    MissingArrowCharacterAfterAt,
    #[error("Invalid arrow character")]
    InvalidArrowCharacter,
    #[error("Too many tab characters: &")]
    TooManyTabCharacters,
    #[error("Expected column alignment character")]
    ExpectedColumnAlignmentCharacter,
    #[error("Expected ordgroup or symbol node")]
    ExpectedOrdGroupOrSymbolNode,
    #[error("Expected l or c or r")]
    ExpectedAlignmentSpecifier,
    #[error("{subarray} can contain only one column")]
    SubarrayTooManyColumns { subarray: &'static str },
    #[error("Number of columns should be a positive integer")]
    InvalidNumberOfColumns,
    #[error("Failed to create combined token")]
    FailedToCreateCombinedToken,
    #[error("A primitive argument cannot be optional")]
    PrimitiveArgumentCannotBeOptional,
    #[error("\\current@color set to non-string in \\right")]
    CurrentColorMustBeString,
    #[error("Expected first child to be a DomSpan")]
    ExpectedFirstChildDomSpan,
    #[error("Expected second child to be a DomSpan")]
    ExpectedSecondChildDomSpan,
    #[error("Macro expander stack is empty")]
    EmptyMacroExpanderStack,
    #[error("\\char` missing argument")]
    CharMissingArgument,
    #[error("Multiple \\tag")]
    MultipleTag,
    #[error("\\tag works only in display equations")]
    TagNotAllowedInInlineMode,
    #[error("Empty string passed to lookup_symbol")]
    EmptyLookupSymbolInput,
    #[error("Optional smash argument must be an ordgroup")]
    OptionalSmashArgumentMustBeOrdGroup,
    #[error("\\\\abovefrac second argument must be an Infix node")]
    AbovefracSecondArgumentNotInfix,
    #[error("Failed to append child node: {details}")]
    FailedToAppendChild { details: String },
    #[error(
        "Unbalanced namespace destruction: attempt to pop global namespace; please report this as a bug"
    )]
    UnbalancedNamespaceDestruction,
    #[error("Document is not available in the current environment")]
    MissingDocument,
    #[error("Unknown delimiter label")]
    UnknownDelimiterLabel,
    /// WRITR-RS PATCH: Parser.ts wording (a space before the mark).
    #[error("Unknown accent ' {accent}'")]
    UnknownAccent { accent: String },
    /// WRITR-RS PATCH: Parser.ts wording (lowercase mode).
    #[error("Accent {accent} unsupported in {} mode", mode_name(*.mode))]
    UnsupportedAccentInMode { accent: String, mode: Mode },
    #[error("Expected Symbol node for {context}")]
    ExpectedSymbolNode { context: &'static str },
    #[error("Expected group after '{symbol}'")]
    ExpectedGroupAfterSymbol { symbol: String },
    #[error("Null argument, please report this as a bug")]
    NullArgument,
    /// WRITR-RS PATCH: Parser.ts throws a template literal that spans two
    /// source lines, so the message holds a newline and 20 spaces.
    #[error("\\verb assertion failed --\n                    please report what input caused this bug")]
    VerbAssertionFailed,
    #[error("\\verb ended by end of line instead of matching delimiter")]
    VerbMissingDelimiter,
    #[error("Expected URL argument for \\includegraphics")]
    IncludeGraphicsExpectedUrl,
    #[error("Invalid node type for {builder}")]
    InvalidNodeTypeForBuilder { builder: &'static str },
    #[error(r"\@char with invalid code point {code}")]
    InvalidCharCodePoint { code: String },
    #[error("newline node should be the last pushed element")]
    NewlineNodeNotFound,
    /// WRITR-RS PATCH: a plain JavaScript `Error` with this message.
    #[error("{message}")]
    JsError { message: String },
    /// WRITR-RS PATCH: a V8 `TypeError` with this message.
    #[error("{message}")]
    JsTypeError { message: String },
    #[error("Enum parse error: {0}")]
    EnumParse(strum::ParseError),
    #[error(transparent)]
    ParseNode(#[from] ParseNodeError),
}

/// WRITR-RS PATCH: a parse node's `type` string as KaTeX spells it (e.g.
/// `ordgroup`, `color-token`), for messages that print it.
#[must_use]
pub fn js_node_type_name(node: &AnyParseNode) -> String {
    node_type_js_name(NodeType::from(node))
}

/// WRITR-RS PATCH: see [`js_node_type_name`].
fn node_type_js_name(node_type: NodeType) -> String {
    match node_type {
        NodeType::ColorToken => "color-token".into(),
        NodeType::AccentToken => "accent-token".into(),
        NodeType::OpToken => "op-token".into(),
        NodeType::LeftRightRight => "leftright-right".into(),
        NodeType::AccentUnder => "accentUnder".into(),
        NodeType::HorizBrace => "horizBrace".into(),
        NodeType::XArrow => "xArrow".into(),
        other => other.to_string(),
    }
}

/// WRITR-RS PATCH: KaTeX's mode names (`"math"`/`"text"`) for messages.
const fn mode_name(mode: Mode) -> &'static str {
    match mode {
        Mode::Math => "math",
        Mode::Text => "text",
    }
}

#[derive(Debug, PartialEq)]
enum ParseErrorContext {
    None,
    Location(SourceLocation),
    /// WRITR-RS PATCH: offsets in UTF-16 code units.
    Utf16 {
        input: alloc::sync::Arc<str>,
        start: usize,
        end: usize,
    },
}

impl fmt::Display for ParseErrorContext {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        // WRITR-RS PATCH: KaTeX (ParseError.ts) counts positions and context
        // in UTF-16 code units, so the 15-unit context windows and the
        // per-unit underline can split surrogate pairs. A lone surrogate
        // becomes U+FFFD (as `String.prototype.toWellFormed` would print it).
        match self {
            Self::None => Ok(()),
            Self::Location(SourceLocation { input, start, end }) => {
                let to_utf16 = |byte: usize| {
                    let byte = adjust_char_boundary(input, byte.min(input.len()), false);
                    input[..byte].encode_utf16().count()
                };
                write_utf16_context(f, input, to_utf16(*start), to_utf16(*end))
            }
            Self::Utf16 { input, start, end } => write_utf16_context(f, input, *start, *end),
        }
    }
}

/// WRITR-RS PATCH: the location suffix of KaTeX's `ParseError` message
/// (ParseError.ts), on UTF-16 offsets.
fn write_utf16_context(
    f: &mut fmt::Formatter<'_>,
    input: &str,
    start: usize,
    end: usize,
) -> fmt::Result {
    let units: alloc::vec::Vec<u16> = input.encode_utf16().collect();
    let len = units.len();
    if start > end || end > len {
        return Ok(());
    }
    if start == len {
        write!(f, " at end of input: ")?;
    } else {
        write!(f, " at position {}: ", start + 1)?;
    }
    let mut out: alloc::vec::Vec<u16> = alloc::vec::Vec::new();
    if start > 15 {
        out.push(0x2026);
        out.extend_from_slice(&units[start - 15..start]);
    } else {
        out.extend_from_slice(&units[..start]);
    }
    for &unit in &units[start..end] {
        out.push(unit);
        out.push(0x0332);
    }
    if end + 15 < len {
        out.extend_from_slice(&units[end..end + 15]);
        out.push(0x2026);
    } else {
        out.extend_from_slice(&units[end..]);
    }
    f.write_str(&String::from_utf16_lossy(&out))
}

const fn adjust_char_boundary(input: &str, mut index: usize, forward: bool) -> usize {
    if forward {
        while index < input.len() && !input.is_char_boundary(index) {
            index += 1;
        }
    } else {
        while index > 0 && !input.is_char_boundary(index) {
            index -= 1;
        }
    }
    index
}

/// Trait for types that can provide error location information for ParseError
pub trait ErrorLocationProvider {
    /// Get the source location if available
    fn loc(&self) -> Option<&SourceLocation>;
}

/// Implementation of [`ErrorLocationProvider`] for [`AnyParseNode`].
///
/// This implementation extracts the source location from various parse node
/// types used in mathematical expression parsing. It handles all variants of
/// [`AnyParseNode`] to provide accurate error positioning in LaTeX/KaTeX
/// expressions.
///
/// The location information is crucial for generating user-friendly error
/// messages that highlight the exact position in the input string where a
/// parsing error occurred.
///
/// # Error Handling
/// Returns `None` if the parse node does not have location information
/// available.
///
/// # See Also
/// - [`ParseError::with_token`] for creating errors with location context
/// - [`SourceLocation`] for detailed location tracking
/// - [`AnyParseNode`] for all supported parse node types
// Implement ErrorLocationProvider for AnyParseNode
impl ErrorLocationProvider for AnyParseNode {
    fn loc(&self) -> Option<&SourceLocation> {
        // Extract location from the various parse node types
        match self {
            Self::Array(node) => node.loc.as_ref(),
            Self::CdLabel(node) => node.loc.as_ref(),
            Self::CdLabelParent(node) => node.loc.as_ref(),
            Self::Color(node) => node.loc.as_ref(),
            Self::ColorToken(node) => node.loc.as_ref(),
            Self::Op(node) => match node {
                ParseNodeOp::Symbol { loc, .. } | ParseNodeOp::Body { loc, .. } => loc.as_ref(),
            },
            Self::OrdGroup(node) => node.loc.as_ref(),
            Self::Raw(node) => node.loc.as_ref(),
            Self::Size(node) => node.loc.as_ref(),
            Self::Styling(node) => node.loc.as_ref(),
            Self::SupSub(node) => node.loc.as_ref(),
            Self::Tag(node) => node.loc.as_ref(),
            Self::Text(node) => node.loc.as_ref(),
            Self::Url(node) => node.loc.as_ref(),
            Self::Verb(node) => node.loc.as_ref(),
            Self::Atom(node) => node.loc.as_ref(),
            Self::MathOrd(node) => node.loc.as_ref(),
            Self::Spacing(node) => node.loc.as_ref(),
            Self::TextOrd(node) => node.loc.as_ref(),
            Self::AccentToken(node) => node.loc.as_ref(),
            Self::OpToken(node) => node.loc.as_ref(),
            Self::Accent(node) => node.loc.as_ref(),
            Self::AccentUnder(node) => node.loc.as_ref(),
            Self::Cr(node) => node.loc.as_ref(),
            Self::Delimsizing(node) => node.loc.as_ref(),
            Self::Enclose(node) => node.loc.as_ref(),
            Self::Environment(node) => node.loc.as_ref(),
            Self::Font(node) => node.loc.as_ref(),
            Self::Genfrac(node) => node.loc.as_ref(),
            Self::Hbox(node) => node.loc.as_ref(),
            Self::HorizBrace(node) => node.loc.as_ref(),
            Self::Href(node) => node.loc.as_ref(),
            Self::Html(node) => node.loc.as_ref(),
            Self::HtmlMathMl(node) => node.loc.as_ref(),
            Self::Includegraphics(node) => node.loc.as_ref(),
            Self::Infix(node) => node.loc.as_ref(),
            Self::Internal(node) => node.loc.as_ref(),
            Self::Kern(node) => node.loc.as_ref(),
            Self::Lap(node) => node.loc.as_ref(),
            Self::LeftRight(node) => node.loc.as_ref(),
            Self::LeftRightRight(node) => node.loc.as_ref(),
            Self::MathChoice(node) => node.loc.as_ref(),
            Self::Middle(node) => node.loc.as_ref(),
            Self::Mclass(node) => node.loc.as_ref(),
            Self::OperatorName(node) => node.loc.as_ref(),
            Self::Overline(node) => node.loc.as_ref(),
            Self::Phantom(node) => node.loc.as_ref(),
            Self::Hphantom(node) => node.loc.as_ref(),
            Self::Vphantom(node) => node.loc.as_ref(),
            Self::Pmb(node) => node.loc.as_ref(),
            Self::Raisebox(node) => node.loc.as_ref(),
            Self::Reflectbox(node) => node.loc.as_ref(),
            Self::Rule(node) => node.loc.as_ref(),
            Self::Sizing(node) => node.loc.as_ref(),
            Self::Smash(node) => node.loc.as_ref(),
            Self::Sqrt(node) => node.loc.as_ref(),
            Self::Underline(node) => node.loc.as_ref(),
            Self::Vcenter(node) => node.loc.as_ref(),
            Self::XArrow(node) => node.loc.as_ref(),
        }
    }
}

/// Implementation of [`ErrorLocationProvider`] for `Option<AnyParseNode>`.
///
/// Handles optional parse nodes, allowing error location extraction even when
/// the node might be absent. This is useful in complex parsing scenarios where
/// nodes are conditionally created or when parsing optional components of
/// mathematical expressions.
///
/// The implementation delegates to the inner node's location if present,
/// providing a consistent interface for error reporting.
///
/// # Error Handling
/// Returns `None` if the option is `None` or if the contained node has no
/// location.
///
/// # See Also
/// - [`AnyParseNode`] for all supported parse node variants
/// - [`ErrorLocationProvider`] trait for location interface
/// - `ParseError` for error types in mathematical parsing
impl ErrorLocationProvider for Option<AnyParseNode> {
    fn loc(&self) -> Option<&SourceLocation> {
        let n = self.as_ref()?;
        n.loc()
    }
}

/// Convert ParseNodeError to ParseError
impl From<ParseNodeError> for ParseError {
    fn from(err: ParseNodeError) -> Self {
        ParseErrorKind::from(err).into()
    }
}

impl From<fmt::Error> for ParseError {
    fn from(_: fmt::Error) -> Self {
        ParseErrorKind::MarkupWriteFailure.into()
    }
}

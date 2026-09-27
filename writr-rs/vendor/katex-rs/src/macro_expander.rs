//! MacroExpander – the “gullet” that expands macros to tokens
//!
//! Ported from KaTeX/src/MacroExpander.js with adjustments to fit the Rust
//! codebase.

use crate::context::KatexContext;
use crate::lexer::Lexer;
use crate::macros::builtins::BUILTIN_MACROS;
use crate::namespace::{KeyMap, Namespace};
use crate::types::TokenText;
use crate::types::{Mode, ParseError, ParseErrorKind, Settings, SourceLocation, Token};
use alloc::collections::BTreeMap;
use alloc::sync::Arc;

use crate::macros::{
    MacroArg, MacroContextInterface, MacroDefinition, MacroExpansion, MacroExpansionResult,
};

/// Map of macro definitions.
pub type MacroMap = KeyMap<String, MacroDefinition>;

/// Commands that act like macros but aren't defined as a macro, function, or
/// symbol
pub const IMPLICIT_COMMANDS: phf::Set<&str> = phf::phf_set! {
    "^",
    "_",
    "\\limits",
    "\\nolimits",
};

/// MacroExpander: expands macros until only non-macro tokens remain
pub struct MacroExpander<'a> {
    settings: &'a Settings,
    expansion_count: usize,
    lexer: Lexer<'a>,
    macros: Namespace<'a, MacroDefinition>,
    stack: Vec<Token>, // tokens in REVERSE order
    mode: Mode,
    /// No global object in Rust; pass context reference around
    ctx: &'a KatexContext,
    /// WRITR-RS PATCH: the latest state of every token object that was
    /// mutated in place, by [`Token::id`] (text, noexpand, treatAsRelax).
    /// KaTeX mutates shared `Token` objects, so copies of a mutated token
    /// that are still on the stack or in a macro definition pick the change
    /// up when they are read again (popped, or peeked with `future`).
    token_states: BTreeMap<u32, (TokenText, Option<bool>, Option<bool>)>,
}

impl<'a> MacroExpander<'a> {
    /// Create a new MacroExpander (also creates a new Lexer)
    #[must_use]
    pub fn new(input: &str, settings: &'a Settings, mode: Mode, ctx: &'a KatexContext) -> Self {
        // Build macros namespace: builtins from context, globals from
        // settings.macros
        let globals = settings.macros.borrow_mut();
        let macros = Namespace::new(&BUILTIN_MACROS, globals);

        Self {
            lexer: Lexer::new(Arc::from(input), settings),
            settings,
            expansion_count: 0,
            macros,
            mode,
            stack: Vec::new(),

            ctx,
            token_states: BTreeMap::new(),
        }
    }

    /// WRITR-RS PATCH: records an in-place mutation of `token` so that every
    /// other copy of the same JavaScript token object sees it (see
    /// [`Token::id`]).
    pub fn record_token(&mut self, token: &Token) {
        self.token_states.insert(
            token.id,
            (token.text.clone(), token.noexpand, token.treat_as_relax),
        );
    }

    /// WRITR-RS PATCH: brings a copy of a token object up to date with the
    /// mutations recorded by [`MacroExpander::record_token`].
    #[inline]
    fn refresh_token(
        states: &BTreeMap<u32, (TokenText, Option<bool>, Option<bool>)>,
        token: &mut Token,
    ) {
        if states.is_empty() {
            return;
        }
        if let Some((text, noexpand, treat_as_relax)) = states.get(&token.id) {
            token.text = text.clone();
            token.noexpand = *noexpand;
            token.treat_as_relax = *treat_as_relax;
        }
    }

    /// WRITR-RS PATCH: pops the top of the stack, up to date (see
    /// [`MacroExpander::refresh_token`]).
    fn pop_stack(&mut self) -> Option<Token> {
        let mut token = self.stack.pop()?;
        Self::refresh_token(&self.token_states, &mut token);
        Some(token)
    }

    /// Feed a new input string to the same MacroExpander (with existing macros
    /// etc.).
    pub fn feed(&mut self, input: &str) {
        self.lexer = Lexer::new(Arc::from(input), self.settings);
    }

    /// Switches between text and math modes
    pub const fn switch_mode(&mut self, new_mode: Mode) {
        self.mode = new_mode;
    }

    /// Ends all currently nested groups (if any)
    pub fn end_groups(&mut self) {
        self.macros.end_groups();
    }

    /// Sets the category code for a character in the lexer
    pub fn set_catcode(&mut self, char: char, code: u8) {
        self.lexer.set_catcode(char, code);
    }

    /// Add a token to the stack
    pub fn push_token(&mut self, token: Token) {
        self.stack.push(token);
    }

    /// Append multiple tokens to the stack
    // WRITR-RS PATCH: `this.stack.push(...tokens)` passes every token as a
    // call argument, so V8 throws `RangeError: Maximum call stack size
    // exceeded` for more than about 125k tokens (`stack_guard::check_spread`).
    // Upstream had no bound, and a self-duplicating macro such as
    // `\def\d#1#{#1#1#1}\d\d a{e}` grew the stack until memory ran out.
    pub fn push_tokens(&mut self, tokens: Vec<Token>) -> Result<(), ParseError> {
        crate::stack_guard::check_spread(tokens.len())?;
        self.stack.extend(tokens);
        Ok(())
    }

    /// Find a macro argument without expanding tokens and append the array of
    /// tokens to the token stack Returns a Token representing the argument
    /// range, or None for missing optional arg
    pub fn scan_argument(&mut self, is_optional: bool) -> Result<Option<Token>, ParseError> {
        let (start_tok, end_tok, tokens);
        if is_optional {
            self.consume_spaces()?;
            if self.future_mut()?.text != "[" {
                return Ok(None);
            }
            let start = self.pop_token()?; // drop [
            let arg = self.consume_arg(Some(&vec!["]".to_owned()]))?;
            start_tok = start;
            end_tok = arg.end;
            tokens = arg.tokens;
        } else {
            if let Some(range) = self.scan_braced_argument_in_place()? {
                return Ok(Some(range));
            }
            let arg = self.consume_arg(None)?;
            start_tok = arg.start;
            end_tok = arg.end;
            tokens = arg.tokens;
        }

        // indicate the end of an argument
        // WRITR-RS PATCH: the EOF marker carries the argument end's location
        // (MacroExpander.ts), which errors at the end of an argument report.
        self.push_token(Token::new("EOF", end_tok.loc.clone()));
        self.push_tokens(tokens)?;

        // compute range token with empty text
        let loc = SourceLocation::range(start_tok.loc, end_tok.loc);
        Ok(Some(Token {
            text: TokenText::from(String::new()),
            loc,
            noexpand: None,
            treat_as_relax: None,
            id: Token::fresh_id(),
        }))
    }

    /// WRITR-RS PATCH (performance): `scanArgument` for a braced argument
    /// whose tokens are all already on the stack (every nesting level below
    /// the first). `consumeArg` would pop the group, strip its braces and push
    /// it back behind an EOF marker at the closing brace's location; on the
    /// stack (tokens in reverse order) that is exactly "replace the closing
    /// brace with the marker and pop the opening brace", so no token moves.
    /// Returns `None` (having changed nothing but leading spaces, which
    /// `consume_arg` skips anyway) when the group is not complete on the
    /// stack or contains an EOF marker, so the general path runs and reports
    /// the same errors.
    fn scan_braced_argument_in_place(&mut self) -> Result<Option<Token>, ParseError> {
        self.consume_spaces()?;
        let Some(top) = self.stack.last() else {
            return Ok(None);
        };
        if top.text != "{" {
            return Ok(None);
        }
        let mut depth: isize = 0;
        let mut close = None;
        for index in (0..self.stack.len()).rev() {
            match self.stack[index].text.as_str() {
                "{" => depth += 1,
                "}" => {
                    depth -= 1;
                    if depth == 0 {
                        close = Some(index);
                        break;
                    }
                }
                "EOF" => return Ok(None),
                _ => {}
            }
        }
        let Some(close) = close else {
            return Ok(None);
        };
        // WRITR-RS PATCH: `scanArgument` pushes the group's tokens back with a
        // spread (see `push_tokens`), after pushing the EOF marker.
        crate::stack_guard::check_spread(self.stack.len() - close - 2)?;
        let close_loc = self.stack[close].loc.clone();
        let end = core::mem::replace(&mut self.stack[close], Token::new("EOF", close_loc));
        let start = self.stack.pop().expect("opening brace");
        Ok(Some(Token {
            text: TokenText::from(String::new()),
            loc: SourceLocation::range(start.loc, end.loc),
            noexpand: None,
            treat_as_relax: None,
            id: Token::fresh_id(),
        }))
    }

    /// Consume specified number of arguments with optional delimiters
    fn consume_args_with_delims(
        &mut self,
        num_args: usize,
        delimiters: Option<&Vec<Vec<String>>>,
    ) -> Result<Vec<Vec<Token>>, ParseError> {
        if let Some(d) = delimiters {
            if d.len() != num_args + 1 {
                return Err(ParseError::new(
                    ParseErrorKind::MacroDelimiterLengthMismatch,
                ));
            }
            for expected in &d[0] {
                let tok = self.pop_token()?;
                if expected != &tok.text {
                    return Err(ParseError::with_token(
                        ParseErrorKind::MacroDefinitionMismatch,
                        &tok,
                    ));
                }
            }
        }

        let mut args: Vec<Vec<Token>> = Vec::new();
        for i in 0..num_args {
            let delims_for_arg = delimiters.as_ref().map(|v| &v[i + 1]);
            let arg = self.consume_arg(delims_for_arg)?;
            args.push(arg.tokens);
        }
        Ok(args)
    }

    /// Increment expansion counter and check against max_expand
    fn count_expansion(&mut self, amount: usize) -> Result<(), ParseError> {
        self.expansion_count += amount;
        if self.expansion_count > self.settings.max_expand {
            return Err(ParseError::new(ParseErrorKind::MacroTooManyExpansions));
        }
        Ok(())
    }

    /// Expand the next token only once if possible
    fn expand_once_internal(&mut self, expandable_only: bool) -> Result<Option<isize>, ParseError> {
        let top_token = self.pop_token()?;
        let name = top_token.text.as_str();
        // WRITR-RS PATCH: errors thrown by macro functions propagate.
        let expansion = if top_token.noexpand == Some(true) {
            None
        } else {
            self.get_expansion(name)?
        };

        let expansion = match expansion {
            Some(exp) if !(expandable_only && exp.unexpandable == Some(true)) => exp,
            _ => {
                if expandable_only
                    && expansion.is_none()
                    && name.starts_with('\\')
                    && !self.is_defined(name)
                {
                    // WRITR-RS PATCH: MacroExpander.ts throws this one
                    // without a token (so without a position).
                    return Err(ParseError::new(ParseErrorKind::UndefinedControlSequence {
                        name: name.to_owned(),
                    }));
                }
                self.push_token(top_token);
                return Ok(None);
            }
        };

        self.count_expansion(1)?;
        let mut tokens = expansion.tokens;
        let args =
            self.consume_args_with_delims(expansion.num_args, expansion.delimiters.as_ref())?;
        if expansion.num_args > 0 {
            // Paste arguments in place of placeholders.
            // WRITR-RS PATCH: MacroExpander.ts splices the arguments in right
            // to left and then spreads the result into the stack
            // (`push_tokens`), which V8 refuses past about 125k tokens. The
            // first pass checks the placeholders in that order, with the same
            // errors, and sizes the result without building it: a body with
            // many placeholders of a large argument would otherwise
            // materialize (and splice, quadratically) millions of tokens that
            // only get rejected by the push. The second pass builds the
            // accepted result in one go.
            let mut len = tokens.len();
            let mut i = tokens.len();
            while i > 0 {
                i -= 1;
                if tokens[i].text != "#" {
                    continue;
                }
                if i == 0 {
                    return Err(ParseError::with_token(
                        ParseErrorKind::MacroIncompletePlaceholder,
                        &tokens[i],
                    ));
                }
                i -= 1;
                let tok = &tokens[i];
                if tok.text == "#" {
                    // ## -> #
                    len -= 1;
                } else if let Some(number) = placeholder_number(tok) {
                    // WRITR-RS PATCH: only /^[1-9]$/ is a placeholder, and
                    // a number past the macro's arguments spreads
                    // `undefined` in KaTeX: a V8 TypeError.
                    let Some(arg) = args.get(number - 1) else {
                        return Err(ParseError::new(ParseErrorKind::JsTypeError {
                            message: "args[((+tok.text) - 1)] is not iterable (cannot read property undefined)".to_owned(),
                        }));
                    };
                    // WRITR-RS PATCH: `tokens.splice(i, 2, ...arg)` is a
                    // spread call with `arg.length + 2` arguments.
                    crate::stack_guard::check_spread(arg.len() + 2)?;
                    len = len + arg.len() - 2;
                } else {
                    // WRITR-RS PATCH: MacroExpander.ts wording.
                    return Err(ParseError::with_token(
                        ParseErrorKind::NotAValidArgumentNumber,
                        tok,
                    ));
                }
            }
            crate::stack_guard::check_spread(len)?;
            // Built back to front: `##` keeps the `#` at the lower index
            // (`tokens.splice(i + 1, 1)` drops the other one), and `#n`
            // becomes the argument's tokens.
            let mut pasted: Vec<Token> = Vec::with_capacity(len);
            let mut rest = tokens.into_iter().rev();
            while let Some(tok) = rest.next() {
                if tok.text != "#" {
                    pasted.push(tok);
                    continue;
                }
                let next = rest.next().expect("checked above");
                if next.text == "#" {
                    pasted.push(next);
                } else {
                    let number = placeholder_number(&next).expect("checked above");
                    pasted.extend(args[number - 1].iter().rev().cloned());
                }
            }
            pasted.reverse();
            tokens = pasted;
        }
        let count = tokens.len();
        self.push_tokens(tokens)?;
        Ok(Some(count as isize))
    }

    /// Fully expand the given token stream to forward-order tokens
    fn expand_tokens_internal(&mut self, tokens: Vec<Token>) -> Result<Vec<Token>, ParseError> {
        let mut output: Vec<Token> = Vec::new();
        let old_len = self.stack.len();
        self.push_tokens(tokens)?;
        while self.stack.len() > old_len {
            if self.expand_once_internal(true)?.is_none() {
                let mut token = self
                    .pop_stack()
                    .ok_or_else(|| ParseError::new(ParseErrorKind::MacroStackUnexpectedlyEmpty))?;
                if token.treat_as_relax == Some(true) {
                    // the expansion of \noexpand is the token itself
                    token.noexpand = Some(false);
                    token.treat_as_relax = Some(false);
                    // WRITR-RS PATCH: MacroExpander.ts changes the object.
                    self.record_token(&token);
                }
                output.push(token);
            }
        }
        self.count_expansion(output.len())?;
        Ok(output)
    }

    /// Compute expansion for a name
    // WRITR-RS PATCH: errors from macro functions (and from lexing a macro's
    // string expansion) propagate, as in MacroExpander.ts `_getExpansion`;
    // upstream swallowed them and treated the macro as undefined.
    fn get_expansion(&mut self, name: &str) -> Result<Option<MacroExpansion>, ParseError> {
        // If single character has a catcode other than 13 (active), don't
        // expand it
        if name.chars().count() == 1
            && let Some(ch) = name.chars().next()
            && let Some(catcode) = self.lexer.get_catcode(ch)
            && catcode != 13
        {
            return Ok(None);
        }

        let Some(definition) = self.macros.get(name).cloned() else {
            return Ok(None);
        };

        let result = match definition {
            MacroDefinition::Function(f) => f(self as &mut dyn MacroContextInterface)?,
            MacroDefinition::StaticFunction(f) => f(self as &mut dyn MacroContextInterface)?,
            MacroDefinition::StaticStr(s) => return self.string_to_expansion(s).map(Some),
            MacroDefinition::String(s) => return self.string_to_expansion(&s).map(Some),
            MacroDefinition::Expansion(e) => return Ok(Some(e)),
        };
        match result {
            MacroExpansionResult::String(s) => self.string_to_expansion(&s).map(Some),
            MacroExpansionResult::Expansion(e) => Ok(Some(e)),
            MacroExpansionResult::Empty => Ok(Some(MacroExpansion::default())),
        }
    }

    fn string_to_expansion(&self, expansion: &str) -> Result<MacroExpansion, ParseError> {
        let mut num_args = 0usize;
        if expansion.contains('#') {
            let stripped = expansion.replace("##", "");
            while stripped.contains(&format!("#{}", num_args + 1)) {
                num_args += 1;
            }
        }

        let mut body_lexer = Lexer::new(Arc::from(expansion), self.settings);
        let mut tokens: Vec<Token> = Vec::new();
        loop {
            let tok = body_lexer.lex()?;
            if tok.text == "EOF" {
                break;
            }
            tokens.push(tok);
        }
        tokens.reverse();
        Ok(MacroExpansion {
            tokens,
            num_args,
            delimiters: None,
            unexpandable: None,
        })
    }
}

/// The argument number of a placeholder's second token (`/^[1-9]$/`).
fn placeholder_number(token: &Token) -> Option<usize> {
    match token.text.as_str().as_bytes() {
        [digit @ b'1'..=b'9'] => Some(usize::from(digit - b'0')),
        _ => None,
    }
}

impl<'a> MacroContextInterface<'a> for MacroExpander<'a> {
    fn mode(&self) -> Mode {
        self.mode
    }

    fn context(&self) -> &KatexContext {
        self.ctx
    }

    fn macros<'s>(&'s self) -> &'s Namespace<'a, MacroDefinition> {
        &self.macros
    }

    fn macros_mut<'s>(&'s mut self) -> &'s mut Namespace<'a, MacroDefinition> {
        &mut self.macros
    }

    fn future_mut(&mut self) -> Result<Token, ParseError> {
        if self.stack.is_empty() {
            let tok = self.lexer.lex()?;
            self.push_token(tok);
        } else if let Some(top) = self.stack.last_mut() {
            // WRITR-RS PATCH: see `refresh_token`.
            Self::refresh_token(&self.token_states, top);
        }
        self.stack
            .last()
            .cloned()
            .ok_or_else(|| ParseError::new(ParseErrorKind::EmptyMacroExpanderStack))
    }

    fn pop_token(&mut self) -> Result<Token, ParseError> {
        // No lookahead clone is needed when the token is immediately consumed.
        match self.pop_stack() {
            Some(token) => Ok(token),
            None => self.lexer.lex(),
        }
    }

    fn consume_spaces(&mut self) -> Result<(), ParseError> {
        loop {
            let token = self.future_mut()?;
            if token.text == " " {
                self.stack.pop();
            } else {
                break;
            }
        }
        Ok(())
    }

    fn expand_once(&mut self, expandable_only: Option<bool>) -> Result<Option<isize>, ParseError> {
        self.expand_once_internal(expandable_only.unwrap_or(false))
    }

    fn expand_after_future(&mut self) -> Result<Token, ParseError> {
        self.expand_once_internal(false)?;
        self.future_mut()
    }

    fn expand_next_token(&mut self) -> Result<Token, ParseError> {
        loop {
            if self.expand_once_internal(false)?.is_none() {
                let mut token = self
                    .pop_stack()
                    .ok_or_else(|| ParseError::new(ParseErrorKind::MacroStackUnexpectedlyEmpty))?;
                if token.treat_as_relax == Some(true) {
                    token.set_text("\\relax");
                    // WRITR-RS PATCH: MacroExpander.ts changes the object.
                    self.record_token(&token);
                }
                return Ok(token);
            }
        }
    }

    fn expand_macro(&mut self, name: &str) -> Result<Option<Vec<Token>>, ParseError> {
        if self.macros.has(name) {
            let toks = self.expand_tokens_internal(vec![Token::new(name.to_owned(), None)])?;
            Ok(Some(toks))
        } else {
            Ok(None)
        }
    }

    fn expand_macro_as_text(&mut self, name: &str) -> Result<Option<String>, ParseError> {
        self.expand_macro(name)?.map_or(Ok(None), |tokens| {
            let mut s = String::new();
            for t in tokens {
                s.push_str(t.text.as_str());
            }
            Ok(Some(s))
        })
    }

    fn expand_tokens(&mut self, tokens: Vec<Token>) -> Result<Vec<Token>, ParseError> {
        let toks: Vec<Token> = tokens.into_iter().collect();
        self.expand_tokens_internal(toks)
    }

    fn consume_arg(&mut self, delims: Option<&Vec<String>>) -> Result<MacroArg, ParseError> {
        let mut tokens: Vec<Token> = Vec::new();
        let is_delimited = delims.as_ref().is_some_and(|d| !d.is_empty());
        if !is_delimited {
            self.consume_spaces()?;
        }
        let start = self.future_mut()?;
        let start_is_brace = start.text == "{";
        let mut depth: isize = 0;
        let mut match_idx: usize = 0;
        // WRITR-RS PATCH (performance): tokens are moved into `tokens` rather
        // than cloned (two reference-count updates each), and each token's
        // text is read once and classified with a `match` (JavaScript compares
        // interned strings by pointer; `TokenText == &str` re-slices and
        // `memcmp`s every time). KaTeX re-scans every argument at each
        // nesting level, so this loop dominates deeply nested input.
        loop {
            tokens.push(self.pop_token()?);
            let tok = tokens.last().expect("just pushed");
            let text = tok.text.as_str();
            match text {
                "{" => depth += 1,
                "}" => {
                    depth -= 1;
                    if depth == -1 {
                        return Err(ParseError::with_token(
                            ParseErrorKind::ExtraCloseBrace,
                            tok,
                        ));
                    }
                }
                "EOF" => {
                    let expected = delims.as_ref().map_or("}", |d| {
                        if is_delimited {
                            d.get(match_idx).map_or("}", String::as_str)
                        } else {
                            "}"
                        }
                    });
                    return Err(ParseError::with_token(
                        ParseErrorKind::UnexpectedEndOfMacroArgument {
                            expected: expected.to_owned(),
                        },
                        tok,
                    ));
                }
                _ => {}
            }
            if let Some(d) = &delims
                && is_delimited
            {
                if (depth == 0 || (depth == 1 && d[match_idx] == "{")) && text == d[match_idx] {
                    match_idx += 1;
                    if match_idx == d.len() {
                        break;
                    }
                } else {
                    match_idx = 0;
                }
            }
            if depth == 0 && !is_delimited {
                // undelimited arg: stop after a single token or a {...} group
                if !start_is_brace || text == "}" {
                    break;
                }
            }
            if depth == 0 && is_delimited {
                // keep going until delimiters matched
            }
        }

        let end = tokens.last().expect("consumed at least one token").clone();
        if is_delimited {
            // don't include delimiters
            let keep = tokens.len() - match_idx;
            tokens.truncate(keep);
            // WRITR-RS PATCH: a brace-delimited parameter (`\def\a#1#{…}`)
            // whose argument starts with `{` matches the delimiter at once, so
            // nothing is left and MacroExpander.ts reads
            // `tokens[tokens.length - 1].text` of `undefined`: a V8 TypeError
            // (not a ParseError, so the `throwOnError: false` retry rethrows
            // it). Upstream took it as an empty argument.
            if start_is_brace && tokens.is_empty() {
                return Err(ParseError::new(ParseErrorKind::JsTypeError {
                    message: "Cannot read properties of undefined (reading 'text')".to_owned(),
                }));
            }
        }
        // Remove outermost braces if present
        let braced = start_is_brace && tokens.last().map(|t| t.text.as_str()) == Some("}");
        if braced {
            tokens.pop();
        }
        tokens.reverse();
        // WRITR-RS PATCH (performance): the opening brace is now last; popping
        // it replaces an O(n) `remove(0)`.
        if braced && !tokens.is_empty() {
            tokens.pop();
        }
        Ok(MacroArg { tokens, start, end })
    }

    fn consume_args(&mut self, num_args: usize) -> Result<Vec<Vec<Token>>, ParseError> {
        self.consume_args_with_delims(num_args, None)
    }

    fn is_defined(&self, name: &str) -> bool {
        if self.macros.has(name) {
            return true;
        }

        if self.ctx.functions.contains_key(name) {
            return true;
        }

        if IMPLICIT_COMMANDS.contains(name) {
            return true;
        }

        let symbols = &self.ctx.symbols;
        symbols.contains(Mode::Math, name) || symbols.contains(Mode::Text, name)
    }

    fn is_expandable(&self, name: &str) -> bool {
        if let Some(def) = self.macros.get(name) {
            match def {
                MacroDefinition::Expansion(e) => e.unexpandable != Some(true),
                _ => true,
            }
        } else {
            if let Some(md) = self.macros.get(name) {
                return match md {
                    MacroDefinition::Expansion(e) => !e.unexpandable.unwrap_or(false),
                    _ => true,
                };
            }

            self.ctx.functions.contains_key(name) && !self.ctx.functions[name].primitive
        }
    }

    fn begin_group(&mut self) {
        self.macros.begin_group();
    }

    fn end_group(&mut self) -> Result<(), ParseError> {
        self.macros.end_group()
    }

    fn record_token_mutation(&mut self, token: &Token) {
        self.record_token(token);
    }
}

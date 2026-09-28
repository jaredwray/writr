//! Implementation of the \verb command in KaTeX
//!
//! This module implements the LaTeX `\verb` command, which creates verbatim
//! text that preserves exact formatting and spacing.

use alloc::borrow::Cow;

use crate::ClassList;
use crate::build_common::{
    make_span, make_symbol, make_symbol_without_metrics, push_combine_chars,
};
use crate::context::KatexContext;
use crate::define_function::{FunctionDefSpec, FunctionPropSpec};
use crate::dom_tree::HtmlDomNode;
use crate::mathml_tree::{MathDomNode, MathNode, MathNodeType, TextNode};
use crate::options::Options;
use crate::parser::parse_node::{NodeType, ParseNode, ParseNodeVerb};
use crate::types::{ParseError, ParseErrorKind};

/// Register the \verb function in the KaTeX context.
pub fn define_verb(ctx: &mut KatexContext) {
    ctx.define_function(FunctionDefSpec {
        node_type: Some(NodeType::Verb),
        names: &["\\verb"],
        props: FunctionPropSpec {
            num_args: 0,
            allowed_in_text: true,
            ..Default::default()
        },
        handler: Some(
            |_context, _args: Vec<ParseNode>, _opt_args: Vec<Option<ParseNode>>| {
                // \verb and \verb* are dealt with directly in Parser.js.
                // If we end up here, it's because of a failure to match the two
                // delimiters in the regex in Lexer.js.  LaTeX
                // raises the following error when \verb is
                // terminated by end of line (or file).
                Err(ParseError::new(ParseErrorKind::VerbMissingDelimiter))
            },
        ),
        html_builder: Some(html_builder),
        mathml_builder: Some(mathml_builder),
    });
}

/// HTML builder for the \verb function
fn html_builder(
    node: &ParseNode,
    options: &Options,
    ctx: &KatexContext,
) -> Result<HtmlDomNode, ParseError> {
    if let ParseNode::Verb(verb_node) = node {
        let text = make_verb(verb_node);
        let mut body: Vec<HtmlDomNode> = Vec::new();

        // \verb enters text mode and therefore is sized like \textstyle
        // WRITR-RS PATCH: verb.ts uses `options.style.text()`, which keeps
        // display style (then havingStyle returns the options unchanged and
        // there are no sizing classes).
        let new_options = options.having_style(options.style.text());

        for ch in text.chars() {
            // WRITR-RS PATCH: verb.ts walks `text[i]`, i.e. UTF-16 code
            // units, so an astral character becomes two lone surrogates.
            // Neither is in the symbol table (𝒜 is not replaced by A) nor
            // in the font metrics, and tryCombineChars joins the halves again
            // (they always combine with each other), which is one metric-less
            // symbol holding the whole character.
            if ch.len_utf16() == 2 {
                let symbol = make_symbol_without_metrics(
                    &ch.to_string(),
                    Some(&new_options),
                    ClassList::Const(&["mord", "texttt"]),
                );
                push_combine_chars(&mut body, symbol.into());
                continue;
            }

            let c = if ch == '~' {
                "\\textasciitilde".to_owned()
            } else {
                ch.to_string()
            };

            let symbol = make_symbol(
                ctx,
                &c,
                "Typewriter-Regular",
                verb_node.mode,
                Some(&new_options),
                ClassList::Const(&["mord", "texttt"]),
            )?;
            push_combine_chars(&mut body, symbol.into());
        }

        let mut classes = vec![Cow::Borrowed("mord"), Cow::Borrowed("text")];
        classes.extend(new_options.sizing_classes(options));

        let span_struct = make_span(classes, body, Some(&new_options), None);
        Ok(HtmlDomNode::DomSpan(span_struct))
    } else {
        Err(ParseError::new(ParseErrorKind::ExpectedNode {
            node: NodeType::Verb,
        }))
    }
}

/// MathML builder for the \verb function
fn mathml_builder(
    node: &ParseNode,
    _options: &Options,
    _ctx: &KatexContext,
) -> Result<MathDomNode, ParseError> {
    if let ParseNode::Verb(verb_node) = node {
        let text = make_verb(verb_node);
        let text_node = TextNode { text };

        let mut mtext = MathNode::builder()
            .node_type(MathNodeType::Mtext)
            .children(vec![MathDomNode::Text(text_node)])
            .build();

        mtext
            .attributes
            .insert("mathvariant".to_owned(), "monospace".to_owned());

        Ok(MathDomNode::Math(mtext))
    } else {
        Err(ParseError::new(ParseErrorKind::ExpectedNode {
            node: NodeType::Verb,
        }))
    }
}

/// Converts verb group into body string.
///
/// \verb* replaces each space with an open box \u2423
/// \verb replaces each space with a no-break space \xA0
fn make_verb(group: &ParseNodeVerb) -> String {
    group
        .body
        .replace(' ', if group.star { "\u{2423}" } else { "\u{A0}" })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::Mode;

    #[test]
    fn test_make_verb_no_star() {
        let verb_node = ParseNodeVerb {
            mode: Mode::Text,
            loc: None,
            body: "hello world".into(),
            star: false,
        };
        let result = make_verb(&verb_node);
        assert_eq!(result, "hello\u{A0}world");
    }

    #[test]
    fn test_make_verb_with_star() {
        let verb_node = ParseNodeVerb {
            mode: Mode::Text,
            loc: None,
            body: "hello world".into(),
            star: true,
        };
        let result = make_verb(&verb_node);
        assert_eq!(result, "hello\u{2423}world");
    }

    #[test]
    fn test_make_verb_no_spaces() {
        let verb_node = ParseNodeVerb {
            mode: Mode::Text,
            loc: None,
            body: "helloworld".into(),
            star: false,
        };
        let result = make_verb(&verb_node);
        assert_eq!(result, "helloworld");
    }
}

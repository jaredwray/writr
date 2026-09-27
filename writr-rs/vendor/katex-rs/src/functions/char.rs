//! Implementation of the \@char function in KaTeX
//!
//! This module implements the \@char LaTeX command, which converts a decimal
//! number to the corresponding Unicode character. It is used internally by
//! the \char macro to create symbols from code points.

use crate::context::KatexContext;
use crate::define_function::{FunctionDefSpec, FunctionPropSpec};
use crate::parser::parse_node::{AnyParseNode, NodeType, ParseNode, ParseNodeTextOrd};
use crate::types::{ParseError, ParseErrorKind, TokenText};

/// Register the \@char function
pub fn define_char(ctx: &mut KatexContext) {
    ctx.define_function(FunctionDefSpec {
        node_type: Some(NodeType::TextOrd),
        names: &["\\@char"],
        props: FunctionPropSpec {
            num_args: 1,
            allowed_in_text: true,
            ..Default::default()
        },
        handler: Some(
            |context, args: Vec<ParseNode>, _opt_args: Vec<Option<ParseNode>>| {
                // Extract the first argument, which should be an ordgroup
                let arg = &args[0];
                let ParseNode::OrdGroup(ordgroup) = arg else {
                    return Err(ParseError::new(ParseErrorKind::CharArgumentMustBeOrdGroup));
                };

                // Accept only plain textord characters, as upstream does.
                let mut number_str = String::new();
                for node in &ordgroup.body {
                    match node {
                        AnyParseNode::TextOrd(textord) => {
                            number_str.push_str(&textord.text);
                        }
                        _ => {
                            return Err(ParseError::with_token(
                                ParseErrorKind::CharOrdGroupContentInvalid,
                                arg,
                            ));
                        }
                    }
                }

                // WRITR-RS PATCH: char.ts uses parseInt (leading digits, hex
                // after a `0x`/`0X` prefix: `\@char{0x41}` is `A`) and
                // String.fromCharCode, which makes a lone surrogate for
                // U+D800..U+DFFF; Rust strings cannot hold one, so it becomes
                // `TokenText::LoneSurrogate`, which reads as U+FFFD (how the
                // surrogate prints once the markup is well-formed) and keeps
                // the unit for makeOrd's wide-character test.
                let code = crate::utils::js_parse_int(&number_str);
                if code.is_nan() {
                    return Err(ParseError::new(ParseErrorKind::CharNonNumericArgument {
                        value: number_str.clone(),
                    }));
                }

                // Validate the code point range
                if !(0.0..=1_114_111.0).contains(&code) {
                    return Err(ParseError::new(ParseErrorKind::InvalidCharCodePoint {
                        code: number_str.clone(),
                    }));
                }

                // Convert code point to character(s)
                let code = code as u32;
                let text = char::from_u32(code)
                    .map_or(TokenText::LoneSurrogate(code as u16), |text| {
                        TokenText::from(text.to_string())
                    });

                // Return a textord node with the character
                Ok(ParseNode::TextOrd(ParseNodeTextOrd {
                    mode: context.parser.mode,
                    loc: context.loc(),
                    text,
                }))
            },
        ),
        html_builder: None,
        mathml_builder: None,
    });
}

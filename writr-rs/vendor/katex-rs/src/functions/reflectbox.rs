//! WRITR-RS PATCH (KaTeX 0.18.7): port of `src/functions/reflectbox.ts`.
//!
//! `\reflectbox{...}` mirrors its argument horizontally. Its argument is an
//! hbox (text mode in `\textstyle`, like LaTeX's text-box behavior);
//! `\mathreflectbox{...}` takes a math argument instead, so the shared
//! builders inherit the surrounding style.

use crate::build_common::make_span;
use crate::define_function::{FunctionContext, FunctionDefSpec, FunctionPropSpec};
use crate::dom_tree::HtmlDomNode;
use crate::mathml_tree::MathDomNode;
use crate::options::Options;
use crate::parser::parse_node::{NodeType, ParseNode, ParseNodeReflectbox};
use crate::types::{ArgType, ClassList, Mode, ParseError, ParseErrorKind};
use crate::{KatexContext, build_html, build_mathml};

/// Handler shared by `\reflectbox` and `\mathreflectbox`.
fn handler(
    context: FunctionContext,
    args: Vec<ParseNode>,
    _opt_args: Vec<Option<ParseNode>>,
) -> Result<ParseNode, ParseError> {
    let body = args
        .into_iter()
        .next()
        .ok_or_else(|| ParseError::new(ParseErrorKind::ExpectedNode { node: NodeType::Reflectbox }))?;
    Ok(ParseNode::Reflectbox(ParseNodeReflectbox {
        mode: context.parser.mode,
        loc: context.loc(),
        body: Box::new(body),
    }))
}

/// Registers `\reflectbox` and `\mathreflectbox` in the KaTeX context.
pub fn define_reflectbox(ctx: &mut KatexContext) {
    ctx.define_function(FunctionDefSpec {
        node_type: Some(NodeType::Reflectbox),
        names: &["\\reflectbox"],
        props: FunctionPropSpec {
            num_args: 1,
            arg_types: Some(vec![ArgType::Hbox]),
            allowed_in_text: true,
            ..Default::default()
        },
        handler: Some(handler),
        html_builder: Some(html_builder),
        mathml_builder: Some(mathml_builder),
    });

    // Parse math directly so the shared builders inherit the surrounding
    // style. \reflectbox instead uses an hbox argument for LaTeX's text-box
    // behavior.
    ctx.define_function(FunctionDefSpec {
        node_type: Some(NodeType::Reflectbox),
        names: &["\\mathreflectbox"],
        props: FunctionPropSpec {
            num_args: 1,
            arg_types: Some(vec![ArgType::Mode(Mode::Math)]),
            ..Default::default()
        },
        handler: Some(handler),
        html_builder: None,
        mathml_builder: None,
    });
}

/// HTML builder for reflectbox nodes
fn html_builder(
    node: &ParseNode,
    options: &Options,
    ctx: &KatexContext,
) -> Result<HtmlDomNode, ParseError> {
    let ParseNode::Reflectbox(reflectbox) = node else {
        return Err(ParseError::new(ParseErrorKind::ExpectedNode {
            node: NodeType::Reflectbox,
        }));
    };
    let body = build_html::build_group(ctx, &reflectbox.body, options, None)?;
    Ok(make_span(
        ClassList::Const(&["mord", "reflectbox"]),
        vec![body],
        Some(options),
        None,
    )
    .into())
}

/// MathML builder for reflectbox nodes: the body alone.
fn mathml_builder(
    node: &ParseNode,
    options: &Options,
    ctx: &KatexContext,
) -> Result<MathDomNode, ParseError> {
    let ParseNode::Reflectbox(reflectbox) = node else {
        return Err(ParseError::new(ParseErrorKind::ExpectedNode {
            node: NodeType::Reflectbox,
        }));
    };
    build_mathml::build_group(ctx, &reflectbox.body, options)
}

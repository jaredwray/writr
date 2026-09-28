//! Implementation of kerning and spacing commands in KaTeX
//!
//! This module implements the LaTeX kerning commands `\kern`, `\mkern`,
//! `\hskip`, and `\mskip`, which provide explicit horizontal spacing in
//! mathematical expressions.

use crate::context::KatexContext;
use crate::define_function::{FunctionDefSpec, FunctionPropSpec};
use crate::dom_tree::HtmlDomNode;
use crate::mathml_tree::{MathDomNode, SpaceNode};
use crate::options::Options;
use crate::parser::parse_node::{AnyParseNode, NodeType, ParseNode, ParseNodeKern};
use crate::types::{
    ArgType, ErrorLocationProvider, Mode, ParseError, ParseErrorKind,
};

/// Register the kerning functions (\kern, \mkern, \hskip, \mskip)
pub fn define_kern(ctx: &mut KatexContext) {
    ctx.define_function(FunctionDefSpec {
        node_type: Some(NodeType::Kern),
        names: &["\\kern", "\\mkern", "\\hskip", "\\mskip"],
        props: FunctionPropSpec {
            num_args: 1,
            arg_types: Some(vec![ArgType::Size]),
            primitive: true,
            allowed_in_text: true,
            ..Default::default()
        },
        handler: Some(
            |context, args: Vec<ParseNode>, _opt_args: Vec<Option<ParseNode>>| {
                // Extract the size argument
                let size_arg = args
                    .first()
                    .ok_or_else(|| ParseError::new(ParseErrorKind::ExpectedSizeArgument))?;
                let AnyParseNode::Size(size_node) = size_arg else {
                    return Err(ParseError::new(ParseErrorKind::ExpectedSizeArgument));
                };

                // Strict mode validations
                if context.parser.settings.use_strict_behavior(
                    "mathVsTextUnits",
                    "",
                    context
                        .token
                        .as_ref()
                        .map(|t| *t as &dyn ErrorLocationProvider),
                ) {
                    let func_name = &context.func_name;
                    let math_function = func_name.chars().nth(1) == Some('m'); // \mkern, \mskip
                    let mu_unit = size_node.value.unit == "mu";

                    if math_function {
                        if !mu_unit {
                            context.parser.settings.report_nonstrict(
                                "mathVsTextUnits",
                                &format!(
                                    "LaTeX's {} supports only mu units, not {} units",
                                    func_name, size_node.value.unit
                                ),
                                context
                                    .token
                                    .as_ref()
                                    .map(|t| *t as &dyn ErrorLocationProvider),
                            )?;
                        }
                        if context.parser.mode != Mode::Math {
                            context.parser.settings.report_nonstrict(
                                "mathVsTextUnits",
                                &format!("LaTeX's {func_name} works only in math mode"),
                                context
                                    .token
                                    .as_ref()
                                    .map(|t| *t as &dyn ErrorLocationProvider),
                            )?;
                        }
                    } else {
                        // !math_function (\kern, \hskip)
                        if mu_unit {
                            context.parser.settings.report_nonstrict(
                                "mathVsTextUnits",
                                &format!("LaTeX's {func_name} doesn't support mu units"),
                                context
                                    .token
                                    .as_ref()
                                    .map(|t| *t as &dyn ErrorLocationProvider),
                            )?;
                        }
                    }
                }

                Ok(ParseNode::Kern(ParseNodeKern {
                    mode: context.parser.mode,
                    loc: context.loc(),
                    dimension: size_node.value.clone(),
                }))
            },
        ),
        html_builder: Some(html_builder),
        mathml_builder: Some(mathml_builder),
    });
}

/// HTML builder for kerning functions
fn html_builder(
    node: &ParseNode,
    options: &Options,
    ctx: &KatexContext,
) -> Result<HtmlDomNode, ParseError> {
    if let ParseNode::Kern(kern_node) = node {
        // WRITR-RS PATCH: kern.ts's htmlBuilder is just `makeGlue` (color
        // before margin-right, maxFontSize 0, calculateSize errors thrown).
        Ok(ctx.make_glue(&kern_node.dimension, options)?.into())
    } else {
        Err(ParseError::new(ParseErrorKind::ExpectedNode {
            node: NodeType::Kern,
        }))
    }
}

/// MathML builder for kerning functions
fn mathml_builder(
    node: &ParseNode,
    options: &Options,
    ctx: &KatexContext,
) -> Result<MathDomNode, ParseError> {
    if let ParseNode::Kern(kern_node) = node {
        // Use calculate_size to properly convert the measurement to ems
        // WRITR-RS PATCH: calculateSize errors are thrown, not replaced.
        let dimension = ctx.calculate_size(&kern_node.dimension, options)?;

        Ok(SpaceNode::new(dimension).into())
    } else {
        Err(ParseError::new(ParseErrorKind::ExpectedNode {
            node: NodeType::Kern,
        }))
    }
}

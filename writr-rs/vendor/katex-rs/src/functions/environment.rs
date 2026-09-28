//! Environment function implementations for KaTeX Rust
//!
//! This module handles the `\begin` and `\end` commands for LaTeX environments,
//! providing the core functionality for structured content like matrices,
//! arrays, and other mathematical constructs.
//!
//! Migrated from KaTeX's functions/environment.js.

use crate::KatexContext;
use crate::define_environment::EnvContext;
use crate::define_function::{FunctionDefSpec, FunctionPropSpec};
use crate::parser::parse_node::{AnyParseNode, NodeType, ParseNode, ParseNodeEnvironment};
use crate::types::{ArgType, Mode, ParseError, ParseErrorKind};

/// Environment delimiters. HTML/MathML rendering is defined in the
/// corresponding defineEnvironment definitions.
pub fn define_environment(ctx: &mut KatexContext) {
    let spec = FunctionDefSpec {
        node_type: Some(NodeType::Environment),
        names: &["\\begin", "\\end"],
        props: FunctionPropSpec {
            num_args: 1,
            arg_types: Some(vec![ArgType::Mode(Mode::Text)]),
            ..Default::default()
        },
        handler: Some(|context, args, _opt_args| {
            let func_name = context.func_name;
            let parser = context.parser;
            // WRITR-RS PATCH: environment.ts messages and locations (the
            // name group).
            let ParseNode::OrdGroup(name_group) = &args[0] else {
                return Err(ParseError::with_token(
                    ParseErrorKind::InvalidEnvironmentName,
                    &args[0],
                ));
            };
            let mut env_name = String::new();
            for item in &name_group.body {
                if let AnyParseNode::TextOrd(text_ord) = item {
                    env_name.push_str(&text_ord.text);
                } else if matches!(item, AnyParseNode::Spacing(spacing) if spacing.text == " ") {
                    env_name.push(' ');
                } else {
                    return Err(ParseError::with_token(
                        ParseErrorKind::EnvironmentNameNotText,
                        &args[0],
                    ));
                }
            }

            // Handles \\end
            if func_name != "\\begin" {
                let env = ParseNodeEnvironment {
                    mode: parser.mode,
                    loc: None,
                    name: env_name.clone(),
                    // right_delim: None,
                    // size: None,
                    // bar_size: None,
                    name_group: args[0].clone().into(),
                };
                return Ok(env.into());
            }

            // begin...end is similar to left...right
            let Some(env_spec) = parser.ctx.environments.get(&env_name) else {
                return Err(ParseError::with_token(
                    ParseErrorKind::NoSuchEnvironment {
                        name: env_name.clone(),
                    },
                    &args[0],
                ));
            };

            // Build the environment object. Arguments and other information
            // will be made available to the begin and end methods
            // using properties.
            let (args, opt_args) =
                parser.parse_arguments(&format!("\\begin{{{env_name}}}"), env_spec.as_ref())?;
            let env_context = EnvContext {
                mode: parser.mode,
                parser,
                env_name: env_name.clone(),
            };
            let result = (env_spec.handler)(env_context, args, opt_args)?;
            parser.expect("\\end", false)?;
            let end_name_token = parser.next_token.clone();
            let end = parser.parse_function(None, None)?;
            let Some(ParseNode::Environment(end_node)) = end else {
                // WRITR-RS PATCH: parseNode.ts assertNodeType's plain Error.
                return Err(ParseError::new(ParseErrorKind::JsError {
                    message: format!(
                        "Expected node of type environment, but got {}",
                        end.as_ref().map_or_else(
                            || "null".to_owned(),
                            |node| format!(
                                "node of type {}",
                                crate::types::js_node_type_name(node)
                            )
                        )
                    ),
                }));
            };
            if end_node.name != env_name {
                return Err(ParseError::with_token(
                    ParseErrorKind::MismatchedEnvironmentEnd {
                        begin: env_name,
                        end: end_node.name,
                    },
                    &end_name_token,
                ));
            }
            Ok(result)
        }),
        html_builder: None, // Environment-specific builders are handled by individual environments
        mathml_builder: None,
    };

    ctx.define_function(spec);
}

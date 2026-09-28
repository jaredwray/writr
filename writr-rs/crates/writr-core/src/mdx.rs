//! MDX expression and ESM validation with writr-acorn, the native port of
//! the Acorn/acorn-jsx parser and events-to-acorn adapter remark-mdx uses.
//! Source is only parsed: expressions and modules never execute.
use crate::RenderError;
use markdown::{mdast::Node, MdxExpressionKind, MdxSignal, ParseOptions};
use std::cell::RefCell;
use std::rc::Rc;
use writr_acorn::{Kind, Signal};

struct Parsed {
	signal: MdxSignal,
	imports: Vec<String>,
}
fn parse_js(
	input: &str,
	kind: Kind,
	imports: &[String],
	defer_exports: bool,
) -> Result<Parsed, String> {
	let outcome =
		writr_acorn::validate(input, kind, imports, defer_exports).map_err(|error| error.0)?;
	let source = Box::new("writr-mdx".to_string());
	let rule = Box::new("acorn".to_string());
	let signal = match outcome.signal {
		Signal::Ok => MdxSignal::Ok,
		Signal::Eof => MdxSignal::Eof(outcome.message, source, rule),
		Signal::Error => MdxSignal::Error(
			outcome.message,
			byte_offset(input, outcome.pos),
			source,
			rule,
		),
	};
	Ok(Parsed {
		signal,
		imports: outcome.imports,
	})
}
// Acorn offsets count UTF-16 code units; markdown-rs expects UTF-8 byte offsets.
fn byte_offset(input: &str, units: usize) -> usize {
	let mut count = 0;
	for (offset, ch) in input.char_indices() {
		if count >= units {
			return offset;
		}
		count += ch.len_utf16();
	}
	input.len()
}
fn callback(input: &str, kind: Kind, failure: &RefCell<Option<String>>) -> MdxSignal {
	match parse_js(input, kind, &[], true) {
		Ok(parsed) => parsed.signal,
		Err(error) => {
			*failure.borrow_mut() = Some(error.clone());
			MdxSignal::Error(
				error,
				0,
				Box::new("writr-mdx".into()),
				Box::new("runtime".into()),
			)
		}
	}
}
pub fn parse(input: &str, mut options: ParseOptions) -> Result<Node, RenderError> {
	let failure = Rc::new(RefCell::new(None));
	let expressions = Rc::clone(&failure);
	options.mdx_expression_parse = Some(Box::new(move |input, kind| {
		callback(
			input,
			match kind {
				MdxExpressionKind::Expression => Kind::Expression,
				MdxExpressionKind::AttributeExpression => Kind::Spread,
				MdxExpressionKind::AttributeValueExpression => Kind::Attribute,
			},
			&expressions,
		)
	}));
	let esm = Rc::clone(&failure);
	options.mdx_esm_parse = Some(Box::new(move |input| callback(input, Kind::Esm, &esm)));
	let result = markdown::to_mdast(input, &options);
	if let Some(error) = failure.borrow_mut().take() {
		return Err(RenderError::Runtime(error));
	}
	let tree = result.map_err(|e| RenderError::Parse(e.to_string()))?;
	// Tokenizers can speculatively parse the same block more than once. Validate
	// imported names against the completed AST, never mutate state in a callback.
	validate_modules(&tree, &mut Vec::new())?;
	Ok(tree)
}
fn validate_modules(node: &Node, imports: &mut Vec<String>) -> Result<(), RenderError> {
	if let Node::MdxjsEsm(esm) = node {
		let parsed =
			parse_js(&esm.value, Kind::Esm, imports, false).map_err(RenderError::Runtime)?;
		match parsed.signal {
			MdxSignal::Ok => imports.extend(parsed.imports),
			MdxSignal::Error(message, ..) | MdxSignal::Eof(message, ..) => {
				return Err(RenderError::Parse(message))
			}
		}
	}
	if let Some(children) = node.children() {
		for child in children {
			validate_modules(child, imports)?;
		}
	}
	Ok(())
}

#[cfg(test)]
mod tests {
	use super::*;
	#[test]
	fn acorn_offsets_are_utf8_boundaries() {
		assert_eq!(byte_offset("a😀é", 0), 0);
		assert_eq!(byte_offset("a😀é", 1), 1);
		assert_eq!(byte_offset("a😀é", 3), 5);
		assert_eq!(byte_offset("a😀é", 4), 7);
	}
	#[test]
	fn incomplete_syntax_is_not_a_runtime_failure() {
		let failure = RefCell::new(None);
		assert!(matches!(
			callback("1 +", Kind::Expression, &failure),
			MdxSignal::Eof(..)
		));
		assert!(failure.borrow().is_none());
	}
	#[test]
	fn runtime_failures_are_not_accepted_as_parse_rejections() {
		// acorn reads the first token outside `catchStackOverflow`, so a
		// regular expression nested too deeply for the stack there throws a
		// `RangeError` in JavaScript: writr emits it rather than rejecting the
		// document with a located MDX diagnostic.
		let regexp = "/".to_string() + &"(".repeat(100_000) + &")".repeat(100_000) + "/";
		let result = crate::render(
			&format!("{{{regexp}}}"),
			&crate::RenderOptions {
				mdx: true,
				..crate::RenderOptions::all_off()
			},
		);
		assert!(matches!(result, Err(RenderError::Runtime(_))));
		assert!(result
			.unwrap_err()
			.to_string()
			.starts_with("runtime error:"));
	}
}

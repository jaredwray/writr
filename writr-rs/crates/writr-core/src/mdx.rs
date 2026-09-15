//! The existing QuickJS runtime hosts the same Acorn/JSX syntax parser as
//! remark-mdx. Only the bundled parser executes: source is passed as a string,
//! never evaluated, and modules are never loaded. No formula/output memoization.
use crate::RenderError;
use markdown::{mdast::Node, MdxExpressionKind, MdxSignal, ParseOptions};
use rquickjs::{Context, Function, Object, Runtime};
use std::cell::{OnceCell, RefCell};
use std::rc::Rc;

thread_local! {
 static PARSER: OnceCell<Result<Context, String>> = const { OnceCell::new() };
}
struct Parsed {
	signal: MdxSignal,
	imports: Vec<String>,
}
fn parse_js(
	input: &str,
	kind: &str,
	imports: &[String],
	defer_exports: bool,
) -> Result<Parsed, String> {
	PARSER.with(|cell| {
		let context = cell
			.get_or_init(|| {
				let runtime = Runtime::new().map_err(|e| e.to_string())?;
				runtime.set_max_stack_size(4 * 1024 * 1024);
				let context = Context::full(&runtime).map_err(|e| e.to_string())?;
				context
					.with(|ctx| ctx.eval::<(), _>(include_str!("../vendor/mdx/parser.js")))
					.map_err(|e| e.to_string())?;
				Ok(context)
			})
			.as_ref()
			.map_err(Clone::clone)?;
		context.with(|ctx| {
			let function: Function = ctx
				.globals()
				.get("__writrMdx")
				.map_err(|e| format!("parser entry point: {e}"))?;
			let result: Object = function
				.call((input, kind, imports.to_vec(), defer_exports))
				.map_err(|e| format!("syntax parser execution: {e}"))?;
			let kind: String = result.get("kind").map_err(|e| e.to_string())?;
			let message: String = result.get("message").map_err(|e| e.to_string())?;
			let offset: usize = result.get("pos").map_err(|e| e.to_string())?;
			let imports = result.get("imports").map_err(|e| e.to_string())?;
			let source = Box::new("writr-mdx".to_string());
			let rule = Box::new("acorn".to_string());
			let signal = match kind.as_str() {
				"ok" => MdxSignal::Ok,
				"eof" => MdxSignal::Eof(message, source, rule),
				"error" => MdxSignal::Error(message, byte_offset(input, offset), source, rule),
				_ => return Err(format!("unexpected parser result {kind}")),
			};
			Ok(Parsed { signal, imports })
		})
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
fn callback(input: &str, kind: &str, failure: &RefCell<Option<String>>) -> MdxSignal {
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
				MdxExpressionKind::Expression => "expression",
				MdxExpressionKind::AttributeExpression => "spread",
				MdxExpressionKind::AttributeValueExpression => "attribute",
			},
			&expressions,
		)
	}));
	let esm = Rc::clone(&failure);
	options.mdx_esm_parse = Some(Box::new(move |input| callback(input, "esm", &esm)));
	let result = markdown::to_mdast(input, &options);
	if let Some(error) = failure.borrow_mut().take() {
		return Err(RenderError::JavaScript(error));
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
			parse_js(&esm.value, "esm", imports, false).map_err(RenderError::JavaScript)?;
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
			callback("1 +", "expression", &failure),
			MdxSignal::Eof(..)
		));
		assert!(failure.borrow().is_none());
	}
	#[test]
	fn runtime_failures_are_not_accepted_as_parse_rejections() {
		assert!(parse_js("1", "expression", &[], false).is_ok());
		for replacement in [
			"undefined",
			"() => { throw new Error('runtime fault'); }",
			"() => ({kind:'invalid',message:'',pos:0,imports:[]})",
		] {
			PARSER.with(|cell| cell.get().unwrap().as_ref().unwrap().with(|ctx| {
				ctx.eval::<(), _>(format!("globalThis.__savedMdx = __writrMdx; globalThis.__writrMdx = {replacement};")).unwrap();
			}));
			let result = crate::render(
				"{1}",
				&crate::RenderOptions {
					mdx: true,
					..crate::RenderOptions::all_off()
				},
			);
			PARSER.with(|cell| {
				cell.get().unwrap().as_ref().unwrap().with(|ctx| {
					ctx.eval::<(), _>(
						"globalThis.__writrMdx = __savedMdx; delete globalThis.__savedMdx;",
					)
					.unwrap();
				})
			});
			assert!(matches!(result, Err(RenderError::JavaScript(_))));
			assert!(result
				.unwrap_err()
				.to_string()
				.starts_with("embedded JavaScript error:"));
		}
	}
}

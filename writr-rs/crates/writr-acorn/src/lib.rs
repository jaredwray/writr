//! writr-acorn — a Rust port of acorn 8.18.0 with the acorn-jsx 5.3.2
//! plugin, configured exactly as remark-mdx runs it (`ecmaVersion: 2024`,
//! `sourceType: "module"`, `preserveParens`). [`validate`] reproduces
//! micromark-util-events-to-acorn 2.0.3 plus writr's MDX parser entry point:
//! it decides whether an MDX expression or ESM block is complete, still
//! open, or invalid, with acorn's messages and UTF-16 positions.
//!
//! The port keeps acorn's control flow function for function; only the
//! parts of the ESTree acorn re-reads are materialized (see [`node`]).

mod chars;
mod expression;
mod generated;
mod jsx;
mod lval;
mod node;
mod parser;
mod regexp;
mod statement;
mod token;
mod tokenize;

use chars::{is_js_space, utf16};
use node::K;
use parser::{Fail, Parser};

/// What an MDX construct is being validated as.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Kind {
	/// `{expression}` in flow or text (may be empty).
	Expression,
	/// `<a {...spread}>`.
	Spread,
	/// `<a b={value}>`.
	Attribute,
	/// `import`/`export` block.
	Esm,
}

/// How markdown-rs should treat the construct.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Signal {
	Ok,
	/// Incomplete: more input may complete it.
	Eof,
	Error,
}

#[derive(Clone, PartialEq, Eq, Debug)]
pub struct Outcome {
	pub signal: Signal,
	pub message: String,
	/// UTF-16 offset into the validated value.
	pub pos: usize,
	/// Local names bound by the block's import declarations.
	pub imports: Vec<String>,
}

impl Outcome {
	fn ok(imports: Vec<String>) -> Self {
		Self {
			signal: Signal::Ok,
			message: String::new(),
			pos: 0,
			imports,
		}
	}

	fn error(message: &str, pos: usize) -> Self {
		Self {
			signal: Signal::Error,
			message: message.to_string(),
			pos,
			imports: Vec::new(),
		}
	}
}

/// A failure JavaScript would report as a thrown non-`SyntaxError`.
#[derive(Clone, PartialEq, Eq, Debug)]
pub struct RuntimeError(pub String);

impl std::fmt::Display for RuntimeError {
	fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
		f.write_str(&self.0)
	}
}

/// Validate MDX `value` the way writr's remark-mdx pipeline does.
///
/// `imports` are names bound by earlier ESM blocks; `defer_exports` skips
/// the local-export check while markdown-rs is still tokenizing.
pub fn validate(
	value: &str,
	kind: Kind,
	imports: &[String],
	defer_exports: bool,
) -> Result<Outcome, RuntimeError> {
	let source = utf16(value);
	let esm = kind == Kind::Esm;
	let spread = kind == Kind::Spread;
	let prefix: Vec<u16> = if esm {
		if imports.is_empty() {
			Vec::new()
		} else {
			utf16(&format!("var {}\n", imports.join(",")))
		}
	} else if spread {
		utf16("({")
	} else {
		Vec::new()
	};
	let suffix: Vec<u16> = if spread { utf16("})") } else { Vec::new() };
	let expression = !esm;
	let is_empty_expression = expression && empty(&source);
	if is_empty_expression && kind != Kind::Expression {
		return Ok(Outcome::error("Unexpected empty expression", 0));
	}
	let mut full = prefix.clone();
	full.extend_from_slice(&source);
	full.extend_from_slice(&suffix);
	let prefix_len = prefix.len();
	let source_len = source.len();
	let clamp = |pos: usize| pos.saturating_sub(prefix_len).min(source_len);

	let mut parser = Parser::new(&full, esm && defer_exports);
	let result = if expression && !is_empty_expression {
		parser
			.next_token()
			.and_then(|()| parser.parse_expression(parser::ForInit::No, None))
			.map(Parsed::Expression)
	} else {
		parser
			.next_token()
			.and_then(|()| {
				let body = parser.parse_top_level();
				parser.catch_overflow(body)
			})
			.map(Parsed::Program)
	};
	let parsed = match result {
		Ok(parsed) => parsed,
		Err(Fail::Syntax(error)) => {
			let swallow = error.raised_at >= prefix_len + source_len
				|| error.message == "Unterminated comment";
			return Ok(Outcome {
				signal: if swallow { Signal::Eof } else { Signal::Error },
				message: error.message,
				pos: clamp(error.pos),
				imports: Vec::new(),
			});
		}
		Err(Fail::Overflow) => {
			return Err(RuntimeError(
				"RangeError: Maximum call stack size exceeded".into(),
			))
		}
		Err(Fail::Runtime(message)) => return Err(RuntimeError(message)),
		Err(Fail::InvalidTemplate) => {
			return Err(RuntimeError("uncaught invalid template escape".into()))
		}
	};
	match parsed {
		Parsed::Expression(root) => {
			let rest_end = full.len() - suffix.len();
			let rest = if root.end < rest_end {
				&full[root.end..rest_end]
			} else {
				&[][..]
			};
			if !empty(rest) {
				return Ok(Outcome::error(
					"Unexpected content after expression",
					clamp(root.end),
				));
			}
			if spread {
				// events-to-acorn replaces the root `ParenthesizedExpression`
				// with its expression.
				let expression = match root.k {
					K::Paren(inner) => *inner,
					_ => root,
				};
				let K::Obj(properties) = &expression.k else {
					return Ok(Outcome::error("Expected an object spread", 0));
				};
				if properties.len() > 1 {
					return Ok(Outcome::error(
						"Only a single spread is supported",
						clamp(properties[1].start),
					));
				}
				if !matches!(properties.first().map(|p| &p.k), Some(K::Spread(_))) {
					return Ok(Outcome::error("Expected a spread element", 0));
				}
			}
			Ok(Outcome::ok(Vec::new()))
		}
		Parsed::Program(mut body) => {
			if !esm {
				return Ok(Outcome::ok(Vec::new()));
			}
			if !imports.is_empty() && !body.is_empty() {
				body.remove(0);
			}
			let mut names = Vec::new();
			for node in &body {
				match &node.k {
					K::Import { locals } => {
						names.extend(locals.iter().map(|name| String::from_utf16_lossy(name)))
					}
					K::ExportNamed | K::ExportDefault | K::ExportAll => {}
					_ => {
						return Ok(Outcome::error(
							"Only import/export statements are supported",
							clamp(node.start),
						))
					}
				}
			}
			Ok(Outcome::ok(names))
		}
	}
}

enum Parsed {
	Expression(node::Node),
	Program(Vec<node::Node>),
}

/// events-to-acorn's `empty`: whitespace once block comments and
/// newline-terminated line comments are removed.
fn empty(value: &[u16]) -> bool {
	let mut without_blocks = Vec::with_capacity(value.len());
	let mut i = 0;
	while i < value.len() {
		if value[i] == 47 && value.get(i + 1) == Some(&42) {
			if let Some(end) = chars::index_of(value, &[42, 47], i + 2) {
				i = end + 2;
				continue;
			}
		}
		without_blocks.push(value[i]);
		i += 1;
	}
	let value = without_blocks;
	let mut rest = Vec::with_capacity(value.len());
	let mut i = 0;
	while i < value.len() {
		if value[i] == 47 && value.get(i + 1) == Some(&47) {
			let mut j = i + 2;
			while j < value.len() && value[j] != 13 && value[j] != 10 {
				j += 1;
			}
			if j < value.len() {
				i = if value[j] == 13 && value.get(j + 1) == Some(&10) {
					j + 2
				} else {
					j + 1
				};
				continue;
			}
		}
		rest.push(value[i]);
		i += 1;
	}
	rest.iter().all(|&c| is_js_space(c))
}

#[cfg(test)]
mod tests;

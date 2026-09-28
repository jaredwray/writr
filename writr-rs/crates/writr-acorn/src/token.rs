//! acorn's token types (`tokTypes`) and token contexts, plus the four
//! acorn-jsx token types.

use crate::chars::eq;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum T {
	Num,
	Regexp,
	String,
	Name,
	PrivateId,
	Eof,
	BracketL,
	BracketR,
	BraceL,
	BraceR,
	ParenL,
	ParenR,
	Comma,
	Semi,
	Colon,
	Dot,
	Question,
	QuestionDot,
	Arrow,
	Template,
	InvalidTemplate,
	Ellipsis,
	BackQuote,
	DollarBraceL,
	Eq,
	Assign,
	IncDec,
	Prefix,
	LogicalOr,
	LogicalAnd,
	BitwiseOr,
	BitwiseXor,
	BitwiseAnd,
	Equality,
	Relational,
	BitShift,
	PlusMin,
	Modulo,
	Star,
	Slash,
	Starstar,
	Coalesce,
	Break,
	Case,
	Catch,
	Continue,
	Debugger,
	Default,
	Do,
	Else,
	Finally,
	For,
	Function,
	If,
	Return,
	Switch,
	Throw,
	Try,
	Var,
	Const,
	While,
	With,
	New,
	This,
	Super,
	Class,
	Extends,
	Export,
	Import,
	Null,
	True,
	False,
	In,
	Instanceof,
	Typeof,
	Void,
	Delete,
	JsxName,
	JsxText,
	JsxTagStart,
	JsxTagEnd,
}

const KEYWORDS: &[(&str, T)] = &[
	("break", T::Break),
	("case", T::Case),
	("catch", T::Catch),
	("continue", T::Continue),
	("debugger", T::Debugger),
	("default", T::Default),
	("do", T::Do),
	("else", T::Else),
	("finally", T::Finally),
	("for", T::For),
	("function", T::Function),
	("if", T::If),
	("return", T::Return),
	("switch", T::Switch),
	("throw", T::Throw),
	("try", T::Try),
	("var", T::Var),
	("const", T::Const),
	("while", T::While),
	("with", T::With),
	("new", T::New),
	("this", T::This),
	("super", T::Super),
	("class", T::Class),
	("extends", T::Extends),
	("export", T::Export),
	("import", T::Import),
	("null", T::Null),
	("true", T::True),
	("false", T::False),
	("in", T::In),
	("instanceof", T::Instanceof),
	("typeof", T::Typeof),
	("void", T::Void),
	("delete", T::Delete),
];

impl T {
	/// The keyword token for `word` (`this.keywords.test(word)` with the
	/// ecmaVersion >= 6 keyword list).
	pub fn from_keyword(word: &[u16]) -> Option<T> {
		KEYWORDS
			.iter()
			.find(|(name, _)| eq(word, name))
			.map(|&(_, ty)| ty)
	}

	pub fn keyword(self) -> Option<&'static str> {
		KEYWORDS
			.iter()
			.find(|&&(_, ty)| ty == self)
			.map(|&(name, _)| name)
	}

	pub fn before_expr(self) -> bool {
		use T::*;
		matches!(
			self,
			BracketL
				| BraceL | ParenL
				| Comma | Semi
				| Colon | Question
				| Arrow | Ellipsis
				| DollarBraceL
				| Eq | Assign
				| Prefix | LogicalOr
				| LogicalAnd | BitwiseOr
				| BitwiseXor | BitwiseAnd
				| Equality | Relational
				| BitShift | PlusMin
				| Modulo | Star
				| Slash | Starstar
				| Coalesce | Case
				| Default | Do
				| Else | Return
				| Throw | New
				| Extends | In
				| Instanceof | Typeof
				| Void | Delete
				| JsxText
		)
	}

	pub fn starts_expr(self) -> bool {
		use T::*;
		matches!(
			self,
			Num | Regexp
				| String | Name
				| PrivateId | BracketL
				| BraceL | ParenL
				| BackQuote | DollarBraceL
				| IncDec | Prefix
				| PlusMin | Function
				| New | This | Super
				| Class | Import
				| Null | True
				| False | Typeof
				| Void | Delete
				| JsxTagStart
		)
	}

	pub fn is_loop(self) -> bool {
		matches!(self, T::Do | T::For | T::While)
	}

	pub fn is_assign(self) -> bool {
		matches!(self, T::Eq | T::Assign)
	}

	pub fn prefix(self) -> bool {
		matches!(
			self,
			T::IncDec | T::Prefix | T::PlusMin | T::Typeof | T::Void | T::Delete
		)
	}

	pub fn postfix(self) -> bool {
		self == T::IncDec
	}

	pub fn binop(self) -> Option<i32> {
		use T::*;
		Some(match self {
			LogicalOr | Coalesce => 1,
			LogicalAnd => 2,
			BitwiseOr => 3,
			BitwiseXor => 4,
			BitwiseAnd => 5,
			Equality => 6,
			Relational | In | Instanceof => 7,
			BitShift => 8,
			PlusMin => 9,
			Modulo | Star | Slash => 10,
			_ => return None,
		})
	}
}

/// Token contexts (`tokContexts`) plus acorn-jsx's three tag contexts.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Ctx {
	BStat,
	BExpr,
	BTmpl,
	PStat,
	PExpr,
	QTmpl,
	FStat,
	FExpr,
	FExprGen,
	FGen,
	JsxOTag,
	JsxCTag,
	JsxExpr,
}

impl Ctx {
	pub fn is_expr(self) -> bool {
		matches!(
			self,
			Ctx::BExpr | Ctx::PExpr | Ctx::QTmpl | Ctx::FExpr | Ctx::FExprGen | Ctx::JsxExpr
		)
	}

	pub fn preserve_space(self) -> bool {
		matches!(self, Ctx::QTmpl | Ctx::JsxExpr)
	}

	/// `context.token === "function"`.
	pub fn is_function(self) -> bool {
		matches!(self, Ctx::FStat | Ctx::FExpr | Ctx::FExprGen | Ctx::FGen)
	}

	pub fn generator(self) -> bool {
		matches!(self, Ctx::FExprGen | Ctx::FGen)
	}
}

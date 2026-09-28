//! The subset of ESTree acorn re-reads after building a node: patterns and
//! the handful of fields its early-error checks inspect. Every other node is
//! kept as an opaque `Other(type)`.

/// A UTF-16 string, exactly as JavaScript sees it.
pub type W = Vec<u16>;

#[derive(Clone, Debug)]
pub struct Node {
	pub start: usize,
	pub end: usize,
	pub k: K,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum PropKind {
	Init,
	Get,
	Set,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum MethodKind {
	Constructor,
	Method,
	Get,
	Set,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum VarKind {
	Var,
	Let,
	Const,
}

#[derive(Clone, Debug)]
pub struct Prop {
	pub key: Node,
	pub value: Node,
	pub kind: PropKind,
	pub method: bool,
	pub shorthand: bool,
	pub computed: bool,
}

/// Node kinds. Fields acorn never re-reads for this configuration (the
/// declaration kind, opaque type names) are kept for debugging.
#[allow(dead_code)]
#[derive(Clone, Debug)]
pub enum K {
	Ident(W),
	PrivateIdent(W),
	/// `Some` for string literals (their cooked value).
	Lit(Option<W>),
	Obj(Vec<Node>),
	ObjPat(Vec<Node>),
	Arr(Vec<Option<Node>>),
	ArrPat(Vec<Option<Node>>),
	Prop(Box<Prop>),
	Spread(Box<Node>),
	Rest(Box<Node>),
	Assign {
		eq: bool,
		left: Box<Node>,
	},
	AssignPat {
		left: Box<Node>,
	},
	Paren(Box<Node>),
	Chain(Box<Node>),
	Member {
		private: bool,
		optional: bool,
	},
	Call {
		optional: bool,
	},
	Arrow,
	Func {
		params: Vec<Node>,
	},
	Super,
	VarDecl {
		kind: VarKind,
		decls: Vec<(Node, bool)>,
	},
	FuncDecl {
		id: Option<Box<Node>>,
	},
	ClassDecl {
		id: Option<Box<Node>>,
	},
	Import {
		locals: Vec<W>,
	},
	ExportNamed,
	ExportDefault,
	ExportAll,
	Method {
		kind: MethodKind,
		is_static: bool,
		key: Box<Node>,
	},
	Field {
		key: Box<Node>,
	},
	Other(&'static str),
}

impl Node {
	pub fn new(start: usize, end: usize, k: K) -> Self {
		Self { start, end, k }
	}

	pub fn is_ident(&self, name: &str) -> bool {
		matches!(&self.k, K::Ident(n) if crate::chars::eq(n, name))
	}

	pub fn optional(&self) -> bool {
		matches!(
			self.k,
			K::Member { optional: true, .. } | K::Call { optional: true }
		)
	}
}

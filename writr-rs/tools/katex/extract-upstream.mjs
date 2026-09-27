// Extracts the TeX formulas from KaTeX v0.18.7's own test suite and docs into
// tools/katex/upstream-cases.json, the upstream half of the
// gen-katex-fixtures.mjs corpus: a sorted, deduplicated JSON array of TeX
// strings, one per line so diffs stay reviewable.
//
// Upstream source: https://github.com/KaTeX/KaTeX at tag v0.18.7, MIT
// License, Copyright (c) 2013-2020 Khan Academy and other contributors (the
// same LICENSE ships in the pinned katex package). Only the formula strings
// are copied into the repo; the files are read from a local download:
//
//   test/katex-spec.ts test/mathml-spec.ts test/errors-spec.ts
//   test/unicode-spec.ts          (test/helpers.ts defines the tag semantics)
//   test/screenshotter/ss_data.yaml
//   docs/supported.md docs/support_table.md
//
// Fetch the sources once (the only step that needs the network), e.g.
//
//   git clone --depth 1 --branch v0.18.7 https://github.com/KaTeX/KaTeX <dir>
//
// then run from the repo root (offline, deterministic, no new dependencies):
//
//   node writr-rs/tools/katex/extract-upstream.mjs <dir> [--verbose]
//
// and regenerate the corpus with node writr-rs/tools/gen-katex-fixtures.mjs.
// --verbose also lists unresolved call sites, every skipped formula, and
// TeX-looking string literals that never reached a KaTeX entry point (the
// place to look for extraction misses after an upstream bump).
//
// How each source is read:
//
// - Spec files: types are stripped with node:module's stripTypeScriptTypes
//   (positions are preserved, so reported lines match the .ts files) and the
//   result is parsed with acorn (resolved through remark-mdx, as
//   tools/mdx/oracle.mjs does). A small abstract interpreter then walks the
//   tests and evaluates the TeX argument of every KaTeX entry point:
//   expect(tex) / expect`tex` chained to a KaTeX matcher (toParse, toBuild,
//   toWarn, toFailWithParseError, and both sides of toParseLike /
//   toBuildLike), getParsed, getBuilt, parseTree and katex.renderToString /
//   render / __renderToDomTree / __renderToHTMLTree / __parse. Tagged
//   templates follow helpers.ts: expect`…`, r`…`, getParsed`…`, getBuilt`…`
//   and .toParseLike`…` use the first raw string (backslashes kept as
//   written); String.raw`…` interpolates. Plain string literals are the
//   cooked values acorn computes; nothing is executed. The interpreter
//   resolves consts, lets (reassigned or built up with +=, in program
//   order), concatenation, template substitutions, String.fromCharCode,
//   for-of loops, counting for-loops, forEach, it.each tables and calls into
//   local helper functions (getMathML, spacing, …); commented-out tests are
//   ignored.
// - ss_data.yaml: js-yaml (a direct dependency); each entry is either the
//   formula itself (plain or block scalar) or a mapping whose tex field is.
// - Docs: the rendered examples, i.e. the $…$ and $$…$$ spans. Table rows
//   are split into cells first (the docs keep | out of math by using \VERT
//   or &#124;), code spans, backslash escapes and HTML tags are skipped so a
//   $ inside them never opens math, and math content is taken raw. The docs
//   site shares one macros object across a page, so a formula relying on an
//   earlier \gdef (only \VERT today) gets that formula prepended.
//
// Skipped (--verbose lists each one with its reason and location):
//
// - Formulas that use a macro supplied through settings.macros (in the specs
//   or ss_data.yaml): without it they are only undefined-control-sequence
//   errors. Settings that merely carry a macros object (the \gdef
//   persistence tests) or define names the formula doesn't use are fine.
// - Formulas that use \href, \url, \includegraphics or \html* under a
//   trust-enabling setting: under rehype-katex's trust:false each collapses
//   into the unsupported-command stub (all but \htmlData{foo}{x}, a parse
//   error), and the docs, ss_data.yaml and default-settings spec cases
//   already cover that stub for every one of these commands.
// - Anything using mhchem (\ce, \pu): writr doesn't load the extension.
// - Strings with lone surrogates (errors-spec): Rust strings cannot hold
//   them, so they never reach writr-katex.
//
// Kept on purpose although the test passes non-default settings, because
// the formula alone still exercises the code path rehype-katex takes:
// strict (true/"error"/functions: the default "warn" renders these with a
// console warning, e.g. unicode text in math mode), output ("html" or
// "mathml": writr always renders both halves), displayMode/leqno/fleqn (the
// corpus renders each case in both modes anyway), throwOnError/errorColor
// (rehype-katex's own retry renders the error), and maxSize, maxExpand,
// minRuleThickness, colorIsTextColor and globalGroup (ordinary formulas that
// render with the defaults). Tests that first mutate KaTeX globally
// (__defineSymbol/__setFontMetrics) keep their formula too: it renders with
// the stock tables.
import fs from "node:fs";
import { createRequire, stripTypeScriptTypes } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..", "..", "..");
const OUT = path.join(HERE, "upstream-cases.json");

const SPEC_FILES = [
	"test/katex-spec.ts",
	"test/mathml-spec.ts",
	"test/errors-spec.ts",
	"test/unicode-spec.ts",
];
const YAML_FILE = "test/screenshotter/ss_data.yaml";
const DOC_FILES = ["docs/supported.md", "docs/support_table.md"];

const { values: args, positionals } = parseArgs({
	allowPositionals: true,
	options: { verbose: { type: "boolean", default: false } },
});
if (positionals.length !== 1) {
	console.error(
		"usage: node writr-rs/tools/katex/extract-upstream.mjs <katex-v0.18.7-dir> [--verbose]",
	);
	process.exit(2);
}
const UPSTREAM = path.resolve(positionals[0]);
// A full checkout carries package.json; refuse one at another version (a
// partial download holding only the files below is accepted as is).
const upstreamPackage = path.join(UPSTREAM, "package.json");
if (fs.existsSync(upstreamPackage)) {
	const { version } = JSON.parse(fs.readFileSync(upstreamPackage, "utf8"));
	if (version !== "0.18.7") {
		throw new Error(`expected KaTeX 0.18.7 in ${UPSTREAM}, found ${version}`);
	}
}

const rootRequire = createRequire(path.join(ROOT, "package.json"));
const acorn = await import(
	pathToFileURL(
		createRequire(
			createRequire(rootRequire.resolve("remark-mdx")).resolve(
				"micromark-extension-mdxjs",
			),
		).resolve("acorn"),
	).href
);
const yaml = await import(pathToFileURL(rootRequire.resolve("js-yaml")).href);

// ---------------------------------------------------------------------------
// Policy

const TRUST_GATED = [
	"\\href",
	"\\url",
	"\\includegraphics",
	"\\htmlClass",
	"\\htmlId",
	"\\htmlStyle",
	"\\htmlData",
];
const MHCHEM = /\\(?:ce|pu)(?![A-Za-z@])/;

/** A control-sequence name as a RegExp source. */
const escapeName = (name) => name.replace(/\\/g, "\\\\");

/** Whether `tex` mentions the control sequence (or active character) `name`. */
function mentions(tex, name) {
	if (/^\\[A-Za-z@]+$/.test(name)) {
		return new RegExp(`${escapeName(name)}(?![A-Za-z@])`).test(tex);
	}
	return tex.includes(name);
}

// ---------------------------------------------------------------------------
// Collection

const kept = new Map(); // tex -> first source
const skipped = new Map(); // tex -> { kind, text } of the first skip
const perSource = new Map(); // source file -> Set of tex
const notes = []; // verbose-only diagnostics

function keep(tex, source, where) {
	if (!perSource.has(source)) perSource.set(source, new Set());
	perSource.get(source).add(tex);
	if (!kept.has(tex)) kept.set(tex, where);
}

function skip(tex, kind, detail, where) {
	if (!skipped.has(tex))
		skipped.set(tex, { kind, text: `${kind}${detail} (${where})` });
}

// ---------------------------------------------------------------------------
// Spec files: a tiny abstract interpreter over the test ASTs.
//
// An expression evaluates to a list of possible values ("vals") or null when
// unknown. Values are primitives, { kind: "array", items: vals[] },
// { kind: "object", props: Map<string, vals>, open }, { kind: "fn", node,
// scope } or { kind: "builtin", name }.

const MAX_VALUES = 512;
const MAX_LOOP = 512;
const MAX_INLINE_DEPTH = 4;
const FAIL = Symbol("fail");

const isPrim = (v) =>
	v === null || (typeof v !== "object" && typeof v !== "function");
const isKind = (v, kind) =>
	v !== null && typeof v === "object" && v.kind === kind;
const dedupe = (vals) => (vals.length > MAX_VALUES ? null : [...new Set(vals)]);

function union(a, b) {
	if (a === null) return b;
	if (b === null) return a;
	return dedupe([...a, ...b]);
}

/** Cartesian product of value lists through `fn`; null on overflow or FAIL. */
function product(lists, fn) {
	let total = 1;
	for (const list of lists) {
		if (list === null) return null;
		total *= list.length;
		if (total > MAX_VALUES) return null;
	}
	const out = [];
	const pick = new Array(lists.length);
	const visit = (k) => {
		if (k === lists.length) {
			out.push(fn(pick.slice()));
			return;
		}
		for (const value of lists[k]) {
			pick[k] = value;
			visit(k + 1);
		}
	};
	visit(0);
	return out.includes(FAIL) ? null : dedupe(out);
}

const BINARY = {
	"+": (a, b) => a + b,
	"-": (a, b) => a - b,
	"*": (a, b) => a * b,
	"/": (a, b) => a / b,
	"%": (a, b) => a % b,
	"**": (a, b) => a ** b,
	"|": (a, b) => a | b,
	"&": (a, b) => a & b,
	"^": (a, b) => a ^ b,
	"<<": (a, b) => a << b,
	">>": (a, b) => a >> b,
	">>>": (a, b) => a >>> b,
	"<": (a, b) => a < b,
	"<=": (a, b) => a <= b,
	">": (a, b) => a > b,
	">=": (a, b) => a >= b,
	"===": (a, b) => a === b,
	"!==": (a, b) => a !== b,
};

function binop(op, a, b) {
	return isPrim(a) && isPrim(b) && Object.hasOwn(BINARY, op)
		? BINARY[op](a, b)
		: FAIL;
}

function callMethod(target, name, argv) {
	const prims = argv.every(isPrim);
	if (typeof target === "number") {
		if (name === "toString" && prims) return target.toString(...argv);
		return FAIL;
	}
	if (typeof target === "string") {
		switch (name) {
			case "toString":
			case "valueOf":
				return target;
			case "split":
				if (typeof argv[0] !== "string") return FAIL;
				return {
					kind: "array",
					items: target.split(argv[0]).map((part) => [part]),
				};
			case "repeat":
			case "concat":
			case "slice":
			case "substring":
			case "charAt":
			case "padStart":
			case "padEnd":
			case "trim":
			case "toUpperCase":
			case "toLowerCase":
			case "normalize":
				return prims ? String.prototype[name].apply(target, argv) : FAIL;
			default:
				return FAIL;
		}
	}
	if (isKind(target, "array") && name === "join") {
		const sep = argv.length ? argv[0] : ",";
		if (typeof sep !== "string") return FAIL;
		if (!target.items.every((item) => item?.length === 1 && isPrim(item[0])))
			return FAIL;
		return target.items.map((item) => item[0]).join(sep);
	}
	return FAIL;
}

/** The items of an iterable value list, as vals per item; null if unknown. */
function iterate(vals) {
	if (vals === null) return null;
	const items = [];
	for (const value of vals) {
		if (isKind(value, "array")) items.push(...value.items);
		else if (typeof value === "string")
			items.push(...[...value].map((ch) => [ch]));
		else return null;
	}
	return items;
}

function member(target, key) {
	if (isKind(target, "array")) {
		if (key === "length") return [target.items.length];
		if (typeof key === "number" || /^\d+$/.test(String(key))) {
			return target.items[Number(key)] ?? [undefined];
		}
		return null;
	}
	if (isKind(target, "object")) {
		if (target.props.has(key)) return target.props.get(key);
		return target.open ? null : [undefined];
	}
	if (typeof target === "string") {
		if (key === "length") return [target.length];
		if (typeof key === "number") return [target[key]];
	}
	return null;
}

const propName = (node) =>
	node.type === "MemberExpression" &&
	!node.computed &&
	node.property.type === "Identifier"
		? node.property.name
		: undefined;
const isIdent = (node, name) =>
	node?.type === "Identifier" && node.name === name;

class Scope {
	constructor(parent) {
		this.parent = parent;
		this.vars = new Map();
	}

	declare(name, binding) {
		this.vars.set(name, { ...binding });
	}

	lookup(name) {
		for (let scope = this; scope; scope = scope.parent) {
			const binding = scope.vars.get(name);
			if (binding) return binding;
		}
		return undefined;
	}
}

const settingsObject = (entries) => ({
	kind: "object",
	props: new Map(entries.map(([key, value]) => [key, [value]])),
	open: false,
});

/** Module scope: the helpers.ts exports and globals the specs rely on. */
function builtins() {
	const scope = new Scope(null);
	scope.declare("r", { values: [{ kind: "builtin", name: "r" }] });
	scope.declare("Settings", {
		values: [{ kind: "builtin", name: "Settings" }],
	});
	scope.declare("String", { values: [{ kind: "builtin", name: "String" }] });
	scope.declare("undefined", { values: [undefined] });
	scope.declare("strictSettings", {
		values: [settingsObject([["strict", true]])],
	});
	scope.declare("nonstrictSettings", {
		values: [settingsObject([["strict", false]])],
	});
	scope.declare("trustSettings", {
		values: [settingsObject([["trust", true]])],
	});
	return scope;
}

// KaTeX matchers whose subject is TeX -> index of their settings argument.
const TEX_MATCHERS = new Map([
	["toParse", 0],
	["toBuild", 0],
	["toNotParse", 0],
	["toNotBuild", 0],
	["toWarn", 0],
	["toFailWithParseError", 1],
	["toParseLike", 1],
	["toBuildLike", 1],
]);
const LIKE_MATCHERS = new Set(["toParseLike", "toBuildLike"]);
// Plain functions taking (tex, settings).
const TEX_FUNCTIONS = new Map([
	["getParsed", 1],
	["getBuilt", 1],
	["parseTree", 1],
]);
// katex.<method>(tex, …, settings) -> index of settings.
const KATEX_METHODS = new Map([
	["renderToString", 1],
	["render", 2],
	["__renderToDomTree", 1],
	["__renderToHTMLTree", 1],
	["__parse", 1],
]);
// Call names whose string arguments are never TeX (for --verbose only).
const NON_TEX_CALLS = new Set([
	"it",
	"describe",
	"test",
	"toContain",
	"toEqual",
	"toBe",
	"toMatch",
	"toThrow",
	"toFailWithParseError",
	"toHaveBeenCalledWith",
	"toMatchObject",
	"toStrictEqual",
	"toHaveProperty",
	"toBeCloseTo",
	"spyOn",
	"__defineSymbol",
	"__setFontMetrics",
	"toHaveLength",
	"toMatchSnapshot",
	"querySelector",
	"getAttribute",
	"setAttribute",
	"createElement",
	"match",
	"replace",
]);

class SpecExtractor {
	constructor(file, source) {
		this.file = file;
		this.parents = new WeakMap();
		this.active = new Set();
		this.inlining = new Set();
		this.sites = new Map(); // "line:col" -> resolved?
		this.literals = [];
		this.ast = acorn.parse(source, {
			ecmaVersion: "latest",
			sourceType: "module",
			locations: true,
		});
		this.index(this.ast, null);
	}

	index(node, parent) {
		if (parent) this.parents.set(node, parent);
		if (node.type === "Literal" && typeof node.value === "string")
			this.literals.push(node);
		if (node.type === "TemplateLiteral") this.literals.push(node);
		for (const key of Object.keys(node)) {
			if (key === "loc" || key === "type") continue;
			const child = node[key];
			if (Array.isArray(child)) {
				for (const item of child)
					if (item && typeof item.type === "string") this.index(item, node);
			} else if (child && typeof child.type === "string") {
				this.index(child, node);
			}
		}
	}

	run() {
		this.walk(this.ast, builtins());
		const unresolved = [...this.sites]
			.filter(([, ok]) => !ok)
			.map(([at]) => at);
		return unresolved;
	}

	where(node) {
		return `${this.file}:${node.loc.start.line}`;
	}

	// -- evaluation ---------------------------------------------------------

	bindingValues(binding) {
		if (binding.current !== undefined) return binding.current;
		if (binding.values !== undefined) return binding.values;
		if (this.active.has(binding)) return null;
		this.active.add(binding);
		try {
			let vals = binding.init
				? this.evaluate(binding.init, binding.scope)
				: [undefined];
			for (const step of binding.path ?? []) {
				if (vals === null) break;
				let next = [];
				for (const value of vals) {
					const picked = member(value, step);
					if (picked === null) {
						next = null;
						break;
					}
					next.push(...picked);
				}
				vals = next && dedupe(next);
			}
			return vals;
		} finally {
			this.active.delete(binding);
		}
	}

	template(strings, expressions, scope) {
		if (strings.some((part) => typeof part !== "string")) return null;
		const parts = expressions.map((expr) => this.evaluate(expr, scope));
		return product(parts, (vals) => {
			let out = strings[0];
			for (let i = 0; i < vals.length; i++) {
				if (!isPrim(vals[i])) return FAIL;
				out += String(vals[i]) + strings[i + 1];
			}
			return out;
		});
	}

	evaluate(node, scope) {
		if (!node) return [undefined];
		switch (node.type) {
			case "Literal":
				return node.regex || node.bigint ? null : [node.value];
			case "TemplateLiteral":
				return this.template(
					node.quasis.map((q) => q.value.cooked),
					node.expressions,
					scope,
				);
			case "TaggedTemplateExpression": {
				const tag = this.evaluate(node.tag, scope);
				if (
					tag?.length === 1 &&
					isKind(tag[0], "builtin") &&
					tag[0].name === "r"
				) {
					return [node.quasi.quasis[0].value.raw];
				}
				if (
					node.tag.type === "MemberExpression" &&
					isIdent(node.tag.object, "String") &&
					propName(node.tag) === "raw"
				) {
					return this.template(
						node.quasi.quasis.map((q) => q.value.raw),
						node.quasi.expressions,
						scope,
					);
				}
				return null;
			}
			case "Identifier": {
				const binding = scope.lookup(node.name);
				return binding ? this.bindingValues(binding) : null;
			}
			case "BinaryExpression": {
				const left = this.evaluate(node.left, scope);
				const right = this.evaluate(node.right, scope);
				return product([left, right], ([a, b]) => binop(node.operator, a, b));
			}
			case "UnaryExpression": {
				const arg = this.evaluate(node.argument, scope);
				if (node.operator === "void") return [undefined];
				return product([arg], ([a]) => {
					if (!isPrim(a)) return FAIL;
					if (node.operator === "-") return -a;
					if (node.operator === "+") return +a;
					if (node.operator === "!") return !a;
					return FAIL;
				});
			}
			case "ConditionalExpression":
			case "LogicalExpression":
				return union(
					this.evaluate(node.consequent ?? node.left, scope),
					this.evaluate(node.alternate ?? node.right, scope),
				);
			case "SequenceExpression":
				return this.evaluate(node.expressions.at(-1), scope);
			case "AssignmentExpression":
				return node.operator === "=" ? this.evaluate(node.right, scope) : null;
			case "ChainExpression":
				return this.evaluate(node.expression, scope);
			case "ArrowFunctionExpression":
			case "FunctionExpression":
				return [{ kind: "fn", node, scope }];
			case "ArrayExpression": {
				const items = [];
				for (const element of node.elements) {
					if (element === null) {
						items.push([undefined]);
					} else if (element.type === "SpreadElement") {
						const spread = iterate(this.evaluate(element.argument, scope));
						if (spread === null) return null;
						items.push(...spread);
					} else {
						items.push(this.evaluate(element, scope));
					}
				}
				return [{ kind: "array", items }];
			}
			case "ObjectExpression": {
				const props = new Map();
				let open = false;
				for (const prop of node.properties) {
					if (prop.type === "SpreadElement") {
						const spread = this.evaluate(prop.argument, scope);
						if (spread?.length === 1 && isKind(spread[0], "object")) {
							for (const [key, value] of spread[0].props) props.set(key, value);
							open ||= spread[0].open;
						} else {
							open = true;
						}
						continue;
					}
					let key;
					if (!prop.computed && prop.key.type === "Identifier")
						key = prop.key.name;
					else if (prop.key.type === "Literal") key = String(prop.key.value);
					else {
						const keys = this.evaluate(prop.key, scope);
						if (keys?.length === 1 && isPrim(keys[0])) key = String(keys[0]);
					}
					if (key === undefined) {
						open = true;
						continue;
					}
					props.set(
						key,
						prop.kind === "init" ? this.evaluate(prop.value, scope) : null,
					);
				}
				return [{ kind: "object", props, open }];
			}
			case "MemberExpression": {
				const targets = this.evaluate(node.object, scope);
				if (targets === null) return null;
				let keys;
				if (!node.computed) keys = [node.property.name];
				else keys = this.evaluate(node.property, scope);
				const out = [];
				for (const target of targets) {
					if (keys === null) {
						// Unknown index into a known array: any of its items.
						if (!isKind(target, "array")) return null;
						for (const item of target.items) if (item) out.push(...item);
						continue;
					}
					for (const key of keys) {
						const picked = member(target, key);
						if (picked === null) return null;
						out.push(...picked);
					}
				}
				return dedupe(out);
			}
			case "CallExpression":
				return this.evaluateCall(node, scope);
			case "NewExpression": {
				const ctor = this.evaluate(node.callee, scope);
				if (ctor?.length !== 1 || !isKind(ctor[0], "builtin")) return null;
				const arg = node.arguments[0];
				if (ctor[0].name === "Settings") {
					if (!arg) return [settingsObject([])];
					const options = this.evaluate(arg, scope);
					return product([options], ([o]) =>
						o === undefined
							? settingsObject([])
							: isKind(o, "object")
								? o
								: FAIL,
					);
				}
				if (ctor[0].name === "String") {
					return product([this.evaluate(arg, scope)], ([s]) =>
						isPrim(s) ? String(s) : FAIL,
					);
				}
				return null;
			}
			default:
				return null;
		}
	}

	evaluateCall(node, scope) {
		const argv = node.arguments.map((arg) =>
			arg.type === "SpreadElement" ? null : this.evaluate(arg, scope),
		);
		const callee = node.callee;
		if (callee.type === "MemberExpression" && !callee.computed) {
			const method = propName(callee);
			const targets = this.evaluate(callee.object, scope);
			if (
				targets?.length === 1 &&
				isKind(targets[0], "builtin") &&
				targets[0].name === "String"
			) {
				if (method === "fromCharCode" || method === "fromCodePoint") {
					return product(argv, (codes) =>
						codes.every((code) => typeof code === "number")
							? String[method](...codes)
							: FAIL,
					);
				}
				return null;
			}
			return product([targets, ...argv], ([target, ...rest]) =>
				callMethod(target, method, rest),
			);
		}
		const fns = this.evaluate(callee, scope);
		if (fns?.length === 1 && isKind(fns[0], "builtin") && fns[0].name === "r") {
			return product([argv[0] ?? [undefined]], ([s]) =>
				typeof s === "string" ? s : FAIL,
			);
		}
		return null;
	}

	// -- sinks ----------------------------------------------------------------

	/** The matcher chained onto expect(…)/expect`…`: { name, call } or null. */
	matcherOf(expectNode) {
		let owner = this.parents.get(expectNode);
		if (owner?.type !== "MemberExpression" || owner.object !== expectNode)
			return null;
		if (propName(owner) === "not") {
			const next = this.parents.get(owner);
			if (next?.type !== "MemberExpression" || next.object !== owner)
				return null;
			owner = next;
		}
		const call = this.parents.get(owner);
		if (call?.type === "CallExpression" && call.callee === owner) {
			return { name: propName(owner), call };
		}
		if (call?.type === "TaggedTemplateExpression" && call.tag === owner) {
			return { name: propName(owner), call };
		}
		return null;
	}

	record(texVals, settingsVals, site) {
		const at = `${site.loc.start.line}:${site.loc.start.column}`;
		if (texVals === null) {
			if (!this.sites.has(at)) this.sites.set(at, false);
			return;
		}
		this.sites.set(at, true);
		const where = this.where(site);
		for (const tex of texVals) {
			if (typeof tex !== "string") continue; // the wrong-input-type tests
			let reason = null;
			for (const settings of settingsVals ?? [null]) {
				reason = this.settingsReason(tex, settings, where);
				if (reason === null) break;
			}
			if (reason === null) keep(tex, this.file, where);
			else skip(tex, ...reason, where);
		}
	}

	/** Why `settings` makes `tex` meaningless on its own: [kind, detail] or null. */
	settingsReason(tex, settings, where) {
		if (settings === undefined) return null;
		if (!isKind(settings, "object")) {
			notes.push(
				`${where}: unresolved settings for ${JSON.stringify(tex)} (kept)`,
			);
			return null;
		}
		const macros = settings.props.get("macros");
		if (macros !== undefined) {
			if (macros === null) return ["settings.macros", " (unresolved)"];
			for (const map of macros) {
				if (map === undefined) continue;
				if (!isKind(map, "object") || map.open)
					return ["settings.macros", " (unresolved)"];
				for (const name of map.props.keys()) {
					if (mentions(tex, name)) return ["settings.macros", ` ${name}`];
				}
			}
		}
		const trust = settings.props.get("trust");
		if (
			trust !== undefined &&
			(trust === null || trust.some((v) => v !== false && v !== undefined))
		) {
			const command = TRUST_GATED.find((name) => mentions(tex, name));
			if (command) return ["trust", ` for ${command}`];
		}
		if (settings.open)
			notes.push(`${where}: partly unresolved settings (kept)`);
		return null;
	}

	sinkCall(node, scope) {
		const callee = node.callee;
		const argv = node.arguments;
		if (callee.type === "Identifier" && TEX_FUNCTIONS.has(callee.name)) {
			const settings = argv[TEX_FUNCTIONS.get(callee.name)];
			this.record(
				this.evaluate(argv[0], scope),
				this.settingsOf(settings, scope),
				node,
			);
			return;
		}
		if (
			callee.type === "MemberExpression" &&
			isIdent(callee.object, "katex") &&
			KATEX_METHODS.has(propName(callee))
		) {
			const settings = argv[KATEX_METHODS.get(propName(callee))];
			this.record(
				this.evaluate(argv[0], scope),
				this.settingsOf(settings, scope),
				node,
			);
			return;
		}
		if (isIdent(callee, "expect") && argv.length) {
			this.sinkExpect(node, this.evaluate(argv[0], scope), scope);
		}
	}

	sinkExpect(expectNode, texVals, scope) {
		const matcher = this.matcherOf(expectNode);
		if (!matcher || !TEX_MATCHERS.has(matcher.name)) return;
		const { name, call } = matcher;
		const settingsNode =
			call.type === "CallExpression"
				? call.arguments[TEX_MATCHERS.get(name)]
				: undefined;
		const settings = this.settingsOf(settingsNode, scope);
		this.record(texVals, settings, expectNode);
		if (LIKE_MATCHERS.has(name) && call.type === "CallExpression") {
			this.record(this.evaluate(call.arguments[0], scope), settings, call);
		}
	}

	settingsOf(node, scope) {
		return node === undefined ? [undefined] : this.evaluate(node, scope);
	}

	sinkTagged(node, scope) {
		const quasi = node.quasi;
		// helpers.ts r(): a tagged template means its first raw string.
		const tex = [quasi.quasis[0].value.raw];
		const tag = node.tag;
		const isTexTag =
			(tag.type === "Identifier" &&
				(TEX_FUNCTIONS.has(tag.name) || tag.name === "expect")) ||
			LIKE_MATCHERS.has(propName(tag));
		if (isTexTag && quasi.expressions.length) {
			notes.push(
				`${this.where(node)}: tagged template with substitutions uses raw[0] only`,
			);
		}
		if (tag.type === "Identifier" && TEX_FUNCTIONS.has(tag.name)) {
			this.record(tex, [undefined], node);
		} else if (isIdent(tag, "expect")) {
			this.sinkExpect(node, tex, scope);
		} else if (LIKE_MATCHERS.has(propName(tag))) {
			this.record(tex, [undefined], node);
		}
	}

	// -- walking ----------------------------------------------------------------

	declarePattern(pattern, scope, binding, pathSoFar = []) {
		switch (pattern.type) {
			case "Identifier":
				scope.declare(pattern.name, { ...binding, path: pathSoFar });
				break;
			case "ArrayPattern":
				pattern.elements.forEach((element, i) => {
					if (element)
						this.declarePattern(element, scope, binding, [...pathSoFar, i]);
				});
				break;
			case "ObjectPattern":
				for (const prop of pattern.properties) {
					if (prop.type === "RestElement")
						this.declarePattern(prop.argument, scope, { values: null });
					else if (!prop.computed && prop.key.type === "Identifier") {
						this.declarePattern(prop.value, scope, binding, [
							...pathSoFar,
							prop.key.name,
						]);
					} else this.declarePattern(prop.value, scope, { values: null });
				}
				break;
			case "AssignmentPattern":
				this.declarePattern(pattern.left, scope, binding, pathSoFar);
				break;
			case "RestElement":
				this.declarePattern(pattern.argument, scope, { values: null });
				break;
		}
	}

	/** Bind a pattern directly to known vals (loop items, call arguments). */
	bindPattern(pattern, vals, scope) {
		switch (pattern.type) {
			case "Identifier":
				scope.declare(pattern.name, { values: vals });
				break;
			case "AssignmentPattern": {
				const missing =
					vals === undefined || vals?.every((v) => v === undefined);
				this.bindPattern(
					pattern.left,
					missing ? this.evaluate(pattern.right, scope) : vals,
					scope,
				);
				break;
			}
			case "ArrayPattern":
				pattern.elements.forEach((element, i) => {
					if (!element) return;
					let picked = null;
					if (vals) {
						picked = [];
						for (const value of vals) {
							const item = member(value, i);
							if (item === null) {
								picked = null;
								break;
							}
							picked.push(...item);
						}
					}
					this.bindPattern(element, picked && dedupe(picked), scope);
				});
				break;
			case "ObjectPattern":
				for (const prop of pattern.properties) {
					const target =
						prop.type === "RestElement" ? prop.argument : prop.value;
					let picked = null;
					if (
						vals &&
						prop.type !== "RestElement" &&
						!prop.computed &&
						prop.key.type === "Identifier"
					) {
						picked = [];
						for (const value of vals) {
							const item = member(value, prop.key.name);
							if (item === null) {
								picked = null;
								break;
							}
							picked.push(...item);
						}
					}
					this.bindPattern(target, picked && dedupe(picked), scope);
				}
				break;
			case "RestElement":
				this.bindPattern(pattern.argument, null, scope);
				break;
		}
	}

	hoist(statements, scope) {
		for (const statement of statements) {
			const declaration =
				statement.type === "ExportNamedDeclaration"
					? statement.declaration
					: statement;
			if (declaration?.type === "VariableDeclaration") {
				for (const declarator of declaration.declarations) {
					this.declarePattern(declarator.id, scope, {
						init: declarator.init,
						scope,
					});
				}
			} else if (declaration?.type === "FunctionDeclaration") {
				scope.declare(declaration.id.name, {
					values: [{ kind: "fn", node: declaration, scope }],
				});
			} else if (declaration?.type === "ClassDeclaration") {
				scope.declare(declaration.id.name, { values: null });
			}
		}
	}

	/** Walk a function body; `argv` holds vals per parameter, or null if unknown. */
	walkFunction(fn, argv) {
		const scope = new Scope(fn.scope);
		fn.node.params.forEach((param, i) => {
			this.bindPattern(param, argv === null ? null : argv[i], scope);
		});
		if (fn.node.type === "FunctionExpression" && fn.node.id) {
			scope.declare(fn.node.id.name, { values: [fn] });
		}
		this.walk(fn.node.body, scope);
	}

	walkChildren(node, scope) {
		for (const key of Object.keys(node)) {
			if (key === "loc" || key === "type") continue;
			const child = node[key];
			if (Array.isArray(child)) {
				for (const item of child)
					if (item && typeof item.type === "string") this.walk(item, scope);
			} else if (child && typeof child.type === "string") {
				this.walk(child, scope);
			}
		}
	}

	walk(node, scope) {
		if (!node || typeof node.type !== "string") return;
		switch (node.type) {
			case "Program":
			case "BlockStatement":
			case "StaticBlock": {
				const inner = new Scope(scope);
				this.hoist(node.body, inner);
				for (const statement of node.body) this.walk(statement, inner);
				return;
			}
			case "ImportDeclaration":
				return;
			case "FunctionDeclaration":
			case "FunctionExpression":
			case "ArrowFunctionExpression":
				this.walkFunction({ kind: "fn", node, scope }, null);
				return;
			case "VariableDeclaration":
				for (const declarator of node.declarations)
					this.walk(declarator.init, scope);
				return;
			case "AssignmentExpression": {
				// Walk order is program order, so track reassignments (and +=
				// accumulation) as they happen.
				this.walkChildren(node, scope);
				const binding =
					node.left.type === "Identifier"
						? scope.lookup(node.left.name)
						: undefined;
				if (binding) {
					const right = this.evaluate(node.right, scope);
					binding.current =
						node.operator === "="
							? right
							: product([this.bindingValues(binding), right], ([a, b]) =>
									binop(node.operator.slice(0, -1), a, b),
								);
				}
				return;
			}
			case "ForOfStatement":
			case "ForInStatement":
				this.walkForOf(node, scope);
				return;
			case "ForStatement":
				this.walkFor(node, scope);
				return;
			case "CatchClause": {
				const inner = new Scope(scope);
				if (node.param) this.bindPattern(node.param, null, inner);
				this.walk(node.body, inner);
				return;
			}
			case "CallExpression":
				this.walkCall(node, scope);
				return;
			case "TaggedTemplateExpression":
				this.sinkTagged(node, scope);
				this.walkChildren(node, scope);
				return;
			default:
				this.walkChildren(node, scope);
		}
	}

	walkForOf(node, scope) {
		this.walk(node.right, scope);
		const pattern =
			node.left.type === "VariableDeclaration"
				? node.left.declarations[0].id
				: node.left;
		const items =
			node.type === "ForOfStatement"
				? iterate(this.evaluate(node.right, scope))
				: null;
		const once = (vals) => {
			const inner = new Scope(scope);
			this.bindPattern(pattern, vals, inner);
			this.walk(node.body, inner);
		};
		if (items === null || items.length > MAX_LOOP) once(null);
		else for (const item of items) once(item);
	}

	/** Simulate `for (let i = a; i < b; i++)`-style loops with known bounds. */
	counter(node, scope) {
		const init = node.init;
		if (init?.type !== "VariableDeclaration" || init.declarations.length !== 1)
			return null;
		const { id, init: start } = init.declarations[0];
		if (id.type !== "Identifier") return null;
		const name = id.name;
		const test = node.test;
		const update = node.update;
		if (test?.type !== "BinaryExpression" || !isIdent(test.left, name))
			return null;
		const first = this.evaluate(start, scope);
		const bound = this.evaluate(test.right, scope);
		if (first?.length !== 1 || bound?.length !== 1) return null;
		if (typeof first[0] !== "number" || typeof bound[0] !== "number")
			return null;
		let step;
		if (update?.type === "UpdateExpression" && isIdent(update.argument, name)) {
			step = update.operator === "++" ? 1 : -1;
		} else if (
			update?.type === "AssignmentExpression" &&
			isIdent(update.left, name) &&
			(update.operator === "+=" || update.operator === "-=")
		) {
			const by = this.evaluate(update.right, scope);
			if (by?.length !== 1 || typeof by[0] !== "number" || by[0] === 0)
				return null;
			step = update.operator === "+=" ? by[0] : -by[0];
		} else {
			return null;
		}
		const values = [];
		for (
			let i = first[0];
			binop(test.operator, i, bound[0]) === true;
			i += step
		) {
			values.push(i);
			if (values.length > MAX_LOOP) return null;
		}
		return { name, values };
	}

	walkFor(node, scope) {
		const outer = new Scope(scope);
		if (node.init?.type === "VariableDeclaration") {
			for (const declarator of node.init.declarations) {
				this.walk(declarator.init, outer);
				this.declarePattern(declarator.id, outer, { values: null });
			}
		} else {
			this.walk(node.init, outer);
		}
		const loop = this.counter(node, scope);
		for (const value of loop ? loop.values : [null]) {
			const inner = new Scope(outer);
			if (loop) inner.declare(loop.name, { values: [value] });
			this.walk(node.test, inner);
			this.walk(node.body, inner);
			this.walk(node.update, inner);
		}
	}

	walkCall(node, scope) {
		this.sinkCall(node, scope);
		const callee = node.callee;
		const isFnLiteral = (arg) =>
			arg?.type === "ArrowFunctionExpression" ||
			arg?.type === "FunctionExpression";

		// array.forEach(fn): walk fn once per item.
		if (propName(callee) === "forEach" && isFnLiteral(node.arguments[0])) {
			this.walk(callee.object, scope);
			const items = iterate(this.evaluate(callee.object, scope));
			const fn = { kind: "fn", node: node.arguments[0], scope };
			if (items === null || items.length > MAX_LOOP) {
				this.walkFunction(fn, null);
			} else {
				for (const [i, item] of items.entries()) {
					this.walkFunction(fn, [item, [i]]);
				}
			}
			return;
		}

		// it.each(table)(title, fn): walk fn once per row, spreading array rows.
		if (
			callee.type === "CallExpression" &&
			propName(callee.callee) === "each" &&
			isFnLiteral(node.arguments[1])
		) {
			this.walkChildren(callee, scope);
			this.walk(node.arguments[0], scope);
			const rows = iterate(this.evaluate(callee.arguments[0], scope));
			const fn = { kind: "fn", node: node.arguments[1], scope };
			if (rows === null || rows.length > MAX_LOOP) {
				this.walkFunction(fn, null);
				return;
			}
			for (const row of rows) {
				if (row === null) {
					this.walkFunction(fn, null);
					continue;
				}
				for (const value of row) {
					this.walkFunction(
						fn,
						isKind(value, "array") ? value.items : [[value]],
					);
				}
			}
			return;
		}

		// A call into a local helper: walk its body with the argument values.
		if (callee.type === "Identifier") {
			const fns = this.evaluate(callee, scope);
			const argv = node.arguments.map((arg) =>
				arg.type === "SpreadElement" ? null : this.evaluate(arg, scope),
			);
			for (const fn of fns ?? []) {
				if (!isKind(fn, "fn") || this.inlining.has(fn.node)) continue;
				if (this.inlining.size >= MAX_INLINE_DEPTH) continue;
				this.inlining.add(fn.node);
				this.walkFunction(fn, argv);
				this.inlining.delete(fn.node);
			}
		}
		this.walkChildren(node, scope);
	}

	/** Whether `node` sits in a `macros: {…}` settings object. */
	insideMacros(node) {
		for (let up = this.parents.get(node); up; up = this.parents.get(up)) {
			if (
				up.type === "Property" &&
				!up.computed &&
				(up.key.name ?? up.key.value) === "macros"
			) {
				return true;
			}
			if (up.type === "CallExpression" || up.type.endsWith("Statement"))
				return false;
		}
		return false;
	}

	/** TeX-looking string literals whose text never reached a sink. */
	unused(found) {
		const out = [];
		for (const node of this.literals) {
			const tagged =
				this.parents.get(node)?.type === "TaggedTemplateExpression";
			const pieces =
				node.type === "Literal"
					? [node.value]
					: node.quasis.map((q) => (tagged ? q.value.raw : q.value.cooked));
			const value = pieces.join("…");
			if (!/[\\^_{]/.test(value)) continue;
			const parent = this.parents.get(node);
			if (parent?.type === "ImportDeclaration") continue;
			if (parent?.type === "Property" && parent.key === node) continue;
			if (this.insideMacros(node)) continue;
			if (
				parent?.type === "CallExpression" &&
				parent.arguments.includes(node)
			) {
				const name =
					parent.callee.type === "Identifier"
						? parent.callee.name
						: propName(parent.callee);
				if (NON_TEX_CALLS.has(name)) continue;
			}
			if (parent?.type === "BinaryExpression" && parent.operator === "+") {
				// Pieces of a concatenated test title or error message.
				let top = parent;
				while (this.parents.get(top)?.type === "BinaryExpression")
					top = this.parents.get(top);
				const call = this.parents.get(top);
				if (call?.type === "CallExpression") {
					const name =
						call.callee.type === "Identifier"
							? call.callee.name
							: propName(call.callee);
					if (NON_TEX_CALLS.has(name)) continue;
				}
			}
			const known = (piece) =>
				!piece || found.some((tex) => tex.includes(piece));
			if (pieces.every(known)) continue;
			out.push(`${this.where(node)}: ${JSON.stringify(value)}`);
		}
		return out;
	}
}

function stripTypes(source) {
	// stripTypeScriptTypes is experimental in Node 22 and says so once.
	const emitWarning = process.emitWarning;
	process.emitWarning = () => {};
	try {
		return stripTypeScriptTypes(source);
	} finally {
		process.emitWarning = emitWarning;
	}
}

function read(relative) {
	const file = path.join(UPSTREAM, relative);
	if (!fs.existsSync(file)) {
		throw new Error(
			`${file} not found — pass the KaTeX v0.18.7 download as the first argument`,
		);
	}
	return fs.readFileSync(file, "utf8");
}

const unresolvedSites = [];
const specExtractors = [];
for (const relative of SPEC_FILES) {
	const extractor = new SpecExtractor(relative, stripTypes(read(relative)));
	specExtractors.push(extractor);
	for (const at of extractor.run()) unresolvedSites.push(`${relative}:${at}`);
}

// ---------------------------------------------------------------------------
// ss_data.yaml

{
	const data = yaml.load(read(YAML_FILE));
	for (const [name, entry] of Object.entries(data)) {
		const where = `${YAML_FILE}:${name}`;
		const tex = typeof entry === "string" ? entry : entry?.tex;
		if (typeof tex !== "string") {
			notes.push(`${where}: no string formula (${JSON.stringify(entry)})`);
			continue;
		}
		const macros = entry?.macros ?? {};
		const used = Object.keys(macros).find((macro) => mentions(tex, macro));
		if (used) skip(tex, "ss_data macros", ` ${used}`, where);
		else keep(tex, YAML_FILE, where);
	}
}

// ---------------------------------------------------------------------------
// Docs

const ASCII_PUNCT = /[!-/:-@[-`{-~]/;

/** $…$ and $$…$$ spans of one line or table cell, as markdown sees them. */
function mathSpans(text) {
	const spans = [];
	let i = 0;
	while (i < text.length) {
		const ch = text[i];
		if (ch === "\\" && ASCII_PUNCT.test(text[i + 1] ?? "")) {
			i += 2;
		} else if (ch === "`") {
			// A code span closes at the next backtick run of the same length.
			const run = /^`+/.exec(text.slice(i))[0].length;
			let close = -1;
			for (let j = text.indexOf("`", i + run); j >= 0; ) {
				const length = /^`+/.exec(text.slice(j))[0].length;
				if (length === run) {
					close = j;
					break;
				}
				j = text.indexOf("`", j + length);
			}
			i = close >= 0 ? close + run : i + run;
		} else if (ch === "<" && /^<\/?[A-Za-z][^<>]*>/.test(text.slice(i))) {
			i += /^<\/?[A-Za-z][^<>]*>/.exec(text.slice(i))[0].length;
		} else if (ch === "$") {
			const width = text[i + 1] === "$" ? 2 : 1;
			let end = -1;
			for (let j = i + width; j < text.length; j++) {
				if (text[j] === "\\") {
					j++;
				} else if (text[j] === "$" && (width === 1 || text[j + 1] === "$")) {
					end = j;
					break;
				}
			}
			if (end >= 0) {
				spans.push(text.slice(i + width, end));
				i = end + width;
			} else {
				i += width;
			}
		} else {
			i++;
		}
	}
	return spans;
}

const CONTROL_WORD = /\\[A-Za-z@]+/g;
const GLOBAL_DEF =
	/\\(?:gdef|xdef|global\s*\\[ex]?def|global\s*\\let)\s*(\\[A-Za-z@]+)/g;
const defines = (tex, name) =>
	new RegExp(
		`\\\\(?:[gex]?def|let|futurelet|(?:re|provide)?newcommand)\\s*\\{?\\s*${escapeName(name)}(?![A-Za-z@])`,
	).test(tex);

/** The rendered examples of one docs page, in page order. */
function docFormulas(relative) {
	const formulas = [];
	let fenced = false;
	let front = false;
	read(relative)
		.split("\n")
		.forEach((line, index) => {
			if (index === 0 && line === "---") front = true;
			else if (front) front = line !== "---";
			else if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
			else if (!fenced) {
				// Rows split on every |, as the docs site's table parser does.
				const cells = /^\s*\|/.test(line) ? line.split("|") : [line];
				for (const cell of cells) {
					for (const tex of mathSpans(cell)) {
						formulas.push({ tex, where: `${relative}:${index + 1}` });
					}
				}
			}
		});
	return formulas;
}

for (const relative of DOC_FILES) {
	const pageMacros = new Map(); // name -> the formula that \gdef'd it
	for (const { tex, where } of docFormulas(relative)) {
		const used = [...new Set(tex.match(CONTROL_WORD) ?? [])].filter(
			(name) => pageMacros.has(name) && !defines(tex, name),
		);
		if (used.length === 0) {
			keep(tex, relative, where);
		} else {
			// As rendered on the page: the earlier \gdef still in scope. (The
			// sources the code spans show, with a literal |, are all in the
			// specs or ss_data.yaml already.)
			const prefix = used.map((name) => pageMacros.get(name)).join("");
			keep(prefix + tex, relative, where);
			notes.push(
				`${where}: page macros ${used.join(", ")} for ${JSON.stringify(tex)}`,
			);
		}
		for (const match of tex.matchAll(GLOBAL_DEF)) pageMacros.set(match[1], tex);
	}
}

// ---------------------------------------------------------------------------
// Filter, sort, write

const cases = [];
for (const [tex, where] of kept) {
	if (!tex.isWellFormed()) skip(tex, "lone surrogate", "", where);
	else if (MHCHEM.test(tex)) skip(tex, "mhchem", "", where);
	else cases.push(tex);
}
const written = new Set(cases);
for (const tex of skipped.keys()) if (written.has(tex)) skipped.delete(tex);
cases.sort();

fs.writeFileSync(
	OUT,
	`[\n${cases.map((tex) => `\t${JSON.stringify(tex)}`).join(",\n")}\n]\n`,
);

const rel = (file) => path.relative(ROOT, file);
for (const [source, set] of perSource) {
	console.log(`${source}: ${set.size} formulas`);
}
const kinds = new Map();
for (const { kind } of skipped.values())
	kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
console.log(
	`skipped ${skipped.size}: ${[...kinds].map(([kind, n]) => `${kind} ${n}`).join(", ") || "none"}`,
);
console.log(`unresolved TeX arguments: ${unresolvedSites.length} call site(s)`);
console.log(`wrote ${rel(OUT)}: ${cases.length} formulas`);

if (args.verbose) {
	const section = (title, lines) => {
		console.log(`\n${title} (${lines.length})`);
		for (const line of lines) console.log(`  ${line}`);
	};
	section("unresolved call sites", unresolvedSites);
	section(
		"skipped",
		[...skipped].map(([tex, { text }]) => `${JSON.stringify(tex)}: ${text}`),
	);
	section("notes", [...new Set(notes)]);
	const found = [...kept.keys(), ...skipped.keys()];
	section(
		"TeX-looking literals that never reached KaTeX",
		specExtractors.flatMap((extractor) => extractor.unused(found)),
	);
}

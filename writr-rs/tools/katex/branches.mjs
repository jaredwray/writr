// Branch probes for coverage.mjs. V8's block coverage counts blocks, so it
// cannot see a condition outcome that has no code of its own: an `if`
// without `else` whose test is never false, a `&&`/`||` operand that never
// short-circuits, one leaf of a compound test that is always true, a
// `switch` case label that never matches when it shares a body with others.
// This module finds every such decision in dist/katex.mjs and writes a copy
// of the module with each condition leaf wrapped in a counting call, so the
// coverage harness can render the corpus through it and count outcomes
// exactly. The copy's rendered output is checked against the real module's.
//
// It also probes decisions that are not control flow at all ("implicit"
// decisions, reported separately):
//   - regexes: which alternatives, optional parts and class members of each
//     regex literal and `new RegExp(…)` ever match (regex.mjs);
//   - min/max: which argument of each Math.min/Math.max call decides the
//     result (is the unique argument equal to it);
//   - sets: which members of each `new Set([…string literals])` a `has`
//     call ever finds, and whether one ever misses;
//   - tables: which keys of each module-level object-literal table (and of
//     the inner tables of TABLES_OF_TABLES) are ever looked up (read, `in`
//     or hasOwnProperty), through a Proxy. TABLES_SKIPPED lists the objects
//     that are not lookup tables, or are measured elsewhere.
//
// Library only: coverage.mjs imports it.
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import vm from "node:vm";
import { loadInternals } from "./internals.mjs";
import { analyzeRegex } from "./regex.mjs";

/** Probe kinds reported apart from the control-flow branches. */
export const IMPLICIT_KINDS = { regex: "regexes", "min/max": "min/max", set: "sets", table: "tables" };

/** Module-level object literals that are not probed as tables. */
export const TABLES_SKIPPED = new Map([
	["SETTINGS_SCHEMA", "settings schema (rehype-katex sets three options)"],
	["fontMetricsData", "per-glyph metrics, which vendor/katex-rs keeps as KaTeX's own data (VENDORED.md)"],
	["symbols", "filled by defineSymbol; the symbols sections sweep it, and vendor/katex-rs keeps KaTeX's own table"],
	["_functions", "registry filled by defineFunction"],
	["_htmlGroupBuilders", "registry filled by defineFunction"],
	["_mathmlGroupBuilders", "registry filled by defineFunction"],
	["_environments", "registry filled by defineEnvironment"],
	["_macros", "registry filled by defineMacro"],
	["fontMetricsBySizeIndex", "cache filled by getGlobalMetrics"],
	["thinspace", "a measurement, not a table"],
	["mediumspace", "a measurement, not a table"],
	["thickspace", "a measurement, not a table"],
	["lap", "a kern, not a table"],
	["__domTree", "export object"],
	["katex", "export object"],
]);
/** Tables whose values are tables in turn (probed one by one). */
const TABLES_OF_TABLES = new Set(["spacings", "tightSpacings"]);

/**
 * Decision points in `ast`. Each probe has `slot` (index of its first
 * counter), `start`/`end` (the leaf, or the switch discriminant), `root`
 * (`{start, end}` of the whole decision, for display), `kind` ("if",
 * "loop", "?:", "&&/||", "switch", or an IMPLICIT_KINDS key) and
 * `outcomes`: `{label, code}` where `code` is the offset of the code that
 * outcome leads to (whose V8 count says whether block coverage already sees
 * the outcome) or null when the outcome has no code of its own; implicit
 * outcomes also carry `leafText` (the argument, set member or sub-pattern).
 * `slots` is the number of counters.
 *
 * `source` is the module text; `resolveRegExp(node)` returns `{pattern,
 * flags}` for a `new RegExp(…)` expression (its pattern is computed when
 * the module loads).
 */
export function findProbes(ast, { source, resolveRegExp }) {
	const probes = [];
	let slots = 0;
	const marked = new Set();
	const code = (node) => ({ code: node.start });
	const none = (why) => ({ code: null, why });

	function leaf(node, kind, root, onTrue, onFalse) {
		if (node.type === "Literal") return; // constant, never a branch
		probes.push({
			slot: slots,
			kind,
			start: node.start,
			end: node.end,
			root: { start: root.start, end: root.end },
			outcomes: [
				{ label: "true", ...onTrue },
				{ label: "false", ...onFalse },
			],
		});
		slots += 2;
	}

	/** A condition: short-circuit operands and `!` are decomposed. */
	function condition(node, kind, root, onTrue, onFalse) {
		if (node.type === "LogicalExpression" && node.operator !== "??") {
			marked.add(node);
			if (node.operator === "&&") {
				condition(node.left, kind, root, code(node.right), onFalse);
			} else {
				condition(node.left, kind, root, onTrue, code(node.right));
			}
			condition(node.right, kind, root, onTrue, onFalse);
		} else if (node.type === "UnaryExpression" && node.operator === "!") {
			condition(node.argument, kind, root, onFalse, onTrue);
		} else {
			leaf(node, kind, root, onTrue, onFalse);
		}
	}

	/** A logical expression whose value (not truthiness) is used. */
	function value(node) {
		if (node.type !== "LogicalExpression" || marked.has(node)) return;
		marked.add(node);
		if (node.operator === "??") {
			throw new Error(`branches: unexpected ?? at offset ${node.start}`);
		}
		const result = none("short-circuit");
		if (node.operator === "&&") {
			condition(node.left, "&&/||", node, code(node.right), result);
		} else {
			condition(node.left, "&&/||", node, result, code(node.right));
		}
		value(node.right);
	}

	function switchProbe(node) {
		const cases = node.cases;
		const pure = (test) =>
			test.type === "Literal" ||
			test.type === "Identifier" ||
			(test.type === "MemberExpression" && !test.computed && pure(test.object));
		if (!cases.every((clause) => clause.test === null || pure(clause.test))) {
			throw new Error(`branches: impure case label in switch at offset ${node.start}`);
		}
		// Each label leads to the first statement at or after its clause.
		const bodyFrom = (index) => {
			for (let i = index; i < cases.length; i++) {
				if (cases[i].consequent.length > 0) return { code: cases[i].consequent[0].start };
			}
			return none("empty trailing case");
		};
		const labelled = cases.map((clause, index) => ({ clause, index })).filter(({ clause }) => clause.test);
		const fallback = cases.findIndex((clause) => clause.test === null);
		probes.push({
			slot: slots,
			kind: "switch",
			start: node.discriminant.start,
			end: node.discriminant.end,
			root: { start: node.start, end: node.discriminant.end + 1 },
			tests: labelled.map(({ clause }) => clause.test),
			outcomes: [
				...labelled.map(({ clause, index }) => ({
					label: `case ${clause.test.raw ?? clause.test.name ?? "…"}`,
					labelStart: clause.test.start,
					labelEnd: clause.test.end,
					...bodyFrom(index),
				})),
				fallback >= 0
					? { label: "default", ...bodyFrom(fallback) }
					: { label: "no case", ...none("no default clause") },
			],
		});
		slots += labelled.length + 1;
	}

	// Statement → the statement after it in the same list.
	const nextStatement = new Map();
	walk(ast, (node) => {
		for (const list of [node.type === "SwitchCase" ? node.consequent : node.body]) {
			if (!Array.isArray(list)) continue;
			list.forEach((statement, i) => {
				if (i + 1 < list.length) nextStatement.set(statement, list[i + 1]);
			});
		}
	});
	/** An `if` without `else` whose body always leaves (return, throw,
	 * break, continue) is false exactly when the next statement runs, and
	 * V8 counts that statement separately. */
	const otherwise = (node) => {
		if (node.alternate) return code(node.alternate);
		const next = nextStatement.get(node);
		return next && leaves(node.consequent) ? code(next) : none("no else");
	};

	walk(ast, (node) => {
		switch (node.type) {
			case "IfStatement":
				condition(node.test, "if", node.test, code(node.consequent), otherwise(node));
				break;
			case "ConditionalExpression":
				condition(node.test, "?:", node.test, code(node.consequent), code(node.alternate));
				break;
			case "WhileStatement":
			case "DoWhileStatement":
			case "ForStatement":
				if (node.test) condition(node.test, "loop", node.test, code(node.body), none("loop exit"));
				break;
			case "SwitchStatement":
				switchProbe(node);
				break;
		}
	});
	walk(ast, (node) => {
		if (node.type === "LogicalExpression") value(node);
	});

	// Implicit decisions.
	const text = (node) => source.slice(node.start, node.end);
	const implicit = (node, kind, outcomes, extra) => {
		probes.push({
			slot: slots,
			kind,
			start: node.start,
			end: node.end,
			root: { start: node.start, end: node.end },
			outcomes: outcomes.map(({ label, leafText }) => ({ label, leafText, ...none("implicit decision") })),
			...extra,
		});
		slots += outcomes.length;
	};
	walk(ast, (node) => {
		const regex =
			node.type === "Literal" && node.regex
				? node.regex
				: node.type === "NewExpression" && node.callee.type === "Identifier" && node.callee.name === "RegExp"
					? resolveRegExp(node)
					: null;
		if (regex) {
			const { analysis, parts, outcomes } = analyzeRegex(regex.pattern, regex.flags);
			implicit(node, "regex", outcomes, {
				meta: { pattern: regex.pattern, flags: regex.flags, analysis, parts, outcomes: outcomes.length },
			});
		}
		if (
			node.type === "CallExpression" &&
			node.callee.type === "MemberExpression" &&
			!node.callee.computed &&
			node.callee.object.type === "Identifier" &&
			node.callee.object.name === "Math" &&
			(node.callee.property.name === "max" || node.callee.property.name === "min")
		) {
			const spreadAt = node.arguments.findIndex((arg) => arg.type === "SpreadElement");
			if (spreadAt >= 0 && spreadAt !== node.arguments.length - 1) {
				throw new Error(`branches: spread before the last Math.${node.callee.property.name} argument at offset ${node.start}`);
			}
			if (source[node.callee.end] !== "(") {
				throw new Error(`branches: unexpected text after Math.${node.callee.property.name} at offset ${node.callee.end}`);
			}
			implicit(
				node,
				"min/max",
				node.arguments.map((arg, i) => ({ label: `argument ${i + 1} decides`, leafText: text(arg) })),
				{ spreadAt, callee: node.callee },
			);
		}
		if (
			node.type === "NewExpression" &&
			node.callee.type === "Identifier" &&
			node.callee.name === "Set" &&
			node.arguments[0]?.type === "ArrayExpression" &&
			node.arguments[0].elements.every((el) => el?.type === "Literal" && typeof el.value === "string")
		) {
			const members = node.arguments[0].elements.map((el) => el.value);
			if (new Set(members).size !== members.length) {
				throw new Error(`branches: duplicate Set member at offset ${node.start}`);
			}
			implicit(node, "set", [
				...members.map((member) => ({ label: "has", leafText: JSON.stringify(member) })),
				{ label: "misses", leafText: text(node).length > 60 ? `${text(node).slice(0, 57)}...` : text(node) },
			]);
		}
	});
	const keyOf = (prop) =>
		prop.type === "Property" && !prop.computed
			? prop.key.type === "Identifier"
				? prop.key.name
				: String(prop.key.value)
			: null;
	const table = (object, name) => {
		const keys = object.properties.map(keyOf);
		if (keys.includes(null)) throw new Error(`branches: table ${name} has a computed key or spread`);
		implicit(
			object,
			"table",
			keys.map((key) => ({ label: "looked up", leafText: `${name}[${JSON.stringify(key)}]` })),
			{ meta: { keys } },
		);
	};
	for (const statement of ast.body) {
		if (statement.type !== "VariableDeclaration") continue;
		for (const { id, init } of statement.declarations) {
			if (init?.type !== "ObjectExpression" || TABLES_SKIPPED.has(id.name)) continue;
			table(init, id.name);
			if (!TABLES_OF_TABLES.has(id.name)) continue;
			for (const prop of init.properties) {
				if (prop.value.type === "ObjectExpression" && prop.value.properties.length > 0) {
					table(prop.value, `${id.name}.${keyOf(prop)}`);
				}
			}
		}
	}
	probes.sort((a, b) => a.start - b.start || b.end - a.end);
	return { probes, slots };
}

/**
 * findProbes for dist/katex.mjs (`source`, parsed as `ast`): the patterns
 * of its `new RegExp(…)` expressions are read from the module as
 * internals.mjs evaluates it.
 */
export function findKatexProbes(ast, source) {
	const { context } = loadInternals();
	const resolveRegExp = (node) => {
		const regex = vm.runInContext(source.slice(node.start, node.end), context);
		return { pattern: regex.source, flags: regex.flags };
	};
	return findProbes(ast, { source, resolveRegExp });
}

/** acorn as remark-mdx resolves it (as extract-upstream.mjs does). */
export async function loadAcorn() {
	const rootRequire = createRequire(new URL("../../../package.json", import.meta.url));
	return import(
		pathToFileURL(
			createRequire(createRequire(rootRequire.resolve("remark-mdx")).resolve("micromark-extension-mdxjs")).resolve(
				"acorn",
			),
		).href
	);
}

/** Whether `statement` can never complete normally. */
function leaves(statement) {
	switch (statement.type) {
		case "ReturnStatement":
		case "ThrowStatement":
		case "BreakStatement":
		case "ContinueStatement":
			return true;
		case "BlockStatement":
			return statement.body.length > 0 && leaves(statement.body.at(-1));
		case "IfStatement":
			return statement.alternate !== null && leaves(statement.consequent) && leaves(statement.alternate);
		default:
			return false;
	}
}

/** Pre-order walk over ESTree nodes. */
function walk(node, visit) {
	visit(node);
	for (const key of Object.keys(node)) {
		if (key === "type" || key === "start" || key === "end") continue;
		const value = node[key];
		if (Array.isArray(value)) {
			for (const child of value) if (child && typeof child.type === "string") walk(child, visit);
		} else if (value && typeof value.type === "string") {
			walk(value, visit);
		}
	}
}

const GLOBAL = "__katexBranchProbe";

/**
 * `source` with every probe wrapped in a counting call: condition leaves and
 * switch discriminants in __bp.b/__bp.s, Math.min/max calls in __bp.mx, Set
 * literals in __bp.set (an own `has` that counts), tables in __bp.tab (a
 * counting Proxy) and regexes in __bp.re (a RegExp subclass whose exec
 * counts, with regex.mjs's countRegex). The counters live in
 * `globalThis.__katexBranchProbe.counts` once the module is evaluated. The
 * prelude shares line 1, so line numbers match dist/katex.mjs.
 */
export function instrument(source, { probes, slots }) {
	const edits = [];
	const meta = {};
	for (const probe of probes) {
		if (probe.kind === "regex") {
			meta[probe.slot] = probe.meta;
			edits.push({ at: probe.start, order: -probe.end, text: `__bp.re(${probe.slot}, ` });
			edits.push({ at: probe.end, order: probe.start, text: ")" });
		} else if (probe.kind === "table") {
			meta[probe.slot] = probe.meta;
			edits.push({ at: probe.start, order: -probe.end, text: `__bp.tab(${probe.slot}, ` });
			edits.push({ at: probe.end, order: probe.start, text: ")" });
		} else if (probe.kind === "set") {
			edits.push({ at: probe.start, order: -probe.end, text: `__bp.set(${probe.slot}, ` });
			edits.push({ at: probe.end, order: probe.start, text: ")" });
		} else if (probe.kind === "min/max") {
			// Math.max(a, b) -> __bp.mx(slot, spreadAt, Math.max, a, b)
			edits.push({ at: probe.start, order: -probe.end, text: `__bp.mx(${probe.slot}, ${probe.spreadAt}, ` });
			edits.push({ at: probe.callee.end, order: 0, text: ", ", remove: 1 });
		} else if (probe.kind === "switch") {
			const tests = probe.tests.map((test) => source.slice(test.start, test.end)).join(", ");
			edits.push({ at: probe.start, order: -probe.end, text: `__bp.s(${probe.slot}, (` });
			edits.push({ at: probe.end, order: probe.start, text: `), [${tests}])` });
		} else {
			edits.push({ at: probe.start, order: -probe.end, text: `__bp.b(${probe.slot}, (` });
			edits.push({ at: probe.end, order: probe.start, text: "))" });
		}
	}
	// At one offset, closers (innermost first) come before openers
	// (outermost first); probes nest like the AST.
	edits.sort((a, b) => {
		if (a.at !== b.at) return a.at - b.at;
		const aClose = a.text.startsWith(")");
		const bClose = b.text.startsWith(")");
		if (aClose !== bClose) return aClose ? -1 : 1;
		return aClose ? b.order - a.order : a.order - b.order;
	});
	const regexModule = new URL("./regex.mjs", import.meta.url).href;
	const out = [
		`import { countRegex as __bpRx } from ${JSON.stringify(regexModule)}; ` +
			`var __bp = globalThis.${GLOBAL} = { counts: new Float64Array(${slots}), meta: ${JSON.stringify(meta)}, rc: {}, ` +
			"b(i, v) { this.counts[v ? i : i + 1]++; return v; }, " +
			"s(i, v, t) { var k = t.indexOf(v); this.counts[i + (k < 0 ? t.length : k)]++; return v; }, " +
			// Math.min/max: count the syntactic argument that alone equals the result.
			"mx(i, spreadAt, fn, ...args) { var r = fn(...args), who = -1; " +
			"for (var k = 0; k < args.length; k++) { if (args[k] !== r) continue; " +
			"var a = spreadAt >= 0 && k >= spreadAt ? spreadAt : k; " +
			"if (who === -1) who = a; else if (who !== a) { who = -2; break; } } " +
			"if (who >= 0) this.counts[i + who]++; return r; }, " +
			"set(i, s) { var list = [...s], c = this.counts; " +
			"s.has = function (v) { var r = Set.prototype.has.call(s, v); c[i + (r ? list.indexOf(v) : list.length)]++; return r; }; " +
			"return s; }, " +
			// Tables: a Proxy counting lookups of own keys.
			"tab(i, t) { var c = this.counts, idx = new Map(this.meta[i].keys.map(function (k, j) { return [k, j]; })), " +
			"n = function (k) { var j = idx.get(k); if (j !== undefined) c[i + j]++; }; " +
			"return new Proxy(t, { get(o, k, r) { n(k); return Reflect.get(o, k, r); }, has(o, k) { n(k); return Reflect.has(o, k); }, " +
			"getOwnPropertyDescriptor(o, k) { n(k); return Reflect.getOwnPropertyDescriptor(o, k); } }); }, " +
			"re(i, r) { var C = this.rc[i]; if (!C) { var meta = this.meta[i], c = this.counts, " +
			'fl = meta.flags.replace(/[gy]/g, ""), A = new RegExp(meta.analysis, fl + "y"), ' +
			"mres = meta.parts.map(function (p) { return p.members ? p.members.map(function (m) { return new RegExp(m, fl); }) : null; }); " +
			"C = this.rc[i] = class extends RegExp { exec(s) { var m = super.exec(s); __bpRx(c, i, meta, A, mres, m, String(s)); return m; } }; } " +
			"return new C(r.source, r.flags); } };",
	];
	let last = 0;
	for (const edit of edits) {
		out.push(source.slice(last, edit.at), edit.text);
		last = edit.at + (edit.remove ?? 0);
	}
	out.push(source.slice(last));
	return out.join("");
}

/** The counters after the instrumented module ran (in the same process). */
export function probeCounts() {
	const probe = globalThis[GLOBAL];
	if (!probe) throw new Error("the instrumented katex module was never evaluated");
	return Array.from(probe.counts);
}

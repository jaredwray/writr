// Regex probes for branches.mjs. A regular expression is code that block
// and branch coverage see as a single expression, although its
// alternatives, optional parts and character-class members are decisions
// of their own (and ones a hand-written lexer or matcher in a port has to
// reproduce). This module parses a pattern (the ES2018 syntax dist/katex.mjs
// uses) and derives an "analysis" pattern: the same regex with an extra
// capturing group around every alternative of a disjunction, every
// quantified term and every character class, and backreferences
// renumbered. Capturing groups never change what a regex matches, so when
// the original matches at some index the analysis regex, run sticky at
// that index, matches the same text, and its extra groups tell which parts
// took part (in the last iteration, inside a repeated group).
//
// Outcomes per regex:
//   "alternative N"  alternative N of a disjunction with several took part
//   "absent" / "present"  a term quantified with minimum 0 matched nothing /
//                    something
//   "minimum" / "more"  a one-character term quantified with a minimum of 1
//                    or more repeated exactly that often / more often
//   "member M"       a character matched by a (non-negated) class with
//                    several members fell under member M (first that fits)
//   "match" / "no match"  exec succeeded / failed ("match" only for a regex
//                    without any of the parts above)
//
// Library only: branches.mjs imports it.

/** Parse `pattern` (without the u or v flag) into a small AST. */
export function parseRegex(pattern) {
	let pos = 0;
	let groups = 0;
	const peek = () => pattern[pos];
	const fail = (why) => {
		throw new Error(`regex: ${why} at ${pos} in /${pattern}/`);
	};

	function disjunction(stop) {
		const start = pos;
		const alts = [alternative()];
		while (peek() === "|") {
			pos++;
			alts.push(alternative());
		}
		if (stop && peek() !== stop) fail(`expected ${stop}`);
		return { type: "disj", alts, start, end: pos };
	}

	function alternative() {
		const start = pos;
		const terms = [];
		while (pos < pattern.length && peek() !== "|" && peek() !== ")") terms.push(term());
		return { type: "alt", terms, start, end: pos };
	}

	function term() {
		const start = pos;
		const ch = peek();
		if (ch === "^" || ch === "$") {
			pos++;
			return { type: "assert", start, end: pos };
		}
		if (ch === "\\" && (pattern[pos + 1] === "b" || pattern[pos + 1] === "B")) {
			pos += 2;
			return { type: "assert", start, end: pos };
		}
		let atom;
		if (ch === "(") {
			pos++;
			let capturing = true;
			let lookaround = false;
			if (peek() === "?") {
				const next = pattern.slice(pos, pos + 3);
				if (next.startsWith("?:")) {
					capturing = false;
					pos += 2;
				} else if (/^\?(=|!|<=|<!)/.test(next)) {
					capturing = false;
					lookaround = true;
					pos += next[1] === "<" ? 3 : 2;
				} else if (next.startsWith("?<")) {
					pos = pattern.indexOf(">", pos) + 1;
					if (pos === 0) fail("unterminated group name");
				} else {
					fail("unknown group");
				}
			}
			const index = capturing ? ++groups : undefined;
			const prefixEnd = pos;
			const body = disjunction(")");
			pos++;
			atom = { type: "group", capturing, lookaround, index, body, start, prefixEnd, end: pos };
			if (lookaround) return atom; // not quantifiable (without Annex B)
		} else if (ch === "[") {
			atom = charClass();
		} else if (ch === "\\") {
			atom = escape();
		} else if (ch === ")" || ch === "|") {
			fail("unexpected");
		} else {
			// One UTF-16 unit (the patterns here carry no u flag).
			pos++;
			atom = { type: ch === "." ? "dot" : "char", start, end: pos };
		}
		const q = quantifier();
		if (!q) return atom;
		return { type: "quant", atom, ...q, start, end: pos };
	}

	function escape() {
		const start = pos;
		pos++; // backslash
		const ch = peek();
		if (ch === undefined) fail("trailing backslash");
		if (/[1-9]/.test(ch)) {
			const digits = /^[0-9]+/.exec(pattern.slice(pos))[0];
			pos += digits.length;
			return { type: "backref", n: Number(digits), start, end: pos };
		}
		if (ch === "k" && pattern[pos + 1] === "<") fail("named backreference");
		pos++;
		if (ch === "x") pos += 2;
		else if (ch === "u") pos += 4;
		else if (ch === "c") pos += 1;
		const cls = /[dDsSwW]/.test(ch);
		return { type: cls ? "classEscape" : "char", start, end: pos };
	}

	function classAtom() {
		const start = pos;
		if (peek() === "\\") {
			pos++;
			const ch = pattern[pos++];
			if (ch === "x") pos += 2;
			else if (ch === "u") pos += 4;
			else if (ch === "c") pos += 1;
			return { start, end: pos, escapeClass: /[dDsSwW]/.test(ch) };
		}
		pos++;
		return { start, end: pos, escapeClass: false };
	}

	function charClass() {
		const start = pos;
		pos++;
		let negated = false;
		if (peek() === "^") {
			negated = true;
			pos++;
		}
		const members = [];
		while (peek() !== "]") {
			if (pos >= pattern.length) fail("unterminated class");
			const from = classAtom();
			if (peek() === "-" && pattern[pos + 1] !== "]" && pattern[pos + 1] !== undefined && !from.escapeClass) {
				pos++;
				const to = classAtom();
				members.push({ start: from.start, end: to.end });
			} else {
				members.push({ start: from.start, end: from.end });
			}
		}
		pos++;
		return { type: "class", negated, members, start, end: pos };
	}

	function quantifier() {
		const ch = peek();
		let min;
		let max;
		if (ch === "*") [min, max] = [0, Infinity];
		else if (ch === "+") [min, max] = [1, Infinity];
		else if (ch === "?") [min, max] = [0, 1];
		else if (ch === "{") {
			const m = /^\{(\d+)(,(\d*))?\}/.exec(pattern.slice(pos));
			if (!m) return null;
			min = Number(m[1]);
			max = m[2] === undefined ? min : m[3] === "" ? Infinity : Number(m[3]);
			pos += m[0].length - 1;
		} else return null;
		pos++;
		let lazy = false;
		if (peek() === "?") {
			lazy = true;
			pos++;
		}
		return { min, max, lazy };
	}

	const ast = disjunction(null);
	if (pos !== pattern.length) fail("unbalanced )");
	return { ast, groups };
}

/** `text` with surrogates and control characters escaped, for reports. */
const printable = (text) =>
	text.replace(/[\uD800-\uDFFF\x00-\x1F]/g, (ch) => {
		const escapes = { "\t": "\\t", "\n": "\\n", "\r": "\\r" };
		return escapes[ch] ?? `\\u${ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")}`;
	});

const singleChar = (atom) =>
	atom.type === "char" || atom.type === "dot" || atom.type === "class" || atom.type === "classEscape";

/**
 * The analysis pattern for `pattern` and its outcomes, in slot order:
 * `{ analysis, parts, outcomes }`. Each part is `{ group, test, outcome }`
 * (or `{ group, members, outcome }` for a class: `members` are patterns for
 * one-member classes, `outcome` the first member's index), where `outcome`
 * indexes `outcomes` (`{ label, leafText }`); the last outcome is
 * "no match".
 */
export function analyzeRegex(pattern, flags) {
	if (/[uv]/.test(flags)) throw new Error(`regex: unsupported flags ${flags}`);
	const { ast } = parseRegex(pattern);
	const text = (node) => pattern.slice(node.start, node.end);
	const outcomes = [];
	const parts = [];
	let next = 0; // capturing groups emitted so far
	const renumber = new Map(); // original group index -> analysis index
	const outcome = (label, leafText) => outcomes.push({ label, leafText: printable(leafText) }) - 1;
	// Leaf texts run from the start of the enclosing alternative, so equal
	// sub-patterns in different places stay apart.
	let context = 0;
	const leaf = (node) => pattern.slice(context, node.end);

	function emit(node) {
		switch (node.type) {
			case "disj": {
				if (node.alts.length < 2) return emitAlt(node.alts[0]);
				return node.alts
					.map((alt, i) => {
						const group = ++next;
						const out = `(${emitAlt(alt)})`;
						parts.push({ group, test: "defined", outcome: outcome(`alternative ${i + 1}`, text(alt) || "(empty)") });
						return out;
					})
					.join("|");
			}
			case "group": {
				if (node.capturing) renumber.set(node.index, ++next);
				return `${pattern.slice(node.start, node.prefixEnd)}${emit(node.body)})`;
			}
			case "quant": {
				const group = ++next;
				const q = pattern.slice(node.atom.end, node.end);
				// A class is captured by the quantifier's group as a whole run.
				const inner = node.atom.type === "class" ? text(node.atom) : emit(node.atom);
				const wrapped = node.atom.type === "group" ? inner : `(?:${inner})`;
				if (node.min === 0) {
					parts.push({ group, test: "empty", outcome: outcome("absent", leaf(node)) });
					parts.push({ group, test: "nonempty", outcome: outcome("present", leaf(node)) });
				} else if (node.max > node.min && singleChar(node.atom)) {
					parts.push({ group, test: `length=${node.min}`, outcome: outcome("minimum", leaf(node)) });
					parts.push({ group, test: `length>${node.min}`, outcome: outcome("more", leaf(node)) });
				}
				if (node.atom.type === "class") classPart(node.atom, group);
				return `(${wrapped}${q})`;
			}
			case "class": {
				if (node.negated || node.members.length < 2) return text(node);
				const group = ++next;
				classPart(node, group);
				return `(${text(node)})`;
			}
			case "backref":
				return `\\${"\0"}${node.n}\0`;
			default:
				return text(node);
		}
	}
	function emitAlt(alt) {
		const saved = context;
		context = alt.start;
		const out = alt.terms.map(emit).join("");
		context = saved;
		return out;
	}
	function classPart(node, group) {
		if (node.negated || node.members.length < 2) return;
		// One-member classes; a leading ^ must not negate them.
		const members = node.members.map((m) => {
			const member = pattern.slice(m.start, m.end);
			return `[${member.startsWith("^") ? "\\" : ""}${member}]`;
		});
		const first = outcomes.length;
		node.members.forEach((m) => outcome(`member ${JSON.stringify(pattern.slice(m.start, m.end))}`, leaf(node)));
		parts.push({ group, members, outcome: first });
	}

	let analysis = emit(ast);
	analysis = analysis.replace(/\\\0(\d+)\0/g, (_, n) => {
		const mapped = renumber.get(Number(n));
		if (mapped === undefined) throw new Error(`regex: backreference \\${n} to no group in /${pattern}/`);
		return `\\${mapped}`;
	});
	if (outcomes.length === 0) outcome("match", pattern);
	outcome("no match", pattern);
	// Sanity: the analysis pattern must compile.
	new RegExp(analysis, flags);
	return { analysis, parts, outcomes };
}

/**
 * Runtime side (embedded in the probed module by branches.mjs): count the
 * outcomes of one exec. `m` is exec's result on `input`, `A` the sticky
 * analysis regex, `memberRes[i]` the compiled member patterns of part i.
 */
export function countRegex(counts, slot, meta, A, memberRes, m, input) {
	if (m === null) {
		counts[slot + meta.outcomes - 1]++;
		return;
	}
	if (meta.parts.length === 0) {
		counts[slot]++;
		return;
	}
	A.lastIndex = m.index;
	const am = A.exec(input);
	if (am === null || am[0] !== m[0]) throw new Error(`regex probe diverged for /${meta.pattern}/`);
	meta.parts.forEach((part, i) => {
		const got = am[part.group];
		if (got === undefined) return;
		if (part.members) {
			const hit = new Set();
			for (let u = 0; u < got.length; u++) {
				const k = memberRes[i].findIndex((re) => re.test(got[u]));
				if (k >= 0) hit.add(k);
			}
			for (const k of hit) counts[slot + part.outcome + k]++;
			return;
		}
		const t = part.test;
		const ok =
			t === "defined" ||
			(t === "empty" && got.length === 0) ||
			(t === "nonempty" && got.length > 0) ||
			(t.startsWith("length=") && got.length === Number(t.slice(7))) ||
			(t.startsWith("length>") && got.length > Number(t.slice(7)));
		if (ok) counts[slot + part.outcome]++;
	});
}

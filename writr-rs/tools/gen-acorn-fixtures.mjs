// Generates crates/writr-acorn/tests/fixtures/acorn-corpus.jsonl: expected
// MDX expression/ESM validation outcomes from the real remark-mdx stack
// (tools/mdx/oracle.mjs) for the hand-written cases in tools/mdx/
// acorn-cases.mjs, expressions and ESM blocks found in the cached real-world
// .mdx documents, and every prefix of each (the incomplete inputs
// markdown-rs hands the parser while it tokenizes). writr-acorn must
// reproduce each outcome exactly.
//
// Run from the repo root: node writr-rs/tools/gen-acorn-fixtures.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadOracle } from "./mdx/oracle.mjs";
import {
	esm,
	esmWithImports,
	expressions,
	importPrefixes,
} from "./mdx/acorn-cases.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = path.join(
	ROOT,
	"writr-rs/crates/writr-acorn/tests/fixtures/acorn-corpus.jsonl",
);
const validate = loadOracle();

const spreads = [
	"...props", "...a, ...b", "a", "...a,", "... a", "...{a}", "...[a]", "...a}", "...a})(",
	"...a}), ({b", "...a}) => ({", "", " ", "...", "...a = 1", "...(a)", "...a.b", "...a()",
	"...await a", "...a ? b : c", "...a,,", "a: 1", "...a, b: 1", "b, ...a", "...a /* c */",
	"...a // c\n", "...a\n", "...a})", "...a}).b({", "...a} = {", "...{...a}", "...<a />",
	"...`a`", "...a => a", "...async () => 1", "...a\n,b",
];

/** Real-world expressions and ESM blocks from cached .mdx documents. */
function realWorld() {
	const found = { expressions: new Set(), spreads: new Set(), esm: new Set() };
	const dir = path.join(ROOT, "test/harness/fetch/cache");
	const files = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		for (const name of fs.readdirSync(path.join(dir, entry.name))) {
			if (name.endsWith(".mdx")) files.push(path.join(dir, entry.name, name));
		}
	}
	for (const file of files.sort()) {
		const lines = fs.readFileSync(file, "utf8").split("\n");
		let fence = null;
		const prose = [];
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const marker = /^\s*(`{3,}|~{3,})/.exec(line);
			if (fence) {
				if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = null;
				continue;
			}
			if (marker) {
				fence = marker[1];
				continue;
			}
			if (/^(import|export)\b/.test(line)) {
				const block = [line];
				while (i + 1 < lines.length && lines[i + 1].trim() !== "") block.push(lines[++i]);
				found.esm.add(block.join("\n"));
				continue;
			}
			prose.push(line);
		}
		const text = prose.join("\n");
		for (let i = 0; i < text.length; i++) {
			if (text[i] !== "{") continue;
			let depth = 0;
			for (let j = i; j < text.length && j - i < 2000; j++) {
				if (text[j] === "{") depth++;
				else if (text[j] === "}" && --depth === 0) {
					const inner = text.slice(i + 1, j);
					(inner.startsWith("...") ? found.spreads : found.expressions).add(inner);
					break;
				}
			}
		}
	}
	return found;
}

function outcome(value, kind, imports, defer) {
	try {
		const result = validate(value, kind, imports, defer);
		return [result.kind, result.message.toWellFormed(), result.pos, result.imports];
	} catch (error) {
		return ["throw", String(error?.message ?? error).toWellFormed(), 0, []];
	}
}

/** Code point prefix lengths to check for a value. */
function prefixLengths(value) {
	const length = Array.from(value).length;
	const lengths = [];
	for (let n = 0; n <= length; n++) {
		if (n <= 300 || n % 3 === 0 || length - n < 20) lengths.push(n);
	}
	return lengths;
}

const lines = [];
const seen = new Set();
function add(value, kind, imports, defer, withPrefixes) {
	const key = JSON.stringify([value, kind, imports, defer, withPrefixes]);
	if (seen.has(key)) return;
	seen.add(key);
	const points = Array.from(value);
	const lengths = withPrefixes ? prefixLengths(value) : [points.length];
	const results = lengths.map((n) => [
		n,
		...outcome(points.slice(0, n).join(""), kind, imports, defer),
	]);
	lines.push(JSON.stringify({ value, kind, imports, defer, results }));
}

for (const value of expressions) {
	add(value, "expression", [], true, true);
	add(value, "attribute", [], true, false);
	add(value, "spread", [], true, false);
}
for (const value of spreads) add(value, "spread", [], true, true);
for (const value of esm) {
	add(value, "esm", [], true, true);
	add(value, "esm", [], false, false);
}
for (const imports of importPrefixes) {
	for (const value of esmWithImports) {
		add(value, "esm", imports, false, false);
		add(value, "esm", imports, true, false);
	}
}
const world = realWorld();
for (const value of [...world.expressions].sort()) {
	add(value, "expression", [], true, true);
	add(value, "attribute", [], true, false);
}
for (const value of [...world.spreads].sort()) add(value, "spread", [], true, true);
for (const value of [...world.esm].sort()) {
	add(value, "esm", [], true, true);
	add(value, "esm", [], false, false);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${lines.join("\n")}\n`);
const checks = lines.reduce((total, line) => total + JSON.parse(line).results.length, 0);
console.log(`wrote ${lines.length} cases (${checks} checks) to ${path.relative(ROOT, OUT)}`);

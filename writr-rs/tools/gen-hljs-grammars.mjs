// Serializes highlight.js@11.11.1 language definitions for the writr-hljs
// Rust port. Each grammar becomes a flat object arena — plain objects are
// stored once and referenced by index ({$ref: n}) — preserving JS object
// identity (shared modes, cycles) exactly as the hljs compiler sees them.
// RegExps become {$re, $flags}; callbacks become canonical {$callback} ids.
//
// Run from the repo root:
//   node writr-rs/tools/gen-hljs-grammars.mjs   (regenerates all)
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { pinnedDir } from "./pinned.mjs";

const OUT_DIR = path.join(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
	"crates",
	"writr-hljs",
	"grammars",
);

// lowlight@3.3.0's `common` set — exactly what rehype-highlight registers.
const COMMON = [
	"bash", "c", "cpp", "csharp", "css", "diff", "go", "graphql", "ini",
	"java", "javascript", "json", "kotlin", "less", "lua", "makefile",
	"markdown", "objectivec", "perl", "php", "php-template", "plaintext",
	"python", "python-repl", "r", "ruby", "rust", "scss", "shell", "sql",
	"swift", "typescript", "vbnet", "wasm", "xml", "yaml",
];

const HLJS_DIR = pinnedDir("highlight.js", "11.11.1");
const require = createRequire(import.meta.url);
const hljs = require(path.join(HLJS_DIR, "lib", "core.js"));

// Canonical callback IDs by normalized function source. Every callback in
// the shipped grammars must map here (hand-ported on the Rust side);
// unknown sources abort the extraction for review.
const KNOWN_CALLBACKS = new Map([
	["(m, resp) => { if (m.index !== 0) resp.ignoreMatch(); }", "shebang-begin"],
	["(m, resp) => { resp.data._beginMatch = m[1]; }", "end-same-as-begin:begin"],
	[
		"(m, resp) => { if (resp.data._beginMatch !== m[1]) resp.ignoreMatch(); }",
		"end-same-as-begin:end",
	],
	["(m, resp) => { resp.data._beginMatch = m[1] || m[2]; }", "php-heredoc-begin"],
]);

function callbackId(fn) {
	const source = fn.toString().replace(/\s+/g, " ");
	if (KNOWN_CALLBACKS.has(source)) return KNOWN_CALLBACKS.get(source);
	if (source.includes("afterMatchIndex")) return "js-is-truly-opening-tag";
	throw new Error(`unknown grammar callback:\n${source}`);
}

function serialize(definition) {
	/** Flat arena; entry 0 is the language root. */
	const objects = [];
	const ids = new Map();

	function reference(object) {
		if (ids.has(object)) return { $ref: ids.get(object) };
		const id = objects.length;
		ids.set(object, id);
		objects.push(null); // reserve slot (cycles)
		const serialized = {};
		for (const key of Object.keys(object)) {
			if (key === "cachedVariants" || key === "isCompiled") continue;
			serialized[key] = walk(object[key]);
		}
		objects[id] = serialized;
		return { $ref: id };
	}

	function walk(value) {
		if (value === null || value === undefined) return null;
		if (value instanceof RegExp) return { $re: value.source, $flags: value.flags };
		if (typeof value === "function") return { $callback: callbackId(value) };
		if (Array.isArray(value)) return value.map((item) => walk(item));
		if (typeof value === "object") return reference(value);
		return value;
	}

	reference(definition);
	return objects;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const stale of fs.readdirSync(OUT_DIR)) {
	if (stale.endsWith(".json")) fs.unlinkSync(path.join(OUT_DIR, stale));
}
let total = 0;
for (const name of COMMON) {
	const module = require(path.join(HLJS_DIR, "lib", "languages", `${name}.js`));
	const definition = module(hljs);
	const objects = serialize(definition);
	const out = path.join(OUT_DIR, `${name}.json`);
	const body = JSON.stringify(objects);
	fs.writeFileSync(out, `${body}\n`);
	total += body.length;
}
console.log(`wrote ${COMMON.length} grammars (${(total / 1024).toFixed(0)} KiB total)`);

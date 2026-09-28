// Print the oracle output for one TeX string, for debugging writr-katex
// mismatches: the markup (or rehype-katex's error title) on stdout, and
// kind, UTF-8 length and FNV-1a 64 hash (as in katex-corpus.jsonl) on
// stderr. Reads the TeX from stdin when it is omitted or "-".
//
// Run from the repo root:
//   node writr-rs/tools/katex/show.mjs [--display] <tex>
//   printf '%s' '\frac{a}{b}' | node writr-rs/tools/katex/show.mjs --display
import fs from "node:fs";
import { parseArgs } from "node:util";
import { loadKatex, outcome } from "./oracle.mjs";

const { values, positionals } = parseArgs({
	options: { display: { type: "boolean", default: false } },
	allowPositionals: true,
});
if (positionals.length > 1) {
	console.error("usage: node writr-rs/tools/katex/show.mjs [--display] <tex>");
	process.exit(2);
}
const tex =
	positionals.length === 0 || positionals[0] === "-"
		? fs.readFileSync(0, "utf8")
		: positionals[0];

const katex = await loadKatex();
const { kind, output, hash, len } = outcome(katex, tex, values.display);
console.error(
	`${JSON.stringify(tex)} display=${values.display} kind=${kind} len=${len} hash=${hash}`,
);
process.stdout.write(`${output}\n`);

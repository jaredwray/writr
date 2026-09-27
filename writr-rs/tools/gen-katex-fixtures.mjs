// Generates crates/writr-katex/tests/fixtures/katex-corpus.jsonl: the output
// of the pinned katex@0.18.7 driven exactly as rehype-katex@7.0.1 drives it
// (tools/katex/oracle.mjs) for every case in tools/katex/katex-cases.mjs and
// tools/katex/upstream-cases.json (collected by tools/katex/corpus.mjs), in
// both inline and display mode unless a case pins one. One line per unique
// (tex, display):
//
//   {"tex":…,"display":bool,"kind":"html"|"error","hash":"<16 hex>","len":n}
//
// kind "html" is renderToString's markup (possibly KaTeX's own katex-error
// span from the strict:'ignore' retry); kind "error" is String(firstError)
// when both attempts throw. hash is FNV-1a 64 of the output's UTF-8 bytes
// and len their count, so the corpus stays small; writr-katex must produce
// output with the same hash and length. A few "error" strings are V8's own
// messages for KaTeX bugs (TypeError: … is not iterable), so regenerate with
// Node 22 (the repo's minimum, and what CI's codegen job runs).
//
// Run from the repo root: node writr-rs/tools/gen-katex-fixtures.mjs
//   --full <path>     also write {tex, display, kind, output} JSONL to <path>
//                     (for diffing mismatches; never commit it)
//   --only <substr>   only cases whose TeX contains <substr>; leaves the
//                     committed corpus untouched and prints the fixture
//                     lines to stdout instead
// Exits with status 1 (after writing) when the corpus outgrows its ~5 MiB
// budget.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { corpusPairs } from "./katex/corpus.mjs";
import { loadKatex, outcome } from "./katex/oracle.mjs";

const TOOLS = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(TOOLS, "..", "..");
const OUT = path.join(
	ROOT,
	"writr-rs/crates/writr-katex/tests/fixtures/katex-corpus.jsonl",
);
const SIZE_BUDGET = 5 * 1024 * 1024;

const { values: args } = parseArgs({
	options: { full: { type: "string" }, only: { type: "string" } },
});

const { pairs, illFormed } = corpusPairs({ only: args.only });

const katex = await loadKatex();
const fullFd =
	args.full === undefined ? undefined : fs.openSync(args.full, "w");
const lines = [];
const counts = { html: 0, fallback: 0, error: 0 };
const started = performance.now();
for (const { tex, display } of pairs) {
	const { kind, output, hash, len } = outcome(katex, tex, display);
	counts[kind]++;
	if (kind === "html" && output.startsWith('<span class="katex-error"'))
		counts.fallback++;
	lines.push(JSON.stringify({ tex, display, kind, hash, len }));
	if (fullFd !== undefined) {
		fs.writeSync(fullFd, `${JSON.stringify({ tex, display, kind, output })}\n`);
	}
}
const elapsed = performance.now() - started;
if (fullFd !== undefined) fs.closeSync(fullFd);

const corpus = `${lines.join("\n")}\n`;
const bytes = Buffer.byteLength(corpus, "utf8");
if (args.only !== undefined) {
	process.stdout.write(corpus);
} else {
	fs.mkdirSync(path.dirname(OUT), { recursive: true });
	fs.writeFileSync(OUT, corpus);
}

const unique = new Set(pairs.map((pair) => pair.tex)).size;
const kb = (bytes / 1024).toFixed(1);
const log = args.only !== undefined ? console.error : console.log;
log(
	`${args.only !== undefined ? "rendered" : `wrote ${path.relative(ROOT, OUT)}:`} ` +
		`${lines.length} cases (${unique} unique TeX), html=${counts.html} ` +
		`(${counts.fallback} katex-error spans), error=${counts.error}, ` +
		`${kb} KiB, ${(elapsed / 1000).toFixed(2)}s rendering`,
);
if (illFormed) log(`skipped ${illFormed} pair(s) with lone surrogates`);
if (args.full !== undefined) log(`full outputs: ${args.full}`);
if (bytes > SIZE_BUDGET) {
	console.error(
		`error: corpus is ${kb} KiB, over the ~5 MiB budget — trim the case lists`,
	);
	process.exitCode = 1;
}

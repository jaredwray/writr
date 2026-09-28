// Tests coverage.mjs's exclusions by fuzzing: every excluded region or
// outcome claims some code of dist/katex.mjs is unreachable through
// rehype-katex, so no input may reach it. This renders mutated corpus cases
// (wrapped in other constructs, spliced together, edited token by token and
// character by character; mulberry32 with a fixed seed) through the pinned
// dist/katex.mjs under the inspector's precise block coverage and through
// the branch-probed copy (branches.mjs), and lists each excluded item some
// input reaches, with example inputs. A hit means the exclusion is wrong:
// add the input to katex-cases.mjs and drop or narrow the rule (round 3
// found "\verb assertion failed" this way). Exits with status 1 on a hit.
//
// Run from the repo root (offline, deterministic, no new dependencies):
//   node writr-rs/tools/katex/coverage.mjs --json /tmp/katex-coverage.json
//   node writr-rs/tools/katex/fuzz-exclusions.mjs --report /tmp/katex-coverage.json
//     --report <path>   coverage.mjs --json output (the exclusions to test)
//     --count <n>       fuzz inputs to render, each inline and in display
//                       mode (default 20000)
//     --seed <n>        PRNG seed (default 1)
import fs from "node:fs";
import inspector from "node:inspector/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { findKatexProbes, instrument, loadAcorn, probeCounts } from "./branches.mjs";
import { corpusPairs } from "./corpus.mjs";
import { katexModulePath, loadInternals } from "./internals.mjs";
import { loadKatex, renderLikeRehype } from "./oracle.mjs";

const { values: args } = parseArgs({
	options: {
		report: { type: "string" },
		count: { type: "string", default: "20000" },
		seed: { type: "string", default: "1" },
	},
});
if (args.report === undefined) {
	console.error("usage: node writr-rs/tools/katex/fuzz-exclusions.mjs --report <coverage.json> [--count n] [--seed n]");
	process.exit(2);
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

function mulberry32(seed) {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** `count` distinct well-formed fuzz inputs derived from the corpus. */
function fuzzInputs(count, seed) {
	const rnd = mulberry32(seed);
	const pick = (list) => list[Math.floor(rnd() * list.length)];
	const K = loadInternals();
	const seeds = [...new Set(corpusPairs().pairs.map((p) => p.tex))].filter((t) => t.length < 120);
	const registry = [
		...Object.keys(K._functions),
		...Object.keys(K._macros),
		...Object.keys(K.symbols.math),
		...Object.keys(K.symbols.text),
		...Object.keys(K._environments).map((env) => `\\begin{${env}}`),
	];
	const structural = [..."{}^_&#$[]().,-=|<>'~@*!?/1a x"].concat([
		"\\\\", "\\relax", "\\noexpand", "\\expandafter", "\\bgroup", "\\egroup", "\\begingroup",
		"\\endgroup", "\\limits", "\\nolimits", "\\left(", "\\right)", "\\middle|", "\\over", "\\hline",
		"\\tag{1}", "\\cr", "--", "``",
	]);
	const token = () => (rnd() < 0.35 ? pick(structural) : pick(registry));
	const chars = [..."\\{}^_&#$%~@*!?'`\".,;:|/<>()[]=+-019aAzZ \n\t\r"].concat([
		"\u0301", "\u0332", "é", "𝐀", "∣", "\u2019", "\u00a0", "₁", "²", "Я",
	]);
	const wrappers = [
		"\\text{#}", "{\\scriptstyle #}", "\\large #", "\\color{red}#", "\\mathbf{#}", "\\boldsymbol{#}",
		"x^{#}_{#}", "\\frac{#}{2}", "\\left(#\\right)", "\\operatorname*{#}\\limits_a", "\\mathchoice{#}{#}{#}{#}",
		"\\html@mathml{#}{#}", "\\begin{array}{c|l}#&#\\\\\\hline #\\end{array}", "\\sqrt[#]{#}", "\\hbox{#}",
		"\\texttt{#}", "\\def\\x{#}\\x\\x", "\\phantom{#}", "\\mathop{#}\\limits^1", "a#b", "+#+",
		"\\begin{aligned}#&=#\\end{aligned}", "\\begin{gather}#\\tag{a}\\end{gather}", "\\begin{CD}#@>>>#\\end{CD}",
		"\\xrightarrow[#]{#}", "\\fbox{#}", "\\not#", "\\verb|#|", "\\sum_{#}^{#}", "\\left#\\right.",
		"\\widehat{#}", "\\href{#}{#}", "\\char\"#", "\\kern#", "\\dots#", "\\genfrac(]{0pt}{1}{#}{b}",
		"{#\\over #}", "\\underbrace{#}_{#}", "\\url{#}", "\\includegraphics[width=#]{#}",
	];
	const lexed = (s) => s.match(/\\[a-zA-Z@]+|\\.|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\s\S]/g) ?? [];
	const join = (list) =>
		list.reduce((out, t) => out + (/\\[a-zA-Z@]+$/.test(out) && /^[a-zA-Z@]/.test(t) ? " " : "") + t, "");
	const wrap = (s) => pick(wrappers).replaceAll("#", () => s);
	const tokenEdit = (s) => {
		const list = lexed(s);
		for (let n = 1 + Math.floor(rnd() * 3); n > 0; n--) {
			const at = Math.floor(rnd() * (list.length + 1));
			const r = rnd();
			if (r < 0.4) list.splice(at, 0, token());
			else if (r < 0.6) list.splice(at, 1);
			else if (r < 0.85) list.splice(at, 1, token());
			else list.splice(at, 0, ...lexed(pick(seeds)).slice(0, 8));
		}
		return join(list);
	};
	const charEdit = (s) => {
		const list = [...s];
		for (let n = 1 + Math.floor(rnd() * 3); n > 0; n--) {
			const at = Math.floor(rnd() * (list.length + 1));
			const r = rnd();
			if (r < 0.45) list.splice(at, 0, pick(chars));
			else if (r < 0.7) list.splice(at, 1);
			else if (r < 0.85) list.splice(at, 1, pick(chars));
			else {
				const from = Math.floor(rnd() * list.length);
				list.splice(at, 0, ...list.slice(from, from + 1 + Math.floor(rnd() * 6)));
			}
		}
		return list.join("");
	};
	const strategies = [
		[0.25, () => wrap(pick(seeds))],
		[0.4, () => pick(seeds) + pick(["", " ", "^", "_", "&", "\\\\", "{}", "+"]) + pick(seeds)],
		[0.65, () => tokenEdit(pick(seeds))],
		[0.8, () => wrap(tokenEdit(pick(seeds)))],
		[0.88, () => join(Array.from({ length: 1 + Math.floor(rnd() * 8) }, token))],
		[0.97, () => charEdit(pick(seeds))],
		[1, () => wrap(charEdit(pick(seeds)))],
	];
	const out = new Set();
	while (out.size < count) {
		const r = rnd();
		const tex = strategies.find(([p]) => r < p)[1]();
		if (tex.length <= 400 && tex.isWellFormed()) out.add(tex);
	}
	return [...out];
}

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

const report = JSON.parse(fs.readFileSync(args.report, "utf8"));
if (!report.regions?.[0]?.offsets || !report.branchGaps) {
	throw new Error(`${args.report}: not a coverage.mjs --json report with branch counts (rerun coverage.mjs)`);
}
const file = katexModulePath();
const source = fs.readFileSync(file, "utf8");
const url = pathToFileURL(file).href;
const flat = (text) => text.replace(/\s+/g, " ").trim().slice(0, 70);
const excludedRegions = report.regions
	.filter((r) => r.excluded)
	.map((r) => ({
		what: `region ${r.function} L${r.start.line}: ${flat(r.text)}`,
		// Significant characters, as coverage.mjs counts them.
		chars: [...Array(r.offsets[1] - r.offsets[0]).keys()]
			.map((i) => r.offsets[0] + i)
			.filter((i) => !/\s/.test(source[i]) && !")]};,".includes(source[i])),
	}));
const excludedOutcomes = report.branchGaps
	.filter((g) => g.excluded)
	.map((g) => ({ what: `${g.kind} ${g.function} L${g.at.line}: ${flat(g.leaf)} never ${g.never}`, slots: g.slots }));

const probes = findKatexProbes((await loadAcorn()).parse(source, { ecmaVersion: "latest", sourceType: "module" }), source);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "katex-fuzz-"));
const probedFile = path.join(dir, "katex-probed.mjs");
fs.writeFileSync(probedFile, instrument(source, probes));

const session = new inspector.Session();
session.connect();
await session.post("Profiler.enable");
await session.post("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
const katex = await loadKatex();
const probed = (await import(pathToFileURL(probedFile).href)).default;
fs.rmSync(dir, { recursive: true, force: true });

/** Block counts for dist/katex.mjs since the last call (V8 resets them). */
async function takeCounts() {
	const { result } = await session.post("Profiler.takePreciseCoverage");
	const counts = new Float64Array(source.length);
	const script = result.find((s) => s.url === url);
	if (!script) return counts;
	const ranges = script.functions.flatMap((fn) => fn.ranges);
	// Outermost first, so the innermost range decides (V8's nesting rule).
	ranges.sort((a, b) => a.startOffset - b.startOffset || b.endOffset - a.endOffset);
	for (const { startOffset, endOffset, count } of ranges) counts.fill(count, startOffset, endOffset);
	return counts;
}
function reached(counts, before) {
	const after = probeCounts();
	return [
		...excludedRegions.filter((r) => r.chars.some((i) => counts[i] > 0)),
		...excludedOutcomes.filter((o) => o.slots.some((k) => after[k] > before[k])),
	];
}
function render(pair) {
	renderLikeRehype(katex, pair.tex, pair.display);
	renderLikeRehype(probed, pair.tex, pair.display);
}

const inputs = fuzzInputs(Number(args.count), Number(args.seed));
const pairs = inputs.flatMap((tex) => [false, true].map((display) => ({ tex, display })));
await takeCounts(); // module evaluation
const hits = new Map();
const BATCH = 500;
for (let i = 0; i < pairs.length; i += BATCH) {
	const batch = pairs.slice(i, i + BATCH);
	let before = probeCounts();
	for (const pair of batch) render(pair);
	if (reached(await takeCounts(), before).length === 0) continue;
	// Something was reached: find the inputs one by one.
	for (const pair of batch) {
		before = probeCounts();
		render(pair);
		for (const item of reached(await takeCounts(), before)) {
			if (!hits.has(item.what)) hits.set(item.what, []);
			const examples = hits.get(item.what);
			if (examples.length < 3) examples.push(`${pair.display ? "display" : "inline "} ${JSON.stringify(pair.tex)}`);
		}
	}
}
console.log(
	`${pairs.length} pairs (${inputs.length} inputs, seed ${args.seed}); ` +
		`${excludedRegions.length} excluded regions and ${excludedOutcomes.length} excluded outcomes tested; ` +
		`${hits.size} reached`,
);
for (const [what, examples] of hits) {
	console.log(`\n${what}`);
	for (const example of examples) console.log(`  ${example}`);
}
process.exitCode = hits.size > 0 ? 1 : 0;

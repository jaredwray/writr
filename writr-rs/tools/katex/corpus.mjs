// The (tex, display) pairs of the writr-katex fixture corpus, shared by
// gen-katex-fixtures.mjs and coverage.mjs so both see exactly the same
// inputs: every case in katex-cases.mjs, then upstream-cases.json, then
// fuzz-cases.json (formulas differential fuzzing once found diverging), each
// rendered inline and in display mode unless the case pins one, first
// occurrence wins. Library only.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cases as handWritten } from "./katex-cases.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * Expand a case entry to its (tex, display) pairs. Any other key is an
 * error: every case renders with rehype-katex's default settings, so a
 * per-case setting (macros, trust, …) would be silently ignored.
 */
function expand(entry, where) {
	const { tex, display, ...rest } =
		typeof entry === "string"
			? { tex: entry, display: undefined }
			: (entry ?? {});
	if (
		typeof tex !== "string" ||
		!(display === undefined || typeof display === "boolean") ||
		Object.keys(rest).length > 0
	) {
		throw new Error(`${where}: expected a TeX string or { tex, display? }`);
	}
	return (display === undefined ? [false, true] : [display]).map((mode) => ({
		tex,
		display: mode,
	}));
}

/**
 * The corpus pairs in emission order. `only` keeps the pairs whose TeX
 * contains it. Pairs with lone surrogates are dropped (Rust strings cannot
 * hold them, so such input never reaches writr-katex) and counted in
 * `illFormed`.
 *
 * @returns {{pairs: {tex: string, display: boolean}[], illFormed: number}}
 */
export function corpusPairs({ only } = {}) {
	const upstream = JSON.parse(
		fs.readFileSync(path.join(HERE, "upstream-cases.json"), "utf8"),
	);
	const fuzz = JSON.parse(
		fs.readFileSync(path.join(HERE, "fuzz-cases.json"), "utf8"),
	);
	const pairs = [];
	const seen = new Set();
	let illFormed = 0;
	const sources = [
		["katex-cases.mjs", handWritten],
		["upstream-cases.json", upstream],
		["fuzz-cases.json", fuzz],
	];
	for (const [name, list] of sources) {
		if (!Array.isArray(list)) throw new Error(`${name}: expected an array`);
		list.forEach((entry, index) => {
			for (const pair of expand(entry, `${name}[${index}]`)) {
				if (!pair.tex.isWellFormed()) {
					illFormed++;
					continue;
				}
				if (only !== undefined && !pair.tex.includes(only)) continue;
				const key = `${pair.display ? "D" : "I"}${pair.tex}`;
				if (seen.has(key)) continue;
				seen.add(key);
				pairs.push(pair);
			}
		});
	}
	return { pairs, illFormed };
}

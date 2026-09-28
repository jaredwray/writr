// KaTeX 0.18.7 internals for codegen and debugging: evaluates the pinned
// dist/katex.mjs in a fresh node:vm context (with its trailing
// `export {...}` statement removed) and returns every module-level binding —
// the function/environment/macro registries, symbol and font-metric tables,
// SVG paths, spacing tables, and the internal classes and builders.
//
// Values live in another realm: use Array.isArray / typeof, not instanceof
// against this realm's constructors. The registries are populated the same
// way the real module populates them, but they are a separate instance from
// loadKatex()'s module.
//
// Library only: import { loadInternals } from "./katex/internals.mjs".
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { pinnedDir } from "../pinned.mjs";
import { KATEX_VERSION } from "./oracle.mjs";

/** Bindings loadInternals() guarantees (the rest are best-effort). */
export const REQUIRED = [
	"_functions",
	"_htmlGroupBuilders",
	"_mathmlGroupBuilders",
	"_environments",
	"_macros",
	"symbols",
	"ligatures",
	"fontMetricsData",
	"sigmasAndXis",
	"extraCharacterMap",
	"path",
	"ptPerUnit",
	"relativeUnit",
	"unicodeAccents",
	"unicodeSymbols",
	"scriptData",
	"spacings",
	"tightSpacings",
];

/** Path of the pinned dist/katex.mjs. */
export function katexModulePath() {
	const dir = pinnedDir("katex", KATEX_VERSION);
	const { version } = JSON.parse(
		fs.readFileSync(path.join(dir, "package.json"), "utf8"),
	);
	if (version !== KATEX_VERSION) {
		throw new Error(
			`expected katex ${KATEX_VERSION}, found ${version} at ${dir}`,
		);
	}
	return path.join(dir, "dist", "katex.mjs");
}

/** Names of top-level declarations (rollup emits them at column 0). */
function topLevelNames(source) {
	const names = new Set();
	const pattern =
		/^(?:var|let|const|class|(?:async\s+)?function\*?)\s+([A-Za-z_$][\w$]*)/gm;
	for (const match of source.matchAll(pattern)) names.add(match[1]);
	return [...names];
}

let cached;

/**
 * Evaluate dist/katex.mjs and return an object with all of its top-level
 * bindings by name, including (see REQUIRED) _functions, _htmlGroupBuilders,
 * _mathmlGroupBuilders, _environments, _macros, symbols, ligatures,
 * fontMetricsData, sigmasAndXis, extraCharacterMap, path (SVG geometry),
 * ptPerUnit, relativeUnit, unicodeAccents, unicodeSymbols, scriptData,
 * spacings, tightSpacings — plus e.g. SETTINGS_SCHEMA, Style$1, styles,
 * svgData, katexImagesData, stretchyCodePoint, stretchyMathML,
 * wideAccentLabels, fontMap, mathFontVariants, sizeStyleMap,
 * sizeMultipliers, delimiterSizes, stackLargeDelimiters,
 * stackAlwaysDelimiters, stackNeverDelimiters, sizeToMaxHeight, fontAliases,
 * sizeFuncs, styleMap, textFontFamilies/Weights/Shapes, implicitCommands,
 * digitToNumber, dotsByToken, spaceAfterDots, uSubsAndSups,
 * wideLatinLetterData, wideNumeralData, extraLatin, fontMetricsBySizeIndex,
 * ESCAPE_LOOKUP, and the classes Settings, Options, Parser, Lexer,
 * MacroExpander, Namespace, ParseError, Span, SymbolNode, MathNode.
 *
 * Also: `version`, `names` (every exported binding name) and `context` (the
 * vm context, for evaluating ad-hoc expressions with vm.runInContext).
 * The result is cached; treat it as read-only.
 */
export function loadInternals() {
	if (cached) return cached;
	const file = katexModulePath();
	const source = fs.readFileSync(file, "utf8");
	const exportStatement = /\nexport \{[^}]*\};?\s*$/;
	if (!exportStatement.test(source)) {
		throw new Error(`no trailing export statement found in ${file}`);
	}
	const body = source.replace(exportStatement, "\n");
	const names = topLevelNames(body);
	for (const name of REQUIRED) {
		if (!names.includes(name)) {
			throw new Error(
				`katex ${KATEX_VERSION}: top-level \`${name}\` not found`,
			);
		}
	}
	// Modules are strict; the directive shares line 1 so stack traces keep
	// dist/katex.mjs line numbers. The trailer is the script's completion value.
	const script = `"use strict";${body}\n({ ${names.join(", ")} });\n`;
	const context = vm.createContext({});
	const bindings = new vm.Script(script, { filename: file }).runInContext(
		context,
	);
	if (bindings.version !== KATEX_VERSION) {
		throw new Error(
			`expected katex ${KATEX_VERSION}, evaluated ${bindings.version}`,
		);
	}
	cached = { ...bindings, names, context };
	return cached;
}

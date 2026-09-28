// Measures which code in the pinned katex@0.18.7 dist/katex.mjs the
// writr-katex fixture corpus never executes. Renders every corpus pair
// (corpus.mjs: katex-cases.mjs + upstream-cases.json) through
// oracle.renderLikeRehype in a child process run under NODE_V8_COVERAGE,
// then turns V8's block coverage for dist/katex.mjs (the ES module
// rehype-katex imports; the node:vm copy internals.mjs evaluates is ignored)
// into uncovered source regions, grouped by enclosing KaTeX function.
//
// Branch coverage: block coverage cannot see a condition outcome with no
// code of its own (an `if` without `else` whose test is never false, a
// `&&`/`||` operand that never short-circuits, a compound test's leaf, a
// case label sharing a body). The child also renders every pair through a
// copy of the module whose condition leaves count their outcomes
// (branches.mjs), after checking it renders identically. An outcome that
// never happens is a branch gap unless it leads to code block coverage
// already reports, in which case it is counted with that region.
//
// Implicit decisions: the same probed module also counts decisions that are
// not control flow (branches.mjs, regex.mjs), each reported on its own line:
// which alternatives, optional parts and class members of every regex ever
// match ("regexes"), which argument of every Math.min/Math.max decides the
// result ("min/max"), which members of every Set literal `has` ever finds
// ("sets"), and which keys of every module-level lookup table are ever
// looked up ("tables"). Their gaps are listed and excluded like branch
// outcomes.
//
// Code the oracle cannot reach — renderToString with rehype-katex's options
// (displayMode, throwOnError, strict) and every other setting at its
// default — is listed in EXCLUSIONS (regions) and BRANCH_EXCLUSIONS (branch
// and implicit outcomes) below with the reason; it is reported separately
// and left out of the "reachable" percentages. fuzz-exclusions.mjs checks
// that no fuzzed input reaches any of it.
//
// Definitions: a line is code when it has a character outside whitespace
// and comments; it is uncovered when one of those characters (other than
// closing punctuation `)]};,`, which V8 marks after a return) has an
// execution count of 0. A function is executed when the first character of
// its body has a nonzero count. Regions are maximal runs of uncovered code
// within one innermost function. Branch outcomes are true/false per
// condition leaf, and each case label plus "default"/"no case" per switch.
//
// Run from the repo root (offline, deterministic, no new dependencies):
//   node writr-rs/tools/katex/coverage.mjs [options]
//     --only <substr>   render only the cases whose TeX contains <substr>
//     --dir <dir>       keep V8's raw coverage JSON, the branch-probed
//                       module and its counters in <dir> (default: a
//                       temporary directory, removed afterwards)
//     --from <dir>      skip rendering; analyze a --dir from an earlier run
//                       (or plain V8 coverage, e.g. from
//                       NODE_V8_COVERAGE=<dir> node writr-rs/tools/gen-katex-fixtures.mjs,
//                       which has no branch counters)
//     --excluded        also list the excluded regions and outcomes one by one
//     --json <path>     write every region and branch gap as JSON (with the
//                       source offsets and probe counters that
//                       fuzz-exclusions.mjs tests the exclusions with)
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { findKatexProbes, IMPLICIT_KINDS, instrument, loadAcorn, TABLES_SKIPPED } from "./branches.mjs";
import { katexModulePath } from "./internals.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..", "..", "..");

// ---------------------------------------------------------------------------
// Exclusions: code renderToString cannot reach with rehype-katex's options.
// `fn` matches the qualified function name (as printed in the report);
// `text`, when present, must also match the region's source text, so a rule
// never swallows new code in the same function. First match wins. Reasons
// are grouped by category in the report.
// ---------------------------------------------------------------------------

const EXCLUSIONS = [];
/** Register an exclusion: `category`, function-name pattern, optional
 * region-text pattern, and why the region is unreachable. */
function exclude(category, fn, text, reason) {
	EXCLUSIONS.push({ category, fn, text, reason });
}

// Region texts are matched with whitespace collapsed and anchored at the
// start of the region, so a rule covers exactly the statement it names.

// DOM output. renderToString serializes with toMarkup(); toNode() and
// katex.render() need a browser document.
exclude("dom", /(^|\.)toNode$/, null, "toNode() builds DOM nodes (katex.render only)");
exclude("dom", /^render$/, null, "katex.render and its quirks-mode stub need a DOM");
exclude("dom", /^<module>$/, /^\{ if \(document\.compatMode/,
	"quirks-mode check runs only when `document` exists");

// Public API rehype-katex does not use.
exclude("api", /^(renderToHTMLTree|buildHTMLTree|generateParseTree|setFontMetrics)$/, null,
	"__renderToHTMLTree / __parse / __setFontMetrics exports");
exclude("api", /^parseTree$/, /^\|\| toParse instanceof String\)\) \{ throw new TypeError/,
	"rehype-katex always passes a string");

// Settings: rehype-katex passes displayMode, throwOnError and strict only.
exclude("settings", /^(cliProcessor|processor)$/, null,
	"SETTINGS_SCHEMA processors: CLI flags, minRuleThickness/maxSize/maxExpand never given");
exclude("settings", /^applySetting$/, /^\? processor\(optionValue$/, "no given option has a processor");
exclude("settings", /^getImplicitDefault$/, /^case 'string': return ''$|^default: throw new Error\("Unexpected schema type/,
	"every string setting (errorColor) has an explicit default; all types are known");
exclude("settings", /^Settings\.constructor$/, /^\{ options = \{$|^\|\| \{$/,
	"renderToString always passes an options object");
exclude("settings", /^Settings\.isTrusted$/, /^\? this\.trust\(context$/, "trust is never a function");
exclude("settings", /^buildTree$/, /^\{ return buildMathML\(tree|^\{ var htmlNode = buildHTML\(tree/,
	"output is always 'htmlAndMathml'");
exclude("settings", /^buildMathML$/, /^\? "katex"$/, "output is always 'htmlAndMathml'");
exclude("settings", /^displayWrap$/, /^\{ classes\.push\("(leqno|fleqn)"$/, "leqno and fleqn are never set");
exclude("settings", /array array\)\.mathmlBuilder/, /^\{ row\.unshift\(tag$/, "leqno is never set");
exclude("settings", /^Parser\.parse$/, /^\{ this\.gullet\.macros\.set\("\\\\color", "\\\\textcolor"$/,
	"colorIsTextColor is never set");
exclude("strict", /^Settings\.(reportNonstrict|useStrictBehavior)$/,
	/^\{ \/\/ Allow return value of strict function|^\{ throw new ParseError\("LaTeX-incompatible input and strict mode is set to 'error'|^\{ return true$|^else \{ \/\/ won't happen in type-safe code/,
	"strict is 'warn' (default) or 'ignore' (the retry): never a function, true, 'error' or unknown");

// trust (default false): \href, \url, \includegraphics and \htmlClass, \htmlId,
// \htmlStyle, \htmlData render as unsupported-command text after the check.
exclude("trust", /^(Anchor|Img)\.|^makeAnchor$/, null,
	"Anchor/Img nodes are built only for trusted \\href/\\url/\\includegraphics");
exclude("trust", /^defineFunction\(href \\href\)\.(htmlBuilder|mathmlBuilder)$/, null,
	"href nodes exist only when trusted");
exclude("trust", /^defineFunction\(href \\(href|url)\)\.handler$/, /^return \{ type: "href"|^var chars = \[\]/,
	"after the isTrusted check");
exclude("trust", /^defineFunction\(html \\htmlClass\)\.(htmlBuilder|mathmlBuilder)$/, null,
	"html nodes exist only when trusted");
exclude("trust", /^defineFunction\(html \\htmlClass\)\.handler$/, /^return \{ type: "html"/,
	"after the isTrusted check");
exclude("trust", /^defineFunction\(includegraphics \\includegraphics\)\.(htmlBuilder|mathmlBuilder)$/, null,
	"includegraphics nodes exist only when trusted");
exclude("trust", /^defineFunction\(includegraphics \\includegraphics\)\.handler$/,
	/^return \{ type: "includegraphics"/, "after the isTrusted check");
exclude("trust", /^toMarkup$/, /^\{ throw new ParseError\("Invalid attribute name/,
	"attributes come only from trusted \\htmlData");
exclude("trust", /^_traverseNonSpaceNodes$/, /^\{ \/\/ Recursive DFS/,
	"partial groups are Anchors (trusted \\href) or 'enclosing' spans (trusted \\html*); " +
		"buildExpression flattens fragments");

// Extension points: fonts registered through __defineSymbol.
exclude("plugin", /^makeOrd$/, /^else \{ \/\/ fonts added by plugins/, "symbol fonts other than main/ams");
exclude("plugin", /^retrieveTextFontName$/, /^default: baseFontName = fontFamily$/,
	"font families other than amsrm/textrm/textsf/texttt");

// Internal invariants: throws and fallbacks for states no caller produces.
exclude("invariant", /^innerPath$/, /^case "\\u239c":/,
	"makeStackedDelim draws ⎜ ∣ ∥ ⎟ ⎢ ⎥ repeats with its tallDelim SVG branch, never innerPath");
exclude("invariant", /^innerPath$/, /^default: return ""$/,
	"other delimiters reaching makeStackedDelim ('!', '?' via \\genfrac) fail in getMetrics first");
exclude("invariant", /^tallDelim$/, /^default: \/\/ We should not ever get here\. throw new Error\("Unknown stretchy delimiter/,
	"svgLabel is always a handled label");
exclude("invariant", /^DocumentFragment\.toText\//, /^throw new Error\("Expected MathDomNode/,
	"MathML fragments contain only MathNodes");
exclude("invariant", /^DocumentFragment\.hasClass$/, null,
	"fragments are flattened into their parent before hasClass is consulted");
exclude("invariant", /^calculateSize$/, /^else \{ throw new ParseError\("Invalid unit/,
	"units are validated when parsed");
exclude("invariant", /^(SvgNode|LineNode)\.constructor$/, /^\|\| [[{]$/, "always constructed with arguments");
exclude("invariant", /^(assertSymbolDomNode|assertSpan)$/, /^else \{ throw new Error\("Expected (symbolNode|span)/,
	"accent labels render to SymbolNodes; supsub renders to a Span");
exclude("invariant", /^getVListChildrenAndDepth$/,
	/^\{ throw new Error\('First child must have type "elem"\.'$|^else \{ throw new Error\("Invalid positionType/,
	"makeVList parameters are fixed by internal callers");
exclude("invariant", /^_traverseNonSpaceNodes$/, /^else \{ \/\/ insert at front nodes\.unshift\(result\); i\+\+$/,
	"the first neighbour is the 'leftmost'/'mopen' dummy, which never gets glue");
exclude("invariant", /^_getOutermostNode$/, /^else if \(side === "left"\)/, "only called with side 'right'");
exclude("invariant", /^(getTypeOfDomTree|isNumberPunctuation)$/, /^\{ return (null|false)$/,
	"always called with a node");
exclude("invariant", /^getVariant$/, /^\{ return null$/,
	"\\imath and \\jmath are macros, so no MathML group has that text");
exclude("invariant", /^Options\.havingBaseStyle$/, /^\|\| this\.style\.text\($/, "every caller passes a style");
exclude("invariant", /^stretchySvg\/buildSvgSpan_$/,
	/^\{ throw new Error\("(No SVG data|Expected 4-tuple)|^else \{ throw new Error\("Correct katexImagesData/,
	"katexImagesData is complete");
exclude("invariant", /^defineFunction\(xArrow \\xleftarrow\)\.mathmlBuilder$/, /^\? "1\.75em"$|^\{ var _lowerNode/,
	"labels start with a backslash, and the body argument is required");
exclude("invariant", /^makeSizedDelim$/, /^else \{ throw new ParseError\("Illegal delimiter/,
	"checkDelimiter validates first");
exclude("invariant", /^delimTypeToFont$/, /^else if \(type\.type === "stack"\) \{ return "Size4-Regular"; \} else \{ var delimKind/,
	"traverseSequence stops at the 'stack' entry before asking for a font; types are small/large/stack");
exclude("invariant", /^assertParsed$/, /^\{ throw new Error\("Bug: The leftright/, "\\left always parses its body");
exclude("invariant", /array array\)\.htmlBuilder/, /^else \{ throw new ParseError\("Invalid separator type/,
	"separators are | or :");
exclude("invariant", /array array\)\.mathmlBuilder/, /^\|\| \[$/, "aligned environments always set cols");
exclude("invariant", /array (array|subarray)\)\.handler$/, /^\? \[args\[0$/,
	"environment arguments are always ordgroups (parseArgumentGroup)");
exclude("invariant", /^defineFunction\(environment \\begin\)\.handler$/, /^\{ throw new ParseError\("Invalid environment name"/,
	"\\begin's text argument is always an ordgroup");
exclude("invariant", /^defineFunction\(genfrac \\genfrac\)\.handler$/, /^else \{ styl = assertNodeType\(styl/,
	"the text-mode style argument is always an ordgroup");
exclude("invariant", /^delimFromValue$/, /^\? null$/, "'.' never parses as an open or close atom");
exclude("invariant", /^defineFunction\(genfrac \\\\abovefrac\)\.handler$/, /^\{ throw new Error\(".*abovefrac expected size/,
	"\\above always supplies a size");
exclude("invariant", /\.handler$/,
	/^default: throw new Error\("Unrecognized (genfrac|infix genfrac|html) command"$|^\{ throw new Error\("Unknown style: " \+ style$/,
	"funcName is always one of the registered names");
exclude("invariant", /^chooseMathStyle$/, /^default: return group\.text$/, "the style size is always one of the four");
exclude("invariant", /^assembleSupSub$/, /^else \{ \/\/ This case probably shouldn't occur/,
	"called only for a supsub with a sup or sub");
exclude("invariant", /^defineFunctionBuilders\(supsub\)\.htmlBuilder$/, /^else \{ throw new Error\("supsub must have either sup or sub/,
	"the parser builds supsub only with a sup or sub");
exclude("invariant", /^defineFunctionBuilders\(spacing\)\./, /^else \{ throw new ParseError\("Unknown type of space/,
	"every spacing symbol is in regularSpace or cssSpace");
exclude("invariant", /^Namespace\.constructor$/, /^\{ (builtins|globalMacros) = \{$/,
	"always constructed with both arguments");
exclude("invariant", /^Namespace\.endGroup$/, /^\{ throw new ParseError\("Unbalanced namespace destruction/,
	"the parser balances groups");
exclude("invariant", /^MacroExpander\.consumeArgs$/, /^\{ throw new ParseError\("The length of delimiters/,
	"\\def records numArgs + 1 delimiter lists");
exclude("invariant", /^Parser\.parseFunction$/, /^: ""$/, "inside `if (name && …)`, name is set");
exclude("invariant", /^Parser\.callFunction$/, /^else \{ throw new ParseError\("No function handler/,
	"every function has a handler");
exclude("invariant", /^Parser\.parseArguments$/, /^else \{ \/\/ should be unreachable throw new ParseError\("Null argument/,
	"missing arguments throw earlier");
exclude("invariant", /^Parser\.parseGroupOfType$/,
	/^: null$|^\{ throw new ParseError\("A primitive argument cannot be optional"|^default: throw new ParseError\("Unknown group type as "/,
	"no function has an optional hbox or primitive argument, or an unknown argType");
exclude("invariant", /^Parser\.parse(Color|Url)Group$/, /^\{ return null$/,
	"no function has an optional color or url argument");
// ("\verb assertion failed" is reachable: `\verb@x` lexes as a control word.)
exclude("invariant", /^Parser\.parseSymbol$/, /^\{ throw new ParseError\("Accent " \+ accent \+ " unsupported in "/,
	"every unicodeAccents entry has a text command");

// Transpiler output: `?.`, `??` and default-parameter guards on values
// that are always defined.
exclude("transpiled", /^buildExpression\$1\/anon@/, /^\? void 0$/,
	"spacings/tightSpacings have every class getTypeOfDomTree returns");
exclude("transpiled", /^makeText$/, /^\? void 0$/,
	"options is omitted only for non-ligature text; font/fontFamily default to ''");
exclude("transpiled", /^(assertNodeType|assertSymbolNodeType)$/, /^: String\(node$/,
	"never called with a missing node");
exclude("transpiled", /accent \\acute\)\.htmlBuilder/, /^\? void 0$|^: 0$/,
	"a character-box base renders to a SymbolNode chain; skew is a number");
exclude("transpiled", /(op \\coprod\)\.htmlBuilder|^defineFunctionBuilders\(supsub\)\.htmlBuilder$)/, /^: 0$/,
	"italic is always a number");

// ---------------------------------------------------------------------------
// Branch exclusions: condition outcomes (branches.mjs) the oracle cannot
// produce. `leaf` matches the condition leaf's text (whitespace collapsed;
// for a switch, the case label), `outcome` the outcome that never happens
// ("true", "false", "case …", "no case", or "evaluated" for a leaf that
// never runs although block coverage counts its statement).
// ---------------------------------------------------------------------------

const BRANCH_EXCLUSIONS = [];
/** Register a branch exclusion: `category`, function-name pattern, leaf
 * pattern, outcome pattern, and why that outcome cannot happen. */
function excludeBranch(category, fn, leaf, outcome, reason) {
	BRANCH_EXCLUSIONS.push({ category, fn, leaf, outcome, reason });
}

// The oracle runs under Node, where `console` exists.
excludeBranch("environment", /^(Settings\.(reportNonstrict|useStrictBehavior)|makeSymbol)$/,
	/^typeof console !== "undefined"$/, /^false$/, "console always exists");

// Settings (rehype-katex passes displayMode, throwOnError and strict only).
excludeBranch("settings", /^Settings\.(reportNonstrict|useStrictBehavior)$/, /^strict$/, /^false$/,
	"strict is 'warn' or 'ignore', never false");
excludeBranch("settings", /^(defineFunction\((html \\htmlClass|kern \\kern)\)\.handler|Parser\.parseSymbol)$/,
	/^(parser|this)\.settings\.strict$/, /^false$/, "strict is 'warn' or 'ignore', both truthy");
excludeBranch("settings", /^Parser\.parse$/, /^this\.settings\.globalGroup$/, /^true$/, "globalGroup is never set");
excludeBranch("strict", /^defineFunction\(cr \\\\\)\.(htmlBuilder|mathmlBuilder)$/, /^group\.newLine$/, /^false$/,
	"\\\\ in display mode keeps newLine unless strict is true");

// trust (default false): Anchors and 'enclosing' spans come only from
// trusted \href, \url and \html* commands.
excludeBranch("trust", /^(hasHtmlDomChildren|checkPartialGroup)$/,
	/^node instanceof Anchor$|^node\.hasClass\("enclosing"\)$/, /^true$/,
	"Anchors and 'enclosing' spans exist only when trusted");
excludeBranch("trust", /^_traverseNonSpaceNodes$/, /^next$/, /^false$/,
	"next is null only when recursing into a trusted partial group");

// Registry data, fixed when the module loads.
excludeBranch("data", /^getDefaultValue$/, /^schema\.default !== undefined$/, /^false$/,
	"no SETTINGS_SCHEMA entry declares default: undefined");
excludeBranch("data", /^Settings\.constructor$/, /^schema$/, /^false$/, "every SETTINGS_SCHEMA value is an object");
excludeBranch("data", /^defineSymbol$/, /^replace$/, /^false$/,
	"every symbol registered with acceptUnicodeChar has a replacement");
excludeBranch("data", /^(defineFunction|defineFunctionBuilders|defineEnvironment)$/,
	/^(type|htmlBuilder|mathmlBuilder)$/, /^false$/, "every registration supplies its type and builders");
excludeBranch("data", /^Parser\.handleInfixNodes$/, /^funcName$/, /^false$/, "every infix function has a replaceWith");
excludeBranch("data", /^Parser\.parseArguments$/, /^funcData\.primitive$/, /^false$/,
	"no function declares primitive: false");
excludeBranch("data", /^Parser\.parseSymbol$/, /^symbols\[this\.mode\]\[text\[0\]\]$/, /^true$/,
	"no precomposed character in unicodeSymbols is itself a symbol");

// Internal invariants.
excludeBranch("invariant", /^ParseError\.constructor$/, /^end != null$/, /^false$/, "start and end are set together");
excludeBranch("invariant", /^Settings\.isTrusted$/, /^context\.protocol$/, /^true$/, "no caller passes a protocol");
excludeBranch("invariant", /^sqrtPath$/, /^size$/, /^no case$/, "size is always one of the six sqrt images");
excludeBranch("invariant", /^defineFunction\(enclose \\colorbox\)\.mathmlBuilder/, /^group\.label$/, /^no case$/,
	"every enclose label has a case");
excludeBranch("invariant", /^validUnit$/, /^typeof unit !== "string"$/, /^false$/, "both callers pass a size node");
excludeBranch("invariant", /^cssStyleToString$/, /^value !== undefined$/, /^false$/,
	"style properties are only ever assigned strings");
excludeBranch("invariant", /^SymbolNode\.constructor$/, /^style$/, /^true$/, "no caller passes a style");
excludeBranch("invariant", /^wideCharacterFont$/, /^codePoint <= 0x1D7FF$|^codePoint < 0x1D7CE$/, /^false$/,
	"a pair starting with U+D835 is at most U+1D7FF (a lone U+D835 from \\char gives NaN, which fails the earlier tests)");
excludeBranch("invariant", /^mathsym$/, /^value === "\\\\"$/, /^true$/,
	"no atom, spacing symbol or op-name character is a lone backslash (unsupported commands render as textords)");
excludeBranch("invariant", /^boldSymbol$/, /^lookupSymbol\(value, "Math-BoldItalic", mode\)\.metrics$/, /^false$/,
	"every math-mode mathord has Math-BoldItalic metrics (via extraCharacterMap), and text mode never " +
		"has font boldsymbol (\\text, \\hbox and styling reset it)");
excludeBranch("invariant", /^makeOrd$/, /^mode === "text"$/, /^false$/, "the mode is math or text");
excludeBranch("invariant", /^canCombine$/, /^prev\.maxFontSize !== next\.maxFontSize$/, /^true$/,
	"SymbolNodes with equal classes were built at the same size (the sizing classes name it)");
excludeBranch("invariant", /^canCombine$/, /^cls === "mord"$/, /^true$/,
	"makeOrd always adds font classes; a lone mord comes only from bin cancellation, after combining");
excludeBranch("invariant", /^(makeText|getVariant)$/, /^symbols\[mode\]\[text\]\.replace$|^replacement$/, /^false$/,
	"only \\nobreak and \\allowbreak have an empty replacement, and MathML builds them as spacing nodes");
excludeBranch("invariant", /^isNumberPunctuation$/, /^_child instanceof TextNode$/, /^false$/,
	"punctuation <mo>s hold a TextNode");
excludeBranch("invariant", /^buildExpression$/, /^_group\.children\.length >= 1$/, /^false$/,
	"<msup>/<msub> always have a base");
excludeBranch("invariant", /^buildExpression$/, /^child\.text\.length > 0$/, /^false$/,
	"text in <mi>/<mo>/<mn> is never empty");
excludeBranch("invariant", /^stretchySvg\/buildSvgSpan_$/, /^'base' in group$/, /^false$/,
	"wide-accent labels belong to accent nodes, which always have a base");
excludeBranch("invariant", /^assertNodeType$|^defineFunction\(accent \\acute\)\.htmlBuilder/, /^node$|^grp$/, /^false$/,
	"never called with a missing node");
excludeBranch("invariant", /^getBaseSymbol$/, /^hasHtmlDomChildren\(group\)$|^group\.children\.length === 1$/, /^false$/,
	"a character-box base renders to a SymbolNode chain");
excludeBranch("invariant", /^binrelClass$|^defineEnvironment\(array align\)\.handler/, /^(arg|args\[0\])\.type === "ordgroup"$/,
	/^false$/, "arguments are always ordgroups (parseArgumentGroup)");
excludeBranch("invariant", /^makeSmallDelim$/, /^center$/, /^false$/, "every makeCustomSizedDelim caller centres");
excludeBranch("invariant", /^SourceLocation\.static range$/, /^first$/, /^false$/,
	"callers always pass a first token or node");
excludeBranch("invariant", /^parseArray$/,
	/^style$|^cell\.type === "styling"$|^cell\.body\.length === 1$|^cell\.body\[0\]\.type === "ordgroup"$/, /^false$/,
	"every parseArray caller passes a cell style, so each cell is a styling node around one ordgroup");
excludeBranch("invariant", /^defineEnvironment\(array array\)\.mathmlBuilder/, /^col\.type === "separator"$/, /^false$/,
	"column descriptions are align or separator");
excludeBranch("invariant", /^defineEnvironment\(array array\)\.mathmlBuilder/, /^group\.arraystretch$/, /^false$/,
	"arraystretch is always a positive number");
excludeBranch("invariant", /^delimFromValue$/, /^delimString\.length > 0$/, /^false$/, "atom text is never empty");
excludeBranch("invariant", /^defineFunction\(rule \\rule\)\.mathmlBuilder$/, /^options\.getColor\(\)$/, /^false$/,
	"getColor returns the (non-empty) color or 'transparent'");
excludeBranch("invariant", /^sizingGroup$/, /^inner\[i\]\.classes\[pos \+ 1\] === "reset-size" \+ options\.size$/, /^false$/,
	"a top-level element's sizing classes were computed from these same options");
excludeBranch("invariant", /^defineFunction\(smash \\smash\)\.htmlBuilder$/, /^node\.children$/, /^false$/,
	"node is a span, which always has children");
excludeBranch("invariant", /^Parser\.formLigatures$/, /^next$|^afterNext$/, /^false$/,
	"i < n (and i + 1 < n) keep group[i + 1] (and group[i + 2]) in range");

// Implicit decisions (regexes, min/max, sets, tables): `leaf` matches the
// sub-pattern (from the start of its alternative), the argument, the set
// member or `table["key"]`; `outcome` the label ("alternative N", "absent",
// "member …", "no match", "argument N decides", "has", "misses",
// "looked up"). fuzz-exclusions.mjs tests these rules too.
excludeBranch("settings", /./, /^options\.minRuleThickness\b/, /^argument 2 decides$/,
	"minRuleThickness is 0 (its default), below every default rule thickness");
excludeBranch("settings", /^calculateSize$/, /^options\.maxSize$/, /^argument 2 decides$/,
	"maxSize is Infinity (its default)");
excludeBranch("trust", /^<module>$/, /^\[\\s"'>\/=\\x00-\\x1f\]$/, /^member /,
	"invalidAttributeNameRegex only ever sees KaTeX's own attribute names; others come from trusted \\htmlData");
excludeBranch("invariant", /^stretchyMathML$/, /^\^\\\\$/, /^no match$/,
	"every stretchy label is a command name, starting with a backslash");
excludeBranch("invariant", /^(checkControlSequence|defineFunction\(internal \\def\)\.handler)$/, /^\[\\\\\{\}\$&#\^_\]$/,
	/^member "\\{4}"$/, "the lexer never yields a lone backslash (at the end of input or before a surrogate it throws)");
excludeBranch("data", /^defineFunction\(enclose \\colorbox\)\.htmlBuilder/, /^boxed$/, /^alternative 2$/,
	"no enclose label contains 'boxed': \\boxed is a macro for \\fbox");
excludeBranch("invariant", /^<module>$/, /^"\\\\[ij]math"$/, /^has$/,
	"\\imath and \\jmath are macros, so no MathML group has that text (see getVariant)");
excludeBranch("data", /^<module>$/, /^"\\\\surd"$/, /^has$/,
	"\\surd is no delimiter (checkDelimiter, \\genfrac's open/close atoms); \\sqrt draws its own sign");
excludeBranch("invariant", /^<module>$/, /^new Set\(\["\\\\uparrow"/, /^misses$/,
	"makeSizedDelim asks only for a delimiter checkDelimiter accepted that is not stack-large or stack-never");
excludeBranch("invariant", /^<module>$/, /^"(<|>|\\\\lt|\\\\gt)"$/, /^has$/,
	"makeSizedDelim and makeCustomSizedDelim turn <, >, \\lt and \\gt into \\langle and \\rangle first");
excludeBranch("data", /^<module>$/, /^fontMap\["textit"\]$/, /^looked up$/,
	"no command sets the math font 'textit' (\\textit sets the text font shape, \\it the math font mathit)");

// ---------------------------------------------------------------------------

/**
 * Child process: render every corpus pair; V8 writes coverage on exit. With
 * `probed`, also render each pair through the branch-probed copy of the
 * module, check that its output is identical, and write its counters to
 * `countsFile`.
 */
async function harness({ only, probed, countsFile }) {
	const { corpusPairs } = await import("./corpus.mjs");
	const { loadKatex, renderLikeRehype } = await import("./oracle.mjs");
	const { pairs } = corpusPairs({ only });
	const katex = await loadKatex();
	const probedKatex =
		probed === undefined ? undefined : (await import(pathToFileURL(probed).href)).default;
	let mismatches = 0;
	for (const { tex, display } of pairs) {
		const result = renderLikeRehype(katex, tex, display);
		if (probedKatex === undefined) continue;
		const again = renderLikeRehype(probedKatex, tex, display);
		if (JSON.stringify(again) !== JSON.stringify(result)) {
			if (mismatches++ < 5) {
				process.stderr.write(`branch-probed output differs for ${JSON.stringify(tex)} display=${display}\n`);
			}
		}
	}
	if (mismatches > 0) throw new Error(`branch-probed module diverged on ${mismatches} pair(s)`);
	if (probedKatex !== undefined) {
		const { probeCounts } = await import("./branches.mjs");
		fs.writeFileSync(countsFile, JSON.stringify(probeCounts()));
	}
	process.stderr.write(`rendered ${pairs.length} pairs\n`);
}

const PROBED = "katex-probed.mjs";
const BRANCH_COUNTS = "katex-branch-counts.json";

async function main() {
	const file = katexModulePath();
	const source = fs.readFileSync(file, "utf8");
	const acorn = await loadAcorn();
	const parsed = parseModule(acorn, source);
	const probes = findKatexProbes(parsed.ast, source);
	let dir = args.from;
	let cleanup = false;
	if (dir === undefined) {
		dir = args.dir ?? fs.mkdtempSync(path.join(os.tmpdir(), "katex-coverage-"));
		cleanup = args.dir === undefined;
		fs.mkdirSync(dir, { recursive: true });
		const probed = path.resolve(dir, PROBED);
		fs.writeFileSync(probed, instrument(source, probes));
		const child = spawnSync(
			process.execPath,
			[
				fileURLToPath(import.meta.url),
				"--harness",
				"--probed",
				probed,
				"--counts",
				path.resolve(dir, BRANCH_COUNTS),
				...(args.only === undefined ? [] : ["--only", args.only]),
			],
			{
				env: { ...process.env, NODE_V8_COVERAGE: path.resolve(dir) },
				stdio: ["ignore", "inherit", "inherit"],
			},
		);
		if (child.status !== 0) {
			throw new Error(`coverage harness failed (status ${child.status})`);
		}
	}
	const counts = readCounts(dir, pathToFileURL(file).href, source.length);
	const countsFile = path.join(dir, BRANCH_COUNTS);
	let branchCounts;
	if (fs.existsSync(countsFile)) {
		branchCounts = JSON.parse(fs.readFileSync(countsFile, "utf8"));
		if (branchCounts.length !== probes.slots) {
			throw new Error(`${countsFile}: ${branchCounts.length} counters, expected ${probes.slots}`);
		}
	}
	if (cleanup) fs.rmSync(dir, { recursive: true, force: true });
	const report = analyze(source, counts, parsed, probes, branchCounts);
	print(report);
	if (args.json !== undefined) {
		fs.writeFileSync(args.json, `${JSON.stringify(report, null, "\t")}\n`);
	}
}

// ---------------------------------------------------------------------------
// V8 coverage → per-character execution counts
// ---------------------------------------------------------------------------

/**
 * Per-UTF-16-unit execution counts for `url`, summed over every coverage
 * file in `dir`. Within one script, ranges are painted outermost first so
 * the innermost range decides a character's count (V8's nesting rule).
 */
function readCounts(dir, url, length) {
	const total = new Float64Array(length);
	let scripts = 0;
	for (const name of fs.readdirSync(dir).sort()) {
		if (!name.startsWith("coverage-") || !name.endsWith(".json")) continue;
		const data = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
		for (const script of data.result ?? []) {
			if (script.url !== url) continue;
			// internals.mjs evaluates a modified copy of the file under the
			// same name; only the module itself spans exactly `length`.
			const root = script.functions.find((fn) => fn.ranges[0].startOffset === 0);
			if (root?.ranges[0].endOffset !== length) continue;
			scripts++;
			const ranges = [];
			let order = 0;
			for (const fn of script.functions) {
				for (const range of fn.ranges) ranges.push({ ...range, order: order++ });
			}
			ranges.sort(
				(a, b) => a.startOffset - b.startOffset || b.endOffset - a.endOffset || a.order - b.order,
			);
			const counts = new Float64Array(length);
			for (const { startOffset, endOffset, count } of ranges) {
				counts.fill(count, startOffset, Math.min(endOffset, length));
			}
			for (let i = 0; i < length; i++) total[i] += counts[i];
		}
	}
	if (scripts === 0) {
		throw new Error(`no coverage for ${url} in ${dir} (was it loaded as an ES module?)`);
	}
	return total;
}

// ---------------------------------------------------------------------------
// Source structure: comments, functions and their descriptive names
// ---------------------------------------------------------------------------

const DEFINERS = new Set([
	"defineFunction",
	"defineFunctionBuilders",
	"defineEnvironment",
	"defineMacro",
]);

/** Visit every AST node below `node` (pre-order), with its parent chain. */
function walk(node, visit, parents = []) {
	visit(node, parents);
	parents.push(node);
	for (const key of Object.keys(node)) {
		if (key === "type" || key === "start" || key === "end") continue;
		const value = node[key];
		if (Array.isArray(value)) {
			for (const child of value) {
				if (child && typeof child.type === "string") walk(child, visit, parents);
			}
		} else if (value && typeof value.type === "string") {
			walk(value, visit, parents);
		}
	}
	parents.pop();
}

const isFunction = (node) =>
	node.type === "FunctionDeclaration" ||
	node.type === "FunctionExpression" ||
	node.type === "ArrowFunctionExpression";

const keyName = (key) =>
	key.type === "Identifier" ? key.name : key.type === "Literal" ? String(key.value) : "[computed]";

/** `defineFunction(genfrac \cfrac)`-style label for a define* call. */
function definerLabel(call) {
	const callee = call.callee.name;
	const [first] = call.arguments;
	if (callee === "defineMacro") {
		return `defineMacro(${first?.type === "Literal" ? first.value : "?"})`;
	}
	if (first?.type !== "ObjectExpression") return `${callee}(?)`;
	const prop = (name) => first.properties.find((p) => p.key && keyName(p.key) === name)?.value;
	const type = prop("type");
	const names = prop("names");
	const parts = [];
	if (type?.type === "Literal") parts.push(type.value);
	if (names?.type === "ArrayExpression" && names.elements[0]?.type === "Literal") {
		parts.push(names.elements[0].value);
	}
	return `${callee}(${parts.join(" ")})`;
}

/**
 * Parse the module: comment ranges and every function with a descriptive,
 * nesting-qualified name. Functions stored in top-level variables and then
 * passed to defineFunction & co. are named after that registration, e.g.
 * `defineFunction(accent \acute).htmlBuilder`.
 */
function parseModule(acorn, source) {
	const comments = [];
	const ast = acorn.parse(source, {
		ecmaVersion: "latest",
		sourceType: "module",
		onComment: (_block, _text, start, end) => comments.push([start, end]),
	});
	// Registrations of top-level function variables.
	const alias = new Map();
	walk(ast, (node) => {
		if (node.type !== "CallExpression" || node.callee.type !== "Identifier") return;
		if (!DEFINERS.has(node.callee.name)) return;
		const label = definerLabel(node);
		const [first, second] = node.arguments;
		if (node.callee.name === "defineMacro" && second?.type === "Identifier") {
			if (!alias.has(second.name)) alias.set(second.name, label);
		}
		if (first?.type !== "ObjectExpression") return;
		for (const prop of first.properties) {
			if (prop.value?.type === "Identifier" && prop.key) {
				const name = `${label}.${keyName(prop.key)}`;
				if (!alias.has(prop.value.name)) alias.set(prop.value.name, name);
			}
		}
	});
	const functions = [];
	walk(ast, (node, parents) => {
		if (!isFunction(node)) return;
		const parent = parents.at(-1);
		let local;
		let described = false;
		// Methods: V8's function range starts at the key, acorn's at `(`.
		let start = node.start;
		if (parent.type === "VariableDeclarator" && parent.id.type === "Identifier") {
			local = parent.id.name;
		} else if (node.id) {
			local = node.id.name;
		} else if (parent.type === "MethodDefinition") {
			const cls = parents.at(-3);
			const prefix = parent.static ? "static " : parent.kind === "get" || parent.kind === "set" ? `${parent.kind} ` : "";
			local = `${cls?.id?.name ?? "<class>"}.${prefix}${keyName(parent.key)}`;
			described = true;
			start = parent.start;
		} else if (parent.type === "Property") {
			local = keyName(parent.key);
			if (parent.method || parent.kind !== "init") start = parent.start;
			const call = parents.at(-2)?.type === "ObjectExpression" ? parents.at(-3) : undefined;
			if (call?.type === "CallExpression" && DEFINERS.has(call.callee?.name)) {
				local = `${definerLabel(call)}.${local}`;
				described = true;
			}
		} else if (parent.type === "AssignmentExpression") {
			local = source.slice(parent.left.start, parent.left.end);
		} else if (parent.type === "CallExpression" && DEFINERS.has(parent.callee?.name)) {
			local = definerLabel(parent);
			described = true;
		} else {
			local = `anon@L${lineAt(source, node.start)}`;
		}
		if (!described && alias.has(local)) local = `${alias.get(local)} (${local})`;
		const outer = [...parents].reverse().find(isFunction);
		const qualified = outer ? `${outer.qualified}/${local}` : local;
		node.qualified = qualified;
		functions.push({
			name: qualified,
			start,
			end: node.end,
			bodyStart: node.body.start,
		});
	});
	return { ast, comments, functions };
}

let lineStarts;
function lineAt(source, offset) {
	if (!lineStarts) {
		lineStarts = [0];
		for (let i = 0; i < source.length; i++) if (source[i] === "\n") lineStarts.push(i + 1);
	}
	let lo = 0;
	let hi = lineStarts.length - 1;
	while (lo < hi) {
		const mid = (lo + hi + 1) >> 1;
		if (lineStarts[mid] <= offset) lo = mid;
		else hi = mid - 1;
	}
	return lo + 1;
}
const colAt = (source, offset) => offset - lineStarts[lineAt(source, offset) - 1] + 1;

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

const NOISE = new Set([...")]};,"]);

function analyze(source, counts, parsed, probes, branchCounts) {
	const { comments, functions } = parsed;
	const length = source.length;
	// Character classes: 0 whitespace/comment, 1 noise, 2 significant.
	const kind = new Uint8Array(length);
	for (let i = 0; i < length; i++) {
		const ch = source[i];
		kind[i] = /\s/.test(ch) ? 0 : NOISE.has(ch) ? 1 : 2;
	}
	for (const [start, end] of comments) kind.fill(0, start, end);
	// Innermost function per character (pre-order painting).
	const owner = new Int32Array(length).fill(-1);
	functions.forEach((fn, index) => {
		owner.fill(index, fn.start, fn.end);
	});
	const nameOf = (index) => (index < 0 ? "<module>" : functions[index].name);
	const exclusionOf = (name, text) => {
		const flat = text.replace(/\s+/g, " ").trim();
		return EXCLUSIONS.find((rule) => rule.fn.test(name) && (!rule.text || rule.text.test(flat)));
	};

	// Regions: runs of uncovered significant characters in one function,
	// bridged over whitespace, comments, noise and other zero-count text.
	const regions = [];
	let current;
	for (let i = 0; i < length; i++) {
		if (kind[i] === 2 && counts[i] === 0) {
			if (current && current.owner === owner[i] && current.bridgeable) {
				current.end = i + 1;
			} else {
				current = { owner: owner[i], start: i, end: i + 1, bridgeable: true };
				regions.push(current);
			}
		} else if (current && kind[i] === 2 && counts[i] > 0) {
			current.bridgeable = false;
		} else if (current && owner[i] !== current.owner && kind[i] !== 0) {
			current.bridgeable = false;
		}
	}
	const described = regions.map(({ owner: index, start, end }) => {
		const name = nameOf(index);
		const text = source.slice(start, end);
		const rule = exclusionOf(name, text);
		return {
			function: name,
			start: { line: lineAt(source, start), column: colAt(source, start) },
			end: { line: lineAt(source, end - 1), column: colAt(source, end - 1) },
			excluded: rule ? `${rule.category}: ${rule.reason}` : null,
			text,
			offsets: [start, end],
		};
	});

	// Line metrics.
	const lineCount = lineAt(source, length - 1);
	const code = new Uint8Array(lineCount + 1);
	const uncoveredLine = new Uint8Array(lineCount + 1);
	for (let i = 0; i < length; i++) {
		if (kind[i] === 0) continue;
		const line = lineAt(source, i);
		code[line] = 1;
		if (kind[i] === 2 && counts[i] === 0) uncoveredLine[line] = 1;
	}
	const excludedLine = new Uint8Array(lineCount + 1);
	for (const region of described) {
		if (!region.excluded) continue;
		for (let line = region.start.line; line <= region.end.line; line++) excludedLine[line] = 1;
	}
	let codeLines = 0;
	let coveredLines = 0;
	let reachableLines = 0;
	let reachableCovered = 0;
	for (let line = 1; line <= lineCount; line++) {
		if (!code[line]) continue;
		codeLines++;
		if (!uncoveredLine[line]) coveredLines++;
		// A line is excluded only when all its uncovered code is excluded.
		const excluded = uncoveredLine[line] && excludedLine[line] &&
			!described.some((r) => !r.excluded && r.start.line <= line && r.end.line >= line);
		if (excluded) continue;
		reachableLines++;
		if (!uncoveredLine[line]) reachableCovered++;
	}

	// Function metrics.
	let executed = 0;
	let reachableFns = 0;
	let reachableExecuted = 0;
	const unexecuted = [];
	// A function that never ran is excluded when all of its own uncovered
	// regions are.
	const ownRegions = functions.map(() => []);
	regions.forEach(({ owner: index }, i) => {
		if (index >= 0) ownRegions[index].push(described[i]);
	});
	functions.forEach((fn, index) => {
		const ran = counts[fn.bodyStart] > 0;
		if (ran) executed++;
		else unexecuted.push(fn.name);
		const own = ownRegions[index];
		if (!ran && own.length > 0 && own.every((region) => region.excluded)) return;
		reachableFns++;
		if (ran) reachableExecuted++;
	});
	const branches =
		branchCounts === undefined
			? undefined
			: analyzeBranches(source, counts, probes, branchCounts, {
					owner,
					nameOf,
					regions,
					described,
				});
	return {
		file: path.relative(ROOT, katexModulePath()),
		lines: { code: codeLines, covered: coveredLines },
		reachableLines: { code: reachableLines, covered: reachableCovered },
		functions: { total: functions.length, executed },
		reachableFunctions: { total: reachableFns, executed: reachableExecuted },
		...(branches && {
			branches: branches.metrics.branches,
			implicit: Object.fromEntries(Object.values(IMPLICIT_KINDS).map((family) => [family, branches.metrics[family]])),
		}),
		unexecuted,
		regions: described,
		...(branches && { branchGaps: branches.gaps }),
	};
}

/**
 * Branch outcomes (branches.mjs probes) with a zero count. An outcome whose
 * code V8 already reports as an uncovered region (or whose probe sits in
 * one) is accounted to that region; the rest are branch gaps, matched
 * against BRANCH_EXCLUSIONS.
 */
function analyzeBranches(source, counts, { probes }, branchCounts, { owner, nameOf, regions, described }) {
	const regionAt = new Int32Array(source.length).fill(-1);
	regions.forEach(({ start, end }, index) => regionAt.fill(index, start, end));
	const flat = (start, end) => source.slice(start, end).replace(/\s+/g, " ").trim();
	const metrics = {};
	const gaps = [];
	for (const probe of probes) {
		const family = IMPLICIT_KINDS[probe.kind] ?? "branches";
		metrics[family] ??= { total: 0, covered: 0, unreachable: 0, inRegions: 0 };
		const m = metrics[family];
		const evaluated = probe.outcomes.some((_, i) => branchCounts[probe.slot + i] > 0);
		probe.outcomes.forEach((outcome, i) => {
			m.total++;
			if (branchCounts[probe.slot + i] > 0) {
				m.covered++;
				return;
			}
			// Already visible to block coverage?
			const at = !evaluated ? probe.start : outcome.code;
			if (at !== null && counts[at] === 0) {
				const region = regionAt[at];
				if (region >= 0) {
					m.inRegions++;
					if (described[region].excluded) m.unreachable++;
					return;
				}
				// Code made only of noise (the empty statement in `if (x) ;`,
				// which the CD arrow parser has) never forms a region, so block
				// coverage cannot see it: fall through and report a branch gap.
				if (!NOISE.has(source[at])) {
					throw new Error(`branch at offset ${at} has no region`);
				}
			}
			const name = nameOf(owner[probe.start]);
			const leafStart = outcome.labelStart ?? probe.start;
			const leafEnd = outcome.labelEnd ?? probe.end;
			const leaf = outcome.leafText ?? flat(leafStart, leafEnd);
			// A min/max call always decides something, unless its arguments tie.
			const label = evaluated || probe.kind === "min/max" ? outcome.label : "evaluated";
			const rule = BRANCH_EXCLUSIONS.find(
				(r) => r.fn.test(name) && r.leaf.test(leaf) && r.outcome.test(label),
			);
			if (rule) m.unreachable++;
			gaps.push({
				function: name,
				family,
				kind: probe.kind,
				at: { line: lineAt(source, leafStart), column: colAt(source, leafStart) },
				leaf,
				never: label,
				consequence: outcome.code === null ? outcome.why : "code that also runs for other outcomes",
				decision: flat(probe.root.start, probe.root.end),
				excluded: rule ? `${rule.category}: ${rule.reason}` : null,
				// Probe counters (branches.mjs) that would show the outcome.
				slots: evaluated || probe.kind === "min/max" ? [probe.slot + i] : probe.outcomes.map((_, k) => probe.slot + k),
			});
		});
	}
	for (const m of Object.values(metrics)) {
		m.reachable = m.total - m.unreachable;
		delete m.unreachable;
	}
	return { metrics, gaps };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const pct = (a, b) => `${((100 * a) / b).toFixed(2)}%`;
const span = (r) =>
	r.start.line === r.end.line
		? `L${r.start.line}:${r.start.column}-${r.end.column}`
		: `L${r.start.line}-${r.end.line}`;
const snippet = (text) => {
	const flat = text.replace(/\s+/g, " ").trim();
	return flat.length > 70 ? `${flat.slice(0, 67)}...` : flat;
};

function print(report) {
	const { lines, reachableLines, functions, reachableFunctions, branches, implicit, regions } = report;
	console.log(`${report.file}`);
	console.log(
		`  lines      ${lines.covered}/${lines.code} (${pct(lines.covered, lines.code)}); ` +
			`reachable ${reachableLines.covered}/${reachableLines.code} ` +
			`(${pct(reachableLines.covered, reachableLines.code)})`,
	);
	console.log(
		`  functions  ${functions.executed}/${functions.total} (${pct(functions.executed, functions.total)}); ` +
			`reachable ${reachableFunctions.executed}/${reachableFunctions.total} ` +
			`(${pct(reachableFunctions.executed, reachableFunctions.total)})`,
	);
	const outcomeLine = (name, m) =>
		console.log(
			`  ${name.padEnd(10)} ${m.covered}/${m.total} outcomes (${pct(m.covered, m.total)}); ` +
				`reachable ${m.covered}/${m.reachable} (${pct(m.covered, m.reachable)})`,
		);
	if (branches) {
		outcomeLine("branches", branches);
		for (const [name, m] of Object.entries(implicit)) if (m) outcomeLine(name, m);
	} else {
		console.log(`  branches   not measured (no ${BRANCH_COUNTS} in the coverage directory)`);
	}
	const remaining = regions.filter((r) => !r.excluded);
	const excluded = regions.filter((r) => r.excluded);
	console.log(`\nuncovered regions: ${remaining.length} remaining, ${excluded.length} excluded\n`);
	for (const [name, list] of groupBy(remaining, (r) => r.function)) {
		console.log(`${name}`);
		for (const region of list) console.log(`  ${span(region).padEnd(16)} ${snippet(region.text)}`);
	}
	if (branches) {
		const families = [["branches", "branch", branches], ...Object.entries(implicit).map(([f, m]) => [f, f, m])];
		for (const [family, title, m] of families) {
			if (!m) continue;
			const gaps = report.branchGaps.filter((g) => g.family === family);
			const open = gaps.filter((g) => !g.excluded);
			console.log(
				`\nuncovered ${title} outcomes: ${open.length} remaining, ${gaps.length - open.length} excluded ` +
					`(${m.inRegions} more belong to the uncovered regions)\n`,
			);
			for (const [name, list] of groupBy(open, (g) => g.function)) {
				console.log(`${name}`);
				for (const gap of list) console.log(`  ${branchLine(gap)}`);
			}
		}
	}
	console.log("\nexcluded regions (category: reason — regions, lines; functions):");
	printExcluded(excluded, (list) => {
		const lineTotal = list.reduce((sum, r) => sum + r.end.line - r.start.line + 1, 0);
		return `${list.length} region(s), ${lineTotal} line(s)`;
	}, (region) => `${span(region).padEnd(16)} ${region.function}: ${snippet(region.text)}`);
	if (branches) {
		console.log("\nexcluded branch and implicit outcomes (category: reason — outcomes; functions):");
		printExcluded(report.branchGaps.filter((g) => g.excluded), (list) => `${list.length} outcome(s)`,
			(gap) => `${gap.function}: ${branchLine(gap)}`);
		console.log("\nmodule-level objects not probed as tables:");
		for (const [name, reason] of TABLES_SKIPPED) console.log(`  ${name.padEnd(22)} ${reason}`);
	}
}

function groupBy(list, key) {
	const groups = new Map();
	for (const item of list) {
		if (!groups.has(key(item))) groups.set(key(item), []);
		groups.get(key(item)).push(item);
	}
	return groups;
}

const branchLine = (gap) =>
	`${`L${gap.at.line}:${gap.at.column}`.padEnd(16)} ${gap.kind} ${snippet(gap.leaf)} never ${gap.never}` +
	(gap.decision !== gap.leaf ? `  [in ${snippet(gap.decision)}]` : "");

function printExcluded(items, summary, detail) {
	let category;
	const byReason = groupBy(items, (item) => item.excluded);
	// Code-unit order (not localeCompare) keeps the report locale-independent.
	const category0 = (reason) => reason.split(":")[0];
	const byCategory = ([a], [b]) =>
		category0(a) < category0(b) ? -1 : category0(a) > category0(b) ? 1 : 0;
	for (const [reason, list] of [...byReason].sort(byCategory)) {
		const [head, ...rest] = reason.split(": ");
		if (head !== category) {
			category = head;
			console.log(`  ${category}`);
		}
		const names = [...new Set(list.map((item) => item.function))];
		console.log(`    ${rest.join(": ")} — ${summary(list)}`);
		if (args.excluded) {
			for (const item of list) console.log(`      ${detail(item)}`);
		} else {
			const shown = names.slice(0, 4).join(", ");
			console.log(`      ${shown}${names.length > 4 ? `, … (${names.length} functions)` : ""}`);
		}
	}
}

// ---------------------------------------------------------------------------

const { values: args } = parseArgs({
	options: {
		harness: { type: "boolean", default: false },
		probed: { type: "string" },
		counts: { type: "string" },
		only: { type: "string" },
		dir: { type: "string" },
		from: { type: "string" },
		excluded: { type: "boolean", default: false },
		json: { type: "string" },
	},
});

if (args.harness) {
	await harness({ only: args.only, probed: args.probed, countsFile: args.counts });
} else {
	await main();
}

// Systematic TeX cases for gen-katex-fixtures.mjs. Coverage is derived from
// the pinned katex@0.18.7's own registries (loadInternals(): _functions,
// _environments, _macros, symbols, delimiters, unicode tables, units…), so it
// tracks the real tables rather than a hand-kept list; hand-written parts
// supply arguments the registries cannot describe, one input per reachable
// `new ParseError(` site, and targeted sweeps (delimiter and radical heights,
// stretchy widths, units, colors, Unicode scripts, atom spacing), then a
// seeded random composition corpus. The coverage-round sections at the end
// reach the code in dist/katex.mjs the rest never executes, and the
// condition, regex, min/max, set and table outcomes it never produces (all
// measured with tools/katex/coverage.mjs).
//
// Each entry is a TeX string (rendered inline and in display mode) or
// `{ tex, display }` to pin one mode. Output is deterministic: iteration
// follows registry insertion order, and the only randomness is mulberry32
// with fixed seeds.
//
// Library for gen-katex-fixtures.mjs. Run directly from the repo root to
// print the per-section counts:
//   node writr-rs/tools/katex/katex-cases.mjs
import { pathToFileURL } from "node:url";
import { loadInternals } from "./internals.mjs";

const K = loadInternals();
const R = String.raw;
const F = K._functions;
const MACROS = K._macros;
const ENVS = K._environments;
const MATH = K.symbols.math;
const TEXT = K.symbols.text;

// ---------------------------------------------------------------------------
// Bookkeeping
// ---------------------------------------------------------------------------

/** The case list consumed by gen-katex-fixtures.mjs. */
export const cases = [];
/** [section name, number of entries] in emission order. */
export const sections = [];
const seen = new Set();

function section(name) {
	sections.push([name, 0]);
}

function emit(tex, display) {
	if (typeof tex !== "string") {
		throw new TypeError(`${sections.at(-1)[0]}: case is not a string`);
	}
	const key = `${display === undefined ? "*" : display ? "D" : "I"}${tex}`;
	if (seen.has(key)) return;
	seen.add(key);
	cases.push(display === undefined ? tex : { tex, display });
	sections.at(-1)[1]++;
}

/** Add cases rendered in both modes (arrays are flattened). */
const add = (...list) => {
	for (const tex of list.flat(Infinity)) emit(tex);
};
/** Add cases rendered inline only: for single-glyph sweeps and explicit
 * \textstyle/\scriptstyle combinations, where display mode would only
 * change the katex-display wrapper (keeps the corpus near its size budget). */
const addInline = (...list) => {
	for (const tex of list.flat(Infinity)) emit(tex, false);
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isWord = (token) => /^\\[a-zA-Z@]+$/.test(token);
/** `token` followed by a space when it is a control word, so it can be
 * concatenated with letters. */
const tok = (token) => (isWord(token) ? `${token} ` : token);
/** Shortest decimal for a rounded number. */
const num = (x) => String(Number(x.toFixed(4)));
const every = (list, step, offset = 0) =>
	list.filter((_, index) => index % step === offset);
function chunks(list, size) {
	const out = [];
	for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
	return out;
}
/** Join tokens, separating control words from what follows. */
const seq = (list) => list.map(tok).join("").trimEnd();
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
/** Nested fractions `depth` deep; heights grow with depth in both halves. */
const nestFrac = (depth) =>
	depth === 0 ? "x" : R`\frac{${nestFrac(depth - 1)}}{${nestFrac(depth - 1)}}`;
/** A zero-width rule of total height `h` em centred near the math axis. */
const strut = (h) => R`\rule[${num(0.25 - h / 2)}em]{0pt}{${num(h)}em}`;
const fromCodePoints = (lo, hi, step = 1) => {
	const out = [];
	for (let cp = lo; cp <= hi; cp += step) {
		if (cp >= 0xd800 && cp <= 0xdfff) continue;
		out.push(String.fromCodePoint(cp));
	}
	return out;
};

// Registry-derived name lists shared by several sections. Names with two
// leading backslashes (e.g. `\\cdrightarrow`) are internal: the lexer can
// never produce them, so they are only reachable through other commands.
const fnNames = Object.keys(F).filter((name) => !/^\\\\[a-zA-Z]/.test(name));
const fnOfType = (...types) => fnNames.filter((name) => types.includes(F[name].type));
const mathFonts = [
	...fnNames.filter((name) => F[name].type === "font" && F[name].numArgs === 1),
	R`\boldsymbol`,
	R`\bm`,
	R`\pmb`,
];
const oldFonts = fnNames.filter((name) => F[name].type === "font" && F[name].numArgs === 0);
const textFonts = fnOfType("text").filter((name) => F[name].numArgs === 1);
const mathAccents = fnNames.filter(
	(name) => F[name].type === "accent" && !F[name].argTypes,
);
const textAccents = fnNames.filter(
	(name) => F[name].type === "accent" && F[name].argTypes?.[0] === "primitive",
);
const underAccents = fnOfType("accentUnder");
const stretchyAccents = [...mathAccents, ...underAccents].filter((name) =>
	Object.hasOwn(K.stretchyCodePoint, name.slice(1)),
);
const xArrows = fnOfType("xArrow");
const ops = fnOfType("op").filter((name) => F[name].numArgs === 0);
const delimSizing = Object.keys(K.delimiterSizes);
const delimiters = [...K.delimiters];
const units = [...Object.keys(K.ptPerUnit), ...Object.keys(K.relativeUnit)];
const styles = [R`\displaystyle`, R`\textstyle`, R`\scriptstyle`, R`\scriptscriptstyle`];
const sizes = [...K.sizeFuncs];
const mathKeys = Object.keys(MATH);
const textKeys = Object.keys(TEXT);
const ALNUM = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"];
const defined = (name) => Object.hasOwn(MATH, name) || Object.hasOwn(MACROS, name);
const greek = (names) =>
	seq(names.split(" ").map((name) => `\\${name}`).filter(defined));
const GREEK_LOWER = greek(
	"alpha beta gamma delta epsilon varepsilon zeta eta theta vartheta iota kappa varkappa lambda mu nu xi omicron pi varpi rho varrho sigma varsigma tau upsilon phi varphi chi psi omega digamma",
);
const GREEK_UPPER = greek(
	"Gamma Delta Theta Lambda Xi Pi Sigma Upsilon Phi Psi Omega varGamma varDelta varOmega",
);
/** A few symbols per symbol group, for the font and script sweeps. */
const repMath = (() => {
	const byGroup = new Map();
	for (const key of mathKeys) {
		const group = MATH[key].group;
		if (group === "spacing" || group === "accent-token") continue;
		if (/[\uD800-\uDFFF]/.test(key)) continue; // wide chars have their own section
		if (!byGroup.has(group)) byGroup.set(group, []);
		byGroup.get(group).push(key);
	}
	const out = [];
	for (const list of byGroup.values()) {
		out.push(...every(list, Math.max(1, Math.ceil(list.length / 24))));
	}
	return out;
})();

// ---------------------------------------------------------------------------
// 1. Functions: every name in _functions, with arguments built from its
//    numArgs/numOptionalArgs/argTypes (or a hand-written override), in
//    context, with scripts, in script style, as a script argument, in text
//    mode (a mode error where not allowedInText), and with missing arguments.
// ---------------------------------------------------------------------------
section("functions");

const SAMPLE = {
	color: ["blue", "#c0f", "red"],
	size: ["0.5em", "3pt", "1ex"],
	url: ["https://katex.org/"],
	raw: ["foo"],
	hbox: ["box"],
	text: ["text"],
	math: ["x", "y", "z", "u", "v", "w"],
};
const OPTIONAL_SAMPLE = { size: "0.2em", raw: "b", math: "b" };

function argFor(spec, index) {
	const type = spec.argTypes?.[index];
	if (type === "primitive") return spec.type === "delimsizing" ? "(" : "{a}";
	const pool = SAMPLE[type] ?? SAMPLE.math;
	return `{${pool[index % pool.length]}}`;
}

function genericInvocations(name, spec) {
	const optional = spec.numOptionalArgs ?? 0;
	const required = [];
	for (let i = optional; i < optional + spec.numArgs; i++) {
		required.push(argFor(spec, i));
	}
	if (spec.numArgs === 0 && optional === 0) return [`${tok(name)}x`];
	const out = [`${name}${required.join("")}`];
	if (optional > 0) {
		const type = spec.argTypes?.[0];
		out.push(`${name}[${OPTIONAL_SAMPLE[type] ?? "b"}]${required.join("")}`);
	}
	return out;
}

/** Hand-written invocations (the first one valid, used for the derived
 * contexts) for functions the generic argument builder cannot express. */
const FUNCTION_USAGE = {
	"\\\\": [R`a\\b`, R`a\\[1em]b`, R`a\\[-2pt]b`, R`a\\`, R`\\`],
	"\\@char": [R`\@char{65}`, R`\@char{8364}`, R`\@char{128512}`],
	"\\color": [R`\color{blue} x y`, R`a {\color{#c0f} b} c`],
	"\\global": [
		R`\global\def\x{a}\x`,
		R`\global\long\def\x{c}\x`,
		R`\global\let\x=y\x`,
		R`\global\edef\x{a}\x`,
		R`{\global\def\x{g}}\x`,
		R`{\def\x{l}}\x`,
	],
	"\\long": [R`\long\def\x#1{#1}\x{b}`, R`\long\global\def\x{c}\x`],
	"\\def": [
		R`\def\x{a}\x`,
		R`\def\x#1{[#1]}\x{b}`,
		R`\def\x#1#2{#2#1}\x ab`,
		R`\def\x#1.{(#1)}\x abc.`,
		R`\def\x#1#{[#1]}\x a{b}`,
		R`\def\x#1#2#3#4#5#6#7#8#9{#9#8#7#6#5#4#3#2#1}\x123456789`,
		R`\def\x{##}\x`,
		R`\def\x#1{#1##}\x a`,
		R`\def\foo{\bar}\def\bar{c}\foo`,
		R`\def\x{\frac}\x12`,
	],
	"\\gdef": [R`\gdef\x{a}\x`, R`{\gdef\x{a}}\x`],
	"\\edef": [
		R`\def\a{x}\edef\b{\a\a}\def\a{y}\b`,
		R`\edef\x{\alpha}\x`,
		R`\def\a{1}\edef\a{\a\a}\edef\a{\a\a}\a`,
	],
	"\\xdef": [R`{\def\a{x}\xdef\b{\a}}\b`],
	"\\let": [
		R`\let\x=\alpha\x`,
		R`\let\x\alpha\x`,
		R`\let\x= \alpha \x`,
		R`\let\x=a\x`,
		R`\let\x={\x b}`,
		R`\def\a{x}\let\b\a\def\a{y}\b\a`,
		R`\let\bgroup={\bgroup a}`,
	],
	"\\futurelet": [R`\futurelet\x\y z\x`, R`\def\y{[\x]}\futurelet\x\y z`],
	"\\left": [R`\left( x \right)`, R`\left. x \right|`, R`\left\{ \frac{a}{b} \right\}`],
	"\\right": [R`\left[ x \right]`, R`\left( x \right.`],
	"\\middle": [R`\left( a \middle| b \right)`, R`\left\{ x \middle\| y \middle/ z \right.`],
	"\\hline": [R`\begin{array}{c}\hline a\\\hline b\end{array}`],
	"\\hdashline": [R`\begin{array}{c}\hdashline a\\\hdashline b\end{array}`],
	"\\begin": [R`\begin{matrix} a \end{matrix}`],
	"\\end": [R`\begin{pmatrix} a & b \end{pmatrix}`],
	"\\genfrac": [
		R`\genfrac(){1pt}{0}{a}{b}`,
		R`\genfrac[]{0pt}{1}{a}{b}`,
		R`\genfrac{}{}{}{}{a}{b}`,
		R`\genfrac\{\}{2pt}{2}{a}{b}`,
		R`\genfrac..{0.4pt}{3}{a}{b}`,
		R`\genfrac(]{}{}{n}{k}`,
		R`\genfrac\langle\rangle{1em}{}{a}{b}`,
	],
	"\\over": [R`a \over b`, R`{a \over b} c`, R`1+a \over b+2`, R`\frac{a \over b}{c}`],
	"\\choose": [R`n \choose k`, R`{n+1 \choose k} x`],
	"\\atop": [R`a \atop b`, R`{a \atop b}`],
	"\\brace": [R`a \brace b`, R`{n \brace k}`],
	"\\brack": [R`a \brack b`, R`{n \brack k}`],
	"\\above": [R`a \above 1pt b`, R`a \above{2pt} b`, R`{1\above0.5em 2}`],
	"\\href": [R`\href{https://katex.org/}{\KaTeX}`],
	"\\includegraphics": [
		R`\includegraphics[height=0.8em, totalheight=0.9em, width=0.9em, alt=KA logo]{https://katex.org/img/khan-academy.png}`,
		R`\includegraphics{https://katex.org/img/khan-academy.png}`,
	],
	"\\htmlClass": [R`\htmlClass{foo}{x}`],
	"\\htmlId": [R`\htmlId{bar}{x}`],
	"\\htmlStyle": [R`\htmlStyle{color: red;}{x}`],
	"\\htmlData": [R`\htmlData{foo=a, bar=b}{x}`],
	"\\html@mathml": [R`\html@mathml{a}{b}`],
	"\\(": [R`\text{a \(x^2\) b}`, R`\(x\)`],
	$: [R`\text{a $x^2$ b}`, R`\text{$a$$b$}`, R`\text{$\frac{1}{2}$}`, R`$x$`],
	"\\)": [R`\)`, R`\text{\)}`],
	"\\]": [R`a\]`, R`\text{\]}`],
	"\\mathchoice": [R`\mathchoice{D}{T}{S}{SS}`],
	"\\@binrel": [R`\@binrel{+}{x}`, R`\@binrel{=}{\star}`, R`\@binrel{a}{\star}`],
	"\\stackrel": [R`\stackrel{!}{=}`, R`\stackrel{\text{def}}{\longrightarrow}`],
	"\\overset": [R`\overset{a}{=}`, R`\overset{\frown}{AB}`],
	"\\underset": [R`\underset{a}{=}`, R`\underset{n\to\infty}{\lim}`],
	"\\raisebox": [R`\raisebox{0.25em}{b}`, R`\raisebox{-1ex}{\(x^2\)}`],
	"\\smash": [R`\smash{y}`, R`\smash[t]{y}`, R`\smash[b]{y}`, R`\smash[tb]{y}`, R`\smash[x]{y}`],
	"\\sqrt": [R`\sqrt{x}`, R`\sqrt[3]{x}`],
	"\\verb": [R`\verb|x|`, R`\verb*|a b|`],
	"\\vcenter": [R`\vcenter{\hbox{x}}`, R`a\vcenter{\frac{1}{2}}b`],
	"\\hbox": [R`\hbox{text $x$}`],
	"\\overbrace": [R`\overbrace{a+b}^{n}`, R`\overbrace{a+b}`],
	"\\underbrace": [R`\underbrace{a+b}_{n}`, R`\underbrace{a+b}`],
	"\\overbracket": [R`\overbracket{a+b}^{n}`],
	"\\underbracket": [R`\underbracket{a+b}_{n}`],
	"\\mathop": [R`\mathop{x}`, R`\mathop{\sum}`, R`\mathop{x}_a^b`],
	"\\operatornamewithlimits": [R`\operatornamewithlimits{f}_a^b`],
	"\\relax": [R`a\relax b`, R`x^\relax2`],
	"\\kern": [R`a\kern1em b`, R`a\kern{0.5em}b`],
	"\\mkern": [R`a\mkern18mu b`],
	"\\mskip": [R`a\mskip 6mu b`],
	"\\hskip": [R`a\hskip 1em b`],
};

const bracedMissingTypes = new Set();
for (const name of fnNames) {
	const spec = F[name];
	const valid = FUNCTION_USAGE[name] ?? genericInvocations(name, spec);
	add(valid);
	const first = valid[0];
	add(
		`a ${first} b`,
		`${first}^{2}`,
		R`\scriptstyle ${first}`,
		`x^${first}`,
		// Text mode: valid where allowedInText, otherwise the mode error.
		R`\text{${first}}`,
	);
	if (spec.allowedInText) add(R`\text{a ${first} b}`);
	if (name === "\\verb") continue;
	const arity = spec.numArgs + (spec.numOptionalArgs ?? 0);
	if (arity > 0 || spec.type === "leftright" || spec.type === "environment") {
		add(name);
		if (spec.numArgs >= 2) add(`${name}{x}`);
		// `{\name}` fails in the gullet ("Extra }") the same way for every
		// function of a type; once per type is enough.
		if (!bracedMissingTypes.has(spec.type)) {
			bracedMissingTypes.add(spec.type);
			add(`{${name}}`);
		}
	}
}

// ---------------------------------------------------------------------------
// 2. Environments: every entry in _environments with small bodies, column
//    specs, rules, row gaps, tags, \cr, nesting and errors; then CD.
// ---------------------------------------------------------------------------
section("environments");

const ENV_ARGS = {
	array: [
		"{cc}", "{c}", "{lcr}", "{|c|c|}", "{l|c:r}", "{c||c}", "{::c::}", "{ l c }",
		"{}", "{@{}c@{}}", "{x}", "{p{1cm}}", "{*{2}{c}}", "{c|}", "{|}", "c",
	],
	subarray: ["{c}", "{l}", "{r}", "{cc}", "{}"],
	alignat: ["{2}", "{1}", "{3}", "{0}", "{a}", "{ 2 }", "{-1}", "{12}", "{}"],
};
ENV_ARGS.darray = ENV_ARGS.array;
ENV_ARGS["alignat*"] = ENV_ARGS.alignat;
ENV_ARGS.alignedat = ENV_ARGS.alignat;
const STAR_MATRIX_ARGS = ["", "[l]", "[r]", "[c]", "[x]", "[ r ]", "[]"];

const ENV_BODIES = [
	"a",
	R`a & b \\ c & d`,
	R`a & b & c \\ d & e & f \\ g & h & i`,
	R`\frac{1}{2} & x^2 \\ \sqrt{y} & \sum_{i=1}^n i`,
	R`a \\ b \\`,
	R`a & b \\[2pt] c & d`,
	R`a & b \\[-1ex] c & d`,
	R`a & b \\ [1em] c & d`,
	R`\hline a & b \\ \hline c & d \\ \hline`,
	R`\hdashline a & b \\ \hdashline c & d`,
	R`\hline\hline a \\ \hline\hdashline b`,
	R`a & b \cr c & d`,
	R` & \\ & `,
	"",
	R`a & b & c & d & e & f & g & h & i & j & k & l`,
	R`a &= b \\ &= c \tag{1} \\ &= d \notag \\ &= e \nonumber`,
	R`\begin{matrix} p & q \\ r & s \end{matrix} & t`,
	R`\text{text} & \mathrm{rm}`,
	R`\left( \frac{a}{b} \right) & \big| x`,
	R`x &= y \\ &\quad + z`,
];

const CD_CASES = [
	R`\begin{CD} A @>a>> B \\ @VbVV @AAcA \\ C @= D \end{CD}`,
	R`\begin{CD} A @<<< B @>>> C \\ @. @| @VVV \\ @. D @<<< E \end{CD}`,
	R`\begin{CD} A @>{\text{long label}}>{below}> B \end{CD}`,
	R`\begin{CD} A @= B @| C \end{CD}`,
	R`\begin{CD} A @V{a}V{b}V B \end{CD}`,
	R`\begin{CD} A @A{\frac{1}{2}}AA B \\ @VVV \end{CD}`,
	R`\begin{CD} \mathbb{Z} @>\times 2>> \mathbb{Z} @>>> \mathbb{Z}/2 \end{CD}`,
	R`\begin{CD} A \end{CD}`,
	R`\begin{CD}\end{CD}`,
	R`\begin{CD} A @>>> B \\ \end{CD}`,
	R`\begin{CD} A \cr B \end{CD}`,
	R`\begin{CD} A & B \end{CD}`,
	R`\begin{CD} A @. B \end{CD}`,
	// Errors: missing arrow terminator, arrow inside a label, bad arrow
	// character, stray } in a row.
	R`\begin{CD} A @>a B \end{CD}`,
	R`\begin{CD} A @>a @>b> B \end{CD}`,
	R`\begin{CD} A @x B \end{CD}`,
	R`\begin{CD} A @ \end{CD}`,
	R`\begin{CD}a}\end{CD}`,
	R`\text{\begin{CD} A \end{CD}}`,
];

for (const [name, env] of Object.entries(ENVS)) {
	if (name === "CD") {
		add(CD_CASES);
		continue;
	}
	let args;
	if (env.numArgs > 0) {
		args = ENV_ARGS[name];
		if (!args) throw new Error(`katex-cases: no argument samples for {${name}}`);
	} else {
		args = name.endsWith("matrix*") ? STAR_MATRIX_ARGS : [""];
	}
	const wrap = (arg, body) => R`\begin{${name}}${arg} ${body} \end{${name}}`;
	for (const body of ENV_BODIES) add(wrap(args[0], body));
	for (const arg of args.slice(1)) {
		add(wrap(arg, R`a & b \\ c & d`), wrap(arg, "a"));
	}
	add(
		R`\left( ${wrap(args[0], R`a & b \\ c & d`)} \right)`,
		R`x^{${wrap(args[0], R`a \\ b`)}}`,
		R`\text{${wrap(args[0], "a")}}`,
		// Missing and mismatched \end.
		R`\begin{${name}}${args[0]} a & b`,
		R`\begin{${name}}${args[0]} a \end{${name === "matrix" ? "pmatrix" : "matrix"}}`,
		R`\end{${name}}`,
	);
}

add(
	R`\def\arraystretch{1.5}\begin{matrix}a\\b\end{matrix}`,
	R`\def\arraystretch{0.5}\begin{array}{c}a\\b\end{array}`,
	R`\def\arraystretch{0}\begin{matrix}a\end{matrix}`,
	R`\def\arraystretch{-1}\begin{matrix}a\end{matrix}`,
	R`\def\arraystretch{abc}\begin{matrix}a\end{matrix}`,
	R`\newcommand{\arraystretch}{2}\begin{pmatrix}1&0\\0&1\end{pmatrix}`,
	R`\color{red}\begin{matrix}a&b\\c&d\end{matrix}`,
	R`\begin{matrix}\color{red}a & b\end{matrix}`,
	R`\begin{aligned} a &= b + c \\ &= d \end{aligned}`,
	R`\begin{align} a &= b \tag{1} \\ c &= d \tag*{(*)} \\ e &= f \notag \\ g &= h \end{align}`,
	R`\begin{align} a &= b \tag{1} \tag{2} \end{align}`,
	R`\begin{gather} a \\ b \tag{x} \\ c \nonumber \end{gather}`,
	R`\begin{equation} E = mc^2 \tag{E} \end{equation}`,
	R`\begin{equation} \begin{split} a &= b \\ &= c \end{split} \end{equation}`,
	R`\begin{equation*} a \\ b \end{equation*}`,
	R`\begin{align*} x &= 1 & y &= 2 \\ z &= 3 & w &= 4 \end{align*}`,
	R`\begin{alignat}{2} x &= 1 & \quad y &= 2 \end{alignat}`,
	R`\begin{alignat}{1} a & b & c & d \end{alignat}`,
	R`\begin{alignedat}{2} a &= b & c &= d \\ e &= f & g &= h \end{alignedat}`,
	R`\begin{cases} x & \text{if } x > 0 \\ -x & \text{otherwise} \end{cases}`,
	R`f(x) = \begin{dcases} \frac{1}{2} & x < 0 \\ 0 & x \ge 0 \end{dcases}`,
	R`\begin{rcases} a \\ b \end{rcases} \Rightarrow c`,
	R`\begin{drcases} \frac{a}{b} \\ c \end{drcases}`,
	R`\sum_{\begin{subarray}{l} i \in \Lambda \\ 0 < j < n \end{subarray}} P(i,j)`,
	R`\begin{array}{c|c} a & b \\ \hline c & d \end{array}`,
	R`\begin{array}{cc} a & b \\ c & d & e \end{array}`,
	R`\begin{matrix} a \\ \hline b \end{matrix}`,
	R`\begin{matrix} a \hline b \end{matrix}`,
	R`\begin{matrix}\end{matrix}`,
	R`\begin{pmatrix}\begin{pmatrix}a\end{pmatrix}\end{pmatrix}`,
	R`\begin{foo} a \end{foo}`,
	R`\begin x`,
	R`\begin{matrix} a } \end{matrix}`,
	R`\begin{equation} a & b \end{equation}`,
	R`\begin{split} a & b & c \end{split}`,
	R`\frac{\begin{matrix} a \\ b \end{matrix}}{c}`,
	R`\begin{matrix} a \\[1em] b \\[-0.5em] c \\[0pt] d \end{matrix}`,
	R`\begin{matrix} a \\[1xx] b \end{matrix}`,
	R`\begin{matrix} a \\[x] b \end{matrix}`,
	R`\begin{array}{c} a \cr b \cr \end{array}`,
	R`\begin{array}{:c:} \hdashline a \\ \hdashline \end{array}`,
	R`\begin{array}{|l|} \hline \text{long cell content} \\ \hline x \\ \hline \end{array}`,
	R`\begin{Vmatrix} a \end{Vmatrix}^{2}`,
	R`\begin{bmatrix} 1 & 2 & 3 \\ 4 & 5 & 6 \end{bmatrix}^{\top}`,
	R`\begin{pmatrix} a_{11} & \cdots & a_{1n} \\ \vdots & \ddots & \vdots \\ a_{m1} & \cdots & a_{mn} \end{pmatrix}`,
	R`\scriptstyle \begin{matrix} a & b \\ c & d \end{matrix}`,
	R`\Huge \begin{pmatrix} a \\ b \end{pmatrix}`,
	R`\tiny \begin{array}{|c|} \hline a \\ \hline \end{array}`,
	R`\begin{gathered} a = b \\ \frac{c}{d} = e \end{gathered}`,
	R`\begin{matrix} \verb|&| & b \end{matrix}`,
	R`\begin{matrix} {a & b} \end{matrix}`,
	R`\begin{array}{c} \begin{array}{c} a \\ b \end{array} \\ c \end{array}`,
);

// ---------------------------------------------------------------------------
// 3. Macros: every entry in _macros. String macros get as many braced
//    arguments as their body references; JavaScript macros (\char,
//    \newcommand, \dots, …) have hand-written cases, and a new one fails
//    loudly here.
// ---------------------------------------------------------------------------
section("macros");

const CHAR_CASES = [
	R`\char65`, R`\char 65`, R`\char"41`, R`\char"7b`, R`\char"7B`, R`\char'101`,
	"\\char`A", "\\char`\\%", "\\char`\\\\", "\\char`\\alpha", R`\char98c`,
	R`\char"1F600`, R`\char0`, R`\char"10FFFF`, R`\char"110000`, R`\char"D800`,
	R`\char"G`, R`\char'8`, R`\char`, "\\char`", R`\char x`, R`\text{\char"263A}`,
	R`\char"3C`, R`\char"26`, R`\char"22`, R`\char"27`, R`\char"20`, R`\char"A0`,
	R`\mathbf{\char"41}`, R`\char"41^2`, R`\char'777`, R`\char"FFFF`, R`\char123456789`,
];

const DOTS_FOLLOWERS = [
	...Object.keys(K.dotsByToken),
	...Object.keys(K.spaceAfterDots),
	"x", R`\alpha`, R`\le`, R`\cdot`, R`\notin`, R`\int`, R`\DOTSI`, R`\DOTSX`, "",
];
function dotsIn(dots, follower) {
	if (follower === R`\right`) return R`\left( a ${dots}\right)`;
	if (follower === "$") return R`\text{$a${dots}$}`;
	if (/^\\[bB]igg?r$/.test(follower)) return R`${follower.slice(0, -1)}l( a ${dots}${follower})`;
	return `a ${dots}${follower ? ` ${follower} b` : ""}`;
}
const dotsCases = (dots, followers) => followers.map((f) => dotsIn(dots, f));
const SPACE_FOLLOWERS = [...Object.keys(K.spaceAfterDots), "x", ",", ""];

/** Hand-written cases for macros implemented in JavaScript. */
const FUNCTION_MACRO_CASES = {
	"\\noexpand": [
		R`\def\a{x}\noexpand\a`,
		R`\def\a{x}\edef\b{\noexpand\a}\def\a{y}\b`,
		R`\noexpand x`,
		R`\noexpand`,
	],
	"\\expandafter": [
		R`\def\a{x}\expandafter\def\expandafter\b\expandafter{\a}\b`,
		R`\expandafter\frac\expandafter{1}{2}`,
		R`\def\a#1{[#1]}\def\b{c}\expandafter\a\b`,
		R`\expandafter`,
		R`\expandafter x`,
	],
	"\\@firstoftwo": [R`\@firstoftwo{a}{b}`, R`\@firstoftwo{a}`],
	"\\@secondoftwo": [R`\@secondoftwo{a}{b}`, R`\@secondoftwo`],
	"\\@ifnextchar": [
		R`\@ifnextchar[{A}{B}[`,
		R`\@ifnextchar x{Y}{N}x`,
		R`\@ifnextchar x{Y}{N}y`,
		R`\@ifnextchar x{Y}{N}`,
		R`\@ifnextchar\alpha{Y}{N}\alpha`,
	],
	"\\TextOrMath": [
		R`\TextOrMath{t}{m}`,
		R`\text{\TextOrMath{t}{m}}`,
		R`\TextOrMath{\text{t}}{m}^{2}`,
		R`\TextOrMath{t}`,
	],
	"\\char": CHAR_CASES,
	"\\newcommand": [
		R`\newcommand\foo{x}\foo`,
		R`\newcommand{\foo}{x}\foo`,
		R`\newcommand\foo[1]{[#1]}\foo{a}`,
		R`\newcommand\foo[2]{#2#1}\foo ab`,
		R`\newcommand\foo[ 2 ]{#2#1}\foo ab`,
		R`\newcommand\alpha{x}`,
		R`\newcommand{ab}{x}`,
		R`\newcommand{}{x}`,
		R`\newcommand\foo[a]{x}`,
		R`\newcommand\foo[1]`,
		R`\newcommand\foo{x}\newcommand\foo{y}\foo`,
		R`\newcommand\foo{\foo}\foo`,
	],
	"\\renewcommand": [
		R`\renewcommand\alpha{A}\alpha`,
		R`\renewcommand\foo{x}`,
		R`\renewcommand\arraystretch{2}\begin{matrix}a\\b\end{matrix}`,
		R`\renewcommand{\frac}[2]{#1/#2}\frac{a}{b}`,
	],
	"\\providecommand": [
		R`\providecommand\foo{x}\foo`,
		R`\providecommand\alpha{x}\alpha`,
	],
	"\\message": [R`\message{hello}x`, R`\message`],
	"\\errmessage": [R`\errmessage{oops}x`],
	"\\show": [R`\show\alpha x`, R`\show`],
	"\\dots": [
		...dotsCases(R`\dots`, DOTS_FOLLOWERS),
		R`a_1, \dots, a_n`,
		R`a_1 + \dots + a_n`,
		R`\text{a\dots b}`,
	],
	"\\dotso": dotsCases(R`\dotso`, SPACE_FOLLOWERS),
	"\\dotsc": dotsCases(R`\dotsc`, SPACE_FOLLOWERS),
	"\\cdots": dotsCases(R`\cdots`, SPACE_FOLLOWERS),
	"\\tag@literal": [R`x\tag@literal{7}`],
	"\\bra@ket": [
		R`\bra@ket{\left\langle}{\,\middle\vert\,}{\,\middle\Vert\,}{\right\rangle}{a|b||c}`,
		R`\bra@ket{[}{|}{}{]}{a|b}`,
	],
	"\\bra@set": [R`\bra@set{\{}{\mid}{}{\}}{x|x|y}`],
};

/** Usage for string macros the generic "name{a}{b}…" call does not reach. */
const MACRO_USAGE = {
	"\\operatorname": [
		R`\operatorname{sn} x`,
		R`\operatorname*{sn}_a^b`,
		R`\operatorname{sn}_a^b`,
	],
	"\\@ifstar": [R`\@ifstar{A}{B}*x`, R`\@ifstar{A}{B}x`],
	"\\hspace": [R`a\hspace{1em}b`, R`a\hspace*{1em}b`, R`\text{a\hspace{2em}b}`],
	"\\@hspace": [R`a\@hspace{1em}b`],
	"\\@hspacer": [R`a\@hspacer{1em}b`],
	"\\tmspace": [R`a\tmspace+{3mu}{.1667em}b`, R`\text{a\tmspace-{3mu}{.1667em}b}`],
	"\\tag": [R`x \tag{1}`, R`x \tag*{A}`, R`x \tag{\alpha}`, R`x \tag{}`, R`x \tag 1`],
	"\\tag@paren": [R`x\tag@paren{2}`],
	"\\substack": [R`\sum_{\substack{0<i<m\\0<j<n}} P(i,j)`, R`\substack{a}`],
	"\\nonumber": [R`\begin{align}a\nonumber\\b\end{align}`, R`x\nonumber`],
	"\\notag": [R`\begin{gather}a\notag\\b\end{gather}`, R`x\notag`],
	"\\bgroup": [R`\bgroup a \egroup^2`, R`\bgroup a`],
	"\\egroup": [R`a\egroup`],
	"\\Braket": [
		R`\Braket{ \phi | \frac{\partial^2}{\partial t^2} | \psi }`,
		R`\Braket{a||b}`,
	],
	"\\Set": [R`\Set{ x \in \mathbb{R}^2 | 0<{|x|}<5 }`, R`\Set{a||b}`],
	"\\set": [R`\set{x|x>0}`, R`\set{a||b}`],
	"\\newline": [R`a\newline b`],
	"\\pmod": [R`a\equiv b \pmod{m}`],
	"\\pod": [R`a \pod{m}`],
	"\\mod": [R`a \mod{m}`],
	"\\bmod": [R`a \bmod b`, R`\scriptstyle a \bmod b`],
	"\\colon": [R`f\colon A\to B`, R`\colon`],
	"\\not": [R`\not=`, R`\not\in`, R`\not<`, R`\not`, R`a \not\equiv b`],
};

for (const [name, body] of Object.entries(MACROS)) {
	if (typeof body === "function") {
		const list = FUNCTION_MACRO_CASES[name];
		if (!list) throw new Error(`katex-cases: no cases for JavaScript macro ${name}`);
		add(list);
		continue;
	}
	if (typeof body !== "string") {
		throw new Error(`katex-cases: unexpected macro value for ${name}`);
	}
	let arity = 0;
	for (const match of body.matchAll(/(?<!#)#([1-9])/g)) {
		arity = Math.max(arity, Number(match[1]));
	}
	const args = "abcdefghi".slice(0, arity).split("").map((c) => `{${c}}`).join("");
	const call = args ? `${name}${args}` : name;
	const usage = MACRO_USAGE[name] ?? [call];
	add(usage);
	add(`a ${usage[0]} b`, R`\text{${usage[0]}}`, `${tok(usage[0])}^{2}`);
}

// ---------------------------------------------------------------------------
// 4. Symbols: every key of symbols.math alone, every key of symbols.text in
//    \text, and a per-group representative subset in context, with scripts
//    and primes.
// ---------------------------------------------------------------------------
section("symbols");

for (const key of mathKeys) (MATH[key].group === "op-token" ? add : addInline)(key);
for (const key of textKeys) addInline(R`\text{${key}}`);
for (const key of repMath) add(`a ${key} b`, `${tok(key)}^{2}_{i}`, `${tok(key)}'`);
// Primes and script combinations on a plain base.
add(
	"x'", "x''", "x'''", "x''''", "x'_1", "x'^2", "x_1'", R`x^\prime`, R`x'^{\prime}`,
	R`x^{\prime\prime}`, "f'(x)", "'x", "''", R`\sum'`, R`{x^2}'`, R`x^2_3`, R`x_3^2`,
	R`x^{2^{3^{4}}}`, R`x_{i_{j_{k}}}`, R`{}^{14}_{6}C`, R`x^{}`, R`{}_1`, R`x^{a}_{b}'`,
	R`\alpha^{\beta}_{\gamma}`, R`f^{(n)}(x)`, R`e^{-x^2/2}`, R`x^{\frac{1}{2}}`,
	R`x_{\frac{1}{2}}`, R`x^{\sum_{i}}`, R`P_{\!x}`, R`W^{3\beta}_{\delta_1 \rho_1 \sigma_2}`,
);

// ---------------------------------------------------------------------------
// 5. Fonts: every math font command on each letter and digit, Greek, and
//    chunks of the representative symbols; old-style switches; every text
//    font on character classes, text-symbol chunks and nesting.
// ---------------------------------------------------------------------------
section("fonts");

const repChunks = chunks(repMath, 16).map(seq);
for (const font of mathFonts) {
	for (const ch of ALNUM) addInline(`${font}{${ch}}`);
	add(
		`${font}{ABCDEFGHIJKLMNOPQRSTUVWXYZ}`,
		`${font}{abcdefghijklmnopqrstuvwxyz}`,
		`${font}{0123456789}`,
		`${font}{${GREEK_LOWER}}`,
		`${font}{${GREEK_UPPER}}`,
		`${font}{x}^{2}_{i}`,
		`${font}{f}'`,
		`${font}{\\imath\\jmath\\ell\\hbar\\partial\\nabla\\infty}`,
		`${font}{a+b=c}`,
		`${font}{\\text{text}}`,
		`${font}{é}`,
		`${font}{\\sum_{i} \\int}`,
		`${font}{Wf}`,
	);
	for (const chunk of repChunks) addInline(`${font}{${chunk}}`);
}
for (const font of oldFonts) {
	add(
		`{${font} ABCabc123${GREEK_LOWER}} x`,
		`${tok(font)}x+y`,
		R`\text{${tok(font)}ABC abc 123}`,
		R`\mathbf{a ${tok(font)} b}`,
	);
}
// Font nesting and precedence.
add(
	R`\mathbf{\mathit{x}}`, R`\mathit{\mathbf{x}}`, R`\mathrm{\mathbb{R}}`,
	R`\boldsymbol{\mathrm{x}}`, R`\mathbf{\boldsymbol{\alpha}}`, R`\mathsf{\mathbf{x}}`,
	R`\mathtt{\mathit{x}}`, R`\mathcal{\mathbf{A}}`, R`\text{\mathbf{x}}`,
	R`\mathrm{\text{\textit{x}}}`, R`\mathbf{x\text{y}z}`, R`\boldsymbol{x+y=\sum}`,
	R`\boldsymbol{\int}`, R`\pmb{\sum}`, R`\bm{\Gamma}`, R`\boldsymbol{1}`,
	R`\mathnormal{\Gamma}`, R`\mathit{\Gamma}`, R`\mathrm{\Gamma\alpha}`,
);

const TEXT_CONTENT = [
	"ABCDEFGHIJKLMNOPQRSTUVWXYZ",
	"abcdefghijklmnopqrstuvwxyz",
	"0123456789",
	"!?.,;:()[]-/*+=<>@|",
	"--- -- `` '' ` ' \"",
	"àéîõü ÀÉÎÕÜ ñç ß",
	R`\ss\ae\oe\o\AE\OE\O\i\j`,
	"αβγ ΑΒΓ",
	"Привет",
	"日本",
	R`\$\%\&\#\_\{\}`,
	"a  b   c",
	"fi ff ffl",
	R`\'e \"o \^a \~n \=u \.z \u{g} \v{s} \H{o} \c{c} \r{a}`,
	R`x^2`,
	R`a $b$ c`,
];
// Text symbols per font: main-font ones in chunks (accent tokens take an
// argument and are covered in the accents section); AMS-font ones one by
// one, since \textbf/\textit have no AMS-Bold/AMS-Italic metrics and throw
// a plain Error that would mask the rest of a chunk.
const textChunks = chunks(
	textKeys.filter((key) => TEXT[key].font === "main" && TEXT[key].group !== "accent-token"),
	25,
).map(seq);
const amsText = textKeys.filter((key) => TEXT[key].font === "ams");
for (const font of textFonts) {
	for (const content of TEXT_CONTENT) add(`${font}{${content}}`);
	for (const chunk of textChunks) addInline(`${font}{${chunk}}`);
	for (const key of amsText) addInline(`${font}{${key}}`);
}
for (const outer of textFonts) {
	for (const inner of textFonts) add(`${outer}{a ${inner}{b} c}`);
}
add(
	R`\textsf{\textbf{\textit{x}}}`, R`\texttt{\textbf{\textit{x}}}`,
	R`\emph{a \emph{b} c}`, R`\textit{a \emph{b}}`, R`\textbf{\emph{b}}`,
	R`\text{\rm a \it b \bf c \sf d \tt e}`, R`\text{\textbf{b} \textup{u}}`,
);

// ---------------------------------------------------------------------------
// 6. Unicode: unicodeSymbols and unicodeAccents in math and text, every
//    combining mark U+0300–U+036F, ligatures, the whole Mathematical
//    Alphanumeric block, script-fallback blocks (edges and samples),
//    Latin-1/Greek/Cyrillic/operator blocks, super/subscript characters,
//    astral and control characters.
// ---------------------------------------------------------------------------
section("unicode");

for (const ch of Object.keys(K.unicodeSymbols)) addInline(ch, R`\text{${ch}}`);
for (const accent of Object.keys(K.unicodeAccents)) {
	for (const base of ["a", "A", "i", "j", "x", "1", "ı", "α"]) {
		addInline(`${base}${accent}`, R`\text{${base}${accent}}`);
	}
	add(R`\mathbf{a${accent}}`, R`\text{\textit{e${accent}}}`, `x${accent}^{2}`);
}
for (const mark of fromCodePoints(0x300, 0x36f)) addInline(`a${mark}`, R`\text{a${mark}}`);
add(
	"a\u0301\u0308", "\\text{e\u0302\u0301}", "i\u0307", "\u0301", "\\text{\u0301}",
	"\\alpha\u0301", "1\u0301", "中\u0301", "\\text{ç\u0301}", "é", "e\u0301",
	"\\text{é}", "\\text{e\u0301}",
);
// Ligatures (text mode only; monospace fonts decompose them).
add(
	R`\text{a--b---c}`, "\\text{``quoted''}", R`\text{----}`, R`\text{-- -}`,
	"\\texttt{--- -- `` ''}",
	R`\textbf{---}`, "\\textit{``x''}", R`\textsf{--}`, "\\text{`'}", "\\text{'''}",
	"\\text{```}", R`\text{-{}-}`, R`--`, R`---`, "``", "''", R`\mathrm{--}`,
	R`\text{\textendash\textemdash}`, R`{\tt --}`, R`\text{\tt ---}`,
);
for (const ligature of Object.keys(K.ligatures)) {
	add(R`\text{${ligature}}`, R`\texttt{${ligature}}`, R`\textbf{${ligature}}`);
}
// Mathematical Alphanumeric Symbols, every code point (reserved holes, the
// unsupported italic dotless ı and the font-less Greek range included).
for (const ch of fromCodePoints(0x1d400, 0x1d7ff)) addInline(ch);
for (const ch of every(fromCodePoints(0x1d400, 0x1d7ff), 13)) {
	addInline(R`\text{${ch}}`, R`\mathbf{${ch}}`, `${ch}^{2}`);
}
// Script-fallback blocks (scriptData): edges, one past each edge, and
// evenly spaced samples.
for (const { blocks } of K.scriptData) {
	for (const [lo, hi] of blocks) {
		const points = new Set([lo - 1, lo, hi, hi + 1]);
		for (let i = 1; i < 8; i++) points.add(Math.round(lo + ((hi - lo) * i) / 8));
		for (const cp of [...points].sort((a, b) => a - b)) {
			if (cp >= 0xd800 && cp <= 0xdfff) continue;
			const ch = String.fromCodePoint(cp);
			addInline(ch, R`\text{${ch}}`);
		}
	}
}
const WORDS = [
	"Привет мир", "日本語のテキスト", "한국어", "नमस्ते", "ქართული", "Հայերեն",
	"Ελληνικά", "עברית", "العربية", "ไทย", "አማርኛ", "😀🎉", "𝔘𝔫𝔦𝔠𝔬𝔡𝔢",
	"ｆｕｌｌｗｉｄｔｈ", "ÀÉÎÕÜ àéîõü", "Œuvre ﬁ ﬂ", "½ ¼ ¾", "™ € £ ¥ ©",
	"ÐÞþ", "ĀāĂăĄą", "ɐɑɒ", "ｱｲｳ", "〈〉「」", "①②③",
];
for (const word of WORDS) {
	add(word, R`\text{${word}}`, R`\mathrm{${word}}`, R`\textbf{${word}}`, R`\mathbf{${word}}`);
}
// Whole blocks: Latin-1, Greek, General Punctuation, Letterlike, Arrows,
// Mathematical Operators; every other Cyrillic and Misc Technical code
// point; text mode for the letter blocks.
for (const ch of fromCodePoints(0xa1, 0xff)) addInline(ch, R`\text{${ch}}`);
for (const ch of fromCodePoints(0x370, 0x3ff)) addInline(ch, R`\text{${ch}}`);
for (const ch of fromCodePoints(0x400, 0x4ff, 2)) addInline(ch, R`\text{${ch}}`);
for (const ch of fromCodePoints(0x2000, 0x206f)) addInline(ch);
for (const ch of fromCodePoints(0x2100, 0x214f)) addInline(ch);
for (const ch of fromCodePoints(0x2190, 0x21ff)) addInline(ch);
for (const ch of fromCodePoints(0x2200, 0x22ff)) addInline(ch);
for (const ch of fromCodePoints(0x2300, 0x23ff, 2)) addInline(ch);
for (const ch of fromCodePoints(0x27c0, 0x27ff, 3)) addInline(ch);
for (const ch of fromCodePoints(0x2900, 0x2aff, 5)) addInline(ch);
// Unicode super/subscripts (uSubsAndSups).
const subsAndSups = Object.keys(K.uSubsAndSups);
for (const ch of subsAndSups) addInline(`x${ch}`);
add(
	"x₀₁₂₃", "x⁰¹²³", "x²₁", "x₁²", "²", "₁", "\\text{x²}", "x^2²", "x_1₂", "x'²",
	"x⁽ⁿ⁾", "\\alpha²", "e⁻ˣ", "x²ᵃ",
	`x${subsAndSups.filter((ch) => /[₀-ₜ]/.test(ch)).join("")}`,
);
// Astral, invisible, private-use, control and non-characters.
add(
	"\u0000", "a\u0001b", "\u0007", "\u001b", "a\u007fb", "\u00a0", "a\u00adb", "a\u200bb",
	"a\u200db", "\u2028", "a\u2029b", "\ue000", "\uf8ff", "\ufeff", "\ufffd", "\uffff",
	"\u{10000}", "\u{1F600}", "\u{20000}", "\u{E0001}", "\u{10FFFF}", "\u{1D6A4}",
	"a\u{1F600}b", "\\text{\u{1F600}}", "\\mathbf{\u{1F600}}", "x^{\u{1F600}}",
	"\\text{\u{1D400}}", "x\\", "\\", "a\tb", "a\nb", "a\r\nb", "\\text{a\nb}",
	"\\text{a\n\nb}", "\\ \n", "a%comment\nb", "a%comment", "\\text{a%c\n b}", "%",
);

// ---------------------------------------------------------------------------
// 7. Delimiters and radicals: every delimiter around struts of increasing
//    height (small glyph, Size1–4, stacked/SVG), nested fractions, every
//    \big-family size, \middle, invalid delimiters, \sqrt heights.
// ---------------------------------------------------------------------------
section("delimiters");

// Strut heights (em) straddling the switch points between the small glyph,
// the Size1–Size4 glyphs and stacked/SVG construction, in text and display
// style.
const HEIGHTS = [0.4, 0.9, 1.2, 1.5, 1.8, 2.1, 2.4, 2.7, 3.0, 3.6, 4.5, 7, 12];
for (const delim of delimiters) {
	const d = tok(delim);
	for (const h of HEIGHTS) add(R`\left${d}${strut(h)}\right${d}`);
	for (const depth of [1, 2, 4]) add(R`\left${d}${nestFrac(depth)}\right.`);
	add(
		R`\left${d}x\right${d}`,
		R`\left.x\right${d}`,
		R`\left( a \middle${d} b \right)`,
		R`\scriptstyle\left${d}${strut(2)}\right.`,
	);
	for (const size of [R`\big`, R`\Big`, R`\bigg`, R`\Bigg`]) addInline(`${size}${d}`);
}
for (const size of delimSizing) {
	for (const delim of ["(", ")", "|", R`\langle`, R`\{`, R`\uparrow`, "/", "."]) {
		add(`a ${size}${tok(delim)} b`);
	}
}
add(
	R`\bigl( \frac{a}{b} \bigr)`, R`\Bigl[ x \Bigr]`, R`\biggl\{ x \biggr\}`,
	R`\Biggl\langle x \Biggr\rangle`, R`\bigm| x`, R`\scriptstyle \Big(`,
	R`\Huge \big(`, R`\tiny \Bigg(`, R`\left( \begin{matrix} 1 \\ 2 \end{matrix} \right)`,
	R`\left\{ a \middle| b \middle\| c \right\}`,
	R`\left( \frac{a}{b} \middle/ \frac{c}{d} \right)`,
	R`\left( \left[ \left\{ x \right\} \right] \right)`,
	R`\left. \frac{df}{dx} \right|_{x=0}`, R`\left( x \right)^2`, R`\left( x \right)_i^j`,
	R`\color{red}\left( x \middle| y \right)`, R`\left(\color{blue} x \right)`,
	// Invalid delimiters and unbalanced \left/\right/\middle.
	R`\left a \right)`, R`\left\alpha x \right)`, R`\left{x} \right)`, R`\big a`,
	R`\bigl\frac`, R`\left( a \middle x \right)`, R`\left( x \right a`, R`\left`,
	R`\right)`, R`\left( x`, R`\left( x \middle`, R`\middle| x`, R`x \right)`,
	R`\big{(}`, R`\big`, R`\left(x\right)\right)`,
);
for (let rows = 1; rows <= 10; rows++) {
	const body = Array.from({ length: rows }, (_, i) => `a_{${i}}`).join(R`\\`);
	add(R`\left( \begin{matrix}${body}\end{matrix} \right\rangle`);
}
for (const h of HEIGHTS) {
	add(R`\sqrt{\rule{0.5em}{${num(h)}em}}`, R`\sqrt{${strut(h)}}`);
}
for (const h of [0.5, 1.2, 2.5, 4, 8]) add(R`\sqrt[3]{${strut(h)}}`);
for (let depth = 0; depth <= 4; depth++) add(R`\sqrt{${nestFrac(depth)}}`);
add(
	R`\sqrt[n+1]{\frac{a}{b}}`, R`\sqrt[\frac12]{x}`, R`\sqrt{\sqrt{\sqrt{x}}}`,
	R`\sqrt{x}^2`, R`\sqrt[]{x}`, R`\sqrt{}`, R`\sqrt`, R`\sqrt[3]`, R`\sqrt{x^2+y^2}`,
	R`\sqrt{\smash[b]{y}}`, R`\scriptstyle\sqrt{x}`, R`\scriptscriptstyle\sqrt[3]{x}`,
	R`\sqrt{\begin{matrix} a \\ b \\ c \\ d \end{matrix}}`, R`\sqrt[3]{\sqrt[4]{x}}`,
	R`\Huge\sqrt{x}`, R`\tiny\sqrt{x}`, R`\sqrt{\text{text}}`, R`\text{\sqrt{x}}`,
	R`\sqrt[\alpha\beta\gamma]{x}`, R`\sqrt{\Huge x}`, R`\sqrt[3{x}`,
);

// ---------------------------------------------------------------------------
// 8. Accents, stretchy constructs and enclosures: every accent command on
//    assorted bases, text accents in text and math, stretchy accents across
//    widths, horizontal braces with labels, the \x…arrow family, and every
//    enclose-type command.
// ---------------------------------------------------------------------------
section("accents");

const ACCENT_BASES = [
	"a", "i", "j", R`\imath`, R`\jmath`, "A", "x^2", "ab", "abc", "ABCDEFGH", R`\alpha`,
	"f", "W", "{}", R`\mathbf{a}`, R`\frac{a}{b}`, "AB", "xyz", "1",
];
for (const accent of [...mathAccents, ...underAccents]) {
	for (const base of ACCENT_BASES) add(`${accent}{${base}}`);
	add(
		`${accent}{${accent}{a}}`,
		`${accent}{a}_1^2`,
		`${accent} a`,
		R`\scriptstyle ${accent}{a}`,
		R`\text{${accent}{a}}`,
	);
}
for (const accent of textAccents) {
	for (const base of ["a", "i", "j", R`\i`, R`\j`, "A", "o", "{ab}", "{}", "O", "e", "u"]) {
		add(R`\text{${accent}${isWord(accent) ? `{${base}}` : base}}`);
	}
	add(`${accent}{a}`, `${accent}a`, R`\textbf{${accent}{a}}`, R`\text{${accent}}`);
}
const WIDTH_CONTENT = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 16].map((n) =>
	"ABCDEFGHIJKLMNOPQRSTUVWXYZ".slice(0, n),
);
for (const accent of stretchyAccents) {
	for (const content of WIDTH_CONTENT) add(`${accent}{${content}}`);
	for (const w of [0.3, 1, 2, 3.5, 6, 10]) add(`${accent}{\\rule{${num(w)}em}{0.5ex}}`);
}
for (const brace of fnOfType("horizBrace")) {
	for (const content of ["x", "a+b+c", "x_1+x_2+\\cdots+x_n", R`\frac{a}{b}`]) {
		add(
			`${brace}{${content}}`,
			`${brace}{${content}}^{n}`,
			`${brace}{${content}}_{k}`,
			`${brace}{${content}}^{n}_{k}`,
		);
	}
	add(R`\displaystyle ${brace}{a}^{\text{label}}`, R`\scriptstyle ${brace}{abc}^{n}`);
}
for (const arrow of xArrows) {
	add(
		`${arrow}{}`,
		`${arrow}{a}`,
		`${arrow}[b]{}`,
		`${arrow}[b]{a}`,
		`${arrow}{long label text here}`,
		R`${arrow}[\text{below}]{\frac{a}{b}}`,
		`a ${arrow}{f} b`,
		R`\scriptstyle ${arrow}{f}`,
	);
}
const ENCLOSE_CONTENT = ["x", "xyz", R`\frac{a}{b}`, "x^2", "y", R`\text{wide text}`, "g_1"];
/** Whether an enclose command's (last) argument is an hbox (text mode). */
const hboxArg = (name) => F[name]?.argTypes?.at(-1) === "hbox";
const enclosures = [
	...fnOfType("enclose").map((name) => {
		if (name === R`\colorbox`) return R`\colorbox{yellow}`;
		if (name === R`\fcolorbox`) return R`\fcolorbox{red}{yellow}`;
		return name;
	}),
	R`\boxed`,
];
const encloseName = (enclose) => enclose.replace(/\{.*$/, "");
/** Content for an enclosure: math inside $…$ where the argument is text. */
const encloseArg = (enclose, content) =>
	hboxArg(encloseName(enclose)) && !/^[a-z ]+$|^\\text\{/.test(content)
		? `{$${content}$}`
		: `{${content}}`;
for (const enclose of enclosures) {
	for (const content of ENCLOSE_CONTENT) add(`${enclose}${encloseArg(enclose, content)}`);
	add(R`\scriptstyle ${enclose}{x}`, R`\text{${enclose}{abc}}`, `a ${enclose}{b}^{2} c`);
}
// hbox arguments given math directly: the text-mode error.
add(R`\fbox{\frac{a}{b}}`, R`\colorbox{red}{x^2}`, R`\angl{\frac{a}{b}}`);
add(R`\cancel{5}`, R`\sout{abc}`, R`\text{\sout{strike}}`, R`\fbox{\text{a}}`, R`\boxed{\boxed{x}}`);

// ---------------------------------------------------------------------------
// 9. Sizes, styles, operators and fractions: every size × style around
//    fractions/scripts/operators, every operator with limits variants, the
//    fraction family and infix operators.
// ---------------------------------------------------------------------------
section("sizing");

const SIZING_BODIES = [
	R`\frac{a}{b}`,
	R`x^{2}_{i}`,
	R`\sum_{i=0}^{n} i`,
	R`\int_0^1 f`,
	R`\sqrt{x}`,
	R`\left(\frac{a}{b}\right)`,
];
for (const size of sizes) {
	for (const style of ["", ...styles]) {
		for (const body of SIZING_BODIES) {
			(style ? addInline : add)(`${tok(size)}${style ? tok(style) : ""}${body}`);
		}
	}
	add(`a {${size} b} c`, R`\text{a {${size} b} c}`, `${size}`);
}
for (const style of styles) {
	add(`a {${style} \\frac{b}{c}} d`, R`\text{${style} x}`, `${style}`);
}
add(R`\tiny a \Huge b`, R`\displaystyle\scriptstyle x`, R`\huge x^{\tiny y}`);
for (const op of ops) {
	add(
		`${tok(op)}_{a}^{b}`,
		`${tok(op)}\\limits_{a}^{b}`,
		`${tok(op)}\\nolimits_{a}^{b}`,
		`${tok(op)}_{i=1}`,
		R`\textstyle ${tok(op)}_{a}^{b}`,
		R`\scriptstyle ${tok(op)}_{a}^{b}`,
		`${tok(op)}\\limits`,
		`${tok(op)}^{n}x`,
	);
}
add(
	R`\mathop{x}\limits_a^b`, R`\mathop{x}\nolimits_a^b`, R`\operatorname{f}\limits_a^b`,
	R`\operatorname*{f}\nolimits_a^b`, R`\sum\limits\nolimits_a`, R`\lim_{x\to 0}`,
	R`\lim\limits_{x\to 0}`, R`\max_{i} x_i`, R`\det\nolimits_A`, R`\int\limits_0^1`,
	R`\iint_D`, R`\oint_C \vec{F}\cdot d\vec{r}`, R`\sum_{\substack{a\\b}}`,
	R`\prod_{p \text{ prime}}`, R`\bigcup_{n=1}^{\infty} A_n`, R`\int_{-\infty}^{\infty}`,
);
const FRACTIONS = fnOfType("genfrac").filter((name) => F[name].numArgs === 2);
for (const frac of FRACTIONS) {
	for (const [a, b] of [["a", "b"], ["1", "2"], ["x^2", "y_1"], [R`\frac{1}{2}`, "c"], ["", ""], ["abcdef", "g"]]) {
		add(`${frac}{${a}}{${b}}`);
	}
	add(R`\scriptstyle ${frac}{a}{b}`, R`\scriptscriptstyle ${frac}{a}{b}`, `${frac}{a}{b}^{2}`);
}
add(
	R`\cfrac{1}{1+\cfrac{1}{1+\cfrac{1}{x}}}`, R`\cfrac{a}{b}`, R`x^{\cfrac{a}{b}}`,
	R`\binom{n}{k}`, R`\dbinom{n}{k}`, R`\tbinom{n}{k}`, R`{n \choose k}`,
	R`\frac{\partial^2 f}{\partial x^2}`, R`\frac{1}{\frac{1}{\frac{1}{x}}}`,
	R`a \over b \over c`, R`{a \atop b} \atop c`, R`a \brace b`, R`a \brack b`,
	R`a \above 2pt b \above 1pt c`, R`\frac{a}{b}\over c`, R`\over`, R`a\over`, R`\over b`,
	R`\genfrac(){1pt}{0}{\genfrac[]{0pt}{1}{a}{b}}{c}`, R`\genfrac(){x}{0}{a}{b}`,
	R`\genfrac(){1pt}{5}{a}{b}`, R`\genfrac(){1pt}{a}{a}{b}`, R`\genfrac{a}{b}{1pt}{0}{c}{d}`,
	R`\above`, R`a\above b`, R`\text{a \over b}`,
);

// ---------------------------------------------------------------------------
// 10. Spacing: every spacing symbol and spacing macro in context, every
//     kern-like command with every unit (negative, fractional, invalid),
//     \rule, \raisebox, \smash, phantoms, laps, \vcenter, \hbox, \mathchoice,
//     and a seeded sweep of dimensions for number formatting.
// ---------------------------------------------------------------------------
section("spacing");

const SPACING_MACROS = [
	R`\,`, R`\:`, R`\;`, R`\!`, R`\>`, R`\thinspace`, R`\medspace`, R`\thickspace`,
	R`\negthinspace`, R`\negmedspace`, R`\negthickspace`, R`\enspace`, R`\enskip`,
	R`\quad`, R`\qquad`, "~", R`\nobreak`, R`\allowbreak`,
];
for (const name of SPACING_MACROS) {
	if (!Object.hasOwn(MACROS, name) && !Object.hasOwn(MATH, name)) {
		throw new Error(`katex-cases: ${name} is no longer a macro or symbol`);
	}
}
const spacingSymbols = [...new Set([
	...mathKeys.filter((key) => MATH[key].group === "spacing"),
	...textKeys.filter((key) => TEXT[key].group === "spacing"),
])];
for (const space of [...SPACING_MACROS, ...spacingSymbols]) {
	add(
		`a${tok(space)}b`,
		R`\text{a${tok(space)}b}`,
		R`\scriptstyle a${tok(space)}b`,
		R`\Large a${tok(space)}b`,
		`${tok(space)}x`,
		`x^{a${tok(space)}b}`,
	);
}
const KERNS = [R`\kern`, R`\mkern`, R`\hskip`, R`\mskip`, R`\hspace`, R`\hspace*`];
for (const cmd of KERNS) {
	for (const unit of units) {
		for (const value of ["1", "-1.5", ".25", "12.3456"]) add(`a${cmd}{${value}${unit}}b`);
		if (!cmd.startsWith(R`\hspace`)) add(`a${cmd} 2${unit} b`);
	}
	add(
		`a${cmd}{ - 2 pt}b`, `a${cmd}{+ .5em}b`, `a${cmd}{1xx}b`, `a${cmd}{1}b`,
		`a${cmd}{em}b`, `a${tok(cmd)}b`, `a${cmd}{}b`, `a${cmd}{1 e m}b`, `a${cmd}{1EM}b`,
		`a${cmd}{1em2em}b`, `a${cmd}`, R`\text{a${cmd}{1em}b}`, R`\text{a${cmd}{3mu}b}`,
		R`\scriptstyle a${cmd}{1em}b`, R`\Huge a${cmd}{1em}b`, R`\tiny a${cmd}{10mu}b`,
	);
}
for (const unit of units) {
	add(R`\text{a\kern1${unit}b}`, R`\rule{1${unit}}{1${unit}}`, R`\raisebox{1${unit}}{x}`);
}
add(
	R`\rule{1em}{2em}`, R`\rule[1ex]{1em}{2em}`, R`\rule[-1ex]{1em}{2em}`, R`\rule{0pt}{2em}`,
	R`\rule{-1em}{1em}`, R`\rule{1em}{-1em}`, R`\text{\rule{1em}{1em}}`, R`\rule{a}{b}`,
	R`\rule{1em}`, R`\rule`, R`x\rule{0.4pt}{0.4pt}y`, R`\scriptstyle\rule{1em}{1em}`,
	R`\color{red}\rule{1em}{1em}`, R`\rule[0.5em]{1em}{0em}`,
	R`\raisebox{0.5em}{x}`, R`\raisebox{-0.5em}{\text{t}}`, R`\text{a\raisebox{1ex}{b}c}`,
	R`\raisebox{x}{y}`, R`\raisebox{1em}`, R`\raisebox{1em}{\frac{a}{b}}`,
	R`\raisebox{1em}{$\frac{a}{b}$}`,
	R`\smash{\frac{a}{b}}`, R`\smash[t]{\frac{a}{b}}`, R`\smash[b]{\frac{a}{b}}`,
	R`\text{\smash{y}}`, R`\sqrt{\smash[t]{\frac{a}{b}}}`,
	R`\phantom{xyz}`, R`a\phantom{\frac{1}{2}}b`, R`\hphantom{\frac{1}{2}}`,
	R`\vphantom{\frac{1}{2}}x`, R`\text{\phantom{a}b}`, R`\text{\hphantom{a}b}`,
	R`\text{\vphantom{b}a}`, R`\phantom{}`, R`x^{\phantom{2}}`,
	R`\llap{ab}c`, R`\rlap{ab}c`, R`\clap{ab}c`, R`\mathllap{ab}c`, R`\mathrlap{ab}c`,
	R`\mathclap{ab}c`, R`\sum_{\mathclap{1\le i\le j\le n}} x`, R`\text{\llap{x}y}`,
	R`\text{\rlap{x}y}`, R`\text{\clap{x}y}`, R`\text{\mathllap{x}y}`,
	R`\vcenter{\hbox{x}}`, R`\vcenter{\frac{a}{b}}`, R`a\vcenter{\rule{1em}{2em}}b`,
	R`\text{\vcenter{x}}`, R`\hbox{a b $x$}`, R`\hbox{}`, R`x^{\hbox{text}}`,
	R`\text{\hbox{x}}`, R`\hbox{\frac{a}{b}}`, R`\hbox{$\frac{a}{b}$}`,
	R`\mathchoice{D}{T}{S}{SS}`, R`x^{\mathchoice{D}{T}{S}{SS}}`,
	R`x^{y^{\mathchoice{D}{T}{S}{SS}}}`, R`\frac{\mathchoice{D}{T}{S}{SS}}{b}`,
	R`\textstyle\mathchoice{D}{T}{S}{SS}`, R`\mathchoice{D}{T}{S}`,
	R`a\nobreak b`, R`a\allowbreak b`, R`a=b\nobreak=c`, R`a~b`, R`a\ b`, R`a\space b`,
	R`a\nobreakspace b`, R`\text{a~b}`, R`a\hskip 1em plus 2em b`, R`a\kern1em1b`,
);
{
	const rng = mulberry32(0x6b65726e);
	const unitOf = () => units[Math.floor(rng() * units.length)];
	const value = (scale) => {
		const digits = Math.floor(rng() * 6);
		return (rng() * 2 * scale - scale).toFixed(digits);
	};
	for (let i = 0; i < 160; i++) add(`a\\kern{${value(20)}${unitOf()}}b`);
	for (let i = 0; i < 80; i++) {
		add(R`\rule[${value(2)}ex]{${value(5).replace("-", "")}em}{${value(3).replace("-", "")}ex}`);
	}
	for (let i = 0; i < 40; i++) add(R`\raisebox{${value(3)}${unitOf()}}{x}`);
	for (let i = 0; i < 40; i++) add(R`\sqrt{\rule{0pt}{${value(6).replace("-", "")}em}}`);
	for (let i = 0; i < 40; i++) {
		const h = Number(value(10).replace("-", ""));
		add(R`\left(\rule[${num(0.25 - h / 2)}em]{1pt}{${num(h)}em}\right)`);
	}
	for (let i = 0; i < 40; i++) {
		add(`${sizes[Math.floor(rng() * sizes.length)]} a\\mkern${value(30)}mu b`);
	}
}

// ---------------------------------------------------------------------------
// 11. Colors and links: color commands × named/hex/invalid colors, color
//     scoping, and the trust-gated commands (default trust: false).
// ---------------------------------------------------------------------------
section("colors");

const COLORS = [
	"red", "blue", "green", "black", "white", "gray", "orange", "purple", "magenta",
	"cyan", "yellow", "brown", "pink", "teal", "RED", "Blue", "foo", "transparent",
	"currentcolor", "#f00", "#F00", "#f00a", "#ff0000", "#FF0000", "#ff000080", "ff0000",
	"0000FF", "abc", "#abc", "#12", "#ggg", "#fffff", "red!50", "", "rgb(1,2,3)", "12345",
	"#1234567", " red", "red ",
];
for (const color of COLORS) {
	add(
		R`\color{${color}} x`,
		R`\textcolor{${color}}{x}`,
		R`\colorbox{${color}}{x}`,
		R`\fcolorbox{${color}}{#eee}{x}`,
	);
}
add(
	R`a {\color{red} b c} d`, R`\color{red} a \color{blue} b`, R`\color{red}\left(x\right)`,
	R`\color{red}\frac{a}{b}`, R`\color{red}\sqrt{x}`, R`\textcolor{red}{\color{blue}x}`,
	R`\color{red}x \\ y`, R`\text{\color{red}x y}`, R`\text{a \textcolor{red}{b} c}`,
	R`\color{red}{x}^2`, R`\textcolor{red}{x}^2`, R`\colorbox{red}{\color{white}x}`,
	R`\fcolorbox{red}{blue}{\text{a}}`, R`\color red x`, R`\color#f00 x`, R`\color`,
	R`\textcolor{red}`, R`\color{red}\overbrace{a+b}^{c}`, R`\color{red}\sum_{i}^{n}`,
	R`\color{red}\begin{matrix}a\end{matrix}`, R`\color{red}\verb|x|`,
	R`\color{red}\rule{1em}{1em}`, R`\color{red}\cancel{x}`, R`\color{blue}\underline{x}`,
	R`\color{green}\overline{x}`, R`\color{red}\xrightarrow{a}`, R`\color{red}\widehat{abc}`,
	R`\color{red}\boxed{x}`, R`\color{red}\TeX`, R`\color{red}\big(`,
	R`\color{red}\not=`, R`\color{red}\neq`, R`\textcolor{#228B22}{F=ma}`,
);
add(
	R`\href{https://katex.org/}{\KaTeX}`, R`\href{javascript:alert(1)}{x}`,
	R`\href{#frag}{x}`, R`\href{}{x}`, R`\href{a b}{x}`, R`\href{x}`,
	R`\href{https://a.b/c?d=e&f=g}{x}`, R`\text{\href{https://katex.org/}{t}}`,
	R`\url{https://katex.org/}`, R`\url{https://a.b/c?d=e&f=g}`, R`\url{http://x.y/%20}`,
	R`\url{a\#b}`, R`\url{a~b}`, R`\url{a_b}`, R`\url{a\%b}`, R`\url{a\\b}`, R`\url{}`,
	R`\url{https://katex.org/}^2`, R`\text{\url{x}}`,
	R`\includegraphics{x.png}`, R`\includegraphics[height=1em]{x.png}`,
	R`\includegraphics[width=2em,height=1em,totalheight=1.5em,alt=cat]{x.png}`,
	R`\includegraphics[width=abc]{x.png}`, R`\includegraphics[width=1xx]{x.png}`,
	R`\includegraphics[foo=1]{x.png}`, R`\includegraphics[height=2]{x.png}`,
	R`\includegraphics[height=1em]{}`, R`\includegraphics`, R`\text{\includegraphics{x.png}}`,
	R`\htmlClass{c}{x}`, R`\htmlId{i}{x}`, R`\htmlStyle{color:red}{x}`,
	R`\htmlData{a=b,c=d}{x}`, R`\htmlData{foo}{x}`, R`\htmlData{a=b, c}{x}`,
	R`\htmlData{}{x}`, R`\htmlClass{a b}{x}`, R`\htmlClass{}{x}`, R`\text{\htmlClass{c}{x}}`,
	R`\htmlStyle{}{x}`, R`\htmlId{x}`,
);

// ---------------------------------------------------------------------------
// 12. Tags, \verb (every delimiter), operator names, math classes, bold,
//     logos and \text with nested math (\char is with the macros).
// ---------------------------------------------------------------------------
section("misc");

add(
	R`x \tag{1}`, R`x \tag*{A}`, R`x \tag{\alpha}`, R`x \tag{}`, R`x \tag{1} \tag{2}`,
	R`\tag{1} x`, R`x \tag 1`, R`x \tag{a \\ b}`, R`x \tag{\text{long tag}}`, R`\tag`,
	R`\text{\tag{1}}`, R`x^{\tag{1}}`, R`\frac{a}{b} \tag{3.14}`, R`x \tag*{\verb|v|}`,
);
const VERB_DELIMS = [..."!\"#$%&'()+,-./0123456789:;<=>?@[\\]^_`{|}~ "];
for (const delim of VERB_DELIMS) add(`\\verb${delim}x y${delim}`);
add(
	R`\verb*|a b|`, R`\verb*+x y+`, R`\verb|abc`, R`\verb`, R`\verb*|x`, R`\verba|b|`,
	R`\verb||`, R`\verb|\frac{a}{b}|`, R`\verb|a  b|`, R`\verb|<>&"'|`, R`\text{\verb|x|}`,
	R`x^\verb|a|`, R`x^{\verb|a|}`, "\\verb§x§", "\\verb😀x😀", "\\verb|日本|",
	R`\verb|x|\verb|y|`, R`\mathbf{\verb|x|}`, "\\verb|a\nb|", "\\verb|\t|",
	R`\verb*| |`, R`\verb**x*`, R`\verb|%|`, R`\verb|~|`,
);
add(
	R`\operatorname{sn}`, R`\operatorname{sn}x`, R`\operatorname{sn}_a^b`,
	R`\operatorname*{sn}_a^b`, R`\operatorname*{sn}\limits_a^b`,
	R`\operatorname{sn}\limits_a^b`, R`\operatorname{sn}\nolimits_a^b`,
	R`\operatorname{a-b}`, R`\operatorname{\alpha}`, R`\operatorname{f'}`,
	R`\operatorname{a b}`, R`\operatorname{\mathbf{x}}`, R`\operatorname{}`,
	R`\operatorname{12}`, R`\operatorname{*}`, R`\operatorname{a.b}`, R`\operatorname{a/b}`,
	R`\operatorname{\text{t}}`, R`\operatorname{a^2}`, R`\scriptstyle\operatorname*{f}_a^b`,
	R`\operatorname{sn}(x)`, R`\sin x`, R`\sin(x)`, R`\sin^2 x`, R`\log_2 n`,
	R`\operatorname{sn}\operatorname{cn}`, R`x\operatorname{mod}y`,
	R`a \mathbin{x} b`, R`a \mathrel{x} b`, R`a \mathopen{x} b`, R`a \mathclose{x} b`,
	R`a \mathpunct{x} b`, R`a \mathinner{x} b`, R`a \mathord{+} b`, R`\mathbin{+}a`,
	R`\mathop{\sum}\limits_a^b`, R`\mathop{\rm lim}_a`, R`\mathop{x}\nolimits_a`,
	R`\pmb{x}`, R`\pmb{\alpha}`, R`\pmb{\text{t}}`, R`\text{\pmb{x}}`,
	R`\boldsymbol{\alpha}`, R`\boldsymbol{x+y}`, R`\bm{\Gamma}`, R`\boldsymbol{\sum}`,
	R`\boldsymbol{\text{t}}`, R`\boldsymbol{\partial}`, R`\boldsymbol{\imath}`,
);
for (const logo of [R`\TeX`, R`\LaTeX`, R`\KaTeX`]) {
	add(
		logo, R`\text{${logo}}`, R`\scriptstyle${logo}`, R`\mathbf{${logo}}`,
		R`\textbf{${logo}}`, R`\Huge${logo}`, `x^{${logo}}`, R`\textit{${logo}}`,
	);
}
add(
	R`\text{a $b^2$ c}`, R`\text{a \(x\) b}`, R`\text{\text{nested}}`, R`\text{$\text{$x$}$}`,
	R`\text{ a  b }`, R`\text{a\\b}`, R`\text{\textbf{b \textit{bi}}}`, R`\text{\\ }`,
	R`\text{\$ \% \& \# \_ \{ \}}`, R`\text{~}`, R`\text{a~b}`, R`\text{\ }`, R`\text{$}`,
	R`\text{\)}`, R`\text{$x}`, R`\text{\(x}`, R`\text{$$}`, R`\text{a}\text{b}`,
	R`\text{}`, R`\text{ }`, R`x\text{ if } y`, R`\text{a}^2`, R`\text{a}_{\text{b}}`,
	R`\text{\frac{a}{b}}`, R`\text{\sqrt{x}}`, R`\text{\sum}`, R`\text{\alpha}`,
	R`\text{\left(}`, R`\text{\angl{x}}`, R`\text{\vcenter{x}}`, R`\text{x_1}`,
	R`\textrm{$\mathrm{x}$}`, R`\text{\mathrm{x}}`, R`\mbox{x}`, R`\textsc{x}`,
	R`\textbackslash`, R`\text{\textbackslash}`, R`\text{<>&"'}`, R`<>&"'`,
	R`\text{<>\&"'}`, R`<>\&"'`, R`\text{a < b > c}`,
	R`\text{a\relax b}`, R`\text{\bgroup a\egroup}`, R`\text{\TextOrMath{t}{m}}`,
	R`\text{\begingroup a\endgroup}`, R`\begingroup a \endgroup`, R`\begingroup a`,
	R`\endgroup`, R`{a \endgroup`,
);

// ---------------------------------------------------------------------------
// 13. Errors: one input per reachable `new ParseError(` site in
//     dist/katex.mjs, plus deep nesting, expansion limits, unbalanced
//     braces, undefined control sequences, script and limit misuse, and
//     wrong-mode commands. Sites found unreachable from renderToString with
//     rehype-katex's options: strict 'error'; "Invalid unit" in
//     calculateSize (units are validated at parse time); "Invalid attribute
//     name" (needs trust); "Illegal delimiter" (every \big × delimiter pair is
//     in the delimiters section and none throws); "Invalid separator type";
//     "Invalid environment name" (\begin's text argument is always an
//     ordgroup); "Unknown type of space"; "Unbalanced namespace destruction";
//     "The length of delimiters…"; "Got group of unknown type"; "No function
//     handler"; "Null argument"; "A primitive argument cannot be optional";
//     "Unknown group type as"; "\verb assertion failed"; "Accent … unsupported
//     in … mode" (every unicodeAccents entry has a text fallback); quirks mode.
// ---------------------------------------------------------------------------
section("errors");

add(
	// strict: "error" is never set (rehype-katex passes no strict option), so
	// "LaTeX-incompatible input and strict mode is set to 'error'" is
	// unreachable; these exercise the warn/ignore strict paths instead.
	R`\text{\'{}}`, R`\u{a}`, "é", R`a%comment`, R`\begin{array}{c}a&b\end{array}`,
	// "Unsupported character" (wide chars outside KaTeX's tables).
	"\u{1D6A4}", "\\mathbf{\u{1D6A4}}", "\u{1D6A5}", "\u{1D7CC}",
	// assertCharacterGroup messages.
	R`\@char{abc}`, R`\@char{\alpha}`, R`\@char{1 2}`, R`\@char{-1}`, R`\@char{1114112}`,
	R`\begin{alignat}{\alpha} a \end{alignat}`, R`\begin{alignat}{1.5} a \end{alignat}`,
	// Macro definition errors.
	R`\let{=a`, R`\def{`, R`\def$`, R`\def`, R`\futurelet\x{`, R`\gdef\\{x}`,
	R`\global x`, R`\long\relax`, R`\global\global\def\x{a}\x`, R`\global\long`,
	R`\def\x#a{}`, R`\def\x#2{}`, R`\def\x#1`, R`\def\x#1#1{}`, R`\def\x#1#3{}`,
	R`\def\x{#}\x`, R`\def\x#1{#}\x a`, R`\def\x#1{#a}\x b`,
	// A placeholder beyond the macro's arity is not a ParseError: KaTeX throws
	// a TypeError, so rehype-katex's retry throws too and the fixture holds
	// V8's message text (as does `\begin{CD} A @ \end{CD}` in display mode).
	R`\def\x#1{#2}\x b`,
	R`\def\x#1.{#1}\x abc`, R`\def\x.#1{#1}\x a`, R`\def\x#1{#1}\x}`, R`\hphantom}`,
	R`\hphantom{a`, R`\def\x#1#2{#1}\x a`,
	// \current@color must be a string.
	R`\def\current@color{red}\left(x\right)`,
	// Delimiters.
	R`\middle|`, R`\left a\right.`, R`\left{a}\right.`, R`\big{x}`, R`\bigl\alpha`,
	// Environments.
	R`\begin{align} a \end{align}`, R`\begin{CD} A \end{CD}`, R`\begin{equation} a \end{equation}`,
	R`\def\arraystretch{0}\begin{matrix}a\end{matrix}`, R`\begin{equation}a&b\end{equation}`,
	R`\begin{split}a&b&c\end{split}`, R`\begin{matrix}a}\end{matrix}`,
	R`\begin{alignat}{0}a\end{alignat}`, R`\begin{alignat}{1}a&b&c&d\end{alignat}`,
	R`\begin{array}{x}a\end{array}`, R`\begin{matrix*}[x]a\end{matrix*}`,
	R`\begin{subarray}{r}a\end{subarray}`, R`\begin{subarray}{cc}a\end{subarray}`,
	R`\begin{subarray}{c}a&b\end{subarray}`, R`\hline`, R`\hdashline`, R`x\hline y`,
	R`\begin{\alpha}x\end{\alpha}`, R`\begin{foo}x\end{foo}`, R`\begin{matrix}a\end{pmatrix}`,
	R`\begin{matrix}a\end`, R`\begin`, R`\end`, R`\begin{}`, R`\begin{\relax}`,
	R`\begin{x y}`, R`\begin$`, R`\begin\alpha`, R`\begingroup\endgroup\endgroup`,
	// Html extensions.
	R`\htmlData{foo}{x}`, R`\includegraphics[width=x]{a.png}`,
	R`\includegraphics[width=1zz]{a.png}`, R`\includegraphics[bar=1]{a.png}`,
	R`\includegraphics[width]{a.png}`,
	// Stray math-mode closers.
	R`\)`, R`\]`, R`x\)`,
	// Lexer: unterminated \verb, unexpected characters.
	R`\verb|x`, "a\u0000b", "\u2028", "\ue123", "a\\",
	// \char and \newcommand.
	"\\char`", R`\char"G`, R`\char'9`, R`\charx`, R`\newcommand{ab}{x}`,
	R`\newcommand\sqrt{x}`, R`\renewcommand\nonexistent{x}`, R`\newcommand\foo[x]{y}`,
	// Tags.
	R`\tag{1}\tag{2}x`, R`x\tag{1}`,
	// Gullet: argument parsing and expansion limits.
	R`\frac{a}{b`, R`\text{a`, R`\sqrt[a{x}`, R`\def\x#1]{#1}\x a`,
	R`\def\a{\a}\a`, R`\def\a{\a a}\a`, R`\def\a#1{\a{#1}}\a x`,
	R`\def\a{\b}\def\b{\a}\a`, R`\gdef\a{\a}\a`, R`\newcommand\a{\a}\a`,
	R`\def\x{x\x}\x`, R`\edef\a{\a}`, R`\def\a{x}\edef\a{\a\a}\edef\a{\a\a}\a`,
	// Parser: expect(), infix, scripts, limits, function arguments.
	"{a", "a}", "{", "}", "{{}", "{}}", "a}b{", R`\left(a\right)}`, R`\sqrt[3{x}`,
	R`a\over b\over c`, R`\over`, "x^", "x_", "x^}", "^", "_", "x^^", "x__",
	R`x^\relax`, R`x^1^2`, R`x_1_2`, R`x^1_2^3`, R`x_1^2_3`, "x'^1^2", "x^2'", "x''^2^3",
	"x'_1_2", R`x\limits^2`, R`\limits`, R`\nolimits`, R`\alpha\nolimits_1`,
	R`x^\frac12`, R`x_\sqrt2`, R`\frac\sqrt{x}{y}`, R`\sqrt\frac{a}{b}`, R`\frac\text{a}{b}`,
	R`\text{\sqrt{x}}`, R`\text{\frac{a}{b}}`, "$", R`\(`, R`\includegraphics{a}`,
	R`\big`, R`\'`, R`\text{\'}`, R`\color{#12}x`, R`\color{}x`, R`\color`,
	R`\kern{abc}`, R`\kern{1xy}`, R`\kern x`, R`\kern`, R`\rule{1em}{x}`,
	R`\foo`, R`\foo{x}`, R`\text{\foo}`, R`\mathbff{x}`, R`\@`, R`\@foo`, R`\label{x}`,
	R`\ref{x}`, R`\eqref{x}`, R`\cite{x}`, R`\newline`, R`\mathbb`, R`\frac`, R`\frac{a}`,
	R`\frac a`, R`\sqrt[3]`, R`\binom{n}`, R`\overset{a}`, R`\x`, R`\\x`,
	// Combining marks: unknown accents are errors.
	"a\u0310", "a\u0350", "\\text{a\u0310}", "a\u0301\u0310",
);
// Deep (but not stack-exhausting) nesting.
for (const depth of [10, 30, 60]) {
	add(
		`${"{".repeat(depth)}x${"}".repeat(depth)}`,
		`${"{".repeat(depth)}x${"}".repeat(depth - 1)}`,
		`${R`\left(`.repeat(depth)}x${R`\right)`.repeat(depth)}`,
		`${R`\sqrt{`.repeat(depth)}x${"}".repeat(depth)}`,
	);
}
for (const depth of [5, 10, 20]) {
	add(
		`${R`\frac{1}{`.repeat(depth)}x${"}".repeat(depth)}`,
		`x${"^{x".repeat(depth)}${"}".repeat(depth)}`,
		`x${"_{x".repeat(depth)}${"}".repeat(depth)}`,
		`${R`\text{a $`.repeat(depth)}x${"$}".repeat(depth)}`,
	);
}
// maxExpand (1000) boundary: n expansions of a one-token macro.
for (const count of [998, 999, 1000, 1001]) {
	addInline(R`\def\a{x}` + R`\a`.repeat(count));
}

// ---------------------------------------------------------------------------
// 14. Atom spacing: every ordered pair of atom classes in every style, every
//     triple (binary-operator demotion), and the \mathXXX class wrappers
//     against each class.
// ---------------------------------------------------------------------------
section("atom spacing");

const ATOMS = {
	ord: "a",
	op: R`\sum`,
	bin: "+",
	rel: "=",
	open: "(",
	close: ")",
	punct: ",",
	inner: R`\left(x\right)`,
};
const atomList = Object.values(ATOMS);
for (const first of atomList) {
	for (const second of atomList) {
		add(seq([first, second]));
		for (const style of styles.slice(1)) addInline(`${tok(style)}${seq([first, second])}`);
		for (const third of atomList) addInline(seq([first, second, third]));
	}
}
const MCLASS = fnOfType("mclass").filter((name) => F[name].numArgs === 1 && !/bold|bm/.test(name));
for (const wrapper of MCLASS) {
	for (const atom of atomList) add(`${wrapper}{x}${tok(atom)}`, `${tok(atom)}${wrapper}{x}`);
}

// ---------------------------------------------------------------------------
// 15. Random compositions: a fixed-seed grammar over the registries
//     (symbols, fonts, accents, operators, delimiters, environments, …) for
//     interactions the targeted sections miss. Formulas longer than 180
//     characters are discarded (the draw still advances the generator).
// ---------------------------------------------------------------------------
section("random");
{
	const rng = mulberry32(0x6b617465);
	const pick = (list) => list[Math.floor(rng() * list.length)];
	const symPool = repMath.filter((key) => !/^[#$%&^_{}~']$/.test(key));
	const letters = [..."abcdefxyzABCnm0123456789"];
	const RANDOM_ENVS = ["matrix", "pmatrix", "bmatrix", "Bmatrix", "vmatrix", "Vmatrix", "cases", "aligned", "gathered", "smallmatrix"];
	const pool = {
		sym: symPool,
		accent: mathAccents,
		font: mathFonts,
		textFont: textFonts,
		delim: delimiters,
		xarrow: xArrows,
		enclose: enclosures,
		frac: FRACTIONS,
		size: sizes,
		style: styles,
		color: ["red", "blue", "#0a0", "#c0f", "purple"],
		space: SPACING_MACROS,
		brace: fnOfType("horizBrace"),
		mclass: MCLASS,
	};
	const atom = () => {
		const r = rng();
		if (r < 0.45) return pick(letters);
		if (r < 0.9) return tok(pick(pool.sym));
		return `${pick(letters)}'`;
	};
	const group = (d) => `{${expr(d)}}`;
	const base = () => (rng() < 0.5 ? pick(letters) : tok(pick(pool.sym)));
	function term(d) {
		if (d <= 0 || rng() < 0.3) return atom();
		switch (Math.floor(rng() * 20)) {
			case 0: return `${pick(pool.frac)}${group(d - 1)}${group(d - 1)}`;
			case 1: return rng() < 0.5 ? R`\sqrt${group(d - 1)}` : R`\sqrt[${atom()}]${group(d - 1)}`;
			case 2: return `${base()}^${group(d - 1)}`;
			case 3: return `${base()}_${group(d - 1)}^${group(d - 1)}`;
			case 4: {
				const middle = rng() < 0.2 ? R` \middle${tok(pick(pool.delim))} ${expr(d - 1)}` : "";
				return R`\left${tok(pick(pool.delim))} ${expr(d - 1)}${middle} \right${tok(pick(pool.delim))}`;
			}
			case 5: return `${pick(pool.accent)}${group(d - 1)}`;
			case 6: return `${pick(pool.font)}${group(d - 1)}`;
			case 7: return rng() < 0.5
				? R`\textcolor{${pick(pool.color)}}${group(d - 1)}`
				: R`{\color{${pick(pool.color)}} ${expr(d - 1)}}`;
			case 8: return `${pick(pool.textFont)}{${pick(["word", "two words", "a $x^2$ b", "é ü", "--"])}}`;
			case 9: {
				const op = tok(pick(ops));
				const limits = pick(["", R`\limits`, R`\nolimits`]);
				return `${op}${limits}_${group(d - 1)}^${group(d - 1)}`;
			}
			case 10: {
				const env = pick(RANDOM_ENVS);
				return R`\begin{${env}} ${expr(d - 1)} & ${atom()} \\ ${atom()} & ${expr(d - 1)} \end{${env}}`;
			}
			case 11: return `${pick(pool.xarrow)}[${atom()}]${group(d - 1)}`;
			case 12: {
				const enclose = pick(pool.enclose);
				return hboxArg(encloseName(enclose)) ? `${enclose}{$${expr(d - 1)}$}` : `${enclose}${group(d - 1)}`;
			}
			case 13: return `${pick(pool.brace)}${group(d - 1)}^${group(d - 1)}`;
			case 14: return `{${tok(pick(pool.style))}${expr(d - 1)}}`;
			case 15: return `{${tok(pick(pool.size))}${expr(d - 1)}}`;
			case 16: return tok(pick(pool.space));
			case 17: {
				const [open, close] = pick([["(", ")"], ["[", "]"], [R`\{`, R`\}`], ["|", "|"], [R`\langle`, R`\rangle`]]);
				const size = pick([R`\big`, R`\Big`, R`\bigg`, R`\Bigg`]);
				return `${size}l${tok(open)}${expr(d - 1)}${size}r${tok(close)}`;
			}
			case 18: return `${pick(pool.mclass)}${group(d - 1)}`;
			default: return `${pick([R`\phantom`, R`\hphantom`, R`\vphantom`, R`\smash`, R`\overline`, R`\underline`, R`\mathllap`, R`\mathrlap`])}${group(d - 1)}`;
		}
	}
	function expr(d) {
		const count = 1 + Math.floor(rng() * (d > 1 ? 2 : 3));
		const out = [];
		for (let i = 0; i < count; i++) out.push(term(d));
		return out.join(" ").trim();
	}
	let accepted = 0;
	while (accepted < 2000) {
		const tex = expr(1 + Math.floor(rng() * 3));
		if (tex.length > 180) continue;
		accepted++;
		add(tex);
	}
}

// ---------------------------------------------------------------------------
// 16. Coverage round 1: inputs for dist/katex.mjs code the sections above
//     never executed, found with tools/katex/coverage.mjs (which lists what
//     is still uncovered and why the rest is unreachable). Line numbers
//     refer to the pinned dist/katex.mjs.
// ---------------------------------------------------------------------------
section("coverage round 1");

addInline(
	// protocolFromUrl (via Settings.isTrusted, which runs before the trust
	// check): an entity "colon" is rejected, as is a scheme with characters
	// RFC 3986 disallows; both make isTrusted return false early.
	R`\href{a&#58b}{x}`, R`\href{java&#x3a;script}{x}`, R`\url{a&colon;b}`,
	R`\href{1a:b}{x}`, R`\url{a b:c}`, R`\includegraphics{a_b:c.png}`,
	// \htmlData splits its raw argument (with `{,}` escaping a comma) before
	// the trust check.
	R`\htmlData{a=b{,}c}{x}`, R`\htmlData{{,}=1,b=2}{y}`,
	// SymbolNode rewrites î/ï/í/ì (only reachable through \char, which skips
	// the parser's accent decomposition) to a dotless ı plus a combining
	// accent.
	R`\char"EE`, R`\char"EF^2`, R`\text{\char"ED}`, R`\mathbf{\char"EC}`,
	R`\textit{\char"EE\char"EF}`,
	// \@char with textords that are not digits: parseInt gives NaN.
	R`\@char{.}`, R`\@char{..}`,
	// MathML \operatorname: a text operator builds a DocumentFragment (not a
	// string), an mo can hold a non-text child, an <mi> holding a fragment
	// is flattened with DocumentFragment.toText, and a kern without a named
	// MathML space flattens to " " (SpaceNode.toText).
	R`\operatorname{\sin}`, R`\operatorname{\mathop{\sin}}`, R`\operatorname{\mathbin{\cos}}`,
	R`\operatorname{\mathord{\sin}}`, R`\operatorname{\mathord{\sin}}_a`,
	R`\operatorname*{\mathord{\log}}_a^b`, R`\operatorname{a\kern1em b}`,
	R`\operatorname{a\kern0.2222em b}`, R`\operatorname{a\mkern7mu b}`,
	// \dots looks at the next token after one expansion; an unexpandable
	// token starting with \not selects \dotsb.
	R`a\dots\noexpand\notin b`, R`a\dots\noexpand\notag b`, R`a\dots\nothing`,
	// Infix denominators that are a single group are used as is.
	R`a\over{b}`, R`{a}\over{b}`, R`a\atop{b}`, R`1\above1pt{2}`,
	// A bare \relax as a primitive argument reaches the builders as an
	// "internal" node: "Got group of unknown type" from the MathML builder,
	// or from the HTML one where only the HTML side builds it
	// (\sqrt[3]\relax instead renders an empty radicand).
	R`\sqrt\relax`, R`\sqrt[3]\relax`, R`\mathord\relax`, R`\mathop\relax`,
	R`\textcircled\relax`, R`\text{\'\relax}`, R`\html@mathml{\sqrt\relax}{x}`,
	R`\html@mathml{\mathbin\relax}{y}`,
	// assertNodeType / assertSymbolNodeType failures are plain Errors, so
	// rehype-katex's retry throws too (fixture kind "error").
	R`\genfrac(){1pt}{\textbf{1}}{a}{b}`, R`\genfrac(){}{\text{2}}{a}{b}`,
	R`\begin{array}{c{l}} a\end{array}`, R`\begin{subarray}{c{l}} a\end{subarray}`,
	R`\begin{array}{{c}} a\end{array}`,
	// \genfrac takes any open/close atom as a delimiter, unchecked: one
	// without Main-Regular or Size1-Regular metrics fails in getMetrics
	// (a plain Error) when the delimiter is sized.
	R`\genfrac(!{0pt}{0}{a}{b}`, R`\genfrac.?{}{2}{a}{b}`, R`\genfrac┌┐{}{}{a}{b}`,
	R`\genfrac\@ulcorner.{}{1}{a}{b}`,
);
add(R`\mathchoice{\sqrt\relax}{a}{b}{c}`);
emit(R`\begin{CD} A @{>} B \end{CD}`, true);

// ---------------------------------------------------------------------------
// 17. Coverage round 2: condition outcomes the sections above never produce
//     and block coverage cannot see, because they have no code of their
//     own: an `if` without `else` whose test is never false, an operand
//     that never short-circuits, one leaf of a compound test, a case label
//     sharing a body with others. coverage.mjs counts them with the probes
//     in branches.mjs (every remaining outcome is excluded there, with the
//     reason).
// ---------------------------------------------------------------------------
section("coverage round 2");

addInline(
	// ParseError leaves out the position when the node's range runs
	// backwards (loc.start > loc.end): \let keeps each brace token's source
	// location, so this group opens at offset 15 and closes at offset 7.
	R`\let\b=}\let\a={\left\a x\b`,
	// SourceLocation.range has no start location: Unicode superscripts are
	// re-lexed without locations, and the \frac `a` expands to takes one as
	// its argument.
	R`\def a{\frac}xᵃᵇᶜ`,
	// lookupSymbol keeps a symbol whose replacement is empty: the HTML
	// \operatorname turns \nobreak and \allowbreak into textords (MathML
	// keeps their <mspace> in its all-text check).
	R`\operatorname{\nobreak}`, R`\operatorname{a\allowbreak b}`,
	// makeOrd: a ligature without metrics in a font that is not monospace.
	R`\text{\cal --}`,
	// An empty fragment as a script base (_getOutermostNode).
	R`\textcolor{red}{}^2`, R`a\html@mathml{}{x}^2`,
	// MathML number merging: <mi>.</mi> before an <msup> with an <mn> base;
	// an <msup> whose base is a fragment (\mathchoice and \html@mathml hand
	// back \sin's <mi> and <mo> unwrapped); a separator <mo> that is not
	// number punctuation (\mathpunct sets rspace 0.17em); \not before an
	// <mn>, and before an <mi>/<mo> whose first child is not text.
	R`a.2^3`, R`2\mathchoice{\sin}{\sin}{\sin}{\sin}^2`, R`1\html@mathml{a}{\sin}^2`,
	R`1\mathpunct{,}2`,
	R`\not1`, R`\not\mathord{ab}`, R`\not\mathrel{ab}`,
	// In text mode "-" is a textord, so \@char gets a negative number.
	R`\text{\@char{-1}}`,
	// A lone high surrogate U+D835 from \char reaches wideCharacterFont,
	// whose code point is then NaN ("Unsupported character").
	R`\char"D835`,
	// A column separator gets no vertical-align when the array is exactly
	// 0.5em tall: 0.84 + (0.36 - 0.7000000000000001) is 0.5 in doubles.
	R`\begin{array}{|c}a\\[-0.7000000000000001em]\end{array}`,
	// \genfrac with an atom of another family as a delimiter.
	R`\genfrac+){}{}{a}{b}`, R`\genfrac(={}{}{a}{b}`,
	// MathML \operatorname: an <mo> with other than one child.
	R`\operatorname{\mathbin{ab}}`, R`\operatorname{a\mathrel{}}`,
	// \operatorname* with \limits and only a superscript, inline.
	R`\operatorname*{f}\limits^a`,
	// Macros: \@ifnextchar with a multi-token or empty first argument;
	// \newcommand's argument count running into the end of input; delimited
	// arguments with nested braces, or starting but not ending with a
	// brace; \noexpand on a JavaScript macro.
	R`\@ifnextchar{ab}{x}{y}a`, R`\@ifnextchar{}{x}{y}a`, R`\newcommand\x[1`,
	R`\def\x#1.{[#1]}\x{{a}}.`, R`\def\x#1.{[#1]}\x{a}b.`,
	R`\noexpand\dots`, R`a\noexpand\char"41`,
);
// Display mode parses \tag's \df@tag after the outermost group has closed:
// a \df@tag that opens a group it never closes (the range to the subparse's
// location-less closing brace is null), and \gdef or \def with no group on
// the undo stack.
for (const tex of [R`\gdef\df@tag{\bgroup x}a`, R`\gdef\df@tag{\gdef\y{}}a`, R`\gdef\df@tag{\def\y{}}a`]) {
	emit(tex, true);
}

// ---------------------------------------------------------------------------
// 18. Coverage round 3: code that exclusions wrongly called unreachable
//     (found by tools/katex/fuzz-exclusions.mjs), and implicit decisions
//     that are not control flow, which coverage.mjs now also measures
//     (branches.mjs, regex.mjs): regex alternatives, optional parts and
//     class members; which Math.min/Math.max argument decides; which
//     members of a Set literal `has` finds; which keys of a lookup table
//     are looked up. Unreachable outcomes are excluded there, with the
//     reason.
// ---------------------------------------------------------------------------
section("coverage round 3");

addInline(
	// "\verb assertion failed": when a \verb delimiter is `@` with no closing
	// `@`, the lexer's \verb alternative fails and `\verb@…` lexes as a
	// control word (letters and @), which parseSymbol still takes for \verb.
	// A closed `@` pair lexes as \verb (or \verb*) with an empty body.
	R`\verb@x`, R`\verb@`, R`a\verb@x y`, R`\verb@@`, R`\verb*@@`,
	// Lexer: a control space made of a backslash and a newline; combining
	// marks after a surrogate pair; a carriage return as whitespace, alone
	// and after a control word.
	"a\\\nb", "\\text{a\\\nb}", "𝐀\u0301", "\\text{𝐀\u0302}", "a\rb", "\\alpha\r b", "a \\\r\n b",
	// \let, \futurelet and \def reject these characters (and the end of
	// input) where the name of a control sequence belongs.
	R`\let}`, R`\let$`, R`\let&`, R`\let#`, R`\let^`, R`\let_`, R`\let`, R`\futurelet_ab`,
	R`\def}`, R`\def&`, R`\def#`, R`\def^`, R`\def_`,
	// URL groups unescape \$ \& \~ \_ \^ \{ \} (before the trust check).
	R`\url{a\$b\&c\~d\_e\^f\{g\}h}`,
	// protocolFromUrl (Settings.isTrusted, before the trust decision):
	// leading whitespace, an empty scheme, zero-padded entity colons, and
	// schemes with uppercase letters, digits, "+", "-" and ".".
	R`\href{ a:b}{x}`, R`\href{:x}{y}`, R`\href{a&#058b}{x}`, R`\href{a&#x03a;b}{x}`,
	R`\href{A:x}{y}`, R`\url{aB9+-.:x}`,
	// \includegraphics parses its size options and alt text before the
	// trust check: signs, spaces, decimals with and without digits, and
	// numbers with and without units; a path starting with / or holding a
	// backslash.
	R`\includegraphics[width=-1,height=+ 12.5,totalheight=3.]{a.png}`,
	R`\includegraphics[width=.5,height=.25]{a.png}`,
	R`\includegraphics[width=-1em,height=+ 12.5 pt,totalheight=3.cm]{a.png}`,
	R`\includegraphics[width=.5in,height=.25mm]{a.png}`,
	R`\includegraphics{/a.png}`, R`\includegraphics{a\b.png}`,
	// Size groups: a decimal point without digits after it.
	R`a\kern1.em b`, R`\rule{1.em}{2.pt}`,
	// Table lookups. \dots looks one expansion ahead: \iff starts with
	// \DOTSB; \DOTSI, \DOTSX and \not only arrive unexpanded.
	R`a\dots\iff b`, R`a\dots\noexpand\DOTSI b`, R`a\dots\noexpand\DOTSX b`, R`a\dots\noexpand\not= b`,
	// \global before \futurelet.
	R`\global\futurelet\x\y\z`,
	// Found by fuzz-exclusions.mjs: tokens are mutable objects that a macro
	// shares between its expansions. \global renames the token after it in
	// place (\long to \\globallong, \def to \gdef), so the second \x finds
	// \\globallong in globalMap, and the \x in the second group has become
	// \gdef (\z survives the group). Likewise the token after \noexpand
	// becomes \relax for good: the second \x no longer expands \a.
	R`\def\x{\global\long\def\y{}}\x\x`, R`\def\x{\def}{\global\x\y{a}}{\x\z{b}}\z`,
	R`\def\a{A}\def\y{\noexpand}\def\x{\y\a}\x\def\y{}\x`,
	// ^ and _ count as defined (implicitCommands) for \newcommand, and
	// \renewcommand makes _ a macro.
	R`\newcommand{^}{x}`, R`\renewcommand{_}{y}_`,
	// Every extraCharacterMap letter, which fonts without the glyph borrow
	// metrics from: precomposed ones (which the parser splits into an
	// accent) through \char.
	Object.keys(K.extraCharacterMap)
		.map((ch) => (ch in K.unicodeSymbols ? R`\char"${ch.charCodeAt(0).toString(16).toUpperCase()}` : ch))
		.join(""),
);

// ---------------------------------------------------------------------------

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
	const width = Math.max(...sections.map(([name]) => name.length));
	for (const [name, count] of sections) console.log(`${name.padEnd(width)}  ${count}`);
	const unique = new Set(cases.map((entry) => (typeof entry === "string" ? entry : entry.tex)));
	console.log(`${"total".padEnd(width)}  ${cases.length} entries, ${unique.size} unique TeX`);
}

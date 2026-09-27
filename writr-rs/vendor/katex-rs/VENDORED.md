# Vendored: katex-rs 0.3.0

Vendored copy of the [`katex-rs`](https://crates.io/crates/katex-rs) crate
(a native Rust implementation of KaTeX by the katex-rs authors, MIT licensed —
see `LICENSE`, fetched from the upstream repository at the published commit
`f9d93892c39424ba24cef0be18105a1629b66357`), applied to the workspace via
`[patch.crates-io]`.

## Why

writr's JS engine renders math with katex@0.18.7 through rehype-katex, and
writr-rs must produce the same markup byte for byte. Upstream katex-rs tracks
KaTeX 0.18.5 (upstream main `49904aa`) and diverges from KaTeX's output in
places (attribute order, error messages, a few builders). The patches below
make it match katex@0.18.7; `crates/writr-katex/tests/corpus.rs` checks every
formula in the differential corpus (generated from the real KaTeX by
`tools/gen-katex-fixtures.mjs`).

Upstream's tests, benches, `Cargo.lock` and the optional wasm-bindgen API
(`wasm` feature and its dependencies) are not vendored. The data files in
`data/` are unmodified: `tools/katex/internals.mjs` confirms their font
metrics, sigma/xi tables and symbol table equal katex@0.18.7's.

## Patches

All patch sites are marked `WRITR-RS PATCH` in the source.

### Safety

- `src/stack_guard.rs` (new) and checks in the parser (`parse_expression`,
  `parse_argument_group`, and `parse_function`, which `\global`/`\long`
  re-enter from their handler: `\def\c#1{\global#1#1}\c\c` aborted the
  process), both group builders and every `write_markup`:
  a render may use at most 1 MiB of stack below its entry point. Past that,
  rendering fails with `ParseErrorKind::StackOverflow`, which behaves like
  V8's `RangeError: Maximum call stack size exceeded` (it is not a
  `ParseError`, so it propagates even with `throwOnError: false`). Upstream
  had no limit, so deeply nested formulas overflowed the native stack.
  katex-rs uses more stack per nesting level than KaTeX on V8, so it gives up
  earlier (about 120–235 levels, against V8's ~660–2,245, which itself varies
  between runs); no realistic formula comes close.

### Parity (match katex@0.18.7 byte for byte)

- `src/attribute_map.rs` (new): DOM and MathML attributes keep JavaScript
  object key order (`Object.keys`: integer-like keys ascending, then insertion
  order). Upstream used a hash map, so attribute order varied.
- `src/types/parse_error.rs`: `ParseError::to_js_string` (JavaScript's
  `String(error)`, e.g. `ParseError: KaTeX parse error: …`) and
  `ParseError::js_class` (`ParseError`, plain `Error` or `RangeError`).
- `src/core.rs` `render_error`: the error span's `title` is
  `error.toString()` and its style has no space (`color:#cc0000`); errors
  that are not `ParseError`s are rethrown even with `throwOnError: false`.
- `src/types/parse_error.rs`: error positions and the 15-unit context windows
  count UTF-16 code units and underline each unit (ParseError.ts); a split
  surrogate pair prints as U+FFFD. `with_utf16_range` locates errors inside a
  character. Missing-font-metrics, delimiter-metrics and `assertNodeType`
  failures are plain `Error`s; new `JsError`/`JsTypeError` kinds carry
  KaTeX's plain `Error`s and V8 `TypeError`s (`TypeError` class). Messages
  reworded to KaTeX's (quoted function name and lowercase mode, `Unknown
  accent ' x'`, `Mismatch:`, `Limit controls must follow a math operator`,
  lowercase infix message, CD and array wording, `\includegraphics.` period,
  def.ts/macros.ts wording, quoted `Got group of unknown type`, …).
- `src/utils/js.rs` (new): JavaScript `parseFloat`, `parseInt`, `trim` and
  `Number#toString`, used where KaTeX relies on them.
- `src/lexer/mod.rs`: `Unexpected character: 'x'` is quoted; a backslash
  before an astral character is no control symbol; `\verb` follows the
  UTF-16 regex (the delimiter may be a line terminator, the body stops at
  U+2028/U+2029, an astral delimiter closes after the next matching high
  surrogate and the lexer then rejects the lone low surrogate).
- `src/parser/mod.rs`: `\verb` delimiters of any width (byte slicing
  panicked); size groups use KaTeX's regexes (the value pattern is not
  anchored, spaces allowed) and report `Invalid unit` at the size; an empty
  `\color{}` is invalid; `parseRegexGroup` tokens without a common location
  just lack one. `src/types/source_location.rs`: `SourceLocation.range` of
  two tokens is null unless both have locations.
- `src/macro_expander.rs`: errors from macro functions and from lexing string
  expansions propagate (upstream swallowed them, so `\newcommand`, `\char`,
  `\tag` and `\@firstoftwo` checks never fired); argument EOF markers carry the
  argument end's location; `#0` is `Not a valid argument number`; a
  placeholder past the macro's arguments is V8's `TypeError`; `\edef`'s
  undefined control sequence has no position.
- `src/macros/builtins.rs`: `\char` and `\newcommand` follow macros.ts
  (offending digit token, UTF-16 code unit for `` \char` ``, JavaScript number
  formatting, `[ 2 ]` argument counts, `Invalid number of arguments: …`).
  `src/functions/char.rs`: `\@char` uses `parseInt`; a lone surrogate code
  point prints as U+FFFD (how it prints once well-formed; see
  `TokenText::LoneSurrogate` below).
- `src/functions/def.rs`: def.ts messages and positions; `\global` renames the
  lookahead token and parses it without re-expansion.
- `src/functions/environment.rs`, `src/define_environment/array.rs`,
  `src/define_environment/cd.rs`: errors located at KaTeX's tokens/nodes
  (name group, `\end` name, `parser.nextToken`, alignment nodes, `alignat`
  argument); `getHLines` and `matrix*` use the parser's `consumeSpaces` and
  `expect`; `\arraystretch` uses `parseFloat`; `row.length / 2` is a
  JavaScript division; katex@0.18.7 keeps an empty last row with a manual
  `\tag`; CD reads past the row end as V8 does (`TypeError`).
- `src/functions/delimsizing.rs`: `checkDelimiter` reports the symbol text or
  node type at the delimiter; `\middle` checks the delimiter first; `\middle.`
  is a plain null delimiter (not resized). `src/delimiter.rs`: the metrics
  error names the unreplaced symbol.
- `src/functions/genfrac.rs`: infix nodes keep their token (for the "only one
  infix operator" position); `\genfrac` is allowed in arguments and an
  unknown style level means no style. `src/functions/mclass.rs`: `\mathord`
  etc. are primitive. `src/functions/math.rs`: `$`/`\(` use `parser.expect`.
- `src/functions/includegraphics.rs`: the unanchored size pattern
  (`units::exec_size_regex`), `NaN` for `- 5`, the untrimmed key in messages.
- `build.rs`: `unicodeSymbols` decompositions are generated in
  unicodeAccents.js order with later entries winning, so stacked accents nest
  as in KaTeX (`ḉ` is c + cedilla + acute).
- `src/unicode/unicode_sup_or_sub.rs`: `ᵩ`/`ᵠ` map to ϕ (U+03D5).
- `src/build_common.rs`: `wideCharacterFont`'s `Unsupported character`
  error propagates.
- `src/units.rs`: `js_number` (JavaScript's `String(n)`: `-0` is `0`,
  exponent form outside [1e-6, 1e21)) and `js_round` (`Math.round`, halves
  toward +∞); `make_em` is exactly `+n.toFixed(4) + "em"` (exact ties round
  up, huge values read back as a Number, `NaNem`/`Infinityem`).
- `src/svg_geometry/mod.rs`: `doubleBrushStroke` joins with a space
  (leftlinesegment, rightlinesegment, leftmapsto, longequal); `tallDelim`,
  `innerPath` and `phasePath` print numbers with `js_number`.
- `src/functions/raisebox.rs`: the MathML `voffset` prints the number with
  `js_number` (`-0dd` gives `0dd`).
- `src/mathml_tree.rs`: MathML classes come after the attributes as
  ` class ="…"` (mathMLTree.ts), empty classes dropped.
- `src/functions/vcenter.rs`: `vcenter` is a MathML class, not an attribute.
- `src/functions/rule.rs`: MathML attribute order (`mathbackground`,
  `width`, `height`; `height`, `depth`, `voffset`), phantom color
  `transparent`; the HTML style has the color first.
- `src/functions/kern.rs`: the HTML builder is `makeGlue` (color before
  margin-right, maxFontSize 0); size errors are thrown, not replaced.
- `src/delimiter.rs`: a small delimiter's glyph gets no classes and is
  centered in its own style; tall `\sqrt` viewBox is
  `floor(1000·h + extraVinculum) + 80`; stacked delimiters round with
  `Math.round` and use unfused arithmetic.
- `src/functions/arrow.rs`: the arrow body's vlist wrapper has `svg-align`;
  label groups go through `wrapFragment`; unfused shift arithmetic.
- `src/stretchy.rs`: one leading backslash stripped for the MathML code
  point, `undefined` when a label has none; `\fbox` border color only when a
  color is set.
- `src/options.rs`: `having_size` keeps the style's `text()` variant
  (display and cramped survive) instead of forcing TEXT.
- `src/functions/accent.rs`: the base is built with the cramped options
  (not as base options).
- `src/build_common.rs`: `make_symbol` keeps the whole text (e.g. accent
  label `\c`), adds `mtight`/color after the SymbolNode constructor's
  `*_fallback` class; `lookup_symbol` of `""` has no metrics.
- `src/dom_tree.rs`: the script fallback class uses the first UTF-16 unit.
- `src/build_html.rs`: glue is inserted at `prev.insertAfter` (after the
  last visited node, explicit spaces and newlines included); struts and
  `katex-html` get no options; `vertical-align` for any nonzero depth; the
  tag strut height is always reset.
- `src/functions/sqrt.rs`: `padding-left` on any inner node; the
  `katex-root` wrapper has no options.
- `src/functions/lap.rs`: body built with plain options; clap's inner span
  and llap/rlap's `katex-inner` have no options; nonzero-depth strut.
- `src/functions/utils/assemble_sup_sub.rs`, `src/functions/supsub.rs`: the
  base wrapper and the empty base are option-less spans; unfused shifts.
- `src/functions/enclose.rs`: `\phase` viewBox height is floored and its
  span gets the options.
- `src/functions/op.rs`: `fName.length === 1` counts UTF-16 units (∯/∰ become
  `\oiint`/`\oiiint`); `\stackrel` (`suppressBaseShift: false`) shifts its
  base; the `\oiint` shift uses the vlist with the oval.
- `src/functions/operatorname.rs`: minus/asterisk replaced only in
  top-level symbols, first occurrence only.
- `src/functions/genfrac.rs`: unfused clearance arithmetic.
- `src/functions/mclass.rs`: `\mathord` … `\mathinner` are `primitive`.
- `src/types/parse_error.rs`: "Got group of unknown type: '<type>'" is a
  `ParseError`.
- KaTeX 0.18.7 additions: `src/functions/reflectbox.rs` (`\reflectbox`,
  `\mathreflectbox`, new `Reflectbox` parse node in
  `src/parser/parse_node.rs`) and the `\mapsfrom`/`↤` macros in
  `src/macros/builtins.rs`.
- `src/utils/js.rs`: `js_number_to_string` delegates to `units::js_number`,
  so there is one `Number#toString` (exponent form below 1e-6, as in V8).
- `src/dom_tree.rs`: the SymbolNode constructor replaces any text containing
  î/ï/í/ì with `iCombinations[text]`, so a longer text (e.g. the
  `katex-error` span of a formula with an î) prints `undefined`.
- `src/define_function/mod.rs`: `FunctionContext::loc()` is always `None`
  (KaTeX's handlers never set `loc`; only Parser.ts symbols, ligatures and
  ordgroups have one), and `src/parser/mod.rs` gives the verb node none, so
  errors at such nodes (`Invalid delimiter type 'genfrac'` for
  `\big\frac12`, `\left\verb|x|`) have no position.
- `src/functions/op.rs`: the MathML builder tests `group.body` like op.ts
  (an empty array is truthy), so `\mathop{}` and the base of
  `\underset{a}{}` are an empty `<mo>`, not a text operator.
- `src/functions/verb.rs`: the HTML builder walks UTF-16 units, so an
  astral character is two lone surrogates with no symbol-table `replace`
  (𝒜 stays 𝒜, not A) and no metrics (`build_common::make_symbol_without_metrics`).
- `src/functions/smash.rs`: each `[tb]` letter goes through
  `assertSymbolNodeType` (plain `Error` for `\smash[\text{t}]{y}` and, on
  the retry, `\smash[\hatx]{y}`).
- `src/types/tokens.rs` `TokenText::LoneSurrogate`, `src/functions/char.rs`,
  `src/build_common.rs` `make_ord`, `src/functions/operatorname.rs`: `\@char`
  of a surrogate code point is a lone surrogate that reads as U+FFFD but
  keeps its unit, so `\char"D835` reaches wideCharacterFont's `Unsupported
  character` as in makeOrd. Adjacent lone surrogates that KaTeX would join
  into one character in the output (`\text{\char"D83D\char"DE00}`) still
  print as two U+FFFD.
- `src/options.rs`: `having_style` compares style ids, as Options.ts
  compares its singleton styles (`this.style === style`). `STYLES` is a
  `const`, so equal styles could sit at different addresses and `ptr::eq`
  recomputed the size (e.g. `{\tiny \overbrace{\dfrac12}}`, whose body is
  built with `havingBaseStyle(DISPLAY)`).
- `src/functions/smash.rs`: the body is built without base options, so no
  sizing wrapper (smash.ts `html.buildGroup(group.body, options)`).
- `src/functions/verb.rs`: sized with `options.style.text()` (display style
  stays display, so no sizing classes), not always `TEXT`.
- `src/parser/mod.rs`: a Unicode sub/superscript is a token that is exactly
  one mapped character (`uSubsAndSups[lex.text]`). The lexer glues
  combining marks onto a character, so `x₃̌` is an accented `₃`, and
  `x₃͒` is an `Unknown accent` error.
- `src/build_mathml.rs`: `\not` before an astral character splits it the
  way `text.slice(0, 1)` does, into U+FFFD U+0338 U+FFFD once well-formed.
- `src/types/parse_error.rs`: the `\verb assertion failed` message keeps the
  newline and indentation of Parser.ts's two-line template literal.
- `src/units.rs`: `js_number` breaks a tie between two equally short and
  equally close digit strings toward the even digit, like V8
  (`853582677165355.25` prints as `…355.2`, not `…355.3`). `make_em`
  rounds exact toFixed ties up from 1e11 on as well.
- `src/types/tokens.rs` `Token::id`, `src/macro_expander.rs`
  `record_token`, `src/functions/def.rs`, `src/macros/builtins.rs`: token
  identity. KaTeX shares Token objects by reference (a macro expansion
  pushes the definition's own tokens, `#1#1` pastes the same argument
  tokens twice, `\let` stores the token it read) and mutates them in place
  (`\global` renames, `\noexpand` and letCommand set flags, treatAsRelax
  turns into `\relax`). Clones keep the id, `new Token` sites get a fresh
  one, and the expander replays recorded mutations when a copy is popped
  or peeked. So `\def\x{\def}{\global\x\y{a}}{\x\z{b}}\z` makes `\z`
  global (b), and `\def\a{A}\def\f#1{\noexpand#1#1}\f\a` renders nothing.
- `src/utils/js.rs` `js_parse_int`: `parseInt` without a radix reads a
  `0x`/`0X` prefix (after the sign) as radix 16, so `\text{\@char{0x41}}` is
  `A`, `\@char{-0x41}` an invalid code point and `\@char{0x}` non-numeric.
  Upstream read decimal digits only, so every hex argument was code 0.
- `src/delimiter.rs`: tall `\sqrt`'s `viewBoxHeight` and the stacked
  delimiter's `repeatCount` stay `f64` (upstream cast both to `i32`, which
  saturated for content taller than about 2.1e6em and 6.4e8em), and the
  viewBoxes and `sqrtTall` path (`src/svg_geometry/mod.rs`) print them with
  `js_number` (`10000000170`, `1e+22`, `Infinity`). `sqrt_svg` no longer
  scales `extraVinculum` to viewBox units twice (only visible with
  `minRuleThickness` above 0.04em).
- NaN and Infinity, which an `\arraystretch` near `f64::MAX` (or
  `Infinity`) or a 309-digit size produces: `src/units.rs` `js_max`/`js_min`
  are `Math.max`/`Math.min` (NaN propagates; Rust's `f64::max`/`min` return
  the other operand) and `js_truthy` is `if (x)` (NaN is falsy). Used at
  every `Math.max`/`Math.min` of the builders: `makeVList` (pstrut,
  `minPos`/`maxPos`), `tryCombineChars`, `makeLineSpan` (also
  `thickness || default`), `calculateSize`, `makeLeftRightDelim`,
  `extraVinculum`, array rule thickness, supsub shifts, enclose paddings,
  accent clearance and supsub height, `\left…\right` inner size and
  `assembleSupSub` kerns. Where KaTeX compares instead (array rows'
  `depth < elt.depth`, `\cfrac`'s strut), a NaN is kept, not replaced; the
  array separator's `if (shift)`, the struts' `if (depth)` and op's
  `if (baseShift)` skip NaN.
- `src/macro_expander.rs` `consume_arg`: a brace-delimited parameter
  (`\def\a#1#{x}`) given an argument that starts with `{` matches the
  delimiter at once and leaves no tokens, so MacroExpander.ts reads `.text`
  of `undefined`: V8's `TypeError: Cannot read properties of undefined
  (reading 'text')`, which the retry rethrows (so an earlier `ParseError`
  becomes the output). Upstream took it as an empty argument.
- `src/stack_guard.rs` `check_spread`: V8 passes a spread call's elements
  as arguments on its stack and throws `RangeError: Maximum call stack size
  exceeded` past about 125,500 (`MAX_SPREAD_ARGS`; the exact bound moves
  with stack depth and JIT state). Checked at every call spread KaTeX makes:
  `pushTokens` (scanArgument, expandOnce, expandTokens, `Parser.subparse`;
  also the in-place braced argument scan), the argument splice in
  `expandOnce` (`arg.length + 2`), `buildExpression`'s fragment flattening
  (`src/build_html.rs`), `<mtext>`/`<mn>` concatenation
  (`src/build_mathml.rs`) and `matrix*`'s `Math.max(0, ...rows)`
  (`src/define_environment/array.rs`). So `\color{red}` over 126,000 atoms
  is that `RangeError`, and a self-duplicating macro
  (`\def\d#1#{#1#1#1}\d\d a{e}`) stops there instead of growing the token
  stack until the process runs out of memory, as upstream did. `expandOnce`
  checks the placeholders first (same order, same errors) and sizes the
  pasted body, so an expansion the push would reject is never built (300
  placeholders of a 32k-token argument: KaTeX splices 10M tokens, then
  throws); an accepted one is built in one pass instead of by repeated
  `splice`.

### Performance

KaTeX re-scans each braced argument at every nesting level. Upstream
katex-rs did so ~40× slower than V8 (50,000 nested `\frac`s took 15 s against
KaTeX's 0.4 s), which let a single large formula tie up a render thread.

- `src/macro_expander.rs` `scan_braced_argument_in_place`: when a braced
  argument is already on the token stack (every level below the first),
  `scanArgument`'s pop-strip-push reduces to replacing the closing brace
  with the EOF marker and popping the opening brace, so no tokens move.
  Otherwise (tokens still in the lexer, or an EOF marker inside the group)
  the general path runs and reports the same errors.
- `src/macro_expander.rs` `consume_arg`: tokens are moved rather than cloned,
  each token's text is read and classified once, and the opening brace is
  popped after reversing instead of `remove(0)`.


- `Cargo.toml`: tests, benches, dev-dependencies and the wasm-bindgen
  dependencies; `publish = false`; build-dependency requirements on
  `serde`/`serde_json` relaxed to `1` to share the workspace's versions.

# Coverage policy

CI gates `cargo llvm-cov --workspace --ignore-filename-regex 'crates/writr-node/'`
on line coverage (see `.github/workflows/writr-rs.yml` for the current
threshold). Two categories of code are intentionally outside the gate:

## Excluded crate: `writr-node`

The napi bindings only execute inside a Node.js host, which
`cargo llvm-cov` cannot provide. Every exported function is exercised
end-to-end by the harness runs (`HARNESS_ENGINE=writr-rust pnpm test:harness`,
natively and with `WRITR_RS_FORCE_WASM=1`) and the browser smoke test.

## Documented unreachable lines

The remaining uncovered lines are defensive code that is unreachable by
construction. They are asserted as such in the test modules of the files
that contain them; the inventory:

- **`writr-core`** — `unreachable!()` arms guarded by prior matches
  (`from_mdast.rs`, `raw.rs`, `slug.rs`, `emoji.rs`, `to_html.rs`);
  let-else guards re-checking conditions already verified on the same
  value (`frontmatter.rs:33`, `from_mdast.rs` head-paragraph else);
  html5ever `TreeSink` plumbing the HTML tokenizer never invokes
  (`create_pi`, `finish`, doctype insertion in fragment mode, Debug
  impls); generated-table consistency guards (`property_info.rs`).
- **`writr-core`, known-divergence branches** — a handful of `raw.rs`
  branches are reachable only through inputs on the documented divergence
  list (see `KNOWN-DIVERGENCES.md`), e.g. fostering without an open table
  and cross-chunk rawtext resumption. They are left untested rather than
  enshrining behavior that intentionally differs from parse5 until fixed.
- **`writr-hljs`** — `unreachable!()`/fall-through arms proven by the
  surrounding control flow: multi-class re-match arms
  (`compile.rs`), the probe-memo monotonicity fall-through and
  sub-language re-check (`engine.rs`), the class-terminator member case
  (`regex_js.rs`), and the emitter stack invariant (`tree.rs`).
- **`writr-katex`** — the QuickJS engine-fault guard (`unwrap_or_else` on
  the embedded call): the KaTeX bootstrap wraps both render attempts in
  JS-level try/catch and always returns a string; even 20K-deep nesting
  throws a catchable RangeError (that path *is* tested).

When adding code, prefer making impossible states unrepresentable over
adding new justified exclusions; when an exclusion is genuinely needed,
document it here and in the nearest test module.

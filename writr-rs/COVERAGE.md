# Coverage policy

CI gates `cargo llvm-cov --workspace --ignore-filename-regex 'crates/writr-node/'`
on line coverage (see `.github/workflows/writr-rs.yml` for the current
threshold). Two categories of code are intentionally outside the gate:

## Excluded crate: `writr-node`

The napi bindings execute inside a Node.js or browser host. Rust line coverage
excludes this crate and does not measure its exported API paths. The historical
harness previously exercised only synchronous `render`; the expanded harness
now compares both `render` and `renderAsync`. Dedicated `pnpm test:bindings`
contract tests exercise all nine exports, including batch and packed-buffer
paths. Export discovery detects an untested new export.

Native and forced-WASM tests run in separate Node processes and verify artifact
selection. Chromium consumes shared JS-derived outcomes; its Buffer exports
currently fail without a browser Buffer polyfill. Local execution used Linux
x64/Node 24 and Chromium. Other Node versions and hosts are CI targets, not a
claim of completed local coverage. Consult generated JSON execution reports.

The new exact conformance tests currently expose unresolved compatibility
failures. A test failing on a real mismatch is not passing coverage evidence;
no updated coverage percentage is claimed. Existing coverage thresholds and
feature-compilation checks remain enabled in CI.

## Documented unreachable lines

The following is the historical inventory of defensive or difficult-to-reach
branches. It is not a claim that all newly added code is covered:

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
  and cross-chunk rawtext resumption. Shared JS-derived stage fixtures now probe these categories. Remaining
  reproduction gaps and failures are tracked in the divergence registry.
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

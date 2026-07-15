# Vendored: markdown-rs 1.0.0

Vendored copy of the [`markdown`](https://crates.io/crates/markdown) crate
(markdown-rs by Titus Wormer, MIT licensed — see `license`), applied to the
workspace via `[patch.crates-io]`.

## Why

`to_mdast()` in the upstream release drops leading *virtual spaces* — the
space-equivalent remainder of a tab that a container construct partially
consumed. micromark (the JS reference implementation this crate ports, and
the parser under writr's JS engine) materializes them as real spaces via
`sliceSerialize`, and upstream's own `to_html()` handles them via
`Slice::serialize`. Without the fix, CommonMark inputs like:

```markdown
- foo

\t\tbar
```

produce a code value of `bar` instead of `  bar`, diverging from remark and
failing the writr golden corpus (commonmark/0159, 0168, 0250).

## Patches

- `src/to_mdast.rs` `on_exit_data`: prepend `Slice::before` virtual spaces
  (marked `WRITR-RS PATCH`).

## Local changes to packaging

- Removed `tests/`, `examples/`, `Cargo.lock`, and registry metadata files to
  keep the vendored tree lean. `src/` is otherwise byte-identical to the
  crates.io release except for the patch above.

Upstream issue-worthy: yes — this is a general `to_mdast` fidelity bug, not a
writr-specific behavior.

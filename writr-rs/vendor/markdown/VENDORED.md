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

All patch sites are marked `WRITR-RS PATCH` in the source.

### Parity (match micromark / the writr JS engine byte-for-byte)

- `src/to_mdast.rs` `on_exit_data`: prepend `Slice::before` virtual spaces
  (tabs partially consumed by containers; commonmark/0159, 0168, 0250).
- `src/construct/gfm_autolink_literal.rs`: micromark's `previousUnbalanced`
  guards (autolink literals may not start while label starts are pending)
  and the email resolver emitting `GfmAutolinkLiteralEmail` for `mailto:`
  candidates (mailto handling lives at the mdast layer, as in micromark).
- `src/util/infer.rs` `list_loose`/`list_item_loose`: trailing blank lines
  after a list only make it loose when further items/content follow —
  micromark's scan-ahead semantics.
- `src/construct/flow.rs`: five byte-shortcut branches fall through to
  `FlowBeforeGfmTable` so table rows starting with `*`/`_`/`` ` ``/`#`/`<`
  can continue a table, like micromark's null-hook dispatch.
- `src/event.rs`, `gfm_autolink_literal.rs`: `#[allow(dead_code)]` on the
  `GfmAutolinkLiteralMailto` variant and `peek_protocol` helper the email
  resolver patch no longer constructs.

### Performance (semantics-preserving; gated by the 2,041-golden corpus)

Combined ~39% faster than upstream 1.0.0 on writr's benchmark corpus:

- `src/util/edit_map.rs` `consume`: single-pass rebuild of the events list
  instead of one `split_off` (allocation + tail copy) per edit.
- `src/construct/partial_data.rs` + `src/tokenizer.rs`
  (`consume_data_run`, `feed_end_index`): bulk-consume plain text runs
  instead of one state-machine round trip per byte, clamped to the current
  feed chunk.
- `src/construct/text.rs` `markers_for`: data-run stop markers only include
  bytes whose construct is enabled (`h`/`w` for GFM autolink literals, `$`
  for math, `{` for MDX) — disabled constructs no longer fragment text runs.
- `src/util/char.rs` `classify`: ASCII lookup table in front of the
  linear scan over the Unicode punctuation list.
- `src/tokenizer.rs` `move_one`: inline fast path for the `Normal` byte
  action (everything except `\r`/`\t`).
- `src/tokenizer.rs` `Tokenizer::new`: pre-sized events buffer.

## Local changes to packaging

- Removed `tests/`, `examples/`, `Cargo.lock`, and registry metadata files to
  keep the vendored tree lean. `src/` is otherwise byte-identical to the
  crates.io release except for the patch above.

Upstream issue-worthy: yes — this is a general `to_mdast` fidelity bug, not a
writr-specific behavior.

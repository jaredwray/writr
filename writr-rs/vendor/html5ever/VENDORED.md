# html5ever compatibility patch

Source: html5ever 0.39.0, crates.io checksum
`46a1761807faccc9a19e86944bbf40610014066306f96edcdedc2fb714bcb7b8`.
MIT/Apache-2.0 licenses are retained. Dependencies and version are unchanged.
Cargo uses this directory through `[patch.crates-io]`.

The Writr JS oracle pins parse5 7.3.0. html5ever 0.39 implements newer select
parsing that preserves children the oracle drops. Restore the upstream
html5ever-v0.35.0 InSelect/InSelectInTable algorithms and transitions, adapted
to the current token-match syntax. Source:
https://github.com/servo/html5ever/tree/html5ever-v0.35.0/html5ever/src/tree_builder

Changes are confined to tree_builder/{rules,mod,types,tag_sets}.rs:
- Restore select insertion modes, scope and reset/start-tag transitions.
- Treat MathML annotation-xml as a scope boundary, matching pinned parse5.

Only library source, package metadata and licenses are vendored; upstream
examples/benchmarks/tests are omitted. Writr's shared JS-generated exact and
stage fixtures cover these behaviors, alongside the existing full corpus.

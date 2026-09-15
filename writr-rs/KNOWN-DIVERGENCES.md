# Known divergences from the JS engine

The historical 2,041 **assigned input/profile cases**, from 1,000 unique corpus
documents plus diagnostics, use normalized HTML snapshots. They are not 2,041
documents multiplied by seven profiles. New exact tests expose differences
that normalization or the original fixture selection did not cover.

The authoritative registry is [`test/harness/divergences.json`](../test/harness/divergences.json).
It retains D01–D14 with linked JS-generated cases, stage/public reachability,
disposition and remaining blockers. All tests assert compatibility directly;
there are no expected-failure exceptions and the allowlist remains empty.

## Current evidence

All linked regression fixtures pass locally. Dispositions are scoped to those
fixtures; neither passing cases nor an empty allowlist prove universal stage
compatibility. The generated report also requires every intended CI host and
runtime before marking the testing milestone complete.

- D01's malformed table tree without an open table matches current JS; no
  remaining counterexample is established by that original claim.
- D02/D04/D05/D09–D12 match after the rawtext, template/foreign-content,
  serialization, slug and NUL corrections.
- D03/D08 use the JS pipeline's document-versus-fragment detection, preserving
  synthesized document structure and a leading doctype.
- D06 restores annotation-xml as a scope boundary.
- D07 restores upstream html5ever's earlier select insertion modes, matching
  pinned parse5; the same html5ever version and dependencies are retained.
- D13 rejoins escaped text with tokenizer-created autolink suffixes before
  applying the existing GFM transformation.
- D14 uses real Acorn/JSX grammar callbacks in QuickJS, validates import scope
  after speculative tokenization, and rejects incomplete JSX at EOF. User
  expressions and imported modules are never executed.
- CR/CRLF are preserved in source text/code. A marker-only list prefix counts
  logical columns rather than the ignored CR byte. The earlier assertion that
  every CRLF render equals LF was incorrect for the actual JS oracle.
- Browser packed output uses Uint8Array without a Buffer polyfill; Node output
  remains Buffer in both native and forced-WASM mode.

Runtime, packaging and performance readiness require independent evidence.
No engine switch, dependency version upgrade or package release is included.

## Original category descriptions (historical, retain numbering)

The descriptions below record the original review and must be read alongside
the current registry dispositions above; several selected cases are now fixed.

## Raw HTML (`rehype-raw` / parse5 vs html5ever replay)

1. **Foster-parenting without an open table** — synthetic trees that
   trigger fostering when no table is open place nodes slightly
   differently than parse5.
2. **Rawtext elements spanning raw chunks** — a `<script>`/`<style>`/
   `<textarea>` whose end tag arrives in a *later* raw chunk loses the
   closing tag: each chunk re-tokenizes with a fresh tokenizer and the
   "last start tag" state is not carried across (documented limitation of
   the replay port).
3. **Doctype nodes mid-stream** — the JS pipeline switches to full
   document parsing when a raw doctype appears; the port keeps fragment
   parsing (doctype handling in fragment mode is a no-op).
4. **Synthesized `<template>` content** — the JS engine drops template
   contents synthesized from hast; the port keeps them.
5. **CDATA in foreign content** (`<svg><![CDATA[x]]></svg>`) — becomes a
   bogus comment because the tokenizer's adjusted-current-node callback
   is not forwarded; parse5 parses it as text.
6. **`<math><annotation-xml encoding="text/html">` integration points** —
   not honored for the same reason as (5).
7. **Newer WHATWG `<select>` parser changes** — html5ever 0.39 keeps
   `<div>` children inside `<select>` where parse5 (pinned by the JS
   engine) drops them.
8. **Explicit `<html>`/`<head>`/`<body>` structure inputs** — body text
   directly under a synthesized document structure can be dropped.

## Serialization / properties

9. **Trailing-empty comma lists** — `accept=","`-style values serialize
   with a trailing space (`hast-util-to-html` trims the joined string;
   the port misses that final trim). Affects `to_html.rs` and the raw
   attribute path.
10. **`Infinity` number properties** — serialized as `inf` (Rust float
    formatting) instead of JS's `Infinity`; whitespace-only number
    attributes stay strings where JS coerces `Number(" ") === 0`.

## Slugs

11. **Headings inside `<template>`** — `rehype-slug` does not descend into
    template contents; the port does (extra ids shift `-1`/`-2` dedupe
    counters). It also appends a duplicate `id` property when a falsy
    (`id=""`) property exists instead of overwriting it.

## Vendored parser (markdown-rs vs micromark)

12. **NUL bytes** are not replaced with U+FFFD.
13. **Autolink literals after escapes** — `foo\+bar@example.com`
    autolinks the tokenizer path where micromark rejects it (the mdast
    transform layer compensates for the corpus-visible cases).
14. **MDX edge inputs** — ESM (`import`/`export`) parses as a paragraph,
    and a bare unclosed `<Tag` at EOF is treated as text where micromark
    raises a syntax error.

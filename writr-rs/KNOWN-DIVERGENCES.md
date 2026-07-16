# Known divergences from the JS engine

The golden harness (2,041 documents × 7 profiles, byte-exact, empty
allowlist) is the compatibility contract, and writr-rs meets it fully.
While driving `writr-core` to full line coverage, oracle testing against
the real JS engine surfaced a small set of divergences on inputs *outside*
that corpus. They are documented here rather than silently shipped; none
affects any golden. Each is a candidate for a follow-up fix + a new
diagnostic golden.

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

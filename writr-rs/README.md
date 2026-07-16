# writr-rs

A Rust implementation of [writr](https://writr.org)'s markdown engine that
reproduces the JavaScript unified/remark/rehype pipeline **byte-for-byte** —
parser, GFM, alerts, table of contents, emoji, slugs, syntax highlighting,
KaTeX math, raw HTML, and MDX — shipped as a native Node.js addon, a
WebAssembly module, and a browser ESM entry point.

## Parity status

| Suite | Scale | Status |
| ----- | ----- | ------ |
| Golden harness (`test/harness`), all 7 profiles | 2,041 goldens | byte-exact, **empty allowlist** |
| …the same suite through the napi addon | 2,041 goldens | byte-exact (`HARNESS_ENGINE=writr-rust`) |
| …the same suite through the wasm build | 2,041 goldens | byte-exact (`WRITR_RS_FORCE_WASM=1`) |
| highlight.js oracle fixtures (real hljs 11.11.1 output) | 2,111 fixtures | byte-exact |
| Browser (headless Chromium, `browser.js`, no COOP/COEP) | 11 feature documents | byte-identical to native |

The compatibility contract is the repository's golden-snapshot harness: every
document is compared byte-exactly after trivial normalization (CRLF → LF,
trailing whitespace, one trailing newline). `test/harness/allowlist.json`
records approved divergences per engine — for `writr-rust` it is empty.

## Layout

```
writr-rs/
  crates/
    writr-core/         # the engine: parse → mdast transforms → hast → html
    writr-hljs/         # highlight.js 11.11.1 engine port + 36 grammars
    writr-katex/        # katex.min.js 0.16.45 embedded in QuickJS (rquickjs)
    writr-conformance/  # renders ../test/harness goldens, byte-diffs them
    writr-node/         # napi-rs bindings: native .node, wasm32-wasip1, browser.js
  vendor/markdown/      # vendored markdown-rs 1.0.0 + parity patches (see VENDORED.md)
  tools/                # codegen from the real npm packages + build/smoke scripts
```

The pipeline mirrors writr's `createProcessor()` order exactly — order is
load-bearing:

```
frontmatter strip → markdown-rs (constructs per options)
  → mdast: gfm alerts → toc → emoji → autolink-literal fixups
  → hast: raw (html5ever replay) → slug → highlight → katex
  → html serializer (hast-util-to-html@9 semantics)
```

## Options

Runtime flags mirror writr's JS `RenderOptions` 1:1 (`emoji`, `toc`, `slug`,
`highlight`, `gfm`, `math`, `mdx`, `rawHtml` — same defaults). Each plugin is
also a cargo feature (all on by default) so embedders can compile out the
heavyweight pieces (hljs grammars, the ~1 MB KaTeX bundle, the emoji table).
A runtime flag whose feature was compiled out fails loudly with
`RenderError::FeatureDisabled`, never with silent divergence.

```rust
use writr_core::{render, RenderOptions};

let html = render("# Hello World", &RenderOptions::default())?;
assert_eq!(html, "<h1 id=\"hello-world\">Hello World</h1>");
```

Node (after `pnpm build:rs`):

```js
const { render, renderAsync, validate, renderToMdast, engineVersion } =
	require("writr-rs/crates/writr-node");
render("# Hello World"); // sync — no async pipeline, no cache needed
```

Browser (bundler-friendly ESM; the wasm is fetched at runtime; single-threaded
build, so **no SharedArrayBuffer and no COOP/COEP headers required**):

```js
import { render, renderBatch } from "writr-rs/crates/writr-node/browser.mjs";
```

## Building

```sh
pnpm build:rs        # native addon → crates/writr-node/writr-node.node
pnpm build:rs:wasm   # wasm32-wasip1 → crates/writr-node/writr-node.wasm32-wasi.wasm
```

Native needs stable Rust (pinned in `rust-toolchain.toml`). The wasm build
additionally needs `rustup target add wasm32-wasip1`, a clang able to target
wasm32 with a WASI sysroot for QuickJS's C sources (Ubuntu:
`apt-get install wasi-libc libclang-rt-<N>-dev-wasm32 llvm`, or set
`WASI_SDK_PATH`), and `pnpm install` inside `crates/writr-node` (provides the
emnapi link archive). The addon links single-threaded emnapi
(`crates/writr-node/build.rs`) — async work runs on the main thread in wasm;
native builds use the real libuv thread pool.

## Testing

```sh
cargo test --workspace                            # unit + fixtures + 2,041 goldens
HARNESS_ENGINE=writr-rust pnpm test:harness       # same goldens through the addon
HARNESS_ENGINE=writr-rust WRITR_RS_FORCE_WASM=1 pnpm test:harness
node tools/browser-smoke.mjs                      # Chromium, byte-compares vs native
cargo llvm-cov --workspace --ignore-filename-regex 'crates/writr-node/' --fail-under-lines 97
cargo bench -p writr-core --bench pipeline        # stage-level criterion benches
npx tsx benchmark/benchmark-rust.ts               # engine vs writr-JS vs marked/markdown-it
```

`writr-node` is excluded from the coverage gate: its code paths require a
Node.js host and are exercised end-to-end by the harness runs above. The
workspace sits at ~98% lines; every uncovered line is a documented
unreachable-by-construction branch (see `COVERAGE.md`). Edge-case behavior
differences vs the JS engine found during oracle testing — none reachable
from the golden corpus — are tracked in `KNOWN-DIVERGENCES.md`.

Codegen freshness: every table under `crates/*/src/generated` and
`crates/writr-hljs/grammars` is generated from the **pinned npm packages**
writr itself uses (`tools/gen-all.mjs`); CI re-runs the generators and fails
on drift.

## Performance

Uncached, on this repo's `benchmark-contents.ts` documents (~660 bytes each,
Node 22, x86_64 Linux, **4 shared vCPUs** — gaps widen with real cores):

**Whole-corpus throughput** (101 documents per call — the static-site /
docs-pipeline workload):

| Engine | minimal profile | default profile (gfm+emoji+toc+slug+highlight+math) |
| ------ | --------------- | ---------------------------------------------------- |
| **writr-rs `renderBatchBuffer` (bytes in/out, all cores)** | **~34,000 docs/s** | — |
| **writr-rs `renderBatch` (all cores)** | **~33,000 docs/s** | **~9,700 docs/s** |
| markdown-it (single-threaded loop) | ~22,000 docs/s | *(not comparable — no highlight/math/slugs)* |
| marked (single-threaded loop) | ~15,000 docs/s | *(not comparable)* |
| writr JS | ~1,700 docs/s | ~690 docs/s |

`renderBatch` renders across all cores in one native call — a mode no
JS markdown library can express in-process. Even on 4 shared vCPUs it beats
markdown-it by ~50% and marked by ~120%; on an 8-core machine the multiple
roughly doubles. `renderBatchBuffer` additionally moves documents in and
HTML out as one packed Buffer each way (zero per-document JS strings), so
the main-thread marshalling cost stops growing with the batch. With writr's
render cache on top, repeat renders measure in the millions of ops/s.

**Single-document latency** (one doc per call, single core):

| Engine | minimal profile | default profile |
| ------ | --------------- | ---------------- |
| writr-rs (sync, napi) | ~11,000 ops/s | **~4,000 ops/s** |
| writr JS (sync) | ~1,700 ops/s | ~565 ops/s |
| marked / markdown-it | ~20–24K ops/s | *(not comparable)* |

writr-rs is ~5–6.5× writr-JS per call with no cache warm-up. For bare
CommonMark single-doc latency markdown-it's hand-tuned JS is still ~2×
faster than our micromark-faithful parser (51µs vs ~109µs through the
addon, ~96µs engine-side) — that trade is deliberate:

- The parser is the vendored markdown-rs (a faithful micromark port) —
  that architecture is *why* 2,041 goldens match byte-exactly. The perf
  patches in `vendor/markdown` (documented in `VENDORED.md`) make it
  **~1.6× the speed of upstream markdown-rs 1.0.0** on this corpus
  (single-pass `EditMap::consume`, bulk data-run consumption,
  construct-aware data markers, ASCII classification table, inlined
  byte-advance fast path, 40-byte `u32` events); a position-exact state
  machine simply does more work per byte than a loose line scanner, and
  fusing out the intermediate mdast stage (~10% more) is the documented
  next step if that niche ever matters more than parity.
- The hljs engine races per-rule automata (`regex` crate) with non-fancy
  prefilters in front of the backtracking fallback, memoizes probes, and
  keeps the hot loop copy-free (borrowed lexemes, span-based keyword
  segmentation) — byte-identical on all 2,111 fixtures.
- The serializer streams attributes and entity-escaped text straight into
  a capacity-seeded output buffer (no per-node/per-attribute strings).
- KaTeX renders are memoized at two levels (HTML string in QuickJS glue,
  parsed hast fragment in the pipeline), so repeated formulas cost a clone.
- Native release builds can squeeze out another ~2–5% with profile-guided
  optimization: `pnpm build:rs:pgo`.

## Parity-critical pinned versions

highlight.js **11.11.1** · katex **0.16.45** · node-emoji **2.2.0** /
emojilib 2.4.0 · github-slugger **2.0.0** · lowlight 3.3.0 ·
property-information 7.1.0 · mdast-util-to-hast 13.2.1 · hast-util-to-html
9.0.5 · micromark 4.0.2 (via markdown-rs 1.0.0, vendored with patches
documented in `vendor/markdown/VENDORED.md`).

Do not bump these on one side only — regenerate the tables (`tools/`) and the
goldens together, and keep the allowlist empty.

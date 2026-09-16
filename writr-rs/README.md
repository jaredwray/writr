# writr-rs

A Rust implementation of [writr](https://writr.org)'s markdown engine, with
native Node.js, WASM and browser entry points. The JavaScript engine remains the
compatibility oracle and default. Compatibility is checked against the committed JS-derived regression inventory.

## Parity status

The historical suite contains 1,000 unique corpus documents and 2,041 assigned
input/profile cases (1,968 corpus plus 73 diagnostic goldens). Those goldens use
lossy whitespace normalization. New checks separately compare untrimmed JS
sync/async and Rust sync/async output and consume 113 JS-derived public exact
outcomes plus 15 internal HAST outcomes. The allowlist remains empty.

The expanded fixtures now pass locally after MDX grammar, line-ending,
autolink and HTML tree-building corrections. The [divergence registry](../test/harness/divergences.json)
retains D01–D14 with linked regression fixtures and current dispositions.
See the [harness guide](../test/harness/README.md) for the scope of that evidence.

The dedicated binding suite exercises all nine exports under native and forced
WASM. `pnpm test:bindings:mdx` isolates MDX success/rejection cases across those
APIs. Chromium uses the same JS oracle fixtures without COOP/COEP. Packed output
is Uint8Array in browsers and Buffer in Node; a Buffer polyfill is unnecessary.
Local execution used Linux x64/Node 24 and Chromium. CI also requires Node
22/24/26 and Linux/macOS/Windows; consult its reports for the complete milestone.

MDX syntax validation runs the oracle's Acorn/JSX parser in the already-used
QuickJS library. Expressions and imports are never evaluated. Parser versions,
licenses and code generation live in `crates/writr-core/vendor/mdx`; each thread
lazily retains one parser context without caching parsed inputs. The patched
html5ever 0.39 library preserves the select rules used by pinned parse5. The
[recorded benchmark](../benchmark/results/2026-09-16-native-vs-js/README.md)
measures these correctness changes, including MDX and uncached math.

## Layout

```
writr-rs/
  crates/
    writr-core/         # the engine: parse → mdast transforms → hast → html
    writr-hljs/         # highlight.js 11.11.1 engine port + 36 grammars
    writr-katex/        # katex.min.js 0.18.7 embedded in QuickJS (rquickjs)
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

Math memoization defaults to enabled. `caching: false` bypasses reads and writes
in both internal math caches (including async and batch calls); it does not
clear entries shared with other callers. The HTML cache is process-wide and
the parsed-output cache is per thread. Each uses FIFO eviction at **256 entries
or 4 MiB of retained payload**, whichever comes first. Oversized entries render
normally without being cached. Payload accounting includes formula keys and
owned string/vector capacities; fixed container and allocator overhead is extra
but bounded by the entry limit. Each active rendering thread also retains its
QuickJS context, even with caching disabled. These are cache retention limits,
not a cap on total process memory or temporary rendering allocations.

Runtime flags mirror writr's JS `RenderOptions` 1:1 (`emoji`, `toc`, `slug`,
`highlight`, `gfm`, `math`, `mdx`, `rawHtml`, `caching` — same defaults). Each plugin is
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
cargo test --locked --workspace --no-fail-fast     # unit, historical and exact fixtures
HARNESS_ENGINE=writr-rust pnpm test:harness       # same goldens through the addon
HARNESS_ENGINE=writr-rust WRITR_RS_FORCE_WASM=1 pnpm test:harness
node tools/browser-smoke.mjs                      # Chromium against shared JS outcomes
cargo llvm-cov --workspace --ignore-filename-regex 'crates/writr-node/' --fail-under-lines 97
cargo bench -p writr-core --bench pipeline        # stage-level criterion benches
pnpm exec tsx benchmark/benchmark-rust.ts               # engine vs writr-JS vs marked/markdown-it
```

`writr-node` is excluded from Rust line coverage. Dedicated native/WASM binding
and browser contract tests complement that metric; they do not measure binding
crate line coverage. Run `pnpm test:bindings` from the repository root in each
mode. The exact regression inventory passes locally; broader host coverage must be
confirmed by CI before claiming the testing milestone is complete.

Codegen freshness: every table under `crates/*/src/generated` and
`crates/writr-hljs/grammars` is generated from the **pinned npm packages**
writr itself uses (`tools/gen-all.mjs`); CI re-runs the generators and fails
on drift.

## Performance

The [September 16, 2026 benchmark](../benchmark/results/2026-09-16-native-vs-js/README.md)
compares the current JS implementation with the native Rust addon at revision
`abd1e42` (merged in PR #547). It uses Node 24.19, a release Rust build, and a
Linux VM exposing two logical CPUs. Caching is disabled in both engines;
initialization is warmed before timing. Every measured API path must produce
exactly matching HTML before benchmarking.

Median of five fresh-process runs; times are average microseconds per document:

| Workload | JS sync | Native Rust sync | Rust / JS throughput |
| --- | ---: | ---: | ---: |
| Minimal Markdown, 101 documents | 565.3 µs | 104.5 µs | 5.41× |
| Default Markdown, same 101 documents | 1,597.2 µs | 323.0 µs | 4.94× |
| MDX, 21 small regression inputs | 267.6 µs | 403.9 µs | 0.66× |
| Math, 8 synthetic documents | 2,503.8 µs | 3,994.5 µs | 0.63× |

Rust is faster for the measured Markdown corpus; MDX and uncached math take
about 51% and 60% more time, respectively. For default Markdown, `renderBatch`
with two Rayon threads reaches 3,967 documents/s versus 626 documents/s for
the JS sync loop (6.34× throughput). This batch comparison measures parallel
Rust against sequential JS. The report also includes sequential async and
packed-buffer results, run-to-run ranges, options, inputs and artifact hashes.

The MDX and math cases are diagnostic workloads, not a production traffic mix.
These results do not measure cold start, memory, output-cache hits or latency
under concurrent service load. Packed-buffer timings exclude packing input
strings and decoding output bytes. Shared VM results can vary.

Reproduce from the repository root:

```sh
pnpm build
pnpm build:rs
pnpm benchmark:native
```

The runner writes fresh JSON and Markdown reports to
`test-output/benchmarks/native-vs-js/`; it never rewrites the committed snapshot.

## Parity-critical pinned versions

highlight.js **11.11.1** · katex **0.18.7** · node-emoji **2.2.0** /
emojilib 2.4.0 · github-slugger **2.0.0** · lowlight 3.3.0 ·
property-information 7.2.0 · mdast-util-to-hast 13.2.1 · hast-util-to-html
9.0.5 · micromark 4.0.2 (via markdown-rs 1.0.0, vendored with patches
documented in `vendor/markdown/VENDORED.md`).

Do not bump these on one side only — regenerate the tables (`tools/`) and the
goldens together, and keep the allowlist empty.

# Markdown Golden-Snapshot Harness

A large-scale regression harness that pins the exact HTML output of writr's
current markdown engine across a diverse corpus of real-world markdown. It
exists to make the upcoming **JS → native (Rust) engine migration safe**: the
current engine's output is the source of truth, and the new engine must
reproduce it (or record a reviewed, intentional difference).

## How it works

1. **Fetch** a diverse, license-attributed corpus of markdown from pinned public
   sources (CommonMark spec, GFM spec, markdown-it fixtures, and every public
   `github.com/jaredwray/*` repo — they all consume writr).
2. **Generate** golden HTML by rendering every example with today's engine under
   a set of named [profiles](./profiles.ts), committing the output as snapshots.
3. **Check** any engine against those goldens with the Vitest runner.

```
corpus inputs ──render(profile)──▶ goldens/<profile>/<id>.html
                                          ▲
        new engine ──render(profile)──────┘  (must match, or be allowlisted)
```

## What's committed

Both the corpus **inputs** and their **golden outputs** are checked into the
repo, so a fresh clone can run `pnpm test:harness` immediately — no network and
no generation step required. Goldens are regenerable artifacts (`pnpm
golden:generate`); they are committed so the migration target has a fixed
contract to diff against and so drift in the current engine is caught in review.

Current snapshot:

| source | docs | what it is |
|---|---:|---|
| commonmark | 443 | CommonMark spec example blocks |
| jaredwray | 339 | every public `jaredwray/*` repo's markdown (writr consumers) |
| markdown-it | 163 | markdown-it self-test fixtures |
| gfm | 41 | GitHub GFM spec example blocks (GFM-specific survivors after dedupe) |
| docs | 14 | permissively-licensed real-world READMEs |
| **total** | **1000** | unique documents (deduped by content hash) |

Rendered under their assigned [profiles](./profiles.ts) this yields **2041**
golden files (1968 corpus + 73 diagnostics). Exact per-document provenance
(source, license, attribution, sha256, profiles) lives in
[`corpus/manifest.json`](./corpus/manifest.json).

## Commands

```bash
pnpm corpus:fetch          # fetch/refresh the corpus (online; caches raw payloads)
pnpm corpus:fetch:offline  # rebuild corpus from committed cache only (no network)
pnpm golden:generate       # render the corpus + diagnostics, write goldens + versions.json
pnpm golden:check          # verify committed goldens still match the current engine (CI gate)
pnpm test:harness          # run the Vitest runner against committed goldens
```

`pnpm corpus:fetch` flags: `--cap=<N>` (default 1000), `--source=<id>`,
`--offline`. `pnpm golden:generate` flags: `--check`, `--profile=<a,b>`,
`--id=<substring>`, `--diagnostics-only`, `--corpus-only`, `--concurrency=<n>`.

The harness is intentionally excluded from the default `pnpm test` and coverage
run (see `vitest.config.ts` exclude + `vitest.harness.config.ts`) so the
1000+-file suite never slows the normal dev loop.

## Layout

```
test/harness/
  profiles.ts            named RenderOptions configurations (the contract surface)
  render-adapter.ts      RenderAdapter interface + WritrJsAdapter (swap engines here)
  normalize.ts           non-semantic normalization applied before comparison
  diff.ts                first-divergence reporting (index, line/col, context)
  allowlist.json         reviewed intentional divergences (per engine)
  generate-goldens.ts    golden generator (also powers golden:check)
  harness.test.ts        Vitest runner
  fetch/                 corpus fetcher + per-source extractors + cached raw payloads
  corpus/inputs/         committed corpus markdown (~1000 docs)
  corpus/manifest.json   provenance: source, license, attribution, sha256, profiles
  goldens/<profile>/     committed golden HTML
  diagnostics/<feature>/ hand-authored per-feature examples (pinpoint failures)
  diagnostics-goldens/   their goldens
  versions.json          plugin versions captured at generation (drift auditing)
```

## Profiles

Profiles are explicit `RenderOptions` combinations (not the full combinatorial
space). `default` is the primary contract; `commonmark` and `gfm-only` isolate
the core; `no-highlight` / `no-math` let a new engine pass core contracts before
achieving highlight.js / KaTeX parity; `rawhtml` and `mdx` exercise those paths.
See [`profiles.ts`](./profiles.ts).

## Adding the Rust engine

1. Implement `RenderAdapter` in `render-adapter.ts` (e.g. `WritrRustAdapter`,
   spawning the binary or calling N-API/WASM bindings) and register it in
   `getAdapter()`.
2. Run `HARNESS_ENGINE=writr-rust pnpm test:harness`. Failures report the exact
   first-divergence location per example.
3. For any *intentional* difference, add an entry to `allowlist.json` keyed by
   `engine` (with a reason + approver). The JS engine is unaffected by Rust
   allowlist entries.

## Determinism, drift & provenance

- Rendering forces `caching: false`; generation asserts `renderSync` ==
  `render`; empty output for non-empty input is a hard error (never a silent
  empty golden).
- KaTeX / highlight.js output is version-sensitive. `versions.json` records the
  resolved versions so a bump is auditable in review; regenerate only the
  affected profiles, e.g. `pnpm golden:generate --profile=default,no-math`.
- Every corpus document carries `source`, `license`, and `attribution` in
  `manifest.json`. Spec content is CC-BY-SA; jaredwray/other repos carry their
  own license. Raw fetched payloads are cached under `fetch/cache/` so the
  corpus is reproducible offline.
```

# JavaScript oracle and Rust/WASM parity tests

The current JavaScript Writr implementation is the compatibility oracle.
Historical normalized snapshots and exact output comparisons are separate checks.
The allowlist remains empty; a mismatch or missing test input fails the gate.

## Inventory

There are 1,000 unique corpus documents. They run under assigned profiles, not
under every profile. The 2,041 historical input/profile cases remain unchanged:

| Profile | Corpus | Diagnostics | Total |
| --- | ---: | ---: | ---: |
| default | 1,000 | 37 | 1,037 |
| commonmark | 443 | 11 | 454 |
| gfm-only | 41 | 11 | 52 |
| no-highlight | 0 | 5 | 5 |
| no-math | 0 | 3 | 3 |
| rawhtml | 484 | 3 | 487 |
| mdx | 0 | 3 | 3 |
| Total | 1,968 | 73 | 2,041 |

`inventory.ts` derives cases from the corpus manifest and diagnostic inputs and
profile mapping. Missing manifests, inputs or goldens, unknown profiles,
duplicate IDs, orphan goldens, incorrect counts and corrupt inputs fail before
rendering. It validates canonical corpus bytes and SHA-256 hashes. Rust reads
the same inventory and validates counts, canonical bytes and file coverage;
SHA-256 validation runs in the JavaScript gate. `profiles.json` defines the
seven profiles; a Rust regression test checks its option values against Rust.

The new shared `exact/outcomes.json` contains 113 public cases and 15 HAST stage
cases. These include original diagnostics, selected existing real documents for
no-highlight/no-math, 12 representative browser corpus documents, and a pairwise
option matrix on two feature-rich inputs. These counts are distinct from API
executions: one case can exercise many exports. Fixture inputs retain provenance.

## Comparisons and errors

Every assigned legacy case compares current JS sync and async HTML exactly.
The native and forced-WASM harness also compares both binding paths to those
untrimmed JS results. Historical normalized goldens remain an additional check.
Normalization removes trailing spaces/tabs and normalizes line endings; it can
hide meaningful preformatted whitespace and is not evidence of exact parity.

Exact fixtures contain tagged successful HTML or an explicitly declared parse
rejection. Empty HTML without an error is a legitimate success. JS error events
from sync and async paths are captured. Only recognized parser errors count as
parse rejection; crashes, unknown exceptions, timeouts and missing binaries fail.
JS diagnostic details are recorded without requiring matching exception text.
Only the real JS engine generates expected output, including HAST stage output.

## Commands (repository root)

```sh
pnpm golden:check                  # full, read-only inventory, versions and oracle check
pnpm golden:generate --id=example  # scoped historical generation for development
pnpm golden:exact:generate         # regenerate exact fixtures from current JS only
pnpm golden:exact:check
pnpm test:harness                  # JS paths plus disposable integrity tests
pnpm build:rs
HARNESS_ENGINE=writr-rust pnpm test:harness
pnpm test:bindings
pnpm test:bindings:mdx             # isolated MDX cases across all binding APIs
pnpm build:rs:wasm
HARNESS_ENGINE=writr-rust WRITR_RS_FORCE_WASM=1 pnpm test:harness
WRITR_RS_FORCE_WASM=1 pnpm test:bindings
cargo test --locked --workspace --no-fail-fast --manifest-path writr-rs/Cargo.toml
node writr-rs/tools/browser-smoke.mjs
node test/harness/summarize.mjs
```

Use the repository's Safe Chain pnpm shims and frozen lockfiles for installs.
The binding package needs its own locked dependencies and documented WASI build
prerequisites. Install Chromium with that package's Playwright installation.
Fixtures run offline once dependencies and browser binaries are installed.
Ordinary `pnpm test` excludes the harness and dedicated binding configuration.

`golden:generate` also accepts `--profile`, `--corpus-only` and
`--diagnostics-only`; complete inventory validation still precedes scoped work.
`golden:check` writes nothing, including timestamps or version metadata. It checks
resolved rendering dependencies against `versions.json`, ignoring the root
release version. Update expectations only after explaining an actual oracle
change; never refresh the corpus or generate expectations from Rust to fix a
failure. Historical snapshots are preserved by this change.

To add a regression, declare its ID, input (or corpus reference), options/profile,
provenance and explicit rejection intent in `exact/inputs.json`; internal HAST
cases go in `exact/stages.json`. Generate with JS, inspect the exact output/error,
and link relevant D01–D14 entries in `divergences.json`. Inventory failure tests
use disposable directories and never delete committed fixtures.

## Binding, browser and CI evidence

`test/bindings/contract.mjs` exercises all nine exports, including sync/async,
empty and malformed batches, packed UTF-8 ranges, defaults, caching options,
validation, MDAST structure and version metadata. Async inputs remain immutable
until completion. Child processes have external deadlines; native and forced
WASM run in separate processes and prove which artifact loaded. Missing forced
WASM must fail even when a native artifact exists. Export inventory is checked. Node also exposes three internal N-API task
classes; the contract verifies that they have no public methods or usable constructors.

Chromium consumes the same JS fixtures without COOP/COEP. Packed outputs are Uint8Array in browsers and remain Buffer in Node, including
forced WASM; no Buffer polyfill is required. The same offset/UTF-8/output
assertions apply to both. Firefox/WebKit are
not covered. MDAST tests are structural/API checks, not JS HTML parity claims.

CI schedules checks on every PR and main push: JS freshness, Rust conformance,
Node 22/24/26 native and forced-WASM execution, native Linux/macOS/Windows host
execution, and Chromium. Configured jobs are not evidence that they passed.
Local verification used Node 24 on Linux x64 and Chromium only.

JSON execution reports are written to `test-output/parity/`. The summary derives
profile counts, oracle versions, engine/API executions, failures and divergence
dispositions from reports. Missing required engine/host evidence fails the
summary. Reports must come from the same revision; use a clean report directory
for each run. See the [divergence registry](divergences.json) for linked regression
fixtures and current dispositions. Local exact, binding and Chromium checks pass
after the compatibility fixes.
The complete testing milestone also requires every CI runtime/host job to pass;
consult the generated report for that evidence. No universal stage compatibility
or runtime/packaging readiness is implied.

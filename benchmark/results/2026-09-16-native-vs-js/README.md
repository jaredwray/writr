# Native Rust vs current Writr JavaScript

Measured revision (before PR #547 was merged): `abd1e42505feeb33c546ea253c89bbe53f34130e`; v24.19.0; linux x64 6.8.0-1064-azure; AMD EPYC 9V74 80-Core Processor; 2 logical CPUs.

Five fresh Node processes, sequential tests, alternating workload order and rotating engine order. Every API path passes exact HTML comparisons before timing. Results are medians of five per-run mean times, with min/max across runs. Each timed iteration renders the entire fixed workload in order.

Caches disabled on both engines. Lazy initialization and JIT are warmed before measurement; module loading/build/first-render latency are excluded. JS reuses one configured Writr instance and includes its public wrapper/hooks/frontmatter handling; native includes N-API conversion. Sequential async awaits one document at a time. Rust batches use two Rayon threads. Packed input preparation and output decoding are excluded, representing a bytes-in/bytes-out caller. The JS engine has no equivalent parallel batch API, so its sync loop is the batch baseline.

| Workload | Documents / bytes | JS sync µs/doc | Rust sync µs/doc | Rust speedup | Rust batch docs/s | Batch vs JS loop |
|---|---:|---:|---:|---:|---:|---:|
| Markdown minimal | 101 / 66976 | 565.3 | 104.5 | 5.41× | 11524 | 6.52× |
| Markdown default | 101 / 66976 | 1597.2 | 323.0 | 4.94× | 3967 | 6.34× |
| MDX regressions | 21 / 583 | 267.6 | 403.9 | 0.66× | 3124 | 0.84× |
| Math | 8 / 1864 | 2503.8 | 3994.5 | 0.63× | 339 | 0.85× |

## All measured paths

| Workload | API | Median µs/doc | Run range µs/doc | Docs/s |
|---|---|---:|---:|---:|
| Markdown minimal | JS sync | 565.3 | 480.8–601.8 | 1769 |
| Markdown minimal | Rust sync | 104.5 | 101.0–120.1 | 9567 |
| Markdown minimal | JS async sequential | 539.3 | 455.7–645.1 | 1854 |
| Markdown minimal | Rust async sequential | 162.0 | 153.3–175.2 | 6172 |
| Markdown minimal | Rust batch | 86.8 | 65.6–111.4 | 11524 |
| Markdown minimal | Rust packed batch | 75.5 | 70.6–79.3 | 13246 |
| Markdown default | JS sync | 1597.2 | 1462.8–1751.7 | 626 |
| Markdown default | Rust sync | 323.0 | 307.0–338.1 | 3096 |
| Markdown default | JS async sequential | 1575.3 | 1494.7–1869.4 | 635 |
| Markdown default | Rust async sequential | 442.9 | 409.4–471.2 | 2258 |
| Markdown default | Rust batch | 252.1 | 231.0–330.1 | 3967 |
| Markdown default | Rust packed batch | 257.6 | 242.1–259.6 | 3882 |
| MDX regressions | JS sync | 267.6 | 244.9–304.1 | 3737 |
| MDX regressions | Rust sync | 403.9 | 385.7–422.1 | 2476 |
| MDX regressions | JS async sequential | 303.7 | 243.0–322.5 | 3293 |
| MDX regressions | Rust async sequential | 496.3 | 483.1–543.4 | 2015 |
| MDX regressions | Rust batch | 320.1 | 300.1–329.5 | 3124 |
| MDX regressions | Rust packed batch | 309.7 | 299.0–318.4 | 3229 |
| Math | JS sync | 2503.8 | 2357.2–2715.1 | 399 |
| Math | Rust sync | 3994.5 | 3795.0–4329.4 | 250 |
| Math | JS async sequential | 2478.4 | 2244.3–2652.9 | 403 |
| Math | Rust async sequential | 4233.9 | 4015.9–4543.3 | 236 |
| Math | Rust batch | 2952.6 | 2880.7–3088.2 | 339 |
| Math | Rust packed batch | 2955.0 | 2853.2–4225.3 | 338 |

MDX uses small success fixtures, and math uses synthetic diagnostics; neither represents a full production traffic distribution. Shared VM results can vary. These measurements cover throughput/average render cost, not cold start, concurrent-service latency, memory retention, or output-cache hits.

Reproduce after `pnpm build` and `pnpm build:rs`: `pnpm exec tsx benchmark/benchmark-native-comparison.ts`. Raw inputs, flags, artifact hashes and all trial statistics are in [results.json](results.json).

This is a retained measurement snapshot. Re-running the benchmark writes fresh results to `test-output/benchmarks/native-vs-js/` and leaves this snapshot unchanged.

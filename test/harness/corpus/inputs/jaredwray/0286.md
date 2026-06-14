---
title: "Architecture Decisions"
navTitle: "Architecture Decisions"
description: "Why http-cache is Node.js/TypeScript first — with a Rust escape hatch — and why we avoid clustering."
section: "Reference"
order: 15
keywords:
  - node.js
  - rust
  - performance
  - architecture decision
---

# Architecture Decisions

This page records the key engineering decisions behind `http-cache` and the reasoning
that led to them.

## Why Node.js / TypeScript (and not Rust)?

**Decision: build `http-cache` in Node.js / TypeScript first, with a Rust/native escape
hatch for CPU-bound hot paths.**

We already own and maintain the exact building blocks a caching gateway needs:

- **[keyv](https://github.com/jaredwray/keyv)** — pluggable [storage
  backends](/docs/storage-backends).
- **[cacheable](https://github.com/jaredwray/cacheable)** — [L1/L2 in-memory
  caching](/docs/caching-layers) with CacheSync.
- **[qified](https://github.com/jaredwray/qified)** — [centralized
  queues](/docs/realtime-and-webhooks).
- **[airhorn](https://github.com/jaredwray/airhorn)** — [webhooks and
  notifications](/docs/realtime-and-webhooks).

Reusing this ecosystem means the gateway is mostly *composition*, not new code. That is
the single biggest lever on time-to-value and long-term maintainability — and it keeps
`http-cache` consistent with the rest of the stack.

### The honest performance trade-off

Rust is genuinely faster for raw proxy work. In published proxy/gateway benchmarks, a
Rust runtime can deliver on the order of **3–9× the throughput** of a typical Node.js
HTTP stack, with markedly **lower tail latency under very high concurrency** (Node
event-loop latency tends to climb past several thousand concurrent connections, while
Rust stays flat). We do not dispute this.

The question is whether that gap dominates *for a cache gateway*. It usually does not:

- **The hot path is I/O, not CPU.** A cache request is: parse a small HTTP request,
  check memory, maybe do one network read from a backend, write a small response.
  Node's libuv event loop is very good at exactly this I/O-bound workload.
- **L1/L2 memory absorbs the hottest traffic.** Most hits never leave the process
  ([caching layers](/docs/caching-layers)), so per-request work is tiny regardless of
  language.
- **Global load balancing spreads the load.** Because we scale [horizontally across
  regions](/docs/architecture) instead of vertically in one cluster, per-node
  throughput is rarely the ceiling — network proximity is.
- **Developer velocity compounds.** Shipping features, providers, and SDKs quickly —
  and sharing code with keyv/cacheable — outweighs raw single-node throughput for the
  vast majority of deployments.

### The Rust escape hatch

We design so that performance-critical pieces can drop to native later **without a
rewrite**:

- Move a measured hot path (e.g. a serialization or hashing routine) into a **native
  N-API addon** while the rest stays in TypeScript.
- Run a **Rust sidecar** (e.g. a Pingora/Tower-based front) for an ultra-high-throughput
  edge tier, with the Node ecosystem as the control plane and providers.

We will reach for these **only when telemetry shows a real bottleneck** — not
speculatively.

## Why not clustering?

Covered in depth in [Architecture](/docs/architecture#why-not-clustering): clustering
couples many machines into one logical cache, which brings O(n²) gossip, rebalancing,
sticky sessions, split-brain risk, and single-region latency. Stateless gateways behind
a global load balancer avoid all of it.

## Why provider frameworks everywhere?

Storage, statistics, queues, and configuration are all **providers**. This keeps the
core small, lets teams use the infrastructure they already run, and means a new backend
is an adapter — not a fork.

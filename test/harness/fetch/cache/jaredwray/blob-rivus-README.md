# Rivus

A Rust application gateway designed to serve static sites, run isolated WASM, and route traffic across a Kubernetes cluster — sitting behind Cloudflare for SSL termination and WAF.

## Projects

- [`gateway/`](./gateway) — Rust + Pingora data-plane gateway. Serves static sites from object storage; Cloudflare terminates TLS in front.
- [`management/`](./management) — TypeScript management API. Owns deploys, config writes, replication to primary/secondary stores, and garbage collection.

## Phases

### Phase 1 — Static site serving

- Rust-based, very fast for static content, very simple to configure.
- Object-storage backend with a primary and a secondary tier; per-call failover with hedging on slow primary and a per-pod circuit breaker.
- Each domain is a folder in object storage. If the folder is not there, the domain does not exist.
- Each domain ships an `app.config.json` (404/5xx pages, redirects, custom headers, SPA fallback, content-type rules, etc.).
- Structured access logs and application logs designed for high-volume scrape-and-ship pipelines (Vector / Fluent Bit → object storage / Loki / ClickHouse).
- Scalable and resilient: stateless pods, atomic content-addressed deploys, graceful shutdown, defense-in-depth limits.
- Runs on Kubernetes in Docker across hundreds of instances.

### Phase 2 — Isolated WASM execution + advanced caching

- Define WASM handlers in `app.config.json` via route bindings.
- Execute WASM in isolation with high performance (Wasmtime + Component Model + WASI Preview 2; pre-compiled, warm-pool of stores per module, fuel/epoch + memory + wall-clock limits).
- Advanced cache for static + WASM responses with NATS-triggered invalidation by domain, path, or single file (JetStream for delivery guarantees; epoch-counter resync to recover missed messages).

### Phase 3 — Cluster routing

- Route based on `app.config.json` route handling to any instance inside the Kubernetes cluster (service discovery via the k8s API; per-route timeouts, retries on idempotent calls, hedging, circuit breakers; mTLS to upstreams; header hygiene).

## Architecture decisions

| Area | Decision |
|---|---|
| HTTP / driver framework | Pingora, hidden behind a `Gateway` trait so the framework is replaceable |
| Async runtime | tokio (via Pingora) |
| Object-storage abstraction | OpenDAL (S3, GCS, Azure) |
| Storage tiering | Primary + secondary, per-call failover, hedge on slow primary, per-pod circuit breaker, active health probe on a sentinel key |
| TLS termination at origin | Cloudflare Origin CA wildcard cert + Authenticated Origin Pulls (BoringSSL) |
| HTTP versions to origin | HTTP/1.1 + HTTP/2 |
| Logging / tracing | `tracing` + `tracing-subscriber` (JSON), `tracing-log` bridge for Pingora; structured access log emitted by the driver |
| `app.config` format | JSON; schema generated from Rust types via `schemars` |
| Hostname encoding | Literal punycode (IDNA via the `idna` crate) |
| Container image | distroless/cc + statically linked binary |
| Repo scope | Data plane only; control plane lives in `management/` |

## Storage layout

```
<bucket>/
  domains/
    example.com/
      current.json                         # tiny pointer { schema_version, release, deployed_at }
      releases/<sha>/
        app.config.json                    # config travels with the release
        index.html
        assets/...
  _health/
    probe                                  # sentinel object for active health probes
```

- Hostnames are lowercased and converted to punycode before being used as folder names.
- Each subdomain is its own folder; apex↔www is a per-domain redirect rule.
- Up to 1000 historical releases retained per domain.
- Pointer (`current.json`) is cached in-process by the gateway: 30s TTL + 60s stale-while-revalidate in Phase 1; NATS-driven invalidation in Phase 2.

## Contract: Atomic Deploys

1. **Releases are immutable and content-addressed.** Each deploy creates `domains/<host>/releases/<sha>/...`. Once written, never modified.
2. **Pointer flip is the deploy commit.** The management API does NOT update `domains/<host>/current.json` until all blobs of the new release have been confirmed written on BOTH primary and secondary. The pointer flip is the moment the new release becomes live.
3. **Pointer file replication can be async.** Primary's pointer may briefly lead secondary's. The gateway reads `current.json` from the same tier it ends up serving from, so a request is internally consistent (might be on the older release during primary outage, never torn between releases).
4. **Old releases are retained for a grace period** that must exceed the gateway's pointer cache TTL plus the maximum in-flight request duration (recommend ≥ 30 minutes) so requests holding the old pointer can complete.
5. **Garbage collection** of old releases is the management API's responsibility, never the gateway's. A release may only be deleted once it is unreferenced by any tier's `current.json` AND has remained unreferenced for longer than the grace period — content-addressing means the same SHA can be re-referenced by a rollback or repeat deploy.

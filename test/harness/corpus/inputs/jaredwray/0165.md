---
title: "Roadmap"
navTitle: "Roadmap"
description: "Planned work for http-cache, including a centralized Management API and admin UX."
section: "Reference"
order: 16
keywords:
  - roadmap
  - management api
  - admin ui
  - future
---

# Roadmap

`http-cache` starts as a specification. This page tracks the planned direction — it is
intentionally a set of **roadmap notes**, not committed designs.

## Management API & admin UX *(planned)*

Today, the gateway is configured declaratively (environment + the centralized
[config store](/docs/management-and-config)). A natural next step is a first-class
**Management API** plus an **admin UX** on top of it:

- **Management API** — a REST control plane for tokens, TTL/cache policies, cache purge
  (by key, prefix, or tag), webhook subscriptions, and provider settings, backed by the
  same centralized MongoDB config store.
- **Admin UX** — a dashboard for operators: live **ClickHouse-powered**
  [statistics](/docs/statistics) (hit ratios, latency, top keys), one-click purge,
  token management, and fleet/region health.

These are **planned, not yet designed**. The architecture already supports them: config
is centralized, stats stream to a provider, and gateways are stateless — a control plane
slots in cleanly without changing the data path.

## Other planned work

- **Reference gateway implementation** in Node.js/TypeScript (see [Architecture
  Decisions](/docs/architecture-decisions)).
- **Bundled Docker images** per storage provider for [minimal
  hops](/docs/getting-started).
- **Additional gateway providers** beyond REST (e.g. GraphQL/gRPC) on the shared core.
- **Client SDKs** for browser/SPA and server use of the
  [Bearer / x-api-token API](/docs/gateway-and-api).
- **Native/Rust escape hatch** for measured hot paths, only where telemetry justifies
  it.

> Have an opinion on prioritization? Open an issue on
> [GitHub](https://github.com/jaredwray/http-cache).

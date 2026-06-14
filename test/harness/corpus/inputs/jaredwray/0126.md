---
title: "Gateway & API"
navTitle: "Gateway & API"
description: "REST by default with multiple gateway providers, and client-friendly Bearer / x-api-token auth for React and SPA caching."
section: "Architecture"
order: 6
keywords:
  - rest api
  - bearer
  - x-api-token
  - spa caching
  - react
---

# Gateway & API

The gateway endpoint is **REST by default**, designed to be trivial for any client to
use — from a backend service to a browser-based SPA.

## REST, with multiple gateway providers

The default gateway speaks REST, but the gateway surface is itself a **provider**. That
means you can run alternative gateway providers (for example a GraphQL or gRPC front
end) against the same caching core when your clients need it — without changing the
storage, memory, or stats layers underneath.

### Core REST surface

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/cache/:key` | Read a value (served from L1/L2 on a hit). |
| `PUT` | `/cache/:key` | Store a value with an optional TTL. |
| `DELETE` | `/cache/:key` | Invalidate a key across all tiers. |
| `POST` | `/cache:purge` | Bulk invalidate by prefix or tag. |
| `GET` | `/health` | Liveness/readiness probe — **unauthenticated** (see below). |

## Authentication: Bearer or x-api-token

Auth is intentionally **simple and fast**. Send either header:

```http
Authorization: Bearer <token>
```

```http
x-api-token: <token>
```

Token-based auth avoids the overhead of session lookups and cookies, which keeps the
hot path fast. It is also **CORS- and browser-friendly**, which unlocks a major
benefit.

> **`/health` is exempt from authentication.** Auth applies to the `/cache` surface, but
> the liveness/readiness probe is intentionally public so global load-balancer health
> checks (Cloudflare, Fastly, GCP, Azure, AWS) can reach it without credentials. It
> returns only status — never cached data.

### Scoped tokens: read-only vs. read-write

Tokens are **scoped**. Issue narrow tokens per use case so a token can only do what its
holder needs:

- **Read-only / `GET`-only** tokens — safe to expose to untrusted clients (browsers).
- **Read-write** tokens (`PUT`, `DELETE`, `/cache:purge`) — privileged; **must stay
  server-side** and never be shipped to a browser.

## A huge win for React & SPA caching

Because auth is a single header and the API is plain REST + socket.io, you can read from
`http-cache` **directly in the browser** with a **read-only, scoped token**. A React or
SPA app can:

- read cache entries from the client without a bespoke backend proxy,
- subscribe to live invalidations so the UI updates the instant data changes,
- share a single, globally load-balanced cache tier across web and server clients.

```ts
// Browser: only ever ship a READ-ONLY token. Any value bundled into a frontend
// (e.g. a Vite `VITE_`-prefixed variable) is fully visible to every visitor.
const res = await fetch(`https://cache.example.com/cache/feed:home`, {
  headers: { "x-api-token": import.meta.env.VITE_CACHE_READONLY_TOKEN },
});
```

> ⚠️ **Never expose a read-write token to the browser.** `VITE_`-prefixed (and all
> client-side) variables are compiled into the bundle and readable by anyone. Since the
> API includes `PUT`, `DELETE`, and `/cache:purge`, a shared write token in the browser
> would let any visitor mutate or flush your cache. Keep write tokens on the server and
> have the browser hold only a read-only/scoped token (or proxy writes through your
> backend).

This turns the cache into a first-class, real-time *read* layer for your frontend —
while writes stay safely server-side.

## Related

- **[Realtime & webhooks](/docs/realtime-and-webhooks)** — socket.io push and webhooks.
- **[Caching layers](/docs/caching-layers)** — what happens on a hit vs a miss.

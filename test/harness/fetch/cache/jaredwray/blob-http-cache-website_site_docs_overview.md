---
title: "What is http-cache?"
navTitle: "Introduction"
description: "What HTTP caching is, why http-cache makes it better, and the ecosystem behind the gateway."
section: "Getting Started"
order: 1
keywords:
  - http cache
  - caching gateway
  - keyv
  - cacheable
  - what is http caching
---

# What is http-cache?

**A modern HTTP caching gateway — from the makers of
[keyv](https://github.com/jaredwray/keyv) and
[cacheable](https://github.com/jaredwray/cacheable).**

We believe caching should be *modern*: provider-agnostic, observable, real-time, and
built for global scale from day one. `http-cache` is a **gateway** that puts you in full
control of your caching system — pluggable storage, in-memory L1/L2 at the edge, live
updates over websockets, and global scale without the pain of clustering.

## What is HTTP caching?

HTTP caching stores copies of responses close to where they are needed so that repeated
requests can be served without hitting your origin again. A cached response is returned
in microseconds from memory instead of seconds from a database, an API, or a downstream
service.

Done well, caching is the single highest-leverage performance investment you can make:

- **Lower latency.** Serve hot data from memory at the gateway instead of recomputing it
  or making another network round trip.
- **Less load on origin.** Absorb traffic spikes and shield databases and upstream APIs
  from repeated, identical work.
- **Lower cost.** Fewer compute cycles, fewer database reads, less egress.
- **Higher resilience.** Keep serving cached content even when an upstream is slow or
  briefly unavailable.

## Why http-cache is better

Most caching today is either bolted onto a single app, locked to one storage engine, or
hidden behind a CDN you do not control. `http-cache` is a **gateway** — a dedicated,
provider-agnostic layer that sits in front of your services and gives you control:

- **Bring your own storage.** Select any backend through
  [keyv](/docs/storage-backends) providers — Redis, Memcache, MongoDB, and more —
  without changing your application.
- **L1/L2 in memory at the gateway.** Powered by [cacheable](/docs/caching-layers), the
  hottest data lives in memory right at the edge for the fastest possible reads.
- **Minimal hops.** Official Docker images bundle a storage provider *with* the gateway
  so a cache hit never leaves the box.
- **REST by default, with multiple gateway providers.** A simple, fast
  [HTTP API](/docs/gateway-and-api) that any client can use.
- **Built for the client too.** Authenticate with a `Bearer` token or `x-api-token`
  header — performant and usable directly from React or any SPA, so client-side caching
  becomes a first-class feature.
- **Live updates.** [socket.io](/docs/realtime-and-webhooks) is enabled by default to
  push cache changes straight to connected clients.
- **Webhooks + centralized queues.** Notify other systems through
  [airhorn](/docs/realtime-and-webhooks) webhooks with centralized queue management via
  [qified](/docs/realtime-and-webhooks).
- **Global load balancing, not clustering.** Scale with [HTTP
  architecture](/docs/architecture) and global anycast load balancing instead of
  brittle, chatty cache clusters.
- **Observability built in.** [Statistics](/docs/statistics) flow through a provider
  framework, with [ClickHouse](https://clickhouse.com) as the default when you enable
  it.

## The gateway model

Instead of embedding cache logic in every application and coupling it to one storage
engine, you run `http-cache` as a gateway. Your clients and services talk to it over a
simple REST API; it decides what is cached, where it is stored, and when it expires.

```
client / service  ─▶  http-cache gateway  ─▶  origin (only on a miss)
                          │
                          ├─ L1/L2 memory (cacheable)
                          ├─ storage backend (keyv: redis, memcache, mongo, …)
                          ├─ realtime push (socket.io)
                          └─ stats + webhooks (clickhouse, airhorn, qified)
```

## Built on a proven ecosystem

`http-cache` is not a from-scratch experiment. It composes battle-tested libraries that
already power production caching for thousands of projects:

| Capability | Powered by |
| ---------- | ---------- |
| Pluggable storage backends | [keyv](https://github.com/jaredwray/keyv) |
| L1/L2 in-memory caching | [cacheable](https://github.com/jaredwray/cacheable) |
| Centralized queue management | [qified](https://github.com/jaredwray/qified) |
| Webhooks & notifications | [airhorn](https://github.com/jaredwray/airhorn) |

## Where to next

- **[Getting Started](/docs/getting-started)** — run the gateway with Docker in minutes.
- **[Architecture](/docs/architecture)** — the big picture, and why we choose global
  load balancing over clustering.
- **[Deployment](/docs/deploy-cloudflare)** — set up global load balancing on
  Cloudflare, Fastly, Google Cloud, Azure, or AWS.

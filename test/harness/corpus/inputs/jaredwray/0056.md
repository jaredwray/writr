---
title: "Caching Layers (L1/L2)"
navTitle: "Caching Layers"
description: "L1/L2 in-memory caching at the gateway, powered by cacheable."
section: "Architecture"
order: 5
keywords:
  - cacheable
  - L1 L2
  - in-memory cache
  - ttl
---

# Caching Layers (L1/L2)

Every `http-cache` gateway keeps an **in-memory L1/L2 cache** right at the edge,
powered by [cacheable](https://github.com/jaredwray/cacheable). This is what makes a
cache hit return in microseconds instead of taking a network round trip to a backend.

## The two tiers

- **L1 — in-process memory.** The fastest tier, holding the very hottest keys in the
  gateway's own memory. Reads never leave the process.
- **L2 — secondary memory tier.** A larger near-cache that absorbs more of your working
  set before falling through to the shared [storage backend](/docs/storage-backends).

On a request, the gateway checks **L1 → L2 → storage backend → origin**, populating the
faster tiers as data flows back up.

```
request ─▶ L1 (in-process) ─▶ L2 (near-cache) ─▶ keyv backend ─▶ origin
   ◀─────────────────────── populate on the way back ───────────────────
```

## TTLs and invalidation

cacheable gives each entry a configurable TTL, with sane defaults at the gateway level
and per-key overrides:

```bash
curl -X PUT http://localhost:8080/cache/profile:42 \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"value":{"name":"Ada"},"ttl":"10m"}'
```

Invalidation removes a key from every tier and notifies subscribers (see
[Realtime & webhooks](/docs/realtime-and-webhooks)).

## CacheSync across gateways

cacheable's **CacheSync** keeps in-memory tiers coherent across gateways. When one
gateway writes or invalidates a key, the change is broadcast (via the
[queue provider](/docs/realtime-and-webhooks)) so other gateways drop or refresh their
local copies — without any cluster gossip or sticky sessions.

## Why memory at the edge matters

Putting L1/L2 *at the gateway* — combined with [global load
balancing](/docs/architecture) — means each user is served from memory in the region
closest to them. This is the single biggest reason the HTTP-architecture model
out-performs a centralized cluster for real-world, globally distributed traffic.

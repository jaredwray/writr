---
title: "Storage Backends"
navTitle: "Storage Backends"
description: "Select any storage backend — Redis, Memcache, MongoDB and more — through keyv providers."
section: "Architecture"
order: 4
keywords:
  - keyv
  - redis
  - memcache
  - mongodb
  - storage adapter
---

# Storage Backends

`http-cache` does not lock you into one storage engine. The source of truth for cached
data is **pluggable**, powered by [keyv](https://github.com/jaredwray/keyv) and its
ecosystem of storage adapters.

## Bring your own backend

Choose a backend based on the infrastructure you already operate:

| Backend | Use it when |
| ------- | ----------- |
| **Redis** | You want a fast, ubiquitous, network-shared cache store. |
| **Memcache** | You have an existing Memcached fleet. |
| **MongoDB** | You want durable, document-shaped cache state. |
| **Postgres / MySQL / SQLite** | You prefer to reuse a relational store. |
| **Memory** | Local development, or an ephemeral edge tier. |

Because every backend implements the same keyv interface, switching is a configuration
change — your gateway behavior and API stay identical.

## Configuration

Point the gateway at a backend with a connection string:

```bash
# Redis
HTTP_CACHE_STORE=redis://redis:6379

# Memcache
HTTP_CACHE_STORE=memcache://memcache:11211

# MongoDB
HTTP_CACHE_STORE=mongodb://mongo:27017/httpcache
```

## Provider-based, not opinionated

The backend is one of several **provider frameworks** in `http-cache`. Just as storage
is a provider (keyv), so are [statistics](/docs/statistics) (ClickHouse),
[queues/webhooks](/docs/realtime-and-webhooks) (qified/airhorn), and
[configuration](/docs/management-and-config) (MongoDB). Each can be swapped to match
your stack.

## How it relates to the memory tier

The storage backend is the **shared** source of truth. On top of it, each gateway keeps
an **L1/L2 in-memory tier** for the hottest data — see
[Caching Layers](/docs/caching-layers).

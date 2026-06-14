---
title: "Statistics & Observability"
navTitle: "Statistics"
description: "Statistics are logged through a provider framework, with ClickHouse as the default when enabled."
section: "Architecture"
order: 8
keywords:
  - statistics
  - clickhouse
  - observability
  - metrics
---

# Statistics & Observability

You cannot tune what you cannot measure. `http-cache` records cache activity through a
**statistics provider framework**, so you get rich, queryable metrics without bolting on
a separate pipeline.

## Provider framework

Statistics are pluggable, just like [storage](/docs/storage-backends) and
[queues](/docs/realtime-and-webhooks). Enable stats and pick a provider; the gateway
streams events (hits, misses, sets, deletes, evictions, latencies) to it.

**[ClickHouse](https://clickhouse.com) is the default provider when you enable
statistics** — it is purpose-built for high-volume, append-only event analytics, which
is exactly the shape of cache telemetry.

```bash
HTTP_CACHE_STATS=clickhouse://clickhouse:9000/httpcache
```

When stats are disabled, the gateway adds zero telemetry overhead to the hot path.

## What you can measure

- **Hit ratio** overall and per key prefix, region, or client.
- **Latency** percentiles for L1, L2, backend, and origin paths.
- **Throughput** — requests per second per gateway and per region.
- **Invalidations** and eviction rates over time.
- **Top keys** by traffic, and cold keys worth evicting.

Because the data lands in ClickHouse, you can drive dashboards, alerts, and capacity
planning with plain SQL.

## Designed for the gateway model

In a [globally load-balanced deployment](/docs/architecture), each gateway emits its own
stats. Aggregating them in a columnar store like ClickHouse gives you a single,
fleet-wide view across every region — without any cross-gateway coordination on the hot
path.

> 📊 A management UX with built-in dashboards over these statistics is on the
> [roadmap](/docs/roadmap).

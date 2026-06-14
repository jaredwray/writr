---
title: "Management & Configuration"
navTitle: "Management & Config"
description: "Centralized, provider-based configuration with MongoDB as the default management store."
section: "Reference"
order: 9
keywords:
  - configuration
  - mongodb
  - management
  - centralized config
---

# Management & Configuration

In a [globally load-balanced fleet](/docs/architecture), every gateway needs the same
view of the world: tokens, TTL policies, webhook subscriptions, and provider settings.
`http-cache` keeps this configuration **centralized by default**.

## Centralized config, provider-based

Management configuration lives in a central store so that any gateway — in any region —
reads the same settings. As with everything else in `http-cache`, the config store is a
**provider**, with **MongoDB as the default**:

```bash
HTTP_CACHE_CONFIG=mongodb://mongo:27017/httpcache-config
```

Prefer a different store? Swap the provider; the gateway behavior is unchanged.

## What is managed centrally

- **API tokens** for `Bearer` / `x-api-token` [authentication](/docs/gateway-and-api).
- **TTL and cache policies** — defaults and per-prefix overrides.
- **Provider settings** — storage (keyv), stats (ClickHouse), queue (qified).
- **Webhook subscriptions** and their event filters.
- **Routing / region** metadata for the gateway fleet.

## How gateways stay in sync

Gateways read centralized config on startup and watch for changes. Updates are
propagated through the same [centralized queue](/docs/realtime-and-webhooks) used for
CacheSync, so a policy change rolls out across regions without restarts and without any
node-to-node coupling.

## Management API & UX

Today, configuration is managed declaratively (environment + the central store). A
dedicated **Management API and admin UX** — for tokens, policies, cache purge, and
live ClickHouse dashboards — is a planned addition. See the [Roadmap](/docs/roadmap).

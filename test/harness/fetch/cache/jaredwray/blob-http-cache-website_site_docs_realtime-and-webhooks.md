---
title: "Realtime & Webhooks"
navTitle: "Realtime & Webhooks"
description: "socket.io push by default, plus webhooks and centralized queue management with airhorn and qified."
section: "Architecture"
order: 7
keywords:
  - socket.io
  - webhooks
  - qified
  - airhorn
  - queue
---

# Realtime & Webhooks

`http-cache` is event-driven. Every cache change can be pushed to connected clients in
real time and fanned out to other systems through webhooks and a centralized queue.

## socket.io is enabled by default

Real-time updates are not an add-on — **socket.io is on by default**. Clients subscribe
and receive cache events the instant they happen:

```js
import { io } from "socket.io-client";

const socket = io("https://cache.example.com", { auth: { token: TOKEN } });

socket.on("cache:set", ({ key, ttl }) => refresh(key));
socket.on("cache:delete", ({ key }) => invalidate(key));
```

This is what lets a React/SPA app keep its UI perfectly in sync with the cache — when
data changes anywhere, every subscribed client knows immediately.

## Webhooks for other systems

For server-to-server integration, `http-cache` delivers **webhooks** via
[airhorn](https://github.com/jaredwray/airhorn). Register an endpoint and receive a
signed callback on the events you care about:

```bash
curl -X POST https://cache.example.com/webhooks \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"url":"https://my-service/cache-events","events":["cache:delete"]}'
```

airhorn's unified `send()` model means the same event pipeline can also drive email,
SMS, and push notifications when you need them.

## Centralized queue management

All of this fan-out is coordinated through **centralized queue management** powered by
[qified](https://github.com/jaredwray/qified). qified provides task and message queues
across multiple providers — **Redis, RabbitMQ, NATS, ZeroMQ**, or an in-memory queue
for development — behind a single interface.

The queue is the backbone for:

- **CacheSync** — broadcasting set/delete events so every gateway's
  [L1/L2 memory](/docs/caching-layers) stays coherent.
- **Reliable webhook delivery** — retries and back-pressure without losing events.
- **Decoupling** — gateways stay stateless; the queue carries the cross-cutting work.

```bash
HTTP_CACHE_QUEUE=redis://redis:6379     # or rabbitmq://, nats://, …
```

## Related

- **[Gateway & API](/docs/gateway-and-api)** — the REST surface that emits these events.
- **[Statistics](/docs/statistics)** — recording every event for observability.

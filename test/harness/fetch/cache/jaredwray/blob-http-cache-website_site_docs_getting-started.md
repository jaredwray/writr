---
title: "Getting Started"
navTitle: "Getting Started"
description: "Run the http-cache gateway in minutes with the bundled Docker images for minimal hops."
section: "Getting Started"
order: 2
keywords:
  - docker
  - quickstart
  - http cache gateway
---

# Getting Started

The fastest way to try `http-cache` is with the official Docker images. We ship images
that **bundle a storage provider together with the gateway** so a cache hit never
leaves the container — minimal hops, maximum speed.

> ⚠️ The specification and APIs below describe the target design. Images and packages
> are published as the implementation lands.

## Run with Docker (bundled storage)

```bash
docker run -p 8080:8080 \
  -e HTTP_CACHE_TOKEN=dev-token \
  ghcr.io/jaredwray/http-cache:redis
```

The `:redis` tag bundles Redis with the gateway in a single image. Other bundles
(`:memcache`, `:mongo`, …) follow the same pattern. For full control, use the base
image and point it at your own backend:

```bash
docker run -p 8080:8080 \
  -e HTTP_CACHE_TOKEN=dev-token \
  -e HTTP_CACHE_STORE=redis://redis:6379 \
  ghcr.io/jaredwray/http-cache:latest
```

## Your first cache operations

The gateway is REST by default. Authenticate with a `Bearer` token or `x-api-token`
header.

```bash
# Store a value
curl -X PUT http://localhost:8080/cache/greeting \
  -H "Authorization: Bearer dev-token" \
  -H "Content-Type: application/json" \
  -d '{"value":"hello world","ttl":"5m"}'

# Read it back (served from L1/L2 memory)
curl http://localhost:8080/cache/greeting \
  -H "x-api-token: dev-token"

# Invalidate it
curl -X DELETE http://localhost:8080/cache/greeting \
  -H "Authorization: Bearer dev-token"
```

## Subscribe to live changes

socket.io is enabled by default, so clients can react to cache changes instantly:

```js
import { io } from "socket.io-client";

const socket = io("http://localhost:8080", { auth: { token: "dev-token" } });
socket.on("cache:set", ({ key }) => console.log("updated", key));
socket.on("cache:delete", ({ key }) => console.log("invalidated", key));
```

## Next steps

- **[Architecture](/docs/architecture)** — how it all fits together.
- **[Gateway & API](/docs/gateway-and-api)** — the full REST surface and auth model.
- **[Deployment](/docs/deploy-cloudflare)** — go global with load balancing.

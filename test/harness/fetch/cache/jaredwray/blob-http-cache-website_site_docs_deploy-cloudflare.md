---
title: "Deploy: Cloudflare"
navTitle: "Cloudflare"
description: "Set up http-cache behind Cloudflare global load balancing — and why anycast is the right model."
section: "Deployment"
order: 10
keywords:
  - cloudflare
  - global load balancing
  - anycast
  - deployment
---

# Deploy with Cloudflare Global Load Balancing

Cloudflare is a natural fit for `http-cache` because its network is **anycast by
design** — a single IP is announced from data centers worldwide, and each user is
automatically routed to the nearest one. That is exactly the
[global-load-balancing model](/docs/architecture) `http-cache` is built around.

## Why Cloudflare

- **Anycast everywhere.** No regional IPs to juggle; the nearest edge answers.
- **Health-aware steering.** Cloudflare Load Balancing checks gateway health and routes
  around failures automatically.
- **Geo steering.** Pin EU traffic to EU gateways for data-residency requirements.
- **DDoS + TLS at the edge.** Your gateways focus on caching, not perimeter concerns.

## Setup

1. **Run gateways in two or more regions** (any host — VMs, containers, or a
   container platform):

   ```bash
   docker run -p 8080:8080 \
     -e HTTP_CACHE_TOKEN=$TOKEN \
     -e HTTP_CACHE_STORE=redis://your-redis:6379 \
     ghcr.io/jaredwray/http-cache:latest
   ```

2. **Create a Cloudflare Load Balancer** (Traffic → Load Balancing):
   - Add an **origin pool per region**, each pointing at that region's gateway(s).
   - Set the **health check** to `GET /health` (expect `200`).
   - Choose **Proxied (orange cloud)** so traffic rides Cloudflare's anycast network.

3. **Set steering to "Dynamic (lowest latency)"** so each user reaches the closest
   healthy gateway pool.

4. **Point a hostname** (e.g. `cache.example.com`) at the load balancer.

## Result

```
user ─▶ Cloudflare anycast edge ─▶ nearest http-cache gateway ─▶ L1/L2 → keyv backend
```

Each request is served from memory in the region closest to the user, with no cluster
to operate. Add or drain a region by editing the pool — no rebalancing required.

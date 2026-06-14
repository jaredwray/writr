---
title: "Deploy: Fastly"
navTitle: "Fastly"
description: "Set up http-cache behind Fastly global load balancing with anycast edge delivery."
section: "Deployment"
order: 11
keywords:
  - fastly
  - global load balancing
  - anycast
  - deployment
---

# Deploy with Fastly Global Load Balancing

Fastly runs a global anycast network with powerful edge logic, making it an excellent
front door for an `http-cache` fleet. Like Cloudflare, Fastly routes each user to the
nearest point of presence — the [model](/docs/architecture) `http-cache` is designed
for.

## Why Fastly

- **Anycast edge delivery** to the closest POP automatically.
- **Origin shielding** — designate a shield POP so misses collapse before reaching your
  gateways.
- **Real-time, instant purge** that pairs naturally with `http-cache` invalidation.
- **VCL / edge compute** for fine-grained routing and header control.

## Setup

1. **Run gateways in multiple regions** and expose them on stable hostnames or IPs.

2. **Create a Fastly service** with one **backend per region**, each pointing at that
   region's gateway(s).

3. **Add a health check** targeting `GET /health` and attach it to each backend so
   Fastly removes unhealthy gateways automatically.

4. **Enable shielding** on a central POP to reduce origin (gateway) load on misses.

5. **Route by health and geography** — direct each region's traffic to its nearest
   gateway backend, failing over to the next healthy region.

## Result

```
user ─▶ Fastly anycast POP ─▶ (shield) ─▶ nearest http-cache gateway ─▶ L1/L2 → keyv
```

Fastly handles global delivery and edge purging; `http-cache` handles the
provider-backed, L1/L2-accelerated caching behind it.

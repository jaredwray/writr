---
title: "Deploy: Azure"
navTitle: "Azure"
description: "Set up http-cache behind Azure Front Door for global, anycast-based load balancing."
section: "Deployment"
order: 13
keywords:
  - azure
  - front door
  - global load balancing
  - anycast
---

# Deploy on Azure

On Azure, **Front Door** is the global, anycast-based entry point that routes users to
the nearest healthy backend across regions. It is the right layer to put in front of an
`http-cache` fleet, matching the [global-load-balancing model](/docs/architecture).

## Why Azure Front Door

- **Anycast global routing** to the closest edge POP.
- **Latency-based backend selection** with automatic failover.
- **Health probes** built in for backend pools.
- **TLS termination and WAF** at the edge.

> Use **Front Door** for global, cross-region routing. (Azure Load Balancer and
> Application Gateway are regional and best used *within* a region.)

## Setup

1. **Deploy regional gateways** — for example as **Azure Container Apps** or **App
   Service** in two or more regions:

   ```bash
   # Container Apps must live in a Container Apps environment — create one first:
   az containerapp env create \
     --name http-cache-env --resource-group http-cache-rg --location eastus

   az containerapp create \
     --name http-cache --resource-group http-cache-rg \
     --environment http-cache-env \
     --image ghcr.io/jaredwray/http-cache:latest \
     --target-port 8080 --ingress external \
     --env-vars HTTP_CACHE_STORE=redis://your-redis:6379
   ```

2. **Create a Front Door profile** and add an **origin group**, with each regional
   gateway as an **origin**.

3. **Configure health probes** to `GET /health` so Front Door drains unhealthy origins.

4. **Set routing to latency-based** so each user reaches the nearest healthy gateway.

5. **Map your custom domain** to the Front Door endpoint.

## Result

```
user ─▶ Azure Front Door (anycast) ─▶ nearest regional gateway ─▶ L1/L2 → keyv backend
```

Add or remove an origin to scale regions in or out — there is no cluster state to
reconcile.

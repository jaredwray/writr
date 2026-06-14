---
title: "Deploy: AWS"
navTitle: "AWS"
description: "Set up http-cache on AWS with global load balancing via Global Accelerator or Route 53 + regional ALBs."
section: "Deployment"
order: 14
keywords:
  - aws
  - global accelerator
  - route 53
  - alb
  - global load balancing
---

# Deploy on AWS

AWS gives you two complementary ways to load balance `http-cache` globally. Both deliver
the [nearest-region model](/docs/architecture) — pick based on whether you want anycast
IPs or DNS-based steering.

## Why AWS

- **AWS Global Accelerator** — two static **anycast IPs** that route over the AWS
  backbone to the nearest healthy regional endpoint.
- **Route 53 latency / geolocation routing** — DNS-based steering to regional Application
  Load Balancers, with health checks and failover.
- **ECS Fargate / EKS** for elastic, regional gateway fleets.
- **CloudFront** optionally in front for an additional static edge tier.

## Setup (Global Accelerator)

1. **Run gateways in multiple regions** behind a **regional ALB** each:

   ```bash
   # ECS Fargate task running the container, fronted by an ALB per region
   # ALB target group health check: GET /health
   ```

2. **Create a Global Accelerator** and add a **listener** (HTTPS/443).

3. **Add an endpoint group per region**, each pointing at that region's ALB. Health
   checks remove unhealthy endpoints automatically.

4. **Use the two static anycast IPs** (or the Accelerator DNS name) for your domain.

## Setup (Route 53 alternative)

1. Front each region's gateways with an **ALB** (health check `GET /health`).
2. Create **latency-based** Route 53 records, one per regional ALB, with **health
   checks** attached for failover.
3. Point `cache.example.com` at those records.

## Result

```
user ─▶ Global Accelerator anycast IP ─▶ nearest regional ALB ─▶ http-cache gateway ─▶ L1/L2 → keyv
```

Either approach scales by adding a region — stateless gateways mean no rebalancing and
no cluster to babysit.

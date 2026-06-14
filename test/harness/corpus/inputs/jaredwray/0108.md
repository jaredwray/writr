# Rivus Gateway

Rust + [Pingora](https://github.com/cloudflare/pingora) data-plane gateway. Serves static sites from object storage with primary/secondary failover. Cloudflare terminates TLS in front; the gateway terminates TLS at origin using a Cloudflare Origin CA cert with Authenticated Origin Pulls.

This crate is read-only against object storage. Deploys, config writes, replication, and garbage collection are owned by the [management API](../management/README.md). See the root [README](../README.md) for the cross-project contract.

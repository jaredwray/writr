# Rivus Management API

TypeScript management API. Owns domain configuration, deploy uploads, atomic pointer flips, replication to primary and secondary object storage, and garbage collection of old releases.

The [gateway](../gateway/README.md) reads the structures this service writes; it never writes back. See the root [README](../README.md) for the cross-project contract.

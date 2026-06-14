[<img src="https://jaredwray.com/images/memcache.svg" width="80%" height="80%" align="center" alt="Memcache Logo" align="center">](https://memcachejs.org)

[![codecov](https://codecov.io/gh/jaredwray/memcache/graph/badge.svg?token=4DUANNWiIE)](https://codecov.io/gh/jaredwray/memcache)
[![tests](https://github.com/jaredwray/memcache/actions/workflows/tests.yaml/badge.svg)](https://github.com/jaredwray/memcache/actions/workflows/tests.yaml)
[![npm](https://img.shields.io/npm/v/memcache)](https://www.npmjs.com/package/memcache)
[![npm](https://img.shields.io/npm/dm/memcache)](https://www.npmjs.com/package/memcache)
[![license](https://img.shields.io/github/license/jaredwray/memcache)](https://github.com/jaredwray/memcache/blob/main/LICENSE)

# Memcache
Nodejs Memcache Client

# Table of Contents

- [Getting Started](#getting-started)
  - [Installation](#installation)
  - [Basic Usage](#basic-usage)
- [API](#api)
  - [Constructor](#constructor)
  - [Properties](#properties)
  - [Connection Management](#connection-management)
  - [Node Management](#node-management)
  - [Data Storage Operations](#data-storage-operations)
  - [String Modification Operations](#string-modification-operations)
  - [Deletion & Expiration](#deletion--expiration)
  - [Numeric Operations](#numeric-operations)
  - [Server Management & Statistics](#server-management--statistics)
  - [Validation](#validation)
  - [Helper Functions](#helper-functions)
- [Hooks and Events](#hooks-and-events)
  - [Events](#events)
  - [Available Events](#available-events)
  - [Hooks](#hooks)
  - [Available Hooks](#available-hooks)
    - [get(key)](#getkey)
    - [set(key, value, exptime?, flags?)](#setkey-value-exptime-flags)
    - [gets(keys[])](#getskeys)
    - [add(key, value, exptime?, flags?)](#addkey-value-exptime-flags)
    - [replace(key, value, exptime?, flags?)](#replacekey-value-exptime-flags)
    - [append(key, value)](#appendkey-value)
    - [prepend(key, value)](#prependkey-value)
    - [delete(key)](#deletekey)
    - [incr(key, value?)](#incrkey-value)
    - [decr(key, value?)](#decrkey-value)
    - [touch(key, exptime)](#touchkey-exptime)
  - [Hook Examples](#hook-examples)
- [Distribution Algorithms](#distribution-algorithms)
  - [KetamaHash (Default)](#ketamahash-default)
  - [ModulaHash](#modulahash)
  - [BroadcastHash](#broadcasthash)
  - [Choosing an Algorithm](#choosing-an-algorithm)
- [Retry Configuration](#retry-configuration)
  - [Basic Retry Setup](#basic-retry-setup)
  - [Backoff Strategies](#backoff-strategies)
  - [Idempotent Safety](#idempotent-safety)
  - [Methods Without Retry Support](#methods-without-retry-support)
- [SASL Authentication](#sasl-authentication)
  - [Enabling SASL Authentication](#enabling-sasl-authentication)
  - [SASL Options](#sasl-options)
  - [Per-Node SASL Configuration](#per-node-sasl-configuration)
  - [Authentication Events](#authentication-events)
  - [Server Configuration](#server-configuration)
- [Auto Discovery](#auto-discovery)
  - [Enabling Auto Discovery](#enabling-auto-discovery)
  - [Auto Discovery Options](#auto-discovery-options)
  - [Auto Discovery Events](#auto-discovery-events)
  - [Legacy Command Support](#legacy-command-support)
- [IPv6 Support](#ipv6-support)
- [Benchmarks](#benchmarks)
- [Contributing](#contributing)
- [License and Copyright](#license-and-copyright)

# Getting Started

## Installation

```bash
npm install memcache
```

or with pnpm:

```bash
pnpm add memcache
```

## Basic Usage

```javascript
import { Memcache } from 'memcache';

// Create a new client
const client = new Memcache();

// Set a value
await client.set('mykey', 'Hello, Memcache!');

// Get a value
const value = await client.get('mykey');
console.log(value); // ['Hello, Memcache!']

// Delete a value
await client.delete('mykey');

// Close the connection
await client.quit();
```

You can also just pass in the `uri` into the constructor

```javascript
// Single node as string
const client = new Memcache('localhost:11211');

// Single node with protocol
const client = new Memcache('memcache://192.168.1.100:11211');

// Multiple nodes with options
const client = new Memcache({
  nodes: ['localhost:11211', 'server2:11211'],
  timeout: 10000
});
```

You can specify multiple Memcache nodes by passing an array of connection strings:

```javascript
import { Memcache } from 'memcache';

// Create a client with multiple nodes
const client = new Memcache({
  nodes: ['localhost:11211', '192.168.1.100:11211', 'memcache://192.168.1.101:11211']
});

// Set and get values (automatically distributed across nodes)
await client.set('mykey', 'Hello, Memcache!');
const value = await client.get('mykey');
console.log(value); // ['Hello, Memcache!']

// Close the connection
await client.quit();
```

You can also pass an array of MemcacheNode instances for advanced configuration:

```javascript
import { Memcache, createNode } from 'memcache';

// Create nodes with custom settings
const node1 = createNode('localhost', 11211, { weight: 2 });
const node2 = createNode('192.168.1.100', 11211, { weight: 1 });
const node3 = createNode('192.168.1.101', 11211, { weight: 1 });

// Create a client with MemcacheNode instances
const client = new Memcache({
  nodes: [node1, node2, node3],
  timeout: 10000
});

// node1 will receive twice as much traffic due to higher weight
await client.set('mykey', 'Hello, Memcache!');
const value = await client.get('mykey');
console.log(value); // ['Hello, Memcache!']

// Close the connection
await client.quit();
```

# API

## Constructor

```typescript
new Memcache(options?: string | MemcacheOptions)
```

Creates a new Memcache client instance. You can pass either:
- A **string** representing a single node URI (uses default settings)
- A **MemcacheOptions** object for custom configuration

**Examples:**

```javascript
// Single node as string
const client = new Memcache('localhost:11211');

// Single node with protocol
const client = new Memcache('memcache://192.168.1.100:11211');

// Multiple nodes with options
const client = new Memcache({
  nodes: ['localhost:11211', 'server2:11211'],
  timeout: 10000
});
```

### Options

- `nodes?: (string | MemcacheNode)[]` - Array of node URIs or MemcacheNode instances
  - Examples: `["localhost:11211", "memcache://192.168.1.100:11212"]`
- `timeout?: number` - Operation timeout in milliseconds (default: 5000)
- `keepAlive?: boolean` - Keep connection alive (default: true)
- `keepAliveDelay?: number` - Keep alive delay in milliseconds (default: 1000)
- `hash?: HashProvider` - Hash provider for consistent hashing (default: KetamaHash)
- `retries?: number` - Number of retry attempts for failed commands (default: 0)
- `retryDelay?: number` - Base delay in milliseconds between retries (default: 100)
- `retryBackoff?: RetryBackoffFunction` - Function to calculate backoff delay (default: fixed delay)
- `retryOnlyIdempotent?: boolean` - Only retry commands marked as idempotent (default: true)
- `lazyConnect?: boolean` - When `true`, nodes will not connect until the first command is executed. When `false`, nodes connect eagerly during construction (default: true)
- `maxKeySize?: number` - Maximum allowed key size in characters (default: 250, memcache protocol max)
- `maxValueSize?: number` - Maximum allowed value size in bytes (default: 1048576, memcached default)
- `maxExpiration?: number` - Maximum allowed expiration in seconds (default: 2592000, memcached's 30-day relative-time boundary). Values above this throw. `0` (no expiration) is always allowed. Raise this if you need to pass absolute Unix timestamps as expirations.
- `hashLargeKey?: boolean | Hashery` - When `true`, keys longer than `maxKeySize` are deterministically hashed via [`hashery`](https://github.com/jaredwray/hashery) (djb2 sync by default) before being sent to the server, instead of throwing. Pass a configured `Hashery` instance (e.g. `new Hashery({ defaultAlgorithmSync: 'fnv1' })`) to choose a different sync algorithm or plug in custom providers. When `false`, oversized keys throw a validation error (default: false). Note: hashing is one-way and can collide; two distinct long keys could map to the same hashed key.
- `autoDiscover?: AutoDiscoverOptions` - AWS ElastiCache Auto Discovery configuration (see [Auto Discovery](#auto-discovery))

## Properties

### `nodes: MemcacheNode[]` (readonly)
Returns the list of all MemcacheNode instances in the cluster.

### `nodeIds: string[]` (readonly)
Returns the list of node IDs (e.g., `["localhost:11211", "127.0.0.1:11212"]`).

### `hash: HashProvider`
Get or set the hash provider used for consistent hashing distribution.

### `timeout: number`
Get or set the timeout for operations in milliseconds (default: 5000).

### `keepAlive: boolean`
Get or set the keepAlive setting. Updates all existing nodes. Requires `reconnect()` to apply changes.

### `keepAliveDelay: number`
Get or set the keep alive delay in milliseconds. Updates all existing nodes. Requires `reconnect()` to apply changes.

### `retries: number`
Get or set the number of retry attempts for failed commands (default: 0).

### `retryDelay: number`
Get or set the base delay in milliseconds between retry attempts (default: 100).

### `retryBackoff: RetryBackoffFunction`
Get or set the backoff function for calculating retry delays.

### `retryOnlyIdempotent: boolean`
Get or set whether retries are restricted to idempotent commands only (default: true).

### `maxKeySize: number`
Get or set the maximum allowed key size in characters (default: 250). Memcache protocol max is 250.

### `maxValueSize: number`
Get or set the maximum allowed value size in bytes (default: 1048576). Writes (`set`, `add`, `replace`, `append`, `prepend`, `cas`) throw when the encoded value exceeds this limit. Raise it if your memcached server is started with a larger `-I` item size.

### `maxExpiration: number`
Get or set the maximum allowed expiration in seconds (default: 2592000). Writes that accept an expiration (`set`, `add`, `replace`, `cas`, `touch`) throw when `exptime` exceeds this limit. `0` (no expiration) is always allowed. Memcached treats any `exptime` greater than 2592000 as an absolute Unix timestamp, so the default guards against accidentally setting a TTL that memcached interprets as "already expired." Raise this if you need to pass Unix timestamps.

### `hashLargeKey: boolean`
Get or set whether keys exceeding `maxKeySize` are hashed instead of throwing (default: false). When enabled, oversized keys are replaced with a short, deterministic hex digest (via the [`hashery`](https://github.com/jaredwray/hashery) library, djb2 by default) before being sent to memcache, so any string length is accepted. The same input always produces the same hashed key, but distinct long keys can collide. To change algorithm or providers, configure the [`hashery`](#hashery-hashery) property.

```javascript
const client = new Memcache({ hashLargeKey: true });
const longKey = 'user:profile:' + 'x'.repeat(500);
await client.set(longKey, 'value');     // hashed automatically
await client.get(longKey);              // same hash, returns 'value'
```

### `hashery: Hashery`
Get or set the `Hashery` instance used to hash oversized keys when `hashLargeKey` is enabled. Always returns an instance, even when hashing is disabled, so you can pre-configure it (algorithm, custom providers, caching) before flipping `hashLargeKey` on. `Hashery` is re-exported from this package for convenience.

```javascript
import Memcache, { Hashery } from 'memcache';

// Simple — defaults to djb2 sync hashing
const simple = new Memcache({ hashLargeKey: true });

// Advanced — supply a Hashery preconfigured for fnv1
const advanced = new Memcache({
  hashLargeKey: new Hashery({ defaultAlgorithmSync: 'fnv1' }),
});

// Or mutate the instance after construction
simple.hashery.defaultAlgorithmSync = 'murmur';
```

### `lazyConnect: boolean` (readonly)
Whether nodes defer connecting until the first command is executed (default: true).

## Connection Management

### `connect(nodeId?: string): Promise<void>`
Connect to all Memcache servers or a specific node.

### `disconnect(): Promise<void>`
Disconnect all connections.

### `reconnect(): Promise<void>`
Reconnect all nodes by disconnecting and connecting them again.

### `quit(): Promise<void>`
Quit all connections gracefully.

### `isConnected(): boolean`
Check if any node is connected to a Memcache server.

## Node Management

### `getNodes(): MemcacheNode[]`
Get an array of all MemcacheNode instances.

### `getNode(id: string): MemcacheNode | undefined`
Get a specific node by its ID (e.g., `"localhost:11211"`).

### `addNode(uri: string | MemcacheNode, weight?: number): Promise<void>`
Add a new node to the cluster. Throws error if node already exists.

### `removeNode(uri: string): Promise<void>`
Remove a node from the cluster.

### `getNodesByKey(key: string): Promise<MemcacheNode[]>`
Get the nodes for a given key using consistent hashing. Automatically connects to nodes if not already connected.

### `parseUri(uri: string): { host: string; port: number }`
Parse a URI string into host and port. Supports formats:
- Simple: `"localhost:11211"` or `"localhost"`
- Protocol: `"memcache://localhost:11211"`, `"tcp://localhost:11211"`
- IPv6: `"[::1]:11211"` or `"memcache://[2001:db8::1]:11212"`
- Unix socket: `"/var/run/memcached.sock"` or `"unix:///var/run/memcached.sock"`

## Data Storage Operations

### `get(key: string): Promise<string | undefined>`
Get a value from the Memcache server. Returns the first successful result from replica nodes.

### `gets(keys: string[]): Promise<Map<string, string>>`
Get multiple values from the Memcache server. Returns a Map with keys to values.

### `set(key: string, value: string, exptime?: number, flags?: number): Promise<boolean>`
Set a value in the Memcache server. Returns true only if all replica nodes succeed.
- `exptime` - Expiration time in seconds (default: 0 = never expire)
- `flags` - Flags/metadata (default: 0)

### `add(key: string, value: string, exptime?: number, flags?: number): Promise<boolean>`
Add a value (only if key doesn't exist). Returns true only if all replica nodes succeed.

### `replace(key: string, value: string, exptime?: number, flags?: number): Promise<boolean>`
Replace a value (only if key exists). Returns true only if all replica nodes succeed.

### `cas(key: string, value: string, casToken: string, exptime?: number, flags?: number): Promise<boolean>`
Check-And-Set: Store a value only if it hasn't been modified since last fetch. Returns true only if all replica nodes succeed.

## String Modification Operations

### `append(key: string, value: string): Promise<boolean>`
Append a value to an existing key. Returns true only if all replica nodes succeed.

### `prepend(key: string, value: string): Promise<boolean>`
Prepend a value to an existing key. Returns true only if all replica nodes succeed.

## Deletion & Expiration

### `delete(key: string): Promise<boolean>`
Delete a value from the Memcache server. Returns true only if all replica nodes succeed.

### `touch(key: string, exptime: number): Promise<boolean>`
Update expiration time without retrieving value. Returns true only if all replica nodes succeed.

## Numeric Operations

### `incr(key: string, value?: number): Promise<number | undefined>`
Increment a value. Returns the new value or undefined on failure.
- `value` - Amount to increment (default: 1)

### `decr(key: string, value?: number): Promise<number | undefined>`
Decrement a value. Returns the new value or undefined on failure.
- `value` - Amount to decrement (default: 1)

## Server Management & Statistics

### `flush(delay?: number): Promise<boolean>`
Flush all values from all Memcache servers. Returns true if all nodes successfully flushed.
- `delay` - Optional delay in seconds before flushing

### `stats(type?: string): Promise<Map<string, MemcacheStats>>`
Get statistics from all Memcache servers. Returns a Map of node IDs to their stats.

### `version(): Promise<Map<string, string>>`
Get the Memcache server version from all nodes. Returns a Map of node IDs to version strings.

## Validation

### `validateKey(key: string): void`
Validates a Memcache key according to protocol requirements. Throws error if:
- Key is empty
- Key exceeds 250 characters
- Key contains spaces, newlines, or null characters

### `resolveKey(key: string): string`
Returns the key that will actually be sent to memcache. When [`hashLargeKey`](#hashlargekey-boolean) is `true` and the key length exceeds `maxKeySize`, returns a short hex digest produced by the configured [`hashery`](#hashery-hashery) instance (djb2 by default — 8 hex chars). Otherwise returns the original key unchanged. Called automatically before `validateKey` in every command, so calling it manually is only needed when you want to inspect the on-wire key.

## Helper Functions

### `createNode(host: string, port: number, options?: MemcacheNodeOptions): MemcacheNode`
Factory function to create a new MemcacheNode instance.

```javascript
import { createNode } from 'memcache';

const node = createNode('localhost', 11211, {
  timeout: 5000,
  keepAlive: true,
  weight: 1
});
```

# Hooks and Events

The Memcache client extends [Hookified](https://github.com/jaredwray/hookified) to provide powerful hooks and events for monitoring and customizing behavior.

## Events

The client emits various events during operations that you can listen to:

```javascript
const client = new Memcache();

// Connection events
client.on('connect', () => {
  console.log('Connected to Memcache server');
});

client.on('close', () => {
  console.log('Connection closed');
});

client.on('error', (error) => {
  console.error('Error:', error);
});

client.on('timeout', () => {
  console.log('Connection timeout');
});

// Cache hit/miss events
client.on('hit', (key, value) => {
  console.log(`Cache hit for key: ${key}`);
});

client.on('miss', (key) => {
  console.log(`Cache miss for key: ${key}`);
});
```

## Available Events

- `connect` - Emitted when connection to Memcache server is established
- `close` - Emitted when connection is closed
- `error` - Emitted when an error occurs
- `timeout` - Emitted when a connection timeout occurs
- `hit` - Emitted when a key is found in cache (includes key and value)
- `miss` - Emitted when a key is not found in cache
- `quit` - Emitted when quit command is sent
- `warn` - Emitted for warning messages
- `info` - Emitted for informational messages
- `autoDiscover` - Emitted on initial auto discovery with the cluster config
- `autoDiscoverUpdate` - Emitted when auto discovery detects a topology change
- `autoDiscoverError` - Emitted when auto discovery encounters an error

## Hooks

Hooks allow you to intercept and modify behavior before and after operations. Every operation supports `before` and `after` hooks.

```javascript
const client = new Memcache();

// Add a before hook for get operations
client.onHook('before:get', async ({ key }) => {
  console.log(`Getting key: ${key}`);
});

// Add an after hook for set operations
client.onHook('after:set', async ({ key, value, success }) => {
  if (success) {
    console.log(`Successfully set ${key}`);
  }
});

// Hooks can be async and modify behavior
client.onHook('before:set', async ({ key, value }) => {
  console.log(`About to set ${key} = ${value}`);
  // Perform validation, logging, etc.
});
```

## Available Hooks

All operations support before and after hooks with specific parameters:

## get(key)
- `before:get` - `{ key }`
- `after:get` - `{ key, value }` (value is array or undefined)

## set(key, value, exptime?, flags?)
- `before:set` - `{ key, value, exptime, flags }`
- `after:set` - `{ key, value, exptime, flags, success }`

## gets(keys[])
- `before:gets` - `{ keys }`
- `after:gets` - `{ keys, values }` (values is a Map)

## add(key, value, exptime?, flags?)
- `before:add` - `{ key, value, exptime, flags }`
- `after:add` - `{ key, value, exptime, flags, success }`

## replace(key, value, exptime?, flags?)
- `before:replace` - `{ key, value, exptime, flags }`
- `after:replace` - `{ key, value, exptime, flags, success }`

## append(key, value)
- `before:append` - `{ key, value }`
- `after:append` - `{ key, value, success }`

## prepend(key, value)
- `before:prepend` - `{ key, value }`
- `after:prepend` - `{ key, value, success }`

## delete(key)
- `before:delete` - `{ key }`
- `after:delete` - `{ key, success }`

## incr(key, value?)
- `before:incr` - `{ key, value }`
- `after:incr` - `{ key, value, newValue }`

## decr(key, value?)
- `before:decr` - `{ key, value }`
- `after:decr` - `{ key, value, newValue }`

## touch(key, exptime)
- `before:touch` - `{ key, exptime }`
- `after:touch` - `{ key, exptime, success }`

## Hook Examples

```javascript
const client = new Memcache();

// Log all get operations
client.onHook('before:get', async ({ key }) => {
  console.log(`[GET] Fetching key: ${key}`);
});

client.onHook('after:get', async ({ key, value }) => {
  console.log(`[GET] Key: ${key}, Found: ${value !== undefined}`);
});

// Log all set operations with timing
client.onHook('before:set', async (context) => {
  context.startTime = Date.now();
});

client.onHook('after:set', async (context) => {
  const duration = Date.now() - context.startTime;
  console.log(`[SET] Key: ${context.key}, Success: ${context.success}, Time: ${duration}ms`);
});
```

# Distribution Algorithms

Memcache supports pluggable distribution algorithms to determine how keys are distributed across nodes. You can configure the algorithm using the `hash` option.

## KetamaHash (Default)

KetamaHash uses the Ketama consistent hashing algorithm, which minimizes key redistribution when nodes are added or removed. This is the default and recommended algorithm for production environments with dynamic scaling.

```javascript
import { Memcache } from 'memcache';

// KetamaHash is used by default
const client = new Memcache({
  nodes: ['server1:11211', 'server2:11211', 'server3:11211']
});
```

**Characteristics:**
- Minimal key redistribution (~1/n keys move when adding/removing nodes)
- Uses virtual nodes for better distribution
- Supports weighted nodes
- Best for production environments with dynamic scaling

## ModulaHash

ModulaHash uses a simple modulo-based hashing algorithm (`hash(key) % nodeCount`). This is a simpler algorithm that may redistribute all keys when nodes change.

```javascript
import { Memcache, ModulaHash } from 'memcache';

// Use ModulaHash for distribution
const client = new Memcache({
  nodes: ['server1:11211', 'server2:11211', 'server3:11211'],
  hash: new ModulaHash()
});

// With a custom hash algorithm (default is sha1)
const client2 = new Memcache({
  nodes: ['server1:11211', 'server2:11211'],
  hash: new ModulaHash('md5')
});
```

**Characteristics:**
- Simple and fast algorithm
- All keys may be redistributed when nodes are added or removed
- Supports weighted nodes (nodes with higher weight appear more in the distribution)
- Best for fixed-size clusters or testing environments

### Weighted Nodes with ModulaHash

ModulaHash supports weighted nodes, where nodes with higher weights receive proportionally more keys:

```javascript
import { Memcache, ModulaHash, createNode } from 'memcache';

// Create nodes with different weights
const node1 = createNode('server1', 11211, { weight: 3 }); // 3x traffic
const node2 = createNode('server2', 11211, { weight: 1 }); // 1x traffic

const client = new Memcache({
  nodes: [node1, node2],
  hash: new ModulaHash()
});

// server1 will receive approximately 75% of keys
// server2 will receive approximately 25% of keys
```

## BroadcastHash

BroadcastHash sends every operation to all nodes in the cluster. Instead of partitioning keys across nodes, every `getNodesByKey()` call returns all nodes, so reads and writes are broadcast to every server.

```javascript
import { Memcache, BroadcastHash } from 'memcache';

// Use BroadcastHash for full replication
const client = new Memcache({
  nodes: ['server1:11211', 'server2:11211', 'server3:11211'],
  hash: new BroadcastHash()
});

// Every set/get/delete hits all three nodes
await client.set('mykey', 'Hello!');
```

**Characteristics:**
- Every operation targets all nodes
- No key partitioning — all nodes hold the same data
- Reads return the first successful result from any node
- Writes succeed only if all nodes succeed
- Best for replication, broadcast invalidation, or small clusters where all nodes should be in sync

## Choosing an Algorithm

| Feature | KetamaHash | ModulaHash | BroadcastHash |
|---------|------------|------------|---------------|
| Key redistribution on node change | Minimal (~1/n keys) | All keys may move | N/A (all nodes always) |
| Complexity | Higher (virtual nodes) | Lower (simple modulo) | Simplest |
| Performance | Slightly slower | Faster | Depends on node count |
| Best for | Dynamic scaling | Fixed clusters | Replication |
| Weighted nodes | Yes | Yes | No |

**Use KetamaHash (default) when:**
- Your cluster size may change dynamically
- You want to minimize cache invalidation during scaling
- You're running in production

**Use ModulaHash when:**
- Your cluster size is fixed
- You prefer simplicity over minimal redistribution
- You're in a testing or development environment

**Use BroadcastHash when:**
- You want all nodes to hold the same data
- You need broadcast cache invalidation across all nodes
- You're running a small cluster where replication is more important than partitioning

# Retry Configuration

The Memcache client supports automatic retry of failed commands with configurable backoff strategies.

## Basic Retry Setup

Enable retries by setting the `retries` option:

```javascript
import { Memcache } from 'memcache';

const client = new Memcache({
  nodes: ['localhost:11211'],
  retries: 3,        // Retry up to 3 times
  retryDelay: 100    // 100ms between retries
});
```

You can also modify retry settings at runtime:

```javascript
client.retries = 5;
client.retryDelay = 200;
```

## Backoff Strategies

The client includes two built-in backoff functions:

### Fixed Delay (Default)

```javascript
import { Memcache, defaultRetryBackoff } from 'memcache';

const client = new Memcache({
  retries: 3,
  retryDelay: 100,
  retryBackoff: defaultRetryBackoff  // 100ms, 100ms, 100ms
});
```

### Exponential Backoff

```javascript
import { Memcache, exponentialRetryBackoff } from 'memcache';

const client = new Memcache({
  retries: 3,
  retryDelay: 100,
  retryBackoff: exponentialRetryBackoff  // 100ms, 200ms, 400ms
});
```

### Custom Backoff Function

You can provide your own backoff function:

```javascript
const client = new Memcache({
  retries: 3,
  retryDelay: 100,
  retryBackoff: (attempt, baseDelay) => {
    // Exponential backoff with jitter
    const delay = baseDelay * Math.pow(2, attempt);
    return delay + Math.random() * delay * 0.1;
  }
});
```

The backoff function receives:
- `attempt` - The current attempt number (0-indexed)
- `baseDelay` - The configured `retryDelay` value

## Idempotent Safety

**Important:** By default, retries are only performed for commands explicitly marked as idempotent. This prevents accidental double-execution of non-idempotent operations like `incr`, `decr`, `append`, and `prepend`.

### Why This Matters

If a network timeout occurs after the server applies a mutation but before the client receives the response, retrying would apply the mutation twice:
- Counter incremented twice instead of once
- Data appended twice instead of once

### Safe Usage Patterns

**For read operations (always safe to retry):**

```javascript
// Mark read operations as idempotent
await client.execute('get mykey', nodes, { idempotent: true });
```

**For idempotent writes (safe to retry):**

```javascript
// SET with the same value is idempotent
await client.execute('set mykey 0 0 5\r\nhello', nodes, { idempotent: true });
```

**Disable safety for all commands (use with caution):**

```javascript
const client = new Memcache({
  retries: 3,
  retryOnlyIdempotent: false  // Allow retries for ALL commands
});
```

### Behavior Summary

| `retryOnlyIdempotent` | `idempotent` flag | Retries enabled? |
|-----------------------|-------------------|------------------|
| `true` (default)      | `false` (default) | No               |
| `true` (default)      | `true`            | Yes              |
| `false`               | (any)             | Yes              |

### Methods Without Retry Support

The following methods do not use the retry mechanism and have their own error handling:

- `get()` - Returns `undefined` on failure
- `gets()` - Returns partial results on node failure
- `flush()` - Operates directly on nodes
- `stats()` - Operates directly on nodes
- `version()` - Operates directly on nodes

To use retries with read operations, use the `execute()` method directly:

```javascript
const nodes = await client.getNodesByKey('mykey');
const results = await client.execute('get mykey', nodes, { idempotent: true });
```

# SASL Authentication

The Memcache client supports SASL (Simple Authentication and Security Layer) authentication using the PLAIN mechanism. This allows you to connect to memcached servers that require authentication.

## Enabling SASL Authentication

```javascript
import { Memcache } from 'memcache';

const client = new Memcache({
  nodes: ['localhost:11211'],
  sasl: {
    username: 'myuser',
    password: 'mypassword',
  },
});

await client.connect();
// Client is now authenticated and ready to use
```

## SASL Options

The `sasl` option accepts an object with the following properties:

- `username: string` - The username for authentication (required)
- `password: string` - The password for authentication (required)
- `mechanism?: 'PLAIN'` - The SASL mechanism to use (default: 'PLAIN')

Currently, only the PLAIN mechanism is supported.

## Binary Protocol Methods

**Important:** Memcached servers with SASL enabled (`-S` flag) require the binary protocol for all operations after authentication. The standard text-based methods (`client.get()`, `client.set()`, etc.) will not work on SASL-enabled servers.

Use the `binary*` methods on nodes for SASL-enabled servers:

```javascript
import { Memcache } from 'memcache';

const client = new Memcache({
  nodes: ['localhost:11211'],
  sasl: { username: 'user', password: 'pass' },
});

await client.connect();

// Access the node directly for binary operations
const node = client.nodes[0];

// Binary protocol operations
await node.binarySet('mykey', 'myvalue', 3600);     // Set with 1 hour expiry
const value = await node.binaryGet('mykey');         // Get value
await node.binaryDelete('mykey');                    // Delete key

// Other binary operations
await node.binaryAdd('newkey', 'value');             // Add (only if not exists)
await node.binaryReplace('existingkey', 'newvalue'); // Replace (only if exists)
await node.binaryIncr('counter', 1);                 // Increment
await node.binaryDecr('counter', 1);                 // Decrement
await node.binaryAppend('mykey', '-suffix');         // Append to value
await node.binaryPrepend('mykey', 'prefix-');        // Prepend to value
await node.binaryTouch('mykey', 7200);               // Update expiration
await node.binaryFlush();                            // Flush all
const version = await node.binaryVersion();          // Get server version
const stats = await node.binaryStats();              // Get server stats
```

## Per-Node SASL Configuration

You can also configure SASL credentials when creating individual nodes:

```javascript
import { createNode } from 'memcache';

// Create a node with SASL credentials
const node = createNode('localhost', 11211, {
  sasl: { username: 'user', password: 'pass' },
});

// Connect and use binary methods
await node.connect();
await node.binarySet('mykey', 'hello');
const value = await node.binaryGet('mykey');
```

## Authentication Events

You can listen for authentication events on both nodes and the client:

```javascript
import { Memcache, MemcacheNode } from 'memcache';

// Node-level events
const node = new MemcacheNode('localhost', 11211, {
  sasl: { username: 'user', password: 'pass' },
});

node.on('authenticated', () => {
  console.log('Node authenticated successfully');
});

node.on('error', (error) => {
  if (error.message.includes('SASL authentication failed')) {
    console.error('Authentication failed:', error.message);
  }
});

await node.connect();

// Client-level events (forwarded from nodes)
const client = new Memcache({
  nodes: ['localhost:11211'],
  sasl: { username: 'user', password: 'pass' },
});

client.on('authenticated', () => {
  console.log('Client authenticated');
});

await client.connect();
```

### Node Properties

- `node.hasSaslCredentials` - Returns `true` if SASL credentials are configured
- `node.isAuthenticated` - Returns `true` if the node has successfully authenticated

## Server Configuration

To use SASL authentication, your memcached server must be configured with SASL support:

1. **Build memcached with SASL support** - Ensure memcached was compiled with `--enable-sasl`

2. **Create SASL users** - Use `saslpasswd2` to create users:
   ```bash
   saslpasswd2 -a memcached -c username
   ```

3. **Configure SASL mechanism** - Create `/etc/sasl2/memcached.conf`:
   ```
   mech_list: plain
   ```

4. **Start memcached with SASL** - Use the `-S` flag:
   ```bash
   memcached -S -m 64 -p 11211
   ```

For more details, see the [memcached SASL documentation](https://github.com/memcached/memcached/wiki/SASLHowto).

# Auto Discovery

The Memcache client supports AWS ElastiCache Auto Discovery, which automatically detects cluster topology changes and adds or removes nodes as needed. When enabled, the client connects to a configuration endpoint, retrieves the current list of cache nodes, and periodically polls for changes.

## Enabling Auto Discovery

```javascript
import { Memcache } from 'memcache';

const client = new Memcache({
  nodes: [],
  autoDiscover: {
    enabled: true,
    configEndpoint: 'my-cluster.cfg.use1.cache.amazonaws.com:11211',
  },
});

await client.connect();
// The client automatically discovers and connects to all cluster nodes
```

If you omit `configEndpoint`, the first node in the `nodes` array is used as the configuration endpoint:

```javascript
const client = new Memcache({
  nodes: ['my-cluster.cfg.use1.cache.amazonaws.com:11211'],
  autoDiscover: {
    enabled: true,
  },
});
```

## Auto Discovery Options

The `autoDiscover` option accepts an object with the following properties:

- `enabled: boolean` - Enable auto discovery of cluster nodes (required)
- `pollingInterval?: number` - How often to poll for topology changes, in milliseconds (default: 60000)
- `configEndpoint?: string` - The configuration endpoint to use for discovery. This is typically the `.cfg` endpoint from ElastiCache. If not specified, the first node in the `nodes` array will be used
- `useLegacyCommand?: boolean` - Use the legacy `get AmazonElastiCache:cluster` command instead of `config get cluster` (default: false)

## Auto Discovery Events

The client emits events during the auto discovery lifecycle:

```javascript
const client = new Memcache({
  nodes: [],
  autoDiscover: {
    enabled: true,
    configEndpoint: 'my-cluster.cfg.use1.cache.amazonaws.com:11211',
  },
});

// Emitted on initial discovery with the full cluster config
client.on('autoDiscover', (config) => {
  console.log('Discovered nodes:', config.nodes);
  console.log('Config version:', config.version);
});

// Emitted when polling detects a topology change
client.on('autoDiscoverUpdate', (config) => {
  console.log('Cluster topology changed:', config.nodes);
});

// Emitted when discovery encounters an error (non-fatal, retries on next poll)
client.on('autoDiscoverError', (error) => {
  console.error('Discovery error:', error.message);
});

await client.connect();
```

## Legacy Command Support

For ElastiCache engine versions older than 1.4.14, use the legacy discovery command:

```javascript
const client = new Memcache({
  nodes: [],
  autoDiscover: {
    enabled: true,
    configEndpoint: 'my-cluster.cfg.use1.cache.amazonaws.com:11211',
    useLegacyCommand: true, // Uses 'get AmazonElastiCache:cluster' instead of 'config get cluster'
  },
});
```

# IPv6 Support

The Memcache client fully supports IPv6 addresses using standard bracket notation in URIs.

## Connecting to IPv6 Nodes

```javascript
import { Memcache } from 'memcache';

// IPv6 loopback
const client = new Memcache('[::1]:11211');

// Multiple IPv6 nodes
const client = new Memcache({
  nodes: [
    '[::1]:11211',
    '[2001:db8::1]:11211',
    'memcache://[2001:db8::2]:11212',
  ],
});

await client.connect();
```

## IPv6 in Auto Discovery

When auto discovery returns IPv6 node addresses, the client automatically brackets them for correct URI handling:

```javascript
const client = new Memcache({
  nodes: [],
  autoDiscover: {
    enabled: true,
    configEndpoint: '[2001:db8::1]:11211',
  },
});

await client.connect();
// Discovered IPv6 nodes are added as [host]:port automatically
```

## IPv6 Node IDs

Node IDs for IPv6 addresses use bracket notation to avoid ambiguity:

```javascript
const client = new Memcache({
  nodes: ['[::1]:11211', '[2001:db8::1]:11212'],
});

console.log(client.nodeIds);
// ['[::1]:11211', '[2001:db8::1]:11212']
```

# Benchmarks

These are provided to show a simple benchmark against current libraries. This is not robust but it is something we update regularly to make sure we are keeping performant.

|             name             |  summary  |  ops/sec  |  time/op  |  margin  |  samples  |
|------------------------------|:---------:|----------:|----------:|:--------:|----------:|
|  memcache set/get (v1.4.0)   |    🥇     |       3K  |    350µs  |  ±0.19%  |      10K  |
|  memcached set/get (v2.2.2)  |   -2.9%   |       3K  |    361µs  |  ±0.16%  |      10K  |
|  memjs set/get (v1.3.2)      |   -12%    |       3K  |    398µs  |  ±0.17%  |      10K  |

# Contributing

Please read our [Contributing Guidelines](./CONTRIBUTING.md) and also our [Code of Conduct](./CODE_OF_CONDUCT.md).

# License and Copyright

[MIT & Copyright (c) Jared Wray](https://github.com/jaredwray/memcache/blob/main/LICENSE)
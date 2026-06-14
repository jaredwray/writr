# http-cache

> A modern HTTP caching gateway — from the makers of [keyv](https://github.com/jaredwray/keyv) and [cacheable](https://github.com/jaredwray/cacheable).

`http-cache` is a gateway that gives you full control over your caching system: pick
any storage backend (Redis, Memcache, MongoDB, …) via providers, get L1/L2 in-memory
caching at the gateway, push live changes over socket.io, and scale with **global load
balancing** instead of old-school clustering.

This repository is a **pnpm monorepo**. Its first deliverable is the architecture
specification, published as a documentation website built with
[docula](https://github.com/jaredwray/docula).

> 📖 Read the full specification at the docs site (built from [`website/`](./website)).

## Requirements

- Node.js `^22.18.0 || >=24`
- [pnpm](https://pnpm.io)

## Getting started

```bash
pnpm install
```

## Documentation website

The docs live in [`website/site`](./website/site) as a multi-doc docula site.

| Script | Description |
| ------ | ----------- |
| `pnpm website:dev` | Build, watch, and serve the docs locally (http://localhost:3000) |
| `pnpm website:serve` | Build and serve the docs |
| `pnpm website:build` | Build the static site to `website/site/dist` |

> The docs build fetches repository metadata (contributors) from the GitHub API. Set a
> `GITHUB_TOKEN` environment variable to avoid anonymous rate limits — CI provides this
> automatically.

## Quality

| Script | Description |
| ------ | ----------- |
| `pnpm lint` | Lint and format-check with [Biome](https://biomejs.dev) |
| `pnpm format` | Auto-format with Biome |
| `pnpm test` | Run Biome checks + [Vitest](https://vitest.dev) with coverage |

## License

[MIT](./LICENSE) © Jared Wray

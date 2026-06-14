# AGENTS.md

Guidelines for AI coding agents (Claude, Gemini, Codex).

## Mandatory with all changes

- `pnpm build` must be successful
- `pnpm test` must be successful with 100% code coverage

## Commands

- `pnpm install` - Install dependencies
- `pnpm build` - Build for production (ESM + CJS + type definitions)
- `pnpm lint` - Run Biome linter with auto-fix
- `pnpm test` - Run linter and Vitest with coverage
- `pnpm test:ci` - CI-specific testing (strict linting + coverage)
- `pnpm test:services:start` - Start Docker memcached (required for integration tests)
- `pnpm test:services:stop` - Stop test services
- `pnpm clean` - Remove node_modules, coverage, and dist directories

**Use pnpm, not npm.**

## Development Rules

1. **Start test services first** - Run `pnpm test:services:start` before running tests
2. **Always run `pnpm build` before committing** - Build must succeed
3. **Always run `pnpm test` before committing** - All tests must pass
4. **Follow existing code style** - Biome enforces formatting and linting
5. **Mirror source structure in tests** - Test files go in `test/` matching `src/` structure

## Structure

- `src/index.ts` - Main Memcache client class with all protocol operations
- `src/node.ts` - MemcacheNode class for single server TCP connections
- `src/ketama.ts` - Consistent hashing implementation (Ketama algorithm)
- `test/` - Test files (Vitest)

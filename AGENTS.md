# AGENTS.md

Guidelines for AI coding agents (Claude, Gemini, Codex).

## Project

Writr is a Node.js markdown rendering library built with TypeScript. It simplifies markdown-to-HTML conversion by removing remark/unified complexity while leveraging the powerful unified processor ecosystem. Key features include built-in caching, frontmatter support, React rendering, GitHub Flavored Markdown (GFM), syntax highlighting, math support, and hook/event capabilities via hookified.

## Commands

- `pnpm install` - Install dependencies
- `pnpm build` - Build for production (ESM + type definitions)
- `pnpm lint` - Run Biome linter with auto-fix
- `pnpm test` - Run linter and Vitest with coverage
- `pnpm test:ci` - CI-specific testing (strict linting + coverage)
- `pnpm benchmark` - Run performance benchmarks
- `pnpm clean` - Remove node_modules, coverage, and dist directories
- `pnpm website:build` - Build documentation website
- `pnpm website:serve` - Serve documentation website locally

**Use pnpm, not npm.**

## Development Rules

1. **Always run `pnpm build` before committing** - Build must succeed
2. **Always run `pnpm test` before committing** - All tests must pass
3. **Follow existing code style** - Biome enforces formatting and linting
4. **Mirror source structure in tests** - Test files go in `test/` matching `src/` structure
5. **Maintain ESM-only compatibility** - This is an ESM-only package
6. **Test on Node.js >= 20** - Minimum supported version is Node 20

## Structure

- `src/writr.ts` - Main Writr class with markdown rendering, React support, and file operations
- `src/writr-cache.ts` - Caching implementation using Cacheable
- `test/` - Test files (Vitest) mirroring src structure
- `test/content-fixtures.ts` - Shared test markdown content and fixtures
- `benchmark/` - Performance benchmarks using tinybench
- `site/` - Documentation website (built with docula)

## Key Technologies

- **unified/remark/rehype** - Core markdown processing pipeline
- **hookified** - Hook and event emitter capabilities
- **cacheable** - Built-in caching system
- **react** - React component rendering support
- **biome** - Linting and formatting
- **vitest** - Testing framework with coverage

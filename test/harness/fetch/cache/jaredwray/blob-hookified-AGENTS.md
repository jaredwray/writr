# Agent Guidelines for Hookified

Hookified is an event emitting and middleware hooks library for Node.js and the browser. It provides a simple replacement for EventEmitter with async/sync middleware hooks support.

## Project Overview

- **Purpose**: Provide event emitting and middleware hooks functionality for classes
- **Architecture**: TypeScript library with ESM/CJS support and browser builds
- **Key Features**: EventEmitter replacement, async/sync middleware hooks, before/after hooks, deprecation warnings, logger integration

## Development Commands

- Use `pnpm` instead of `npm` for all package management commands
- `pnpm build` - Build the TypeScript code for Node.js and browser
- `pnpm test` - Run linting (Biome) and tests with coverage
- `pnpm lint` - Run Biome linter with auto-fix
- `pnpm benchmark` - Run performance benchmarks (hooks and emit)
- `pnpm clean` - Remove dist, coverage, and site/dist directories

## Code Quality Requirements

- Always run `pnpm test` to verify tests pass before completing changes
- Maintain high code coverage - all new code must have corresponding tests
- Follow existing code patterns in the source files
- Use Biome for linting and formatting (configured in the project)

## Project Structure

- `src/index.ts` - Main Hookified class with hooks functionality
- `src/eventified.ts` - Base event emitter class (Eventified)
- `src/types.ts` - TypeScript type definitions
- `test/` - Vitest test files
- `benchmark/` - Performance benchmark scripts (hook.ts, emit.ts)
- `dist/node/` - Node.js build output (ESM and CJS)
- `dist/browser/` - Browser build output

## Key Concepts

### Hookified Class
The main class that extends Eventified and provides:
- Hook registration: `onHook()`, `addHook()`, `onHookEntry()`, `onHooks()`, `prependHook()`
- Hook execution: `hook()`, `callHook()`, `hookSync()`, `beforeHook()`, `afterHook()`
- Hook management: `getHooks()`, `removeHook()`, `removeHooks()`, `clearHooks()`
- Once hooks: `onceHook()`, `prependOnceHook()`

### Eventified Class
Base class providing EventEmitter-like functionality:
- Event registration: `on()`, `once()`, `prependListener()`, `prependOnceListener()`
- Event emission: `emit()`
- Event management: `off()`, `removeAllListeners()`, `listeners()`, `eventNames()`

### Configuration Options
- `throwOnHookError` - Throw errors in hooks instead of just emitting
- `throwOnEmitError` - Throw errors on emit
- `throwOnEmptyListeners` - Throw when emitting 'error' with no listeners
- `enforceBeforeAfter` - Require hook names to start with 'before' or 'after'
- `deprecatedHooks` - Map of deprecated hook names to warning messages
- `allowDeprecated` - Control whether deprecated hooks can execute
- `eventLogger` - Logger instance for error and event logging

## Key Considerations

- The library has zero dependencies
- Supports both Node.js (22.18+) and browsers via CDN
- Browser builds are available at `dist/browser/index.js` (ESM) and `dist/browser/index.global.js` (UMD)
- Hooks can be async or sync - use `hook()` for async execution, `hookSync()` for sync-only
- Logger integration supports Pino, Winston, Bunyan, or any compatible logger

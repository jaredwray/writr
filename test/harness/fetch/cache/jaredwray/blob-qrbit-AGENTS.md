# Agent Guidelines for QrBit

QrBit is a fast QR code generator with logo embedding support, built with Rust (via napi-rs) as a native Node.js addon for maximum performance.

## Project Overview

- **Purpose**: Generate QR codes in SVG, PNG, and JPEG formats with optional logo embedding
- **Architecture**: TypeScript wrapper around a Rust native module for image processing
- **Key Dependencies**: `qrcode` (QR generation), `cacheable` (caching), `napi-rs` (Rust bindings)

## Development Commands

- Use `pnpm` instead of `npm` for all package management commands
- `pnpm build` - Build the Rust native module and TypeScript code (debug mode)
- `pnpm build:release` - Build for production/release
- `pnpm test` - Run linting and tests with coverage
- `pnpm lint` - Run Biome linter with auto-fix
- `pnpm benchmark` - Run performance benchmarks
- `pnpm generate-examples` - Generate example QR codes in the `examples/` directory

## Code Quality Requirements

- Always run `pnpm test` to verify tests pass before completing changes
- Maintain 100% code coverage - all new code must have corresponding tests
- Follow existing code patterns in `src/qrbit.ts` for the main class
- Use Biome for linting and formatting (configured in the project)

## Project Structure

- `src/qrbit.ts` - Main TypeScript class with QR code generation logic
- `src/lib.rs` - Rust native module for image processing (logo embedding, SVG to PNG/JPEG conversion)
- `test/` - Vitest test files
- `benchmark/` - Performance benchmark scripts
- `examples/` - Generated example QR codes

## Key Considerations

- The Rust module handles heavy image processing to avoid needing `node-canvas`
- Caching is built-in via `cacheable` for performance optimization
- Support multiple platforms: Windows, macOS (Intel/ARM), Linux
- Logo can be provided as a file path (faster) or Buffer

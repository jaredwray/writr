<div align="center"><img src="./site/logo.svg" alt="QrBit Logo" /></div>

# Qrbit

[![codecov](https://codecov.io/gh/jaredwray/qrbit/graph/badge.svg?token=VEUXLsudSh)](https://codecov.io/gh/jaredwray/qrbit)
[![tests](https://github.com/jaredwray/qrbit/actions/workflows/tests.yml/badge.svg)](https://github.com/jaredwray/qrbit/actions/workflows/tests.yml)
[![npm](https://img.shields.io/npm/v/qrbit)](https://www.npmjs.com/package/qrbit)
[![npm](https://img.shields.io/npm/dm/qrbit)](https://www.npmjs.com/package/qrbit)
[![license](https://img.shields.io/github/license/jaredwray/qrbit)](https://github.com/jaredwray/qrbit/blob/main/LICENSE)

A fast QR code generator with logo embedding support, built with Rust and native node packages for best performance while avoiding additional modules (example: canvas).

# Features

- **Fast**: Built with Rust (for logos) for maximum performance and caching 🚀
- **Fast SVG**: High performance SVG support via `QrCode` when no logo is needed
- **Cross-platform**: Works on iOS, Windows, Linux, and macOS
- **Logo embedding**: Add custom logos to your QR codes with no need for node canvas!
- **Error correction**: Configurable error correction levels (L, M, Q, H)
- **Customizable**: Custom colors, sizes, and margins
- **Multiple formats**: Generate SVG, PNG, JPEG, and WebP outputs
- **Scalable**: With caching you can also use a secondary store for persistence
- **Well-tested**: Comprehensive test coverage with Vitest
- **Maintained**: Actively maintained with regular updates

# Table of Contents
- [Installation](#installation)
- [Requirements](#requirements)
- [API](#api)
  - [Constructor](#constructoroptions-qroptions)
  - [Properties](#properties)
    - [text](#text)
    - [size](#size)
    - [margin](#margin)
    - [logo](#logo)
    - [logoSizeRatio](#logosizeratio)
    - [logoBackgroundColor](#logobackgroundcolor)
    - [logoPaddingRatio](#logopaddingratio)
    - [backgroundColor](#backgroundcolor)
    - [foregroundColor](#foregroundcolor)
    - [errorCorrection](#errorcorrection)
    - [cache](#cache)
  - [Methods](#methods)
    - [.toSvg()](#tosvgoptions-tooptions)
    - [.toSvgNapi()](#tosvgnapi)
    - [.toSvgFile()](#tosvgfilefilepath-string-options-tooptions)
    - [.toPng()](#topngoptions-tooptions)
    - [.toPngFile()](#topngfilefilepath-string-options-tooptions)
    - [.toJpg()](#tojpgoptions-tooptions)
    - [.toJpgFile()](#tojpgfilefilepath-string-options-tooptions)
    - [.toWebp()](#towebpoptions-tooptions)
    - [.toWebpFile()](#towebpfilefilepath-string-options-tooptions)
    - [Utility Methods](#utility-methods)
    - [Static Methods](#static-methods)
- [Benchmarks](#benchmarks)
- [Examples](#examples)
- [Contributing](#contributing)
- [License and Copyright](#license-and-copyright)

# Migration from v1 to v2

QrBit v2 upgrades the underlying [`hookified`](https://github.com/jaredwray/hookified) dependency from v1 to v2. This is a breaking change for consumers who use `HookifiedOptions` properties in their `QrOptions`.

## Breaking Changes

| v1 (qrbit 1.x) | v2 (qrbit 2.x) |
|---|---|
| `logger` option | Renamed to `eventLogger` |
| `throwHookErrors` option | Removed, use `throwOnHookError` |
| `throwOnEmptyListeners` defaults to `false` | Now defaults to `true` |
| `maxListeners` defaults to `100` | Now defaults to `0` (unlimited) |
| `HookEntry` type | Replaced by `IHook` interface |
| `Hook` type (function alias) | Renamed to `HookFn` |

## What Didn't Change

- All QR code generation methods (`.toSvg()`, `.toPng()`, `.toJpg()`, `.toWebp()`, and their file variants) work identically.
- Event emitting (`.on()`, `.emit()`, `.once()`, `.off()`) works identically.
- Constructor options for QR code configuration (`text`, `size`, `margin`, `logo`, `logoSizeRatio`, `backgroundColor`, `foregroundColor`, `errorCorrection`, `cache`) are unchanged.
- Caching behavior is unchanged.
- Logo embedding (path and buffer) works identically.

## Migration Steps

1. Update your `qrbit` dependency to v2:
   ```bash
   npm install qrbit@latest
   ```

2. If you pass a `logger` in your options, rename it to `eventLogger`:
   ```javascript
   // Before (v1)
   const qr = new QrBit({ text: "hello", logger: myLogger });

   // After (v2)
   const qr = new QrBit({ text: "hello", eventLogger: myLogger });
   ```

3. If you reference `throwHookErrors`, use `throwOnHookError` instead:
   ```javascript
   // Before (v1)
   const qr = new QrBit({ text: "hello", throwHookErrors: true });

   // After (v2)
   const qr = new QrBit({ text: "hello", throwOnHookError: true });
   ```

4. If you rely on `throwOnEmptyListeners` being `false`, explicitly set it:
   ```javascript
   const qr = new QrBit({ text: "hello", throwOnEmptyListeners: false });
   ```

# Installation

```bash
npm install qrbit
```

# Requirements

- Node.js >= 18
- Supported platforms: Windows (x86, x64), macOS (Arm, Intel), Linux (x64)

# Usage

```javascript
const qr = new QrBit({ text: "https://github.com/jaredwray/qrbit", size: 200 });
const svg = await qr.toSvg();
console.log(svg); // here is the svg!
```

Here is how you add a logo:

```javascript
const qr = new QrBit({ 
  text: "https://github.com/jaredwray/qrbit", 
  logo: '/path/to/logo.png',
  size: 200 });
const svg = await qr.toSvg();
console.log(svg); // here is the svg with an embedded logo!
```

```javascript
const qr = new QrBit({ 
  text: "https://github.com/jaredwray/qrbit", 
  logo: '/path/to/logo.png',
  size: 200 });
const png = await qr.toPng(); // buffer of the png!
```

# API

## constructor(options: QrOptions)

Creates a new QrBit instance with the specified options.

**Parameters:**
- `options` (QrOptions): Configuration object for the QR code

```typescript
interface QrOptions {
  text: string;                    // The text content to encode
  size?: number;                   // Size in pixels (default: 200)
  margin?: number;                 // Margin in pixels (default: undefined)
  logo?: string | Buffer;          // Logo file path or buffer
  logoSizeRatio?: number;          // Logo size ratio (default: 0.2)
  logoBackgroundColor?: string | false; // Backing patch color behind the logo (default: backgroundColor; pass false to disable)
  logoPaddingRatio?: number;       // Patch padding per side, ratio of logo size (default: 0.1)
  backgroundColor?: string;        // Background color (default: "#FFFFFF")
  foregroundColor?: string;        // Foreground color (default: "#000000")
  errorCorrection?: ECLevel;       // "L"|"M"|"Q"|"H"|"Low"|"Medium"|"Quartile"|"High" (default: "M")
  cache?: Cacheable | boolean;     // Caching configuration (default: true)
}

interface toOptions {
  cache?: boolean;                 // Enable/disable caching (default: true)
  quality?: number;                // Quality 1-100 (default: 90) - for toJpg; reserved for toWebp
}
```

**Example:**
```javascript
import { QrBit } from 'qrbit';

const qr = new QrBit({
  text: "https://github.com/jaredwray/qrbit",
  size: 300,
  margin: 20,
  logo: "./logo.png",
  logoSizeRatio: 0.25,
  backgroundColor: "#FFFFFF",
  foregroundColor: "#000000",
  errorCorrection: "H"
});
```

## Properties

### text
Get or set the text content for the QR code.

```javascript
const qr = new QrBit({ text: "Hello World" });
console.log(qr.text); // "Hello World"
qr.text = "New content";
```

### size
Get or set the size of the QR code in pixels.

```javascript
const qr = new QrBit({ text: "Hello World" });
console.log(qr.size); // 200 (default)
qr.size = 400;
```

### margin
Get or set the margin around the QR code in pixels.

```javascript
const qr = new QrBit({ text: "Hello World" });
console.log(qr.margin); // undefined (default)
qr.margin = 20;
```

### logo
Get or set the logo as a file path or buffer.

```javascript
const qr = new QrBit({ text: "Hello World" });
qr.logo = "./path/to/logo.png";
// or
qr.logo = fs.readFileSync("./logo.png");
```

### logoSizeRatio
Get or set the logo size ratio relative to QR code size (0.0 to 1.0).

```javascript
const qr = new QrBit({ text: "Hello World" });
qr.logoSizeRatio = 0.3; // 30% of QR code size
```

### logoBackgroundColor
Get or set the color rendered as a backing patch behind the logo. The patch prevents QR modules from showing through transparent areas of the logo. Defaults to `backgroundColor`. Pass `false` to disable the patch and overlay the logo directly on the QR.

```javascript
const qr = new QrBit({
  text: "Hello World",
  logo: "./logo.png",
});
qr.logoBackgroundColor = "#FFFFFF"; // explicit white patch
qr.logoBackgroundColor = false;     // no patch (legacy behavior)
```

### logoPaddingRatio
Get or set the padding around the logo for the backing patch, expressed as a ratio of the logo size on each side. e.g. `0.1` makes the patch 1.2× the logo size. Defaults to `0.1`.

```javascript
const qr = new QrBit({ text: "Hello World", logo: "./logo.png" });
qr.logoPaddingRatio = 0;    // patch matches logo size exactly
qr.logoPaddingRatio = 0.25; // patch is 1.5× logo size
```

### backgroundColor
Get or set the background color in hex format.

```javascript
const qr = new QrBit({ text: "Hello World" });
qr.backgroundColor = "#FF0000"; // Red background
```

### foregroundColor
Get or set the foreground color in hex format.

```javascript
const qr = new QrBit({ text: "Hello World" });
qr.foregroundColor = "#FFFFFF"; // White foreground
```

### errorCorrection
Get or set the error correction level. Higher levels recover more damage but produce denser codes.

Accepts initials or full names:
- `"L"` / `"Low"` — Low (~7% recovery)
- `"M"` / `"Medium"` — Medium (~15% recovery, default)
- `"Q"` / `"Quartile"` — Quartile (~25% recovery)
- `"H"` / `"High"` — High (~30% recovery, recommended when using logos)

```javascript
const qr = new QrBit({ text: "Hello World" });
qr.errorCorrection = "H";
qr.errorCorrection = "High"; // equivalent
```

### cache
Get or set the cache instance for performance optimization.

```javascript
import { Cacheable } from 'cacheable';

const qr = new QrBit({ text: "Hello World" });
qr.cache = new Cacheable(); // Custom cache instance
qr.cache = false; // Disable caching
```

## Methods

### .toSvg(options?: toOptions)

Generate SVG QR code with optional caching. Uses native QRCode library for simple cases, Rust implementation for logos.

**Parameters:**
- `options.cache?: boolean` - Whether to use caching (default: true)

**Returns:** Promise<string> - The SVG string

```javascript
const qr = new QrBit({ text: "Hello World" });
const svg = await qr.toSvg();
console.log(svg); // <svg xmlns="http://www.w3.org/2000/svg"...

// Without caching
const svgNoCache = await qr.toSvg({ cache: false });
```

### .toSvgNapi()

Generate SVG QR code using the native Rust implementation directly. Automatically selects between file path and buffer logo functions. If a logo file path doesn't exist, a `QrBitEvents.error` event is emitted.

> **Note:** By default (`throwOnEmitError = true`), emitting an error with no registered listener will **throw** rather than fall back to generating the SVG without a logo. To handle the error and still receive the SVG, register an error listener before calling this method.

**Returns:** Promise\<string\> - The SVG string

```javascript
// Default behavior – throws if logo file is missing and no error listener is registered
const qr = new QrBit({ text: "Hello World", logo: "./logo.png" });
const svg = await qr.toSvgNapi();
console.log(svg); // <svg xmlns="http://www.w3.org/2000/svg"...

// To fall back gracefully, register an error listener first
qr.on("error", (err) => console.warn("Logo not found:", err));
const svgFallback = await qr.toSvgNapi(); // generates SVG without logo
```

### .toSvgFile(filePath: string, options?: toOptions)

Generate SVG QR code and save it to a file. Creates directories if they don't exist.

**Parameters:**
- `filePath: string` - The file path where to save the SVG
- `options.cache?: boolean` - Whether to use caching (default: true)

**Returns:** Promise<void>

```javascript
const qr = new QrBit({ text: "Hello World" });
await qr.toSvgFile("./output/qr-code.svg");

// With options
await qr.toSvgFile("./output/qr-code.svg", { cache: false });
```

### .toPng(options?: toOptions)

Generate PNG QR code with optional caching. Uses high-performance SVG to PNG conversion.

**Parameters:**
- `options.cache?: boolean` - Whether to use caching (default: true)

**Returns:** Promise<Buffer> - The PNG buffer

```javascript
const qr = new QrBit({ text: "Hello World" });
const pngBuffer = await qr.toPng();

// Save to file
fs.writeFileSync("qr-code.png", pngBuffer);

// Without caching
const pngNoCache = await qr.toPng({ cache: false });
```

### .toPngFile(filePath: string, options?: toOptions)

Generate PNG QR code and save it to a file. Creates directories if they don't exist.

**Parameters:**
- `filePath: string` - The file path where to save the PNG
- `options.cache?: boolean` - Whether to use caching (default: true)

**Returns:** Promise<void>

```javascript
const qr = new QrBit({ text: "Hello World" });
await qr.toPngFile("./output/qr-code.png");

// With options
await qr.toPngFile("./output/qr-code.png", { cache: false });
```

### .toJpg(options?: toOptions)

Generate JPEG QR code with optional caching and quality control. Uses high-performance SVG to JPEG conversion.

**Parameters:**
- `options.cache?: boolean` - Whether to use caching (default: true)
- `options.quality?: number` - JPEG quality from 1-100 (default: 90)

**Returns:** Promise<Buffer> - The JPEG buffer

```javascript
const qr = new QrBit({ text: "Hello World" });
const jpgBuffer = await qr.toJpg();

// With high quality
const jpgHigh = await qr.toJpg({ quality: 95 });

// With compression for smaller file size
const jpgCompressed = await qr.toJpg({ quality: 70 });

// Save to file
fs.writeFileSync("qr-code.jpg", jpgBuffer);

// Without caching
const jpgNoCache = await qr.toJpg({ cache: false, quality: 85 });
```

### .toJpgFile(filePath: string, options?: toOptions)

Generate JPEG QR code and save it to a file. Creates directories if they don't exist.

**Parameters:**
- `filePath: string` - The file path where to save the JPEG
- `options.cache?: boolean` - Whether to use caching (default: true)
- `options.quality?: number` - JPEG quality from 1-100 (default: 90)

**Returns:** Promise<void>

```javascript
const qr = new QrBit({ text: "Hello World" });
await qr.toJpgFile("./output/qr-code.jpg");

// With high quality
await qr.toJpgFile("./output/qr-code.jpg", { quality: 95 });

// With compression
await qr.toJpgFile("./output/qr-code.jpg", { quality: 70, cache: false });
```

### .toWebp(options?: toOptions)

Generate WebP QR code with optional caching. Uses high-performance SVG to WebP conversion with lossless encoding.

**Parameters:**
- `options.cache?: boolean` - Whether to use caching (default: true)
- `options.quality?: number` - Reserved for future lossy WebP support

**Returns:** Promise<Buffer> - The WebP buffer

```javascript
const qr = new QrBit({ text: "Hello World" });
const webpBuffer = await qr.toWebp();

// Save to file
fs.writeFileSync("qr-code.webp", webpBuffer);

// Without caching
const webpNoCache = await qr.toWebp({ cache: false });
```

### .toWebpFile(filePath: string, options?: toOptions)

Generate WebP QR code and save it to a file. Creates directories if they don't exist.

**Parameters:**
- `filePath: string` - The file path where to save the WebP
- `options.cache?: boolean` - Whether to use caching (default: true)
- `options.quality?: number` - Reserved for future lossy WebP support

**Returns:** Promise<void>

```javascript
const qr = new QrBit({ text: "Hello World" });
await qr.toWebpFile("./output/qr-code.webp");

// With options
await qr.toWebpFile("./output/qr-code.webp", { cache: false });
```

### Utility Methods

#### .generateCacheKey(renderKey: string)

Generate a hash-based cache key from the current QR code options. Useful for custom caching strategies.

**Parameters:**
- `renderKey: string` - Format identifier (e.g., `napi-png`, `native-svg`, `napi-svg`)

**Returns:** Promise\<string\> - The hash string

```javascript
const qr = new QrBit({ text: "Hello World" });
const key = await qr.generateCacheKey("napi-png");
console.log(key); // hash string based on current options
```

#### .isLogoString()

Check if the logo property is a string (file path) rather than a Buffer.

**Returns:** boolean - `true` if logo is a string, `false` otherwise

```javascript
const qr = new QrBit({ text: "Hello World", logo: "./logo.png" });
console.log(qr.isLogoString()); // true

qr.logo = fs.readFileSync("./logo.png");
console.log(qr.isLogoString()); // false
```

#### .logoFileExists(filePath: string)

Check if a file exists at the specified path.

**Parameters:**
- `filePath: string` - The file path to check

**Returns:** Promise\<boolean\> - `true` if file exists and is accessible, `false` otherwise

```javascript
const qr = new QrBit({ text: "Hello World" });
const exists = await qr.logoFileExists("./logo.png");
console.log(exists); // true or false
```

### Static Methods

#### QrBit.convertSvgToPng(svgContent: string, width?: number, height?: number)

Convert SVG content to PNG buffer using the native Rust implementation.

**Parameters:**
- `svgContent: string` - The SVG content as a string
- `width?: number` - Optional width for the PNG output
- `height?: number` - Optional height for the PNG output

**Returns:** Buffer - The PNG buffer

```javascript
const svg = '<svg>...</svg>';
const pngBuffer = QrBit.convertSvgToPng(svg, 400, 400);
```

#### QrBit.convertSvgToJpeg(svgContent: string, width?: number, height?: number, quality?: number)

Convert SVG content to JPEG buffer using the native Rust implementation.

**Parameters:**
- `svgContent: string` - The SVG content as a string
- `width?: number` - Optional width for the JPEG output
- `height?: number` - Optional height for the JPEG output
- `quality?: number` - JPEG quality from 1-100 (default: 90)

**Returns:** Buffer - The JPEG buffer

```javascript
const svg = '<svg>...</svg>';
const jpegBuffer = QrBit.convertSvgToJpeg(svg, 400, 400, 85);
```

#### QrBit.convertSvgToWebp(svgContent: string, width?: number, height?: number, quality?: number)

Convert SVG content to WebP buffer using the native Rust implementation with lossless encoding.

**Parameters:**
- `svgContent: string` - The SVG content as a string
- `width?: number` - Optional width for the WebP output
- `height?: number` - Optional height for the WebP output
- `quality?: number` - Reserved for future lossy WebP support

**Returns:** Buffer - The WebP buffer

```javascript
const svg = '<svg>...</svg>';
const webpBuffer = QrBit.convertSvgToWebp(svg, 400, 400);
```

# Benchmarks

> Tables below are auto-generated by `pnpm benchmark`. Do not edit between the `<!-- BENCHMARK:* -->` markers.

<!-- BENCHMARK:svg:START -->
## QR Codes SVG (No Logo)
|                  name                   |  summary  |  ops/sec  |  time/op  |  margin  |  samples  |
|-----------------------------------------|:---------:|----------:|----------:|:--------:|----------:|
|  QRCode toString (v1.5.4)               |    🥇     |       5K  |    191µs  |  ±0.43%  |       5K  |
|  QrBit toSvg (Native) (v2.1.0)          |   -34%    |       4K  |    297µs  |  ±0.43%  |       3K  |
|  QrBit toSvg (Rust) (v2.1.0)            |   -89%    |     600   |      2ms  |  ±0.99%  |     592   |
|  styled-qr-code-node toBuffer (v2.0.0)  |   -90%    |     552   |      2ms  |  ±0.92%  |     544   |
<!-- BENCHMARK:svg:END -->

`Rust` is there for performance and when doing heavy image processing without needing node `canvas` installed. If you do not add a logo then the `Native` version is what you will get for SVG.

<!-- BENCHMARK:png:START -->
## QR Codes PNG (No Logo)
|                  name                   |  summary  |  ops/sec  |  time/op  |  margin   |  samples  |
|-----------------------------------------|:---------:|----------:|----------:|:---------:|----------:|
|  QrBit toPng (v2.1.0) Cached            |    🥇     |       3K  |      2ms  |  ±21.51%  |     554   |
|  QrBit toPng (v2.1.0)                   |   -53%    |       1K  |      2ms  |  ±25.73%  |     524   |
|  QRCode toBuffer (v1.5.4)               |   -74%    |     712   |      1ms  |  ±1.12%   |     690   |
|  styled-qr-code-node toBuffer (v2.0.0)  |   -93%    |     198   |      5ms  |  ±0.74%   |     198   |
<!-- BENCHMARK:png:END -->

<!-- BENCHMARK:jpg:START -->
## QR Codes JPG (No Logo)
|                  name                   |  summary  |  ops/sec  |  time/op  |  margin   |  samples  |
|-----------------------------------------|:---------:|----------:|----------:|:---------:|----------:|
|  QrBit toJpg (v2.1.0) Cached            |    🥇     |       2K  |      2ms  |  ±24.98%  |     461   |
|  QrBit toJpg (v2.1.0)                   |   -54%    |     898   |      2ms  |  ±26.96%  |     438   |
|  styled-qr-code-node toBuffer (v2.0.0)  |   -86%    |     279   |      4ms  |  ±0.89%   |     278   |
<!-- BENCHMARK:jpg:END -->

<!-- BENCHMARK:webp:START -->
## QR Codes WebP (No Logo)
|              name              |  summary  |  ops/sec  |  time/op  |  margin   |  samples  |
|--------------------------------|:---------:|----------:|----------:|:---------:|----------:|
|  QrBit toWebp Cached (v2.1.0)  |    🥇     |       7K  |    720µs  |  ±9.04%   |       1K  |
|  QrBit toWebp (v2.1.0)         |   -47%    |       4K  |    846µs  |  ±12.71%  |       1K  |
<!-- BENCHMARK:webp:END -->

`Rust` is used for `toPng()`, `toJpg()`, and `toWebp()` to optimize performance for image generation and heavy image processing without needing node `canvas` installed.

<!-- BENCHMARK:logo:START -->
## QR Codes with Embedded Logos
|                name                |  summary  |  ops/sec  |  time/op  |  margin  |  samples  |
|------------------------------------|:---------:|----------:|----------:|:--------:|----------:|
|  QrBit SVG (Path) (v2.1.0)         |    🥇     |     579   |      2ms  |  ±0.96%  |     571   |
|  QrBit SVG (Buffer) (v2.1.0)       |   -5.7%   |     546   |      2ms  |  ±0.97%  |     539   |
|  QrBit WebP (Path) (v2.1.0)        |   -53%    |     274   |      4ms  |  ±1.08%  |     272   |
|  QrBit WebP (Buffer) (v2.1.0)      |   -56%    |     256   |      4ms  |  ±1.01%  |     255   |
|  styled-qr-code-node SVG (v2.0.0)  |   -61%    |     227   |      4ms  |  ±0.71%  |     227   |
|  QrBit PNG (Path) (v2.1.0)         |   -67%    |     194   |      5ms  |  ±0.89%  |     193   |
|  QrBit PNG (Buffer) (v2.1.0)       |   -69%    |     181   |      6ms  |  ±1.08%  |     180   |
|  styled-qr-code-node PNG (v2.0.0)  |   -70%    |     172   |      6ms  |  ±1.02%  |     171   |
<!-- BENCHMARK:logo:END -->

`Buffer` is much slower as we have to push the stream across to the rust module. For fastest performance provide the path of the image.

# Examples

The `examples/` directory contains various QR code examples showcasing different features and use cases. You can generate these examples by running:

```bash
pnpm generate-examples
```

## 1. Basic QR Code
Simple QR code with default settings.
```javascript
const qr = new QrBit({ text: "Hello World!" });
await qr.toPngFile("01_basic.png");
```
![Basic QR Code](examples/01_basic.png)

## 2. URL QR Code  
QR code encoding a GitHub URL.
```javascript
const qr = new QrBit({ text: "https://github.com/jaredwray/qrbit", size: 200 });
await qr.toSvgFile("02_url.svg");
```
![URL QR Code](examples/02_url.svg)

## 3. Large Size QR Code
QR code with increased size for better scanning.
```javascript
const qr = new QrBit({ text: "Large QR", size: 400 });
await qr.toPngFile("03_large_size.png");
```
![Large QR Code](examples/03_large_size.png)

## 4. Inverted Colors
Black background with white foreground.
```javascript
const qr = new QrBit({
  text: "Inverted Colors",
  backgroundColor: "#000000",
  foregroundColor: "#FFFFFF"
});
await qr.toSvgFile("04_inverted.svg");
```
![Inverted QR Code](examples/04_inverted.svg)

## 5. Red Theme
Custom red background theme.
```javascript
const qr = new QrBit({
  text: "Red Theme",
  backgroundColor: "#FF0000",
  foregroundColor: "#FFFFFF"
});
await qr.toPngFile("05_red_theme.png");
```
![Red Theme QR Code](examples/05_red_theme.png)

## 6. Small Logo
QR code with a small embedded logo.
```javascript
const qr = new QrBit({
  text: "logo small",
  logo: "./logo.png",
  logoSizeRatio: 0.2
});
await qr.toPngFile("06_logo_small.png");
```
![Small Logo QR Code](examples/06_logo_small.png)

## 7. Large Logo with Custom Colors
Large logo with red background theme.
```javascript
const qr = new QrBit({
  text: "logo large red",
  logo: "./logo.png",
  size: 400,
  logoSizeRatio: 0.3,
  backgroundColor: "#FF0000",
  foregroundColor: "#FFFFFF"
});
await qr.toSvgFile("07_logo_large_red.svg");
```
![Large Logo QR Code](examples/07_logo_large_red.svg)

## 8. WiFi QR Code
QR code for WiFi network connection.
```javascript
const qr = new QrBit({ 
  text: "WIFI:T:WPA;S:MyNetwork;P:MyPassword;;" 
});
await qr.toPngFile("08_wifi.png");
```
![WiFi QR Code](examples/08_wifi.png)

## 9. Large Margin with Blue Theme
Custom margin and blue color scheme.
```javascript
const qr = new QrBit({
  text: "https://github.com/jaredwray/qrbit",
  size: 300,
  margin: 40,
  backgroundColor: "#0000FF",
  foregroundColor: "#FFFFFF"
});
await qr.toSvgFile("09_large_margin_blue.svg");
```
![Large Margin Blue QR Code](examples/09_large_margin_blue.svg)

## 10. Buffer Logo
Using a logo loaded from a Buffer instead of file path.
```javascript
const logoBuffer = fs.readFileSync("./logo.png");
const qr = new QrBit({
  text: "Buffer Logo",
  logo: logoBuffer,
  logoSizeRatio: 0.2,
  backgroundColor: "#F0F0F0",
  foregroundColor: "#333333"
});
await qr.toPngFile("10_buffer_logo.png");
```
![Buffer Logo QR Code](examples/10_buffer_logo.png)

## 11. High Quality JPEG
JPEG format with high quality setting.
```javascript
const qr = new QrBit({
  text: "High Quality JPEG",
  size: 300
});
await qr.toJpgFile("11_jpg_high_quality.jpg", { quality: 95 });
```
![High Quality JPEG QR Code](examples/11_jpg_high_quality.jpg)

## 12. JPEG with Logo and Blue Theme
JPEG with embedded logo and custom blue background.
```javascript
const qr = new QrBit({
  text: "JPEG with Logo",
  logo: "./logo.png",
  size: 400,
  logoSizeRatio: 0.25,
  backgroundColor: "#2196F3",
  foregroundColor: "#FFFFFF"
});
await qr.toJpgFile("12_jpg_logo_blue.jpg", { quality: 90 });
```
![JPEG with Logo Blue QR Code](examples/12_jpg_logo_blue.jpg)

## 13. Compressed JPEG with Green Theme
JPEG with lower quality for smaller file size.
```javascript
const qr = new QrBit({
  text: "https://github.com/jaredwray/qrbit",
  size: 300,
  backgroundColor: "#4CAF50",
  foregroundColor: "#FFFFFF"
});
await qr.toJpgFile("13_jpg_compressed_green.jpg", { quality: 70 });
```
![Compressed JPEG Green QR Code](examples/13_jpg_compressed_green.jpg)

## 14. JPEG with Buffer Logo and Orange Theme
JPEG using buffer-based logo with orange background.
```javascript
const logoBuffer = fs.readFileSync("./logo.png");
const qr = new QrBit({
  text: "JPEG Buffer Logo",
  logo: logoBuffer,
  size: 350,
  logoSizeRatio: 0.2,
  backgroundColor: "#FF9800",
  foregroundColor: "#FFFFFF"
});
await qr.toJpgFile("14_jpg_buffer_logo_orange.jpg", { quality: 85 });
```
![JPEG Buffer Logo Orange QR Code](examples/14_jpg_buffer_logo_orange.jpg)

## 15. Basic WebP
WebP format with lossless encoding.
```javascript
const qr = new QrBit({
  text: "Basic WebP QR Code",
  size: 300
});
await qr.toWebpFile("15_webp_basic.webp");
```
![Basic WebP QR Code](examples/15_webp_basic.webp)

## 16. WebP with Logo and Blue Theme
WebP with embedded logo and custom blue background.
```javascript
const qr = new QrBit({
  text: "WebP with Logo",
  logo: "./logo.png",
  size: 400,
  logoSizeRatio: 0.25,
  backgroundColor: "#1e3a5f",
  foregroundColor: "#FFFFFF"
});
await qr.toWebpFile("16_webp_logo_blue.webp");
```
![WebP with Logo Blue QR Code](examples/16_webp_logo_blue.webp)

## 17. Large WebP with Green Theme
Large WebP QR code with green color scheme.
```javascript
const qr = new QrBit({
  text: "https://github.com/jaredwray/qrbit",
  size: 500,
  backgroundColor: "#4CAF50",
  foregroundColor: "#FFFFFF"
});
await qr.toWebpFile("17_webp_large_green.webp");
```
![Large WebP Green QR Code](examples/17_webp_large_green.webp)

## 18. WebP with Buffer Logo and Purple Theme
WebP using buffer-based logo with purple background.
```javascript
const logoBuffer = fs.readFileSync("./logo.png");
const qr = new QrBit({
  text: "WebP Buffer Logo",
  logo: logoBuffer,
  size: 350,
  logoSizeRatio: 0.2,
  backgroundColor: "#9C27B0",
  foregroundColor: "#FFFFFF"
});
await qr.toWebpFile("18_webp_buffer_logo_purple.webp");
```
![WebP Buffer Logo Purple QR Code](examples/18_webp_buffer_logo_purple.webp)

## 19. Low Error Correction
QR code with low (L) error correction level, suitable for clean environments with minimal risk of damage.
```javascript
const qr = new QrBit({
  text: "https://github.com/jaredwray/qrbit?test=this+is+an+error+correction+test",
  size: 400,
  errorCorrection: "L",
  backgroundColor: "#1e3a5f",
  foregroundColor: "#FFFFFF"
});
await qr.toPngFile("19_ec_low.png");
```
![Low Error Correction QR Code](examples/19_ec_low.png)

## 20. High Error Correction
QR code with high (H) error correction level, recovers up to 30% damage — ideal for logos or printed codes.
```javascript
const qr = new QrBit({
  text: "https://github.com/jaredwray/qrbit?test=this+is+an+error+correction+test",
  size: 400,
  errorCorrection: "H",
  backgroundColor: "#1e3a5f",
  foregroundColor: "#FFFFFF"
});
await qr.toPngFile("20_ec_high.png");
```
![High Error Correction QR Code](examples/20_ec_high.png)

These examples demonstrate the versatility and capabilities of QrBit for generating QR codes with various customizations, from simple text encoding to complex styled codes with embedded logos, supporting SVG, PNG, JPEG, and WebP formats.

## Contributing

Please read our [Contributing Guidelines](./CONTRIBUTING.md) and also our [Code of Conduct](./CODE_OF_CONDUCT.md). 

## License and Copyright

[MIT & Copyright (c) Jared Wray](https://github.com/jaredwray/qrbit/blob/main/LICENSE)

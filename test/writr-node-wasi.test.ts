import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WASI } from "node:wasi";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const nodeDir = path.join(here, "../writr-rs/crates/writr-node");
const loaderPath = path.join(nodeDir, "writr-node.wasi.cjs");
const wasmPath = path.join(nodeDir, "writr-node.wasm32-wasi.wasm");

/** WASI preview1 errno for a fd that is not a preopened directory. */
const WASI_EBADF = 8;

function stripComments(source: string): string {
	return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function wasiConstructor(source: string): string {
	const match = stripComments(source).match(
		/new __nodeWASI\(\s*\{[\s\S]*?\}\s*\)/,
	);
	expect(match, "expected a __nodeWASI constructor call").toBeTruthy();
	return match?.[0] ?? "";
}

function u32(value: number): number[] {
	const bytes: number[] = [];
	let remaining = value;
	do {
		let byte = remaining & 0x7f;
		remaining >>>= 7;
		if (remaining !== 0) {
			byte |= 0x80;
		}
		bytes.push(byte);
	} while (remaining !== 0);
	return bytes;
}

function name(value: string): number[] {
	const encoded = [...Buffer.from(value, "utf8")];
	return [...u32(encoded.length), ...encoded];
}

function section(id: number, body: number[]): number[] {
	return [id, ...u32(body.length), ...body];
}

function functionBody(opcodes: number[]): number[] {
	return [...u32(opcodes.length), ...opcodes];
}

/**
 * Tiny WASI reactor that reports environ count and the errno from
 * `fd_prestat_get(3)` (fd 3 is the first preopen when any exist).
 */
function wasiProbeModule(): Uint8Array {
	const typeEnviron = [0x60, 2, 0x7f, 0x7f, 1, 0x7f];
	const typeVoid = [0x60, 0, 0];
	const typeI32 = [0x60, 0, 1, 0x7f];
	const typeSection = section(1, [3, ...typeEnviron, ...typeVoid, ...typeI32]);
	const importSection = section(2, [
		2,
		...name("wasi_snapshot_preview1"),
		...name("environ_sizes_get"),
		0x00,
		0,
		...name("wasi_snapshot_preview1"),
		...name("fd_prestat_get"),
		0x00,
		0,
	]);
	const funcSection = section(3, [3, 1, 2, 2]);
	const memorySection = section(5, [1, 0, 1]);
	const exportSection = section(7, [
		4,
		...name("memory"),
		0x02,
		0,
		...name("_initialize"),
		0x00,
		2,
		...name("envCount"),
		0x00,
		3,
		...name("preopenErrno"),
		0x00,
		4,
	]);
	const initialize = functionBody([0, 0x0b]);
	const envCount = functionBody([
		0, 0x41, 0, 0x41, 4, 0x10, 0, 0x1a, 0x41, 0, 0x28, 0x02, 0, 0x0b,
	]);
	const preopenErrno = functionBody([0, 0x41, 3, 0x41, 8, 0x10, 1, 0x0b]);
	const codeSection = section(10, [
		3,
		...initialize,
		...envCount,
		...preopenErrno,
	]);
	return Uint8Array.from([
		0x00,
		0x61,
		0x73,
		0x6d,
		0x01,
		0x00,
		0x00,
		0x00,
		...typeSection,
		...importSection,
		...funcSection,
		...memorySection,
		...exportSection,
		...codeSection,
	]);
}

function probeWasi(options: ConstructorParameters<typeof WASI>[0]): {
	envCount: number;
	preopenErrno: number;
} {
	const wasi = new WASI(options);
	const instance = new WebAssembly.Instance(
		new WebAssembly.Module(wasiProbeModule()),
		{ wasi_snapshot_preview1: wasi.wasiImport },
	);
	wasi.initialize(instance);
	const exports = instance.exports as {
		envCount: () => number;
		preopenErrno: () => number;
	};
	return {
		envCount: exports.envCount(),
		preopenErrno: exports.preopenErrno(),
	};
}

describe("Node WASI loader", () => {
	it("does not pass process.env or filesystem preopens into WASI", () => {
		const source = fs.readFileSync(loaderPath, "utf8");
		const ctor = wasiConstructor(source);
		expect(ctor).toContain('version: "preview1"');
		expect(ctor).not.toMatch(/process\.env/);
		expect(ctor).not.toMatch(/preopens/);
		expect(stripComments(source)).not.toMatch(/__rootDir/);
	});

	it("the loader's WASI options expose an empty environment and no preopens", () => {
		process.env.WRITR_WASI_CANARY = "writr-wasi-should-not-see-this";
		try {
			const granted = probeWasi({
				version: "preview1",
				env: process.env,
				preopens: { "/": "/" },
			});
			expect(granted.envCount).toBeGreaterThan(0);
			expect(granted.preopenErrno).toBe(0);

			const lockedDown = probeWasi({ version: "preview1" });
			expect(lockedDown.envCount).toBe(0);
			expect(lockedDown.preopenErrno).toBe(WASI_EBADF);
		} finally {
			delete process.env.WRITR_WASI_CANARY;
		}
	});

	it.skipIf(!fs.existsSync(wasmPath))(
		"renders markdown through the locked-down Node WASI loader",
		() => {
			const require = createRequire(import.meta.url);
			const { render } = require(loaderPath) as {
				render: (input: string, options?: Record<string, boolean>) => string;
			};
			expect(render("# Hello WASI")).toBe(
				'<h1 id="hello-wasi">Hello WASI</h1>',
			);
			const html = render("$a^2$\n\n```js\nconst x = 1;\n```", {
				math: true,
				highlight: true,
			});
			expect(html).toContain("katex");
			expect(html).toMatch(/hljs|language-js/);
		},
	);
});

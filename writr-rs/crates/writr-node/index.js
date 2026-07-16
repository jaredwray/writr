// Loader for the writr-rs native addon.
//
// Resolution order:
// 1. napi-rs–style platform artifacts next to this file
//    (`writr-node.<platform>-<arch>[-<abi>].node`), as produced by
//    `napi build` in CI;
// 2. the plain cargo artifact copied by `pnpm build:rs`
//    (`writr-node.node`);
// 3. the raw cargo output in `target/release`.
//
// Environment: set `WRITR_RS_FORCE_WASM=1` to load the WebAssembly build
// (`writr-node.wasm32-wasi.wasm` via `writr-node.wasi.cjs`) instead of any
// native artifact. Browsers use `browser.mjs`, which loads the same wasm.
"use strict";

const { existsSync } = require("node:fs");
const { join } = require("node:path");

function candidates() {
	const { platform, arch } = process;
	const names = [];
	const abi =
		platform === "linux"
			? process.report?.getReport?.()?.header?.glibcVersionRuntime
				? "gnu"
				: "musl"
			: null;
	if (platform === "linux") {
		names.push(`writr-node.linux-${arch}-${abi}.node`);
	} else if (platform === "darwin") {
		names.push(`writr-node.darwin-${arch}.node`);
	} else if (platform === "win32") {
		names.push(`writr-node.win32-${arch}-msvc.node`);
	}
	names.push("writr-node.node");
	return names;
}

function load() {
	if (process.env.WRITR_RS_FORCE_WASM === "1") {
		return require("./writr-node.wasi.cjs");
	}
	const errors = [];
	for (const name of candidates()) {
		const file = join(__dirname, name);
		if (existsSync(file)) {
			try {
				return require(file);
			} catch (error) {
				errors.push(error);
			}
		}
	}
	// Fall back to the raw cargo artifact.
	const cargoArtifacts = [
		join(__dirname, "..", "..", "target", "release", "libwritr_node.so"),
		join(__dirname, "..", "..", "target", "release", "libwritr_node.dylib"),
		join(__dirname, "..", "..", "target", "release", "writr_node.dll"),
	];
	for (const file of cargoArtifacts) {
		if (existsSync(file)) {
			try {
				return require(file);
			} catch (error) {
				errors.push(error);
			}
		}
	}
	throw new Error(
		`writr-rs native addon not found — run \`pnpm build:rs\` first.${
			errors.length ? `\nLoad errors:\n${errors.map(String).join("\n")}` : ""
		}`,
	);
}

module.exports = load();

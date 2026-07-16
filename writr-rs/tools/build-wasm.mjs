// Build the single-threaded wasm32-wasip1 module and install it next to the
// loaders in crates/writr-node.
//
// Requirements (Linux):
//   - `rustup target add wasm32-wasip1`
//   - clang with wasm32 support plus a wasi sysroot for QuickJS's C sources
//     (Ubuntu: `apt-get install wasi-libc libclang-rt-<N>-dev-wasm32`), OR a
//     wasi-sdk pointed to by `WASI_SDK_PATH`.
//   - `pnpm install` in crates/writr-node (provides the emnapi link archive).
import { execSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const env = { ...process.env, RQUICKJS_SYS_NO_WASI_SDK: "1" };

// SIMD128 is baseline wasm in every current engine (Node >= 16.4, Chrome 91,
// Firefox 89, Safari 16.4) and worth a few percent here. Set
// WRITR_WASM_NO_SIMD=1 to build for engines without it.
if (
	process.env.WRITR_WASM_NO_SIMD !== "1" &&
	!("CARGO_TARGET_WASM32_WASIP1_RUSTFLAGS" in process.env)
) {
	env.CARGO_TARGET_WASM32_WASIP1_RUSTFLAGS = "-C target-feature=+simd128";
}

const sdk = process.env.WASI_SDK_PATH;
if (sdk && existsSync(sdk)) {
	env.CC_wasm32_wasip1 = join(sdk, "bin", "clang");
	env.CFLAGS_wasm32_wasip1 = `--sysroot=${join(sdk, "share", "wasi-sysroot")}`;
	env.AR_wasm32_wasip1 = join(sdk, "bin", "ar");
} else {
	env.CC_wasm32_wasip1 ??= "clang";
	env.CFLAGS_wasm32_wasip1 ??=
		"--target=wasm32-wasip1 --sysroot=/usr/lib/wasm32-wasi " +
		"-isystem /usr/include/wasm32-wasi -D_WASI_EMULATED_SIGNAL " +
		"-D_WASI_EMULATED_PROCESS_CLOCKS -D_WASI_EMULATED_GETPID";
	env.AR_wasm32_wasip1 ??= "llvm-ar";
}

execSync("cargo build --release --target wasm32-wasip1 -p writr-node", {
	cwd: root,
	env,
	stdio: "inherit",
});

const source = join(root, "target", "wasm32-wasip1", "release", "writr_node.wasm");
const target = join(root, "crates", "writr-node", "writr-node.wasm32-wasi.wasm");

// Post-optimize with binaryen when available (apt/brew: `binaryen`). The
// feature flags mirror what rustc emits for wasm32-wasip1 on stable; -O3
// typically shaves 5-15% off runtime on top of LLVM's output.
let optimized = false;
try {
	execSync(
		`wasm-opt -O3 --enable-bulk-memory --enable-sign-ext ` +
			`--enable-mutable-globals --enable-nontrapping-float-to-int ` +
			`--enable-reference-types --enable-multivalue --enable-simd ` +
			`${source} -o ${target}`,
		{ stdio: "inherit" },
	);
	optimized = true;
	console.log(`wasm-opt -O3: ${source} -> ${target}`);
} catch {
	console.warn("wasm-opt not available — shipping the unoptimized module");
}
if (!optimized) {
	copyFileSync(source, target);
	console.log(`Copied ${source} -> ${target}`);
}

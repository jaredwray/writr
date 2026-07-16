// Profile-guided-optimization build of the native addon (opt-in).
//
// Instruments writr-core's `profile` example, trains it on the benchmark
// corpus across every feature profile, merges the profile data, and
// rebuilds writr-node with `-Cprofile-use`. Worth a few percent on the
// feature-heavy profiles (~2-5% measured on the default pipeline); costs
// two release builds, so it is not the default `build:rs` path.
//
// Requirements: the `llvm-tools-preview` rustup component (for
// llvm-profdata) and `npx tsx` (to dump the training corpus).
import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const targetDir = join(root, "target-pgo");
const pgoDir = join(tmpdir(), "writr-rs-pgo");
const rawDir = join(pgoDir, "raw");
rmSync(pgoDir, { recursive: true, force: true });
mkdirSync(rawDir, { recursive: true });

const run = (command, env = {}) =>
	execSync(command, {
		cwd: root,
		stdio: "inherit",
		env: { ...process.env, ...env },
	});

// 1. Training corpus: the same documents the benchmarks measure.
const corpusFile = join(pgoDir, "train.json");
const corpus = execSync(
	'npx tsx -e "import { benchmarkContents } from \'./benchmark/benchmark-contents.ts\'; ' +
		'console.log(JSON.stringify(benchmarkContents));"',
	{ cwd: join(root, ".."), maxBuffer: 64 * 1024 * 1024 },
);
writeFileSync(corpusFile, corpus);

// 2. Instrumented build + training run (the example sweeps every profile).
run(
	`cargo build --release -p writr-core --example profile --target-dir ${targetDir}`,
	{ RUSTFLAGS: `-Cprofile-generate=${rawDir}` },
);
run(`${join(targetDir, "release", "examples", "profile")} ${corpusFile} 20`);

// 3. Merge with the llvm-profdata that matches rustc's LLVM.
const sysroot = execSync("rustc --print sysroot").toString().trim();
const host = execSync("rustc -vV")
	.toString()
	.match(/host: (\S+)/)[1];
const profdata = join(sysroot, "lib", "rustlib", host, "bin", "llvm-profdata");
const merged = join(pgoDir, "merged.profdata");
run(`${profdata} merge -o ${merged} ${rawDir}`);

// 4. Optimized addon build + install next to the loader.
run(`cargo build --release -p writr-node --target-dir ${targetDir}`, {
	RUSTFLAGS: `-Cprofile-use=${merged}`,
});
run(`node ${join(root, "tools", "copy-node-artifact.mjs")}`, {
	WRITR_RS_TARGET_DIR: targetDir,
});

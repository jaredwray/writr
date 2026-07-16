// Copy the cargo cdylib produced by `cargo build --release -p writr-node`
// to `crates/writr-node/writr-node.node`, where the loader (`index.js`)
// picks it up. Cross-platform: resolves the artifact name per OS.
// WRITR_RS_TARGET_DIR overrides the cargo target directory (PGO builds).
import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const artifacts = {
	linux: "libwritr_node.so",
	darwin: "libwritr_node.dylib",
	win32: "writr_node.dll",
};
const artifact = artifacts[process.platform];
if (!artifact) {
	throw new Error(`Unsupported platform: ${process.platform}`);
}
const targetDir = process.env.WRITR_RS_TARGET_DIR ?? join(root, "target");
const source = join(targetDir, "release", artifact);
if (!existsSync(source)) {
	throw new Error(`Missing cargo artifact ${source} — did the build fail?`);
}
const target = join(root, "crates", "writr-node", "writr-node.node");
copyFileSync(source, target);
console.log(`Copied ${source} -> ${target}`);

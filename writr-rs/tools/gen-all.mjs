// Run every codegen script in order. Committed outputs under crates/ must
// not change when this is re-run against the pinned package versions — CI
// verifies that with `git diff --exit-code`.
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const tools = dirname(fileURLToPath(import.meta.url));
const scripts = [
	"gen-property-info.mjs",
	"gen-emoji-table.mjs",
	"gen-slugger-data.mjs",
	"gen-unicode-data.mjs",
	"gen-hljs-grammars.mjs",
	"gen-hljs-fixtures.mjs",
];

for (const script of scripts) {
	console.log(`== ${script}`);
	execSync(`node ${join(tools, script)}`, { stdio: "inherit" });
}

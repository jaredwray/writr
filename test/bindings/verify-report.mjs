import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { EXPORTS } from "./contract.mjs";

// A successful package-manager exit is not proof that it ran the test command.
const mode = process.env.WRITR_RS_FORCE_WASM === "1" ? "wasm" : "native";
const dir = process.env.WRITR_REPORT_DIR ?? "test-output/parity";
const file = path.join(
	dir,
	`bindings-${mode}-${process.platform}-${process.arch}-${process.version}.json`,
);
const report = JSON.parse(fs.readFileSync(file, "utf8"));
const commit = execFileSync("git", ["rev-parse", "HEAD"], {
	encoding: "utf8",
}).trim();
if (
	report.commit !== commit ||
	report.mode !== mode ||
	report.artifact !== mode ||
	report.host !== `${process.platform}-${process.arch}` ||
	report.node !== process.version ||
	report.suite !== "bindings"
) {
	throw new Error(`Incorrect or stale host binding report: ${file}`);
}
for (const api of EXPORTS) {
	if (!report.results?.some((r) => r.api === api))
		throw new Error(`${file}: no execution evidence for ${api}`);
}
const failed = report.results.filter((r) => r.passed !== true);
console.log(
	`${file}: ${report.results.length} API checks executed, ${failed.length} failed`,
);
if (failed.length) process.exitCode = 1;

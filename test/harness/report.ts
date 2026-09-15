import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
export function writeReport(suite: string, data: Record<string, unknown>) {
	const mode =
		process.env.WRITR_RS_FORCE_WASM === "1"
			? "wasm"
			: process.env.HARNESS_ENGINE === "writr-rust" ||
					suite.startsWith("bindings")
				? "native"
				: "js";
	const report = {
		suite,
		mode,
		commit: execFileSync("git", ["rev-parse", "HEAD"], {
			encoding: "utf8",
		}).trim(),
		node: process.version,
		host: `${process.platform}-${process.arch}`,
		...data,
	};
	const dir = process.env.WRITR_REPORT_DIR ?? "test-output/parity";
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(
		path.join(
			dir,
			`${suite}-${mode}-${process.platform}-${process.arch}-${process.version}.json`,
		),
		JSON.stringify(report, null, 2) + "\n",
	);
	const results = (data.results ?? []) as { passed: boolean }[];
	const summary = `${suite} / ${mode} / ${process.version}: ${results.filter((r) => r.passed).length}/${results.length} ${data.resultUnit ?? "API checks"} passed`;
	console.log(summary);
	if (process.env.GITHUB_STEP_SUMMARY)
		fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + "\n\n");
}

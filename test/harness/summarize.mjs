import fs from "node:fs";
import path from "node:path";
const root = process.env.WRITR_REPORT_DIR ?? "test-output/parity";
const registry = JSON.parse(
	fs.readFileSync(new URL("./divergences.json", import.meta.url), "utf8"),
);
const fixture = JSON.parse(
	fs.readFileSync(new URL("./exact/outcomes.json", import.meta.url), "utf8"),
);
const reports = fs
	.readdirSync(root)
	.filter((n) => n.endsWith(".json") && n !== "summary.json")
	.map((n) => JSON.parse(fs.readFileSync(path.join(root, n), "utf8")))
	.filter((r) => Array.isArray(r.results));
if (!reports.length)
	throw new Error("No execution reports: parity evidence missing");
const outcomes = [...fixture.cases, ...fixture.stages];
for (const d of registry) {
	if (
		!d.caseIds.length ||
		d.caseIds.some((id) => !outcomes.some((c) => c.id === id))
	)
		throw new Error(`${d.id}: missing evidence fixture`);
}
const summary = {
	commits: [...new Set(reports.map((r) => r.commit))],
	oracleVersions: fixture.versions,
	uniqueCorpusDocuments:
		reports.find((r) => r.uniqueCorpusDocuments)?.uniqueCorpusDocuments ?? null,
	profiles: reports.find((r) => r.profiles)?.profiles ?? null,
	exactFixtureCases: fixture.cases.length,
	stageFixtureCases: fixture.stages.length,
	engines: reports.map((r) => ({
		suite: r.suite,
		mode: r.mode,
		node: r.node,
		host: r.host,
		browser: r.browser,
		checks: r.results.length,
		resultUnit:
			r.resultUnit ??
			(r.suite === "harness" ? "input/profile case comparisons" : "API checks"),
		apiPaths: r.apiPaths ?? [
			...new Set(r.results.map((x) => x.api).filter(Boolean)),
		],
		passed: r.results.filter((x) => x.passed).length,
		failures: r.results.filter((x) => !x.passed),
	})),
	divergences: registry.map((d) => ({
		...d,
		observations: reports.flatMap((r) =>
			r.results
				.filter((x) => d.caseIds.includes(x.id))
				.map((x) => ({ mode: r.mode, api: x.api, id: x.id, passed: x.passed })),
		),
	})),
};
const native = reports.find((r) => r.mode === "native" && r.trees);
const wasm = reports.find((r) => r.mode === "wasm" && r.trees);
summary.nativeWasmStructuralMatch =
	native && wasm
		? JSON.stringify(native.trees) === JSON.stringify(wasm.trees) &&
			native.engineVersion === wasm.engineVersion
		: null;
summary.exactProfiles = Object.fromEntries(
	[...new Set(fixture.cases.map((c) => c.profile ?? "option-matrix"))].map(
		(p) => [
			p,
			fixture.cases.filter((c) => (c.profile ?? "option-matrix") === p).length,
		],
	),
);
summary.missingEvidence = [];
if (summary.commits.length !== 1)
	summary.missingEvidence.push("reports from one revision");
if (
	!reports.some(
		(r) => r.mode === "js" && r.suite === "harness" && r.results.length,
	)
)
	summary.missingEvidence.push("JS harness");
if (!reports.some((r) => r.suite === "rust-public" && r.results.length))
	summary.missingEvidence.push("Rust public fixtures");
for (const mode of ["native", "wasm"])
	for (const major of [22, 24, 26])
		for (const suite of ["harness", "bindings"])
			if (
				!reports.some(
					(r) =>
						r.mode === mode &&
						r.suite === suite &&
						r.node?.startsWith(`v${major}.`),
				)
			)
				summary.missingEvidence.push(`${mode}/${suite}/Node ${major}`);
for (const host of ["linux", "darwin", "win32"])
	if (
		!reports.some(
			(r) =>
				r.mode === "native" &&
				r.suite === "bindings" &&
				r.host?.startsWith(host),
		)
	)
		summary.missingEvidence.push(`${host} native binding execution`);
if (!reports.some((r) => r.suite === "rust-mdx" && r.results.length))
	summary.missingEvidence.push("Rust MDX fixtures");
if (!reports.some((r) => r.mode === "chromium"))
	summary.missingEvidence.push("Chromium");
if (!reports.some((r) => r.suite === "rust-stages"))
	summary.missingEvidence.push("Rust stage fixtures");
summary.testingMilestoneComplete =
	summary.missingEvidence.length === 0 &&
	summary.engines.every((e) => !e.failures.length) &&
	registry.every((d) => !d.blocker);
summary.compatibilityIssuesRemain =
	summary.engines.some((e) => e.failures.length > 0) ||
	registry.some((d) => d.blocker);
fs.writeFileSync(
	path.join(root, "summary.json"),
	JSON.stringify(summary, null, 2) + "\n",
);
const text = [
	`Exact fixtures: ${fixture.cases.length} public, ${fixture.stages.length} stage.`,
	...summary.engines.map(
		(e) =>
			`${e.suite} ${e.mode} ${e.node ?? e.browser ?? e.host}: ${e.passed}/${e.checks} ${e.resultUnit} passed`,
	),
	...summary.divergences.map(
		(d) => `${d.id}: ${d.disposition}${d.blocker ? ` — ${d.blocker}` : ""}`,
	),
	`Testing milestone ${summary.testingMilestoneComplete ? "complete" : "incomplete"}; missing evidence: ${summary.missingEvidence.join(", ") || "none"}.`,
].join("\n");
console.log(text);
fs.writeFileSync(path.join(root, "summary.txt"), text + "\n");
if (process.env.GITHUB_STEP_SUMMARY)
	fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + "\n");
if (
	!summary.testingMilestoneComplete ||
	summary.compatibilityIssuesRemain ||
	summary.nativeWasmStructuralMatch === false
)
	process.exitCode = 1;

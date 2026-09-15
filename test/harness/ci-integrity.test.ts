import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { assertBatchOutput, EXPORTS } from "../bindings/contract.mjs";

test("raw downloaded CRLF bytes retain their committed Git identity", () => {
	const file =
		"test/harness/fetch/cache/jaredwray/blob-openfeature.dev-docs_tutorials_getting-started_php.mdx";
	const bytes = execFileSync("git", ["show", `HEAD:${file}`]);
	expect(bytes.includes(Buffer.from("\r\n"))).toBe(true);
	const filtered = execFileSync(
		"git",
		["hash-object", `--path=${file}`, "--stdin"],
		{ input: bytes, encoding: "utf8" },
	);
	const raw = execFileSync("git", ["hash-object", "--no-filters", "--stdin"], {
		input: bytes,
		encoding: "utf8",
	});
	expect(filtered).toBe(raw);
});

test("batch diagnostics identify each mismatching document without conflating count errors", () => {
	expect(() =>
		assertBatchOutput(
			["one", "wrong", "also wrong"],
			["one", "two", "three"],
			["first", "mdx/import", "mdx/export"],
		),
	).toThrow(/mdx\/import.*index 1[\s\S]*mdx\/export.*index 2/);
	expect(() =>
		assertBatchOutput(["one"], ["one", "two"], ["first", "second"]),
	).toThrow("batch output count: expected 2, received 1");
	expect(() =>
		assertBatchOutput(["one", "two"], ["one", "two"], ["first", "second"]),
	).not.toThrow();
});

for (const scenario of [
	"valid",
	"missing",
	"empty",
	"stale",
	"wrong artifact",
	"failed check",
]) {
	test(`host binding report guard: ${scenario}`, () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "writr-host-report-"));
		try {
			const mode = process.env.WRITR_RS_FORCE_WASM === "1" ? "wasm" : "native";
			const report = {
				suite: "bindings",
				mode,
				artifact: mode,
				commit: execFileSync("git", ["rev-parse", "HEAD"], {
					encoding: "utf8",
				}).trim(),
				host: `${process.platform}-${process.arch}`,
				node: process.version,
				results: EXPORTS.map((api: string) => ({
					api,
					id: "probe",
					passed: true,
				})),
			};
			if (scenario === "empty") report.results = [];
			if (scenario === "stale") report.commit = "old-revision";
			if (scenario === "wrong artifact")
				report.artifact = mode === "native" ? "wasm" : "native";
			if (scenario === "failed check") report.results[0].passed = false;
			if (scenario !== "missing")
				fs.writeFileSync(
					path.join(
						dir,
						`bindings-${mode}-${process.platform}-${process.arch}-${process.version}.json`,
					),
					JSON.stringify(report),
				);
			const run = () =>
				execFileSync(
					process.execPath,
					[
						fileURLToPath(
							new URL("../bindings/verify-report.mjs", import.meta.url),
						),
					],
					{
						env: { ...process.env, WRITR_REPORT_DIR: dir },
						timeout: 10_000,
						stdio: "pipe",
					},
				);
			if (scenario === "valid") expect(run).not.toThrow();
			else expect(run).toThrow();
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});
}

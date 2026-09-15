import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { writeReport } from "../harness/report.js";

test("isolated MDX rendering and rejection contract across every binding API", () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "writr-mdx-bindings-"));
	try {
		const file = path.join(dir, "report.json");
		execFileSync(
			process.execPath,
			[fileURLToPath(new URL("./child.mjs", import.meta.url)), file, "mdx"],
			{ env: process.env, timeout: 180_000, stdio: "pipe" },
		);
		const report = JSON.parse(fs.readFileSync(file, "utf8"));
		writeReport("bindings-mdx", report);
		expect(
			report.results.filter((r: { passed: boolean }) => !r.passed),
		).toEqual([]);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
}, 190_000);

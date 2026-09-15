import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "vitest";
import { writeReport } from "../harness/report.js";

test("every binding export against shared JS outcomes (external deadline)", () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "writr-bindings-"));
	try {
		const file = path.join(dir, "result.json");
		execFileSync(
			process.execPath,
			[fileURLToPath(new URL("./child.mjs", import.meta.url)), file],
			{ timeout: 180_000, stdio: "pipe", env: process.env },
		);
		const report = JSON.parse(fs.readFileSync(file, "utf8"));
		const declarations = fs.readFileSync(
			new URL("../../writr-rs/crates/writr-node/index.d.ts", import.meta.url),
			"utf8",
		);
		expect(report.exports.slice().sort()).toEqual(
			[...declarations.matchAll(/export declare function (\w+)/g)]
				.map((m) => m[1])
				.sort(),
		);
		writeReport("bindings", report);
		expect(
			report.results.filter((r: { passed: boolean }) => !r.passed),
		).toEqual([]);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
}, 190_000);

test("forced WASM fails without its artifact even when a native artifact exists", () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "writr-loader-"));
	try {
		for (const file of ["index.js", "writr-node.wasi.cjs"])
			fs.copyFileSync(
				new URL(`../../writr-rs/crates/writr-node/${file}`, import.meta.url),
				path.join(dir, file),
			);
		fs.writeFileSync(path.join(dir, "writr-node.node"), "native sentinel");
		fs.symlinkSync(
			fileURLToPath(
				new URL(
					"../../writr-rs/crates/writr-node/node_modules",
					import.meta.url,
				),
			),
			path.join(dir, "node_modules"),
			"junction",
		);
		let failure: { status?: number; stderr?: Buffer } | undefined;
		try {
			execFileSync(
				process.execPath,
				["-e", `require(${JSON.stringify(path.join(dir, "index.js"))})`],
				{
					env: { ...process.env, WRITR_RS_FORCE_WASM: "1" },
					timeout: 10_000,
					stdio: "pipe",
				},
			);
		} catch (error) {
			failure = error as typeof failure;
		}
		expect(failure?.status).toBe(1);
		expect(failure?.stderr?.toString()).toMatch(
			/writr-node\.wasm32-wasi\.wasm/,
		);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

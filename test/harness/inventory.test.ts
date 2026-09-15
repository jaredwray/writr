import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, test } from "vitest";
import { files, inventory } from "./inventory.js";
import { PROFILE_NAMES, getProfile } from "./profiles.js";
import { WritrJsAdapter } from "./render-adapter.js";
import { optionMatrix, FLAGS } from "./option-matrix.js";
import { outcomeEqual, parseError } from "./outcomes.js";
import { normalize } from "./normalize.js";
const dirs: string[] = [];
afterEach(() => {
	for (const d of dirs.splice(0))
		fs.rmSync(d, { recursive: true, force: true });
});
function fixture() {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "writr-inventory-"));
	dirs.push(dir);
	function write(file: string, text: string) {
		const target = path.join(dir, file);
		fs.mkdirSync(path.dirname(target), { recursive: true });
		fs.writeFileSync(target, text);
	}
	const input = "Hello\n";
	write("corpus/inputs/test/one.md", input);
	write(
		"corpus/manifest.json",
		JSON.stringify({
			count: 1,
			bySource: { test: 1 },
			entries: [
				{
					id: "test/one",
					path: "test/one.md",
					source: "test",
					bytes: Buffer.byteLength(input),
					sha256: createHash("sha256").update(input).digest("hex"),
					profiles: ["default"],
				},
			],
		}),
	);
	write("diagnostics/text/one.md", input);
	write("diagnostics/profiles.json", JSON.stringify({ text: PROFILE_NAMES }));
	write("goldens/default/test/one.html", "<p>Hello</p>\n");
	for (const profile of PROFILE_NAMES)
		write(`diagnostics-goldens/${profile}/text/one.html`, "<p>Hello</p>\n");
	fs.copyFileSync(
		new URL("./versions.json", import.meta.url),
		path.join(dir, "versions.json"),
	);
	return dir;
}
function check(dir: string) {
	return execFileSync(
		process.execPath,
		[
			"--import",
			"tsx",
			fileURLToPath(new URL("./generate-goldens.ts", import.meta.url)),
			"--check",
		],
		{
			env: { ...process.env, WRITR_HARNESS_DIR: dir },
			timeout: 20_000,
			stdio: "pipe",
		},
	);
}
for (const scenario of [
	"missing manifest",
	"missing golden",
	"unknown profile",
	"corrupted golden",
	"corrupted input",
	"duplicate ID",
	"orphan golden",
	"wrong count",
	"missing input",
]) {
	test(`${scenario} causes a nonzero full-check failure using disposable fixtures`, () => {
		const dir = fixture();
		const manifestFile = path.join(dir, "corpus/manifest.json");
		const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
		if (scenario === "missing manifest") fs.unlinkSync(manifestFile);
		else if (scenario === "missing golden")
			fs.unlinkSync(path.join(dir, "goldens/default/test/one.html"));
		else if (scenario === "corrupted golden")
			fs.writeFileSync(
				path.join(dir, "goldens/default/test/one.html"),
				"wrong",
			);
		else if (scenario === "corrupted input")
			fs.writeFileSync(
				path.join(dir, "corpus/inputs/test/one.md"),
				"Different\n",
			);
		else if (scenario === "missing input")
			fs.unlinkSync(path.join(dir, "corpus/inputs/test/one.md"));
		else if (scenario === "orphan golden")
			fs.writeFileSync(
				path.join(dir, "goldens/default/test/orphan.html"),
				"wrong",
			);
		else {
			if (scenario === "unknown profile")
				manifest.entries[0].profiles = ["unknown"];
			if (scenario === "duplicate ID") {
				manifest.entries.push(manifest.entries[0]);
				manifest.count++;
			}
			if (scenario === "wrong count") manifest.count = 999;
			fs.writeFileSync(manifestFile, JSON.stringify(manifest));
		}
		expect(() => check(dir)).toThrow();
	});
}
test("complete inventory and check pass without modifying files", () => {
	const dir = fixture();
	const before = files(dir).map((f) => [f, fs.readFileSync(f, "utf8")]);
	expect(inventory(dir)).toHaveLength(8);
	check(dir);
	expect(files(dir).map((f) => [f, fs.readFileSync(f, "utf8")])).toEqual(
		before,
	);
});
test("exact outcomes retain significant whitespace hidden by normalization", () => {
	const a = "<pre><code>x  \ny\t\n</code></pre>",
		b = "<pre><code>x\ny\n</code></pre>";
	expect(normalize(a)).toBe(normalize(b));
	expect(
		outcomeEqual({ kind: "success", html: a }, { kind: "success", html: b }),
	).toBe(false);
});
test("oracle errors surface from sync and async paths; empty HTML is valid", async () => {
	const adapter = new WritrJsAdapter();
	const mdx = getProfile("mdx");
	expect(() => adapter.renderRawSync("<Tag", mdx)).toThrow();
	await expect(adapter.renderRaw("<Tag", mdx)).rejects.toThrow();
	expect(adapter.renderRawSync("", mdx)).toBe("");
	await expect(adapter.renderRaw("", mdx)).resolves.toBe("");
	expect(() => parseError(new Error("missing binary"), "rust")).toThrow(
		"missing binary",
	);
	expect(() => parseError(new Error("timeout"), "js")).toThrow("timeout");
});
test("option matrix covers every boolean pair and explicit higher-order interactions", () => {
	const matrix = optionMatrix();
	for (let i = 0; i < FLAGS.length; i++)
		for (let j = i + 1; j < FLAGS.length; j++)
			for (const a of [false, true])
				for (const b of [false, true])
					expect(
						matrix.some((row) => row[FLAGS[i]] === a && row[FLAGS[j]] === b),
						`${FLAGS[i]}=${a},${FLAGS[j]}=${b}`,
					).toBe(true);
	for (const flags of [
		["mdx", "rawHtml"],
		["gfm", "toc", "slug", "emoji"],
		["highlight", "math"],
	])
		expect(matrix.some((row) => flags.every((f) => row[f]))).toBe(true);
});

test("all fourteen divergence categories have reproducible fixture references and explicit dispositions", () => {
	const registry = JSON.parse(
		fs.readFileSync(new URL("./divergences.json", import.meta.url), "utf8"),
	);
	const fixture = JSON.parse(
		fs.readFileSync(new URL("./exact/outcomes.json", import.meta.url), "utf8"),
	);
	expect(registry.map((d: { id: string }) => d.id)).toEqual(
		Array.from({ length: 14 }, (_, i) => `D${String(i + 1).padStart(2, "0")}`),
	);
	const ids = new Set(
		[...fixture.cases, ...fixture.stages].map((c: { id: string }) => c.id),
	);
	for (const d of registry) {
		expect(d.caseIds.length, d.id).toBeGreaterThan(0);
		expect(
			d.caseIds.every((id: string) => ids.has(id)),
			d.id,
		).toBe(true);
		expect(d.disposition, d.id).toBeTruthy();
		expect(d.reachability, d.id).toBeTruthy();
		if (d.disposition !== "fixed-or-matches-fixtures")
			expect(d.blocker, d.id).toBeTruthy();
	}
});

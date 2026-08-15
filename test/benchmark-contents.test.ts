import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const fixtureExts = new Set([".md", ".html", ".jsonl"]);

function collectFromDir(root: string, files: string[]): void {
	for (const entry of fs.readdirSync(root, {
		recursive: true,
		encoding: "utf8",
	})) {
		const full = path.join(root, entry);
		if (!fixtureExts.has(path.extname(full))) {
			continue;
		}
		if (!fs.statSync(full).isFile()) {
			continue;
		}
		files.push(full);
	}
}

function collectFixtureFiles(): string[] {
	const files: string[] = [];
	collectFromDir("./test/harness", files);
	collectFromDir("./writr-rs/crates/writr-core/tests/fixtures", files);
	return files;
}

function assertNoSecretBait(source: string, file: string): void {
	// Aikido/gitleaks treat `Authorization: Bearer <word>` as a live token.
	expect(source, file).not.toMatch(
		/\bAuthorization:\s*Bearer\s+[A-Za-z0-9._-]{8,}/i,
	);
	expect(source, file).not.toMatch(/\bBearer\s+[A-Za-z0-9._-]{8,}/);
	expect(source, file).not.toMatch(/\bsk_(?:live|test)_/);
	expect(source, file).not.toMatch(/\bghp_[A-Za-z0-9]+/);
}

describe("markdown fixtures", () => {
	it("does not embed secret-scanner bait in example snippets", () => {
		const benchmark = fs.readFileSync(
			"./benchmark/benchmark-contents.ts",
			"utf8",
		);
		assertNoSecretBait(benchmark, "./benchmark/benchmark-contents.ts");
		expect(benchmark).not.toMatch(
			/(?:postgres|mysql|mongodb|redis):\/\/[^/\s:]+:[^@\s]+@/i,
		);

		for (const file of collectFixtureFiles()) {
			assertNoSecretBait(fs.readFileSync(file, "utf8"), file);
		}
	});
});

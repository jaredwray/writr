import fs from "node:fs";
import { describe, expect, it } from "vitest";

const contentsPath = "./benchmark/benchmark-contents.ts";

describe("benchmark markdown fixtures", () => {
	it("does not embed secret-scanner bait in example snippets", () => {
		const source = fs.readFileSync(contentsPath, "utf8");

		// Aikido/gitleaks treat `Authorization: Bearer <word>` as a live token.
		expect(source).not.toMatch(/Authorization:\s*Bearer\s+[A-Za-z0-9._-]{8,}/);
		expect(source).not.toMatch(/\bsk_(?:live|test)_/);
		expect(source).not.toMatch(
			/(?:postgres|mysql|mongodb|redis):\/\/[^/\s:]+:[^@\s]+@/i,
		);
	});
});

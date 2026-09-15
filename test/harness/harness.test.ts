import fs from "node:fs";
import { afterAll, expect, test } from "vitest";
import { inventory, inventoryCounts } from "./inventory.js";
import { normalize } from "./normalize.js";
import { getProfile } from "./profiles.js";
import { getAdapter, WritrJsAdapter } from "./render-adapter.js";
import { checkVersions } from "./versions.js";
import { writeReport } from "./report.js";
const cases = inventory();
const versions = checkVersions();
const adapter = getAdapter();
const oracle = new WritrJsAdapter();
const results: {
	id: string;
	profile: string;
	passed: boolean;
	error?: string;
}[] = [];
test.each(cases)(
	"$suite $profile :: $id (exact current JS + normalized historical)",
	async (c) => {
		try {
			const input = fs.readFileSync(c.inputPath, "utf8");
			const profile = getProfile(c.profile);
			const expected = oracle.renderRawSync(input, profile);
			expect(await oracle.renderRaw(input, profile)).toBe(expected);
			if (adapter.name !== oracle.name) {
				expect(adapter.renderRawSync(input, profile)).toBe(expected);
				expect(await adapter.renderRaw(input, profile)).toBe(expected);
			}
			expect(normalize(expected)).toBe(fs.readFileSync(c.goldenPath, "utf8"));
			results.push({ id: c.id, profile: c.profile, passed: true });
		} catch (error) {
			results.push({
				id: c.id,
				profile: c.profile,
				passed: false,
				error: String(error),
			});
			throw error;
		}
	},
);
afterAll(() =>
	writeReport("harness", {
		engine: adapter.name,
		versions,
		profiles: inventoryCounts(cases),
		uniqueCorpusDocuments: new Set(
			cases.filter((c) => c.suite === "corpus").map((c) => c.id),
		).size,
		caseCount: cases.length,
		resultUnit: "input/profile case comparisons",
		apiPaths:
			adapter.name === oracle.name
				? ["JS renderSync", "JS render"]
				: [
						"JS renderSync",
						"JS render",
						"binding render",
						"binding renderAsync",
					],
		comparisonModes: [
			"exact current JS sync/async",
			"historical normalized HTML",
		],
		results,
	}),
);

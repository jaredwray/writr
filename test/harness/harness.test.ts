/**
 * Markdown golden-snapshot harness runner.
 *
 * Discovers every committed golden, re-renders the matching input with the
 * active engine (JS by default; set HARNESS_ENGINE to swap in a native engine),
 * and asserts byte equality after normalization. A reviewed allowlist downgrades
 * known intentional divergences to warnings.
 *
 * This file lives under test/harness/ and runs only via `vitest.harness.config.ts`
 * (kept out of the default `pnpm test` so the 1000+ file suite never slows the
 * normal/coverage run).
 */

import fs from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { loadAllowlist, matchAllowlist } from "./allowlist.js";
import { firstDivergence, formatDiff } from "./diff.js";
import {
	listCorpusGoldens,
	listDiagnosticGoldens,
	readDiagnosticGolden,
	readGolden,
} from "./golden-store.js";
import { DIAGNOSTICS_DIR, inputPath } from "./paths.js";
import { getProfile } from "./profiles.js";
import { getAdapter } from "./render-adapter.js";

const adapter = getAdapter();
const allowlist = loadAllowlist();
const allowed: string[] = [];

afterAll(() => {
	if (allowed.length > 0) {
		console.warn(
			`\n[${adapter.name}] ${allowed.length} allowed divergence(s):\n  ${allowed.join("\n  ")}`,
		);
	}
});

/** Resolve a diagnostic input path, trying both .md and .mdx. */
function diagnosticInputPath(feature: string, name: string): string {
	const md = path.join(DIAGNOSTICS_DIR, feature, `${name}.md`);
	return fs.existsSync(md)
		? md
		: path.join(DIAGNOSTICS_DIR, feature, `${name}.mdx`);
}

/** Assert rendered output matches the golden, honoring the allowlist. */
function assertMatches(
	id: string,
	profileName: string,
	input: string,
	golden: string | undefined,
	actual: string,
): void {
	expect(golden, `golden file missing for ${profileName} :: ${id}`).toBeDefined();
	if (golden === actual) {
		return;
	}
	const match = matchAllowlist(allowlist, adapter.name, profileName, id);
	if (match) {
		allowed.push(`${profileName} :: ${id} — ${match.reason}`);
		return;
	}
	const diff = firstDivergence(golden as string, actual);
	throw new Error(
		`Output diverged from golden for ${profileName} :: ${id}\n${formatDiff(diff)}`,
	);
}

// ---- Corpus suite, grouped by profile then by source class ----------------
const corpusGoldens = listCorpusGoldens();
const corpusByProfile = new Map<string, typeof corpusGoldens>();
for (const g of corpusGoldens) {
	const list = corpusByProfile.get(g.profile) ?? [];
	list.push(g);
	corpusByProfile.set(g.profile, list);
}

describe.skipIf(corpusGoldens.length === 0)("corpus", () => {
	for (const [profileName, goldens] of corpusByProfile) {
		const profile = getProfile(profileName);
		// Sub-group by the leading path segment (the source class) for readability.
		const byClass = new Map<string, typeof goldens>();
		for (const g of goldens) {
			const cls = g.id.split("/")[0];
			const list = byClass.get(cls) ?? [];
			list.push(g);
			byClass.set(cls, list);
		}
		describe(profileName, () => {
			for (const [cls, list] of byClass) {
				describe(cls, () => {
					test.concurrent.each(list.map((g) => [g.id, g] as const))(
						"%s",
						async (id, g) => {
							const input = fs.readFileSync(inputPath(id), "utf8");
							const actual = await adapter.render(input, profile);
							assertMatches(id, profileName, input, readGolden(profileName, id), actual);
						},
					);
				});
			}
		});
	}
});

// ---- Diagnostic suite, grouped by profile then feature --------------------
const diagGoldens = listDiagnosticGoldens();
const diagByProfile = new Map<string, typeof diagGoldens>();
for (const g of diagGoldens) {
	const list = diagByProfile.get(g.profile) ?? [];
	list.push(g);
	diagByProfile.set(g.profile, list);
}

describe.skipIf(diagGoldens.length === 0)("diagnostics", () => {
	for (const [profileName, goldens] of diagByProfile) {
		const profile = getProfile(profileName);
		const byFeature = new Map<string, typeof goldens>();
		for (const g of goldens) {
			const list = byFeature.get(g.feature) ?? [];
			list.push(g);
			byFeature.set(g.feature, list);
		}
		describe(profileName, () => {
			for (const [feature, list] of byFeature) {
				describe(feature, () => {
					test.each(list.map((g) => [g.name, g] as const))(
						"%s",
						async (name, g) => {
							const file = diagnosticInputPath(g.feature, name);
							const input = fs.readFileSync(file, "utf8");
							const actual = await adapter.render(input, profile);
							const id = `${g.feature}/${name}`;
							assertMatches(
								id,
								profileName,
								input,
								readDiagnosticGolden(profileName, g.feature, name),
								actual,
							);
						},
					);
				});
			}
		});
	}
});

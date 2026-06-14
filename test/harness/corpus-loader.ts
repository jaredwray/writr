import fs from "node:fs";
import path from "node:path";
import {
	CORPUS_INPUTS_DIR,
	DIAGNOSTICS_DIR,
	inputPath,
	MANIFEST_PATH,
} from "./paths.js";
import { PROFILE_NAMES } from "./profiles.js";
import type { DiagnosticEntry, Manifest, ManifestEntry } from "./types.js";

/** Load and parse the corpus manifest, or return an empty manifest. */
export function loadManifest(): Manifest {
	if (!fs.existsSync(MANIFEST_PATH)) {
		return { generatedAt: "", count: 0, bySource: {}, entries: [] };
	}
	return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) as Manifest;
}

/** Read the markdown input for a manifest entry. */
export function readInput(entry: ManifestEntry): string {
	return fs.readFileSync(inputPath(entry.id), "utf8");
}

/**
 * Discover hand-authored diagnostic examples under `diagnostics/<feature>/`.
 * Each diagnostic is rendered under the profiles that exercise its feature,
 * defaulting to `default` plus a profile that isolates the feature when one is
 * declared in the optional `diagnostics/profiles.json` map.
 */
export function loadDiagnostics(): DiagnosticEntry[] {
	if (!fs.existsSync(DIAGNOSTICS_DIR)) {
		return [];
	}

	const profileMap = loadDiagnosticProfileMap();
	const entries: DiagnosticEntry[] = [];

	for (const feature of fs.readdirSync(DIAGNOSTICS_DIR)) {
		const featureDir = path.join(DIAGNOSTICS_DIR, feature);
		if (!fs.statSync(featureDir).isDirectory()) {
			continue;
		}
		const profiles = profileMap[feature] ?? ["default"];
		for (const file of fs.readdirSync(featureDir)) {
			if (!file.endsWith(".md") && !file.endsWith(".mdx")) {
				continue;
			}
			const name = file.replace(/\.mdx?$/, "");
			entries.push({
				feature,
				name,
				inputPath: path.join(featureDir, file),
				profiles,
			});
		}
	}

	return entries.sort((a, b) =>
		`${a.feature}/${a.name}`.localeCompare(`${b.feature}/${b.name}`),
	);
}

/**
 * Optional `diagnostics/profiles.json` mapping each feature folder to the
 * profiles it should be rendered under. Falls back to `["default"]`.
 */
function loadDiagnosticProfileMap(): Record<string, string[]> {
	const file = path.join(DIAGNOSTICS_DIR, "profiles.json");
	if (!fs.existsSync(file)) {
		return {};
	}
	const map = JSON.parse(fs.readFileSync(file, "utf8")) as Record<
		string,
		string[]
	>;
	for (const [feature, profiles] of Object.entries(map)) {
		for (const p of profiles) {
			if (!PROFILE_NAMES.includes(p)) {
				throw new Error(
					`diagnostics/profiles.json: feature "${feature}" references unknown profile "${p}"`,
				);
			}
		}
	}
	return map;
}

/** True when a corpus has been fetched (inputs dir exists and is non-empty). */
export function corpusExists(): boolean {
	return (
		fs.existsSync(CORPUS_INPUTS_DIR) &&
		fs.readdirSync(CORPUS_INPUTS_DIR).length > 0
	);
}

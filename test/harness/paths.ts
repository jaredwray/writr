import path from "node:path";
import { fileURLToPath } from "node:url";

/** Absolute path to the `test/harness` directory. */
export const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));

/** Raw downloaded payloads, committed so generation/tests run offline. */
export const FETCH_CACHE_DIR = path.join(HARNESS_DIR, "fetch", "cache");

/** Corpus input documents and manifest. */
export const CORPUS_DIR = path.join(HARNESS_DIR, "corpus");
export const CORPUS_INPUTS_DIR = path.join(CORPUS_DIR, "inputs");
export const MANIFEST_PATH = path.join(CORPUS_DIR, "manifest.json");

/** Golden HTML outputs, keyed `goldens/<profile>/<id>.html`. */
export const GOLDENS_DIR = path.join(HARNESS_DIR, "goldens");

/** Hand-authored per-feature diagnostic inputs and their goldens. */
export const DIAGNOSTICS_DIR = path.join(HARNESS_DIR, "diagnostics");
export const DIAGNOSTICS_GOLDENS_DIR = path.join(
	HARNESS_DIR,
	"diagnostics-goldens",
);

/** Reviewed intentional-diff allowlist and captured plugin versions. */
export const ALLOWLIST_PATH = path.join(HARNESS_DIR, "allowlist.json");
export const VERSIONS_PATH = path.join(HARNESS_DIR, "versions.json");

/**
 * Resolve the golden file path for a corpus example under a given profile.
 * `id` is the corpus-relative slug (e.g. `commonmark/0042`).
 */
export function goldenPath(profile: string, id: string): string {
	return path.join(GOLDENS_DIR, profile, `${id}.html`);
}

/** Resolve the input file path for a corpus example id. */
export function inputPath(id: string): string {
	return path.join(CORPUS_INPUTS_DIR, `${id}.md`);
}

/** Resolve the golden path for a diagnostic example. */
export function diagnosticGoldenPath(
	profile: string,
	feature: string,
	name: string,
): string {
	return path.join(DIAGNOSTICS_GOLDENS_DIR, profile, feature, `${name}.html`);
}

/**
 * Zero-pad a numeric index to a stable, sortable width (4 digits) used in
 * corpus ids such as `commonmark/0042`.
 */
export function padIndex(index: number): string {
	return String(index).padStart(4, "0");
}

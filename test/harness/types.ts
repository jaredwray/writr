/**
 * Provenance and rendering metadata for a single corpus document.
 * Persisted in `corpus/manifest.json`.
 */
export type ManifestEntry = {
	/** Corpus-relative slug, also the input/golden key (e.g. `commonmark/0042`). */
	id: string;
	/** Path to the input markdown relative to `corpus/inputs`. */
	path: string;
	/** Source registry id this document came from (e.g. `commonmark-spec`). */
	source: string;
	/** Where the document originated within the source (file, example #, repo). */
	originPath: string;
	/** SPDX-ish license string for the document. */
	license: string;
	/** Attribution / origin URL for the document. */
	attribution: string;
	/** SHA-256 of the normalized input markdown (used for dedupe + integrity). */
	sha256: string;
	/** Byte length of the input. */
	bytes: number;
	/** Profile names this document is rendered under. */
	profiles: string[];
};

/** The full corpus manifest. */
export type Manifest = {
	/** ISO timestamp of when the corpus was assembled. */
	generatedAt: string;
	/** Total number of corpus documents. */
	count: number;
	/** Per-source document counts for quick auditing. */
	bySource: Record<string, number>;
	/** The documents themselves, sorted by id. */
	entries: ManifestEntry[];
};

/** A diagnostic example: one tiny markdown construct isolating a feature. */
export type DiagnosticEntry = {
	/** Feature folder, e.g. `gfm-tables`, `math`, `frontmatter`. */
	feature: string;
	/** File name without extension, e.g. `alignment`. */
	name: string;
	/** Absolute path to the input markdown. */
	inputPath: string;
	/** Profiles this diagnostic is rendered under. */
	profiles: string[];
};

import fs from "node:fs";
import { ALLOWLIST_PATH } from "./paths.js";

/**
 * A reviewed, intentional divergence between an engine's output and the golden.
 * Used during a migration to record places where the new engine deliberately
 * differs (and why), without failing the suite.
 */
export type AllowlistEntry = {
	/** Engine the entry applies to, e.g. `writr-rust`. */
	engine: string;
	/** Profile name, or `*` to match any profile. */
	profile: string;
	/** Corpus/diagnostic id, or `*` to match any id. */
	id: string;
	/** Why this divergence is acceptable. */
	reason: string;
	/** Who approved it. */
	approvedBy?: string;
	/** ISO date of approval. */
	date?: string;
};

export type Allowlist = {
	entries: AllowlistEntry[];
};

/** Load the allowlist, returning an empty list when the file is absent. */
export function loadAllowlist(): Allowlist {
	if (!fs.existsSync(ALLOWLIST_PATH)) {
		return { entries: [] };
	}
	const data = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, "utf8")) as Allowlist;
	return { entries: data.entries ?? [] };
}

/**
 * Find an allowlist entry that downgrades a mismatch for `(engine, profile, id)`
 * to an informational "allowed divergence". `*` wildcards match anything.
 */
export function matchAllowlist(
	allowlist: Allowlist,
	engine: string,
	profile: string,
	id: string,
): AllowlistEntry | undefined {
	return allowlist.entries.find(
		(e) =>
			e.engine === engine &&
			(e.profile === "*" || e.profile === profile) &&
			(e.id === "*" || e.id === id),
	);
}

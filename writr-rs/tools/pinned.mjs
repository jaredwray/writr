// Resolve a package at the exact version writr's goldens were generated with,
// from pnpm's virtual store. Codegen must never silently pick up a different
// version — parity with the JS engine depends on these exact pins.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const REPO_ROOT = path.join(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
	"..",
);
const STORE = path.join(REPO_ROOT, "node_modules", ".pnpm");

/** Import `name` at exactly `version` from the pnpm store. */
export async function importPinned(name, version, subpath = "") {
	const prefix = `${name}@${version}`;
	const entries = fs.existsSync(STORE) ? fs.readdirSync(STORE) : [];
	const hit = entries.find(
		(entry) => entry === prefix || entry.startsWith(`${prefix}_`),
	);
	if (!hit) {
		throw new Error(
			`${prefix} not found in ${STORE} — run \`pnpm install\` first, and if the ` +
				`lockfile moved past ${version}, re-audit the generated tables before bumping.`,
		);
	}
	const dir = path.join(STORE, hit, "node_modules", name);
	const packageJson = JSON.parse(
		fs.readFileSync(path.join(dir, "package.json"), "utf8"),
	);
	if (packageJson.version !== version) {
		throw new Error(
			`expected ${prefix}, found ${packageJson.version} at ${dir}`,
		);
	}
	const target = subpath
		? path.join(dir, subpath)
		: path.join(
				dir,
				typeof packageJson.exports?.["."] === "string"
					? packageJson.exports["."]
					: (packageJson.exports?.["."]?.default ??
							packageJson.module ??
							packageJson.main ??
							"index.js"),
			);
	return import(pathToFileURL(target).href);
}

/** Filesystem path of a pinned package (for reading data files). */
export function pinnedDir(name, version) {
	const prefix = `${name}@${version}`;
	const entries = fs.existsSync(STORE) ? fs.readdirSync(STORE) : [];
	const hit = entries.find(
		(entry) => entry === prefix || entry.startsWith(`${prefix}_`),
	);
	if (!hit) {
		throw new Error(`${prefix} not found in ${STORE}`);
	}
	return path.join(STORE, hit, "node_modules", name);
}

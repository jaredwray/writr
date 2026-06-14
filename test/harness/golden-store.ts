import fs from "node:fs";
import path from "node:path";
import {
	diagnosticGoldenPath,
	DIAGNOSTICS_GOLDENS_DIR,
	GOLDENS_DIR,
	goldenPath,
} from "./paths.js";

/** Read a corpus golden, or `undefined` when it does not exist yet. */
export function readGolden(profile: string, id: string): string | undefined {
	const file = goldenPath(profile, id);
	return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : undefined;
}

/** Write a corpus golden, creating parent directories as needed. */
export function writeGolden(profile: string, id: string, html: string): void {
	const file = goldenPath(profile, id);
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, html);
}

/** Read a diagnostic golden, or `undefined` when missing. */
export function readDiagnosticGolden(
	profile: string,
	feature: string,
	name: string,
): string | undefined {
	const file = diagnosticGoldenPath(profile, feature, name);
	return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : undefined;
}

/** Write a diagnostic golden, creating parent directories as needed. */
export function writeDiagnosticGolden(
	profile: string,
	feature: string,
	name: string,
	html: string,
): void {
	const file = diagnosticGoldenPath(profile, feature, name);
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, html);
}

/** Recursively collect every golden file under a directory tree. */
function walk(dir: string): string[] {
	if (!fs.existsSync(dir)) {
		return [];
	}
	const out: string[] = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			out.push(...walk(full));
		} else if (entry.isFile() && entry.name.endsWith(".html")) {
			out.push(full);
		}
	}
	return out;
}

/** Every committed corpus golden, as `{ profile, id, file }`. */
export function listCorpusGoldens(): { profile: string; id: string; file: string }[] {
	return walk(GOLDENS_DIR)
		.map((file) => {
			const rel = path.relative(GOLDENS_DIR, file);
			const parts = rel.split(path.sep);
			const profile = parts[0];
			const id = parts.slice(1).join("/").replace(/\.html$/, "");
			return { profile, id, file };
		})
		.sort((a, b) => a.file.localeCompare(b.file));
}

/** Every committed diagnostic golden, as `{ profile, feature, name, file }`. */
export function listDiagnosticGoldens(): {
	profile: string;
	feature: string;
	name: string;
	file: string;
}[] {
	return walk(DIAGNOSTICS_GOLDENS_DIR)
		.map((file) => {
			const rel = path.relative(DIAGNOSTICS_GOLDENS_DIR, file);
			const parts = rel.split(path.sep);
			const profile = parts[0];
			const feature = parts[1];
			const name = parts.slice(2).join("/").replace(/\.html$/, "");
			return { profile, feature, name, file };
		})
		.sort((a, b) => a.file.localeCompare(b.file));
}

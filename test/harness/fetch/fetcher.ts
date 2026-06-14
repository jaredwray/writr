/**
 * Corpus fetcher CLI.
 *
 * Run via tsx:
 *   node_modules/.bin/tsx test/harness/fetch/fetcher.ts [--cap=N] [--source=id]
 *                                                       [--offline | --online]
 *
 * Pipeline: for each registered source, get raw payloads (from the committed
 * cache, or the network) -> extract candidate docs -> normalize + hash ->
 * dedupe by sha256 -> filter (size / emptiness / utf8) -> stratified cap ->
 * write inputs + a deterministic manifest.
 *
 * Determinism: given the same cache and the same cap, the produced inputs and
 * manifest are byte-identical. The only timestamp is `manifest.generatedAt`.
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
	CORPUS_INPUTS_DIR,
	FETCH_CACHE_DIR,
	inputPath,
	MANIFEST_PATH,
	padIndex,
} from "../paths.js";
import type { Manifest, ManifestEntry } from "../types.js";
import type { ExtractedDoc } from "./extractors.js";
import { type FetchContext, getSource, type Source, SOURCES } from "./sources.js";

// --- CLI args ---------------------------------------------------------------

type Args = {
	cap: number;
	source?: string;
	offline: boolean;
};

function parseArgs(argv: string[]): Args {
	const args: Args = { cap: 1000, offline: false };
	for (const arg of argv) {
		if (arg === "--offline") {
			args.offline = true;
		} else if (arg === "--online") {
			args.offline = false;
		} else if (arg.startsWith("--cap=")) {
			const n = Number.parseInt(arg.slice("--cap=".length), 10);
			if (!Number.isFinite(n) || n <= 0) {
				throw new Error(`Invalid --cap value: ${arg}`);
			}
			args.cap = n;
		} else if (arg.startsWith("--source=")) {
			args.source = arg.slice("--source=".length);
		} else {
			throw new Error(`Unknown argument: ${arg}`);
		}
	}
	return args;
}

// --- Cached fetch helpers ---------------------------------------------------

const MAX_RETRIES = 4;
const BASE_BACKOFF_MS = 500;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Make a filesystem-safe cache file name. */
function safeName(name: string): string {
	return name.replace(/[^A-Za-z0-9._-]/g, "_");
}

function cachePathFor(sourceId: string, name: string): string {
	return path.join(FETCH_CACHE_DIR, sourceId, safeName(name));
}

/**
 * Build the cached fetch context for a source. Reads from the committed cache
 * when present; otherwise (online mode) fetches with retry + backoff and writes
 * the payload to the cache so subsequent runs replay offline. In offline mode a
 * cache miss is a hard, clearly-described error.
 */
function makeFetchContext(
	sourceId: string,
	offline: boolean,
	token: string | undefined,
): FetchContext {
	const dir = path.join(FETCH_CACHE_DIR, sourceId);
	fs.mkdirSync(dir, { recursive: true });

	const fetchText = async (url: string, cacheName: string): Promise<string> => {
		const file = cachePathFor(sourceId, cacheName);
		if (fs.existsSync(file)) {
			return fs.readFileSync(file, "utf8");
		}
		if (offline) {
			throw new Error(
				`offline mode: missing cache file ${file} for ${url}. Run once with --online to populate the cache.`,
			);
		}

		let lastError: unknown;
		for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
			try {
				const headers: Record<string, string> = {
					"user-agent": "writr-corpus-fetcher",
				};
				// Authorize GitHub API calls when a token is available.
				if (token && url.startsWith("https://api.github.com/")) {
					headers.authorization = `Bearer ${token}`;
				}
				const response = await fetch(url, { headers });
				if (!response.ok) {
					throw new Error(`HTTP ${response.status} for ${url}`);
				}
				const text = await response.text();
				fs.writeFileSync(file, text, "utf8");
				return text;
			} catch (error) {
				lastError = error;
				if (attempt < MAX_RETRIES) {
					await sleep(BASE_BACKOFF_MS * 2 ** attempt);
				}
			}
		}
		throw new Error(
			`failed to fetch ${url} after ${MAX_RETRIES + 1} attempts: ${(lastError as Error).message}`,
		);
	};

	const fetchJson = async <T>(url: string, cacheName: string): Promise<T> => {
		const text = await fetchText(url, cacheName);
		return JSON.parse(text) as T;
	};

	return { fetchText, fetchJson, log: (m) => console.log(`  ${m}`) };
}

// --- Normalization + hashing ------------------------------------------------

/**
 * Canonicalize markdown for hashing AND on-disk storage so that the stored
 * input file is byte-identical to what was hashed (sha256(file) === sha256 in
 * the manifest, and `bytes` === the file size). Steps: CRLF/CR -> LF, strip
 * trailing whitespace per line, drop trailing blank lines, then terminate with
 * exactly one trailing newline. Internal content is otherwise preserved.
 */
function normalizeMarkdown(markdown: string): string {
	const lines = markdown
		.replace(/\r\n?/g, "\n")
		.split("\n")
		.map((line) => line.replace(/[ \t]+$/g, ""));
	while (lines.length > 0 && lines[lines.length - 1] === "") {
		lines.pop();
	}
	return lines.length === 0 ? "" : `${lines.join("\n")}\n`;
}

function sha256(text: string): string {
	return createHash("sha256").update(text, "utf8").digest("hex");
}

/** A candidate that has survived normalization + filtering. */
type Candidate = {
	source: string;
	profiles: string[];
	originPath: string;
	license: string;
	attribution: string;
	markdown: string; // normalized
	sha256: string;
	bytes: number;
};

const MAX_BYTES = 256 * 1024;
const MIN_NONWS_CHARS = 2;

/** True if `text` round-trips through UTF-8 unchanged (i.e. is valid UTF-8). */
function isValidUtf8(text: string): boolean {
	// Strings in JS are already UTF-16; a lone surrogate signals invalid input.
	return !/[\uD800-\uDFFF]/.test(text.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, ""));
}

// --- Pipeline ---------------------------------------------------------------

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2));
	const token = process.env.GITHUB_TOKEN;

	const sources: readonly Source[] = args.source
		? [getSource(args.source)]
		: SOURCES;

	console.log(
		`corpus fetch: cap=${args.cap} mode=${args.offline ? "offline" : "online"} sources=[${sources.map((s) => s.id).join(", ")}]${token ? " (GITHUB_TOKEN present)" : ""}`,
	);

	// 1. Collect candidates per source.
	const rawCounts: Record<string, number> = {};
	// Keyed by source id, in fixed SOURCES order, holding surviving candidates.
	const bySource = new Map<string, Candidate[]>();
	const seenHashes = new Set<string>();

	for (const source of sources) {
		console.log(`source ${source.id}:`);
		const ctx = makeFetchContext(source.id, args.offline, token);
		let docs: ExtractedDoc[] = [];
		try {
			docs = await source.collect(ctx);
		} catch (error) {
			// A whole source failing is tolerated; others still produce a corpus.
			console.log(`  ERROR collecting ${source.id}: ${(error as Error).message}`);
		}
		rawCounts[source.id] = docs.length;

		const survivors: Candidate[] = [];
		for (const doc of docs) {
			const normalized = normalizeMarkdown(doc.markdown);
			const trimmed = normalized.replace(/\s+/g, "");
			if (trimmed.length < MIN_NONWS_CHARS) {
				continue; // too small to be meaningful
			}
			const bytes = Buffer.byteLength(normalized, "utf8");
			if (bytes > MAX_BYTES) {
				continue; // oversized
			}
			if (!isValidUtf8(normalized)) {
				continue; // non-utf8
			}
			const hash = sha256(normalized);
			if (seenHashes.has(hash)) {
				continue; // global dedupe, first occurrence wins
			}
			seenHashes.add(hash);
			survivors.push({
				source: source.id,
				profiles: source.profiles,
				originPath: doc.originPath,
				license: doc.license,
				attribution: doc.attribution,
				markdown: normalized,
				sha256: hash,
				bytes,
			});
		}
		// Deterministic intra-source order for stratified selection + ids.
		survivors.sort((a, b) => a.sha256.localeCompare(b.sha256));
		bySource.set(source.id, survivors);
		console.log(
			`  ${source.id}: ${docs.length} raw -> ${survivors.length} unique survivors`,
		);
	}

	// 2. Stratified cap: round-robin across sources (fixed order) one at a time.
	const selected: Candidate[] = [];
	const cursors = new Map<string, number>();
	for (const source of sources) {
		cursors.set(source.id, 0);
	}
	let progressed = true;
	while (selected.length < args.cap && progressed) {
		progressed = false;
		for (const source of sources) {
			if (selected.length >= args.cap) {
				break;
			}
			const list = bySource.get(source.id) ?? [];
			const cursor = cursors.get(source.id) ?? 0;
			if (cursor < list.length) {
				selected.push(list[cursor]);
				cursors.set(source.id, cursor + 1);
				progressed = true;
			}
		}
	}

	// 3. Assign per-class ids in sha256-sorted order and group selected by class.
	const selectedByClass = new Map<string, Candidate[]>();
	for (const cand of selected) {
		const arr = selectedByClass.get(cand.source) ?? [];
		arr.push(cand);
		selectedByClass.set(cand.source, arr);
	}

	const entries: ManifestEntry[] = [];
	for (const source of sources) {
		const list = (selectedByClass.get(source.id) ?? [])
			.slice()
			.sort((a, b) => a.sha256.localeCompare(b.sha256));
		list.forEach((cand, index) => {
			const id = `${source.id}/${padIndex(index)}`;
			const target = inputPath(id);
			fs.mkdirSync(path.dirname(target), { recursive: true });
			// `cand.markdown` is already the canonical hashed form, so the file
			// is byte-identical to what `sha256`/`bytes` were computed over.
			fs.writeFileSync(target, cand.markdown, "utf8");
			entries.push({
				id,
				path: `${id}.md`,
				source: cand.source,
				originPath: cand.originPath,
				license: cand.license,
				attribution: cand.attribution,
				sha256: cand.sha256,
				bytes: cand.bytes,
				profiles: cand.profiles,
			});
		});
	}

	// 4. Manifest (entries sorted by id).
	entries.sort((a, b) => a.id.localeCompare(b.id));
	const counts: Record<string, number> = {};
	for (const entry of entries) {
		counts[entry.source] = (counts[entry.source] ?? 0) + 1;
	}
	const manifest: Manifest = {
		generatedAt: new Date().toISOString(),
		count: entries.length,
		bySource: counts,
		entries,
	};
	fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
	fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

	// 5. Validate + report.
	validate(entries);
	report(rawCounts, counts, entries.length, args.cap);
}

/** Sanity-check the written corpus: no id collisions, every input exists. */
function validate(entries: ManifestEntry[]): void {
	const ids = new Set<string>();
	for (const entry of entries) {
		if (ids.has(entry.id)) {
			throw new Error(`id collision: ${entry.id}`);
		}
		ids.add(entry.id);
		const file = inputPath(entry.id);
		if (!fs.existsSync(file)) {
			throw new Error(`missing input file for ${entry.id}: ${file}`);
		}
		for (const profile of entry.profiles) {
			if (!profile) {
				throw new Error(`empty profile name for ${entry.id}`);
			}
		}
	}
	// Ensure no stale input files linger from a previous, larger run.
	pruneOrphans(ids);
}

/** Remove corpus input files that are not referenced by the new manifest. */
function pruneOrphans(validIds: Set<string>): void {
	if (!fs.existsSync(CORPUS_INPUTS_DIR)) {
		return;
	}
	for (const classDir of fs.readdirSync(CORPUS_INPUTS_DIR)) {
		const dir = path.join(CORPUS_INPUTS_DIR, classDir);
		if (!fs.statSync(dir).isDirectory()) {
			continue;
		}
		for (const file of fs.readdirSync(dir)) {
			if (!file.endsWith(".md")) {
				continue;
			}
			const id = `${classDir}/${file.replace(/\.md$/, "")}`;
			if (!validIds.has(id)) {
				fs.rmSync(path.join(dir, file));
			}
		}
	}
}

function report(
	rawCounts: Record<string, number>,
	counts: Record<string, number>,
	total: number,
	cap: number,
): void {
	console.log("\n=== corpus fetch summary ===");
	console.log(`cap requested: ${cap}`);
	console.log(`total corpus size: ${total}`);
	console.log("per-source (selected / raw extracted):");
	const ids = new Set([...Object.keys(rawCounts), ...Object.keys(counts)]);
	for (const id of [...ids].sort()) {
		console.log(`  ${id}: ${counts[id] ?? 0} / ${rawCounts[id] ?? 0}`);
	}
	console.log(`manifest: ${MANIFEST_PATH}`);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});

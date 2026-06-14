/**
 * Golden generator for the markdown harness.
 *
 * Renders every corpus + diagnostic example under its declared profiles using
 * the current Writr (JS) engine and writes the normalized HTML as golden
 * snapshots. These goldens are the contract a future native (Rust) engine must
 * reproduce.
 *
 * Usage:
 *   tsx test/harness/generate-goldens.ts [flags]
 *     --check               Diff against existing goldens without writing; exit 1 on drift.
 *     --profile=<name>      Restrict to a single profile (repeatable via comma list).
 *     --id=<substring>      Restrict to ids containing this substring.
 *     --diagnostics-only    Only process the hand-authored diagnostic suite.
 *     --corpus-only         Only process the fetched corpus.
 *     --concurrency=<n>     Parallel render workers (default 12).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	corpusExists,
	loadDiagnostics,
	loadManifest,
	readInput,
} from "./corpus-loader.js";
import { firstDivergence, formatDiff } from "./diff.js";
import {
	readDiagnosticGolden,
	readGolden,
	writeDiagnosticGolden,
	writeGolden,
} from "./golden-store.js";
import { VERSIONS_PATH } from "./paths.js";
import { getProfile, type Profile } from "./profiles.js";
import { WritrJsAdapter } from "./render-adapter.js";

type Flags = {
	check: boolean;
	profiles?: Set<string>;
	idFilter?: string;
	diagnosticsOnly: boolean;
	corpusOnly: boolean;
	concurrency: number;
};

/** One unit of work: render `input` under `profile` and store at `key`. */
type Job = {
	/** Display label, e.g. `default :: commonmark/0042`. */
	label: string;
	input: string;
	profile: Profile;
	read(): string | undefined;
	write(html: string): void;
};

type Result =
	| { label: string; status: "written" | "ok" }
	| { label: string; status: "drift"; message: string }
	| { label: string; status: "error"; message: string };

function parseFlags(argv: string[]): Flags {
	const flags: Flags = {
		check: false,
		diagnosticsOnly: false,
		corpusOnly: false,
		concurrency: 12,
	};
	for (const arg of argv) {
		if (arg === "--check") flags.check = true;
		else if (arg === "--diagnostics-only") flags.diagnosticsOnly = true;
		else if (arg === "--corpus-only") flags.corpusOnly = true;
		else if (arg.startsWith("--profile=")) {
			flags.profiles = new Set(arg.slice("--profile=".length).split(","));
		} else if (arg.startsWith("--id=")) {
			flags.idFilter = arg.slice("--id=".length);
		} else if (arg.startsWith("--concurrency=")) {
			flags.concurrency = Math.max(1, Number(arg.slice("--concurrency=".length)));
		} else {
			throw new Error(`Unknown flag: ${arg}`);
		}
	}
	return flags;
}

function profileAllowed(flags: Flags, name: string): boolean {
	return !flags.profiles || flags.profiles.has(name);
}

/** Build the full job list from the corpus manifest and diagnostic suite. */
function collectJobs(flags: Flags): Job[] {
	const jobs: Job[] = [];

	if (!flags.diagnosticsOnly && corpusExists()) {
		const manifest = loadManifest();
		for (const entry of manifest.entries) {
			if (flags.idFilter && !entry.id.includes(flags.idFilter)) continue;
			for (const profileName of entry.profiles) {
				if (!profileAllowed(flags, profileName)) continue;
				const profile = getProfile(profileName);
				jobs.push({
					label: `${profileName} :: ${entry.id}`,
					input: readInput(entry),
					profile,
					read: () => readGolden(profileName, entry.id),
					write: (html) => writeGolden(profileName, entry.id, html),
				});
			}
		}
	}

	if (!flags.corpusOnly) {
		for (const diag of loadDiagnostics()) {
			const id = `${diag.feature}/${diag.name}`;
			if (flags.idFilter && !id.includes(flags.idFilter)) continue;
			const input = fs.readFileSync(diag.inputPath, "utf8");
			for (const profileName of diag.profiles) {
				if (!profileAllowed(flags, profileName)) continue;
				const profile = getProfile(profileName);
				jobs.push({
					label: `${profileName} :: diag/${id}`,
					input,
					profile,
					read: () => readDiagnosticGolden(profileName, diag.feature, diag.name),
					write: (html) =>
						writeDiagnosticGolden(profileName, diag.feature, diag.name, html),
				});
			}
		}
	}

	return jobs;
}

const adapter = new WritrJsAdapter();

/** Render one job, enforcing the empty-output and sync/async parity contracts. */
async function runJob(job: Job, check: boolean): Promise<Result> {
	let html: string;
	try {
		html = await adapter.render(job.input, job.profile);
	} catch (error) {
		// The adapter throws when Writr emits a genuine render error. A legitimate
		// empty result (no error emitted) is not caught here and is a valid golden.
		return {
			label: job.label,
			status: "error",
			message: `render error: ${(error as Error).message}`,
		};
	}

	// Pin the sync/async contract: both paths must agree.
	const sync = adapter.renderSync(job.input, job.profile);
	if (sync !== html) {
		const diff = firstDivergence(html, sync);
		return {
			label: job.label,
			status: "error",
			message: `sync/async render mismatch\n${formatDiff(diff)}`,
		};
	}

	if (check) {
		const existing = job.read();
		if (existing === undefined) {
			return { label: job.label, status: "drift", message: "golden missing" };
		}
		if (existing !== html) {
			const diff = firstDivergence(existing, html);
			return { label: job.label, status: "drift", message: formatDiff(diff) };
		}
		return { label: job.label, status: "ok" };
	}

	job.write(html);
	return { label: job.label, status: "written" };
}

/** Run jobs with a bounded concurrency pool, preserving determinism. */
async function runPool(
	jobs: Job[],
	concurrency: number,
	check: boolean,
): Promise<Result[]> {
	const results: Result[] = new Array(jobs.length);
	let next = 0;
	async function worker(): Promise<void> {
		while (true) {
			const i = next++;
			if (i >= jobs.length) return;
			results[i] = await runJob(jobs[i], check);
		}
	}
	const workers = Array.from({ length: Math.min(concurrency, jobs.length) }, () =>
		worker(),
	);
	await Promise.all(workers);
	return results;
}

/** Capture resolved versions of the plugins that shape the output. */
function writeVersions(): void {
	const here = path.dirname(fileURLToPath(import.meta.url));
	const root = path.resolve(here, "..", "..");
	const packages = [
		"writr",
		"unified",
		"remark-parse",
		"remark-rehype",
		"remark-gfm",
		"remark-github-blockquote-alert",
		"remark-toc",
		"remark-emoji",
		"remark-math",
		"remark-mdx",
		"rehype-raw",
		"rehype-slug",
		"rehype-highlight",
		"rehype-katex",
		"rehype-stringify",
		"katex",
		"highlight.js",
		"lowlight",
	];
	const versions: Record<string, string> = {};
	for (const pkg of packages) {
		try {
			const pkgJson = JSON.parse(
				fs.readFileSync(
					path.join(root, "node_modules", pkg, "package.json"),
					"utf8",
				),
			) as { version: string };
			versions[pkg] = pkgJson.version;
		} catch {
			versions[pkg] = "not-installed";
		}
	}
	fs.writeFileSync(
		VERSIONS_PATH,
		`${JSON.stringify({ capturedAt: new Date().toISOString(), versions }, null, 2)}\n`,
	);
}

async function main(): Promise<void> {
	const flags = parseFlags(process.argv.slice(2));
	const jobs = collectJobs(flags);
	if (jobs.length === 0) {
		console.error(
			"No jobs to run. Has the corpus been fetched (pnpm corpus:fetch) and/or are diagnostics present?",
		);
		process.exit(1);
	}

	console.log(
		`${flags.check ? "Checking" : "Generating"} ${jobs.length} golden(s) with concurrency ${flags.concurrency}...`,
	);
	const results = await runPool(jobs, flags.concurrency, flags.check);

	const errors = results.filter((r) => r.status === "error");
	const drift = results.filter((r) => r.status === "drift");
	const written = results.filter((r) => r.status === "written").length;

	for (const e of errors) console.error(`ERROR  ${e.label}\n  ${e.message}`);
	for (const d of drift) console.error(`DRIFT  ${d.label}\n  ${d.message}`);

	if (!flags.check) {
		writeVersions();
		console.log(`Wrote ${written} golden(s); captured plugin versions.`);
	}

	if (errors.length > 0) {
		console.error(`\n${errors.length} render error(s).`);
		process.exit(1);
	}
	if (flags.check && drift.length > 0) {
		console.error(
			`\n${drift.length} golden(s) drifted from the current engine. Re-run golden:generate to update.`,
		);
		process.exit(1);
	}
	console.log(flags.check ? "All goldens up to date." : "Done.");
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});

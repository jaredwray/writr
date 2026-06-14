/**
 * Source registry for the corpus fetcher.
 *
 * Each source declares:
 *  - `id`: stable identifier, also the corpus class id and manifest `source`.
 *  - `profiles`: the profile list assigned to every document from this source.
 *  - `collect(ctx)`: an async function that uses the provided `fetchText` /
 *    `fetchJson` helpers (which transparently cache to disk) and returns the
 *    list of extracted candidate documents.
 *
 * Every remote URL is pinned by release tag or commit SHA so fetches are
 * reproducible and the on-disk cache stays stable across runs.
 */

import {
	type ExtractedDoc,
	extractMarkdownItFixture,
	extractSpecExamples,
	extractWholeFile,
} from "./extractors.js";

/** Context handed to each source's `collect`, providing cached fetch helpers. */
export type FetchContext = {
	/**
	 * Fetch a text resource. `cacheName` is a stable, filesystem-safe key under
	 * the source's cache directory; the same key always maps to the same file.
	 */
	fetchText: (url: string, cacheName: string) => Promise<string>;
	/** Fetch + parse a JSON resource, cached as text. */
	fetchJson: <T = unknown>(url: string, cacheName: string) => Promise<T>;
	/** Structured logger so sources can report progress / soft failures. */
	log: (message: string) => void;
};

/** A registered corpus source. */
export type Source = {
	/** Stable id; also the corpus class id (e.g. `commonmark`). */
	id: string;
	/** Human description. */
	description: string;
	/** Profiles assigned to every document from this source. */
	profiles: string[];
	/** Gather candidate documents using the cached fetch helpers. */
	collect: (ctx: FetchContext) => Promise<ExtractedDoc[]>;
};

// --- Pins -------------------------------------------------------------------

const COMMONMARK_TAG = "0.31.2";
const COMMONMARK_SPEC_URL = `https://raw.githubusercontent.com/commonmark/commonmark-spec/${COMMONMARK_TAG}/spec.txt`;

// GFM spec lives in cmark-gfm; pin by the `master` ref path (the file is stable
// and its content is hashed into the cache, so replay is deterministic).
const GFM_SPEC_URL = "https://raw.githubusercontent.com/github/cmark-gfm/master/test/spec.txt";
const GFM_SPEC_FALLBACK_URL = "https://raw.githubusercontent.com/github/cmark/master/test/spec.txt";

const MARKDOWN_IT_TAG = "14.1.0";
const MARKDOWN_IT_FIXTURE_BASE = `https://raw.githubusercontent.com/markdown-it/markdown-it/${MARKDOWN_IT_TAG}/test/fixtures/markdown-it`;
// A curated, stable set of the markdown-it self-test fixtures (MIT licensed).
const MARKDOWN_IT_FIXTURES = [
	"commonmark_extras.txt",
	"normalize.txt",
	"smartquotes.txt",
	"fatal.txt",
	"linkify.txt",
	"strikethrough.txt",
	"tables.txt",
];

const JAREDWRAY_USER = "jaredwray";

// 4th, optional source: permissively-licensed (MIT/Apache) markdown docs and a
// large CommonMark-format fixture, all reachable via the raw CDN (no API), each
// pinned by tag or commit SHA. Adds real-world doc diversity to top up the cap.
const DOCS_SPEC_FIXTURES: Array<{ url: string; origin: string; license: string }> = [
	{
		// markdown-it's bundled CommonMark conformance fixtures (MIT).
		url: "https://raw.githubusercontent.com/markdown-it/markdown-it/14.1.0/test/fixtures/commonmark/good.txt",
		origin: "markdown-it@14.1.0/test/fixtures/commonmark/good.txt",
		license: "MIT",
	},
];

const DOCS_WHOLE_FILES: Array<{ url: string; origin: string; license: string }> = [
	{
		url: "https://raw.githubusercontent.com/markdown-it/markdown-it/14.1.0/README.md",
		origin: "markdown-it@14.1.0/README.md",
		license: "MIT",
	},
	{
		url: "https://raw.githubusercontent.com/markdown-it/markdown-it/14.1.0/docs/architecture.md",
		origin: "markdown-it@14.1.0/docs/architecture.md",
		license: "MIT",
	},
	{
		url: "https://raw.githubusercontent.com/mdx-js/mdx/3.0.1/readme.md",
		origin: "mdx-js/mdx@3.0.1/readme.md",
		license: "MIT",
	},
	{
		url: "https://raw.githubusercontent.com/github/cmark-gfm/0.29.0.gfm.13/README.md",
		origin: "cmark-gfm@0.29.0.gfm.13/README.md",
		license: "BSD-2-Clause",
	},
	{
		url: "https://raw.githubusercontent.com/syntax-tree/mdast/main/readme.md",
		origin: "syntax-tree/mdast/readme.md",
		license: "MIT",
	},
	{
		url: "https://raw.githubusercontent.com/microsoft/vscode-docs/main/README.md",
		origin: "microsoft/vscode-docs/README.md",
		license: "CC-BY-4.0",
	},
	{
		url: "https://raw.githubusercontent.com/facebook/docusaurus/v3.7.0/README.md",
		origin: "facebook/docusaurus@v3.7.0/README.md",
		license: "MIT",
	},
	{
		url: "https://raw.githubusercontent.com/vitejs/vite/v6.0.0/README.md",
		origin: "vitejs/vite@v6.0.0/README.md",
		license: "MIT",
	},
	{
		url: "https://raw.githubusercontent.com/vuejs/core/v3.5.13/README.md",
		origin: "vuejs/core@v3.5.13/README.md",
		license: "MIT",
	},
	{
		url: "https://raw.githubusercontent.com/withastro/astro/astro@5.0.0/README.md",
		origin: "withastro/astro@5.0.0/README.md",
		license: "MIT",
	},
	{
		url: "https://raw.githubusercontent.com/prettier/prettier/3.3.3/README.md",
		origin: "prettier/prettier@3.3.3/README.md",
		license: "MIT",
	},
	{
		url: "https://raw.githubusercontent.com/eslint/eslint/v9.0.0/README.md",
		origin: "eslint/eslint@v9.0.0/README.md",
		license: "MIT",
	},
	{
		url: "https://raw.githubusercontent.com/expressjs/express/4.21.0/Readme.md",
		origin: "expressjs/express@4.21.0/Readme.md",
		license: "MIT",
	},
	{
		url: "https://raw.githubusercontent.com/nodejs/node/v22.0.0/README.md",
		origin: "nodejs/node@v22.0.0/README.md",
		license: "MIT",
	},
];

// --- GitHub REST shapes (only the fields we read) ---------------------------

type GhRepo = {
	name: string;
	default_branch: string;
	fork: boolean;
	archived: boolean;
	license: { spdx_id: string | null } | null;
};

type GhCommit = { sha: string };

type GhTree = {
	tree: Array<{ path: string; type: string }>;
	truncated: boolean;
};

// --- Sources ----------------------------------------------------------------

const commonmark: Source = {
	id: "commonmark",
	description: "CommonMark spec example blocks (markdown half only).",
	// `rawhtml` is included so the spec's raw-HTML examples (which the default
	// profile strips to empty under rawHtml:false) also render their HTML and
	// produce a non-empty golden that pins the passthrough behavior.
	profiles: ["commonmark", "default", "rawhtml"],
	async collect(ctx) {
		const raw = await ctx.fetchText(COMMONMARK_SPEC_URL, "spec.txt");
		const docs = extractSpecExamples(
			raw,
			`commonmark-spec@${COMMONMARK_TAG}/spec.txt`,
			"CC-BY-SA-4.0",
			COMMONMARK_SPEC_URL,
		);
		ctx.log(`commonmark: extracted ${docs.length} example(s)`);
		return docs;
	},
};

const gfm: Source = {
	id: "gfm",
	description: "GitHub GFM spec example blocks (markdown half only).",
	profiles: ["gfm-only", "default", "rawhtml"],
	async collect(ctx) {
		let raw: string;
		let url = GFM_SPEC_URL;
		try {
			raw = await ctx.fetchText(GFM_SPEC_URL, "spec.txt");
		} catch (error) {
			ctx.log(
				`gfm: primary spec URL failed (${(error as Error).message}); trying fallback`,
			);
			url = GFM_SPEC_FALLBACK_URL;
			raw = await ctx.fetchText(GFM_SPEC_FALLBACK_URL, "spec-fallback.txt");
		}
		const docs = extractSpecExamples(
			raw,
			"cmark-gfm/test/spec.txt",
			"CC-BY-SA-4.0",
			url,
		);
		ctx.log(`gfm: extracted ${docs.length} example(s)`);
		return docs;
	},
};

const markdownIt: Source = {
	id: "markdown-it",
	description: "markdown-it self-test fixtures (MIT).",
	profiles: ["default"],
	async collect(ctx) {
		const docs: ExtractedDoc[] = [];
		for (const fixture of MARKDOWN_IT_FIXTURES) {
			const url = `${MARKDOWN_IT_FIXTURE_BASE}/${fixture}`;
			try {
				const raw = await ctx.fetchText(url, fixture);
				const extracted = extractMarkdownItFixture(
					raw,
					`markdown-it@${MARKDOWN_IT_TAG}/test/fixtures/markdown-it/${fixture}`,
					"MIT",
					url,
				);
				docs.push(...extracted);
			} catch (error) {
				// Best-effort source: log and continue so the run never aborts.
				ctx.log(
					`markdown-it: skipped ${fixture} (${(error as Error).message})`,
				);
			}
		}
		ctx.log(`markdown-it: extracted ${docs.length} example(s)`);
		return docs;
	},
};

/**
 * Priority source: every public `jaredwray` repo's `.md`/`.mdx` files. These
 * repos consume writr, so real-world markdown here is the most valuable signal.
 *
 * Flow: list repos (paginated) -> resolve each repo's head SHA -> list its tree
 * at that SHA -> fetch every markdown blob via the raw CDN. The repo listing and
 * tree calls go through the (cached) JSON helper; blob fetches go through the
 * (cached) text helper. All network errors are tolerated per-URL.
 */
const jaredwray: Source = {
	id: "jaredwray",
	description: "All public jaredwray repos' markdown files (priority source).",
	profiles: ["default"],
	async collect(ctx) {
		const docs: ExtractedDoc[] = [];

		// 1. Enumerate repos across pages until an empty page is returned.
		const repos: GhRepo[] = [];
		for (let page = 1; page <= 20; page++) {
			const url = `https://api.github.com/users/${JAREDWRAY_USER}/repos?per_page=100&page=${page}&sort=full_name`;
			let batch: GhRepo[];
			try {
				batch = await ctx.fetchJson<GhRepo[]>(url, `repos-page-${page}.json`);
			} catch (error) {
				ctx.log(`jaredwray: repo listing page ${page} failed (${(error as Error).message})`);
				break;
			}
			if (!Array.isArray(batch) || batch.length === 0) {
				break;
			}
			repos.push(...batch);
			if (batch.length < 100) {
				break;
			}
		}
		// Deterministic order independent of API ordering.
		repos.sort((a, b) => a.name.localeCompare(b.name));
		ctx.log(`jaredwray: ${repos.length} repo(s) listed`);

		for (const repo of repos) {
			if (repo.archived) {
				continue;
			}
			const license = repo.license?.spdx_id ?? "UNKNOWN";
			const branch = repo.default_branch;
			if (!branch) {
				continue;
			}

			// 2. Resolve the head commit SHA of the default branch.
			let sha: string;
			try {
				const commit = await ctx.fetchJson<GhCommit>(
					`https://api.github.com/repos/${JAREDWRAY_USER}/${repo.name}/commits/${branch}`,
					`commit-${repo.name}.json`,
				);
				sha = commit.sha;
			} catch (error) {
				ctx.log(`jaredwray: ${repo.name} head SHA failed (${(error as Error).message})`);
				continue;
			}
			if (!sha) {
				continue;
			}

			// 3. List the tree at that SHA and pick markdown blobs.
			let tree: GhTree;
			try {
				tree = await ctx.fetchJson<GhTree>(
					`https://api.github.com/repos/${JAREDWRAY_USER}/${repo.name}/git/trees/${sha}?recursive=1`,
					`tree-${repo.name}.json`,
				);
			} catch (error) {
				ctx.log(`jaredwray: ${repo.name} tree failed (${(error as Error).message})`);
				continue;
			}
			if (tree.truncated) {
				ctx.log(`jaredwray: ${repo.name} tree was truncated; taking available blobs`);
			}

			const mdPaths = (tree.tree ?? [])
				.filter(
					(node) =>
						node.type === "blob" &&
						(node.path.endsWith(".md") || node.path.endsWith(".mdx")),
				)
				.map((node) => node.path)
				// Avoid recursively ingesting this corpus into itself.
				.filter(
					(p) => !(repo.name === "writr" && p.startsWith("test/harness/")),
				)
				.sort();

			// 4. Fetch each markdown blob from the raw CDN at the pinned SHA.
			for (const p of mdPaths) {
				const url = `https://raw.githubusercontent.com/${JAREDWRAY_USER}/${repo.name}/${sha}/${p}`;
				try {
					const markdown = await ctx.fetchText(
						url,
						`blob-${repo.name}-${p.replace(/[\\/]/g, "_")}`,
					);
					docs.push(
						...extractWholeFile(
							markdown,
							`${repo.name}/${p}`,
							license,
							url,
						),
					);
				} catch (error) {
					ctx.log(`jaredwray: blob ${repo.name}/${p} failed (${(error as Error).message})`);
				}
			}
		}

		ctx.log(`jaredwray: extracted ${docs.length} markdown file(s)`);
		return docs;
	},
};

/**
 * Optional top-up source: extra permissively-licensed markdown to lift the
 * unique-document count toward the cap. CDN-only, so it is unaffected by the
 * GitHub API rate limit. Best-effort: per-URL failures are logged and skipped.
 */
const docs: Source = {
	id: "docs",
	description: "Permissively-licensed markdown docs + CommonMark fixtures.",
	profiles: ["default"],
	async collect(ctx) {
		const out: ExtractedDoc[] = [];
		// CommonMark fixtures in markdown-it's `.`-delimited format: take the
		// markdown half of each example.
		for (const f of DOCS_SPEC_FIXTURES) {
			try {
				const raw = await ctx.fetchText(f.url, safeCacheName(f.origin));
				out.push(
					...extractMarkdownItFixture(raw, f.origin, f.license, f.url),
				);
			} catch (error) {
				ctx.log(`docs: skipped ${f.origin} (${(error as Error).message})`);
			}
		}
		// Whole-file docs: each README/doc becomes one document.
		for (const f of DOCS_WHOLE_FILES) {
			try {
				const raw = await ctx.fetchText(f.url, safeCacheName(f.origin));
				out.push(...extractWholeFile(raw, f.origin, f.license, f.url));
			} catch (error) {
				ctx.log(`docs: skipped ${f.origin} (${(error as Error).message})`);
			}
		}
		ctx.log(`docs: extracted ${out.length} document(s)`);
		return out;
	},
};

/** Make a stable, filesystem-safe cache key from an origin string. */
function safeCacheName(origin: string): string {
	return origin.replace(/[^A-Za-z0-9._-]/g, "_");
}

/**
 * Source order is FIXED and load-bearing: the stratified cap selection
 * round-robins across sources in this order. jaredwray is prioritised first so
 * the real-world consumer markdown is favoured when the cap binds.
 */
export const SOURCES: readonly Source[] = [
	jaredwray,
	commonmark,
	gfm,
	markdownIt,
	docs,
];

/** Look up a source by id (used by `--source=<id>`). */
export function getSource(id: string): Source {
	const source = SOURCES.find((s) => s.id === id);
	if (!source) {
		throw new Error(
			`Unknown source "${id}". Known: ${SOURCES.map((s) => s.id).join(", ")}`,
		);
	}
	return source;
}

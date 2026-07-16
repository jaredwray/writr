// Browser-compatibility smoke test for the writr-rs wasm build.
//
// 1. Bundles crates/writr-node/browser.js with esbuild (as a user's bundler
//    would), leaving the .wasm to be fetched at runtime.
// 2. Serves the bundle + wasm over HTTP with NO cross-origin-isolation
//    headers — the single-threaded build must not need SharedArrayBuffer.
// 3. Drives headless Chromium via playwright-core, renders a feature-heavy
//    document set in-page, and byte-compares every result against the native
//    binding's output for the same (input, options).
//
// Prerequisites: `pnpm build:rs`, `pnpm build:rs:wasm`, and `pnpm install`
// in crates/writr-node. Chromium is resolved from $CHROMIUM_BIN, the
// Playwright browser store, or the preinstalled /opt/pw-browsers/chromium.
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const nodeDir = join(root, "crates", "writr-node");
const require = createRequire(join(nodeDir, "package.json"));
const { chromium } = require("playwright-core");
const native = require(join(nodeDir, "index.js"));

// --- 1. bundle ---------------------------------------------------------------
// esbuild is a devDependency of crates/writr-node (a fresh root install does
// not expose transitive bins); fall back to a repo-root or PATH install.
const esbuild = [
	join(nodeDir, "node_modules", ".bin", "esbuild"),
	join(root, "..", "node_modules", ".bin", "esbuild"),
].find((path) => existsSync(path)) ?? "esbuild";
const bundle = join(nodeDir, "node_modules", ".writr-browser-smoke.mjs");
execSync(
	`${esbuild} ${join(nodeDir, "browser.js")} --bundle --format=esm ` +
		`--platform=browser --external:./writr-node.wasm32-wasi.wasm ` +
		`--outfile=${bundle}`,
	{ stdio: "inherit" },
);

// --- 2. serve (deliberately WITHOUT COOP/COEP headers) -------------------------
const types = {
	".html": "text/html",
	".js": "text/javascript",
	".mjs": "text/javascript",
	".wasm": "application/wasm",
};
const routes = {
	"/": null,
	"/writr.js": bundle,
	"/writr-node.wasm32-wasi.wasm": join(nodeDir, "writr-node.wasm32-wasi.wasm"),
};
const server = createServer((req, res) => {
	const path = req.url.split("?")[0];
	if (!(path in routes)) {
		res.writeHead(404).end("not found");
		return;
	}
	if (path === "/") {
		res.writeHead(200, { "content-type": "text/html" });
		res.end('<!doctype html><meta charset="utf-8"><title>writr-rs</title>');
		return;
	}
	const file = routes[path];
	res.writeHead(200, { "content-type": types[extname(file)] ?? "text/plain" });
	res.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

// --- 3. drive Chromium ---------------------------------------------------------
const cases = [
	{ id: "heading+slug", input: "# Hello World", options: {} },
	{
		id: "gfm",
		input:
			"| a | b |\n| :- | -: |\n| 1 | 2 |\n\n~~gone~~ visit https://example.com\n\n- [x] done\n",
		options: {},
	},
	{
		id: "emoji+toc",
		input: "# Contents\n\n## One :rocket:\n\ntext",
		options: { toc: true },
	},
	{ id: "highlight", input: "```ts\nconst x: number = 1;\n```", options: {} },
	{ id: "math", input: "Euler: $e^{i\\pi}+1=0$", options: {} },
	{ id: "math-display", input: "$$\\frac{a}{b}$$", options: {} },
	{
		id: "raw-html",
		input: "a <b>bold</b> <div>block</div>",
		options: { rawHtml: true },
	},
	{
		id: "commonmark-ish",
		input: "~~x~~ :tada:",
		options: { gfm: false, emoji: false, slug: false },
	},
	{ id: "alerts", input: "> [!NOTE]\n> Useful information.", options: {} },
	{
		id: "footnotes",
		input: "Here is a footnote reference,[^1]\n\n[^1]: Here is the footnote.",
		options: {},
	},
];

async function launchChromium() {
	const explicit = process.env.CHROMIUM_BIN;
	const candidates = [explicit, "/opt/pw-browsers/chromium"].filter(
		(path) => path && existsSync(path),
	);
	for (const executablePath of candidates) {
		try {
			return await chromium.launch({ executablePath });
		} catch {
			// fall through to the Playwright browser store
		}
	}
	return chromium.launch();
}

const browser = await launchChromium();
const page = await browser.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error)));
await page.goto(`${origin}/`);
const results = await page.evaluate(async (cases) => {
	const writr = await import("/writr.js");
	const out = {
		engineVersion: writr.engineVersion(),
		crossOriginIsolated: globalThis.crossOriginIsolated,
		rendered: {},
	};
	for (const c of cases) {
		out.rendered[c.id] = writr.render(c.input, c.options);
	}
	out.async = await writr.renderAsync("**async works**", {});
	return out;
}, cases);

let failures = 0;
for (const c of cases) {
	const expected = native.render(c.input, c.options);
	const actual = results.rendered[c.id];
	if (actual === expected) {
		console.log(`  ok ${c.id}`);
	} else {
		failures += 1;
		console.log(
			`FAIL ${c.id}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`,
		);
	}
}
const expectedAsync = native.render("**async works**", {});
if (results.async === expectedAsync) {
	console.log("  ok renderAsync");
} else {
	failures += 1;
	console.log(`FAIL renderAsync: ${JSON.stringify(results.async)}`);
}
console.log(`engineVersion (browser): ${results.engineVersion}`);
if (results.crossOriginIsolated) {
	failures += 1;
	console.log(
		"FAIL page ended up cross-origin isolated — the no-COOP/COEP claim went untested",
	);
}
if (pageErrors.length > 0) {
	failures += 1;
	console.log(`page errors: ${pageErrors.join("\n")}`);
}

await browser.close();
server.close();
if (failures > 0) {
	console.log(`\n${failures} FAILURES`);
	process.exit(1);
}
console.log("\nAll browser checks passed (no cross-origin isolation needed).");

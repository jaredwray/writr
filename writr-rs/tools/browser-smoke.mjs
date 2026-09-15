// Chromium executes the same JS-derived fixtures and API contract as Node.
import { execFileSync } from "node:child_process";
import {
	existsSync,
	readFileSync,
	writeFileSync,
	mkdirSync,
	appendFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const nodeDir = join(root, "writr-rs/crates/writr-node");
const require = createRequire(join(nodeDir, "package.json"));
const { chromium } = require("playwright-core");
const bundle = join(nodeDir, "node_modules/.writr-browser-smoke.mjs");
require("esbuild").buildSync({
	entryPoints: [join(root, "test/bindings/browser-entry.mjs")],
	bundle: true,
	format: "esm",
	platform: "browser",
	external: ["./writr-node.wasm32-wasi.wasm"],
	outfile: bundle,
});
const fixture = JSON.parse(
	readFileSync(join(root, "test/harness/exact/outcomes.json"), "utf8"),
);
const routes = {
	"/contract.mjs": { file: bundle, type: "text/javascript" },
	"/writr-node.wasm32-wasi.wasm": {
		file: join(nodeDir, "writr-node.wasm32-wasi.wasm"),
		type: "application/wasm",
	},
};
const server = createServer((req, res) => {
	if (req.url === "/") {
		res.writeHead(200, { "content-type": "text/html" });
		res.end('<!doctype html><meta charset="utf-8"><title>Writr parity</title>');
		return;
	}
	const route = routes[req.url];
	if (!route) {
		res.writeHead(404).end();
		return;
	}
	res.writeHead(200, { "content-type": route.type });
	res.end(readFileSync(route.file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let browser;
let timer;
const progress = [];
try {
	const explicit = process.env.CHROMIUM_BIN;
	browser = await chromium.launch(
		explicit && existsSync(explicit) ? { executablePath: explicit } : {},
	);
	const page = await browser.newPage();
	page.on("console", (message) => {
		if (message.text().startsWith("WRITR_PROGRESS ")) {
			const event = JSON.parse(message.text().slice(15));
			progress.push(event);
		}
	});
	const errors = [];
	page.on("pageerror", (e) => errors.push(String(e)));
	await page.goto(`http://127.0.0.1:${server.address().port}/`);
	const report = await Promise.race([
		page.evaluate(async (fixture) => {
			const contract = await import("/contract.mjs");
			const report = await contract.check(fixture);
			return { ...report, crossOriginIsolated: globalThis.crossOriginIsolated };
		}, fixture),
		new Promise((_, reject) => {
			timer = setTimeout(
				() => reject(new Error("Browser external deadline exceeded")),
				180_000,
			);
		}),
	]);
	report.suite = "bindings";
	report.mode = "chromium";
	report.browser = browser.version();
	report.commit = execFileSync("git", ["rev-parse", "HEAD"], {
		cwd: root,
		encoding: "utf8",
	}).trim();
	report.versions = fixture.versions;
	report.results.push({
		api: "environment",
		id: "no-COOP-COEP",
		passed: !report.crossOriginIsolated,
	});
	for (const error of errors)
		report.results.push({
			api: "environment",
			id: "pageerror",
			passed: false,
			error,
		});
	const dir = process.env.WRITR_REPORT_DIR ?? join(root, "test-output/parity");
	mkdirSync(dir, { recursive: true });
	writeFileSync(
		join(dir, "bindings-chromium.json"),
		JSON.stringify(report, null, 2) + "\n",
	);
	const failures = report.results.filter((r) => !r.passed);
	const summary = `Chromium ${report.browser}: ${report.results.length - failures.length}/${report.results.length} API executions passed against shared JS fixtures; crossOriginIsolated=${report.crossOriginIsolated}`;
	console.log(summary);
	if (process.env.GITHUB_STEP_SUMMARY)
		appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + "\n\n");
	if (failures.length) {
		console.error(JSON.stringify(failures, null, 2));
		process.exitCode = 1;
	}
} catch (error) {
	const dir = process.env.WRITR_REPORT_DIR ?? join(root, "test-output/parity");
	mkdirSync(dir, { recursive: true });
	const completed = progress.filter((p) => p.phase === "complete");
	const last = progress.at(-1);
	writeFileSync(
		join(dir, "bindings-chromium.json"),
		JSON.stringify(
			{
				suite: "bindings",
				mode: "chromium",
				browser: browser?.version(),
				commit: execFileSync("git", ["rev-parse", "HEAD"], {
					cwd: root,
					encoding: "utf8",
				}).trim(),
				versions: fixture.versions,
				results: [
					...completed,
					{
						api: last?.api ?? "environment",
						id: last?.id ?? "startup",
						passed: false,
						error: String(error),
					},
				],
			},
			null,
			2,
		) + "\n",
	);
	console.error(error);
	console.error("Last progress:", last);
	process.exitCode = 1;
} finally {
	clearTimeout(timer);
	if (browser) await browser.close();
	server.close();
}

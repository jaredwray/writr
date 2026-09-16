/** Reproducible current Writr JS/native comparison. Run after pnpm build/build:rs. */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash, type BinaryLike } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { Bench, type Statistics } from "tinybench";
import { benchmarkContents } from "./benchmark-contents.js";
import type { RenderOptions } from "../src/types.js";

type Workload = {
	name: string;
	documents: string[];
	options: RenderOptions;
	source: string;
};
type Measurement = {
	workload: string;
	method: string;
	trial: number;
	calls: number;
	documentsPerCall: number;
	meanMsPerCall: number;
	meanUsPerDocument: number;
	documentsPerSecond: number;
	latency: Statistics;
};
type ExactFixtures = {
	cases: { profile?: string; input: string; outcome: { kind: string } }[];
};

const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
const output = path.resolve("test-output/benchmarks/native-vs-js");
fs.mkdirSync(output, { recursive: true });
const defaults = {
	emoji: true,
	toc: true,
	slug: true,
	highlight: true,
	gfm: true,
	math: true,
	mdx: false,
	rawHtml: false,
	caching: false,
};
const minimal = Object.fromEntries(
	Object.keys(defaults).map((k) => [k, false]),
);
const fixtures: ExactFixtures = JSON.parse(
	fs.readFileSync("test/harness/exact/outcomes.json", "utf8"),
);
const workloads: Workload[] = [
	{
		name: "Markdown minimal",
		documents: benchmarkContents,
		options: minimal,
		source: "benchmark/benchmark-contents.ts, all plugins off",
	},
	{
		name: "Markdown default",
		documents: benchmarkContents,
		options: defaults,
		source: "benchmark/benchmark-contents.ts, default feature flags",
	},
	{
		name: "MDX regressions",
		documents: fixtures.cases
			.filter((c) => c.profile === "mdx" && c.outcome.kind === "success")
			.map((c) => c.input),
		options: { ...defaults, mdx: true },
		source: "successful mdx-profile exact fixtures (small grammar cases)",
	},
	{
		name: "Math",
		documents: Array.from(
			{ length: 8 },
			(_, i) => String.raw`# Formula document ${i + 1}

This diagnostic workload measures uncached formula rendering. Let $x_{${i + 1}} = ${i + 2}$.

$$\int_0^1 x^{${i + 1}}\,dx = \frac{1}{${i + 2}}$$

A second identity is $e^{i\pi} + 1 = 0$. Every document uses the same default feature flags.
`,
		),
		options: defaults,
		source: "eight deterministic synthetic documents, three formulas each",
	},
];
const methods = [
	"JS sync",
	"Rust sync",
	"JS async sequential",
	"Rust async sequential",
	"Rust batch",
	"Rust packed batch",
] as const;
const trials = 5;
const time = 750;
const warmupTime = 150;
const sha = () =>
	execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const digest = (value: BinaryLike) =>
	createHash("sha256").update(value).digest("hex");
const median = (values: number[]) =>
	[...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
let consumed = 0;

if (process.argv[2] === "--trial") {
	const trial = Number(process.argv[3]);
	const { Writr } = await import("../dist/writr.mjs");
	const require = createRequire(import.meta.url);
	const native =
		require("../writr-rs/crates/writr-node/index.js") as typeof import("../writr-rs/crates/writr-node/index.js");
	assert(
		Object.keys(require.cache).some((f) => f.endsWith("writr-node.node")),
		"Native artifact must load",
	);
	assert(
		!Object.keys(require.cache).some((f) => f.endsWith("writr-node.wasi.cjs")),
		"WASM must not load",
	);
	const rows: Measurement[] = [];
	// Reverse workload order on alternate processes and rotate engine order.
	for (const w of trial % 2 ? [...workloads].reverse() : workloads) {
		assert(w.documents.length > 0, `${w.name}: workload is empty`);
		const js = new Writr({ renderOptions: w.options });
		let emitted: unknown;
		js.on("error", (error) => {
			emitted = error;
		});
		function jsSync(doc: string) {
			emitted = undefined;
			js.content = doc;
			const html = js.renderSync();
			if (emitted) throw emitted;
			return html;
		}
		async function jsAsync(doc: string) {
			emitted = undefined;
			js.content = doc;
			const html = await js.render();
			if (emitted) throw emitted;
			return html;
		}
		const expected = w.documents.map(jsSync);
		const offsets = new Uint32Array(w.documents.length + 1);
		const buffers = w.documents.map((doc, i) => {
			const b = Buffer.from(doc);
			offsets[i + 1] = offsets[i] + b.length;
			return b;
		});
		const input = Buffer.concat(buffers);
		for (let i = 0; i < w.documents.length; i++) {
			const doc = w.documents[i];
			assert.equal(await jsAsync(doc), expected[i], `${w.name}/${i}: JS async`);
			assert.equal(
				native.render(doc, w.options),
				expected[i],
				`${w.name}/${i}: Rust sync`,
			);
			assert.equal(
				await native.renderAsync(doc, w.options),
				expected[i],
				`${w.name}/${i}: Rust async`,
			);
		}
		assert.deepEqual(
			native.renderBatch(w.documents, w.options),
			expected,
			w.name,
		);
		const packed = native.renderBatchBuffer(input, offsets, w.options);
		assert.deepEqual(
			expected,
			expected.map((_, i) =>
				packed.html
					.subarray(packed.offsets[i], packed.offsets[i + 1])
					.toString("utf8"),
			),
			w.name,
		);
		const operations = {
			"JS sync": () => {
				for (const doc of w.documents) consumed += jsSync(doc).length;
			},
			"Rust sync": () => {
				for (const doc of w.documents)
					consumed += native.render(doc, w.options).length;
			},
			"JS async sequential": async () => {
				for (const doc of w.documents) consumed += (await jsAsync(doc)).length;
			},
			"Rust async sequential": async () => {
				for (const doc of w.documents)
					consumed += (await native.renderAsync(doc, w.options)).length;
			},
			"Rust batch": () => {
				for (const html of native.renderBatch(w.documents, w.options))
					consumed += html.length;
			},
			"Rust packed batch": () => {
				consumed += native.renderBatchBuffer(input, offsets, w.options).html
					.length;
			},
		};
		const bench = new Bench({
			time,
			iterations: 3,
			warmupTime,
			warmupIterations: 1,
			retainSamples: false,
		});
		const order = [
			...methods.slice(trial % methods.length),
			...methods.slice(0, trial % methods.length),
		];
		for (const name of order) bench.add(name, operations[name]);
		await bench.run();
		for (const task of bench.tasks) {
			const result = task.result;
			assert(
				result.state === "completed",
				`${w.name}/${task.name}: ${JSON.stringify(result)}`,
			);
			const latency = result.latency;
			rows.push({
				workload: w.name,
				method: task.name,
				trial,
				calls: task.runs,
				documentsPerCall: w.documents.length,
				meanMsPerCall: latency.mean,
				meanUsPerDocument: (latency.mean * 1000) / w.documents.length,
				documentsPerSecond: (w.documents.length * 1000) / latency.mean,
				latency,
			});
		}
		console.log(
			`Trial ${trial + 1}/${trials}: ${w.name}, ${w.documents.length} documents, all six API paths verified and measured`,
		);
	}
	fs.writeFileSync(
		path.join(output, `trial-${trial + 1}.json`),
		JSON.stringify({ rows, consumed }, null, 2) + "\n",
	);
} else {
	assert(
		!process.env.WRITR_RS_FORCE_WASM || process.env.WRITR_RS_FORCE_WASM === "0",
		"Run in native mode",
	);
	const startedAt = new Date().toISOString();
	const rows: Measurement[] = [];
	for (let trial = 0; trial < trials; trial++) {
		const child = spawnSync(
			process.execPath,
			[
				...process.execArgv,
				fileURLToPath(import.meta.url),
				"--trial",
				String(trial),
			],
			{
				stdio: "inherit",
				timeout: 240_000,
				env: {
					...process.env,
					WRITR_RS_FORCE_WASM: "0",
					RAYON_NUM_THREADS: "2",
					UV_THREADPOOL_SIZE: "4",
				},
			},
		);
		assert.equal(
			child.status,
			0,
			`Trial ${trial + 1} failed: ${child.error ?? child.signal}`,
		);
		rows.push(
			...JSON.parse(
				fs.readFileSync(path.join(output, `trial-${trial + 1}.json`), "utf8"),
			).rows,
		);
	}
	const summary = workloads.flatMap((w) =>
		methods.map((method) => {
			const measurements = rows.filter(
				(r) => r.workload === w.name && r.method === method,
			);
			return {
				workload: w.name,
				method,
				medianUsPerDocument: median(
					measurements.map((r) => r.meanUsPerDocument),
				),
				medianDocumentsPerSecond: median(
					measurements.map((r) => r.documentsPerSecond),
				),
				minUsPerDocument: Math.min(
					...measurements.map((r) => r.meanUsPerDocument),
				),
				maxUsPerDocument: Math.max(
					...measurements.map((r) => r.meanUsPerDocument),
				),
			};
		}),
	);
	const report = {
		startedAt,
		finishedAt: new Date().toISOString(),
		commit: sha(),
		node: process.version,
		cpu: os.cpus()[0].model,
		logicalCpus: os.cpus().length,
		availableParallelism: os.availableParallelism(),
		platform: `${os.platform()} ${os.arch()} ${os.release()}`,
		rayonThreads: 2,
		uvThreadpoolSize: 4,
		rust: execFileSync("rustc", ["--version"], { encoding: "utf8" }).trim(),
		nativeArtifactSha256: digest(
			fs.readFileSync("writr-rs/crates/writr-node/writr-node.node"),
		),
		jsArtifactSha256: digest(fs.readFileSync("dist/writr.mjs")),
		trials,
		timePerTaskMs: time,
		warmupPerTaskMs: warmupTime,
		build: "cargo release, thin LTO, 1 codegen unit; no PGO",
		workloads: workloads.map((w) => ({
			...w,
			count: w.documents.length,
			totalBytes: w.documents.reduce((n, d) => n + Buffer.byteLength(d), 0),
			inputSha256: digest(JSON.stringify(w.documents)),
		})),
		summary,
		rows,
	};
	fs.writeFileSync(
		path.join(output, "results.json"),
		JSON.stringify(report, null, 2) + "\n",
	);
	const lines = [
		"# Native Rust vs current Writr JavaScript",
		"",
		`Commit: \`${report.commit}\`; ${report.node}; ${report.platform}; ${report.cpu}; ${report.logicalCpus} logical CPUs.`,
		"",
		"Five fresh Node processes, sequential tests, alternating workload order and rotating engine order. Every API path passes exact HTML comparisons before timing. Results are medians of five per-run mean times, with min/max across runs. Each timed iteration renders the entire fixed workload in order.",
		"",
		"Caches disabled on both engines. Lazy initialization and JIT are warmed before measurement; module loading/build/first-render latency are excluded. JS reuses one configured Writr instance and includes its public wrapper/hooks/frontmatter handling; native includes N-API conversion. Sequential async awaits one document at a time. Rust batches use two Rayon threads. Packed input preparation and output decoding are excluded, representing a bytes-in/bytes-out caller. The JS engine has no equivalent parallel batch API, so its sync loop is the batch baseline.",
		"",
		"| Workload | Documents / bytes | JS sync µs/doc | Rust sync µs/doc | Rust speedup | Rust batch docs/s | Batch vs JS loop |",
		"|---|---:|---:|---:|---:|---:|---:|",
	];
	for (const w of report.workloads) {
		const get = (method: (typeof methods)[number]) => {
			const result = summary.find(
				(r) => r.workload === w.name && r.method === method,
			);
			assert(result, `${w.name}/${method}: missing measurements`);
			return result;
		};
		const js = get("JS sync"),
			rust = get("Rust sync"),
			batch = get("Rust batch");
		lines.push(
			`| ${w.name} | ${w.count} / ${w.totalBytes} | ${js.medianUsPerDocument.toFixed(1)} | ${rust.medianUsPerDocument.toFixed(1)} | ${(js.medianUsPerDocument / rust.medianUsPerDocument).toFixed(2)}× | ${Math.round(batch.medianDocumentsPerSecond)} | ${(batch.medianDocumentsPerSecond / js.medianDocumentsPerSecond).toFixed(2)}× |`,
		);
	}
	lines.push(
		"",
		"## All measured paths",
		"",
		"| Workload | API | Median µs/doc | Run range µs/doc | Docs/s |",
		"|---|---|---:|---:|---:|",
	);
	for (const r of summary)
		lines.push(
			`| ${r.workload} | ${r.method} | ${r.medianUsPerDocument.toFixed(1)} | ${r.minUsPerDocument.toFixed(1)}–${r.maxUsPerDocument.toFixed(1)} | ${Math.round(r.medianDocumentsPerSecond)} |`,
		);
	lines.push(
		"",
		"MDX uses small success fixtures, and math uses synthetic diagnostics; neither represents a full production traffic distribution. Shared VM results can vary. These measurements cover throughput/average render cost, not cold start, concurrent-service latency, memory retention, or output-cache hits.",
		"",
		"Reproduce after `pnpm build` and `pnpm build:rs`: `pnpm exec tsx benchmark/benchmark-native-comparison.ts`. Raw inputs, flags, artifact hashes and all trial statistics are in `results.json`.",
		"",
	);
	fs.writeFileSync(path.join(output, "README.md"), lines.join("\n"));
	console.log(lines.join("\n"));
}

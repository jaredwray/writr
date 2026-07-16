import { createRequire } from "node:module";
import { tinybenchPrinter } from "@monstermann/tinybench-pretty-printer";
import MarkdownIt from "markdown-it";
import { marked } from "marked";
import { Bench } from "tinybench";
import { Writr } from "../src/writr.js";
import { benchmarkContents } from "./benchmark-contents.js";

// The Rust engine ships as a CommonJS napi binding; build it first with
// `pnpm build:rs` (and `pnpm build:rs:wasm` for the wasm rows).
const require = createRequire(import.meta.url);
const writrRs = require("../writr-rs/crates/writr-node/index.js") as {
	render(input: string, options?: Record<string, boolean>): string;
	renderAsync(
		input: string,
		options?: Record<string, boolean>,
	): Promise<string>;
	renderBatch(
		inputs: string[],
		options?: Record<string, boolean>,
	): string[];
	renderBatchBuffer(
		input: Buffer,
		offsets: Uint32Array,
		options?: Record<string, boolean>,
	): { html: Buffer; offsets: Uint32Array };
	engineVersion(): string;
};

const minimalOptions = {
	caching: false,
	emoji: false,
	toc: false,
	slug: false,
	highlight: false,
	gfm: false,
	math: false,
	mdx: false,
};

const defaultOptions = { caching: false };

const writrMinimal = new Writr({ renderOptions: { ...minimalOptions } });
const writrDefault = new Writr({ renderOptions: { ...defaultOptions } });

marked.setOptions({ gfm: true });
const markdownIt = new MarkdownIt();

function pick(): string {
	return benchmarkContents[
		Math.floor(Math.random() * benchmarkContents.length)
	];
}

console.log(`engine: ${writrRs.engineVersion()}`);
console.log("");

const minimal = new Bench({
	name: "Minimal profile (all plugins off), uncached",
	iterations: 10_000,
});

minimal.add("writr-rs (Sync)", () => {
	writrRs.render(pick(), minimalOptions);
});

minimal.add("writr-rs (Async)", async () => {
	await writrRs.renderAsync(pick(), minimalOptions);
});

minimal.add("Writr JS (Sync)", () => {
	writrMinimal.content = pick();
	writrMinimal.renderSync();
});

minimal.add("marked", () => {
	marked.parse(pick());
});

minimal.add("markdown-it", () => {
	markdownIt.render(pick());
});

await minimal.run();
console.log(tinybenchPrinter.toMarkdown(minimal));
console.log("");

const standard = new Bench({
	name: "Default profile (gfm/emoji/toc/slug/highlight/math), uncached",
	iterations: 1000,
});

standard.add("writr-rs (Sync)", () => {
	writrRs.render(pick(), defaultOptions);
});

standard.add("writr-rs (Async)", async () => {
	await writrRs.renderAsync(pick(), defaultOptions);
});

standard.add("Writr JS (Sync)", () => {
	writrDefault.content = pick();
	writrDefault.renderSync();
});

await standard.run();
console.log(tinybenchPrinter.toMarkdown(standard));
console.log("");

// Multi-document throughput: one writr-rs call renders the whole corpus
// across all cores; the JS engines can only loop single-threaded.
const corpus = [...benchmarkContents];
const batch = new Bench({
	name: `Whole-corpus throughput (${corpus.length} docs/op), minimal profile`,
	iterations: 50,
});

batch.add("writr-rs renderBatch (all cores)", () => {
	writrRs.renderBatch(corpus, minimalOptions);
});

// Packed bytes-in/bytes-out path: one V8→native handoff each way, no
// per-document JS strings. Packing happens outside the loop — this models
// the disk pipeline (docs read as Buffers, HTML written as Buffers); a
// caller starting from JS strings should use renderBatch instead.
const packedBuffers = corpus.map((doc) => Buffer.from(doc, "utf8"));
const packedOffsets = new Uint32Array(packedBuffers.length + 1);
let packedAt = 0;
packedBuffers.forEach((buffer, index) => {
	packedOffsets[index] = packedAt;
	packedAt += buffer.length;
});
packedOffsets[packedBuffers.length] = packedAt;
const packedCorpus = Buffer.concat(packedBuffers, packedAt);

batch.add("writr-rs renderBatchBuffer (bytes in/out, all cores)", () => {
	writrRs.renderBatchBuffer(packedCorpus, packedOffsets, minimalOptions);
});

batch.add("writr-rs render loop (1 core)", () => {
	for (const doc of corpus) {
		writrRs.render(doc, minimalOptions);
	}
});

batch.add("markdown-it loop", () => {
	for (const doc of corpus) {
		markdownIt.render(doc);
	}
});

batch.add("marked loop", () => {
	for (const doc of corpus) {
		marked.parse(doc);
	}
});

await batch.run();
console.log(tinybenchPrinter.toMarkdown(batch));
console.log(
	`(${corpus.length} documents per op — multiply ops/sec by ${corpus.length} for docs/sec)`,
);
console.log("");

const batchDefault = new Bench({
	name: `Whole-corpus throughput (${corpus.length} docs/op), default profile`,
	iterations: 20,
});

batchDefault.add("writr-rs renderBatch (all cores)", () => {
	writrRs.renderBatch(corpus, defaultOptions);
});

await batchDefault.run();
console.log(tinybenchPrinter.toMarkdown(batchDefault));
console.log("");

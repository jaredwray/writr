import fs from "node:fs";
import { tinybenchPrinter } from "@monstermann/tinybench-pretty-printer";
import { Bench } from "tinybench";
import { marked } from "marked";
import MarkdownIt from "markdown-it";
import { Writr } from "../src/writr.js";
import { benchmarkContents } from "./benchmark-contents.js";

const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };

const bench = new Bench({ name: `Writr v${pkg.version} Render`, iterations: 10_000 });

const writr = new Writr({ renderOptions: { caching: false } });
const writrCached = new Writr({ renderOptions: { caching: true } });

// Configure marked with GFM support
marked.setOptions({ gfm: true });

// Initialize markdown-it with default settings
const markdownIt = new MarkdownIt();

bench.add("render (Async)", async () => {
	writr.content = benchmarkContents[Math.floor(Math.random() * benchmarkContents.length)];
	await writr.render();
});

bench.add("render (Async) (cached)", async () => {
	writr.content = benchmarkContents[Math.floor(Math.random() * benchmarkContents.length)];
	await writrCached.render();
});

bench.add("render (Sync)", () => {
	writr.content = benchmarkContents[Math.floor(Math.random() * benchmarkContents.length)];
	writr.renderSync();
});

bench.add("render (Sync) (cached)", () => {
	writr.content = benchmarkContents[Math.floor(Math.random() * benchmarkContents.length)];
	writrCached.renderSync();
});

bench.add("marked", () => {
	const content = benchmarkContents[Math.floor(Math.random() * benchmarkContents.length)];
	marked.parse(content);
});

bench.add("markdown-it", () => {
	const content = benchmarkContents[Math.floor(Math.random() * benchmarkContents.length)];
	markdownIt.render(content);
});

await bench.run();

console.log(tinybenchPrinter.toMarkdown(bench));
console.log("");

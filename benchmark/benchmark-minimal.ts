import fs from "node:fs";
import { tinybenchPrinter } from "@monstermann/tinybench-pretty-printer";
import { Bench } from "tinybench";
import { marked } from "marked";
import MarkdownIt from "markdown-it";
import { Writr } from "../src/writr.js";
import { benchmarkContents } from "./benchmark-contents.js";

const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };

const bench = new Bench({ name: `Writr v${pkg.version} Render`, iterations: 10_000 });

const writrMinimal = new Writr({
	renderOptions: {
		caching: false,
		emoji: false,
		toc: false,
		slug: false,
		highlight: false,
		gfm: false,
		math: false,
		mdx: false,
	},
});
const writrMinimalCached = new Writr({
	renderOptions: {
		caching: true,
		emoji: false,
		toc: false,
		slug: false,
		highlight: false,
		gfm: true,
		math: false,
		mdx: false,
	},
});

// Configure marked with GFM support
marked.setOptions({ gfm: true });

// Initialize markdown-it with default settings
const markdownIt = new MarkdownIt();

bench.add("Writr (Async)", async () => {
	writrMinimal.content = benchmarkContents[Math.floor(Math.random() * benchmarkContents.length)];
	await writrMinimal.render();
});

bench.add("Writr (Sync)", () => {
	writrMinimal.content = benchmarkContents[Math.floor(Math.random() * benchmarkContents.length)];
	writrMinimal.renderSync();
});

bench.add("Writr (Async) (Caching)", async () => {
	writrMinimalCached.content = benchmarkContents[Math.floor(Math.random() * benchmarkContents.length)];
	await writrMinimalCached.render();
});

bench.add("Writr (Sync) (Caching)", () => {
	writrMinimalCached.content = benchmarkContents[Math.floor(Math.random() * benchmarkContents.length)];
	writrMinimalCached.renderSync();
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

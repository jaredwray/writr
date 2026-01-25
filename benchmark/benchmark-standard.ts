import fs from "node:fs";
import { tinybenchPrinter } from "@monstermann/tinybench-pretty-printer";
import { Bench } from "tinybench";
import { Writr } from "../src/writr.js";
import { benchmarkContents } from "./benchmark-contents.js";

const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };

const bench = new Bench({ name: `Writr v${pkg.version} Render`, iterations: 10_000 });

const writr = new Writr({ renderOptions: { caching: false } });
const writrCached = new Writr({ renderOptions: { caching: true } });

bench.add("Writr (Async)", async () => {
	writr.content = benchmarkContents[Math.floor(Math.random() * benchmarkContents.length)];
	await writr.render();
});

bench.add("Writr (Async) (Caching)", async () => {
	writr.content = benchmarkContents[Math.floor(Math.random() * benchmarkContents.length)];
	await writrCached.render();
});

bench.add("Writr (Sync)", () => {
	writr.content = benchmarkContents[Math.floor(Math.random() * benchmarkContents.length)];
	writr.renderSync();
});

bench.add("Writr (Sync) (Caching)", () => {
	writr.content = benchmarkContents[Math.floor(Math.random() * benchmarkContents.length)];
	writrCached.renderSync();
});

await bench.run();

console.log(tinybenchPrinter.toMarkdown(bench));
console.log("");

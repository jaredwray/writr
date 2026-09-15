import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { VERSIONS_PATH } from "./paths.js";
const require = createRequire(import.meta.url);
const packages = [
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
	"property-information",
	"hast-util-to-html",
	"hast-util-raw",
	"mdast-util-to-hast",
	"micromark",
	"parse5",
];
function version(name: string) {
	const parents = [
		require,
		...[
			"rehype-katex",
			"rehype-highlight",
			"rehype-raw",
			"rehype-stringify",
			"remark-parse",
			"remark-rehype",
		].map((p) => createRequire(require.resolve(p))),
	];
	for (const resolve of parents) {
		try {
			let dir = path.dirname(resolve.resolve(name));
			for (;;) {
				const file = path.join(dir, "package.json");
				if (fs.existsSync(file)) {
					const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
					if (pkg.name === name) return pkg.version as string;
				}
				const parent = path.dirname(dir);
				if (parent === dir) break;
				dir = parent;
			}
		} catch {
			/* Try the dependency's actual parent resolution. */
		}
	}
	throw new Error(`Oracle dependency not installed: ${name}`);
}
export function oracleVersions(): Record<string, string> {
	return Object.fromEntries(packages.map((p) => [p, version(p)]));
}
export function checkVersions() {
	const expected = JSON.parse(fs.readFileSync(VERSIONS_PATH, "utf8")).versions;
	const actual = oracleVersions();
	const changes = Object.keys(actual)
		.filter((p) => actual[p] !== expected[p])
		.map((p) => `${p}: ${expected[p] ?? "missing"} -> ${actual[p]}`);
	if (changes.length)
		throw new Error(
			`Render-affecting oracle dependency drift:\n${changes.join("\n")}`,
		);
	return actual;
}

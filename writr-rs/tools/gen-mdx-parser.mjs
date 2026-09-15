// Bundle already-installed oracle packages; never fetch or upgrade dependencies.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const root = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../..",
);
const mdx = createRequire(require.resolve("remark-mdx"));
const extension = createRequire(mdx.resolve("micromark-extension-mdxjs"));
const expression = createRequire(
	extension.resolve("micromark-extension-mdx-expression"),
);
const factory = createRequire(
	expression.resolve("micromark-factory-mdx-expression"),
);
const builder = createRequire(require.resolve("tsx"))("esbuild");
const aliases = Object.fromEntries(
	["acorn", "acorn-jsx"].map((name) => [name, extension.resolve(name)]),
);
aliases["micromark-util-events-to-acorn"] = factory.resolve(
	"micromark-util-events-to-acorn",
);
const target = path.join(root, "writr-rs/crates/writr-core/vendor/mdx");
fs.mkdirSync(target, { recursive: true });
const build = builder.buildSync({
	entryPoints: [path.join(root, "writr-rs/tools/mdx/parser.mjs")],
	alias: aliases,
	bundle: true,
	format: "iife",
	platform: "neutral",
	target: "es2020",
	minify: true,
	legalComments: "inline",
	metafile: true,
	write: false,
});
fs.writeFileSync(path.join(target, "parser.js"), build.outputFiles[0].contents);
const packages = new Map();
for (const input of Object.keys(build.metafile.inputs)) {
	let dir = path.dirname(path.resolve(input));
	while (dir !== path.dirname(dir)) {
		const manifest = path.join(dir, "package.json");
		if (fs.existsSync(manifest)) {
			const pkg = JSON.parse(fs.readFileSync(manifest, "utf8"));
			if (pkg.name !== "writr") packages.set(pkg.name, { ...pkg, dir });
			break;
		}
		dir = path.dirname(dir);
	}
}
const sorted = [...packages.values()].sort((a, b) =>
	a.name.localeCompare(b.name),
);
const licenses = sorted.map((p) => {
	const file = fs
		.readdirSync(p.dir)
		.find((name) => /^(license|copying)(\.|$)/i.test(name));
	if (!file) throw new Error(`Missing license for ${p.name}`);
	return `## ${p.name}@${p.version}\n\n${fs.readFileSync(path.join(p.dir, file), "utf8")}`;
});
fs.writeFileSync(path.join(target, "LICENSES.txt"), licenses.join("\n\n"));
fs.writeFileSync(
	path.join(target, "versions.json"),
	JSON.stringify(
		Object.fromEntries(sorted.map((p) => [p.name, p.version])),
		null,
		2,
	) + "\n",
);
console.log(
	`Bundled MDX parser from ${sorted.length} existing oracle packages`,
);

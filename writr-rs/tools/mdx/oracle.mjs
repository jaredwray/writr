// The JavaScript oracle for writr-acorn: tools/mdx/parser.mjs bundled with
// the exact acorn, acorn-jsx and micromark-util-events-to-acorn versions
// remark-mdx resolves, evaluated in an isolated context. Never fetches or
// upgrades dependencies.
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

/** Build the oracle; returns `validate(value, kind, imports, deferExports)`. */
export function loadOracle() {
	const rootRequire = createRequire(path.join(root, "package.json"));
	const mdx = createRequire(rootRequire.resolve("remark-mdx"));
	const extension = createRequire(mdx.resolve("micromark-extension-mdxjs"));
	const expression = createRequire(
		extension.resolve("micromark-extension-mdx-expression"),
	);
	const factory = createRequire(
		expression.resolve("micromark-factory-mdx-expression"),
	);
	const esbuild = createRequire(rootRequire.resolve("tsx"))("esbuild");
	const alias = Object.fromEntries(
		["acorn", "acorn-jsx"].map((name) => [name, extension.resolve(name)]),
	);
	alias["micromark-util-events-to-acorn"] = factory.resolve(
		"micromark-util-events-to-acorn",
	);
	const build = esbuild.buildSync({
		entryPoints: [path.join(root, "writr-rs/tools/mdx/parser.mjs")],
		alias,
		bundle: true,
		format: "iife",
		platform: "neutral",
		target: "es2020",
		write: false,
	});
	const context = {};
	vm.runInNewContext(build.outputFiles[0].text, context);
	return context.__writrMdx;
}


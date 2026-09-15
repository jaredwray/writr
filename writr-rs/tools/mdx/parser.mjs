// Parse only: user expressions and imported modules are never evaluated.
// Use the same Acorn + JSX grammar and expression adapter as remark-mdx.
import { Parser } from "acorn";
import jsx from "acorn-jsx";
import { eventsToAcorn } from "micromark-util-events-to-acorn";
const acorn = Parser.extend(jsx());
// Resolve cross-block import bindings only after markdown-rs finishes its
// speculative tokenization; all other syntax checks stay enabled here.
const provisionalEsm = acorn.extend(
	(Base) =>
		class extends Base {
			checkLocalExport() {}
		},
);
const esmTypes = new Set([
	"ImportDeclaration",
	"ExportAllDeclaration",
	"ExportDefaultDeclaration",
	"ExportNamedDeclaration",
]);
function error(message, pos = 0, kind = "error") {
	return { kind, message, pos, imports: [] };
}
globalThis.__writrMdx = function (value, kind, imports, deferExports) {
	const esm = kind === "esm";
	const spread = kind === "spread";
	const prefix = esm
		? imports.length
			? "var " + imports.join(",") + "\n"
			: ""
		: spread
			? "({"
			: "";
	const start = { line: 1, column: 1, offset: 0 };
	const token = {
		type: "data",
		start,
		end: { line: 1, column: value.length + 1, offset: value.length },
	};
	let result;
	try {
		result = eventsToAcorn(
			[
				[
					"enter",
					token,
					{
						sliceStream() {
							return [value];
						},
					},
				],
			],
			{
				acorn: esm && deferExports ? provisionalEsm : acorn,
				acornOptions: {
					ecmaVersion: 2024,
					sourceType: "module",
					locations: true,
				},
				tokenTypes: ["data"],
				start,
				expression: !esm,
				allowEmpty: kind === "expression",
				prefix,
				suffix: spread ? "})" : "",
			},
		);
	} catch (e) {
		if (e.source === "micromark-extension-mdx-expression")
			return error(e.reason, e.place?.offset ?? 0);
		throw e;
	}
	if (
		result.error &&
		!(result.error instanceof SyntaxError) &&
		result.error.message !== "Unexpected content after expression"
	)
		throw result.error;
	if (result.error)
		return error(
			result.error.message,
			result.error.pos,
			result.swallow ? "eof" : "error",
		);
	const body = result.estree.body;
	const names = [];
	if (esm) {
		if (imports.length) body.shift();
		for (const node of body) {
			if (!esmTypes.has(node.type))
				return error("Only import/export statements are supported", node.start);
			if (node.type === "ImportDeclaration")
				for (const specifier of node.specifiers)
					names.push(specifier.local.name);
		}
	} else if (spread) {
		const expression = body[0]?.expression;
		if (expression?.type !== "ObjectExpression")
			return error("Expected an object spread");
		if (expression.properties.length > 1)
			return error(
				"Only a single spread is supported",
				expression.properties[1].start,
			);
		if (expression.properties[0]?.type !== "SpreadElement")
			return error("Expected a spread element");
	}
	return { kind: "ok", message: "", pos: 0, imports: names };
};

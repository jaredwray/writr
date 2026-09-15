import fs from "node:fs";
import path from "node:path";
import { unified } from "unified";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import { HARNESS_DIR } from "./paths.js";
import { inventory, json } from "./inventory.js";
import { getProfile } from "./profiles.js";
import {
	jsOutcome,
	jsAsyncOutcome,
	outcomeEqual,
	jsErrorDetails,
	jsAsyncValidation,
} from "./outcomes.js";
import { optionMatrix } from "./option-matrix.js";
import { oracleVersions, checkVersions } from "./versions.js";
export function inputs() {
	const original = json(path.join(HARNESS_DIR, "exact/inputs.json"));
	const matrixInputs = [
		"# Contents\n\n## Same :rocket:\n\n## Same :rocket:\n\n- [x] done\n\n```js\nconst x = 1;\n```\n\n$x^2$",
		'<Box title="x">hello</Box>\n\nhttps://example.com\n\n~~gone~~',
	];
	const matrix = optionMatrix().flatMap((options, i) =>
		matrixInputs.map((input, j) => ({
			id: `matrix/${i}/${j}`,
			input,
			options,
			provenance: "Original pairwise options regression (MIT)",
		})),
	);
	return [...original, ...matrix].map((c) => ({
		...c,
		input:
			c.input ?? fs.readFileSync(path.join(HARNESS_DIR, c.inputRef), "utf8"),
		options: c.options ?? getProfile(c.profile).options,
	}));
}
function special(value: any): any {
	if (value?.$number) return Number(value.$number);
	if (Array.isArray(value)) return value.map(special);
	if (value && typeof value === "object")
		return Object.fromEntries(
			Object.entries(value).map(([k, v]) => [k, special(v)]),
		);
	return value;
}
async function main() {
	inventory();
	const check = process.argv.includes("--check");
	if (check) checkVersions();
	const cases = [];
	const ids = new Set();
	for (const c of inputs()) {
		if (ids.has(c.id)) throw new Error(`Duplicate exact case ${c.id}`);
		ids.add(c.id);
		const outcome = jsOutcome(c.input, c.options);
		const asyncOutcome = await jsAsyncOutcome(c.input, c.options);
		const validation = jsOutcome(c.input, c.options, "validate");
		if (!outcomeEqual(outcome, asyncOutcome))
			throw new Error(`${c.id}: JS sync/async outcomes differ`);
		if ((outcome.kind === "error") !== Boolean(c.reject))
			throw new Error(
				`${c.id}: unexpected oracle ${outcome.kind}; rejection must be explicitly declared`,
			);
		if (!outcomeEqual(validation, await jsAsyncValidation(c.input, c.options)))
			throw new Error(`${c.id}: JS async/sync validation differ`);
		if (validation.kind !== outcome.kind)
			throw new Error(`${c.id}: validation/render outcomes differ`);
		cases.push({
			...c,
			outcome,
			validation,
			...(c.reject ? { oracleError: jsErrorDetails(c.input, c.options) } : {}),
		});
	}
	const stages = [];
	for (const c of json(path.join(HARNESS_DIR, "exact/stages.json"))) {
		if (ids.has(c.id)) throw new Error(`Duplicate exact/stage case ${c.id}`);
		ids.add(c.id);
		if (!["raw", "slug", "stringify"].includes(c.stage))
			throw new Error(`${c.id}: unknown stage ${c.stage}`);
		const pipeline = unified();
		if (c.stage === "raw") pipeline.use(rehypeRaw);
		if (c.stage === "slug") pipeline.use(rehypeSlug);
		pipeline.use(rehypeStringify, { allowDangerousHtml: true });
		const html = pipeline.stringify(await pipeline.run(special(c.tree)));
		stages.push({ ...c, outcome: { kind: "success", html } });
	}
	const text =
		JSON.stringify({ versions: oracleVersions(), cases, stages }, null, 2) +
		"\n";
	const file = path.join(HARNESS_DIR, "exact/outcomes.json");
	if (check) {
		if (fs.readFileSync(file, "utf8") !== text)
			throw new Error(
				"exact oracle outcome drift (run golden:exact:generate for review)",
			);
	} else fs.writeFileSync(file, text);
	console.log(
		`${check ? "Checked" : "Generated"} ${cases.length} exact outcomes and ${stages.length} stage outcomes from current JS`,
	);
}
main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});

import fs from "node:fs";
import path from "node:path";
import { inventory, inventoryCounts } from "./inventory.js";
import { getProfile } from "./profiles.js";
import { WritrJsAdapter } from "./render-adapter.js";
import { normalize } from "./normalize.js";
import { checkVersions, oracleVersions } from "./versions.js";
import { VERSIONS_PATH } from "./paths.js";

async function main() {
	const args = process.argv.slice(2);
	const check = args.includes("--check");
	for (const arg of args)
		if (
			!/^--(check|diagnostics-only|corpus-only|profile=.+|id=.+|concurrency=\d+)$/.test(
				arg,
			)
		)
			throw new Error(`Unknown flag ${arg}`);
	const profiles = args
		.find((a) => a.startsWith("--profile="))
		?.slice(10)
		.split(",");
	profiles?.forEach(getProfile);
	const id = args.find((a) => a.startsWith("--id="))?.slice(5);
	const all = inventory(undefined, check); // Always validate the complete inventory, including scoped checks.
	if (check) checkVersions();
	const cases = all.filter(
		(c) =>
			(!profiles || profiles.includes(c.profile)) &&
			(!id || c.id.includes(id)) &&
			(!args.includes("--diagnostics-only") || c.suite === "diagnostic") &&
			(!args.includes("--corpus-only") || c.suite === "corpus"),
	);
	if (!cases.length) throw new Error("Selected inventory is empty");
	const adapter = new WritrJsAdapter();
	const failures: string[] = [];
	for (const c of cases) {
		try {
			const input = fs.readFileSync(c.inputPath, "utf8");
			const profile = getProfile(c.profile);
			const asyncHtml = await adapter.renderRaw(input, profile);
			const syncHtml = adapter.renderRawSync(input, profile);
			if (syncHtml !== asyncHtml) throw new Error("exact sync/async mismatch");
			const html = normalize(asyncHtml);
			if (check) {
				if (fs.readFileSync(c.goldenPath, "utf8") !== html)
					throw new Error("normalized golden drift");
			} else {
				fs.mkdirSync(path.dirname(c.goldenPath), { recursive: true });
				fs.writeFileSync(c.goldenPath, html);
			}
		} catch (error) {
			failures.push(`${c.profile} :: ${c.id}: ${error}`);
		}
	}
	if (failures.length) throw new Error(failures.join("\n"));
	if (
		!check &&
		!profiles &&
		!id &&
		!args.includes("--diagnostics-only") &&
		!args.includes("--corpus-only")
	)
		fs.writeFileSync(
			VERSIONS_PATH,
			JSON.stringify({ versions: oracleVersions() }, null, 2) + "\n",
		);
	console.log(
		JSON.stringify({
			mode: check ? "check" : "generate",
			cases: cases.length,
			profiles: inventoryCounts(all),
		}),
	);
}
main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});

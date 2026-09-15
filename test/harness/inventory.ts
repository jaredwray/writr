import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { HARNESS_DIR } from "./paths.js";
import { normalize } from "./normalize.js";
import { getProfile, PROFILES } from "./profiles.js";
import type { Manifest } from "./types.js";

export type InventoryCase = {
	id: string;
	profile: string;
	suite: "corpus" | "diagnostic";
	inputPath: string;
	goldenPath: string;
};
export function files(dir: string): string[] {
	if (!fs.existsSync(dir))
		throw new Error(`Missing required directory: ${dir}`);
	return fs
		.readdirSync(dir, { withFileTypes: true })
		.flatMap((e) =>
			e.isDirectory()
				? files(path.join(dir, e.name))
				: [path.join(dir, e.name)],
		)
		.sort();
}
export function json(file: string) {
	return JSON.parse(fs.readFileSync(file, "utf8"));
}
function safeId(id: string) {
	if (
		typeof id !== "string" ||
		!/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_.-]+)*$/.test(id) ||
		id.split("/").includes("..")
	)
		throw new Error(`Invalid case ID: ${id}`);
}
/** Discover from inputs and assignments, never from available expected output. */
export function inventory(
	root = HARNESS_DIR,
	requireGoldens = true,
): InventoryCase[] {
	const manifest = json(path.join(root, "corpus/manifest.json")) as Manifest;
	if (!manifest.entries?.length || manifest.count !== manifest.entries.length)
		throw new Error("corpus manifest: empty or incorrect count");
	const entries: InventoryCase[] = [];
	const ids = new Set<string>();
	const counts: Record<string, number> = {};
	function add(
		suite: "corpus" | "diagnostic",
		id: string,
		inputPath: string,
		profiles: string[],
	) {
		safeId(id);
		if (ids.has(`${suite}/${id}`))
			throw new Error(
				`Duplicate ${suite} case ID: ${id} (${profiles.join(",")})`,
			);
		ids.add(`${suite}/${id}`);
		if (
			!Array.isArray(profiles) ||
			!profiles.length ||
			new Set(profiles).size !== profiles.length
		)
			throw new Error(`${id}: empty/duplicate profile assignments`);
		for (const profile of profiles) {
			try {
				getProfile(profile);
			} catch {
				throw new Error(`${id}: unknown profile ${profile}`);
			}
			const goldenPath = path.join(
				root,
				suite === "corpus" ? "goldens" : "diagnostics-goldens",
				profile,
				`${id}.html`,
			);
			if (!fs.existsSync(inputPath))
				throw new Error(`${profile} :: ${id}: missing input ${inputPath}`);
			if (requireGoldens && !fs.existsSync(goldenPath))
				throw new Error(`${profile} :: ${id}: missing golden ${goldenPath}`);
			entries.push({ suite, id, profile, inputPath, goldenPath });
		}
	}
	for (const entry of manifest.entries) {
		safeId(entry.id);
		if (entry.path !== `${entry.id}.md`)
			throw new Error(
				`${entry.id} (${entry.profiles}): input path differs from ID`,
			);
		const inputPath = path.join(root, "corpus/inputs", entry.path);
		const input = fs.readFileSync(inputPath, "utf8");
		if (
			input !== normalize(input) ||
			Buffer.byteLength(input) !== entry.bytes ||
			createHash("sha256").update(input).digest("hex") !== entry.sha256
		)
			throw new Error(
				`${entry.profiles.join(",")} :: ${entry.id}: input normalization, bytes or sha256 mismatch`,
			);
		counts[entry.source] = (counts[entry.source] ?? 0) + 1;
		add("corpus", entry.id, inputPath, entry.profiles);
	}
	if (
		JSON.stringify(Object.entries(counts).sort()) !==
		JSON.stringify(Object.entries(manifest.bySource).sort())
	)
		throw new Error("corpus manifest: bySource counts differ");
	const map = json(path.join(root, "diagnostics/profiles.json")) as Record<
		string,
		string[]
	>;
	const seenFeatures = new Set<string>();
	for (const file of files(path.join(root, "diagnostics")).filter((f) =>
		/\.mdx?$/.test(f),
	)) {
		const id = path
			.relative(path.join(root, "diagnostics"), file)
			.split(path.sep)
			.join("/")
			.replace(/\.mdx?$/, "");
		const feature = id.split("/")[0];
		seenFeatures.add(feature);
		if (!map[feature])
			throw new Error(`${id}: missing diagnostic profile mapping`);
		add("diagnostic", id, file, map[feature]);
	}
	if (!entries.some((c) => c.suite === "diagnostic"))
		throw new Error("diagnostic inventory is empty");
	for (const feature of Object.keys(map))
		if (!seenFeatures.has(feature))
			throw new Error(
				`${feature} (${map[feature]}): orphan diagnostic mapping`,
			);
	for (const p of PROFILES)
		if (!entries.some((c) => c.profile === p.name))
			throw new Error(`${p.name}: required suite is empty`);
	const expectedInputs = new Set(entries.map((c) => c.inputPath));
	for (const file of files(path.join(root, "corpus/inputs")))
		if (!expectedInputs.has(file)) throw new Error(`orphan input: ${file}`);
	const expected = new Set(entries.map((c) => c.goldenPath));
	for (const dir of ["goldens", "diagnostics-goldens"]) {
		if (!requireGoldens && !fs.existsSync(path.join(root, dir))) continue;
		for (const file of files(path.join(root, dir)))
			if (!expected.has(file))
				throw new Error(
					`orphan golden (profile/case): ${path.relative(root, file)}`,
				);
	}
	return entries;
}
export function inventoryCounts(cases: InventoryCase[]) {
	return Object.fromEntries(
		PROFILES.map((p) => [
			p.name,
			{
				corpus: cases.filter(
					(c) => c.profile === p.name && c.suite === "corpus",
				).length,
				diagnostic: cases.filter(
					(c) => c.profile === p.name && c.suite === "diagnostic",
				).length,
			},
		]),
	);
}

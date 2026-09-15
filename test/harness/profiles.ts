import fs from "node:fs";
import type { RenderOptions } from "../../src/types.js";
export type Profile = {
	name: string;
	description: string;
	options: RenderOptions;
};
/** Shared with Rust's profile-drift check. */
export const PROFILES: readonly Profile[] = JSON.parse(
	fs.readFileSync(new URL("./profiles.json", import.meta.url), "utf8"),
);
export const PROFILE_NAMES: readonly string[] = PROFILES.map((p) => p.name);
export function getProfile(name: string): Profile {
	const profile = PROFILES.find((p) => p.name === name);
	if (!profile) throw new Error(`Unknown profile "${name}"`);
	return profile;
}

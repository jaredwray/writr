import type { RenderOptions } from "../../src/types.js";

/**
 * A named, fully-specified rendering configuration.
 *
 * Every flag is set explicitly so the profile is self-contained and does not
 * inherit Writr's all-true defaults when merged. `caching` is intentionally
 * omitted here and forced to `false` by the render adapter so each render is a
 * true re-render (no cross-profile cache bleed).
 */
export type Profile = {
	/** Stable identifier used in golden paths and the manifest. */
	name: string;
	/** Human-readable description of what the profile isolates. */
	description: string;
	/** Complete render options (all feature flags specified). */
	options: RenderOptions;
};

/** All feature flags off — the bare parse -> rehype -> stringify pipeline. */
const ALL_OFF: RenderOptions = {
	emoji: false,
	toc: false,
	slug: false,
	highlight: false,
	gfm: false,
	math: false,
	mdx: false,
	rawHtml: false,
};

/** Writr's shipped defaults (everything on except mdx/rawHtml). */
const DEFAULTS: RenderOptions = {
	emoji: true,
	toc: true,
	slug: true,
	highlight: true,
	gfm: true,
	math: true,
	mdx: false,
	rawHtml: false,
};

/**
 * Canonical set of render profiles. This is the single source of truth for
 * which configurations the harness pins. Keep the list small and explicit
 * rather than enumerating the full combinatorial space of flags.
 */
export const PROFILES: readonly Profile[] = [
	{
		name: "default",
		description:
			"Writr's shipped defaults (emoji, toc, slug, highlight, gfm, math). The primary contract.",
		options: { ...DEFAULTS },
	},
	{
		name: "commonmark",
		description:
			"Bare CommonMark core: no gfm/toc/slug/highlight/math/emoji. Isolates base markdown parsing.",
		options: { ...ALL_OFF },
	},
	{
		name: "gfm-only",
		description:
			"GFM only (tables, strikethrough, task lists, autolinks, blockquote alerts).",
		options: { ...ALL_OFF, gfm: true },
	},
	{
		name: "no-highlight",
		description:
			"Defaults minus syntax highlighting. Lets a new engine pass core before highlight.js parity.",
		options: { ...DEFAULTS, highlight: false },
	},
	{
		name: "no-math",
		description:
			"Defaults minus math/KaTeX. Isolates KaTeX version drift from the core contract.",
		options: { ...DEFAULTS, math: false },
	},
	{
		name: "rawhtml",
		description: "Defaults plus raw HTML passthrough (rehype-raw).",
		options: { ...DEFAULTS, rawHtml: true },
	},
	{
		name: "mdx",
		description: "Defaults plus MDX (exercises the custom JSX handler).",
		options: { ...DEFAULTS, mdx: true },
	},
];

const PROFILES_BY_NAME = new Map(PROFILES.map((p) => [p.name, p]));

/** Look up a profile by name, throwing if it is unknown. */
export function getProfile(name: string): Profile {
	const profile = PROFILES_BY_NAME.get(name);
	if (!profile) {
		throw new Error(
			`Unknown profile "${name}". Known profiles: ${PROFILES.map((p) => p.name).join(", ")}`,
		);
	}
	return profile;
}

/** All known profile names. */
export const PROFILE_NAMES: readonly string[] = PROFILES.map((p) => p.name);

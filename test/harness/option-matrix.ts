export const FLAGS = [
	"emoji",
	"toc",
	"slug",
	"highlight",
	"gfm",
	"math",
	"mdx",
	"rawHtml",
] as const;
/** Greedy deterministic covering array, plus explicit higher-order interactions. */
export function optionMatrix() {
	const pairs = new Set<string>();
	for (let i = 0; i < 8; i++)
		for (let j = i + 1; j < 8; j++)
			for (let a = 0; a < 2; a++)
				for (let b = 0; b < 2; b++) pairs.add(`${i}/${j}/${a}/${b}`);
	const keys = (n: number) =>
		Array.from({ length: 8 }, (_, i) =>
			Array.from(
				{ length: 8 - i - 1 },
				(_, d) => `${i}/${i + d + 1}/${(n >> i) & 1}/${(n >> (i + d + 1)) & 1}`,
			),
		).flat();
	const selected: number[] = [];
	while (pairs.size) {
		let best = 0,
			score = -1;
		for (let n = 0; n < 256; n++) {
			const s = keys(n).filter((k) => pairs.has(k)).length;
			if (s > score) {
				score = s;
				best = n;
			}
		}
		selected.push(best);
		keys(best).forEach((k) => pairs.delete(k));
	}
	for (const n of [192, 23, 40]) if (!selected.includes(n)) selected.push(n);
	return selected.map((n) =>
		Object.fromEntries(FLAGS.map((f, i) => [f, Boolean(n & (1 << i))])),
	);
}

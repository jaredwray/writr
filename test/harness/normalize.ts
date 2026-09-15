/**
 * Historical, lossy normalization retained for existing snapshots.
 * Converts line endings, strips trailing spaces/tabs and adds one newline.
 * This can hide significant whitespace in preformatted HTML; exact outcome
 * comparisons must use the original untrimmed output alongside these goldens.
 */
export function normalize(html: string): string {
	const lines = html
		.replace(/\r\n?/g, "\n")
		.split("\n")
		.map((line) => line.replace(/[ \t]+$/g, ""));

	// Drop trailing blank lines, then re-add a single trailing newline.
	while (lines.length > 0 && lines[lines.length - 1] === "") {
		lines.pop();
	}

	return lines.length === 0 ? "" : `${lines.join("\n")}\n`;
}

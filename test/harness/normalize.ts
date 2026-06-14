/**
 * Normalize rendered HTML for byte-stable golden comparison.
 *
 * Only genuinely non-semantic, stable differences are smoothed out:
 *  - CRLF / lone CR are converted to LF,
 *  - trailing whitespace is stripped from each line,
 *  - the output ends with exactly one trailing newline.
 *
 * The HTML is intentionally NOT pretty-printed or reformatted — byte fidelity
 * to the current engine's output is the whole point of the golden snapshots.
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

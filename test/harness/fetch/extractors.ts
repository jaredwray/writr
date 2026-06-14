/**
 * Pure extractors: turn a raw fetched payload (a string) into a flat list of
 * candidate documents. Extractors are deterministic and side-effect free so the
 * pipeline can be reasoned about and replayed offline.
 */

/** A single extracted candidate document, pre-normalization / pre-dedupe. */
export type ExtractedDoc = {
	/** The markdown source text. */
	markdown: string;
	/** Where within the source this came from (example #, file path, repo path). */
	originPath: string;
	/** SPDX-ish license string for this document. */
	license: string;
	/** Attribution / origin URL. */
	attribution: string;
};

/**
 * Extract the markdown half of every example block in a CommonMark/GFM-style
 * `spec.txt`. Each example is delimited by a line of 32 backticks followed by
 * `example` (i.e. ```` ```````````````````````````````` example ````), then the
 * markdown, a lone `.` line, the expected HTML, then a line of 32 backticks.
 *
 * Only the markdown half is taken. The spec uses `→` (U+2192) to represent a
 * literal TAB, so those are converted back to real tabs.
 */
export function extractSpecExamples(
	raw: string,
	originPrefix: string,
	license: string,
	attribution: string,
): ExtractedDoc[] {
	const lines = raw.replace(/\r\n?/g, "\n").split("\n");
	const fence = "`".repeat(32);
	const docs: ExtractedDoc[] = [];
	let exampleIndex = 0;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		// Opening fence: 32 backticks optionally followed by " example" and
		// arbitrary trailing info-string words (some examples carry tags).
		if (line.startsWith(fence) && /\bexample\b/.test(line.slice(fence.length))) {
			const markdownLines: string[] = [];
			let j = i + 1;
			// Collect markdown until the lone "." separator.
			while (j < lines.length && lines[j] !== ".") {
				markdownLines.push(lines[j]);
				j++;
			}
			// Skip the "." and the expected-HTML half up to the closing fence.
			j++; // step over "."
			while (j < lines.length && !lines[j].startsWith(fence)) {
				j++;
			}
			exampleIndex++;
			const markdown = markdownLines.join("\n").replace(/→/g, "\t");
			docs.push({
				markdown,
				originPath: `${originPrefix}#${exampleIndex}`,
				license,
				attribution,
			});
			i = j; // continue after the closing fence
		}
	}

	return docs;
}

/**
 * Extract the markdown half of every example in a markdown-it `.txt` fixture.
 *
 * The fixture format is a sequence of blocks separated by lone `.` lines:
 *
 *   <optional description line(s)>
 *   .
 *   <markdown>
 *   .
 *   <expected html>
 *   .
 *
 * We treat the text as groups of three `.`-delimited sections (desc, md, html)
 * and keep the middle (markdown) section. Leading/trailing blank lines between
 * blocks are tolerated.
 */
export function extractMarkdownItFixture(
	raw: string,
	originPrefix: string,
	license: string,
	attribution: string,
): ExtractedDoc[] {
	const text = raw.replace(/\r\n?/g, "\n");
	const lines = text.split("\n");
	const docs: ExtractedDoc[] = [];
	let exampleIndex = 0;

	let i = 0;
	while (i < lines.length) {
		// Skip blank lines between blocks.
		while (i < lines.length && lines[i].trim() === "") {
			i++;
		}
		if (i >= lines.length) {
			break;
		}

		// Description: everything up to the first lone "." line.
		while (i < lines.length && lines[i] !== ".") {
			i++;
		}
		if (i >= lines.length) {
			break; // no example body followed
		}
		i++; // step over the "." opening the markdown section

		// Markdown: up to the next lone "." line.
		const markdownLines: string[] = [];
		while (i < lines.length && lines[i] !== ".") {
			markdownLines.push(lines[i]);
			i++;
		}
		if (i >= lines.length) {
			break; // malformed: no closing for markdown
		}
		i++; // step over the "." separating markdown / html

		// HTML: up to the next lone "." line (discarded).
		while (i < lines.length && lines[i] !== ".") {
			i++;
		}
		i++; // step over the closing "." of this block

		exampleIndex++;
		docs.push({
			markdown: markdownLines.join("\n"),
			originPath: `${originPrefix}#${exampleIndex}`,
			license,
			attribution,
		});
	}

	return docs;
}

/** Wrap a whole-file markdown document as a single extracted doc. */
export function extractWholeFile(
	markdown: string,
	originPath: string,
	license: string,
	attribution: string,
): ExtractedDoc[] {
	return [{ markdown, originPath, license, attribution }];
}

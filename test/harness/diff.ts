/** A precise, human-readable description of where two strings first diverge. */
export type DiffReport = {
	/** True when the two strings are byte-identical after normalization. */
	equal: boolean;
	/** Character index of the first divergence, or -1 when equal. */
	index: number;
	/** 1-based line number of the first divergence. */
	line: number;
	/** 1-based column of the first divergence. */
	column: number;
	/** Length of the expected (golden) string. */
	expectedLength: number;
	/** Length of the actual (rendered) string. */
	actualLength: number;
	/** A short context window around the divergence for both sides. */
	expectedContext: string;
	actualContext: string;
};

const CONTEXT = 60;

function lineCol(text: string, index: number): { line: number; column: number } {
	let line = 1;
	let column = 1;
	for (let i = 0; i < index && i < text.length; i++) {
		if (text[i] === "\n") {
			line++;
			column = 1;
		} else {
			column++;
		}
	}
	return { line, column };
}

function context(text: string, index: number): string {
	const start = Math.max(0, index - CONTEXT);
	const end = Math.min(text.length, index + CONTEXT);
	const slice = text.slice(start, end).replace(/\n/g, "\\n");
	const prefix = start > 0 ? "…" : "";
	const suffix = end < text.length ? "…" : "";
	return `${prefix}${slice}${suffix}`;
}

/**
 * Compare an expected (golden) string against an actual (rendered) string and
 * report the first divergence with line/column and surrounding context. Far
 * more useful for a 5,000-line HTML golden than a full unified diff.
 */
export function firstDivergence(expected: string, actual: string): DiffReport {
	const max = Math.max(expected.length, actual.length);
	let index = -1;
	for (let i = 0; i < max; i++) {
		if (expected[i] !== actual[i]) {
			index = i;
			break;
		}
	}

	if (index === -1) {
		return {
			equal: true,
			index: -1,
			line: 0,
			column: 0,
			expectedLength: expected.length,
			actualLength: actual.length,
			expectedContext: "",
			actualContext: "",
		};
	}

	const { line, column } = lineCol(expected, index);
	return {
		equal: false,
		index,
		line,
		column,
		expectedLength: expected.length,
		actualLength: actual.length,
		expectedContext: context(expected, index),
		actualContext: context(actual, index),
	};
}

/** Render a {@link DiffReport} as a compact multi-line message. */
export function formatDiff(report: DiffReport): string {
	if (report.equal) {
		return "outputs are identical";
	}
	return [
		`first divergence at index ${report.index} (line ${report.line}, col ${report.column})`,
		`length: expected ${report.expectedLength}, actual ${report.actualLength}`,
		`expected: ${report.expectedContext}`,
		`actual:   ${report.actualContext}`,
	].join("\n");
}

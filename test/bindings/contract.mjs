/** Portable API contract shared by Node child processes and Chromium. No native oracle. */
export const EXPORTS = [
	"engineVersion",
	"render",
	"renderAsync",
	"renderBatch",
	"renderBatchAsync",
	"renderBatchBuffer",
	"renderBatchBufferAsync",
	"renderToMdast",
	"validate",
];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function assert(ok, message) {
	if (!ok) throw new Error(message);
}
function outcome(error) {
	if (
		error instanceof Error &&
		/^writr-rs: markdown parse error: /.test(error.message)
	)
		return { kind: "error", category: "parse" };
	throw error;
}
async function renderOutcome(fn) {
	try {
		return { kind: "success", html: await fn() };
	} catch (error) {
		return outcome(error);
	}
}
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
export function pack(inputs, makeBuffer) {
	const arrays = inputs.map((s) => encoder.encode(s));
	const offsets = [0];
	for (const a of arrays) offsets.push(offsets.at(-1) + a.length);
	const bytes = new Uint8Array(offsets.at(-1));
	arrays.forEach((a, i) => bytes.set(a, offsets[i]));
	return { input: makeBuffer(bytes), offsets: new Uint32Array(offsets) };
}
function unpack(p, count) {
	assert(p.offsets instanceof Uint32Array, "offsets must be Uint32Array");
	assert(p.offsets.length === count + 1, "wrong offset count");
	assert(p.offsets[0] === 0, "missing leading zero");
	assert(
		p.offsets.at(-1) === p.html.length,
		"final offset differs from output bytes",
	);
	const out = [];
	for (let i = 0; i < count; i++) {
		assert(p.offsets[i] <= p.offsets[i + 1], "decreasing output offsets");
		out.push(decoder.decode(p.html.subarray(p.offsets[i], p.offsets[i + 1])));
	}
	return out;
}
/** Report each differing document after count/offset validation has succeeded. */
export function assertBatchOutput(actual, expected, caseIds) {
	assert(Array.isArray(actual), "batch output must be an array");
	assert(
		actual.length === expected.length,
		`batch output count: expected ${expected.length}, received ${actual.length}`,
	);
	const differences = [];
	for (let i = 0; i < expected.length; i++) {
		if (actual[i] === expected[i]) continue;
		const received = actual[i];
		let offset = 0;
		if (typeof received === "string") {
			while (
				offset < expected[i].length &&
				offset < received.length &&
				expected[i][offset] === received[offset]
			)
				offset++;
		}
		const start = Math.max(0, offset - 24);
		differences.push(
			`${caseIds[i]} (index ${i}, UTF-16 offset ${offset}): expected ${JSON.stringify(expected[i].slice(start, offset + 80))}, received ${JSON.stringify(typeof received === "string" ? received.slice(start, offset + 80) : received)}`,
		);
	}
	assert(
		differences.length === 0,
		`HTML differs from JS:\n${differences.join("\n")}`,
	);
}

export async function runContract(
	api,
	fixture,
	makeBuffer = (bytes) => bytes,
	onProgress = () => {},
	taskClasses = [],
) {
	const results = [];
	const record = async (apiName, id, fn) => {
		onProgress({ phase: "start", api: apiName, id });
		let timer;
		try {
			await Promise.race([
				Promise.resolve().then(fn),
				new Promise((_, reject) => {
					timer = setTimeout(
						() => reject(new Error(`API deadline exceeded: ${apiName}/${id}`)),
						3000,
					);
				}),
			]);
			results.push({ api: apiName, id, passed: true });
		} catch (error) {
			results.push({ api: apiName, id, passed: false, error: String(error) });
		} finally {
			clearTimeout(timer);
			onProgress({ phase: "complete", ...results.at(-1) });
		}
	};
	for (const name of taskClasses) {
		await record(name, "internal task cannot be constructed", () => {
			assert(typeof api[name] === "function", `Missing task class ${name}`);
			assert(
				same(Object.getOwnPropertyNames(api[name].prototype), ["constructor"]),
				"unexpected task methods",
			);
			let error;
			try {
				new api[name]();
			} catch (caught) {
				error = caught;
			}
			assert(
				error instanceof Error &&
					error.message === "Class contains no `constructor`, can not new it!",
				"task constructor must reject direct calls",
			);
		});
	}
	await record("exports", "inventory", () =>
		assert(
			same(
				Object.keys(api)
					.filter((k) => typeof api[k] === "function")
					.sort(),
				[...EXPORTS, ...taskClasses].sort(),
			),
			"export inventory differs from tested contract",
		),
	);
	await record("engineVersion", "metadata", () => {
		const v = api.engineVersion();
		assert(
			typeof v === "string" && v.startsWith("writr-rs "),
			"missing engine version",
		);
		assert(
			v.includes(`katex ${fixture.versions.katex}`),
			"KaTeX version drift",
		);
		assert(
			v.includes(`highlight.js ${fixture.versions["highlight.js"]}`),
			"highlight version drift",
		);
	});
	const trees = [];
	for (const c of fixture.cases) {
		for (const method of ["render", "renderAsync"])
			await record(method, c.id, async () =>
				assert(
					same(
						await renderOutcome(() => api[method](c.input, c.options)),
						c.outcome,
					),
					"exact JS outcome differs",
				),
			);
		await record("validate", c.id, () => {
			let actual;
			try {
				const v = api.validate(c.input, c.options);
				assert(v === undefined, "validate must return undefined");
				actual = { kind: "success", html: "" };
			} catch (error) {
				actual = outcome(error);
			}
			assert(same(actual, c.validation), "JS validation outcome differs");
		});
		if (c.outcome.kind === "error")
			await record("renderToMdast", c.id, async () =>
				assert(
					(await renderOutcome(() => api.renderToMdast(c.input, c.options)))
						.kind === "error",
					"malformed MDX accepted",
				),
			);
	}
	for (const [input, types] of [
		["# Hello\n\nText **bold**.", ["heading", "paragraph"]],
		["- one\n- two", ["list"]],
	])
		await record("renderToMdast", input, () => {
			const tree = JSON.parse(api.renderToMdast(input));
			assert(tree.type === "root", "missing mdast root");
			assert(
				same(
					tree.children.map((n) => n.type),
					types,
				),
				"unexpected mdast children",
			);
			trees.push({ input, tree });
		});
	const defaults = fixture.cases.find((c) => c.id === "text/unicode");
	for (const options of [
		undefined,
		null,
		{},
		{ caching: true },
		{ caching: false },
	])
		for (const method of ["render", "renderAsync"])
			await record(method, `defaults/${JSON.stringify(options)}`, async () =>
				assert(
					(await api[method](defaults.input, options)) ===
						defaults.outcome.html,
					"binding defaults differ from JS defaults",
				),
			);
	for (const options of [
		undefined,
		null,
		{},
		{ caching: true },
		{ caching: false },
	]) {
		for (const method of ["renderBatch", "renderBatchAsync"])
			await record(method, `defaults/${JSON.stringify(options)}`, async () =>
				assert(
					same(await api[method]([defaults.input], options), [
						defaults.outcome.html,
					]),
					"batch defaults differ",
				),
			);
		for (const method of ["renderBatchBuffer", "renderBatchBufferAsync"])
			await record(method, `defaults/${JSON.stringify(options)}`, async () => {
				const p = pack([defaults.input], makeBuffer);
				assert(
					same(unpack(await api[method](p.input, p.offsets, options), 1), [
						defaults.outcome.html,
					]),
					"packed defaults differ",
				);
			});
		await record("validate", `defaults/${JSON.stringify(options)}`, () =>
			assert(
				api.validate(defaults.input, options) === undefined,
				"validate default/null contract differs",
			),
		);
		await record("renderToMdast", `defaults/${JSON.stringify(options)}`, () =>
			assert(
				same(
					JSON.parse(api.renderToMdast(defaults.input, options)),
					JSON.parse(api.renderToMdast(defaults.input)),
				),
				"mdast default/null contract differs",
			),
		);
	}
	const groups = new Map();
	for (const c of fixture.cases.filter((c) => c.outcome.kind === "success")) {
		const key = JSON.stringify(c.options);
		const group = groups.get(key) ?? [];
		group.push(c);
		groups.set(key, group);
	}
	const batchGroups = [...groups.entries()].map(([options, cases]) => ({
		id: cases.map((c) => c.id).join(","),
		caseIds: cases.map((c) => c.id),
		options: JSON.parse(options),
		inputs: cases.map((c) => c.input),
		expected: cases.map((c) => c.outcome.html),
	}));
	batchGroups.push({
		id: "empty-batch",
		caseIds: [],
		options: {},
		inputs: [],
		expected: [],
	});
	const unicode = defaults;
	batchGroups.push({
		id: "empty-duplicates-unicode",
		caseIds: ["empty/0", unicode.id, `${unicode.id}/duplicate`, "empty/3"],
		options: unicode.options,
		inputs: ["", unicode.input, unicode.input, ""],
		expected: ["", unicode.outcome.html, unicode.outcome.html, ""],
	});
	for (const g of batchGroups) {
		for (const method of ["renderBatch", "renderBatchAsync"])
			await record(method, g.id, async () =>
				assertBatchOutput(
					await api[method](g.inputs, g.options),
					g.expected,
					g.caseIds,
				),
			);
		for (const method of ["renderBatchBuffer", "renderBatchBufferAsync"])
			await record(method, g.id, async () => {
				const p = pack(g.inputs, makeBuffer);
				const actual = await api[method](p.input, p.offsets, g.options);
				assertBatchOutput(
					unpack(actual, g.inputs.length),
					g.expected,
					g.caseIds,
				);
			});
	}
	for (const method of ["renderBatchBuffer", "renderBatchBufferAsync"]) {
		for (const offsets of [[], [999]])
			await record(method, `no-ranges/${offsets}`, async () =>
				assert(
					same(
						unpack(
							await api[method](
								makeBuffer(encoder.encode("x")),
								new Uint32Array(offsets),
							),
							0,
						),
						[],
					),
					"zero/one offsets must produce empty batch",
				),
			);
		await record(method, "partial-buffer", async () => {
			const result = await api[method](
				makeBuffer(encoder.encode("!hello?")),
				new Uint32Array([1, 6]),
			);
			assert(
				same(unpack(result, 1), ["<p>hello</p>"]),
				"partial buffer range changed",
			);
		});
		for (const offsets of [
			[2, 1],
			[0, 99],
			[0, 1],
		])
			await record(method, `invalid-range/${offsets}`, async () => {
				let error;
				try {
					await api[method](
						makeBuffer(encoder.encode("é")),
						new Uint32Array(offsets),
					);
				} catch (e) {
					error = e;
				}
				assert(
					error instanceof Error &&
						/^writr-rs: (invalid document range|document at .* is not UTF-8)/.test(
							error.message,
						),
					"expected controlled packed-range error",
				);
			});
	}
	for (const c of fixture.cases.filter((c) => c.outcome.kind === "error"))
		for (const method of [
			"renderBatch",
			"renderBatchAsync",
			"renderBatchBuffer",
			"renderBatchBufferAsync",
		])
			await record(method, `reject/${c.id}`, async () => {
				const p = pack(["valid", c.input, "after"], makeBuffer);
				const rejected = await renderOutcome(() =>
					method.includes("Buffer")
						? api[method](p.input, p.offsets, c.options)
						: api[method](["valid", c.input, "after"], c.options),
				);
				assert(
					rejected.kind === "error",
					"batch must reject when a document is parse-invalid",
				);
				assert(
					api.render("valid", c.options) === "<p>valid</p>",
					"valid render after rejected batch failed",
				);
			});
	const independent = [...groups.values()].slice(0, 4).map((cases) => cases[0]);
	for (const method of [
		"renderAsync",
		"renderBatchAsync",
		"renderBatchBufferAsync",
	])
		await record(method, "bounded-concurrency", async () => {
			await Promise.all(
				independent.map(async (c) => {
					let html;
					if (method === "renderAsync")
						html = await api[method](c.input, c.options);
					else if (method === "renderBatchAsync")
						html = (await api[method]([c.input], c.options))[0];
					else {
						const p = pack([c.input], makeBuffer);
						html = unpack(
							await api[method](p.input, p.offsets, c.options),
							1,
						)[0];
					}
					assert(
						html === c.outcome.html,
						"concurrent calls contaminated output",
					);
				}),
			);
		});
	for (const name of EXPORTS)
		assert(
			results.some((r) => r.api === name),
			`no tests exercised export ${name}`,
		);
	return {
		engineVersion: api.engineVersion(),
		exports: EXPORTS,
		runtimeExports: Object.keys(api)
			.filter((k) => typeof api[k] === "function")
			.sort(),
		results,
		trees,
	};
}

import fs from "node:fs";
import { createRequire } from "node:module";
import { runContract } from "./contract.mjs";
const require = createRequire(import.meta.url);
const fixture = JSON.parse(
	fs.readFileSync(
		new URL("../harness/exact/outcomes.json", import.meta.url),
		"utf8",
	),
);
if (process.argv[3] === "mdx") {
	fixture.cases = fixture.cases.filter(
		(c) => c.options.mdx || c.id === "text/unicode",
	);
	if (!fixture.cases.some((c) => c.options.mdx))
		throw new Error("MDX fixture suite is empty");
}
const api = require("../../writr-rs/crates/writr-node/index.js");
const loaded = Object.keys(require.cache);
const wasm = loaded.some((f) => f.endsWith("writr-node.wasi.cjs"));
const native = loaded.some((f) => /writr[-_]node.*\.node$/.test(f));
if (process.env.WRITR_RS_FORCE_WASM === "1" ? !wasm || native : !native || wasm)
	throw new Error("requested artifact was not loaded exclusively");
const report = await runContract(
	api,
	fixture,
	(bytes) => Buffer.from(bytes),
	undefined,
	["RenderTask", "RenderBatchTask", "RenderBatchBufferTask"],
);
for (const name of ["renderBatchBuffer", "renderBatchBufferAsync"]) {
	const result = await api[name](Buffer.from("x"), new Uint32Array([0, 1]));
	report.results.push({
		api: name,
		id: "Node output remains Buffer",
		passed: Buffer.isBuffer(result.html),
	});
}
fs.writeFileSync(
	process.argv[2],
	JSON.stringify(
		{
			...report,
			artifact: wasm ? "wasm" : "native",
			versions: fixture.versions,
		},
		null,
		2,
	) + "\n",
);
// Exit success means the probe completed without crashing; the parent asserts every result.

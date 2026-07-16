/* eslint-disable */
/* prettier-ignore */

// Node.js loader for the single-threaded `wasm32-wasip1` build of writr-rs.
//
// Adapted from the napi-rs CLI's generated loader, minus the parts that
// assume `wasm32-wasip1-threads`: no worker pool, no SharedArrayBuffer — the
// module owns (exports) its linear memory and async work runs on the main
// thread via emnapi's single-thread emulation.

const __nodeFs = require("node:fs");
const __nodePath = require("node:path");
const { WASI: __nodeWASI } = require("node:wasi");

const {
	getDefaultContext: __emnapiGetDefaultContext,
	instantiateNapiModuleSync: __emnapiInstantiateNapiModuleSync,
} = require("@napi-rs/wasm-runtime");

const __rootDir = __nodePath.parse(process.cwd()).root;

const __wasi = new __nodeWASI({
	version: "preview1",
	env: process.env,
	preopens: {
		[__rootDir]: __rootDir,
	},
});

const __emnapiContext = __emnapiGetDefaultContext();

const __wasmFilePath = __nodePath.join(__dirname, "writr-node.wasm32-wasi.wasm");

if (!__nodeFs.existsSync(__wasmFilePath)) {
	throw new Error(
		"Cannot find writr-node.wasm32-wasi.wasm — run `pnpm build:rs:wasm` first.",
	);
}

const { napiModule: __napiModule } = __emnapiInstantiateNapiModuleSync(
	__nodeFs.readFileSync(__wasmFilePath),
	{
		context: __emnapiContext,
		wasi: __wasi,
		overwriteImports(importObject) {
			importObject.env = {
				...importObject.env,
				...importObject.napi,
				...importObject.emnapi,
			};
			return importObject;
		},
		beforeInit({ instance }) {
			for (const name of Object.keys(instance.exports)) {
				if (name.startsWith("__napi_register__")) {
					instance.exports[name]();
				}
			}
		},
	},
);

module.exports = __napiModule.exports;
module.exports.engineVersion = __napiModule.exports.engineVersion;
module.exports.render = __napiModule.exports.render;
module.exports.renderAsync = __napiModule.exports.renderAsync;
module.exports.renderBatch = __napiModule.exports.renderBatch;
module.exports.renderBatchAsync = __napiModule.exports.renderBatchAsync;
module.exports.renderBatchBuffer = __napiModule.exports.renderBatchBuffer;
module.exports.renderBatchBufferAsync =
	__napiModule.exports.renderBatchBufferAsync;
module.exports.renderToMdast = __napiModule.exports.renderToMdast;
module.exports.validate = __napiModule.exports.validate;

/* eslint-disable */
/* prettier-ignore */

// Browser loader for the single-threaded `wasm32-wasip1` build of writr-rs.
//
// Adapted from the napi-rs CLI's generated loader, minus the parts that
// assume `wasm32-wasip1-threads`. Because the module is single-threaded and
// owns its linear memory, it needs no SharedArrayBuffer, no workers, and
// therefore no COOP/COEP (cross-origin isolation) headers — it runs from any
// static file host.

import {
	getDefaultContext as __emnapiGetDefaultContext,
	instantiateNapiModule as __emnapiInstantiateNapiModule,
	WASI as __WASI,
} from "@napi-rs/wasm-runtime";

const __wasi = new __WASI({
	version: "preview1",
});

const __wasmUrl = new URL("./writr-node.wasm32-wasi.wasm", import.meta.url)
	.href;
const __emnapiContext = __emnapiGetDefaultContext();

const __wasmFile = await fetch(__wasmUrl).then((res) => res.arrayBuffer());

const { napiModule: __napiModule } = await __emnapiInstantiateNapiModule(
	__wasmFile,
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

export default __napiModule.exports;
export const engineVersion = __napiModule.exports.engineVersion;
export const render = __napiModule.exports.render;
export const renderAsync = __napiModule.exports.renderAsync;
export const renderToMdast = __napiModule.exports.renderToMdast;
export const validate = __napiModule.exports.validate;

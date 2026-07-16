use std::env;
use std::path::{Path, PathBuf};

/// Link setup for the single-threaded `wasm32-wasip1` build.
///
/// `napi_build::setup()` (and the napi CLI) assume `wasm32-wasip1-threads`:
/// they link `emnapi-basic-mt` and export the async-worker entry points,
/// which embed atomics and a `global.set` on the (then-immutable) TLS base —
/// invalid WebAssembly in a non-shared-memory module. This mirrors that
/// recipe for the non-threads target instead: single-thread emnapi archive,
/// no worker exports, module-owned (exported) linear memory — which also
/// keeps the artifact free of SharedArrayBuffer/COOP/COEP requirements in
/// browsers.
fn setup_wasi_single_thread() {
	println!("cargo:rerun-if-env-changed=EMNAPI_LINK_DIR");
	let link_dir = env::var("EMNAPI_LINK_DIR")
		.ok()
		.map(PathBuf::from)
		.unwrap_or_else(|| {
			let manifest = PathBuf::from(
				env::var("CARGO_MANIFEST_DIR").expect("cargo sets CARGO_MANIFEST_DIR"),
			);
			manifest.join("node_modules/emnapi/lib/wasm32-wasi")
		});
	assert!(
		link_dir.join("libemnapi-basic.a").exists(),
		"libemnapi-basic.a not found in {} — run `pnpm install` in crates/writr-node or set EMNAPI_LINK_DIR",
		link_dir.display()
	);
	println!("cargo:rustc-link-search={}", link_dir.display());
	println!("cargo:rustc-link-lib=static=emnapi-basic");
	println!("cargo:rustc-link-arg=--export=malloc");
	println!("cargo:rustc-link-arg=--export=free");
	println!("cargo:rustc-link-arg=--export=napi_register_wasm_v1");
	println!("cargo:rustc-link-arg=--export-if-defined=node_api_module_get_api_version_v1");
	println!("cargo:rustc-link-arg=--export-table");
	println!("cargo:rustc-link-arg=--import-undefined");
	// QuickJS recursion (KaTeX parsing) needs far more than lld's 1MiB
	// default shadow stack; match napi-build's 64MiB.
	println!("cargo:rustc-link-arg=-zstack-size=64000000");
	println!("cargo:rustc-link-arg=--no-check-features");
	// Link as a WASI reactor (library) rather than a command, so the module
	// exports `_initialize` instead of expecting `_start`.
	let rustc_path = env::var("RUSTC").expect("cargo sets RUSTC");
	let target = env::var("TARGET").expect("cargo sets TARGET");
	let crt_reactor = Path::new(&rustc_path)
		.parent()
		.and_then(Path::parent)
		.map(|sysroot| {
			sysroot
				.join("lib/rustlib")
				.join(&target)
				.join("lib/self-contained/crt1-reactor.o")
		})
		.filter(|path| path.exists())
		.expect("crt1-reactor.o not found in the Rust sysroot for this target");
	println!("cargo:rustc-link-arg={}", crt_reactor.display());
	println!("cargo:rustc-link-arg=--export=_initialize");
}

fn main() {
	if env::var("CARGO_CFG_TARGET_ARCH").as_deref() == Ok("wasm32") {
		setup_wasi_single_thread();
	} else {
		napi_build::setup();
	}
}

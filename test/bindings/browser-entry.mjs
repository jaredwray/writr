import * as binding from "../../writr-rs/crates/writr-node/browser.mjs";
import { runContract } from "./contract.mjs";
export async function check(fixture) {
	return runContract(
		binding,
		fixture,
		(bytes) => bytes,
		(event) => console.log("WRITR_PROGRESS " + JSON.stringify(event)),
	);
}

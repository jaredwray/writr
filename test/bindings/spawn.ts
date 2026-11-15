import { execFileSync } from "node:child_process";

const WINDOWS_ABORT = 3221226505;

export function runBindingChild(
	args: string[],
	env: NodeJS.ProcessEnv = process.env,
) {
	const attempts = process.platform === "win32" ? 2 : 1;
	for (let attempt = 1; attempt <= attempts; attempt++) {
		try {
			execFileSync(process.execPath, args, {
				timeout: 180_000,
				stdio: "pipe",
				env,
			});
			return;
		} catch (error) {
			const status = (error as { status?: number | null }).status;
			const stderr = (error as { stderr?: Buffer }).stderr;
			const text = Buffer.isBuffer(stderr) ? stderr.toString("utf8") : "";
			const windowsAbort =
				status === WINDOWS_ABORT || text.includes("UV_HANDLE_CLOSING");
			if (!windowsAbort || attempt === attempts) throw error;
		}
	}
}

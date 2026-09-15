import { defineConfig } from "vitest/config";
export default defineConfig({
	test: {
		include: ["test/bindings/**/*.test.ts"],
		testTimeout: 190_000,
		hookTimeout: 190_000,
	},
});

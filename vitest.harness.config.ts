import {defineConfig} from 'vitest/config';

// Dedicated config for the markdown golden-snapshot harness. The harness suite
// is large (1000+ corpus files) and is intentionally kept out of the default
// `pnpm test`/coverage run. Run it explicitly with `pnpm test:harness`.
export default defineConfig({
	test: {
		include: ['**/test/harness/**/*.test.ts'],
		// Generous timeout: rendering thousands of cases under multiple profiles.
		testTimeout: 60_000,
		hookTimeout: 60_000,
	},
});

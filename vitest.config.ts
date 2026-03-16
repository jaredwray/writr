import {defineConfig} from 'vitest/config';

export default defineConfig({
	test: {
		exclude: ['**/test/*integration*', '**/node_modules/**'],
		coverage: {
			reporter: ['text', 'json', 'lcov'],
			exclude: [
				'site/docula.config.cjs',
				'site-output/**',
				'.pnp.*',
				'.yarn/**',
				'vitest.config.ts',
				'dist/**',
				'site/**',
				'test/**',
			],
		},
	},
});

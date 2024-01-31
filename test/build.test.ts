import {afterEach, beforeEach, expect, it, describe, vi} from 'vitest';
import * as fs from 'fs-extra';
import axios from 'axios';
import {WritrBuilder, type WritrData} from '../src/builder.js';
import {WritrOptions} from '../src/options.js';
import githubMockContributors from './fixtures/data-mocks/github-contributors.json';
import githubMockReleases from './fixtures/data-mocks/github-releases.json';

vi.mock('axios');

describe('WritrBuilder', () => {
	const writrData: WritrData = {
		siteUrl: 'http://foo.com',
		siteTitle: 'Writr',
		siteDescription: 'Beautiful Website for Your Projects',
		sitePath: 'test/fixtures/single-page-site',
		templatePath: 'test/fixtures/template-example',
		outputPath: 'test/temp-sitemap-test',
	};

	afterEach(() => {
		// Reset the mock after each test
		vi.resetAllMocks();
	});
	beforeEach(() => {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-call
		(axios.get as any).mockImplementation(async (url: string) => {
			if (url.endsWith('releases')) {
				return {data: githubMockReleases};
			}

			if (url.endsWith('contributors')) {
				return {data: githubMockContributors};
			}

			// Default response or throw an error if you prefer
			return {data: {}};
		});
	});

	it('should build', async () => {
		const options = new WritrOptions();
		options.outputPath = 'test/temp-build-test';
		const builder = new WritrBuilder(options);
		const consoleLog = console.log;
		let consoleMessage = '';
		console.log = message => {
			consoleMessage = message as string;
		};

		try {
			await builder.build();
		} finally {
			await fs.remove(builder.options.outputPath);
		}

		expect(consoleMessage).toContain('Build');

		console.log = consoleLog;
	});
});

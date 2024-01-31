/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import process from 'node:process';
import {afterEach, beforeEach, expect, it, describe, vi} from 'vitest';
import fs from 'fs-extra';
import axios from 'axios';
import Writr, {WritrHelpers} from '../src/writr.js';
import {WritrOptions} from '../src/options.js';
import githubMockContributors from './fixtures/data-mocks/github-contributors.json';
import githubMockReleases from './fixtures/data-mocks/github-releases.json';

const defaultOptions: WritrOptions = new WritrOptions({
	templatePath: './custom-template',
	outputPath: './custom-dist',
	sitePath: './custom-site',
	githubPath: 'custom/repo',
	siteTitle: 'Custom Title',
	siteDescription: 'Custom Description',
	siteUrl: 'https://custom-url.com',
});

vi.mock('axios');

describe('writr', () => {
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

	it('should be able to initialize', () => {
		const writr = new Writr();
		expect(writr).toBeDefined();
	});
	it('should be able to initialize with options', () => {
		const writr = new Writr(defaultOptions);
		expect(writr).toBeDefined();
	});
	it('should be able to get and set options', () => {
		const writr = new Writr(defaultOptions);
		expect(writr.options).toEqual(defaultOptions);
		const newOptions: WritrOptions = new WritrOptions({
			templatePath: './new-template',
			outputPath: './new-dist',
			sitePath: './new-site',
			githubPath: 'new/repo',
			siteTitle: 'New Title',
			siteDescription: 'New Description',
			siteUrl: 'https://new-url.com',
		});
		writr.options = newOptions;
		expect(writr.options).toEqual(newOptions);
	});
	it('should be able to get the helpers', () => {
		const writr = new Writr(defaultOptions);
		const writrHelpers = new WritrHelpers();
		expect(writrHelpers).toBeDefined();
	});
	it('should be able to get the helpers via static', () => {
		const writr = new Writr(defaultOptions);
		const writrHelpers = new WritrHelpers();
		expect(writrHelpers.createDoc).toBeDefined();
	});
	it('is a single page site or not', () => {
		const writr = new Writr(defaultOptions);
		const singlePageSite = 'test/fixtures/single-page-site';
		const multiPageSite = 'test/fixtures/multi-page-site';
		expect(writr.isSinglePageWebsite(singlePageSite)).toEqual(true);
		expect(writr.isSinglePageWebsite(multiPageSite)).toEqual(false);
	});
	it('should generate the site init files and folders', () => {
		const writr = new Writr(defaultOptions);
		const consoleLog = console.log;
		let consoleMessage = '';
		const temporarySitePath = './temp-site';
		console.log = message => {
			consoleMessage = message;
		};

		try {
			writr.generateInit(temporarySitePath, true);

			expect(consoleMessage).toContain('Writr initialized.');
			console.log = consoleLog;

			expect(fs.existsSync(temporarySitePath)).toEqual(true);
			expect(fs.existsSync(`${temporarySitePath}/writr.config.ts`)).toEqual(true);
			expect(fs.existsSync(`${temporarySitePath}/logo.png`)).toEqual(true);
			expect(fs.existsSync(`${temporarySitePath}/favicon.svg`)).toEqual(true);
			expect(fs.existsSync(`${temporarySitePath}/variables.css`)).toEqual(true);
		} finally {
			fs.rmdirSync(temporarySitePath, {recursive: true});
		}
	});
	it('should generate the site init files and folders for javascript', () => {
		const writr = new Writr(defaultOptions);
		const consoleLog = console.log;
		let consoleMessage = '';
		const temporarySitePath = './temp-site-js';
		console.log = message => {
			consoleMessage = message;
		};

		try {
			writr.generateInit(temporarySitePath, false);

			expect(consoleMessage).toContain('Writr initialized.');
			console.log = consoleLog;

			expect(fs.existsSync(temporarySitePath)).toEqual(true);
			expect(fs.existsSync(`${temporarySitePath}/writr.config.js`)).toEqual(true);
			expect(fs.existsSync(`${temporarySitePath}/logo.png`)).toEqual(true);
			expect(fs.existsSync(`${temporarySitePath}/favicon.svg`)).toEqual(true);
			expect(fs.existsSync(`${temporarySitePath}/variables.css`)).toEqual(true);
		} finally {
			fs.rmdirSync(temporarySitePath, {recursive: true});
		}
	});
	it('should get the package version', () => {
		const writr = new Writr(defaultOptions);
		const packageJson = fs.readFileSync('./package.json', 'utf8');
		const packageObject = JSON.parse(packageJson) as {version: string};
		const packageVersion = writr.getVersion();
		expect(packageVersion).toBeDefined();
		expect(packageVersion).toEqual(packageObject.version);
	});
});

describe('writr execute', () => {
	it('should be able to execute with no parameters', async () => {
		const buildOptions = new WritrOptions();
		buildOptions.sitePath = 'test/fixtures/single-page-site';
		buildOptions.outputPath = 'test/fixtures/single-page-site/dist';
		buildOptions.templatePath = 'test/fixtures/template-example/';
		const writr = new Writr(buildOptions);
		const consoleLog = console.log;
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		console.log = message => {};

		process.argv = ['node', 'writr'];
		await writr.execute(process);

		expect(fs.existsSync(buildOptions.outputPath)).toEqual(true);

		fs.rmdirSync(buildOptions.outputPath, {recursive: true});
		console.log = consoleLog;
	});
	it('should be able to execute with output parameter', async () => {
		const buildOptions = new WritrOptions();
		buildOptions.sitePath = 'test/fixtures/single-page-site';
		buildOptions.outputPath = 'test/fixtures/single-page-site/dist-foo';
		buildOptions.templatePath = 'test/fixtures/template-example/';
		const realOutputPath = 'test/fixtures/single-page-site/dist1';
		const writr = new Writr(buildOptions);
		const consoleLog = console.log;
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		console.log = message => {};

		process.argv = ['node', 'writr', '-o', realOutputPath];
		await writr.execute(process);

		expect(fs.existsSync(realOutputPath)).toEqual(true);

		fs.rmdirSync(realOutputPath, {recursive: true});
		console.log = consoleLog;
	});
	it('should init based on the init command', async () => {
		const writr = new Writr(defaultOptions);
		const sitePath = './custom-site';
		let consoleMessage = '';
		const consoleLog = console.log;
		console.log = message => {
			consoleMessage = message;
		};

		process.argv = ['node', 'writr', 'init', '-s', sitePath];
		try {
			await writr.execute(process);
			expect(fs.existsSync(sitePath)).toEqual(true);
			expect(fs.existsSync(`${sitePath}/writr.config.ts`)).toEqual(true);
			expect(consoleMessage).toContain('Writr initialized.');
		} finally {
			fs.rmdirSync(sitePath, {recursive: true});
			console.log = consoleLog;
		}
	});
	it('should print help command', async () => {
		const writr = new Writr(defaultOptions);
		const consoleLog = console.log;
		let consoleMessage = '';
		process.argv = ['node', 'writr', 'help'];
		console.log = message => {
			if (typeof message === 'string' && message.includes('Usage:')) {
				consoleMessage = message;
			}
		};

		await writr.execute(process);
		expect(consoleMessage).toContain('Usage:');
		console.log = consoleLog;
	});
	it('should show version by the version command', async () => {
		const writr = new Writr(defaultOptions);
		const consoleLog = console.log;
		let consoleMessage = '';
		process.argv = ['node', 'writr', 'version'];
		console.log = message => {
			if (typeof message === 'string') {
				consoleMessage = message;
			}
		};

		await writr.execute(process);
		expect(consoleMessage).toContain('.');
		console.log = consoleLog;
	});
	it('should serve the site', async () => {
		const options = new WritrOptions();
		options.sitePath = 'test/fixtures/single-page-site';
		options.outputPath = 'test/fixtures/single-page-site/dist3';
		const writr = new Writr(options);
		process.argv = ['node', 'writr', 'serve'];

		try {
			await writr.execute(process);
		} finally {
			fs.rmdirSync(options.outputPath, {recursive: true});
			if (writr.server) {
				writr.server.close();
			}
		}
	});
	it('should serve the site and reset the server if exists', async () => {
		const options = new WritrOptions();
		options.sitePath = 'test/fixtures/single-page-site';
		options.outputPath = 'test/fixtures/single-page-site/dist3';
		const writr = new Writr(options);
		process.argv = ['node', 'writr', 'serve'];

		try {
			await writr.serve(options);
			await writr.execute(process);
		} finally {
			fs.rmdirSync(options.outputPath, {recursive: true});
			if (writr.server) {
				writr.server.close();
			}
		}
	});
	it('should serve the site on a specified port', async () => {
		const options = new WritrOptions();
		options.sitePath = 'test/fixtures/single-page-site';
		options.outputPath = 'test/fixtures/single-page-site/dist3';
		const writr = new Writr(options);
		process.argv = ['node', 'writr', 'serve', '-p', '8181'];

		try {
			await writr.execute(process);

			expect(writr.server).toBeDefined();
		} finally {
			fs.rmdirSync(options.outputPath, {recursive: true});
			if (writr.server) {
				writr.server.close();
			}
		}
	});
});

describe('writr config file', () => {
	it('should be able to load the config file', async () => {
		const writr = new Writr(defaultOptions);
		const sitePath = 'test/fixtures/multi-page-site';
		await writr.loadConfigFile(sitePath);
		expect(writr.configFileModule).toBeDefined();
		expect(writr.configFileModule.options).toBeDefined();
	});
	it('should load the config and set the options', async () => {
		const writr = new Writr(defaultOptions);
		const sitePath = 'test/fixtures/multi-page-site';
		await writr.loadConfigFile(sitePath);
		expect(writr.configFileModule).toBeDefined();
		expect(writr.configFileModule.options).toBeDefined();
		const consoleLog = console.log;
		let consoleMessage = '';
		console.log = message => {
			if (typeof message === 'string') {
				consoleMessage = message;
			}
		};

		process.argv = ['node', 'writr', 'version'];
		await writr.execute(process);
		expect(writr.options.outputPath).toEqual(writr.configFileModule.options.outputPath);
		console.log = consoleLog;
	});
	it('should load the config and test the onPrepare', async () => {
		const writr = new Writr(defaultOptions);
		const sitePath = 'test/fixtures/single-page-site';
		await writr.loadConfigFile(sitePath);
		expect(writr.configFileModule).toBeDefined();
		expect(writr.configFileModule.options).toBeDefined();
		const consoleLog = console.log;
		let consoleMessage = '';
		console.log = message => {
			if (typeof message === 'string') {
				consoleMessage = message;
			}
		};

		process.argv = ['node', 'writr', 'version'];
		await writr.execute(process);
		expect(writr.options.outputPath).toEqual(writr.configFileModule.options.outputPath);
		console.log = consoleLog;
	});
	it('should throw error onPrepare', async () => {
		const writr = new Writr(defaultOptions);
		writr.options.sitePath = 'test/fixtures/single-page-site-error';
		const consoleLog = console.log;
		let consoleMessage = '';
		console.log = message => {
			if (typeof message === 'string') {
				consoleMessage = message;
			}
		};

		const consoleError = console.error;
		let consoleErrorMessage = '';
		console.error = message => {
			if (typeof message === 'string') {
				consoleErrorMessage = message;
			}
		};

		process.argv = ['node', 'writr', 'version'];
		try {
			await writr.execute(process);
			expect.fail('Should have thrown an error');
		} catch (error) {
			expect(error).toBeDefined();
		}

		console.log = consoleLog;
		console.error = consoleError;
	});
});

import process from 'node:process';
import {expect, it, describe} from 'vitest';
import fs from 'fs-extra';
import Writr, {WritrHelpers} from '../src/writr.js';
import {WritrOptions} from '../src/options.js';

const defaultOptions: WritrOptions = new WritrOptions({
	templatePath: './custom-template',
	outputPath: './custom-dist',
	sitePath: './custom-site',
	githubPath: 'custom/repo',
	siteTitle: 'Custom Title',
	siteDescription: 'Custom Description',
	siteUrl: 'https://custom-url.com',
});

describe('writr', () => {
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
	it('if no parameters then it should build', () => {
		const writr = new Writr(defaultOptions);
		const consoleLog = console.log;
		let consoleMessage = '';

		console.log = message => {
			if (typeof message === 'string' && message.includes('Build')) {
				consoleMessage = message;
			}
		};

		writr.execute(process);

		expect(consoleMessage).toContain('Build');
		console.log = consoleLog;
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
			/* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */
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
			/* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */
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
	it('should be able to execute with no parameters', () => {
		const writr = new Writr(defaultOptions);
		const consoleLog = console.log;
		let consoleMessage = '';

		console.log = message => {
			if (typeof message === 'string' && message.includes('Build')) {
				consoleMessage = message;
			}
		};

		writr.execute(process);

		expect(consoleMessage).toContain('Build');
		console.log = consoleLog;
	});
	it('should init based on the init command', () => {
		const writr = new Writr(defaultOptions);
		const sitePath = './custom-site';
		let consoleMessage = '';
		const consoleLog = console.log;
		console.log = message => {
			/* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */
			consoleMessage = message;
		};

		process.argv = ['node', 'writr', 'init', '-s', sitePath];
		try {
			writr.execute(process);
			expect(fs.existsSync(sitePath)).toEqual(true);
			expect(fs.existsSync(`${sitePath}/writr.config.ts`)).toEqual(true);
			expect(consoleMessage).toContain('Writr initialized.');
		} finally {
			fs.rmdirSync(sitePath, {recursive: true});
			console.log = consoleLog;
		}
	});
	it('should build based on the build command', () => {
		const writr = new Writr(defaultOptions);
		const sitePath = './custom-site/dist';
		const consoleLog = console.log;
		let consoleMessage = '';
		process.argv = ['node', 'writr', 'build', '-o', sitePath];
		console.log = message => {
			if (typeof message === 'string' && message.includes('Build')) {
				consoleMessage = message;
			}
		};

		writr.execute(process);
		expect(consoleMessage).toContain('Build');
		console.log = consoleLog;
	});
	it('should print help command', () => {
		const writr = new Writr(defaultOptions);
		const consoleLog = console.log;
		let consoleMessage = '';
		process.argv = ['node', 'writr', 'help'];
		console.log = message => {
			if (typeof message === 'string' && message.includes('Usage:')) {
				consoleMessage = message;
			}
		};

		writr.execute(process);
		expect(consoleMessage).toContain('Usage:');
		console.log = consoleLog;
	});
	it('should show version by the version command', () => {
		const writr = new Writr(defaultOptions);
		const consoleLog = console.log;
		let consoleMessage = '';
		process.argv = ['node', 'writr', 'version'];
		console.log = message => {
			if (typeof message === 'string') {
				consoleMessage = message;
			}
		};

		writr.execute(process);
		expect(consoleMessage).toContain('.');
		console.log = consoleLog;
	});
	it('should execute serve based on the serve command', () => {
		const writr = new Writr(defaultOptions);
		const consoleLog = console.log;
		let consoleMessage = '';
		process.argv = ['node', 'writr', 'serve'];
		console.log = message => {
			if (typeof message === 'string') {
				consoleMessage = message;
			}
		};

		writr.execute(process);
		expect(consoleMessage).toContain('Serve');
		console.log = consoleLog;
	});
});

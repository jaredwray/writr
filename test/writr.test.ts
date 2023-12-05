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
	it('if no parameters then it should print help', () => {
		const writr = new Writr(defaultOptions);
		const consoleLog = console.log;

		const messages = [];
		console.log = message => {
			messages.push(message);
		};

		writr.execute(process);

		expect(messages.length).toEqual(17);
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
});

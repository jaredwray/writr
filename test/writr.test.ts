import {expect, it, describe} from 'vitest';
import {Writr} from '../src/writr.js';
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
		expect(writr.helpers).toBeDefined();
	});
	it('should be able to get the helpers via static', () => {
		const writr = new Writr(defaultOptions);
		expect(writr.helpers.createDoc).toBeDefined();
	});
});

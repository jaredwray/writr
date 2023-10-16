import {expect, it, describe} from 'vitest';
import {Writr} from '../src/writr.js';
import {WritrOptions} from '../src/options.js';

describe('writr', () => {
	it('should be able to initialize', () => {
		const writr = new Writr();
		expect(writr).toBeDefined();
	});
	it('should be able to initialize with options', () => {
		const options: WritrOptions = new WritrOptions({
			templatePath: './custom-template',
			outputPath: './custom-dist',
			sitePath: './custom-site',
			githubPath: 'custom/repo',
			siteTitle: 'Custom Title',
			siteDescription: 'Custom Description',
			siteUrl: 'https://custom-url.com',
		});
		const writr = new Writr(options);
		expect(writr).toBeDefined();
	});
	it('should be able to get and set options', () => {
		const options: WritrOptions = new WritrOptions({
			templatePath: './custom-template',
			outputPath: './custom-dist',
			sitePath: './custom-site',
			githubPath: 'custom/repo',
			siteTitle: 'Custom Title',
			siteDescription: 'Custom Description',
			siteUrl: 'https://custom-url.com',
		});
		const writr = new Writr(options);
		expect(writr.options).toEqual(options);
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
});

import {expect, it, beforeEach, describe} from 'vitest';
import {WritrOptions} from '../src/options.js';

describe('WritrOptions', () => {
	describe('constructor', () => {
		it('should create an instance of WritrOptions with default values', () => {
			const options = new WritrOptions();
			expect(options.templatePath).toEqual('./template');
			expect(options.outputPath).toEqual('./dist');
			expect(options.sitePath).toEqual('./site');
			expect(options.githubPath).toEqual('jaredwray/writr');
			expect(options.siteTitle).toEqual('Writr');
			expect(options.siteDescription).toEqual('Beautiful Website for Your Projects');
			expect(options.siteUrl).toEqual('https://writr.org');
		});

		it('should create an instance of WritrOptions with custom values', () => {
			const options = new WritrOptions({
				templatePath: './custom-template',
				outputPath: './custom-dist',
				sitePath: './custom-site',
				githubPath: 'custom/repo',
				siteTitle: 'Custom Title',
				siteDescription: 'Custom Description',
				siteUrl: 'https://custom-url.com',
			});
			expect(options.templatePath).toEqual('./custom-template');
			expect(options.outputPath).toEqual('./custom-dist');
			expect(options.sitePath).toEqual('./custom-site');
			expect(options.githubPath).toEqual('custom/repo');
			expect(options.siteTitle).toEqual('Custom Title');
			expect(options.siteDescription).toEqual('Custom Description');
			expect(options.siteUrl).toEqual('https://custom-url.com');
		});
	});

	describe('getters and setters', () => {
		let options: WritrOptions;

		beforeEach(() => {
			options = new WritrOptions();
		});

		it('should set and get the templatePath', () => {
			options.templatePath = './custom-template';
			expect(options.templatePath).toEqual('./custom-template');
		});

		it('should set and get the outputPath', () => {
			options.outputPath = './custom-dist';
			expect(options.outputPath).toEqual('./custom-dist');
		});

		it('should set and get the sitePath', () => {
			options.sitePath = './custom-site';
			expect(options.sitePath).toEqual('./custom-site');
		});

		it('should set and get the githubPath', () => {
			options.githubPath = 'custom/repo';
			expect(options.githubPath).toEqual('custom/repo');
		});

		it('should set and get the siteTitle', () => {
			options.siteTitle = 'Custom Title';
			expect(options.siteTitle).toEqual('Custom Title');
		});

		it('should set and get the siteDescription', () => {
			options.siteDescription = 'Custom Description';
			expect(options.siteDescription).toEqual('Custom Description');
		});

		it('should set and get the siteUrl', () => {
			options.siteUrl = 'https://custom-url.com';
			expect(options.siteUrl).toEqual('https://custom-url.com');
		});
	});

	describe('parseOptions', () => {
		let options: WritrOptions;

		beforeEach(() => {
			options = new WritrOptions();
		});

		it('should parse options and update the instance', () => {
			options.parseOptions({
				templatePath: './custom-template',
				outputPath: './custom-dist',
				sitePath: './custom-site',
				githubPath: 'custom/repo',
				siteTitle: 'Custom Title',
				siteDescription: 'Custom Description',
				siteUrl: 'https://custom-url.com',
			});
			expect(options.templatePath).toEqual('./custom-template');
			expect(options.outputPath).toEqual('./custom-dist');
			expect(options.sitePath).toEqual('./custom-site');
			expect(options.githubPath).toEqual('custom/repo');
			expect(options.siteTitle).toEqual('Custom Title');
			expect(options.siteDescription).toEqual('Custom Description');
			expect(options.siteUrl).toEqual('https://custom-url.com');
		});
	});
});

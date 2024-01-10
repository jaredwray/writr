import {expect, it, describe, vi} from 'vitest';
import * as fs from 'fs-extra';
import axios from 'axios';
import {WritrBuilder, type WritrData} from '../src/builder.js';
import {WritrOptions} from '../src/options.js';

describe('WritrBuilder', () => {
	const writrData: WritrData = {
		siteUrl: 'http://foo.com',
		siteTitle: 'Writr',
		siteDescription: 'Beautiful Website for Your Projects',
		sitePath: 'test/fixtures/single-page-site',
		templatePath: 'test/fixtures/template-example',
		outputPath: 'test/temp-sitemap-test',
	};

	it('should initiate', () => {
		const builder = new WritrBuilder();
		expect(builder).toBeTruthy();
	});
	it('should initiate with options', () => {
		const options = new WritrOptions();
		const builder = new WritrBuilder(options);
		expect(builder).toBeTruthy();
		expect(builder.options).toBe(options);
	});
	it('should build', async () => {
		const builder = new WritrBuilder();
		const consoleLog = console.log;
		const options = new WritrOptions();
		options.outputPath = 'test/temp-build-test';
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
	it('should validate githubPath options', async () => {
		const builder = new WritrBuilder();
		const options = new WritrOptions();
		try {
			options.githubPath = '';
			builder.validateOptions(options);
		} catch (error: any) {
			expect(error.message).toBe('No github options provided');
		}
	});
	it('should validate siteDescription options', async () => {
		const builder = new WritrBuilder();
		const options = new WritrOptions();
		try {
			options.siteDescription = '';
			builder.validateOptions(options);
		} catch (error: any) {
			expect(error.message).toBe('No site description options provided');
		}
	});
	it('should validate site title options', async () => {
		const builder = new WritrBuilder();
		const options = new WritrOptions();
		try {
			options.siteTitle = '';
			builder.validateOptions(options);
		} catch (error: any) {
			expect(error.message).toBe('No site title options provided');
		}
	});
	it('should validate site url options', async () => {
		const builder = new WritrBuilder();
		const options = new WritrOptions();
		try {
			options.siteUrl = '';
			builder.validateOptions(options);
		} catch (error: any) {
			expect(error.message).toBe('No site url options provided');
		}
	});
	it('should get github data', async () => {
		const builder = new WritrBuilder();
		vi.spyOn(axios, 'get').mockResolvedValue({data: {}});
		const githubData = await builder.getGithubData('jaredwray/writr');
		expect(githubData).toBeTruthy();
		vi.resetAllMocks();
	});
	it('should get the file without extension', async () => {
		const builder = new WritrBuilder();
		const file = await builder.getTemplateFile('test/fixtures/template-example/', 'index');
		expect(file).toBe('index.hbs');
	});
	it('should not get the file without extension', async () => {
		const builder = new WritrBuilder();
		const file = await builder.getTemplateFile('test/fixtures/template-example/', 'foo');
		expect(file).toBe(undefined);
	});
	it('should get the template data', async () => {
		const builder = new WritrBuilder();
		const options = new WritrOptions();
		options.templatePath = 'test/fixtures/template-example/';
		const templateData = await builder.getTemplates(options);
		expect(templateData.releases).toBe('releases.handlebars');
	});
	it('should throw error when template path doesnt exist', async () => {
		const builder = new WritrBuilder();
		const options = new WritrOptions();
		options.templatePath = 'test/fixtures/template-example1/';
		try {
			await builder.getTemplates(options);
		} catch (error: any) {
			expect(error.message).toBe('No template path found');
		}
	});
	it('should build the robots.txt (/robots.txt)', async () => {
		const builder = new WritrBuilder();
		const options = new WritrOptions();
		options.sitePath = 'test/fixtures/single-page-site';
		options.outputPath = 'test/temp-robots-test';

		await fs.remove(options.outputPath);
		try {
			await builder.buildRobotsPage(options);
			const robots = await fs.readFile(`${options.outputPath}/robots.txt`, 'utf8');
			expect(robots).toBe('User-agent: *\nDisallow:');
		} finally {
			await fs.remove(options.outputPath);
		}
	});
	it('should copy the robots.txt (/robots.txt)', async () => {
		const builder = new WritrBuilder();
		const options = new WritrOptions();
		options.sitePath = 'test/fixtures/multi-page-site';
		options.outputPath = 'test/temp-robots-test-copy';

		await fs.remove(options.outputPath);
		try {
			await builder.buildRobotsPage(options);
			const robots = await fs.readFile(`${options.outputPath}/robots.txt`, 'utf8');
			expect(robots).toBe('User-agent: *\nDisallow: /meow');
		} finally {
			await fs.remove(options.outputPath);
		}
	});
	it('should build the sitemap.xml (/sitemap.xml)', async () => {
		const builder = new WritrBuilder();
		const data = writrData;

		await fs.remove(data.outputPath);
		try {
			await builder.buildSiteMapPage(data);
			const sitemap = await fs.readFile(`${data.outputPath}/sitemap.xml`, 'utf8');
			expect(sitemap).toContain('<loc>http://foo.com</loc>');
		} finally {
			await fs.remove(data.outputPath);
		}
	});
	it('should build the index.html (/index.html)', async () => {
		const builder = new WritrBuilder();
		const data = writrData;
		data.templates = {
			index: 'index.hbs',
			releases: 'releases.hbs',
		};
		data.sitePath = 'site';
		data.templatePath = 'template';
		data.outputPath = 'test/temp-index-test';

		await fs.remove(data.outputPath);
		try {
			await builder.buildIndexPage(data);
			const index = await fs.readFile(`${data.outputPath}/index.html`, 'utf8');
			expect(index).toContain('<title>Writr</title>');
		} finally {
			await fs.remove(data.outputPath);
		}
	});
	it('should throw an error build the index.html (/index.html)', async () => {
		const builder = new WritrBuilder();
		const data = writrData;
		data.sitePath = 'template';
		data.outputPath = 'test/temp-index-test';
		data.templates = undefined;

		try {
			await builder.buildIndexPage(data);
		} catch (error: any) {
			expect(error.message).toBe('No templates found');
		} finally {
			await fs.remove(data.outputPath);
		}
	});
	it('should build release page (/releases/index.html)', async () => {
		const builder = new WritrBuilder();
		const data = writrData;
		data.templates = {
			index: 'index.hbs',
			releases: 'releases.hbs',
		};
		data.sitePath = 'site';
		data.templatePath = 'template';
		data.outputPath = 'test/temp-release-test';

		data.github = {
			releases: {},
			contributors: {},
		};

		await fs.remove(data.outputPath);
		try {
			await builder.buildReleasePage(data);
			const index = await fs.readFile(`${data.outputPath}/releases/index.html`, 'utf8');
			expect(index).toContain('<title>Writr Releases</title>');
		} finally {
			await fs.remove(data.outputPath);
		}
	});
	it('should error on build release page (/releases/index.html)', async () => {
		const builder = new WritrBuilder();
		const data = writrData;
		data.templates = {
			index: 'index.hbs',
			releases: 'releases.hbs',
		};
		data.sitePath = 'site';
		data.templatePath = 'template';
		data.outputPath = 'test/temp-release-test';

		data.github = undefined;

		await fs.remove(data.outputPath);
		try {
			await builder.buildReleasePage(data);
		} catch (error: any) {
			expect(error.message).toBe('No github data found');
		} finally {
			await fs.remove(data.outputPath);
		}
	});
});

import {expect, it, describe} from 'vitest';
import {WritrBuilder} from '../src/builder.js';
import {WritrOptions} from '../src/options.js';

describe('WritrBuilder', () => {
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
		let consoleMessage = '';
		console.log = message => {
			consoleMessage = message as string;
		};

		await builder.build();

		expect(consoleMessage).toBe('build');

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
		const githubData = await builder.getGithubData('jaredwray/writr');
		expect(githubData).toBeTruthy();
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
});

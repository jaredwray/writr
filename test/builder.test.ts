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
});

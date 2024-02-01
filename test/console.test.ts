import {expect, it, describe} from 'vitest';
import {WritrConsole} from '../src/console.js';

describe('WritrConsole', () => {
	it('should be able to log', () => {
		const consoleLog = console.log;
		console.log = message => {
			expect(message).toEqual('Hello World');
		};

		const c = new WritrConsole();
		c.log('Hello World');
		console.log = consoleLog;
	});
	it('should be able to log error', () => {
		const consoleLog = console.error;
		console.error = message => {
			expect(message).toEqual('Hello World');
		};

		const c = new WritrConsole();
		c.error('Hello World');
		console.error = consoleLog;
	});
	it('should be able to log error', () => {
		const consoleLog = console.warn;
		console.warn = message => {
			expect(message).toEqual('Hello World');
		};

		const c = new WritrConsole();
		c.warn('Hello World');
		console.warn = consoleLog;
	});
	it('should be able to print help', () => {
		const consoleLog = console.log;
		const messages = new Array<string>();
		console.log = message => {
			messages.push(message as string);
		};

		const c = new WritrConsole();
		c.printHelp();
		expect(messages.length).toEqual(19);

		console.log = consoleLog;
	});
	it('should be able to parse process argv', () => {
		const c = new WritrConsole();
		const result = c.parseProcessArgv(['node', 'writr', 'build', '-w', '-s', './site', '-o', './site/dist', '-p', '8080', '-t', './site/template']);
		expect(result.argv.length).toEqual(12);
		expect(result.command).toEqual('build');
		expect(result.args.watch).toEqual(true);
		expect(result.args.templatePath).toContain('/site/template');
		expect(result.args.sitePath).toContain('/site');
		expect(result.args.output).toContain('/site/dist');
		expect(result.args.port).toEqual(8080);
	});
	it('should be able to parse process templatePath', () => {
		const c = new WritrConsole();
		const result = c.parseProcessArgv(['node', 'writr', 'build', '--templatePath', './site/dist', '-p', '8080']);
		expect(result.command).toEqual('build');
		expect(result.args.templatePath).toContain('/site/dist');
	});
	it('should be able to parse serve', () => {
		const c = new WritrConsole();
		const commands = ['serve', 'build', 'help', 'version', 'init'];
		for (const command of commands) {
			const result = c.parseProcessArgv(['node', 'writr', command]);
			expect(result.command).toEqual(command);
		}
	});
});

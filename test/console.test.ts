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
		const messages = [];
		console.log = message => {
			messages.push(message);
		};

		const c = new WritrConsole();
		c.printHelp();
		expect(messages.length).toEqual(17);

		console.log = consoleLog;
	});
});

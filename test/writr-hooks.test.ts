
import fs from 'node:fs';
import {
	test, describe, expect,
} from 'vitest';
import {Writr, WritrHooks} from '../src/writr.js';

describe('Writr Render Hooks', async () => {
	test('it should change the content before rendering', async () => {
		const writr = new Writr('Hello, World!');
		writr.onHook(WritrHooks.beforeRender, data => {
			data.body = 'Hello, Universe!';
		});
		const result = await writr.render();
		expect(result).toBe('<p>Hello, Universe!</p>');
	});

	test('it should change the content before rendering sync', () => {
		const writr = new Writr('Hello, World!');
		writr.onHook(WritrHooks.beforeRender, data => {
			data.body = 'Hello, Sync!';
		});
		const result = writr.renderSync();
		expect(result).toBe('<p>Hello, Sync!</p>');
	});

	test('it should change the content before saving to file', async () => {
		const filePath = './test-save-to-file.txt';
		const writr = new Writr('Hello, World!');
		writr.onHook(WritrHooks.saveToFile, data => {
			data.content = 'Hello, File!';
		});
		await writr.saveToFile(filePath);
		await writr.loadFromFile(filePath);

		expect(writr.content).toBe('Hello, File!');

		// Cleanup
		await fs.promises.rm(filePath);
	});

	test('it should change the content before saving to file sync', async () => {
		const filePath = './test-save-to-file-sync.txt';
		const writr = new Writr('Hello, World!');
		writr.onHook(WritrHooks.saveToFile, data => {
			data.content = 'Hello, File Sync!';
		});
		writr.saveToFileSync(filePath);
		writr.loadFromFileSync(filePath);

		expect(writr.content).toBe('Hello, File Sync!');

		// Cleanup
		await fs.promises.rm(filePath);
	});

	test('it should change the content before render to file', async () => {
		const filePath = './test-render-to-file.txt';
		const writr = new Writr('Hello, World!');
		writr.onHook(WritrHooks.renderToFile, data => {
			data.content = 'Hello, File!';
		});
		await writr.renderToFile(filePath);
		const fileContent = await fs.promises.readFile(filePath);

		expect(fileContent.toString()).toContain('Hello, File!');

		// Cleanup
		await fs.promises.rm(filePath);
	});

	test('it should change the content before render to file sync', async () => {
		const filePath = './test-render-to-file-sync.txt';
		const writr = new Writr('Hello, World!');
		writr.onHook(WritrHooks.renderToFile, data => {
			data.content = 'Hello, File Sync!';
		});
		writr.renderToFileSync(filePath);
		const fileContent = await fs.promises.readFile(filePath);

		expect(fileContent.toString()).toContain('Hello, File Sync!');

		// Cleanup
		await fs.promises.rm(filePath);
	});

	test('it should change the content after loading from file', async () => {
		const filePath = './test/fixtures/load-from-file.md';
		const content = 'Hello, Loaded!';
		const writr = new Writr();
		writr.onHook(WritrHooks.loadFromFile, data => {
			data.content = content;
		});
		await writr.loadFromFile(filePath);
		expect(writr.content).toBe(content);
	});

	test('it should change the content after loading from file sync', () => {
		const filePath = './test/fixtures/load-from-file.md';
		const content = 'Hello, Loaded!';
		const writr = new Writr();
		writr.onHook(WritrHooks.loadFromFile, data => {
			data.content = content;
		});
		writr.loadFromFileSync(filePath);
		expect(writr.content).toBe(content);
	});
});

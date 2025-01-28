
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
		writr.onHook(WritrHooks.beforeSaveToFile, data => {
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
		writr.onHook(WritrHooks.beforeSaveToFile, data => {
			data.content = 'Hello, File Sync!';
		});
		writr.saveToFileSync(filePath);
		writr.loadFromFileSync(filePath);

		expect(writr.content).toBe('Hello, File Sync!');

		// Cleanup
		await fs.promises.rm(filePath);
	});
});

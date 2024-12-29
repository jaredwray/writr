
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
});

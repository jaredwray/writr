
import {it, describe, expect} from 'vitest';
import {Writr} from '../src/writr.js';

describe('writr', () => {
	it('should be able to initialize', () => {
		const writr = new Writr();
		expect(writr).toBeDefined();
	});

	it('should be able to set options', () => {
		const options = {
			emoji: false,
			toc: false,
			slug: false,
			highlight: false,
			gfm: false,
		};
		const writr = new Writr(options);
		expect(writr.options).toBeDefined();
		expect(writr.options.emoji).toEqual(false);
		expect(writr.options.toc).toEqual(false);
		expect(writr.options.slug).toEqual(false);
		expect(writr.options.highlight).toEqual(false);
		expect(writr.options.gfm).toEqual(false);
	});

	it('should be able to set options on emoji', () => {
		const options = {
			emoji: true,
		};
		const writr = new Writr(options);
		expect(writr.options.emoji).toEqual(true);
	});
	it('should be able to set options on toc', () => {
		const options = {
			toc: true,
		};
		const writr = new Writr(options);
		expect(writr.options.toc).toEqual(true);
	});
	it('should render a simple markdown example', async () => {
		const writr = new Writr();
		const result = await writr.render('# Hello World');
		expect(result).toEqual('<h1 id="hello-world">Hello World</h1>');
	});
	it('should render a simple markdown example with options', async () => {
		const writr = new Writr();
		const options = {
			slug: false,
		};
		const result = await writr.render('# Hello World', options);
		expect(result).toEqual('<h1>Hello World</h1>');
	});
	it('should throw an error on bad plugin or parsing', async () => {
		const writr = new Writr();
		const customPlugin = () => {
			throw new Error('Custom Plugin Error: Required configuration missing.');
		};

		writr.engine.use(customPlugin);
		try {
			await writr.render('# Hello World');
		} catch (error) {
			expect((error as Error).message).toEqual('Failed to render markdown: Custom Plugin Error: Required configuration missing.');
		}
	});
});

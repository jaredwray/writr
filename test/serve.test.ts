import {Serve} from "../src/serve";

describe('Serve', () => {

	const config = {
		output: './test_output',
		port: '3000',
		path: './blog_example'
	}

	const options = {
		opts: () => {
			return config
		}
	}

	const watchOptions = {
		opts: () => {
			return {...config, watch: true}
		}
	}

	it('should serve the baseDir folder', async () => {

		const serve = new Serve(options);

		serve.bs = {
			init: jest.fn()
		}

		serve.run();

		expect(serve.bs.init).toHaveBeenCalled();
	})

	it('should watch the baseDir folder', async () => {

		const serve = new Serve(watchOptions);

		serve.bs = {
			init: jest.fn(),
			watch: jest.fn()
		}

		serve.run();

		expect(serve.bs.watch).toHaveBeenCalled();
	})

	it('should build site and reload', async () => {

		const serve = new Serve(watchOptions);
		serve.generator.run = jest.fn();
		serve.bs.reload = jest.fn();

		await serve.buildAndReload();

		expect(serve.bs.reload).toHaveBeenCalled();
		expect(serve.generator.run).toHaveBeenCalled();
	})

})

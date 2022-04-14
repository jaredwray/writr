import * as fs from "fs-extra";
import {SiteGenerator} from "../src/generator";
import {Config} from "../src/config";
import {ConsoleMessage} from "../src/log";

describe('SiteGenerator', () => {

	jest.spyOn(ConsoleMessage.prototype, 'info').mockImplementation(() => {});

	const options = {
		opts: () => {
			return {
				config: './blog_example/config.json',
				path: './blog_example/',
			}
		}
	}

	it('should save the config data successfully', async () => {
		const params = options.opts();
		const generator = new SiteGenerator(options);
		const config = new Config();
		config.loadConfig(params.config);
		config.loadPath(params.path);
		expect(generator.config?.path).toEqual(config.path);
	})

	it('should generate the site successfully', async () => {
		const generator = new SiteGenerator(options);
		const val = await generator.run();
		expect(val).toBeTruthy();

		fs.removeSync('./blog_output/');
	})

	it('should return false when does not exist data and config', async () => {
		const generator = new SiteGenerator(options);
		generator.data = undefined;
		generator.config = undefined;
		const val = await generator.run();
		expect(val).toBeFalsy();
	})

})

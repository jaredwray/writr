import fs from 'fs-extra';
import {WritrOptions} from './options.js';
import {WritrConsole} from './console.js';

export default class Writr {
	private _options: WritrOptions = new WritrOptions();
	private readonly _console: WritrConsole = new WritrConsole();

	constructor(options?: WritrOptions) {
		if (options) {
			this._options = options;
		}
	}

	public get options(): WritrOptions {
		return this._options;
	}

	public set options(value: WritrOptions) {
		this._options = value;
	}

	public execute(process: NodeJS.Process): void {
		// Get the arguments
		const args = process.argv.slice(2);

		if (args.length === 0) {
			this._console.printHelp();
		}
	}

	public isSinglePageWebsite(sitePath: string): boolean {
		const docsPath = `${sitePath}/docs`;
		if (!fs.existsSync(docsPath)) {
			return true;
		}

		const files = fs.readdirSync(docsPath);
		return files.length === 0;
	}

	public generateInit(sitePath: string, isTypescript: boolean): void {
		// Check if the site path exists
		if (!fs.existsSync(sitePath)) {
			fs.mkdirSync(sitePath);
		}

		// Add the writr.config file based on js or ts
		const writrConfigFile = isTypescript ? './init/writr.config.ts' : './init/writr.config.js';
		fs.copyFileSync(writrConfigFile, `${sitePath}/writr.config.${isTypescript ? 'ts' : 'js'}`);

		// Add in the image and favicon
		fs.copyFileSync('./init/logo.png', `${sitePath}/logo.png`);
		fs.copyFileSync('./init/favicon.svg', `${sitePath}/favicon.svg`);

		// Output the instructions
		this._console.log(`Writr initialized. Please update the ${writrConfigFile} file with your site information. In addition, you can replace the image, favicon, and stype the site with site.css file.`);
	}
}

export {WritrHelpers} from './helpers.js';

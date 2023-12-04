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
		console.log(files);
		return files.length === 0;
	}
}

export {WritrHelpers} from './helpers.js';

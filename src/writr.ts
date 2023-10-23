import {WritrOptions} from './options.js';
import {WritrHelpers} from './helpers.js';
import {WritrConsole} from './console.js';

export class Writr {
	private _options: WritrOptions = new WritrOptions();
	private readonly _helpers: WritrHelpers = new WritrHelpers();
	private _console: WritrConsole = new WritrConsole();

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

	public get helpers(): WritrHelpers {
		return this._helpers;
	}

	public parseCLI(process: NodeJS.Process): void {
		//get the arguments
		const args = process.argv.slice(2);

		if(args.length === 0) {
			this._console.printHelp();
			return;
		}
	}
}

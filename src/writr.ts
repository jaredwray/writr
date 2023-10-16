import {WritrOptions} from './options.js';
import {WritrHelpers} from './helpers.js';

export class Writr {
	private _options: WritrOptions = new WritrOptions();
	private readonly _helpers: WritrHelpers = new WritrHelpers();

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
}

import {WritrOptions} from './options.js';

export class Writr {
	private _options: WritrOptions = new WritrOptions();

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
}

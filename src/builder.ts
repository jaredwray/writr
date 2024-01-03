import {Ecto} from 'ecto';
import {WritrOptions} from './options.js';
import {type GithubData} from './github.js';

export type WritrData = {
	github: GithubData;
};

export class WritrBuilder {
	private readonly _options: WritrOptions = new WritrOptions();
	private readonly _ecto: Ecto = new Ecto();
	constructor(options?: WritrOptions) {
		if (options) {
			this._options = options;
		}
	}

	public get options(): WritrOptions {
		return this._options;
	}

	public async build(): Promise<void> {
		// Validate the options
		this.validateOptions(this.options);
		// Get data from github

		// get data of the site

		// get the templates to use

		// build the home page (index.html)

		// build the releases page (/releases/index.html)

		// build the rss feed (/rss.xml)

		// build the sitemap (/sitemap.xml)

		// build the robots.txt (/robots.txt)
		console.log('build');
	}

	public validateOptions(options: WritrOptions): void {
		if (options.githubPath.length < 3) {
			throw new Error('No github options provided');
		}

		if (options.siteDescription.length < 3) {
			throw new Error('No site description options provided');
		}

		if (!options.siteTitle) {
			throw new Error('No site title options provided');
		}

		if (!options.siteUrl) {
			throw new Error('No site url options provided');
		}
	}
}

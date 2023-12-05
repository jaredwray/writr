import fs from 'fs-extra';
import updateNotifier from 'update-notifier';
import packageJson from '../package.json';
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
		// Check for updates
		updateNotifier({pkg: packageJson}).notify();

		const consoleProcess = this._console.parseProcessArgv(process.argv);

		// Update options
		if (consoleProcess.args.site) {
			this.options.sitePath = consoleProcess.args.site;
		}

		if (consoleProcess.args.output) {
			this.options.outputPath = consoleProcess.args.output;
		}

		switch (consoleProcess.command) {
			case 'init': {
				const isTypescript = fs.existsSync('./tsconfig.json') ?? false;
				this.generateInit(this.options.sitePath, isTypescript);
				break;
			}

			case 'help': {
				this._console.printHelp();
				break;
			}

			case 'version': {
				this._console.log(this.getVersion());
				break;
			}

			case 'build': {
				this._console.log('Build');
				break;
			}

			case 'serve': {
				this._console.log('Serve');
				break;
			}

			default: {
				this._console.log('Build');
				break;
			}
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

	public getVersion(): string {
		const packageJson = fs.readFileSync('./package.json', 'utf8');
		const packageObject = JSON.parse(packageJson) as {version: string};
		return packageObject.version;
	}
}

export {WritrHelpers} from './helpers.js';

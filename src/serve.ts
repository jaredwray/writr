import browserSync from 'browser-sync';
import {SiteGenerator} from "./generator.js";

type Params = {
	output: string;
	port: string;
	watch: boolean;
	path: string;
}

export class Serve {

	bs: any;
	params: Params;
	generator: SiteGenerator;

	constructor(options: any) {
		this.bs = browserSync.create();
		this.params = options.opts();
		this.generator = new SiteGenerator(options);
	}

	async buildAndReload() {
		await this.generator.run();
		this.bs.reload();
	}

	run() {
		const {output, port, watch, path} = this.params;
		const baseDir = `${process.cwd()}/${output}`;

		if(watch) {
			this.bs.watch(`${process.cwd()}/${path}/*.md`, async () => await this.buildAndReload());
		}

		this.bs.init({
			server: {
				baseDir,
			},
			ui: false,
			logPrefix: "Writr",
			port: parseInt(port),
		});
	}

}



import * as browserSync from 'browser-sync';

type Params = {
	output: string;
	port: string;
	watch: boolean;
	path: string;
}

export class Serve {

	bs: any;
	params: Params;

	constructor(params: Params) {
		this.bs = browserSync.create();
		this.params = params;
	}

	run() {
		const {output, port, watch, path} = this.params;
		const baseDir = `${process.cwd()}/${output}`;

		if(watch) {
			this.bs.watch(`${process.cwd()}/${path}/*.md`, async (event: any, file: any) => {
				console.log(`${event} ${file}`);
				this.bs.reload();
			});
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



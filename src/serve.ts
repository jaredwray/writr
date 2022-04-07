import * as browserSync from 'browser-sync';

type Params = {
	output: string;
	port: string;
	watch: boolean;
}

export class Serve {

	bs: any;
	params: Params;

	constructor(params: Params) {
		this.bs = browserSync.create();
		this.params = params;
	}

	run() {
		const {output, port, watch} = this.params;
		const baseDir = `${process.cwd()}/${output}`;

		this.bs.watch(`${process.cwd()}/*.md`, (event: any, file: any) => {
			this.bs.reload();
		});

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



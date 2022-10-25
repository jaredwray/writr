import fs from "fs-extra";
import {HtmlRenderProvider} from "./render/htmRenderlProvider.js";
import {JSONRenderProvider} from "./render/jsonRenderProvider.js";
import {AtomRenderProvider} from "./render/atomRenderProvider.js";
import {ImageRenderProvider} from "./render/imageRenderProvider.js";
import {DataService} from "./data/dataService.js";
import {Config} from "./config.js";

export class SiteGenerator {

	config: Config | undefined;
	data: DataService | undefined;

	constructor(options: any) {
		const params = options.opts();

		this.config = new Config();

		if (params.config) {
			this.config.loadConfig(params.config);
		}

		if (params.path) {
			this.config.loadPath(params.path);
		}

		if (params) {
			this.config.loadParams(params)
		}

		this.config.loadProgram(options);

		this.data = new DataService(this.config);
	}

	async run(): Promise<boolean> {
		let result = true;

		if (this.data === undefined || this.config === undefined) {
			return false;
		}

		if (fs.existsSync(this.config.output)) {
			fs.removeSync(this.config.output);
		}

		let render: boolean | undefined = true;

		for (let i = 0; i < this.config.render.length; i++) {
			let type = this.config.render[i];
			if (type === "html") {
				render = await new HtmlRenderProvider().render(this.data, this.config);
			}
			if (type === "json") {
				render = await new JSONRenderProvider().render(this.data, this.config);
			}
			if (type === "atom") {
				render = await new AtomRenderProvider().render(this.data, this.config);
			}
			if (type === "images") {
				render = await new ImageRenderProvider().render(this.data, this.config);
			}
		}

		if (render) {
			result = render;
		}

		return result;
	}

}

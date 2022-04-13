import * as fs from "fs-extra";
import * as del from "del";
import {HtmlRenderProvider} from "./render/htmRenderlProvider";
import {JSONRenderProvider} from "./render/jsonRenderProvider";
import {AtomRenderProvider} from "./render/atomRenderProvider";
import {ImageRenderProvider} from "./render/imageRenderProvider";
import {Migrate} from "./migrate";
import {DataService} from "./data/dataService";
import {Config} from "./config";

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

		const {migrate} = this.config.params;

		if (migrate) {
			const [src, dest] = this.config.program.args;
			await new Migrate(migrate).migrate(src, dest);
			return true;
		}

		if (fs.existsSync(this.config.output)) {
			del.sync(this.config.output);
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

import fs from "fs-extra";
import {MigrationProviderInterface} from "./migrationProviderInterface.js";
import {ConsoleMessage} from "../log.js";
import {StorageService} from "../storage/storageService.js";
import {Parser} from "../utils/parser.js";

export class MediumMigrationProvider implements MigrationProviderInterface {

	parser: any;
	storage: any;

	constructor() {
		this.parser = new Parser();
		this.storage = new StorageService();
	}

	async migrate(src: string, dest: string): Promise<boolean> {
		new ConsoleMessage().info("Migrating Medium post from " + src + " to " + dest);
		const files = new StorageService().readDir(`${src}/posts`);
		const bodyRegex = /\<body[^>]*\>([^]*)\<\/body/m;

		files.forEach((file) => {
			const slug = file.replace(".html", "");
			const html = fs.readFileSync(`${src}/posts/${file}`, "utf8");
			const [, content] = html.match(bodyRegex) || [];
			const headerMd = this.parser.generateMdHeaders({slug});
			const bodyMd = this.parser.htmlToMd(content);
			const contentMd = headerMd + bodyMd;
			fs.outputFileSync(`${dest}/${slug}.md`, contentMd);
		})

		return true;
	}

}

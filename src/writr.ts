import { Logger, transports } from "winston";
import { DataService } from "./data/dataService";
import { Config } from "./config";
import { HtmlProvider } from "./render/htmlProvider";
import * as del from "del";
import * as fs from "fs-extra";
import { JSONProvider } from "./render/jsonProvider";

export class Writr {
    log: any;

    config: Config | undefined;
    dataStore: DataService | undefined;

    constructor() {
        this.log = new Logger({ transports: [new transports.Console()] });
    }

    parseCLI(process: NodeJS.Process) {
        const program = require("commander");

        program.option('-c, --config <path>', 'custom configuration path');
        program.option('-o, --output <path>', 'path to output generated files');
        program.option('-p, --path <path>', 'out put writr.json (Default) file of all posts and tags');

        program.parse(process.argv);

        this.config = new Config();

        if(program.config) {
            this.config.loadConfig(program.config);
        }

        if(program.path) {
            this.config.loadPath(program.path);
        }

        this.config.loadProgram(program);

        this.dataStore = new DataService(this.config);
    }

    async runCLI(): Promise<boolean> {
        let result = true;

        if(this.dataStore !== undefined && this.config !== undefined) {

            if (fs.existsSync(this.config.output)) {
                del.sync(this.config.output);
            }

            let render: boolean | undefined = true;

            for(let i=0; i < this.config.render.length; i++) {
                let type = this.config.render[i];
                if(type === "html") {
                    render = await new HtmlProvider().render(this.dataStore, this.config);
                }
                if(type === "json") {
                    render = await new JSONProvider().render(this.dataStore, this.config);
                }
            }

            if(render) {
                result = render;
            }

        } else {
            result = false;
        }
        return result;
    }
}
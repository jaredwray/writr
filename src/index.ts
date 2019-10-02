import { Logger, transports } from "winston";
import { DataService } from "./data/dataService";
import { Config } from "./config";
import { HtmlRenderProvider } from "./render/htmRenderlProvider";
import * as del from "del";
import * as fs from "fs-extra";
import { JSONProvider } from "./render/jsonProvider";
import { AtomRenderProvider } from "./render/atomRenderProvider";
import { ImageProvider } from "./render/imageProvider";

export class Writr {
    log: any;

    config: Config | undefined;
    dataStore: DataService | undefined;

    constructor() {
        this.log = new Logger({ transports: [new transports.Console()] });
    }

    parseCLI(process: NodeJS.Process) {

        const program = require("commander");
        
        program.option("-p, --path <path>", "Path of where the blog, config, and template are located");
        program.option("-o, --output <path>", "Path of where to output the generated blog");
        program.option("-r, --render <list>", "What do you want rendered such as html or json (example --render html,json)");
        program.option("-c, --config <path>", "custom configuration path");
        
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
                    render = await new HtmlRenderProvider().render(this.dataStore, this.config);
                }
                if(type === "json") {
                    render = await new JSONProvider().render(this.dataStore, this.config);
                }
                if(type === "atom") {
                    render = await new AtomRenderProvider().render(this.dataStore, this.config);
                }
                if(type === "images") {
                    render = await new ImageProvider().render(this.dataStore, this.config);
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